// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Pure OIDC helpers extracted from `zitadel.ts` so they can be
 * unit-tested without pulling in the runtime-config / browser-window
 * dependencies of the main module.
 *
 * Round 25 Wave 8 (item 2 / F-chaos-4).
 */

/**
 * verifyMaxAge checks that the id_token's `auth_time` claim is within
 * the OIDC `max_age` budget plus a small clock-skew tolerance. Pure
 * function - extracted so it's unit-testable without mocking the full
 * token-exchange flow. Returns the literal string `'ok'` on success,
 * or a human-readable error message on failure.
 *
 * Round 25 Wave 8 (item 2 / F-chaos-4): OIDC §3.1.2.1 compliance.
 */
export function verifyMaxAge(
    authTimeClaim: unknown,
    maxAge: number,
    nowSeconds: number,
    clockSkewSeconds = 30,
): string {
    // Reject null / undefined explicitly - `Number(null)` returns 0,
    // which would silently pass through as a "very old" auth_time.
    if (authTimeClaim === null || authTimeClaim === undefined) {
        return 'OIDC max_age check failed - id_token missing auth_time claim';
    }
    const authTime = typeof authTimeClaim === 'number' ? authTimeClaim : Number(authTimeClaim);
    if (!Number.isFinite(authTime)) {
        return 'OIDC max_age check failed - id_token missing auth_time claim';
    }
    const ageSeconds = nowSeconds - authTime;
    if (ageSeconds > maxAge + clockSkewSeconds) {
        return `OIDC max_age exceeded (auth_time too old: ${ageSeconds}s > ${maxAge}s + ${clockSkewSeconds}s skew)`;
    }
    return 'ok';
}
