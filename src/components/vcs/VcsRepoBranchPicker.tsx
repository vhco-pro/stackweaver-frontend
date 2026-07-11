// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getVcsProviderIcon, getVcsProviderLabel, getVcsManageUrl } from '@/lib/vcs';
import { VCSProviderSelector } from '@/components/vcs/VCSProviderSelector';
import { VCSProjectSelect } from '@/components/vcs/VCSProjectSelect';
import type { useVcsRepoBrowser } from '@/components/ansible/useVcsRepoBrowser';

interface VcsRepoBranchPickerProps {
  organizationName: string;
  /** Cascading browser state from useVcsRepoBrowser — the parent owns the hook. */
  browser: ReturnType<typeof useVcsRepoBrowser>;
}

/**
 * The platform's standard VCS connection → (ADO project) → repository → branch
 * selection flow, as established by the playbook/workspace create dialogs:
 * connection cards with provider icons, progressive disclosure, and a
 * searchable repository dropdown.
 */
export function VcsRepoBranchPicker({ organizationName, browser }: VcsRepoBranchPickerProps) {
  const [repositorySelectOpen, setRepositorySelectOpen] = useState(false);
  const [repositorySearch, setRepositorySearch] = useState('');
  const repositorySearchInputRef = useRef<HTMLInputElement>(null);

  const filteredRepositories = browser.repositories.filter((repo) =>
    repo.full_name.toLowerCase().includes(repositorySearch.toLowerCase())
  );

  return (
    <>
      {/* VCS Connection */}
      <div className="space-y-2">
        <Label>VCS Connection *</Label>
        {browser.loadingConnections ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading VCS connections...
          </div>
        ) : browser.connections.length === 0 ? (
          <VCSProviderSelector
            orgName={organizationName}
            selectedConnectionId={undefined}
            onConnectionSelect={(id) => { browser.selectConnection(id || ''); }}
            showConfigureOption={false}
          />
        ) : (
          <div className="space-y-2">
            {browser.connections.map((conn) => (
              <div
                key={conn.id}
                className={cn(
                  'p-3 border-2 rounded-lg cursor-pointer transition-all',
                  browser.connectionId === conn.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                    : 'border-gray-200 dark:border-white/10 hover:border-blue-300'
                )}
                onClick={() => {
                  browser.selectConnection(browser.connectionId === conn.id ? '' : conn.id);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getVcsProviderIcon(conn.provider, 'h-4 w-4')}
                    <span className="text-sm font-medium">
                      {getVcsProviderLabel(conn.provider)} - {conn.account_name}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {conn.account_type}
                    </Badge>
                  </div>
                  {browser.connectionId === conn.id && (
                    <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  )}
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { window.open(`/app/${organizationName}/settings/vcs-connections`, '_blank'); }}
              className="w-full text-xs"
            >
              <Plus className="h-3 w-3 mr-2" />
              Connect to a different VCS
            </Button>
          </div>
        )}
      </div>

      {/* Project Selector (Azure DevOps only) */}
      {browser.connectionId && (
        <VCSProjectSelect
          connectionId={browser.connectionId}
          provider={browser.connection?.provider}
          value={browser.vcsProject}
          onChange={browser.selectVcsProject}
        />
      )}

      {/* Repository Selector */}
      {browser.connectionId && (
        <div className="space-y-2">
          <Label>Repository *</Label>
          {browser.loadingRepos ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading repositories...
            </div>
          ) : browser.repositories.length === 0 ? (
            <div className="text-sm text-muted-foreground space-y-2">
              <p>No repositories found for this installation.</p>
              {(() => {
                const conn = browser.connection;
                const manageUrl = getVcsManageUrl(conn?.provider ?? '', conn?.installation_id ?? '', conn?.account_name ?? '', conn?.account_type ?? '');
                return manageUrl ? (
                  <a href={manageUrl} target="_blank" rel="noreferrer" className="underline">
                    Configure installation repository access on GitHub
                  </a>
                ) : null;
              })()}
            </div>
          ) : (
            <Select
              value={browser.repository}
              onValueChange={browser.selectRepository}
              open={repositorySelectOpen}
              onOpenChange={(open) => {
                setRepositorySelectOpen(open);
                if (open) {
                  setTimeout(() => { repositorySearchInputRef.current?.focus(); }, 100);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a repository" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <div className="p-2 border-b sticky top-0 bg-background z-10">
                  <Input
                    ref={repositorySearchInputRef}
                    placeholder="Search repositories..."
                    aria-label="Search repositories"
                    value={repositorySearch}
                    onChange={(e) => {
                      setRepositorySearch(e.target.value);
                      e.stopPropagation();
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="h-8"
                    autoFocus
                  />
                </div>
                <div className="max-h-[250px] overflow-y-auto">
                  {filteredRepositories.map((repo) => (
                    <SelectItem key={repo.id} value={repo.full_name}>
                      <div className="flex items-center gap-2">
                        {getVcsProviderIcon(browser.connection?.provider ?? '', 'h-4 w-4')}
                        <span>{repo.full_name}</span>
                        {repo.private && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Private
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                  {filteredRepositories.length === 0 && (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No repositories found
                    </div>
                  )}
                </div>
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Branch Selector */}
      {browser.repository && (
        <div className="space-y-2">
          <Label>Branch *</Label>
          {browser.loadingBranches ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading branches...
            </div>
          ) : (
            <Select value={browser.branch} onValueChange={browser.selectBranch}>
              <SelectTrigger>
                <SelectValue placeholder="Select a branch" />
              </SelectTrigger>
              <SelectContent>
                {browser.branches.map((branch) => (
                  <SelectItem key={branch.name} value={branch.name}>
                    {branch.name} {branch.protected ? '(Protected)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </>
  );
}
