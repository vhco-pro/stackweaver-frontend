// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The five real sync states collapse to a small UI vocabulary. The raw API
// strings come from several writers (ansible-runner, the playbook/inventory
// handlers, the job service) and are normalised here so every list/detail view
// buckets them identically - see the plan's status-normalisation note.
export type SyncState = 'success' | 'syncing' | 'failed' | 'never' | 'unknown';

// Maps the raw API strings → a small UI state:
//   "successful"            → 'success'
//   "syncing" | "pending"   → 'syncing'   (pending is the pre-sync transient)
//   "failed"                → 'failed'
//   "never_synced"          → 'never'     (inventory sources only)
//   undefined / anything    → 'unknown'
export function normalizeSyncState(status?: string): SyncState {
  switch (status) {
    case 'successful':
      return 'success';
    case 'syncing':
    case 'pending':
      return 'syncing';
    case 'failed':
      return 'failed';
    case 'never_synced':
      return 'never';
    default:
      return 'unknown';
  }
}

// Rank used when sorting by sync status: failures bubble to the top when the
// sort order is descending, which is the issue's "failed only" quick-view intent.
const SYNC_STATE_RANK: Record<SyncState, number> = {
  failed: 4,
  syncing: 3,
  success: 2,
  never: 1,
  unknown: 0,
};

export function syncStateRank(status?: string): number {
  return SYNC_STATE_RANK[normalizeSyncState(status)];
}
