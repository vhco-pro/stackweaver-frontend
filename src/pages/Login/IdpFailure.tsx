// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import LoginLayout from './LoginLayout';

export default function IdpFailure() {
  const [searchParams] = useSearchParams();
  const errorMsg = searchParams.get('error') ?? 'An error occurred during identity provider login';
  const authRequestId = sessionStorage.getItem('pending_auth_request') ?? '';

  return (
    <LoginLayout title="Login failed">
      <div className="space-y-4 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <p className="text-sm text-muted-foreground">{errorMsg}</p>
        <Button className="w-full" onClick={() => { window.location.href = `/login/loginname?authRequest=${authRequestId}`; }}>Try again</Button>
      </div>
    </LoginLayout>
  );
}
