<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Teams and Organization Members Implementation

## Overview

Implement teams functionality with full Terraform Enterprise (TFE) API compatibility, enabling users to manage teams, team members, and organization memberships. This is a multi-phase implementation that will support both Terraform provider compatibility and our own StackWeaver provider.

## Design Document

See: `docs/architecture/TEAMS_IMPLEMENTATION_PLAN.md`

## Requirements

### Phase 1: Core Teams Model & API ✅ (Current)
- [ ] Create database migrations (teams, team_members, team_project_access, team_workspace_access)
- [ ] Create models (Team, TeamMember, TeamProjectAccess, TeamWorkspaceAccess) - must match TFE structure exactly
- [ ] Create repositories (TeamRepository with all CRUD operations)
- [ ] Create API handlers (basic CRUD for teams)
- [ ] Register routes (TFE-compatible endpoints)
- [ ] Test with `terraform-provider-tfe` to verify compatibility

### Phase 2: Organization Memberships API
- [ ] Create organization memberships handler
- [ ] Expose existing OrganizationMember model via TFE API
- [ ] Implement JSON:API format responses (must match TFE exactly)
- [ ] Test with `terraform-provider-tfe`

### Phase 3: Team Access (Project & Workspace)
- [ ] Create team project access handler
- [ ] Create team workspace access handler
- [ ] Implement project-level team permissions
- [ ] Implement workspace-level team permissions
- [ ] Update RBAC service to check team permissions (project and workspace)
- [ ] Permission resolution logic: Direct membership → Project access → Workspace access
- [ ] Test access controls

### Phase 4: Frontend/UI Implementation
- [ ] Add "Users & Teams" card to Organization Settings page (`/app/:orgName/settings`)
- [ ] Create Users management page (`/app/:orgName/settings/users-teams`)
  - [ ] List all organization members
  - [ ] Add/remove members
  - [ ] Edit member roles (admin, member, viewer)
  - [ ] Based on user's access rights (admin only)
- [ ] Create Teams management page
  - [ ] List all teams
  - [ ] Create/edit/delete teams
  - [ ] Add/remove team members
  - [ ] Manage team access to projects and workspaces
  - [ ] Based on user's access rights (admin only)
- [ ] Integrate with backend API
- [ ] Test UI workflows

### Phase 5: Integration & Testing
- [ ] End-to-end testing with `terraform-provider-tfe`
- [ ] Verify all models match TFE structure exactly
- [ ] Test permission resolution (direct membership, project access, workspace access)
- [ ] Update documentation
- [ ] Performance testing

### Phase 6: OIDC Provider Integration (Future)
- [ ] Verify Zitadel supports external OIDC providers
- [ ] Add UI in Organization Settings for OIDC provider configuration
- [ ] Configure external identity providers via Zitadel
- [ ] Test authentication flow with external providers
- [ ] Document OIDC provider setup

## TFE Compatibility Requirements

Must maintain full compatibility with Terraform Enterprise API:
- Teams API endpoints (GET, POST, PATCH, DELETE)
- Team Members API (relationships/users)
- Organization Memberships API
- Team Workspace Access API
- JSON:API format responses
- All models must match TFE structure exactly

Reference: https://developer.hashicorp.com/terraform/cloud-docs/api-docs/teams

## Acceptance Criteria

- [ ] All Phase 1 tasks completed
- [ ] Teams can be created, read, updated, deleted via API
- [ ] Team members can be added/removed via API
- [ ] Basic TFE provider compatibility verified
- [ ] All tests passing
- [ ] Documentation updated

## Related Documentation

- Design Plan: `docs/architecture/TEAMS_IMPLEMENTATION_PLAN.md`
- Analysis: `docs/architecture/USER_TEAM_GROUP_ANALYSIS.md`
- TFE Teams API: https://developer.hashicorp.com/terraform/cloud-docs/api-docs/teams
- TFE Organization Memberships: https://developer.hashicorp.com/terraform/cloud-docs/api-docs/organization-memberships
- TFE Team Access: https://developer.hashicorp.com/terraform/cloud-docs/api-docs/team-access

