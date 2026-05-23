// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Button } from '@/components/ui/button';
import { LinkIcon } from 'lucide-react';
import LoginLayout from './LoginLayout';

export default function IdpLinkingFailed() {
  const authRequestId = sessionStorage.getItem('pending_auth_request') ?? '';

  return (
    <LoginLayout title="Account linking failed">
      <div className="space-y-4 text-center">
        <LinkIcon className="h-12 w-12 text-destructive mx-auto" />
        <p className="text-sm text-muted-foreground">Failed to link the identity provider to your account. Please try again or contact your administrator.</p>
        <Button className="w-full" onClick={() => { window.location.href = `/login/loginname?authRequest=${authRequestId}`; }}>Back to sign in</Button>
      </div>
    </LoginLayout>
  );
}
