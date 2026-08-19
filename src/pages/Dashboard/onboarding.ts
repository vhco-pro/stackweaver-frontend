// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import type { DashboardStats } from '@/api/client';

/** How far through first-run setup the signed-in user is, derived from the cross-org counts. */
export interface OnboardingState {
  hasOrganization: boolean;
  hasProject: boolean;
  hasWorkspace: boolean;
}

export function onboardingState(stats: DashboardStats | undefined): OnboardingState {
  return {
    // Optional chain on a non-optional field on purpose: `stats` is a cast over an untyped JSON:API
    // attributes bag, so the type is a claim about the server, not a guarantee about the payload.
    hasOrganization: (stats?.organizations?.length ?? 0) > 0,
    hasProject: (stats?.projects ?? 0) > 0,
    hasWorkspace: (stats?.terraform_workspaces ?? 0) > 0,
  };
}

/**
 * Whether the estate is still empty enough for the onboarding checklist to be the most useful thing
 * on the page, in which case it replaces the operational sections rather than sitting beside them.
 *
 * The three checks mirror the three steps the checklist offers. An Ansible playbook is deliberately
 * not required: no step here asks for one, and the previous predicate did require it, which left
 * every Terraform-only install permanently in onboarding.
 */
export function shouldShowGettingStarted(state: OnboardingState): boolean {
  return !(state.hasOrganization && state.hasProject && state.hasWorkspace);
}
