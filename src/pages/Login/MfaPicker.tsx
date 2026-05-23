// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { KeyRound, Smartphone, Mail, Shield } from 'lucide-react';
import LoginLayout from './LoginLayout';

export default function MfaPicker() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authRequestId = searchParams.get('authRequest') ?? '';
  const sessionId = searchParams.get('sessionId') ?? '';
  const params = `authRequest=${authRequestId}&sessionId=${sessionId}`;

  const factors = [
    { label: 'Authenticator app', icon: Smartphone, path: `/login/otp/totp?${params}` },
    { label: 'Email code', icon: Mail, path: `/login/otp/email?${params}` },
    { label: 'Security key', icon: Shield, path: `/login/u2f?${params}` },
    { label: 'Passkey', icon: KeyRound, path: `/login/passkey?${params}` },
  ];

  return (
    <LoginLayout title="Choose verification method" subtitle="Select how you want to verify your identity">
      <div className="space-y-2">
        {factors.map((f) => (
          <Button key={f.label} variant="outline" className="w-full justify-start gap-3" onClick={() => { void navigate(f.path); }}>
            <f.icon className="h-5 w-5 text-muted-foreground" />
            {f.label}
          </Button>
        ))}
      </div>
    </LoginLayout>
  );
}
