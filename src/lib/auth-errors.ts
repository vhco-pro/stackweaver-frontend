// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Round 25 Wave 7 (item 12 / R24-11): translate proxy/Zitadel error
 * shapes into user-friendly strings before they reach the SPA's
 * error banners.
 *
 * Pre-fix the SPA called `setError((err as Error).message)` everywhere,
 * surfacing Zitadel internals like `INSTANCE-x6Gh3`, `COMMAND-3M9fs`,
 * PostgreSQL-shaped strings, and internal user/org IDs in user-facing
 * error toasts. Not exploitable but aids reconnaissance.
 *
 * Two-tier allowlist:
 *   1. Pattern allowlist - recognised error CONTENT (e.g. "Code is invalid",
 *      "Password.NotMatched") gets mapped to a friendly equivalent.
 *   2. Internal-code blocklist - any message containing a Zitadel /
 *      PostgreSQL internal-code shape gets replaced with the generic
 *      fallback regardless of what else it says.
 *
 * Callers should pair this with a context-specific fallback, e.g.:
 *
 *     setError(toFriendlyError(err, 'Failed to start login'));
 *
 * The helper returns the fallback for unknown / blocklisted shapes, the
 * mapped string for allowlisted ones, and the original message
 * (sanitised) for messages that are neither dangerous nor explicitly
 * allowlisted.
 */

// Zitadel error-code shapes that signal "internal" surface and must
// never reach the user. Format is `<COMPONENT>-<short-id>`, e.g.
// `INSTANCE-x6Gh3`. Match conservatively - only known component
// prefixes - to avoid false positives on legitimate text containing
// dashes.
const internalCodeRegex = /\b(INSTANCE|COMMAND|QUERY|EVENT|PROJECTION|REPOSITORY|MIGRATION|HANDLER|DATABASE|SECURITY|AUTHZ|GRPC|HTTP|EXEC|CONFIG)-[A-Za-z0-9]{4,}\b/;

// PostgreSQL-shape error fragments that occasionally bubble up.
const postgresPattern = /\bSQLSTATE\b|\bpq:|\bgorm: /;

// Friendly-string mapping for known Zitadel error fragments. Keys are
// substring-matched (case-sensitive) - Zitadel emits these strings
// verbatim. Add to this map when an audit catches a new leak.
const friendlyMessageMap: Record<string, string> = {
    'Code is invalid': 'The code you entered is invalid or has expired.',
    'Password is invalid': 'The password is incorrect.',
    'Password.NotMatched': 'The password is incorrect.',
    'User.AlreadyExists': 'An account with this email already exists.',
    'User.LockedOut': 'Your account is temporarily locked. Please try again later.',
    'session does not authorize this user': 'You are not authorised for this action.',
    'no valid session for this resource': 'Your session has expired. Please sign in again.',
    'request body too large': 'The request was too large to process.',
    'rate limit exceeded': 'Too many requests. Please try again in a moment.',
};

// Generic fallback returned when the error message is missing,
// internal, or blocklisted.
const genericFallback = 'An error occurred. Please try again.';

/**
 * toFriendlyError translates an unknown error value into a user-safe
 * string. `fallback` is used when the error has no usable message OR
 * when the message contains internal codes that must not leak.
 */
export function toFriendlyError(err: unknown, fallback?: string): string {
    const safeFallback = fallback ?? genericFallback;
    if (!(err instanceof Error)) {
        return safeFallback;
    }
    const msg = err.message;
    if (!msg) {
        return safeFallback;
    }

    // Block: any internal-code shape gets the generic fallback.
    if (internalCodeRegex.test(msg) || postgresPattern.test(msg)) {
        return safeFallback;
    }

    // Allow: known fragments map to friendly equivalents.
    for (const [needle, friendly] of Object.entries(friendlyMessageMap)) {
        if (msg.includes(needle)) {
            return friendly;
        }
    }

    // Default: pass through the message. Zitadel's user-facing errors
    // are usually already short and friendly (e.g. "Email is invalid").
    // Cap length to defend against pathological payloads.
    if (msg.length > 200) {
        return safeFallback;
    }
    return msg;
}
