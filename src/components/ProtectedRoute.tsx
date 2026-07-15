// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    // Remember where the user was headed so login returns them there instead of the dashboard.
    // Auth/Callback.tsx already reads this key (and applies the same-origin open-redirect guard);
    // until now only the Terraform CLI /oauth/authorize flow ever set it, so every other deep link
    // — a shared workspace URL, or the change_request_url in a notification webhook — was silently
    // dropped on login. Path only, never an absolute URL, so there is nothing external to honour.
    //
    // /auth/* is excluded: bouncing back to a login page after logging in would be a redirect loop.
    if (!location.pathname.startsWith('/auth/')) {
      sessionStorage.setItem('oauth_return_url', `${location.pathname}${location.search}${location.hash}`);
    }
    return <Navigate to="/auth/login" replace />;
  }

  return <>{children}</>;
}
