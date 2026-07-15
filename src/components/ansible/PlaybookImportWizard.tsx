// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ansiblePlaybooksApi, type BulkImportResult } from '@/api/ansible';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, FolderGit2, CheckCircle2, XCircle, SkipForward } from 'lucide-react';
import { toast } from 'sonner';
import { VcsRepoBranchPicker } from '@/components/vcs/VcsRepoBranchPicker';
import { useVcsRepoBrowser } from './useVcsRepoBrowser';

interface PlaybookImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationName: string;
  /** Called after a successful import so the parent can refresh its playbook list. */
  onImported: () => void;
}

/**
 * Bulk-import wizard: walk the platform's standard VCS connection → repository
 * → branch flow, then check off the discovered playbook files to register them
 * all in one call. Already-registered files are shown disabled with their
 * playbook name.
 */
export function PlaybookImportWizard({ open, onOpenChange, organizationName, onImported }: PlaybookImportWizardProps) {
  const [scopePath, setScopePath] = useState('');
  const [sourceMode, setSourceMode] = useState('cached');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  const browser = useVcsRepoBrowser(organizationName, open);

  // Selecting a different connection/repo/branch invalidates the checklist.
  const selectionKey = `${browser.connectionId}|${browser.repository}|${browser.branch}`;
  const [selectedForKey, setSelectedForKey] = useState(selectionKey);
  if (selectedForKey !== selectionKey) {
    setSelectedForKey(selectionKey);
    setSelected(new Set());
    setResult(null);
  }

  // The full file list is already fetched; the directory filter is a cheap
  // client-side prefix match (no API call per keystroke).
  const scope = scopePath.trim().replace(/^\/+|\/+$/g, '');
  const files = browser.files.filter(
    (f) => !scope || f.path === scope || f.path.startsWith(scope + '/')
  );

  const importable = files.filter((f) => !f.registered);
  const allSelected = importable.length > 0 && importable.every((f) => selected.has(f.path));

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(importable.map((f) => f.path)));
  };

  const toggleOne = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    try {
      const res = await ansiblePlaybooksApi.bulkImport(organizationName, {
        vcs_connection_id: browser.connectionId,
        repository: browser.repository,
        branch: browser.branch,
        source_mode: sourceMode,
        playbooks: Array.from(selected).sort().map((path) => ({ path })),
      });
      setResult(res.data);
      if (res.data.created > 0) {
        onImported();
      }
      if (res.data.failed > 0) {
        toast.error(`${res.data.failed} playbook${res.data.failed > 1 ? 's' : ''} failed to import`);
      } else {
        toast.success(`Imported ${res.data.created} playbook${res.data.created === 1 ? '' : 's'}`);
      }
    } catch (err: unknown) {
      console.error('Bulk import failed:', err);
      toast.error(err instanceof Error ? err.message : 'Bulk import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setScopePath('');
      setSourceMode('cached');
      setSelected(new Set());
      setResult(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* flex column with a pinned header/footer: only the middle section (and
          within it the file list) scrolls, so the title and the Cancel/Import
          buttons never scroll out of view on long file lists. */}
      <DialogContent className="max-w-[min(42rem,calc(100vw-2rem))] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderGit2 className="h-5 w-5" />
            Import playbooks from repository
          </DialogTitle>
          <DialogDescription>
            Discover the playbook files in a connected repository and register many at once.
            New playbooks sync immediately and use the selected source mode.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-2">
            <div className="flex gap-2">
              <Badge variant="secondary"><CheckCircle2 className="h-3 w-3 mr-1" />{result.created} created</Badge>
              <Badge variant="outline"><SkipForward className="h-3 w-3 mr-1" />{result.skipped} skipped</Badge>
              {result.failed > 0 && (
                <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />{result.failed} failed</Badge>
              )}
            </div>
            <div className="space-y-1">
              {result.results.map((r) => (
                <div key={r.path} className="flex items-center justify-between gap-3 text-sm border rounded-md px-3 py-2">
                  <span className="font-mono truncate">{r.path}</span>
                  {r.status === 'created' && (
                    <Badge variant="secondary" className="min-w-0 max-w-[50%]" title={`created as “${r.name}”`}>
                      <span className="truncate">created as “{r.name}”</span>
                    </Badge>
                  )}
                  {r.status === 'skipped' && <Badge variant="outline">already registered</Badge>}
                  {r.status === 'failed' && (
                    <span className="text-destructive text-xs truncate max-w-[16rem]" title={r.error}>{r.error}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-2">
            <VcsRepoBranchPicker organizationName={organizationName} browser={browser} />

            {browser.branch && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Directory Filter</Label>
                    <Input
                      placeholder="e.g. playbooks"
                      value={scopePath}
                      onChange={(e) => { setScopePath(e.target.value); }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Optionally narrow the list to one directory.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Source Mode</Label>
                    <Select value={sourceMode} onValueChange={setSourceMode}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cached">Cached snapshot (default)</SelectItem>
                        <SelectItem value="fresh">Fresh from VCS at runtime</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex min-h-0 flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label>Playbook Files</Label>
                    {importable.length > 0 && (
                      <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={toggleAll}>
                        {allSelected ? 'Deselect all' : `Select all (${importable.length})`}
                      </button>
                    )}
                  </div>
                  {browser.loadingFiles ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading playbook files...
                    </div>
                  ) : (
                    // min-h keeps the list usable when the flex column is squeezed on
                    // short viewports; skipped for short lists so the box hugs its rows.
                    <div className={cn('border rounded-md overflow-y-auto divide-y', files.length > 3 && 'min-h-32')}>
                      {files.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground">
                          No playbook files found. YAML files inside conventional non-playbook
                          directories (roles, group_vars, inventories, …) are hidden.
                        </p>
                      ) : (
                        files.map((f) => (
                          <label
                            key={f.path}
                            className={`flex items-center gap-3 px-3 py-2 text-sm ${f.registered ? 'opacity-60' : 'cursor-pointer hover:bg-muted/50'}`}
                          >
                            <Checkbox
                              checked={f.registered || selected.has(f.path)}
                              disabled={f.registered}
                              onCheckedChange={() => { toggleOne(f.path); }}
                            />
                            <span className="font-mono truncate flex-1">{f.path}</span>
                            {f.registered && (
                              <Badge variant="outline" className="min-w-0 max-w-[50%]" title={`registered as “${f.playbook_name}”`}>
                                <span className="truncate">registered as “{f.playbook_name}”</span>
                              </Badge>
                            )}
                          </label>
                        ))
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {files.length > 0
                      ? `Select the playbook files to register (${importable.length} of ${files.length} not yet registered)`
                      : ''}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => { handleOpenChange(false); }}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => { handleOpenChange(false); }}>Cancel</Button>
              <Button onClick={() => { void handleImport(); }} disabled={importing || selected.size === 0}>
                {importing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Import {selected.size > 0 ? `${selected.size} playbook${selected.size === 1 ? '' : 's'}` : 'playbooks'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
