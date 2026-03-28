// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, useCallback } from 'react';
import { type EffectivePermissions, permissionsApi } from '@/api/client';
import { useMountEffect } from './useMountEffect';

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
 * The component remounts when orgName changes (route param), so useMountEffect is correct.
 *
 * Usage:
 *   const { canManagePlaybooks, canReadInventories, loading } = usePermissions(orgName);
 *   if (!canManagePlaybooks) return <ReadOnlyView />;
 */
export function usePermissions(orgName: string | undefined): UsePermissionsResult {
  const [permissions, setPermissions] = useState<EffectivePermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(() => {
    if (!orgName) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    void permissionsApi.getEffective(orgName).then((perms) => {
      setPermissions(perms);
      setLoading(false);
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to fetch permissions');
      setLoading(false);
    });
  }, [orgName]);

  useMountEffect(() => {
    fetchPermissions();
  });

  const p = permissions;

  return {
    permissions,
    loading,
    error,
    refresh: fetchPermissions,

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
