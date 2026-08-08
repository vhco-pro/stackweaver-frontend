// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { changePassword, finalizeAuthRequest } from '@/api/auth-client';
import LoginLayout from './LoginLayout';
import { GradientButton } from './GradientButton';
import { validatePasswordChangeInput } from './passwordChange.helpers';
import { toFriendlyError } from '@/lib/auth-errors';

/**
 * F19 - Password change required.
 *
 * Reached when the user has just authenticated (loginname + password)
 * but Zitadel won't issue tokens until they rotate their password.
 * Triggers in three scenarios:
 *   - Org policy has `passwordChangeRequired: true` for this user
 *   - Admin-initiated reset (passwordChangeRequired set on the user)
 *   - Password age exceeds `passwordExpirySettings.maxAgeDays`
 *
 * Detection happens in `Password.tsx::checkForcedFlows` after the
 * password PATCH succeeds - we GET the user record (own self-read,
 * gated by Round 17 cross-user check on /auth/users/:id) and read
 * `human.passwordChangeRequired`. If true, redirect here with the
 * session context.
 *
 * Form asks for current + new + confirm. Re-asking for current is
 * intentional: matches Zitadel's hosted login UI UX, defends against
 * shoulder-surfing in the post-login window, and the proxy's
 * ChangePassword endpoint requires either currentPassword or a
 * verificationCode (the latter is for the password-reset flow only).
 *
 * On success, re-finalize the auth request with the still-valid
 * session - the password change does NOT invalidate the session's
 * password factor, so the existing sessionId/sessionToken can
 * proceed to issue tokens.
 *
 * Per docs/internal/plans/features/custom-login-ui-plan.md:
 *   F19: `/login/password/change` page (parity gap surfaced by the
 *   2026-04-30 audit vs the upstream Zitadel hosted login UI)
 */
export default function PasswordChange() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const userId = searchParams.get('userId') ?? '';
    const sessionId = searchParams.get('sessionId') ?? '';
    const sessionToken = searchParams.get('sessionToken') ?? undefined;
    const authRequestId = searchParams.get('authRequest') ?? '';

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validation = validatePasswordChangeInput({ currentPassword, newPassword, confirm, userId });
        if (!validation.ok) { setError(validation.error ?? 'Invalid input'); return; }

        setLoading(true);
        setError('');
        try {
            // Round 23 Finding 2 made the proxy canonicalize unknown-
            // user 4xx into "Code is invalid". Behavior on a real user
            // with wrong currentPassword is the same shape - Zitadel
            // returns the same status, distinguishable only by what
            // we know on the client (the user IS valid here, since
            // we just authenticated them). So a 4xx on this submit
            // means: wrong current password.
            await changePassword(userId, {
                currentPassword,
                newPassword: { password: newPassword, changeRequired: false },
            });

            // Password change does not invalidate the session's
            // password factor - re-finalize with the same session
            // and redirect to wherever the OIDC RP wanted us.
            if (authRequestId && sessionId) {
                const finalize = await finalizeAuthRequest({
                    authRequestId,
                    sessionId,
                    sessionToken,
                });
                window.location.href = finalize.callbackUrl;
                return;
            }
            // No authRequest context (direct nav to the page, e.g. via
            // a deep link) - fall back to the loginname page so the
            // user can re-enter the auth flow with their new password.
            void navigate('/login/loginname');
        } catch (err: unknown) {
            const message = toFriendlyError(err, 'Failed to change password');
            // Zitadel surfaces "password is invalid" on a wrong
            // currentPassword - friendly-map for the user.
            if (/password.*invalid|invalid.*password/i.test(message)) {
                setError('Current password is incorrect');
            } else {
                setError(message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <LoginLayout
            title="Change your password"
            subtitle="Your administrator requires a password change before you continue"
        >
            <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="pw-current">Current password</Label>
                    <Input
                        id="pw-current"
                        type="password"
                        autoComplete="current-password"
                        autoFocus
                        value={currentPassword}
                        onChange={(e) => { setCurrentPassword(e.target.value); }}
                        disabled={loading}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="pw-new">New password</Label>
                    <Input
                        id="pw-new"
                        type="password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); }}
                        disabled={loading}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="pw-confirm">Confirm new password</Label>
                    <Input
                        id="pw-confirm"
                        type="password"
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => { setConfirm(e.target.value); }}
                        disabled={loading}
                    />
                </div>
                {error && <p className="text-sm text-destructive" data-testid="pw-change-error">{error}</p>}
                <GradientButton type="submit" disabled={loading}>
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Change password'}
                </GradientButton>
            </form>
        </LoginLayout>
    );
}

// Pure validator + types live in `passwordChange.helpers.ts` so
// vitest can pin them without a React/DOM env. Imported above.
