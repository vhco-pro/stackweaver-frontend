// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { createUser } from '@/api/auth-client';
import LoginLayout from './LoginLayout';
import { GradientButton } from '@/components/ui/gradient-button';
import { toFriendlyError } from '@/lib/auth-errors';

/**
 * Pre-filled registration form from IdP claims (manual creation path).
 */
export default function IdpCompleteRegistration() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const firstName = searchParams.get('firstName') ?? '';
  const lastName = searchParams.get('lastName') ?? '';
  const authRequestId = sessionStorage.getItem('pending_auth_request') ?? '';

  const [formEmail, setFormEmail] = useState(email);
  const [formFirst, setFormFirst] = useState(firstName);
  const [formLast, setFormLast] = useState(lastName);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail.trim() || !password) { setError('Email and password are required'); return; }
    setLoading(true);
    setError('');
    try {
      await createUser({
        profile: { givenName: formFirst.trim(), familyName: formLast.trim() },
        email: { email: formEmail.trim(), isVerified: false },
        password: { password, changeRequired: false },
      });
      void navigate(`/login/loginname?authRequest=${authRequestId}`);
    } catch (err: unknown) {
      setError(toFriendlyError(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginLayout title="Complete registration" subtitle="Fill in the remaining details to create your account">
      <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="idp-first">First name</Label>
            <Input id="idp-first" value={formFirst} onChange={(e) => { setFormFirst(e.target.value); }} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="idp-last">Last name</Label>
            <Input id="idp-last" value={formLast} onChange={(e) => { setFormLast(e.target.value); }} disabled={loading} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="idp-email">Email</Label>
          <Input id="idp-email" type="email" value={formEmail} onChange={(e) => { setFormEmail(e.target.value); }} disabled={loading} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="idp-pw">Password</Label>
          <Input id="idp-pw" type="password" autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); }} disabled={loading} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <GradientButton type="submit" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : 'Create account'}
        </GradientButton>
      </form>
    </LoginLayout>
  );
}
