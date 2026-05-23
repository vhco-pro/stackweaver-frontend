// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import LoginLayout from './LoginLayout';

export default function LoginError() {
  const error = useRouteError();

  let title = 'Something went wrong';
  let message = 'An unexpected error occurred during sign in. Please try again.';

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = 'Page not found';
      message = 'The login page you requested does not exist.';
    } else {
      title = `Error ${error.status}`;
      message = error.statusText || message;
    }
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <LoginLayout title={title}>
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button
          variant="outline"
          onClick={() => { window.location.href = '/login/loginname'; }}
        >
          Back to sign in
        </Button>
      </div>
    </LoginLayout>
  );
}
