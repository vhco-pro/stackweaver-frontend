// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { changeRequestsApi, type ChangeRequest } from '@/api/client';
import { Button } from '@/components/ui/button';
import { GradientButton } from '@/components/ui/gradient-button';
import { Page } from '@/components/layout/Page';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageEmptyState } from '@/components/layout/PageEmptyState';
import { ClipboardList, Check, Loader2, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * ChangeRequests is the organization-wide triage view: every open change request across the org,
 * grouped by workspace. TFE surfaces this through the Explorer, which Stackweaver does not implement,
 * so this page (and the endpoint behind it) is a Stackweaver addition. Filing happens from a
 * workspace's row menu on the Workspaces list.
 */
export default function ChangeRequests() {
  const { orgName } = useParams<{ orgName: string }>();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading, isError } = useQuery({
    queryKey: ['changeRequests', 'org', orgName],
    queryFn: () => changeRequestsApi.listByOrg(orgName ?? ''),
    enabled: !!orgName,
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => changeRequestsApi.archive(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['changeRequests'] });
      toast.success('Change request archived');
    },
    onError: (e: unknown) => { toast.error(e instanceof Error ? e.message : 'Failed to archive change request'); },
  });

  // Group by workspace so an admin reads the backlog per workspace rather than as a flat stream.
  const byWorkspace = requests.reduce<Record<string, ChangeRequest[]>>((acc, cr) => {
    const key = cr.workspace_name || cr.workspace_id;
    (acc[key] ??= []).push(cr);
    return acc;
  }, {});
  const workspaceNames = Object.keys(byWorkspace).sort();

  // Defined once and handed to both the header and the empty-state card: the header does not
  // render it while there is nothing to list, so the action never appears twice.
  const fileRequestAction = (
    <GradientButton asChild ramp="app" className="w-auto px-4 py-2">
      <Link to={orgName ? `/app/${orgName}/workspaces` : '/workspaces'}>
        <ClipboardList className="h-4 w-4 mr-2" />
        File a request
      </Link>
    </GradientButton>
  );
  const listState = isLoading ? 'loading' : isError ? 'error' : requests.length === 0 ? 'empty' : 'ready';

  return (
    <Page ramp="changeRequests" className="space-y-8">
      <PageHeader
        icon={ClipboardList}
        title="Change Requests"
        subtitle="Open action items filed against workspaces in this organization"
        backTo={{ to: orgName ? `/app/${orgName}/settings` : '/settings', label: 'Back to Settings' }}
        stats={
          !isLoading && requests.length > 0 && (
            <>
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">{requests.length}</span> open
              </span>
              <span className="text-muted-foreground">
                across <span className="font-medium text-foreground">{workspaceNames.length}</span>{' '}
                workspace{workspaceNames.length === 1 ? '' : 's'}
              </span>
            </>
          )
        }
        action={fileRequestAction}
        listState={listState}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {requests.length === 0 ? (
            <PageEmptyState
              icon={ClipboardList}
              title="No open change requests"
              description="File one from a workspace's actions menu on the Workspaces list."
              action={isError ? undefined : fileRequestAction}
            />
          ) : (
            workspaceNames.map(name => (
              <div key={name} className="space-y-3">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <Link
                    to={`/app/${orgName}/workspaces/${name}?tab=change-requests`}
                    className="font-medium hover:text-primary transition-colors"
                  >
                    {name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {byWorkspace[name].length} open
                  </span>
                </div>
                <div className="space-y-3">
                  {byWorkspace[name].map(cr => (
                    <div
                      key={cr.id}
                      className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/5 dark:bg-black/10 p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{cr.subject}</span>
                        {cr.message && (
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                            {cr.message}
                          </p>
                        )}
                        <div className="text-xs text-muted-foreground mt-2">Filed {formatDate(cr.created_at)}</div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 shrink-0"
                        disabled={archiveMutation.isPending && archiveMutation.variables === cr.id}
                        onClick={() => { archiveMutation.mutate(cr.id); }}
                        aria-label={`Archive change request: ${cr.subject}`}
                      >
                        {archiveMutation.isPending && archiveMutation.variables === cr.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Check className="h-4 w-4" />}
                        Archive
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Page>
  );
}
