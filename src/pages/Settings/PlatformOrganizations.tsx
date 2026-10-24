// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Building2, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Page } from '@/components/layout/Page';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageEmptyState } from '@/components/layout/PageEmptyState';
import { PlatformNotFound } from '@/components/platform/PlatformNotFound';
import { isNotFound, retryUnlessNotFound } from '@/components/platform/notFound';
import { adminOrganizationsApi, organizationsApi } from '@/api/client';
import { glassDivider, glassSurface } from '@/lib/surfaces';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

function formatDate(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

// Settings -> Organizations: every organization on the installation, read-only. A platform
// administrator is not a member of an organization by being one, so a row links into the
// organization only when the viewer is a member; every other row says so and opens nothing.
// The link goes to the organization's workspaces, its landing page, as on the Organizations page.
export default function PlatformOrganizations() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading: loading, isError: loadFailed, error, refetch } = useQuery({
    queryKey: ['platform-organizations', currentPage, searchQuery],
    queryFn: () => adminOrganizationsApi.list({ search: searchQuery || undefined, page: currentPage, pageSize: PAGE_SIZE }),
    retry: retryUnlessNotFound,
  });
  const organizations = data?.data ?? [];
  const totalPages = data?.pagination?.['total-pages'] ?? 1;
  const totalCount = data?.pagination?.['total-count'] ?? 0;

  // The viewer's own organizations, under the key the organization picker already shares.
  const { data: memberOf = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => (await organizationsApi.list()).data || [],
    enabled: !!data,
  });
  const memberNames = new Set(memberOf.map((o) => o.name));

  const header = (
    <PageHeader
      icon={Building2}
      title="Organizations"
      subtitle={isNotFound(error) ? undefined : 'Every organization on this installation. Open one you are a member of from its row.'}
      backTo={{ to: '/settings', label: 'Back to Settings' }}
    />
  );

  // The admin route answers 404 to anyone who is not a platform administrator.
  if (isNotFound(error)) {
    return (
      <Page ramp="platform" className="space-y-8">
        {header}
        <PlatformNotFound />
      </Page>
    );
  }

  const filtered = searchQuery !== '';

  return (
    <Page ramp="platform" className="space-y-8">
      {header}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search organizations..."
          aria-label="Search organizations"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className={cn(glassSurface, 'p-2')} data-testid="organizations-skeleton">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-6 p-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      ) : loadFailed ? (
        <div className={cn(glassSurface, 'flex flex-col items-center gap-4 p-8 text-center')}>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Failed to load the organizations.'}
          </p>
          <Button variant="outline" onClick={() => { void refetch(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      ) : organizations.length === 0 ? (
        filtered ? (
          <PageEmptyState
            icon={Building2}
            title="No organizations"
            description="No organizations match your search."
            filtered
            onClearFilters={() => { setSearchQuery(''); setCurrentPage(1); }}
          />
        ) : (
          <PageEmptyState
            icon={Building2}
            title="No organizations"
            description="No organization has been created on this installation yet."
          />
        )
      ) : (
        <>
          <div className={cn(glassSurface, 'overflow-x-auto')}>
            <table className="w-full">
              <thead>
                <tr className={cn('border-b text-left text-sm text-muted-foreground', glassDivider)}>
                  <th scope="col" className="px-4 py-3 font-medium">Name</th>
                  <th scope="col" className="px-4 py-3 font-medium">Admin email</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">Members</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">Workspaces</th>
                  <th scope="col" className="px-4 py-3 font-medium">Created</th>
                  <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Access</span></th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => {
                  const isMember = memberNames.has(org.name);
                  return (
                    <tr key={org.name} className={cn('border-b last:border-0 text-sm', glassDivider)}>
                      <td className="px-4 py-3 font-medium">
                        {isMember ? (
                          <Link to={`/app/${encodeURIComponent(org.name)}/workspaces`} className="hover:underline underline-offset-2">
                            {org.name}
                          </Link>
                        ) : (
                          org.name
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{org.notification_email || 'Not set'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{org.member_count}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{org.workspace_count}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(org.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        {isMember ? (
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/app/${encodeURIComponent(org.name)}/workspaces`} aria-label={`Open ${org.name}`}>Open</Link>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not a member</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{totalCount} organization{totalCount !== 1 ? 's' : ''}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => { setCurrentPage((p) => p - 1); }}
                >
                  Previous
                </Button>
                <span className="flex items-center px-2">Page {currentPage} of {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => { setCurrentPage((p) => p + 1); }}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Page>
  );
}
