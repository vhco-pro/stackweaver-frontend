// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { runsApi } from '@/api/client';
import { Button } from '@/components/ui/button';

/**
 * The person's re-queue of a lost apply (#933, decision 16): the apply is never re-run on its
 * own, because running it twice could change infrastructure twice. Re-queuing applies the run's
 * saved plan as a new attempt; it is refused if the state moved meanwhile.
 */
export function LostApplyRequeue({ runId, onRequeued }: { runId: string; onRequeued: () => void }) {
  const [pending, setPending] = useState(false);
  const requeue = () => {
    setPending(true);
    void runsApi.apply(runId)
      .then(() => {
        toast.success('The apply was re-queued as a new attempt');
        onRequeued();
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : 'Failed to re-queue the apply');
      })
      .finally(() => { setPending(false); });
  };
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="lost-apply-requeue">
      <p className="text-sm text-amber-800 dark:text-amber-200">
        The launcher running this apply was lost, so the apply was not retried. Re-queue it to apply the saved plan as a new attempt.
      </p>
      <Button variant="outline" size="sm" onClick={requeue} disabled={pending} className="shrink-0">
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
        Re-queue apply
      </Button>
    </div>
  );
}
