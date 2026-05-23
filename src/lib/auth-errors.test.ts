// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { toFriendlyError } from './auth-errors';

// Round 25 Wave 7 (item 12 / R24-11): pin the friendly-error mapping.
// Two-tier behaviour:
//   - Block: any message containing a Zitadel/PG internal-code shape
//     gets the fallback (no leak of `INSTANCE-x6Gh3` etc).
//   - Allow: known fragments map to friendly equivalents.
//   - Default: pass through user-facing messages (Zitadel's friendly
//     errors) unchanged.

describe('toFriendlyError', () => {
    it('returns fallback for non-Error values', () => {
        expect(toFriendlyError('plain string', 'fallback')).toBe('fallback');
        expect(toFriendlyError(42, 'fallback')).toBe('fallback');
        expect(toFriendlyError(null, 'fallback')).toBe('fallback');
        expect(toFriendlyError(undefined, 'fallback')).toBe('fallback');
    });

    it('returns generic fallback when no fallback supplied', () => {
        expect(toFriendlyError('not an error')).toBe('An error occurred. Please try again.');
    });

    it('returns fallback for Error with empty message', () => {
        expect(toFriendlyError(new Error(''), 'fallback')).toBe('fallback');
    });

    it('strips Zitadel internal codes from the user-facing string', () => {
        const cases = [
            'Errors.User.NotFound (QUERY-3M9fs)',
            'invalid argument (INSTANCE-x6Gh3)',
            'something went wrong (COMMAND-abc1234)',
            'event store error (EVENT-xyz789)',
        ];
        for (const msg of cases) {
            const got = toFriendlyError(new Error(msg), 'safe fallback');
            expect(got).toBe('safe fallback');
        }
    });

    it('strips Postgres-shaped fragments from the user-facing string', () => {
        const cases = [
            'pq: duplicate key violates uniqueness',
            'SQLSTATE 23505',
            'gorm: record not found',
        ];
        for (const msg of cases) {
            const got = toFriendlyError(new Error(msg), 'safe fallback');
            expect(got).toBe('safe fallback');
        }
    });

    it('maps known Zitadel error fragments to friendly equivalents', () => {
        expect(toFriendlyError(new Error('Code is invalid'))).toBe('The code you entered is invalid or has expired.');
        expect(toFriendlyError(new Error('Password is invalid'))).toBe('The password is incorrect.');
        expect(toFriendlyError(new Error('User.LockedOut'))).toBe('Your account is temporarily locked. Please try again later.');
        expect(toFriendlyError(new Error('rate limit exceeded'))).toBe('Too many requests. Please try again in a moment.');
    });

    it('passes through unknown but safe-looking messages unchanged', () => {
        // Zitadel's user-facing errors are usually already friendly,
        // e.g. "Email is invalid" — no internal code, no PG shape.
        expect(toFriendlyError(new Error('Email is invalid'))).toBe('Email is invalid');
        expect(toFriendlyError(new Error('Login attempts exceeded'))).toBe('Login attempts exceeded');
    });

    it('caps long messages at 200 chars to defend against pathological payloads', () => {
        const long = 'a'.repeat(250);
        expect(toFriendlyError(new Error(long), 'fallback')).toBe('fallback');
    });

    it('block check beats allowlist when both match (defense-in-depth)', () => {
        // A message containing both a friendly fragment AND an
        // internal code MUST get the fallback (the code shouldn't
        // leak just because there's a friendly substring).
        const both = 'Code is invalid (COMMAND-3M9fs)';
        expect(toFriendlyError(new Error(both), 'safe')).toBe('safe');
    });

    it('does not match dashes inside legitimate text (false-positive guard)', () => {
        // The internal-code pattern is anchored on known component
        // prefixes (INSTANCE / COMMAND / etc.), not on any
        // `<word>-<word>` shape. Sanity-check that legitimate text
        // with dashes survives.
        expect(toFriendlyError(new Error('multi-factor authentication required'))).toBe('multi-factor authentication required');
        expect(toFriendlyError(new Error('e-mail address is invalid'))).toBe('e-mail address is invalid');
    });
});
