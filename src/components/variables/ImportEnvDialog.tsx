// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { parseDotenv, looksSensitive, isValidVariableKey, type DotenvIssue } from '@/lib/dotenv';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Loader2,
  FileUp,
  CheckCircle2,
  XCircle,
  SkipForward,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

export type VariableCategory = 'terraform' | 'env';

/** One variable as it will be written to the target. */
export interface ImportedVariable {
  key: string;
  value: string;
  category: VariableCategory;
  sensitive: boolean;
}

/** `overwrite` is only ever passed for a key the caller already reported as existing. */
export type ImportAction = 'create' | 'overwrite';

/** What to do with a key the target already has. */
type ConflictPolicy = 'skip' | 'overwrite';

interface ImportEnvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Keys already present in the target, used to flag conflicts in the preview. */
  existingKeys: string[];
  /** Where the variables land ("workspace", "variable set"), used in the copy. */
  targetLabel: string;
  /** Category pre-selected for the imported variables. */
  defaultCategory?: VariableCategory;
  /**
   * Keys that shadow a platform-provided variable when imported. Flagged in the
   * preview the same way the single-variable form warns about them.
   */
  overrideWarningKeys?: string[];
  /**
   * Whether an existing key can be replaced. Targets that are not persisted yet
   * (a variable set still being created) can only skip conflicting keys.
   */
  allowOverwrite?: boolean;
  /** Writes one variable. Reject to mark that row as failed in the summary. */
  onImportVariable: (variable: ImportedVariable, action: ImportAction) => Promise<void>;
  /** Called once after a run that imported at least one variable. */
  onImported?: () => void;
}

/** A parsed row, editable before it is written. */
interface EnvRow {
  id: number;
  key: string;
  value: string;
  sensitive: boolean;
  selected: boolean;
}

interface RowOutcome {
  key: string;
  status: 'created' | 'updated' | 'skipped' | 'failed';
  detail?: string;
}

/** A .env file large enough to hit this is a mistake, not a variable list. */
const MAX_FILE_BYTES = 512 * 1024;
/** Above this the preview stops being usable and the import turns into a flood of requests. */
const MAX_ROWS = 500;
/** Parallel writes. The API takes one variable per request; a few in flight keeps it quick without hammering it. */
const IMPORT_CONCURRENCY = 4;

/** Run `worker` over `items`, at most `limit` at a time, preserving index order of side effects. */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

/**
 * Bulk-import variables from a `.env` file.
 *
 * This sits alongside the single-variable form rather than replacing it: paste
 * or drop a file, review every key in a preview (rename, edit values, tick
 * sensitive, decide what happens to keys that already exist), then write them
 * one row at a time so a rejected row does not take the rest of the import
 * with it. The summary reports exactly which rows landed and which did not.
 */
export function ImportEnvDialog({
  open,
  onOpenChange,
  existingKeys,
  targetLabel,
  defaultCategory = 'env',
  overrideWarningKeys,
  allowOverwrite = true,
  onImportVariable,
  onImported,
}: ImportEnvDialogProps) {
  const [source, setSource] = useState('');
  const [rows, setRows] = useState<EnvRow[]>([]);
  const [issues, setIssues] = useState<DotenvIssue[]>([]);
  const [duplicateKeys, setDuplicateKeys] = useState<string[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [category, setCategory] = useState<VariableCategory>(defaultCategory);
  const [conflictPolicy, setConflictPolicy] = useState<ConflictPolicy>('skip');
  const [showValues, setShowValues] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outcomes, setOutcomes] = useState<RowOutcome[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existing = new Set(existingKeys);
  const platformKeys = new Set(overrideWarningKeys ?? []);

  const isConflict = (row: EnvRow) => existing.has(row.key.trim());
  const isBlocked = (row: EnvRow) =>
    row.key.trim() === '' || !isValidVariableKey(row.key.trim()) || row.value === '';

  const selectable = rows.filter((r) => !isBlocked(r));
  const selected = selectable.filter((r) => r.selected);
  const allSelected = selectable.length > 0 && selected.length === selectable.length;
  const conflictCount = selected.filter(isConflict).length;
  // Conflicting rows are only written when the user opts into replacing them.
  const writeCount =
    conflictPolicy === 'overwrite' ? selected.length : selected.length - conflictCount;

  /** Parse `text` into preview rows. Any manual row edits are replaced. */
  const applySource = (text: string) => {
    setSource(text);
    setOutcomes(null);
    const parsed = parseDotenv(text);
    const kept = parsed.entries.slice(0, MAX_ROWS);
    setRows(
      kept.map((entry, index) => ({
        id: index,
        key: entry.key,
        value: entry.value,
        sensitive: looksSensitive(entry.key),
        selected: true,
      }))
    );
    setIssues(parsed.issues);
    setDuplicateKeys(parsed.duplicateKeys);
    setTruncated(parsed.entries.length > kept.length);
  };

  const readFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      toast.error(`${file.name} is larger than ${Math.round(MAX_FILE_BYTES / 1024)} KB`);
      return;
    }
    try {
      applySource(await file.text());
    } catch {
      toast.error(`Could not read ${file.name}`);
    }
  };

  const updateRow = (id: number, patch: Partial<EnvRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const toggleAll = () => {
    const next = !allSelected;
    setRows((prev) => prev.map((row) => (isBlocked(row) ? row : { ...row, selected: next })));
  };

  const setAllSensitive = (sensitive: boolean) => {
    setRows((prev) => prev.map((row) => ({ ...row, sensitive })));
  };

  const handleImport = async () => {
    const queue = selected.filter((row) => conflictPolicy === 'overwrite' || !isConflict(row));
    if (queue.length === 0) return;

    setImporting(true);
    setProgress(0);
    const results: RowOutcome[] = new Array<RowOutcome>(queue.length);
    try {
      await runWithConcurrency(queue, IMPORT_CONCURRENCY, async (row, index) => {
        const key = row.key.trim();
        const action: ImportAction = existing.has(key) ? 'overwrite' : 'create';
        try {
          await onImportVariable({ key, value: row.value, category, sensitive: row.sensitive }, action);
          results[index] = { key, status: action === 'overwrite' ? 'updated' : 'created' };
        } catch (err: unknown) {
          results[index] = {
            key,
            status: 'failed',
            // Never surface the value here - only the API's own message.
            detail: err instanceof Error ? err.message : 'Import failed',
          };
        }
        setProgress((done) => done + 1);
      });

      const skipped = selected
        .filter((row) => conflictPolicy !== 'overwrite' && isConflict(row))
        .map<RowOutcome>((row) => ({
          key: row.key.trim(),
          status: 'skipped',
          detail: `already set on this ${targetLabel}`,
        }));

      setOutcomes([...results, ...skipped]);

      const written = results.filter((r) => r.status !== 'failed').length;
      const failed = results.length - written;
      if (written > 0) onImported?.();
      if (failed > 0) {
        toast.error(`${failed} variable${failed === 1 ? '' : 's'} failed to import`);
      } else {
        toast.success(`Imported ${written} variable${written === 1 ? '' : 's'}`);
      }
    } finally {
      setImporting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSource('');
      setRows([]);
      setIssues([]);
      setDuplicateKeys([]);
      setTruncated(false);
      setCategory(defaultCategory);
      setConflictPolicy('skip');
      setShowValues(false);
      setOutcomes(null);
      setProgress(0);
    }
    onOpenChange(nextOpen);
  };

  const created = outcomes?.filter((o) => o.status === 'created').length ?? 0;
  const updated = outcomes?.filter((o) => o.status === 'updated').length ?? 0;
  const skipped = outcomes?.filter((o) => o.status === 'skipped').length ?? 0;
  const failed = outcomes?.filter((o) => o.status === 'failed').length ?? 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Pinned header/footer with only the middle scrolling, so the action
          buttons stay reachable no matter how long the variable list is. */}
      <DialogContent className="max-w-[min(56rem,calc(100vw-2rem))] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Import from a .env file
          </DialogTitle>
          <DialogDescription>
            Add many variables at once. Review everything below before it is written to this{' '}
            {targetLabel} - you can still add variables one at a time with the regular form.
          </DialogDescription>
        </DialogHeader>

        {outcomes ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-2">
            <div className="flex flex-wrap gap-2">
              {created > 0 && (
                <Badge variant="secondary"><CheckCircle2 className="h-3 w-3 mr-1" />{created} created</Badge>
              )}
              {updated > 0 && (
                <Badge variant="secondary"><CheckCircle2 className="h-3 w-3 mr-1" />{updated} replaced</Badge>
              )}
              {skipped > 0 && (
                <Badge variant="outline"><SkipForward className="h-3 w-3 mr-1" />{skipped} skipped</Badge>
              )}
              {failed > 0 && (
                <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />{failed} failed</Badge>
              )}
            </div>
            <div className="space-y-1">
              {outcomes.map((outcome, index) => (
                <div
                  key={`${index}-${outcome.key}`}
                  className="flex items-center justify-between gap-3 text-sm border rounded-md px-3 py-2"
                >
                  <span className="font-mono truncate">{outcome.key}</span>
                  {outcome.status === 'created' && <Badge variant="secondary">created</Badge>}
                  {outcome.status === 'updated' && <Badge variant="secondary">replaced</Badge>}
                  {outcome.status === 'skipped' && (
                    <Badge variant="outline" className="min-w-0 max-w-[60%]">
                      <span className="truncate">{outcome.detail}</span>
                    </Badge>
                  )}
                  {outcome.status === 'failed' && (
                    <span className="text-destructive text-xs truncate max-w-[24rem]" title={outcome.detail}>
                      {outcome.detail}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-2">
            {/* The drop zone gives way to the preview once there is something to
                review - the list is the part that needs the room. */}
            {rows.length === 0 && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => { setDragging(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) void readFile(file);
                }}
                className={cn(
                  'rounded-xl border border-dashed p-6 text-center transition-colors duration-300',
                  dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                )}
              >
                <FileUp className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drop a <span className="font-mono">.env</span> file here, or
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose a file
                </Button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".env,.env.*,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readFile(file);
                // Reset so picking the same file again still fires a change.
                e.target.value = '';
              }}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="env-source">
                  {rows.length === 0 ? 'Or paste the contents' : 'Source'}
                </Label>
                {rows.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose another file
                  </Button>
                )}
              </div>
              <Textarea
                id="env-source"
                value={source}
                onChange={(e) => { applySource(e.target.value); }}
                placeholder={'DATABASE_URL=postgres://localhost/app\nAWS_REGION=eu-west-1'}
                rows={rows.length === 0 ? 5 : 3}
                className="font-mono text-sm"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                Comments, <span className="font-mono">export</span> prefixes, quoted and multiline
                values are understood. References like <span className="font-mono">{'${OTHER}'}</span>{' '}
                are stored as written, not expanded. Editing this rebuilds the list below.
              </p>
            </div>

            {(issues.length > 0 || duplicateKeys.length > 0 || truncated) && (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  <AlertTriangle className="h-4 w-4" />
                  Some lines need attention
                </div>
                {truncated && (
                  <p className="text-xs text-yellow-700 dark:text-yellow-400">
                    Only the first {MAX_ROWS} variables are shown. Split the file to import the rest.
                  </p>
                )}
                {duplicateKeys.length > 0 && (
                  <p className="text-xs text-yellow-700 dark:text-yellow-400">
                    Repeated {duplicateKeys.length === 1 ? 'key' : 'keys'}{' '}
                    <span className="font-mono">{duplicateKeys.join(', ')}</span> - the last value in
                    the file is used.
                  </p>
                )}
                {issues.map((issue) => (
                  <p key={issue.line} className="text-xs text-yellow-700 dark:text-yellow-400">
                    Line {issue.line} skipped: {issue.detail}
                  </p>
                ))}
              </div>
            )}

            {rows.length > 0 && (
              <div className="flex min-h-0 flex-col gap-3">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="env-category">Import as</Label>
                    <Select
                      value={category}
                      onValueChange={(value) => { setCategory(value as VariableCategory); }}
                    >
                      <SelectTrigger id="env-category"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="env">Environment variables</SelectItem>
                        <SelectItem value="terraform">Terraform variables</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {conflictCount > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="env-conflicts">
                        Keys already on this {targetLabel} ({conflictCount})
                      </Label>
                      {allowOverwrite ? (
                        <Select
                          value={conflictPolicy}
                          onValueChange={(value) => { setConflictPolicy(value as ConflictPolicy); }}
                        >
                          <SelectTrigger id="env-conflicts"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="skip">Keep the existing value</SelectItem>
                            <SelectItem value="overwrite">Replace with the imported value</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : null}
                      {allowOverwrite && conflictPolicy === 'overwrite' && (
                        <p className="text-xs text-muted-foreground">
                          Replacing updates the value and its sensitive flag. The category of an
                          existing variable stays as it is.
                        </p>
                      )}
                      {!allowOverwrite && (
                        <p id="env-conflicts" className="text-sm text-muted-foreground">
                          Already added here, so they are left as they are.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Label>Variables ({rows.length})</Label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch id="env-show-values" checked={showValues} onCheckedChange={setShowValues} />
                      <Label htmlFor="env-show-values" className="text-xs font-normal cursor-pointer">
                        Show values
                      </Label>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => { setAllSensitive(true); }}
                    >
                      Mark all sensitive
                    </button>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => { setAllSensitive(false); }}
                    >
                      Clear sensitive
                    </button>
                  </div>
                </div>

                <div className="border rounded-lg overflow-auto max-h-80">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 px-3">
                          <Checkbox
                            checked={allSelected}
                            disabled={selectable.length === 0}
                            onCheckedChange={toggleAll}
                            aria-label="Select all variables"
                          />
                        </TableHead>
                        <TableHead className="w-[28%] px-3">Key</TableHead>
                        <TableHead className="px-3">Value</TableHead>
                        <TableHead className="w-24 px-3 text-center">Sensitive</TableHead>
                        <TableHead className="w-32 px-3">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => {
                        const blocked = isBlocked(row);
                        const conflict = isConflict(row);
                        return (
                          <TableRow key={row.id} className={cn(blocked && 'opacity-70')}>
                            <TableCell className="px-3 py-2">
                              <Checkbox
                                checked={!blocked && row.selected}
                                disabled={blocked}
                                onCheckedChange={(checked) => { updateRow(row.id, { selected: checked === true }); }}
                                aria-label={`Import ${row.key}`}
                              />
                            </TableCell>
                            <TableCell className="px-3 py-2">
                              <Input
                                value={row.key}
                                onChange={(e) => { updateRow(row.id, { key: e.target.value }); }}
                                className="h-8 font-mono text-xs"
                                aria-label="Variable key"
                              />
                              {platformKeys.has(row.key.trim()) && (
                                <p className="mt-1 text-[11px] text-yellow-700 dark:text-yellow-400">
                                  Overrides a platform variable
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="px-3 py-2">
                              {row.value.includes('\n') ? (
                                // An <input> strips line breaks, so a multiline value (a PEM key,
                                // a JSON blob) is shown read-only here and edited in the source above.
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs truncate text-muted-foreground">
                                    {row.sensitive && !showValues
                                      ? '••••••••'
                                      : `${row.value.split('\n')[0]} …`}
                                  </span>
                                  <Badge variant="outline" className="shrink-0 text-[10px]">
                                    multiline
                                  </Badge>
                                </div>
                              ) : (
                                <Input
                                  type={row.sensitive && !showValues ? 'password' : 'text'}
                                  value={row.value}
                                  onChange={(e) => { updateRow(row.id, { value: e.target.value }); }}
                                  className="h-8 font-mono text-xs"
                                  aria-label="Variable value"
                                />
                              )}
                            </TableCell>
                            <TableCell className="px-3 py-2 text-center">
                              <Checkbox
                                checked={row.sensitive}
                                onCheckedChange={(checked) => { updateRow(row.id, { sensitive: checked === true }); }}
                                aria-label={`Store ${row.key} as sensitive`}
                              />
                            </TableCell>
                            <TableCell className="px-3 py-2">
                              {row.key.trim() === '' || !isValidVariableKey(row.key.trim()) ? (
                                <Badge variant="destructive" className="text-xs">Invalid key</Badge>
                              ) : row.value === '' ? (
                                <Badge variant="outline" className="text-xs">Needs a value</Badge>
                              ) : conflict ? (
                                <Badge variant="outline" className="text-xs">
                                  {conflictPolicy === 'overwrite' ? 'Replaces' : 'Skipped'}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">New</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Values are masked while “sensitive” is ticked. Keys that look like secrets are
                  ticked automatically - check them before importing, the guess is not a guarantee.
                  Multiline values are imported as they are and can only be edited in the source above.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {outcomes ? (
            <Button onClick={() => { handleOpenChange(false); }}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => { handleOpenChange(false); }} disabled={importing}>
                Cancel
              </Button>
              <Button onClick={() => { void handleImport(); }} disabled={importing || writeCount === 0}>
                {importing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {importing
                  ? `Importing ${progress} of ${writeCount}...`
                  : `Import ${writeCount > 0 ? `${writeCount} variable${writeCount === 1 ? '' : 's'}` : 'variables'}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
