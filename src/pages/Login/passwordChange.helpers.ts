// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pure helpers for the F19 PasswordChange page - extracted from
// PasswordChange.tsx so vitest can pin the validation rules without
// a React/DOM environment (matches the project pattern; see
// branding.ts ↔ branding.test.ts).

export interface PasswordChangeValidation {
    ok: boolean;
    error?: string;
}

export interface PasswordChangeInput {
    currentPassword: string;
    newPassword: string;
    confirm: string;
    userId: string;
}

/**
 * Validate the form input shape before the submit call. Order is
 * load-bearing - a user filling nothing must see "Current password
 * is required" first, not "Missing user context", because the
 * user-context error implies a deeper bug (the page was reached
 * without the SPA threading sessionId/userId through the URL) and
 * the page should hint at the obvious form-level miss first.
 */
export function validatePasswordChangeInput(input: PasswordChangeInput): PasswordChangeValidation {
    if (!input.currentPassword) return { ok: false, error: 'Current password is required' };
    if (!input.newPassword) return { ok: false, error: 'New password is required' };
    if (input.newPassword !== input.confirm) return { ok: false, error: 'New passwords do not match' };
    if (input.newPassword === input.currentPassword) {
        return { ok: false, error: 'New password must differ from the current password' };
    }
    if (!input.userId) return { ok: false, error: 'Missing user context - please sign in again' };
    return { ok: true };
}
