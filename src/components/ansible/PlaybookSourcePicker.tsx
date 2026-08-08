// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useRef, useState } from 'react';
import { type AnsiblePlaybook } from '@/api/ansible';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VcsRepoBranchPicker } from '@/components/vcs/VcsRepoBranchPicker';
import type { PlaybookSelection } from './playbook-selection';
import { useVcsRepoBrowser } from './useVcsRepoBrowser';

interface PlaybookSourcePickerProps {
  organizationName: string;
  /** Registered playbooks for the registered-mode dropdown. */
  playbooks: AnsiblePlaybook[];
  value: PlaybookSelection;
  onChange: (selection: PlaybookSelection) => void;
}

/**
 * Dual-mode playbook field for job template forms: pick a registered playbook
 * from the dropdown, or walk the platform's standard VCS connection →
 * repository → branch flow and pick a playbook file directly (it is registered
 * automatically when the form is saved).
 *
 * Browse-mode state initializes from `value` on mount and is not re-synced;
 * parents should remount the picker per dialog open (key it on the dialog-open
 * flag) so a stale browse tree never survives a cancel.
 */
export function PlaybookSourcePicker({ organizationName, playbooks, value, onChange }: PlaybookSourcePickerProps) {
  const [mode, setMode] = useState<'registered' | 'browse'>(value?.kind === 'file' ? 'browse' : 'registered');
  // The last file picked in browse mode, kept for display even when the pick
  // resolved to an already-registered playbook (a registered selection).
  const [pickedPath, setPickedPath] = useState(value?.kind === 'file' ? value.path : '');
  const [fileSelectOpen, setFileSelectOpen] = useState(false);
  const [fileSearch, setFileSearch] = useState('');
  const fileSearchInputRef = useRef<HTMLInputElement>(null);

  const browser = useVcsRepoBrowser(
    organizationName,
    mode === 'browse',
    value?.kind === 'file'
      ? { connectionId: value.connectionId, repository: value.repository, branch: value.branch }
      : undefined,
  );

  const registeredValue = value?.kind === 'registered' ? value.playbookId : '';
  const pickedEntry = browser.files.find((f) => f.path === pickedPath);
  const filteredFiles = browser.files.filter((f) =>
    f.path.toLowerCase().includes(fileSearch.toLowerCase())
  );

  const handleFilePick = (path: string) => {
    setPickedPath(path);
    const entry = browser.files.find((f) => f.path === path);
    if (entry?.registered && entry.playbook_id) {
      // Already registered: behave exactly like picking it from the dropdown.
      onChange({ kind: 'registered', playbookId: entry.playbook_id });
    } else {
      onChange({
        kind: 'file',
        connectionId: browser.connectionId,
        repository: browser.repository,
        branch: browser.branch,
        path,
      });
    }
  };

  const modeButton = (m: 'registered' | 'browse', label: string) => (
    <button
      type="button"
      onClick={() => { setMode(m); }}
      className={cn(
        'px-2.5 py-1 text-xs rounded-md border transition-colors',
        mode === m
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-transparent text-muted-foreground border-border hover:text-foreground'
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Playbook *</Label>
          <div className="flex gap-1">
            {modeButton('registered', 'Registered')}
            {modeButton('browse', 'From repository')}
          </div>
        </div>

        {mode === 'registered' && (
          <Select
            value={registeredValue}
            onValueChange={(v) => { setPickedPath(''); onChange({ kind: 'registered', playbookId: v }); }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a playbook" />
            </SelectTrigger>
            <SelectContent>
              {playbooks.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">No playbooks available</div>
              ) : (
                playbooks.map((pb) => (
                  <SelectItem key={pb.id} value={pb.id}>{pb.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}
      </div>

      {mode === 'browse' && (
        <>
          <VcsRepoBranchPicker organizationName={organizationName} browser={browser} />

          {/* Playbook file - same searchable select as the playbook create dialog */}
          {browser.connectionId && browser.repository && browser.branch && (
            <div className="space-y-2">
              <Label>Playbook File *</Label>
              {browser.loadingFiles ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading playbook files...
                </div>
              ) : (
                <Select
                  value={pickedPath}
                  onValueChange={handleFilePick}
                  open={fileSelectOpen}
                  onOpenChange={(open) => {
                    setFileSelectOpen(open);
                    if (open) {
                      setTimeout(() => { fileSearchInputRef.current?.focus(); }, 100);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a playbook file" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <div className="p-2 border-b sticky top-0 bg-background z-10">
                      <Input
                        ref={fileSearchInputRef}
                        placeholder="Search playbook files..."
                        aria-label="Search playbook files"
                        value={fileSearch}
                        onChange={(e) => {
                          setFileSearch(e.target.value);
                          e.stopPropagation();
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="h-8"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-[250px] overflow-y-auto">
                      {filteredFiles.map((f) => (
                        <SelectItem key={f.path} value={f.path}>
                          <span className="flex items-center gap-2">
                            {f.path}
                            {f.registered && (
                              <Badge variant="outline" className="text-xs">
                                registered as “{f.playbook_name}”
                              </Badge>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                      {filteredFiles.length === 0 && (
                        <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                          No playbook files found
                        </div>
                      )}
                    </div>
                  </SelectContent>
                </Select>
              )}
              {value?.kind === 'file' && (
                <div className="text-xs text-muted-foreground">
                  <Badge variant="outline" className="mr-1">new</Badge>
                  “{value.path}” will be registered as a playbook when you save.
                </div>
              )}
              {value?.kind === 'registered' && pickedEntry?.registered && (
                <div className="text-xs text-muted-foreground">
                  <Badge variant="outline" className="mr-1">existing</Badge>
                  “{pickedPath}” is already registered as “{pickedEntry.playbook_name}” - the existing playbook will be used.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
