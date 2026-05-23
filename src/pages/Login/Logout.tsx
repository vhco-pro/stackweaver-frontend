// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, X } from 'lucide-react';
import { clearTokens, getLogoutUrl } from '@/lib/zitadel';
import { searchSessions, deleteSession } from '@/api/auth-client';
import { useMountEffect } from '@/hooks/useMountEffect';
import LoginLayout from './LoginLayout';
import { parseSearchSessionsResponse, initialsFromName, resolvePostLogoutRedirect, isJWTShape, type SessionRow } from './logoutSessions.helpers';

/**
 * F20 — Multi-session Logout page.
 *
 * Plan contract (docs/internal/plans/features/custom-login-ui-plan.md):
 *   /login/logout multi-session UI surfaced by the 2026-04-30 parity
 *   audit vs the upstream Zitadel hosted login UI. Upstream lists
 *   active sessions with per-session remove + clear-all before the
 *   OIDC end_session redirect. Stackweaver's previous Logout.tsx was
 *   a single-confirm-then-redirect button — functionally equivalent
 *   for the canonical RP-initiated logout case (Zitadel terminates
 *   the server session regardless), but didn't surface the selector
 *   for users with multiple sessions in the cookie (account picker
 *   path).
 *
 * Behaviour:
 *   - Fetch sessions via the auth-proxy `SearchSessions` (already
 *     cookie-aware; returns rows for sessions in the cookie + the
 *     Round-22 `details` envelope). React Query handles caching,
 *     retries, and the swap-after-delete invalidation.
 *   - Render a per-session row with avatar initials + display name +
 *     loginName + a per-session "Remove" (X) button.
 *   - "Sign out of all" → primary CTA — clears local tokens AND
 *     redirects to Zitadel's OIDC end_session endpoint via the proxy
 *     so the OP-side session is terminated too. (Per-session removes
 *     are local cookie cleanups; only end_session terminates the
 *     full OIDC session.)
 *   - "Cancel" → navigate(-1) for users who hit logout by mistake.
 *
 * Empty / error states:
 *   - No sessions in the cookie → render the simple confirm CTA
 *     (the legacy single-button flow). Hitting /logout with no
 *     active sessions is the post-logout return path; we should
 *     still let the user re-authenticate rather than rendering a
 *     blank page.
 *   - Fetch error (degraded Zitadel / proxy 5xx) → fall back to the
 *     same confirm CTA so the user isn't blocked. Same defensive
 *     posture as F-chaos-1/3.
 */
export default function Logout() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();
    const [removingId, setRemovingId] = useState<string | null>(null);

    // OIDC end_session return path. Zitadel's `LoginV2.BaseURI`
    // points at `/login`, so after the OP-side session terminates
    // Zitadel bounces the browser to
    // `/login/logout?logout_token=…&post_logout_redirect=…`. The
    // `logout_token` is a Zitadel-signed JWT for backchannel
    // signalling — already revoked server-side, so the SPA's only
    // job is to honour the `post_logout_redirect` and finish the
    // round-trip. Without this, sign-out-of-all leaves the user on
    // a dead-end /login/logout page that re-renders the confirm UI
    // (because there are no sessions left), which would let them
    // accidentally re-fire end_session in a loop.
    //
    // Round 24 Finding 4: defensive shape check on `logout_token`
    // before honouring the redirect. The previous implementation
    // accepted ANY non-empty `logout_token` value, so an attacker
    // crafting `?logout_token=garbage&post_logout_redirect=/login/
    // loginname` could trigger an immediate one-shot redirect that
    // bypasses the multi-session UI without the user having
    // actually logged out (cookies + sessionStorage stay intact).
    // While the `post_logout_redirect` is same-origin gated by
    // `resolvePostLogoutRedirect` (so no open-redirect / cross-
    // origin exfil), the bypass-without-logout was a UX-confusion
    // vector. Now we require `logout_token` to LOOK like a JWT
    // (three base64url-encoded segments) — matches what Zitadel
    // legitimately emits and rejects garbage.
    useMountEffect(() => {
        const logoutToken = searchParams.get('logout_token');
        const postLogout = searchParams.get('post_logout_redirect');
        if (logoutToken && postLogout && isJWTShape(logoutToken)) {
            const target = resolvePostLogoutRedirect(postLogout, window.location.origin);
            // Replace so the user can't back-button into the dead-
            // end /login/logout?logout_token=… URL.
            window.location.replace(target);
        }
    });

    const { data: sessions, isLoading, isError } = useQuery<SessionRow[]>({
        queryKey: ['logout-sessions'],
        queryFn: async () => {
            // Empty body — the auth proxy filters to the cookie's
            // sessionIds itself. Round-22 hardened the splice so the
            // response always carries the `details` envelope.
            const raw = await searchSessions({});
            return parseSearchSessionsResponse(raw);
        },
        // No need to refetch on focus — the user is on a transient
        // page, and a stale list is fine (the worst case is the user
        // sees a session they just removed for an extra render).
        staleTime: 30_000,
        retry: 1,
        // Round 25 Wave 7 (item 8 / R24-6): evict on unmount to defeat
        // the multi-tab same-machine cross-user leak. Without this,
        // tab A as Alice would cache her sessions; tab B opening
        // /login/logout would briefly render Alice's list before the
        // new fetch lands. /login/logout is a transient page so the
        // cost of an extra fetch on remount is negligible.
        gcTime: 0,
    });

    const handleSignOutAll = () => {
        clearTokens();
        window.location.href = getLogoutUrl();
    };

    const handleRemoveSession = async (sessionId: string) => {
        if (removingId) return; // single-flight per click
        setRemovingId(sessionId);
        try {
            await deleteSession(sessionId);
        } catch {
            // Best-effort: a 4xx here means the session was already
            // gone server-side, which is also a successful outcome
            // for the user's intent. Refresh either way.
        } finally {
            setRemovingId(null);
            await queryClient.invalidateQueries({ queryKey: ['logout-sessions'] });
        }
    };

    const renderConfirmCta = () => (
        <div className="space-y-4 text-center" data-testid="logout-confirm">
            <LogOut className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Are you sure you want to sign out?</p>
            <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { void navigate(-1); }}>Cancel</Button>
                <Button variant="destructive" className="flex-1" onClick={handleSignOutAll}>Sign out</Button>
            </div>
        </div>
    );

    if (isLoading) {
        return (
            <LoginLayout title="Sign out">
                <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            </LoginLayout>
        );
    }

    // Defensive paths — degraded Zitadel or empty cookie. The legacy
    // single-button confirm is correct for both: the user can still
    // proceed to the OIDC end_session redirect.
    if (isError || !sessions || sessions.length === 0) {
        return <LoginLayout title="Sign out">{renderConfirmCta()}</LoginLayout>;
    }

    return (
        <LoginLayout
            title="Sign out"
            subtitle="Choose an account to remove, or sign out of all"
        >
            <ul className="space-y-2" data-testid="logout-sessions-list">
                {sessions.map((s) => (
                    <li
                        key={s.id}
                        className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                        data-testid="logout-session-row"
                    >
                        <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground"
                            aria-hidden="true"
                        >
                            {initialsFromName(s.displayName)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{s.displayName}</p>
                            {s.loginName && s.loginName !== s.displayName && (
                                <p className="truncate text-xs text-muted-foreground">{s.loginName}</p>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove session for ${s.displayName}`}
                            onClick={() => { void handleRemoveSession(s.id); }}
                            disabled={removingId !== null}
                            data-testid="logout-session-remove"
                        >
                            {removingId === s.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <X className="h-4 w-4" />
                            )}
                        </Button>
                    </li>
                ))}
            </ul>
            <div className="mt-6 flex gap-2">
                <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => { void navigate(-1); }}
                    disabled={removingId !== null}
                >
                    Cancel
                </Button>
                <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={handleSignOutAll}
                    disabled={removingId !== null}
                    data-testid="logout-sign-out-all"
                >
                    Sign out of all
                </Button>
            </div>
        </LoginLayout>
    );
}
