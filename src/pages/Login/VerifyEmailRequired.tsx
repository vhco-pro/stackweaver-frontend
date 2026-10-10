// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useSearchParams } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LoginLayout from './LoginLayout';

/**
 * Shown instead of the app when the signed-in account's email is not verified (#829 D5). The
 * API refuses such an account, so there is nothing to show until the address is confirmed with
 * the code from the verification email.
 */
export default function VerifyEmailRequired() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') ?? '';

  return (
    <LoginLayout title="Verify your email" subtitle="Confirm your email address to start using Stackweaver">
      <div className="space-y-6 text-center">
        <MailCheck className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          {email
            ? <>We sent a verification code to <span className="font-medium text-foreground">{email}</span> when you signed up.</>
            : <>We sent a verification code to your email address when you signed up.</>}
          {' '}Sign in again and enter that code when you are asked for it.
        </p>
        <Button className="w-full" onClick={() => { window.location.href = '/login/loginname'; }}>
          Sign in again
        </Button>
      </div>
    </LoginLayout>
  );
}
