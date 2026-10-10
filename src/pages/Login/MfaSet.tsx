// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getLoginSettings } from '@/api/auth-client';
import { Button } from '@/components/ui/button';
import { Smartphone, Mail, Shield, KeyRound } from 'lucide-react';
import LoginLayout from './LoginLayout';

/**
 * MFA enrollment orchestrator - shown when policy requires MFA and user has none.
 * Honors mfaInitSkipLifetime (users can defer MFA setup for a window).
 */
export default function MfaSet() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId') ?? '';
  const authRequestId = searchParams.get('authRequest') ?? '';
  const sessionId = searchParams.get('sessionId') ?? '';
  const force = searchParams.get('force') === 'true';
  const params = `authRequest=${authRequestId}&sessionId=${sessionId}&userId=${userId}`;

  // Email codes are offered only when the login policy allows them, which zitadel-init does only
  // when mail can be delivered (#829). The other methods need no mail. Fails closed: until the
  // policy has loaded, email codes are not offered.
  const { data: loginSettings } = useQuery({
    queryKey: ['login-settings', 'mfa-set'],
    queryFn: () => getLoginSettings(),
    gcTime: 0,
  });
  const emailCodesAllowed = loginSettings?.secondFactors?.includes('SECOND_FACTOR_TYPE_OTP_EMAIL') === true;

  const methods = [
    { label: 'Authenticator app (TOTP)', icon: Smartphone, path: `/login/otp/totp/set?${params}` },
    ...(emailCodesAllowed ? [{ label: 'Email verification', icon: Mail, path: `/login/otp/email/set?${params}` }] : []),
    { label: 'Security key (U2F)', icon: Shield, path: `/login/u2f/set?${params}` },
    { label: 'Passkey', icon: KeyRound, path: `/login/passkey/set?${params}` },
  ];

  return (
    <LoginLayout
      title={force ? 'Set up two-factor authentication' : 'Add extra security'}
      subtitle={force ? 'Your organization requires two-factor authentication' : 'Choose a method to protect your account'}
    >
      <div className="space-y-2">
        {methods.map((m) => (
          <Button key={m.label} variant="outline" className="w-full justify-start gap-3" onClick={() => { void navigate(m.path); }}>
            <m.icon className="h-5 w-5 text-muted-foreground" />
            {m.label}
          </Button>
        ))}
      </div>
    </LoginLayout>
  );
}
