// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useQuery } from '@tanstack/react-query';
import { type EffectivePermissions, permissionsApi } from '@/api/client';

interface UsePermissionsResult {
  permissions: EffectivePermissions | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;

  // Ansible convenience helpers
  canManagePlaybooks: boolean;
  canReadPlaybooks: boolean;
  canManageInventories: boolean;
  canReadInventories: boolean;
  canManageCredentials: boolean;
  canReadCredentials: boolean;
  canManageJobTemplates: boolean;
  canReadJobTemplates: boolean;
  canExecuteJobs: boolean;
  canReadJobs: boolean;
  canManageSchedules: boolean;
  canReadSchedules: boolean;

  // Org-level convenience helpers
  canManageAnsible: boolean;
  canReadAnsible: boolean;
  canManageProjects: boolean;
  canManageWorkspaces: boolean;
  canManageTeams: boolean;
}

/**
 * Hook to fetch and cache the authenticated user's effective permissions for an organization.
 * Returns the union of all permissions from all teams the user is a member of.
 *
 * Keyed on the organization rather than fetched once at mount: the dashboard changes its focus
 * organization without remounting, and a mount-once fetch left it answering for the previous
 * tenant. Callers that do remount per organization are unaffected, and several components asking
 * for the same organization now share one request.
 *
 * Usage:
 *   const { canManagePlaybooks, canReadInventories, loading } = usePermissions(orgName);
 *   if (!canManagePlaybooks) return <ReadOnlyView />;
 */
export function usePermissions(orgName: string | undefined): UsePermissionsResult {
  const query = useQuery<EffectivePermissions>({
    queryKey: ['effective-permissions', orgName],
    queryFn: () => permissionsApi.getEffective(orgName!),
    enabled: Boolean(orgName),
    staleTime: 5 * 60_000,
  });

  const p = query.data ?? null;

  return {
    permissions: p,
    // With no organization there is nothing to fetch, so the hook is settled rather than pending.
    loading: Boolean(orgName) && query.isPending,
    error: query.error instanceof Error ? query.error.message : query.error ? 'Failed to fetch permissions' : null,
    refresh: () => { void query.refetch(); },

    // Ansible fine-grained
    canManagePlaybooks: p?.['ansible:playbook:write'] ?? false,
    canReadPlaybooks: p?.['ansible:playbook:read'] ?? false,
    canManageInventories: p?.['ansible:inventory:write'] ?? false,
    canReadInventories: p?.['ansible:inventory:read'] ?? false,
    canManageCredentials: p?.['ansible:credential:write'] ?? false,
    canReadCredentials: p?.['ansible:credential:read'] ?? false,
    canManageJobTemplates: p?.['ansible:job-template:write'] ?? false,
    canReadJobTemplates: p?.['ansible:job-template:read'] ?? false,
    canExecuteJobs: p?.['ansible:job:execute'] ?? false,
    canReadJobs: p?.['ansible:job:read'] ?? false,
    canManageSchedules: p?.['ansible:schedule:write'] ?? false,
    canReadSchedules: p?.['ansible:schedule:read'] ?? false,

    // Org-level
    canManageAnsible: p?.['org:manage-ansible'] ?? false,
    canReadAnsible: p?.['org:read-ansible'] ?? false,
    canManageProjects: p?.['org:manage-projects'] ?? false,
    canManageWorkspaces: p?.['org:manage-workspaces'] ?? false,
    canManageTeams: p?.['org:manage-teams'] ?? false,
  };
}
