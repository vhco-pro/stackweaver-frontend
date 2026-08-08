// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useNavigate, useSearchParams } from 'react-router-dom';
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

  const methods = [
    { label: 'Authenticator app (TOTP)', icon: Smartphone, path: `/login/otp/totp/set?${params}` },
    { label: 'Email verification', icon: Mail, path: `/login/otp/email/set?${params}` },
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
