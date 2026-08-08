// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ansibleInventorySyncsApi } from '@/api/ansible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle2, Clock, FileText, Loader2, RefreshCw, XCircle } from 'lucide-react';

interface SyncRun {
  id: string;
  status: string;
  triggeredBy: string;
  hostsDiscovered: number;
  groupsDiscovered: number;
  sourceName?: string;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
}

interface InventorySyncsCardProps {
  inventoryId: string;
}

function statusBadge(status: string) {
  switch (status) {
    case 'successful':
      return (
        <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-500/40 gap-1">
          <CheckCircle2 className="h-3 w-3" /> successful
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="outline" className="text-red-600 dark:text-red-400 border-red-500/40 gap-1">
          <XCircle className="h-3 w-3" /> failed
        </Badge>
      );
    case 'running':
      return (
        <Badge variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-500/40 gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> running
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" /> {status}
        </Badge>
      );
  }
}

function formatDuration(startedAt?: string, finishedAt?: string): string {
  if (!startedAt || !finishedAt) return '-';
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 0) return '-';
  if (ms < 1000) return '<1s';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

/**
 * Sync run history for an inventory (AWX's inventory update jobs): every
 * dynamic source sync and VCS file sync with status, trigger, host counts and
 * captured output. Polls while a run is active.
 */
export function InventorySyncsCard({ inventoryId }: InventorySyncsCardProps) {
  const [selectedSyncId, setSelectedSyncId] = useState<string | null>(null);

  const { data: syncs = [], isLoading } = useQuery({
    queryKey: ['inventorySyncs', inventoryId],
    queryFn: async () => {
      const res = await ansibleInventorySyncsApi.list(inventoryId);
      return (res.data || []).map((r): SyncRun => ({
        id: r.id,
        status: (r.attributes?.status as string) || '',
        triggeredBy: (r.attributes?.['triggered-by'] as string) || 'manual',
        hostsDiscovered: (r.attributes?.['hosts-discovered'] as number) || 0,
        groupsDiscovered: (r.attributes?.['groups-discovered'] as number) || 0,
        sourceName: r.attributes?.['source-name'] as string | undefined,
        error: r.attributes?.error as string | undefined,
        startedAt: r.attributes?.['started-at'] as string | undefined,
        finishedAt: r.attributes?.['finished-at'] as string | undefined,
        createdAt: (r.attributes?.['created-at'] as string) || '',
      }));
    },
    enabled: !!inventoryId,
    // Fast poll while a run is active; slow poll otherwise so runs started
    // elsewhere (Rebuild button, schedules, pre-launch syncs) appear without
    // a manual refresh. The list endpoint is light (output omitted).
    refetchInterval: (query) =>
      (query.state.data || []).some((s) => s.status === 'running' || s.status === 'pending') ? 3000 : 10000,
  });

  const { data: selectedSync, isLoading: outputLoading } = useQuery({
    queryKey: ['inventorySync', selectedSyncId],
    queryFn: async () => {
      const res = await ansibleInventorySyncsApi.get(selectedSyncId!);
      return {
        output: (res.data.attributes?.output as string) || '',
        error: (res.data.attributes?.error as string) || '',
        status: (res.data.attributes?.status as string) || '',
      };
    },
    enabled: !!selectedSyncId,
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 2000 : false),
  });

  return (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading sync history...
          </div>
        ) : syncs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
            <RefreshCw className="h-8 w-8 opacity-40" />
            <p className="text-sm">No syncs recorded yet. Run a sync from the Sources tab or the sync button above.</p>
          </div>
        ) : (
          <div className="divide-y">
            {syncs.map((sync) => (
              <button
                key={sync.id}
                type="button"
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm hover:bg-muted/50"
                onClick={() => { setSelectedSyncId(sync.id); }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {statusBadge(sync.status)}
                  <span className="truncate font-medium">{sync.sourceName || 'Inventory file'}</span>
                  <Badge variant="secondary" className="shrink-0">{sync.triggeredBy}</Badge>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-muted-foreground">
                  <span>{sync.hostsDiscovered} hosts</span>
                  <span>{formatDuration(sync.startedAt, sync.finishedAt)}</span>
                  <span>{sync.createdAt ? new Date(sync.createdAt).toLocaleString() : ''}</span>
                  <FileText className="h-4 w-4" />
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!selectedSyncId} onOpenChange={(open) => { if (!open) setSelectedSyncId(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Sync output</DialogTitle>
            <DialogDescription>Captured ansible-inventory output of this sync run.</DialogDescription>
          </DialogHeader>
          {outputLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading output...
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto rounded-md bg-slate-950 p-4">
              <pre className="text-xs text-slate-200 whitespace-pre-wrap break-words font-mono">
                {selectedSync?.output || (selectedSync?.status === 'running' ? 'Sync is running - waiting for output…' : 'No output captured.')}
                {selectedSync?.error ? `\n\nError: ${selectedSync.error}` : ''}
              </pre>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => { setSelectedSyncId(null); }}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
