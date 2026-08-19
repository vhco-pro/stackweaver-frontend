// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { dashboardStats, orgStats } from './dashboard.fixtures';
import { onboardingState, shouldShowGettingStarted } from './onboarding';

describe('onboardingState', () => {
  it('reads every step as incomplete before the stats arrive', () => {
    expect(onboardingState(undefined)).toEqual({
      hasOrganization: false,
      hasProject: false,
      hasWorkspace: false,
    });
  });

  it('derives each step from its own count', () => {
    const stats = dashboardStats({
      organizations: [orgStats()],
      projects: 2,
      terraform_workspaces: 0,
    });
    expect(onboardingState(stats)).toEqual({
      hasOrganization: true,
      hasProject: true,
      hasWorkspace: false,
    });
  });
});

describe('shouldShowGettingStarted', () => {
  it('shows the checklist until an organization, a project, and a workspace all exist', () => {
    expect(shouldShowGettingStarted({ hasOrganization: false, hasProject: false, hasWorkspace: false })).toBe(true);
    expect(shouldShowGettingStarted({ hasOrganization: true, hasProject: false, hasWorkspace: false })).toBe(true);
    expect(shouldShowGettingStarted({ hasOrganization: true, hasProject: true, hasWorkspace: false })).toBe(true);
  });

  it('stands down once the three steps are done, with or without any Ansible playbook', () => {
    // The predicate this replaces also required a playbook, which left every Terraform-only install
    // permanently in onboarding with the operational sections hidden.
    expect(shouldShowGettingStarted({ hasOrganization: true, hasProject: true, hasWorkspace: true })).toBe(false);
    expect(
      shouldShowGettingStarted(
        onboardingState(
          dashboardStats({
            organizations: [orgStats()],
            projects: 3,
            terraform_workspaces: 7,
            ansible_playbooks: 0,
          }),
        ),
      ),
    ).toBe(false);
  });
});
