// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect, type ReactNode, useState } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, AlertTriangle, RefreshCw, LogOut, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OrganizationGuardProps {
  children: ReactNode;
}

/**
 * Guard component that ensures the organization exists and user has access.
 * Shows an error page if org is not found or user doesn't have access.
 * 
 * Note: Must be rendered inside OrganizationProvider (which is in AppContent)
 */
export function OrganizationGuard({ children }: OrganizationGuardProps) {
  const { orgName } = useParams<{ orgName: string }>();
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  // Hooks must be called unconditionally - this component MUST be inside OrganizationProvider
  const { organizations, loading, hasAccess, refreshOrganizations } = useOrganization();
  const [retrying, setRetrying] = useState(false);
  const [showError, setShowError] = useState(false);

  // Show error after a brief delay to prevent flash on redirect
  useEffect(() => {
    if (!loading && orgName && !hasAccess(orgName)) {
      const timer = setTimeout(() => setShowError(true), 100);
      return () => clearTimeout(timer);
    }
  }, [loading, orgName, hasAccess]);

  // Reset error when access is restored
  useEffect(() => {
    if (showError && orgName && hasAccess(orgName)) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setShowError(false);
      }, 0);
    }
  }, [showError, orgName, hasAccess]);

  const handleRetry = async () => {
    setRetrying(true);
    await refreshOrganizations();
    setRetrying(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading organization...</p>
        </div>
      </div>
    );
  }

  if (!orgName) {
    return <Navigate to="/organizations" replace />;
  }

  if (!hasAccess(orgName) && showError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-amber-500/10 p-4">
              <AlertTriangle className="h-12 w-12 text-amber-500" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Organization Not Found</h1>
            <p className="text-muted-foreground">
              You don't have access to the organization <strong>"{orgName}"</strong>, 
              or it may not exist.
            </p>
          </div>

          {session && (
            <p className="text-sm text-muted-foreground">
              Signed in as: <span className="font-medium">{session.user.email}</span>
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              variant="outline" 
              onClick={() => { void handleRetry(); }}
              disabled={retrying}
            >
              {retrying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Retry
            </Button>
            
            <Button 
              variant="default"
              onClick={() => { 
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                navigate('/organizations'); 
              }}
            >
              <Building2 className="h-4 w-4 mr-2" />
              View Organizations
            </Button>
          </div>

          <div className="pt-4 border-t">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => { void logout(); }}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out and try another account
            </Button>
          </div>

          {organizations.length > 0 && (
            <div className="pt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Your organizations:
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {organizations.map((org) => (
                  <Button
                    key={org.id}
                    variant="outline"
                    size="sm"
                    onClick={() => { 
                      // eslint-disable-next-line @typescript-eslint/no-floating-promises
                      navigate(`/app/${org.name}/workspaces`); 
                    }}
                  >
                    {org.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // If we don't have access but not showing error yet, show loading
  if (!hasAccess(orgName)) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

