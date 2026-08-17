// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Every org-scoped section of the app, as the static path that follows `/app/:orgName/`.
 *
 * This is the set of route patterns in App.tsx that contain no route parameters. Anything deeper is
 * a specific resource - a workspace, a run, a job - which exists in one tenant only, so it cannot
 * survive an organization switch. Add a row here when a new org-scoped section is routed, the same
 * way you would add it to the sidebar; order does not matter, because the longest match wins.
 */
export const ORG_SECTIONS = [
  'workspaces',
  'projects',
  'usage',
  'registry/providers',
  'registry',
  'ansible/inventories',
  'ansible/playbooks',
  'ansible/job-templates',
  'ansible/workflows',
  'ansible/jobs',
  'ansible/schedules',
  'ansible/collections',
  'settings/agent-pools',
  'settings/ansible-config',
  'settings/api-keys',
  'settings/authentication-token',
  'settings/change-requests',
  'settings/credentials',
  'settings/oidc',
  'settings/runners',
  'settings/run-tasks',
  'settings/terraform-versions',
  'settings/users',
  'settings/variable-sets',
  'settings/vcs-connections',
  'settings/webhooks',
  'settings',
];

/**
 * Maps the current location to the equivalent page in another organization.
 *
 * Switching organization means "show me this same thing for that tenant", so the section the user is
 * reading is preserved instead of sending everyone back to Workspaces. The path is truncated to its
 * deepest known section: the remainder names a resource belonging to the organization being left, so
 * carrying `/workspaces/payments-prod/runs/run-1` across a switch would land on a run the new tenant
 * does not have. Falls back to Workspaces when the current location is not an org section at all
 * (the dashboard, the organization list).
 */
export function sectionPathForOrg(pathname: string, orgName: string): string {
  const withinOrg = pathname.match(/^\/app\/[^/]+\/(.*)$/)?.[1] ?? pathname.replace(/^\//, '');
  const section = ORG_SECTIONS.filter(
    candidate => withinOrg === candidate || withinOrg.startsWith(`${candidate}/`)
  ).sort((a, b) => b.length - a.length)[0];
  return `/app/${orgName}/${section ?? 'workspaces'}`;
}
