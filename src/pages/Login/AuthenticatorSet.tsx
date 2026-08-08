// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { KeyRound, Lock } from 'lucide-react';
import LoginLayout from './LoginLayout';

/**
 * Choose primary authenticator when user has none - entry point for first-time setup.
 */
export default function AuthenticatorSet() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = searchParams.toString();

  return (
    <LoginLayout title="Set up authentication" subtitle="Choose how you want to sign in">
      <div className="space-y-2">
        <Button variant="outline" className="w-full justify-start gap-3" onClick={() => { void navigate(`/login/register/password?${params}`); }}>
          <Lock className="h-5 w-5 text-muted-foreground" />
          Password
        </Button>
        <Button variant="outline" className="w-full justify-start gap-3" onClick={() => { void navigate(`/login/passkey/set?${params}`); }}>
          <KeyRound className="h-5 w-5 text-muted-foreground" />
          Passkey
        </Button>
      </div>
    </LoginLayout>
  );
}
