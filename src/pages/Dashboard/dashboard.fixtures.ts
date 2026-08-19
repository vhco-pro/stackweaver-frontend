// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Test-only builders for the dashboard payload. Shared by the onboarding and attention specs so a
// new field on DashboardStats has to be added in exactly one place for both to keep compiling.

import type { DashboardOrgStats, DashboardStats } from '@/api/client';

export function orgStats(overrides: Partial<DashboardOrgStats> = {}): DashboardOrgStats {
  return {
    id: 'org-1',
    name: 'acme',
    projects: 0,
    terraform_workspaces: 0,
    ansible_playbooks: 0,
    active_terraform_runs: 0,
    pending_terraform_runs: 0,
    awaiting_approval: 0,
    pending_workflow_approvals: 0,
    errored_workspaces: 0,
    errored_job_templates: 0,
    failed_inventory_syncs: 0,
    recent_run_failures: 0,
    recent_job_failures: 0,
    active_ansible_jobs: 0,
    completed_terraform_runs_this_month: 0,
    completed_ansible_jobs_this_month: 0,
    ...overrides,
  };
}

export function dashboardStats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    projects: 0,
    terraform_workspaces: 0,
    ansible_playbooks: 0,
    active_terraform_runs: 0,
    pending_terraform_runs: 0,
    awaiting_approval: 0,
    pending_workflow_approvals: 0,
    errored_workspaces: 0,
    errored_job_templates: 0,
    failed_inventory_syncs: 0,
    recent_run_failures: 0,
    recent_job_failures: 0,
    active_ansible_jobs: 0,
    completed_terraform_runs_this_month: 0,
    completed_ansible_jobs_this_month: 0,
    recent_failure_window_days: 14,
    organizations: [],
    ...overrides,
  };
}
