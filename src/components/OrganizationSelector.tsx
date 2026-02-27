// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useContext } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Building2, Check, ChevronDown, Settings } from 'lucide-react';
import { OrganizationContext } from '@/contexts/OrganizationContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface OrganizationSelectorProps {
  className?: string;
}

export function OrganizationSelector({ className }: OrganizationSelectorProps) {
  const location = useLocation();
  
  // Safely check if context is available (handles hot reload and initial render)
  const context = useContext(OrganizationContext);
  
  // Check if we're on a route that requires organization context
  const isOrgScopedRoute = location.pathname.startsWith('/app/');
  const isDashboardRoute = location.pathname === '/dashboard';
  const isOrganizationsRoute = location.pathname === '/organizations' || location.pathname.startsWith('/organizations/');

  // If context is not available (provider not mounted yet), return null
  if (context === undefined) {
    return null;
  }
  
  // Show selector on dashboard and org-scoped routes
  // Also show on organizations page for quick access
  if (!isOrgScopedRoute && !isDashboardRoute && !isOrganizationsRoute) {
    return null;
  }

  const { currentOrg, organizations, loading, switchOrganization } = context;

  const handleOrgSelect = (orgName: string) => {
    switchOrganization(orgName);
  };

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <Link to="/organizations">
        <Button variant="outline" size="sm" className={cn("gap-2", className)}>
          <Building2 className="h-4 w-4" />
          <span>Create Organization</span>
        </Button>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-2 min-w-[200px] justify-between",
            isOrgScopedRoute && currentOrg && "border-primary/50 bg-primary/5",
            className
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">
              {currentOrg?.name || 'Choose an organization'}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((org) => {
          const isSelected = currentOrg?.name === org.name;
          return (
            <DropdownMenuItem
              key={org.id}
              onClick={() => handleOrgSelect(org.name)}
              className={cn(
                "flex items-center justify-between cursor-pointer",
                isSelected && "bg-accent"
              )}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="truncate">{org.name}</span>
              </div>
              {isSelected && (
                <Check className="h-4 w-4 flex-shrink-0 text-primary" />
              )}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            to="/organizations"
            className="flex items-center gap-2 cursor-pointer"
          >
            <Settings className="h-4 w-4" />
            <span>Manage Organizations</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

