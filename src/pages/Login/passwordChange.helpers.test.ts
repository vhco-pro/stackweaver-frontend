// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { validatePasswordChangeInput } from './passwordChange.helpers';

// F19 - `/login/password/change` page input validation.
//
// The render path is a thin shell over `validatePasswordChangeInput`
// for the pre-submit checks; testing the pure validator gives full
// coverage of the precedence rules without spinning up a React/DOM
// environment. Same pattern as `branding.test.ts`.
//
// Validation precedence is load-bearing - a user who fills nothing
// must see "Current password is required" first, not "Missing user
// context", because the user-context error implies a deeper bug
// (the page was reached without the SPA threading sessionId/userId
// through the URL).

describe('validatePasswordChangeInput', () => {
    const valid = {
        currentPassword: 'OldPassword1!',
        newPassword: 'NewPassword2!',
        confirm: 'NewPassword2!',
        userId: '123456789',
    };

    it('accepts a fully-valid input', () => {
        expect(validatePasswordChangeInput(valid)).toEqual({ ok: true });
    });

    it('rejects empty current password', () => {
        const got = validatePasswordChangeInput({ ...valid, currentPassword: '' });
        expect(got).toEqual({ ok: false, error: 'Current password is required' });
    });

    it('rejects empty new password', () => {
        const got = validatePasswordChangeInput({ ...valid, newPassword: '', confirm: '' });
        expect(got).toEqual({ ok: false, error: 'New password is required' });
    });

    it('rejects when new + confirm mismatch', () => {
        const got = validatePasswordChangeInput({ ...valid, confirm: 'TypoPassword!' });
        expect(got).toEqual({ ok: false, error: 'New passwords do not match' });
    });

    it('rejects when new password equals current (no rotation)', () => {
        const got = validatePasswordChangeInput({
            ...valid,
            newPassword: valid.currentPassword,
            confirm: valid.currentPassword,
        });
        expect(got).toEqual({ ok: false, error: 'New password must differ from the current password' });
    });

    it('rejects empty userId (page mounted without SPA context)', () => {
        const got = validatePasswordChangeInput({ ...valid, userId: '' });
        expect(got).toEqual({ ok: false, error: 'Missing user context - please sign in again' });
    });

    // Precedence checks - multiple errors at once must surface the
    // FIRST one in the validation order. A user filling nothing
    // shouldn't see "missing user context" before the obvious
    // "current password required" hint.
    it('precedence: empty current beats missing userId', () => {
        const got = validatePasswordChangeInput({
            currentPassword: '',
            newPassword: '',
            confirm: '',
            userId: '',
        });
        expect(got.error).toBe('Current password is required');
    });

    it('precedence: empty new beats mismatch', () => {
        const got = validatePasswordChangeInput({
            ...valid,
            newPassword: '',
            confirm: 'something',
        });
        expect(got.error).toBe('New password is required');
    });

    it('precedence: mismatch beats same-as-current', () => {
        // New differs from current AND from confirm → mismatch should
        // win over the same-as-current check (which doesn't apply here
        // anyway, but the precedence test pins the order).
        const got = validatePasswordChangeInput({
            currentPassword: 'OldPassword1!',
            newPassword: 'NewPassword2!',
            confirm: 'DifferentPassword3!',
            userId: '123',
        });
        expect(got.error).toBe('New passwords do not match');
    });
});
