// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The attention list is the whole point of the dashboard, and it is pure: counts in, ranked rows
// out. These pin the parts that would silently mislead if they broke - a zero-count row appearing,
// an admin-only signal leaking, or the ranking putting a stale failure above a blocked apply.

import { describe, it, expect } from 'vitest';
import { attentionItems } from './attention';
import { dashboardStats, orgStats } from './dashboard.fixtures';

describe('attentionItems', () => {
  it('is empty before the stats arrive', () => {
    expect(attentionItems(undefined)).toEqual([]);
  });

  it('emits nothing for an organization with nothing wrong', () => {
    // The length of the list is how the reader counts what is wrong, so a quiet organization has to
    // contribute no rows at all rather than rows reading zero.
    expect(attentionItems(dashboardStats({ organizations: [orgStats({ terraform_workspaces: 9 })] }))).toEqual([]);
  });

  it('names the organization on every row and links into it', () => {
    const items = attentionItems(
      dashboardStats({ organizations: [orgStats({ name: 'payments', awaiting_approval: 2 })] }),
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'awaiting_approval',
      organization: 'payments',
      count: 2,
      href: '/app/payments/workspaces?status=needs_attention',
    });
    expect(items[0].label).toContain('runs are');
  });

  it('pluralises against the count', () => {
    const one = attentionItems(dashboardStats({ organizations: [orgStats({ errored_workspaces: 1 })] }));
    const many = attentionItems(dashboardStats({ organizations: [orgStats({ errored_workspaces: 3 })] }));
    expect(one[0].label).toContain('workspace has');
    expect(many[0].label).toContain('workspaces have');
  });

  it('ranks by who is blocked, not by how alarming it sounds or which platform it is', () => {
    const items = attentionItems(
      dashboardStats({
        organizations: [
          orgStats({
            name: 'acme',
            awaiting_approval: 1,
            pending_workflow_approvals: 1,
            errored_workspaces: 1,
            errored_job_templates: 1,
            failed_inventory_syncs: 1,
            recent_run_failures: 1,
            recent_job_failures: 1,
            runners_offline: 1,
            runners_total: 2,
            open_change_requests: 1,
          }),
        ],
      }),
    );
    // Terraform and Ansible interleave: the order says how urgent, not which half of the product.
    expect(items.map(item => item.kind)).toEqual([
      'awaiting_approval',
      'pending_workflow_approvals',
      'errored_workspaces',
      'errored_job_templates',
      'failed_inventory_syncs',
      'runners_offline',
      'recent_run_failures',
      'recent_job_failures',
      'open_change_requests',
    ]);
  });

  it('covers Ansible, not only Terraform', () => {
    // The first cut reported workspaces, runs and change requests and nothing else, so an estate
    // whose Ansible half was on fire looked healthy.
    const ansibleOnly = attentionItems(
      dashboardStats({
        organizations: [
          orgStats({
            name: 'acme',
            pending_workflow_approvals: 2,
            errored_job_templates: 1,
            failed_inventory_syncs: 3,
            recent_job_failures: 6,
          }),
        ],
      }),
    );
    expect(ansibleOnly.map(item => item.kind)).toEqual([
      'pending_workflow_approvals',
      'errored_job_templates',
      'failed_inventory_syncs',
      'recent_job_failures',
    ]);
    // Each names Ansible or the resource it is about, and links to an Ansible page.
    for (const item of ansibleOnly) {
      expect(item.href).toMatch(/\/ansible\//);
    }
  });

  it('names the platform on a failure row instead of totalling both', () => {
    // "18 executions failed" hides which half of the estate is unhealthy, and the two lead to
    // different pages.
    const items = attentionItems(
      dashboardStats({
        organizations: [orgStats({ name: 'acme', recent_run_failures: 12, recent_job_failures: 6 })],
      }),
    );
    expect(items).toHaveLength(2);
    expect(items[0].label).toContain('Terraform runs failed');
    expect(items[0].href).toBe('/app/acme/usage');
    expect(items[1].label).toContain('Ansible jobs failed');
    expect(items[1].href).toBe('/app/acme/ansible/jobs?status=failed');
  });

  it('orders the same kind by count, then by name, so the list does not reshuffle on refresh', () => {
    const items = attentionItems(
      dashboardStats({
        organizations: [
          orgStats({ id: '1', name: 'zulu', awaiting_approval: 1 }),
          orgStats({ id: '2', name: 'alpha', awaiting_approval: 5 }),
          orgStats({ id: '3', name: 'bravo', awaiting_approval: 1 }),
        ],
      }),
    );
    expect(items.map(item => item.organization)).toEqual(['alpha', 'bravo', 'zulu']);
  });

  it('omits admin-only signals the reader cannot see', () => {
    // The API leaves these absent rather than zero for a member without the permission; a row here
    // would be a claim about something the reader was never told.
    const items = attentionItems(
      dashboardStats({ organizations: [orgStats({ open_change_requests: undefined, runners_offline: undefined })] }),
    );
    expect(items).toEqual([]);
  });

  it('reports the failure window it was given', () => {
    const items = attentionItems(
      dashboardStats({
        recent_failure_window_days: 7,
        organizations: [orgStats({ recent_run_failures: 2 })],
      }),
    );
    expect(items[0].label).toContain('last 7 days');
  });

  it('spans organizations, one row per problem per organization', () => {
    const items = attentionItems(
      dashboardStats({
        organizations: [
          orgStats({ id: '1', name: 'acme', awaiting_approval: 1 }),
          orgStats({ id: '2', name: 'globex', errored_workspaces: 2 }),
        ],
      }),
    );
    expect(items).toHaveLength(2);
    expect(items.map(item => item.organization)).toEqual(['acme', 'globex']);
  });
});
