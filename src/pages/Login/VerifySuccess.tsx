// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import LoginLayout from './LoginLayout';

export default function VerifySuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authRequestId = searchParams.get('authRequest') ?? '';

  return (
    <LoginLayout title="Email verified">
      <div className="space-y-4 text-center">
        <div className="flex justify-center"><CheckCircle className="h-16 w-16 text-green-500" /></div>
        <p className="text-sm text-muted-foreground">Your email has been verified. You can now sign in.</p>
        <Button className="w-full" onClick={() => { void navigate(`/login/loginname?authRequest=${authRequestId}`); }}>
          Continue to sign in
        </Button>
      </div>
    </LoginLayout>
  );
}
