// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ansiblePlaybooksApi } from '@/api/ansible';
import { vcsConnectionsApi, type VCSConnection } from '@/api/client';

/** Deduplicate VCS connections by provider + account (one entry per real account). */
export function dedupeVcsConnections(connections: VCSConnection[]): VCSConnection[] {
  return Array.from(
    new Map(connections.map((c) => [`${c.provider}-${c.account_name}-${c.account_type}`, c])).values()
  );
}

/**
 * Cascading VCS connection → (ADO project) → repository → branch → playbook
 * files browser state, shared by the bulk-import wizard and the playbook
 * source picker. Selecting a level clears everything downstream; selecting a
 * repository defaults the branch to the repo's default branch.
 */
export function useVcsRepoBrowser(
  organizationName: string,
  enabled: boolean,
  initial?: { connectionId?: string; repository?: string; branch?: string },
) {
  const [connectionId, setConnectionId] = useState(initial?.connectionId ?? '');
  const [vcsProject, setVcsProject] = useState('');
  const [repository, setRepository] = useState(initial?.repository ?? '');
  const [branch, setBranch] = useState(initial?.branch ?? '');

  const { data: connections = [], isLoading: loadingConnections } = useQuery({
    queryKey: ['vcsRepoBrowserConnections', organizationName],
    queryFn: async () => {
      const res = await vcsConnectionsApi.list(organizationName);
      const deduped = dedupeVcsConnections(Array.isArray(res) ? res : []);
      // Auto-select a sole connection, matching the create-dialog behavior.
      if (deduped.length === 1) {
        setConnectionId((prev) => prev || deduped[0].id);
      }
      return deduped;
    },
    enabled: enabled && !!organizationName,
  });
  const connection: VCSConnection | undefined = connections.find((c) => c.id === connectionId);

  const { data: repositories = [], isLoading: loadingRepos } = useQuery({
    queryKey: ['vcsRepoBrowserRepos', connectionId, vcsProject],
    queryFn: () => vcsConnectionsApi.listAllRepositories(connectionId, vcsProject || undefined),
    enabled: enabled && !!connectionId,
  });

  const { data: branches = [], isLoading: loadingBranches } = useQuery({
    queryKey: ['vcsRepoBrowserBranches', connectionId, repository],
    queryFn: async () => {
      const [owner, repo] = repository.split('/');
      const res = await vcsConnectionsApi.listBranches(connectionId, owner, repo);
      return res || [];
    },
    enabled: enabled && !!connectionId && repository.includes('/'),
  });

  const { data: files = [], isLoading: loadingFiles } = useQuery({
    queryKey: ['vcsRepoBrowserFiles', organizationName, connectionId, repository, branch],
    queryFn: async () => {
      const res = await ansiblePlaybooksApi.listVcsFiles(organizationName, {
        vcs_connection_id: connectionId,
        repository,
        branch,
      });
      return res.data || [];
    },
    enabled: enabled && !!connectionId && repository.includes('/') && !!branch,
  });

  const selectConnection = (id: string) => {
    setConnectionId(id);
    setVcsProject('');
    setRepository('');
    setBranch('');
  };

  const selectVcsProject = (project: string) => {
    setVcsProject(project);
    setRepository('');
    setBranch('');
  };

  const selectRepository = (fullName: string) => {
    setRepository(fullName);
    const repo = repositories.find((r) => r.full_name === fullName);
    setBranch(repo?.default_branch || '');
  };

  return {
    connectionId, vcsProject, repository, branch,
    connection, connections, repositories, branches, files,
    loadingConnections, loadingRepos, loadingBranches, loadingFiles,
    selectConnection, selectVcsProject, selectRepository, selectBranch: setBranch,
  };
}
