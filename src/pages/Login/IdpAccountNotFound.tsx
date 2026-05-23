// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UserX } from 'lucide-react';
import LoginLayout from './LoginLayout';

export default function IdpAccountNotFound() {
  const navigate = useNavigate();
  const authRequestId = sessionStorage.getItem('pending_auth_request') ?? '';

  return (
    <LoginLayout title="Account not found">
      <div className="space-y-4 text-center">
        <UserX className="h-12 w-12 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">No account is linked to this identity provider. Contact your administrator or register a new account.</p>
        <Button variant="outline" className="w-full" onClick={() => { void navigate(`/login/register?authRequest=${authRequestId}`); }}>Register</Button>
        <Button variant="link" className="w-full text-muted-foreground" onClick={() => { void navigate(`/login/loginname?authRequest=${authRequestId}`); }}>Back to sign in</Button>
      </div>
    </LoginLayout>
  );
}
