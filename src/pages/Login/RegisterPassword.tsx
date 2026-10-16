// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { changePassword } from '@/api/auth-client';
import LoginLayout from './LoginLayout';
import { GradientButton } from '@/components/ui/gradient-button';
import { toFriendlyError } from '@/lib/auth-errors';

/**
 * Set a first password, for a user who has no way to sign in yet. Reached
 * from /login/authenticator/set, which Verify sends such a user to after
 * their email verification. The request carries no current password and no
 * code: the auth proxy accepts it only for a user with no authentication
 * method, on the proof of the email verification this browser completed in
 * the last few minutes, and refuses it otherwise.
 */
export default function RegisterPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId') ?? '';
  const authRequestId = searchParams.get('authRequest') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (!password) { setError('Password is required'); return; }

    setLoading(true);
    setError('');
    try {
      await changePassword(userId, { newPassword: { password, changeRequired: false } });
      void navigate(`/login/loginname?authRequest=${authRequestId}`);
    } catch (err: unknown) {
      // The proxy refuses a set without proof with its "code is invalid"
      // answer; here that means the verification is missing or has expired.
      if (err instanceof Error && err.message.includes('Code is invalid')) {
        setError('Your email verification has expired. Verify your email again to set a password.');
      } else {
        setError(toFriendlyError(err, 'Failed to set password'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginLayout title="Set password" subtitle="Create a password for your account">
      <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-pw">Password</Label>
          <Input id="new-pw" type="password" autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); }} disabled={loading} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-pw">Confirm password</Label>
          <Input id="confirm-pw" type="password" autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); }} disabled={loading} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <GradientButton type="submit" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting password...</> : 'Set password'}
        </GradientButton>
      </form>
    </LoginLayout>
  );
}
