// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Check, X } from 'lucide-react';
import { createUser, getPasswordComplexitySettings, getLegalSettings } from '@/api/auth-client';
import type { PasswordComplexitySettings } from '@/api/auth-client';
import { useMountEffect } from '@/hooks/useMountEffect';
import LoginLayout from './LoginLayout';
import { GradientButton } from './GradientButton';
import { toFriendlyError } from '@/lib/auth-errors';

interface LegalSettings {
  tosLink?: string;
  privacyPolicyLink?: string;
}

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authRequestId = searchParams.get('authRequest') ?? '';
  const organization = searchParams.get('organization') ?? '';
  // OIDC `prompt=create` reaches us via LoginName.tsx, which forwards
  // `login_hint` as `loginHint`. Pre-fill the email field per D2 row 4.
  const loginHint = searchParams.get('loginHint') ?? '';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(loginHint);
  const [password, setPassword] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [complexity, setComplexity] = useState<PasswordComplexitySettings | null>(null);
  const [legal, setLegal] = useState<LegalSettings | null>(null);

  // Fetch settings on mount
  useMountEffect(() => {
    let cancelled = false;
    const init = async () => {
      const [complexityResult, legalResult] = await Promise.allSettled([
        getPasswordComplexitySettings(),
        getLegalSettings() as Promise<LegalSettings>,
      ]);
      if (cancelled) return;
      if (complexityResult.status === 'fulfilled') setComplexity(complexityResult.value);
      if (legalResult.status === 'fulfilled') setLegal(legalResult.value);
    };
    void init();
    return () => { cancelled = true; };
  });

  // Client-side password complexity validation
  const complexityChecks = complexity ? [
    { label: `At least ${complexity.minLength ?? 8} characters`, met: password.length >= (complexity.minLength ?? 8) },
    ...(complexity.hasUppercase ? [{ label: 'Uppercase letter', met: /[A-Z]/.test(password) }] : []),
    ...(complexity.hasLowercase ? [{ label: 'Lowercase letter', met: /[a-z]/.test(password) }] : []),
    ...(complexity.hasNumber ? [{ label: 'Number', met: /\d/.test(password) }] : []),
    ...(complexity.hasSymbol ? [{ label: 'Symbol', met: /[^a-zA-Z0-9]/.test(password) }] : []),
  ] : [];
  const complexityMet = complexityChecks.length === 0 || complexityChecks.every(c => c.met);

  // ToS required if legal settings have a TOS link configured
  const tosRequired = !!legal?.tosLink;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Email and password are required'); return; }
    if (!complexityMet) { setError('Password does not meet complexity requirements'); return; }
    if (tosRequired && !tosAccepted) { setError('You must accept the terms of service'); return; }

    setLoading(true);
    setError('');

    try {
      const body: Record<string, unknown> = {
        profile: {
          givenName: firstName.trim() || undefined,
          familyName: lastName.trim() || undefined,
        },
        email: {
          email: email.trim(),
          isVerified: false,
        },
        password: {
          password,
          changeRequired: false,
        },
      };

      // Zitadel's `AddHumanUserRequest.organization` is a `oneof` over
       // `orgId` / `orgDomain`. The auth-proxy `/auth/oidc/authorize` handler
       // forwards three flavours of this signal - `organizationId` (parsed
       // from `urn:zitadel:iam:org:id:<id>` scope), `organizationDomain`
       // (parsed from `urn:zitadel:iam:org:domain:primary:<domain>`), and a
       // raw `organization` (the `?organization=<id>` query param). The raw
       // form treats the value as an org ID by convention (matches the
       // upstream Zitadel login UI).
      const organizationId = searchParams.get('organizationId') ?? organization;
      const organizationDomain = searchParams.get('organizationDomain') ?? '';
      if (organizationDomain) {
        body.organization = { orgDomain: organizationDomain };
      } else if (organizationId) {
        body.organization = { orgId: organizationId };
      }

      const result = await createUser(body) as { userId?: string; emailCode?: string };

      // If we got a verification code back (return_code mode), pass it to verify page
      const params = new URLSearchParams({ authRequest: authRequestId });
      if (result.userId) params.set('userId', result.userId);
      if (result.emailCode) params.set('code', result.emailCode);
      void navigate(`/login/verify?${params.toString()}`);
    } catch (err: unknown) {
      setError(toFriendlyError(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginLayout title="Create account" subtitle="Enter your details to get started">
      <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" value={firstName} onChange={(e) => { setFirstName(e.target.value); }} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" value={lastName} onChange={(e) => { setLastName(e.target.value); }} disabled={loading} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-email">Email</Label>
          <Input id="reg-email" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); }} placeholder="user@example.com" disabled={loading} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-password">Password</Label>
          <Input id="reg-password" type="password" autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); }} disabled={loading} />
          {password && complexityChecks.length > 0 && (
            <div className="space-y-1 pt-1">
              {complexityChecks.map((check) => (
                <div key={check.label} className="flex items-center gap-2 text-xs">
                  {check.met ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-muted-foreground" />}
                  <span className={check.met ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>{check.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {tosRequired && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={tosAccepted} onChange={(e) => { setTosAccepted(e.target.checked); }} className="mt-1" />
            <span className="text-muted-foreground">
              I agree to the{' '}
              {legal?.tosLink && <a href={legal.tosLink} target="_blank" rel="noopener noreferrer" className="underline">Terms of Service</a>}
              {legal?.tosLink && legal?.privacyPolicyLink && ' and '}
              {legal?.privacyPolicyLink && <a href={legal.privacyPolicyLink} target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</a>}
            </span>
          </label>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <GradientButton type="submit" disabled={loading || (tosRequired && !tosAccepted)}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</> : 'Create account'}
        </GradientButton>

        <Button variant="link" className="w-full text-muted-foreground" onClick={() => { void navigate(`/login/loginname?authRequest=${authRequestId}`); }}>
          Already have an account? Sign in
        </Button>
      </form>
    </LoginLayout>
  );
}
