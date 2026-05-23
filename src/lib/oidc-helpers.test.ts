// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { verifyMaxAge } from './oidc-helpers';

// Round 25 Wave 8 (item 2 / F-chaos-4): pin the OIDC §3.1.2.1
// max_age verification logic. Pure function, no mocks.

describe('verifyMaxAge', () => {
    const now = 1_700_000_000;

    it('accepts auth_time well within budget', () => {
        // Authenticated 30s ago, budget 300s — well within.
        expect(verifyMaxAge(now - 30, 300, now)).toBe('ok');
    });

    it('accepts auth_time at exactly max_age', () => {
        expect(verifyMaxAge(now - 300, 300, now)).toBe('ok');
    });

    it('accepts auth_time just outside max_age but within clock-skew tolerance', () => {
        // 10s past max_age, default 30s skew → still accepted.
        expect(verifyMaxAge(now - 310, 300, now)).toBe('ok');
        // At the skew boundary.
        expect(verifyMaxAge(now - 330, 300, now)).toBe('ok');
    });

    it('rejects auth_time outside max_age + skew', () => {
        // 31s past max_age, default 30s skew → rejected.
        const got = verifyMaxAge(now - 331, 300, now);
        expect(got).not.toBe('ok');
        expect(got).toContain('max_age exceeded');
    });

    it('rejects auth_time way outside max_age', () => {
        const got = verifyMaxAge(now - 3600, 300, now);
        expect(got).not.toBe('ok');
        expect(got).toContain('max_age exceeded');
    });

    it('rejects missing auth_time claim', () => {
        expect(verifyMaxAge(undefined, 300, now)).toContain('missing auth_time');
        expect(verifyMaxAge(null, 300, now)).toContain('missing auth_time');
        expect(verifyMaxAge('not-a-number', 300, now)).toContain('missing auth_time');
    });

    it('coerces numeric-string auth_time (some IdPs return as JSON number, some as string)', () => {
        // Number-like string is accepted via Number() coercion.
        expect(verifyMaxAge(String(now - 30), 300, now)).toBe('ok');
        expect(verifyMaxAge(String(now - 3600), 300, now)).toContain('max_age exceeded');
    });

    it('honours custom clock-skew tolerance', () => {
        // 100s past max_age, 60s skew → rejected (40s past tolerance).
        expect(verifyMaxAge(now - 400, 300, now, 60)).toContain('max_age exceeded');
        // 50s past max_age, 60s skew → accepted.
        expect(verifyMaxAge(now - 350, 300, now, 60)).toBe('ok');
    });

    it('treats max_age=0 as "must have just authenticated"', () => {
        // max_age=0 means the user must re-authenticate. Default skew
        // gives a 30s grace window.
        expect(verifyMaxAge(now - 10, 0, now)).toBe('ok');
        expect(verifyMaxAge(now - 30, 0, now)).toBe('ok');
        expect(verifyMaxAge(now - 31, 0, now)).toContain('max_age exceeded');
    });
});
