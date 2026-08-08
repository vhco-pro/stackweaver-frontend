// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { parseSearchSessionsResponse, initialsFromName, resolvePostLogoutRedirect, isJWTShape } from './logoutSessions.helpers';

// F20 - multi-session Logout page helpers.
// The render path is a thin shell over `parseSearchSessionsResponse`
// (extracts the SearchSessions response into per-row fields the
// picker renders) and `initialsFromName` (avatar initials). Pure
// helpers tested without a React/DOM env, same pattern as
// branding.helpers.ts and passwordChange.helpers.ts.

describe('parseSearchSessionsResponse', () => {
    it('returns [] for null / undefined / non-object input', () => {
        expect(parseSearchSessionsResponse(null)).toEqual([]);
        expect(parseSearchSessionsResponse(undefined)).toEqual([]);
        expect(parseSearchSessionsResponse('string')).toEqual([]);
        expect(parseSearchSessionsResponse(42)).toEqual([]);
    });

    it('returns [] when sessions is missing or not an array', () => {
        expect(parseSearchSessionsResponse({})).toEqual([]);
        expect(parseSearchSessionsResponse({ sessions: null })).toEqual([]);
        expect(parseSearchSessionsResponse({ sessions: 'not array' })).toEqual([]);
    });

    it('extracts a fully-populated session row', () => {
        const got = parseSearchSessionsResponse({
            details: { totalResult: '1', timestamp: '2026-05-02T10:00:00Z' },
            sessions: [
                {
                    id: 'session-1',
                    creationDate: '2026-05-02T09:00:00Z',
                    factors: {
                        user: {
                            id: 'user-1',
                            loginName: 'alice@example.com',
                            displayName: 'Alice Anderson',
                            organizationId: 'org-1',
                        },
                    },
                },
            ],
        });
        expect(got).toEqual([
            {
                id: 'session-1',
                loginName: 'alice@example.com',
                displayName: 'Alice Anderson',
                creationDate: '2026-05-02T09:00:00Z',
                organizationId: 'org-1',
            },
        ]);
    });

    it('falls back to loginName when displayName is missing or empty', () => {
        const got = parseSearchSessionsResponse({
            sessions: [
                { id: 's1', factors: { user: { id: 'u1', loginName: 'bob@x.com', displayName: '' } } },
                { id: 's2', factors: { user: { id: 'u2', loginName: 'carol@x.com' } } },
            ],
        });
        expect(got).toHaveLength(2);
        expect(got[0].displayName).toBe('bob@x.com');
        expect(got[1].displayName).toBe('carol@x.com');
    });

    it('drops sessions with no id', () => {
        const got = parseSearchSessionsResponse({
            sessions: [
                { id: '', factors: { user: { id: 'u1', loginName: 'a@x.com' } } },
                { factors: { user: { id: 'u2', loginName: 'b@x.com' } } },
                { id: 's1', factors: { user: { id: 'u1', loginName: 'a@x.com' } } },
            ],
        });
        expect(got).toHaveLength(1);
        expect(got[0].id).toBe('s1');
    });

    it('drops sessions with no user.id (malformed mid-flow rows)', () => {
        const got = parseSearchSessionsResponse({
            sessions: [
                { id: 's1' }, // no factors at all
                { id: 's2', factors: {} }, // factors but no user
                { id: 's3', factors: { user: {} } }, // user but no id
                { id: 's4', factors: { user: { id: 'u4', loginName: 'good@x.com' } } },
            ],
        });
        expect(got).toHaveLength(1);
        expect(got[0].id).toBe('s4');
    });

    it('preserves session order from the upstream response', () => {
        const got = parseSearchSessionsResponse({
            sessions: [
                { id: 's-third', factors: { user: { id: 'u3', loginName: 'c@x.com' } } },
                { id: 's-first', factors: { user: { id: 'u1', loginName: 'a@x.com' } } },
                { id: 's-second', factors: { user: { id: 'u2', loginName: 'b@x.com' } } },
            ],
        });
        expect(got.map((r) => r.id)).toEqual(['s-third', 's-first', 's-second']);
    });
});

describe('resolvePostLogoutRedirect', () => {
    const ORIGIN = 'https://sw.vhco.pro';
    const SAFE_DEFAULT = '/login/logout/done';

    it('falls back to safe default for empty input', () => {
        expect(resolvePostLogoutRedirect('', ORIGIN)).toBe(SAFE_DEFAULT);
    });

    it('accepts a relative path', () => {
        expect(resolvePostLogoutRedirect('/dashboard', ORIGIN)).toBe('/dashboard');
        expect(resolvePostLogoutRedirect('/somewhere-else', ORIGIN)).toBe('/somewhere-else');
    });

    it('preserves the relative path query-string and hash', () => {
        expect(resolvePostLogoutRedirect('/dashboard?from=logout', ORIGIN)).toBe('/dashboard?from=logout');
        expect(resolvePostLogoutRedirect('/dashboard#section', ORIGIN)).toBe('/dashboard#section');
    });

    it('accepts a same-origin absolute URL', () => {
        expect(resolvePostLogoutRedirect('https://sw.vhco.pro/dashboard', ORIGIN)).toBe('/dashboard');
    });

    it('rejects cross-origin URLs (open-redirect guard)', () => {
        expect(resolvePostLogoutRedirect('https://evil.example/cb', ORIGIN)).toBe(SAFE_DEFAULT);
        expect(resolvePostLogoutRedirect('https://evil.com/anything', ORIGIN)).toBe(SAFE_DEFAULT);
    });

    it('rejects protocol-relative URLs', () => {
        // `//evil.com/cb` parses as same-origin if joined naively; the
        // browser would actually navigate cross-origin.
        expect(resolvePostLogoutRedirect('//evil.example/cb', ORIGIN)).toBe(SAFE_DEFAULT);
    });

    it('rejects javascript: / data: / vbscript: schemes', () => {
        expect(resolvePostLogoutRedirect('javascript:alert(1)', ORIGIN)).toBe(SAFE_DEFAULT);
        expect(resolvePostLogoutRedirect('data:text/html,<script>1</script>', ORIGIN)).toBe(SAFE_DEFAULT);
        expect(resolvePostLogoutRedirect('vbscript:msgbox(1)', ORIGIN)).toBe(SAFE_DEFAULT);
    });

    it('strips embedded credentials from same-origin URLs', () => {
        // `https://user:pass@sw.vhco.pro/dashboard` - the URL parser
        // would accept this as same-origin but the browser navigation
        // would honor the credentials. We rebuild from path+search+hash
        // to drop them.
        const got = resolvePostLogoutRedirect('https://user:pass@sw.vhco.pro/dashboard', ORIGIN);
        expect(got).not.toContain('user:pass');
        expect(got).toBe('/dashboard');
    });

    it('returns fallback for unparseable URLs', () => {
        // The URL constructor is forgiving - most strings parse as
        // relative paths. We exercise the try/catch arm with truly
        // malformed input.
        expect(resolvePostLogoutRedirect('http://[invalid', ORIGIN)).toBe(SAFE_DEFAULT);
    });

    it('translates Zitadel-sourced /logout/done to the SPA route /login/logout/done', () => {
        // Zitadel's V2 login UI builds post_logout_redirect paths
        // relative to its own login base. Stackweaver mounts the same
        // pages under /login/*, so we translate the common ones. This
        // avoids landing the user on a 404 after the OIDC end_session
        // round-trip.
        expect(resolvePostLogoutRedirect('/logout/done', ORIGIN)).toBe('/login/logout/done');
        expect(resolvePostLogoutRedirect('/loginname', ORIGIN)).toBe('/login/loginname');
    });

    it('preserves query+hash when translating Zitadel-sourced paths', () => {
        expect(resolvePostLogoutRedirect('/logout/done?reason=manual', ORIGIN)).toBe('/login/logout/done?reason=manual');
        expect(resolvePostLogoutRedirect('/logout/done#bye', ORIGIN)).toBe('/login/logout/done#bye');
    });

    it('passes through SPA-native /login/* paths verbatim', () => {
        // RPs that already construct the full /login/* path should
        // pass through unchanged.
        expect(resolvePostLogoutRedirect('/login/logout/done', ORIGIN)).toBe('/login/logout/done');
        expect(resolvePostLogoutRedirect('/login/loginname', ORIGIN)).toBe('/login/loginname');
    });
});

describe('isJWTShape (Round 24 Finding 4 defensive logout_token check)', () => {
    // Sample real-shape JWT (header.payload.signature, all
    // base64url) - no actual signature, just the wire shape.
    const realJWT = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

    it('accepts a real-shape JWT', () => {
        expect(isJWTShape(realJWT)).toBe(true);
    });

    it('accepts JWT with base64url chars (-, _) but no padding', () => {
        // Round-trip: base64url uses - and _ instead of + and /,
        // and strips trailing =. All three should be in scope.
        expect(isJWTShape('aA-_.b-_.c-_')).toBe(true);
    });

    it('rejects empty string', () => {
        expect(isJWTShape('')).toBe(false);
    });

    it('rejects garbage with the right separator count', () => {
        // The agent's exploit: ?logout_token=garbage. Without dots
        // it's clearly not a JWT.
        expect(isJWTShape('garbage')).toBe(false);
    });

    it('rejects malformed: only 2 segments', () => {
        expect(isJWTShape('a.b')).toBe(false);
    });

    it('rejects malformed: 4 segments', () => {
        expect(isJWTShape('a.b.c.d')).toBe(false);
    });

    it('rejects malformed: empty middle segment', () => {
        expect(isJWTShape('a..c')).toBe(false);
    });

    it('rejects non-base64url characters (=, +, /, space)', () => {
        // Standard base64 padding char =
        expect(isJWTShape('aA==.bB.cC')).toBe(false);
        // Standard base64 + and /
        expect(isJWTShape('aA+.bB.cC')).toBe(false);
        expect(isJWTShape('aA/.bB.cC')).toBe(false);
        // Space - definitely not JWT-shaped
        expect(isJWTShape('aA bB.cC.dD')).toBe(false);
    });

    it('rejects URL-encoded JWT (%-escapes - what an attacker might paste raw)', () => {
        expect(isJWTShape('a%2Eb.c.d')).toBe(false);
    });
});

describe('initialsFromName', () => {
    it('returns ? for empty / undefined input', () => {
        expect(initialsFromName(undefined)).toBe('?');
        expect(initialsFromName('')).toBe('?');
        expect(initialsFromName('   ')).toBe('?');
    });

    it('returns first char uppercased for single-word names', () => {
        expect(initialsFromName('alice')).toBe('A');
        expect(initialsFromName('Bob')).toBe('B');
    });

    it('returns first char of first + first char of second word', () => {
        expect(initialsFromName('alice anderson')).toBe('AA');
        expect(initialsFromName('Carol Connor')).toBe('CC');
    });

    it('handles email local-part (split on . _ -)', () => {
        expect(initialsFromName('first.last@example.com')).toBe('FL');
        expect(initialsFromName('jane_doe@x.com')).toBe('JD');
        expect(initialsFromName('mary-jane@x.com')).toBe('MJ');
    });

    it('handles single-name email', () => {
        expect(initialsFromName('admin@example.com')).toBe('A');
    });

    it('uppercases the result', () => {
        expect(initialsFromName('alice anderson')).toBe('AA');
        expect(initialsFromName('lower.case@x.com')).toBe('LC');
    });
});
