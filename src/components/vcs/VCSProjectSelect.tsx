// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { vcsConnectionsApi } from '@/api/client';

const ALL_PROJECTS_VALUE = '__all__';

interface VCSProjectSelectProps {
  connectionId: string;
  /** Provider of the selected connection. The project layer only exists for Azure DevOps. */
  provider?: string;
  value: string;
  onChange: (project: string) => void;
  disabled?: boolean;
}

/**
 * Optional project selector for VCS connections that have a project layer.
 * Only Azure DevOps exposes projects; for every other provider this renders
 * nothing, so callers can include it unconditionally. Selecting "All projects"
 * clears the filter (empty string), preserving the single-step UX for orgs that
 * only have one project.
 */
export function VCSProjectSelect({
  connectionId,
  provider,
  value,
  onChange,
  disabled,
}: VCSProjectSelectProps) {
  const isAzureDevOps = provider === 'azure_devops';

  const {
    data: projects = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['vcs-projects', connectionId],
    queryFn: async () => {
      const projects = await vcsConnectionsApi.listProjects(connectionId);
      return projects || [];
    },
    enabled: isAzureDevOps && !!connectionId,
  });

  // The project layer only exists for Azure DevOps; render nothing otherwise.
  if (!isAzureDevOps) {
    return null;
  }

  // While the project list is loading, render nothing rather than a transient
  // dropdown that flashes and then disappears once the result is known.
  if (isLoading) {
    return null;
  }

  // Surface fetch failures (e.g. an Azure DevOps identity that has not been
  // materialized yet) instead of silently disappearing.
  if (isError) {
    return (
      <div className="space-y-2">
        <Label htmlFor="vcs-project">Project</Label>
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Failed to load projects.'}
        </p>
      </div>
    );
  }

  // Nothing to scope by: an org with a single project.
  if (projects.length <= 1) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="vcs-project">Project</Label>
      <Select
        value={value === '' ? ALL_PROJECTS_VALUE : value}
        onValueChange={(v) => onChange(v === ALL_PROJECTS_VALUE ? '' : v)}
        disabled={disabled}
      >
        <SelectTrigger id="vcs-project">
          <SelectValue placeholder="All projects" />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          <SelectItem value={ALL_PROJECTS_VALUE}>All projects</SelectItem>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.name}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
