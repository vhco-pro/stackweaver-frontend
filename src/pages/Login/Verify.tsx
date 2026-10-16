// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { config } from '@/config';
import { useCodePaste } from '@/hooks/useCodePaste';
import { finalizeAuthRequest } from '@/api/auth-client';
import LoginLayout from './LoginLayout';
import ReturnCodePanel from './ReturnCodePanel';
import { GradientButton } from '@/components/ui/gradient-button';
import { toFriendlyError } from '@/lib/auth-errors';

const AUTH_BASE = config.apiUrl.replace(/\/api\/v2\/?$/, '/auth');

/**
 * Verify email code OR accept invitation (dual-purpose via `invite=true`).
 *
 * Three entry-modes drive what happens after a successful verify:
 *
 *   1. Registration (default) - POST /auth/users/{id}/email with the
 *      code, then navigate to /login/verify/success (one-shot page
 *      with a "Continue to sign in" CTA back to /login/loginname).
 *
 *   2. Invitation (`invite=true`) - the code is an invite code, checked
 *      at POST /auth/users/{id}/invite-code/verify (which also marks the
 *      email verified), and the copy says "Accept invitation" rather than
 *      "Verify email". Post-verify navigation is identical.
 *
 *   3. Forced verification mid-login (`forced=true`, AC-53 D7 row,
 *      Wave 14) - the user is mid auth-request (sessionId + auth-
 *      RequestId in query string). They have already entered their
 *      password but Zitadel won't issue tokens until their email is
 *      verified. After the verify succeeds, re-finalize the
 *      auth-request with the same session and follow Zitadel's
 *      callback URL instead of bouncing back to /login/loginname,
 *      which would force a re-password and re-trigger the same
 *      forced-flow check (infinite loop).
 *
 * When the verified user has no authentication method yet, the auth
 * proxy answers with `authenticatorSetupRequired` and the user goes on to
 * /login/authenticator/set to choose one.
 */
export default function Verify() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authRequestId = searchParams.get('authRequest') ?? '';
  const sessionId = searchParams.get('sessionId') ?? '';
  const sessionToken = searchParams.get('sessionToken') ?? undefined;
  const userId = searchParams.get('userId') ?? '';
  const isInvite = searchParams.get('invite') === 'true';
  const isForced = searchParams.get('forced') === 'true';
  const prefillCode = searchParams.get('code') ?? '';

  const [code, setCode] = useState(prefillCode);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const submitCode = async (raw: string) => {
    const codeValue = raw.trim();
    if (!codeValue) { setError('Please enter the verification code'); return; }
    if (!userId) { setError('Missing user information - please start over'); return; }
    if (submittingRef.current) return;
    submittingRef.current = true;

    setLoading(true);
    setError('');
    try {
      // An invite code is checked at its own endpoint: the email one does not accept it.
      const endpoint = isInvite ? 'invite-code/verify' : 'email';
      const response = await fetch(`${AUTH_BASE}/users/${userId}/${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationCode: codeValue }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(errData.message ?? 'Verification failed');
      }
      const verified = await response.json().catch(() => ({})) as { authenticatorSetupRequired?: boolean };

      // Mid-login forced-flow: re-finalize the auth request with the
      // session we were already in. Zitadel now issues tokens because
      // the email is verified.
      if (isForced && authRequestId && sessionId) {
        const finalize = await finalizeAuthRequest({
          authRequestId,
          sessionId,
          sessionToken,
        });
        window.location.href = finalize.callbackUrl;
        return;
      }

      // A user with no way to sign in yet (an invited user, or one created
      // without a password) sets one up next. The auth proxy says so, and
      // has recorded this verification as the proof for the first password.
      if (verified.authenticatorSetupRequired) {
        const next = new URLSearchParams({ userId, authRequest: authRequestId });
        void navigate(`/login/authenticator/set?${next.toString()}`);
        return;
      }

      // Default (registration / invitation) - bounce through the
      // success page so the user can hit "Continue to sign in".
      void navigate(`/login/verify/success?authRequest=${authRequestId}`);
    } catch (err: unknown) {
      setError(toFriendlyError(err, 'Verification failed'));
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitCode(code);
  };

  const handlePaste = useCodePaste((pasted) => {
    setCode(pasted);
    void submitCode(pasted);
  });

  return (
    <LoginLayout title={isInvite ? 'Accept invitation' : 'Verify email'} subtitle="Enter the verification code">
      <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
        <ReturnCodePanel code={prefillCode} label="email verification code" />
        <div className="space-y-2">
          <Label htmlFor="verify-code">Code</Label>
          <Input id="verify-code" type="text" inputMode="numeric" maxLength={6} autoFocus value={code} onChange={(e) => { setCode(e.target.value); }} onPaste={handlePaste} placeholder="000000" disabled={loading} className="text-center text-2xl tracking-widest" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <GradientButton type="submit" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : 'Verify'}
        </GradientButton>
      </form>
    </LoginLayout>
  );
}
