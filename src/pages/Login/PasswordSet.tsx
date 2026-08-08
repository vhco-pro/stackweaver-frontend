// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { changePassword } from '@/api/auth-client';
import { useMountEffect } from '@/hooks/useMountEffect';
import LoginLayout from './LoginLayout';
import { GradientButton } from './GradientButton';
import { toFriendlyError } from '@/lib/auth-errors';

/**
 * Set new password - handles BOTH invitation and reset-completion.
 * `initial=true` flag distinguishes invitation from reset (matches official UI).
 *
 * Round 24 Finding 3 (HIGH): the password-reset code arrives in the
 * URL via `?code=…&userId=…&authRequest=…`. The code is sensitive (it
 * grants password-change ability for the user) so we strip the params
 * from the address bar on mount via `history.replaceState` - same
 * pattern IdpProcess.tsx uses for IdP intent tokens. Without this:
 *   (a) the URL lands in `window.history` (shoulder-surf risk via
 *       browser history)
 *   (b) `Referer` header sends the URL to any same-origin asset/link
 *       the page subsequently loads
 *   (c) any front-end error tracker (Sentry-style) capturing URLs
 *       sees the code
 * The values are captured into refs BEFORE the strip so `handleSubmit`
 * still has them.
 */
export default function PasswordSet() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Capture-then-strip: read the params from the URL exactly once via lazy
  // useState initialisers, then clear them from the address bar. The values
  // never change after mount (no setter), so they stay stable across
  // re-renders and are safe to read during render - we never re-read from
  // `searchParams`.
  const [userId] = useState(() => searchParams.get('userId') ?? '');
  const [code] = useState(() => searchParams.get('code') ?? '');
  const [authRequestId] = useState(() => searchParams.get('authRequest') ?? '');
  const [isInitial] = useState(() => searchParams.get('initial') === 'true');

  useMountEffect(() => {
    if (code || userId) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  });

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
      await changePassword(userId, {
        newPassword: { password, changeRequired: false },
        verificationCode: code || undefined,
      });
      void navigate(`/login/loginname?authRequest=${authRequestId}`);
    } catch (err: unknown) {
      setError(toFriendlyError(err, 'Failed to set password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginLayout title={isInitial ? 'Set your password' : 'Reset password'} subtitle={isInitial ? 'Create a password to complete setup' : 'Enter your new password'}>
      <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pw-new">New password</Label>
          <Input id="pw-new" type="password" autoComplete="new-password" autoFocus value={password} onChange={(e) => { setPassword(e.target.value); }} disabled={loading} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pw-confirm">Confirm password</Label>
          <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); }} disabled={loading} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <GradientButton type="submit" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save password'}
        </GradientButton>
      </form>
    </LoginLayout>
  );
}
