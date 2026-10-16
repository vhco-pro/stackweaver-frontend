// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useId } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { AnsibleJobInventorySyncWarning } from '@/api/ansible';

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

interface InventorySyncWarningsAlertProps {
  warnings: AnsibleJobInventorySyncWarning[];
}

/**
 * The job page's notice for a job that ran on inventory its update-on-launch syncs did not
 * refresh: one line per source, naming it, when and why its sync failed, and which hosts the job
 * ran against. Styled as the page's other banners; renders nothing when there is nothing to say.
 */
export function InventorySyncWarningsAlert({ warnings }: InventorySyncWarningsAlertProps) {
  const titleId = useId();
  if (warnings.length === 0) return null;
  return (
    <div
      role="alert"
      aria-labelledby={titleId}
      className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-yellow-800 dark:text-yellow-400"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex-1 space-y-1 text-sm">
        <p id={titleId} className="font-medium">
          This job ran on inventory that was not refreshed
        </p>
        <ul className="space-y-1 opacity-90">
          {warnings.map((w) => (
            <li key={w.source_id}>
              The sync of source <span className="font-medium">{w.source_name}</span> failed at{' '}
              {formatDateTime(w.failed_at)}: {w.error.replace(/\.$/, '')}.{' '}
              {w.last_successful_sync_at
                ? `The job used the hosts of its last successful sync, at ${formatDateTime(w.last_successful_sync_at)}.`
                : 'The source has never synced successfully, so the job ran without hosts from it.'}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
