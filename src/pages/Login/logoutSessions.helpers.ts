// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pure helpers for the F20 multi-session Logout page - extracted
// from Logout.tsx so vitest can pin the parsing + display logic
// without a React/DOM env (matches the project pattern; see
// branding.ts ↔ branding.test.ts and passwordChange.helpers.ts).

/**
 * SessionRow is the per-session shape rendered in the logout
 * picker. Pinned to the fields the UI actually consumes - the
 * upstream `SearchSessions` response has more, but pinning here
 * keeps the contract obvious and the test mock minimal.
 */
export interface SessionRow {
    id: string;
    loginName: string;
    displayName: string;
    creationDate?: string;
    organizationId?: string;
}

/**
 * parseSearchSessionsResponse extracts the fields the F20 UI
 * needs from the auth-proxy `SearchSessions` response. Tolerant of
 * the upstream Zitadel shape AND the proxy's decoy-aware splice
 * (Round 22 Finding 2): both emit `{details, sessions}` where each
 * session has `factors.user.{id, loginName, displayName,
 * organizationId}`. Any session missing a user.id is dropped - it
 * would render as an empty row in the picker, which is worse UX
 * than silently omitting it (most likely a malformed entry; the
 * cookie can carry a partial-state row mid-flow).
 *
 * NOTE: the shape conflates "session id" with "user.id". The
 * picker keys on session id (so per-session remove targets the
 * correct row even when one user has multiple sessions in the
 * cookie). user.id is exposed only for grouping / dedup if a
 * future iteration wants it.
 */
export function parseSearchSessionsResponse(raw: unknown): SessionRow[] {
    if (raw == null || typeof raw !== 'object') return [];
    const sessions = (raw as { sessions?: unknown }).sessions;
    if (!Array.isArray(sessions)) return [];

    const rows: SessionRow[] = [];
    for (const s of sessions) {
        if (s == null || typeof s !== 'object') continue;
        const id = (s as { id?: unknown }).id;
        if (typeof id !== 'string' || id === '') continue;

        const factors = (s as { factors?: unknown }).factors;
        const user = factors != null && typeof factors === 'object'
            ? (factors as { user?: unknown }).user
            : undefined;
        if (user == null || typeof user !== 'object') continue;

        const userId = (user as { id?: unknown }).id;
        if (typeof userId !== 'string' || userId === '') continue;

        const loginName = (user as { loginName?: unknown }).loginName;
        const displayName = (user as { displayName?: unknown }).displayName;
        const organizationId = (user as { organizationId?: unknown }).organizationId;
        const creationDate = (s as { creationDate?: unknown }).creationDate;

        rows.push({
            id,
            loginName: typeof loginName === 'string' ? loginName : '',
            // displayName falls back to loginName so the picker is
            // never blank - Zitadel doesn't always populate it for
            // freshly-created sessions.
            displayName: typeof displayName === 'string' && displayName !== ''
                ? displayName
                : (typeof loginName === 'string' ? loginName : ''),
            creationDate: typeof creationDate === 'string' ? creationDate : undefined,
            organizationId: typeof organizationId === 'string' ? organizationId : undefined,
        });
    }
    return rows;
}

/**
 * resolvePostLogoutRedirect returns a same-origin URL to redirect
 * to after Zitadel's OIDC end_session bounces back through the SPA.
 * Zitadel's V2 login UI passes the post-logout target via a
 * `post_logout_redirect` query param when redirecting to the
 * `LoginV2.BaseURI/logout` page - usually a relative path like
 * `/logout/done` but defended here as if it could be hostile (the
 * SPA inherits the F-sec-16 posture: never trust a query-param URL
 * verbatim).
 *
 * Allowed shapes:
 *   - Relative path (`/logout/done`, `/dashboard`) → join with origin
 *   - Same-origin absolute URL (`https://sw.vhco.pro/logout/done`)
 *
 * Anything else (cross-origin URL, javascript:, protocol-relative)
 * collapses to the safe default `/login/logout/done` - Zitadel's
 * canonical post-logout landing page that the SPA owns.
 */
export function resolvePostLogoutRedirect(raw: string, origin: string): string {
    const fallback = '/login/logout/done';
    if (!raw) return fallback;
    // protocol-relative `//evil.example.com` - the URL parser would
    // accept this as same-origin if we joined it with `origin`, but
    // the browser's `location.replace` would actually navigate
    // cross-origin. Reject early.
    if (raw.startsWith('//')) return fallback;
    // javascript: / data: / vbscript: - same defensive class.
    if (/^[a-z][a-z0-9+\-.]*:/i.test(raw) && !raw.startsWith('http://') && !raw.startsWith('https://')) {
        return fallback;
    }
    // Relative path - join with origin via URL constructor (handles
    // `..` traversal, query-string preservation, etc.).
    try {
        const parsed = new URL(raw, origin);
        if (parsed.origin !== origin) return fallback;
        // Rebuild from parts so an attacker can't smuggle credentials
        // (`https://user:pass@host`) or fragments past the same-origin
        // gate.
        let path = parsed.pathname + parsed.search + parsed.hash;
        // Zitadel's V2 login UI builds `post_logout_redirect` paths
        // relative to its own login base (`/`), so it sends targets
        // like `/logout/done`. Stackweaver's SPA mounts the same
        // logical pages under `/login/*` (LoginV2.BaseURI is set to
        // `<host>/login` in zitadel-defaults.yaml). Translate the
        // common Zitadel-sourced paths so the user lands on a page
        // we actually serve. Anything outside this allowlist passes
        // through verbatim - letting an RP control the post-logout
        // landing as long as it's same-origin.
        const zitadelToSpaPathMap: Record<string, string> = {
            '/logout/done': '/login/logout/done',
            '/loginname': '/login/loginname',
        };
        // Match on the pathname only - preserves query/hash on the rewrite.
        const rewritten = zitadelToSpaPathMap[parsed.pathname];
        if (rewritten) {
            path = rewritten + parsed.search + parsed.hash;
        }
        return path;
    } catch {
        return fallback;
    }
}

/**
 * isJWTShape - defensive shape check on the `logout_token` query
 * param. Round 24 Finding 4: before this check the OIDC end_session
 * return path accepted any non-empty `logout_token`, which let a
 * crafted `?logout_token=garbage&post_logout_redirect=/...` URL
 * trigger an immediate one-shot redirect bypassing the multi-session
 * UI without the user having actually logged out.
 *
 * A real JWT has three base64url-encoded segments separated by `.`.
 * We don't verify the signature here (the token is server-issued and
 * can't be revoked client-side anyway) - just the wire shape. This
 * cuts off the trivial garbage-string bypass while staying loose
 * enough that any legitimate Zitadel-signed token passes.
 */
export function isJWTShape(raw: string): boolean {
    if (!raw) return false;
    const parts = raw.split('.');
    if (parts.length !== 3) return false;
    const segmentRe = /^[A-Za-z0-9_-]+$/; // base64url alphabet
    return parts.every((p) => p.length > 0 && segmentRe.test(p));
}

/**
 * initialsFromName returns the 1-2 char avatar initials from a
 * display name. Used by the picker's per-session avatar circle.
 * Empty / undefined input → '?'.
 */
export function initialsFromName(name: string | undefined): string {
    if (!name) return '?';
    const trimmed = name.trim();
    if (trimmed === '') return '?';

    // Email-shaped → use the local part before @.
    const localPart = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;

    // Split on whitespace + common separators (.-_) so emails like
    // first.last@x render as "FL" not just "F".
    const parts = localPart.split(/[\s._-]+/).filter((p) => p !== '');
    if (parts.length === 0) return localPart.charAt(0).toUpperCase() || '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}
