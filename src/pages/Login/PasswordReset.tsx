// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { createSession, getSession, requestPasswordReset } from '@/api/auth-client';
import LoginLayout from './LoginLayout';
import ReturnCodePanel from './ReturnCodePanel';
import { GradientButton } from '@/components/ui/gradient-button';

export default function PasswordReset() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authRequestId = searchParams.get('authRequest') ?? '';

  const [loginName, setLoginName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [userId, setUserId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName.trim()) { setError('Please enter your email'); return; }
    setLoading(true);
    setError('');
    try {
      // Step 1: Create a session with user check to resolve loginName → userId
      // Zitadel's password_reset endpoint requires a userId (UUID), not a loginName.
      const sessionResp = await createSession({
        checks: { user: { loginName: loginName.trim() } },
      });

      // Resolve the user id from the freshly-created session. The proxy's
      // CreateSession response only carries `sessionId`/`sessionToken`; the
      // user check is reflected on the session detail, so we GET it back.
      const sessionData = await getSession(sessionResp.sessionId) as {
        session?: { factors?: { user?: { id?: string } } }
      };
      const resolvedUserId = sessionData?.session?.factors?.user?.id ?? '';

      if (!resolvedUserId) {
        setError('Could not find user. Please check your email and try again.');
        return;
      }

      setUserId(resolvedUserId);

      // Step 2: Request password reset with the resolved userId
      const resetResult = await requestPasswordReset(resolvedUserId) as {
        verificationCode?: string;
      };

      // In return_code mode, Zitadel returns the code in the response
      if (resetResult.verificationCode) {
        setResetCode(resetResult.verificationCode);
      }

      setSent(true);
    } catch {
      // Don't reveal whether the user exists (anti-enumeration)
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <LoginLayout title="Reset your password" subtitle="Follow the instructions to set a new password">
        <div className="space-y-4">
          {resetCode ? (
            <ReturnCodePanel code={resetCode} label="reset code" />
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              If an account exists for that email, a reset code has been sent.
            </p>
          )}
          {userId && (
            <Button
              className="w-full"
              onClick={() => {
                const params = new URLSearchParams({ authRequest: authRequestId, userId });
                if (resetCode) params.set('code', resetCode);
                void navigate(`/login/password/set?${params.toString()}`);
              }}
            >
              Set new password
            </Button>
          )}
          <Button variant="outline" className="w-full" onClick={() => { void navigate(`/login/loginname?authRequest=${authRequestId}`); }}>
            Back to sign in
          </Button>
        </div>
      </LoginLayout>
    );
  }

  return (
    <LoginLayout title="Reset password" subtitle="Enter your username or email to receive a reset code">
      <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reset-email">Username or email</Label>
          <Input id="reset-email" type="text" autoComplete="username" autoFocus value={loginName} onChange={(e) => { setLoginName(e.target.value); }} placeholder="user@example.com" disabled={loading} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <GradientButton type="submit" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : 'Send reset code'}
        </GradientButton>
        <Button variant="link" className="w-full text-muted-foreground" onClick={() => { void navigate(`/login/loginname?authRequest=${authRequestId}`); }}>
          Back to sign in
        </Button>
      </form>
    </LoginLayout>
  );
}
