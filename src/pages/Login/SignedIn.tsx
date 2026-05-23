// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import LoginLayout from './LoginLayout';

/**
 * Fallback landing — shown when no redirect_uri and no auth request,
 * or when createCallback returns FailedPrecondition.
 */
export default function SignedIn() {
  return (
    <LoginLayout title="Signed in">
      <div className="space-y-4 text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
        <p className="text-sm text-muted-foreground">You are signed in. You can close this window or continue to the dashboard.</p>
        <Button className="w-full" onClick={() => { window.location.href = '/dashboard'; }}>
          Go to dashboard
        </Button>
      </div>
    </LoginLayout>
  );
}
