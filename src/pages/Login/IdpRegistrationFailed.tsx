// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Button } from '@/components/ui/button';
import { UserX } from 'lucide-react';
import LoginLayout from './LoginLayout';

export default function IdpRegistrationFailed() {
  const authRequestId = sessionStorage.getItem('pending_auth_request') ?? '';

  return (
    <LoginLayout title="Registration failed">
      <div className="space-y-4 text-center">
        <UserX className="h-12 w-12 text-destructive mx-auto" />
        <p className="text-sm text-muted-foreground">Failed to create your account via the identity provider. Please try again or register manually.</p>
        <Button variant="outline" className="w-full" onClick={() => { window.location.href = `/login/register?authRequest=${authRequestId}`; }}>Register manually</Button>
        <Button variant="link" className="w-full text-muted-foreground" onClick={() => { window.location.href = `/login/loginname?authRequest=${authRequestId}`; }}>Back to sign in</Button>
      </div>
    </LoginLayout>
  );
}
