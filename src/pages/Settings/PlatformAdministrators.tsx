// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BookOpen, Loader2, MoreVertical, Plus, RefreshCw, ShieldCheck, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GradientButton } from '@/components/ui/gradient-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Pager } from '@/components/ui/pager';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Page, PageDialogContent } from '@/components/layout/Page';
import { PageHeader, type PageListState } from '@/components/layout/PageHeader';
import { PageEmptyState } from '@/components/layout/PageEmptyState';
import { PlatformNotFound } from '@/components/platform/PlatformNotFound';
import { isNotFound, retryUnlessNotFound } from '@/components/platform/notFound';
import { UserAvatar } from '@/components/UserAvatar';
import {
  adminUsersApi,
  platformSettingsApi,
  type AdminUser,
  type OrganizationCreationPolicy,
} from '@/api/client';
import { ACCOUNT_DETAILS_QUERY_KEY } from '@/hooks/usePlatformAdmin';
import { glassDivider, glassSurface } from '@/lib/surfaces';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PAGE_SIZE = 100;
const ADMINS_QUERY_KEY = ['platform-administrators'] as const;

const ORGANIZATION_CREATION_LABELS: Record<OrganizationCreationPolicy, string> = {
  everyone: 'Everyone: any signed-in user can create an organization',
  'platform-admins': 'Platform administrators only',
};

/** The badge on an administrator the deployment declares, which the UI cannot remove. */
function DeclaredBadge() {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="rounded-full bg-pink-500/10 px-2 py-0.5 text-xs font-medium text-pink-700 dark:text-pink-300"
          >
            Declared by the deployment
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">Managed by STACKWEAVER_PLATFORM_ADMINS</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** The read-only deployment settings: what the operator set, shown so an administrator knows. */
function DeploymentSettingsPanel() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: () => platformSettingsApi.get(),
  });

  return (
    <section aria-labelledby="deployment-settings-heading" className={cn(glassSurface, 'p-6 space-y-4')}>
      <div className="space-y-1">
        <h2 id="deployment-settings-heading" className="text-lg font-semibold">Deployment settings</h2>
        <p className="text-sm text-muted-foreground">
          Declared administrators are set in the deployment configuration.{' '}
          <Link
            to="/docs/user-guides/platform-administration"
            className="inline-flex items-center gap-1 text-pink-700 underline underline-offset-2 hover:text-pink-800 dark:text-pink-300 dark:hover:text-pink-200"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Platform administration guide
          </Link>
        </p>
      </div>
      <dl className="grid gap-1 sm:grid-cols-[14rem_1fr] sm:items-center">
        <dt className="text-sm font-medium">Organization creation</dt>
        <dd className="text-sm text-muted-foreground">
          {isLoading ? (
            <Skeleton className="h-4 w-64" data-testid="organization-creation-skeleton" />
          ) : isError || !data ? (
            <span className="inline-flex items-center gap-2">
              Could not load the deployment settings.
              <Button variant="outline" size="sm" onClick={() => { void refetch(); }}>
                Retry
              </Button>
            </span>
          ) : (
            <span data-testid="organization-creation-value">
              {ORGANIZATION_CREATION_LABELS[data.organization_creation]}
              <span className="ml-2 font-mono text-xs">({data.organization_creation})</span>
            </span>
          )}
        </dd>
      </dl>
    </section>
  );
}

// Settings -> Platform Administrators: the people who manage this installation. The list is
// `GET /admin/users?filter[admin]=true`; adding looks one account up by its exact email address
// and grants it, removing revokes a granted administrator. Administrators the deployment
// declares carry a badge and cannot be removed here.
export default function PlatformAdministrators() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  // What the lookup found out, shown in the dialog; it is reset whenever the address changes.
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  // The administrator the remove confirmation is about. It stays set while the dialog fades out.
  const [pendingRemove, setPendingRemove] = useState<AdminUser | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [...ADMINS_QUERY_KEY, page],
    queryFn: () => adminUsersApi.lookupAdmins({ page, pageSize: PAGE_SIZE }),
    retry: retryUnlessNotFound,
  });
  const admins = data?.data ?? [];
  const totalPages = data?.pagination?.['total-pages'] ?? 1;
  const notFound = isNotFound(error);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ADMINS_QUERY_KEY });
    // The signed-in person may have changed their own standing.
    await queryClient.invalidateQueries({ queryKey: ACCOUNT_DETAILS_QUERY_KEY });
  };

  const closeAddDialog = (open: boolean) => {
    setAddOpen(open);
    if (!open) {
      setEmail('');
      setLookupMessage(null);
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!address.includes('@')) {
      setLookupMessage('Enter the full email address of the account.');
      return;
    }
    setAdding(true);
    setLookupMessage(null);
    try {
      const user = await adminUsersApi.lookupByEmail(address);
      if (!user) {
        setLookupMessage('No account has this email address');
        return;
      }
      if (user.is_admin) {
        setLookupMessage('This account is already a platform administrator.');
        return;
      }
      await adminUsersApi.grantAdmin(user.id);
      toast.success(`${user.email} is now a platform administrator`);
      closeAddDialog(false);
      await refresh();
    } catch (err: unknown) {
      setLookupMessage(err instanceof Error ? err.message : 'Failed to add the administrator');
    } finally {
      setAdding(false);
    }
  };

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    setRemoving(true);
    try {
      await adminUsersApi.revokeAdmin(pendingRemove.id);
      toast.success(`${pendingRemove.email} is no longer a platform administrator`);
      setConfirmingRemove(false);
      await refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove the administrator');
    } finally {
      setRemoving(false);
    }
  };

  const header = (opts: { action?: ReactNode; listState?: PageListState } = {}) => (
    <PageHeader
      icon={ShieldCheck}
      title="Platform Administrators"
      subtitle="The people who manage this installation: its OpenTofu versions, its organizations and its administrators."
      backTo={{ to: '/settings', label: 'Back to Settings' }}
      action={opts.action}
      listState={opts.listState}
    />
  );

  // The admin route answers 404 to anyone who is not a platform administrator.
  if (notFound) {
    return (
      <Page ramp="platform" className="space-y-8">
        {header()}
        <PlatformNotFound />
      </Page>
    );
  }

  // Defined once and handed to both the header and the empty-state card.
  const addAdministratorAction = (
    <GradientButton ramp="app" onClick={() => { setAddOpen(true); }} className="w-auto px-4 py-2">
      <Plus className="h-4 w-4 mr-2" />
      Add administrator
    </GradientButton>
  );
  const listState: PageListState = isLoading ? 'loading' : isError ? 'error' : admins.length === 0 ? 'empty' : 'ready';

  return (
    <Page ramp="platform" className="space-y-8">
      {header({ action: addAdministratorAction, listState })}

      {data && <DeploymentSettingsPanel />}

      {isLoading ? (
        <div className={cn(glassSurface, 'p-2')} data-testid="administrators-skeleton">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className={cn(glassSurface, 'flex flex-col items-center gap-4 p-8 text-center')}>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Failed to load the platform administrators.'}
          </p>
          <Button variant="outline" onClick={() => { void refetch(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      ) : admins.length === 0 ? (
        <PageEmptyState
          icon={ShieldCheck}
          title="No platform administrators"
          description="Add an administrator by the email address of their account."
          action={addAdministratorAction}
        />
      ) : (
        <>
          <ul className={cn(glassSurface, 'divide-y')} aria-label="Platform administrators">
            {admins.map((admin) => (
              <li key={admin.id} className={cn('flex items-center gap-4 p-4', glassDivider)}>
                <UserAvatar picture={admin.avatar_url} name={admin.name} email={admin.email} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{admin.name || admin.email}</span>
                    {admin.platform_admin_declared && <DeclaredBadge />}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{admin.email}</p>
                </div>
                {admin.platform_admin_declared ? (
                  // Declared administrators come and go with the deployment configuration only.
                  <span className="h-9 w-9 shrink-0" aria-hidden="true" />
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Actions for ${admin.email}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          setPendingRemove(admin);
                          setConfirmingRemove(true);
                        }}
                      >
                        <UserMinus className="h-4 w-4 mr-2" />
                        Remove administrator
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            ))}
          </ul>
          <Pager page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Add administrator: one exact email lookup, then the grant. There is no search. */}
      <Dialog open={addOpen} onOpenChange={closeAddDialog}>
        <PageDialogContent>
          <form onSubmit={(e) => { void handleAdd(e); }}>
            <DialogHeader>
              <DialogTitle>Add administrator</DialogTitle>
              <DialogDescription>
                Enter the email address of an existing account. It must match the account's address exactly.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="admin-email">Email address</Label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="off"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setLookupMessage(null); }}
                required
                disabled={adding}
              />
              {lookupMessage && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">{lookupMessage}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { closeAddDialog(false); }} disabled={adding}>
                Cancel
              </Button>
              <GradientButton ramp="app" type="submit" disabled={adding || !email.trim()} className="w-auto px-4 py-2">
                {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add administrator
              </GradientButton>
            </DialogFooter>
          </form>
        </PageDialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmingRemove}
        onOpenChange={setConfirmingRemove}
        title="Remove administrator?"
        description={`${pendingRemove?.email ?? ''} will lose access to the platform settings and the admin API. Their organization memberships do not change.`}
        confirmLabel="Remove administrator"
        variant="destructive"
        loading={removing}
        onConfirm={confirmRemove}
      />
    </Page>
  );
}
