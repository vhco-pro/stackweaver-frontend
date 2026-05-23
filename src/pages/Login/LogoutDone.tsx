// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Button } from '@/components/ui/button';
import LoginLayout from './LoginLayout';

export default function LogoutDone() {
  return (
    <LoginLayout title="Signed out" subtitle="You have been signed out successfully">
      <div className="text-center">
        <Button className="w-full" onClick={() => { window.location.href = '/login/loginname'; }}>
          Sign in again
        </Button>
      </div>
    </LoginLayout>
  );
}
