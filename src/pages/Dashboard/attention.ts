// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import type { DashboardOrgStats, DashboardStats } from '@/api/client';

/**
 * One thing that needs a person, in one organization.
 *
 * The dashboard reports attention per organization rather than as estate-wide totals, because the
 * whole question it answers is *where*. "4 runs awaiting approval" across three tenants tells you
 * to go looking; "payments-prod: 2 runs awaiting approval" tells you where to go, and can carry the
 * link that takes you there.
 */
export interface AttentionItem {
  key: string;
  kind: AttentionKind;
  organization: string;
  count: number;
  /** Sentence describing the count, already pluralised. */
  label: string;
  /** Where acting on it starts. */
  href: string;
  tone: 'amber' | 'red' | 'indigo';
}

export type AttentionKind =
  | 'awaiting_approval'
  | 'pending_workflow_approvals'
  | 'errored_workspaces'
  | 'errored_job_templates'
  | 'failed_inventory_syncs'
  | 'runners_offline'
  | 'recent_run_failures'
  | 'recent_job_failures'
  | 'open_change_requests';

/**
 * Severity order, most blocking first.
 *
 * Ranked by who is stuck rather than by how alarming it sounds: an execution waiting on a confirm
 * is blocking a person right now, automation that has been broken for a month is not blocking
 * anyone but will not fix itself, and a change request is a note about future work.
 *
 * Terraform and Ansible are interleaved rather than grouped, so the ranking says how urgent
 * something is and not which half of the product it came from.
 */
const KIND_ORDER: AttentionKind[] = [
  'awaiting_approval',
  'pending_workflow_approvals',
  'errored_workspaces',
  'errored_job_templates',
  'failed_inventory_syncs',
  'runners_offline',
  'recent_run_failures',
  'recent_job_failures',
  'open_change_requests',
];

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * Flattens the per-organization counts into the list the attention section renders.
 *
 * Only non-zero items appear, so the length of the list *is* the number of things wrong - which a
 * grid of mostly-zero cards would destroy. The admin-only kinds are simply absent from the payload
 * when the reader may not see them, so no permission check is needed here.
 */
export function attentionItems(stats: DashboardStats | undefined): AttentionItem[] {
  if (!stats?.organizations) return [];

  const items: AttentionItem[] = [];
  for (const org of stats.organizations) {
    items.push(...itemsForOrg(org, stats.recent_failure_window_days));
  }

  return items.sort((a, b) => {
    const byKind = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    // Within a kind, the loudest organization leads, then alphabetical so the order is stable
    // across refreshes rather than following whatever order the API happened to return.
    return byKind !== 0 ? byKind : b.count - a.count || a.organization.localeCompare(b.organization);
  });
}

function itemsForOrg(org: DashboardOrgStats, failureWindowDays: number): AttentionItem[] {
  const items: AttentionItem[] = [];
  const add = (kind: AttentionKind, count: number, label: string, href: string, tone: AttentionItem['tone']) => {
    if (count > 0) items.push({ key: `${org.name}-${kind}`, kind, organization: org.name, count, label, href, tone });
  };

  // Blocked on a person - both platforms have a confirm step, they just call it different things.
  add(
    'awaiting_approval',
    org.awaiting_approval,
    `OpenTofu ${plural(org.awaiting_approval, 'run is', 'runs are')} waiting for someone to apply`,
    `/app/${org.name}/workspaces?status=needs_attention`,
    'amber',
  );
  add(
    'pending_workflow_approvals',
    org.pending_workflow_approvals,
    `Ansible workflow ${plural(org.pending_workflow_approvals, 'approval is', 'approvals are')} waiting for a decision`,
    `/app/${org.name}/ansible/workflows`,
    'amber',
  );

  // Left broken: the most recent execution failed and nothing has run since.
  add(
    'errored_workspaces',
    org.errored_workspaces,
    `${plural(org.errored_workspaces, 'workspace has', 'workspaces have')} been left broken`,
    `/app/${org.name}/workspaces?status=errored`,
    'red',
  );
  add(
    'errored_job_templates',
    org.errored_job_templates,
    `job ${plural(org.errored_job_templates, 'template has', 'templates have')} been left failing`,
    `/app/${org.name}/ansible/job-templates`,
    'red',
  );
  add(
    'failed_inventory_syncs',
    org.failed_inventory_syncs,
    `${plural(org.failed_inventory_syncs, 'inventory', 'inventories')} failed to sync, so jobs may target stale hosts`,
    `/app/${org.name}/ansible/inventories`,
    'red',
  );

  add(
    'runners_offline',
    org.runners_offline ?? 0,
    `of ${org.runners_total ?? 0} ${plural(org.runners_total ?? 0, 'runner is', 'runners are')} offline`,
    `/app/${org.name}/settings/runners`,
    'red',
  );

  // Named per platform rather than as one "executions" total: which half of the estate is unhealthy
  // is the actionable part, and the two lead to different pages.
  add(
    'recent_run_failures',
    org.recent_run_failures,
    `OpenTofu ${plural(org.recent_run_failures, 'run', 'runs')} failed in the last ${failureWindowDays} days`,
    `/app/${org.name}/usage`,
    'red',
  );
  add(
    'recent_job_failures',
    org.recent_job_failures,
    `Ansible ${plural(org.recent_job_failures, 'job', 'jobs')} failed in the last ${failureWindowDays} days`,
    `/app/${org.name}/ansible/jobs?status=failed`,
    'red',
  );

  add(
    'open_change_requests',
    org.open_change_requests ?? 0,
    `open change ${plural(org.open_change_requests ?? 0, 'request', 'requests')}`,
    `/app/${org.name}/settings/change-requests`,
    'indigo',
  );

  return items;
}
