// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { sectionPathForOrg } from './org-navigation';

describe('sectionPathForOrg', () => {
  it('keeps the section the user is reading', () => {
    // The whole point: switching organization used to drop everyone on Workspaces regardless of
    // where they were.
    expect(sectionPathForOrg('/app/acme/usage', 'globex')).toBe('/app/globex/usage');
    expect(sectionPathForOrg('/app/acme/projects', 'globex')).toBe('/app/globex/projects');
    expect(sectionPathForOrg('/app/acme/ansible/jobs', 'globex')).toBe('/app/globex/ansible/jobs');
    expect(sectionPathForOrg('/app/acme/settings/runners', 'globex')).toBe('/app/globex/settings/runners');
  });

  it('drops resource identifiers that belong to the organization being left', () => {
    // A workspace, run, or job exists in one tenant only, so carrying its id across the switch
    // would land on a page the new organization does not have.
    expect(sectionPathForOrg('/app/acme/workspaces/payments-prod/runs/run-1', 'globex')).toBe(
      '/app/globex/workspaces'
    );
    expect(sectionPathForOrg('/app/acme/ansible/jobs/8f2c', 'globex')).toBe('/app/globex/ansible/jobs');
    expect(sectionPathForOrg('/app/acme/settings/runners/r-42', 'globex')).toBe('/app/globex/settings/runners');
    expect(sectionPathForOrg('/app/acme/projects/platform', 'globex')).toBe('/app/globex/projects');
  });

  it('prefers the deepest matching section', () => {
    // `settings/oidc` and `registry/providers` must not collapse to their parents.
    expect(sectionPathForOrg('/app/acme/settings/oidc', 'globex')).toBe('/app/globex/settings/oidc');
    expect(sectionPathForOrg('/app/acme/registry/providers', 'globex')).toBe('/app/globex/registry/providers');
    expect(sectionPathForOrg('/app/acme/registry/providers/aws', 'globex')).toBe(
      '/app/globex/registry/providers'
    );
  });

  it('falls back to workspaces for non-section locations', () => {
    expect(sectionPathForOrg('/dashboard', 'globex')).toBe('/app/globex/workspaces');
    expect(sectionPathForOrg('/organizations', 'globex')).toBe('/app/globex/workspaces');
    // The bare `/app/acme/<workspaceName>/runs/<runId>` route has no static section prefix.
    expect(sectionPathForOrg('/app/acme/payments-prod/runs/run-1', 'globex')).toBe('/app/globex/workspaces');
  });

  it('maps the org-less variants of a section onto the chosen organization', () => {
    expect(sectionPathForOrg('/usage', 'globex')).toBe('/app/globex/usage');
    expect(sectionPathForOrg('/registry', 'globex')).toBe('/app/globex/registry');
  });

  it('does not match a section that is merely a name prefix', () => {
    // "workspaces-archive" is not the workspaces section, so it must not be treated as one.
    expect(sectionPathForOrg('/app/acme/workspaces-archive', 'globex')).toBe('/app/globex/workspaces');
  });
});
