// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import type { ReactElement } from 'react';
import { CheckCircle, Loader2, XCircle, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { normalizeSyncState, type SyncState } from '@/pages/Ansible/syncStatus';

// Minimal relative-time formatter for the tooltip body. Kept local so the
// indicator is self-contained; mirrors the formatter used on the list pages.
function formatRelative(dateString: string): string {
  const date = new Date(dateString);
  const diffMs = new Date().getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

interface SyncStatusIndicatorProps {
  status?: string;
  error?: string;
  syncedAt?: string;
  /** Optional retry handler - shows a "Retry sync" affordance inside the tooltip on failure. */
  onRetry?: () => void;
  retrying?: boolean;
  /** Link to the resource's detail page for the full, untruncated error. */
  detailHref?: string;
  /**
   * Render the state label + relative sync time next to the icon instead of the
   * bare icon. Use on list cards so the sync state and "Synced x ago" are one
   * piece of metadata rather than two competing ones.
   */
  showLabel?: boolean;
  className?: string;
}

const STATE_META: Record<
  Exclude<SyncState, 'unknown'>,
  { label: string; icon: typeof CheckCircle; iconClass: string; spin?: boolean }
> = {
  success: { label: 'Synced', icon: CheckCircle, iconClass: 'text-green-600 dark:text-green-400' },
  syncing: { label: 'Syncing…', icon: Loader2, iconClass: 'text-blue-600 dark:text-blue-400', spin: true },
  failed: { label: 'Sync failed', icon: XCircle, iconClass: 'text-red-600 dark:text-red-400' },
  never: { label: 'Never synced', icon: AlertCircle, iconClass: 'text-muted-foreground' },
};

// A resource that has a sync timestamp but no status the API recognises (older
// rows, manually-created playbooks) still deserves its "Synced x ago" line - it
// renders neutrally rather than claiming success.
const UNKNOWN_META = {
  label: 'Synced',
  icon: Clock,
  iconClass: 'text-blue-600 dark:text-blue-400',
} as const;

const MAX_ERROR_LINES = 6;

function truncateError(error: string): { text: string; truncated: boolean } {
  const lines = error.split('\n');
  if (lines.length <= MAX_ERROR_LINES) return { text: error, truncated: false };
  return { text: lines.slice(0, MAX_ERROR_LINES).join('\n'), truncated: true };
}

/**
 * Small inline sync-status indicator for list cards: a colored icon that reveals
 * the status (and, on failure, the `last_sync_error`) in an accessible tooltip.
 * Renders nothing for the 'unknown' state so never-touched manual resources stay
 * clean. Keep it inline with existing card metadata - it never expands card height.
 */
export function SyncStatusIndicator({
  status,
  error,
  syncedAt,
  onRetry,
  retrying,
  detailHref,
  showLabel,
  className,
}: SyncStatusIndicatorProps): ReactElement | null {
  const state = normalizeSyncState(status);
  // Icon-only callers stay silent on 'unknown'; labelled callers still show the
  // timestamp they would otherwise have rendered themselves.
  if (state === 'unknown' && !(showLabel && syncedAt)) return null;

  const meta = state === 'unknown' ? UNKNOWN_META : STATE_META[state];
  const Icon = meta.icon;
  const spin = 'spin' in meta && meta.spin;
  const { text: errorText, truncated } = error ? truncateError(error) : { text: '', truncated: false };
  const relative = syncedAt && state !== 'never' ? formatRelative(syncedAt) : undefined;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn('inline-flex items-center', showLabel && 'gap-1', className)}
            aria-label={state === 'failed' ? `Sync failed: ${error || 'unknown error'}` : meta.label}
          >
            <Icon className={cn('h-3.5 w-3.5 shrink-0', meta.iconClass, spin && 'animate-spin')} />
            {showLabel && (
              <span className={cn(state === 'failed' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                {meta.label}
                {relative ? ` ${relative}` : ''}
              </span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          <div className="space-y-1.5">
            <p className={cn('font-medium', state === 'failed' && 'text-red-600 dark:text-red-400')}>
              {meta.label}
            </p>
            {relative && (
              <p className="text-xs text-muted-foreground">Last synced {relative}</p>
            )}
            {state === 'failed' && error && (
              <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                {errorText}
                {truncated && '\n…'}
              </pre>
            )}
            {state === 'failed' && truncated && detailHref && (
              <a
                href={detailHref}
                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                onClick={(e) => e.stopPropagation()}
              >
                View details
              </a>
            )}
            {state === 'failed' && onRetry && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry();
                }}
                disabled={retrying}
                className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
              >
                <RefreshCw className={cn('h-3 w-3', retrying && 'animate-spin')} />
                {retrying ? 'Retrying…' : 'Retry sync'}
              </button>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
