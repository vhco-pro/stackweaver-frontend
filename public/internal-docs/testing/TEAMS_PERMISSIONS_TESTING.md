<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Teams & Permissions Testing Guide

**Issue**: #65 - Comprehensive testing of teams and permissions implementation  
**Date**: 2024-12-XX  
**Status**: Testing in Progress

## Overview

This document provides a structured testing checklist for the teams and permissions implementation. It covers all features that can currently be tested, organized by functional area.

**Important Notes**:

1. **Authentication Behavior**: Permissions are checked dynamically from the database on each request. Changes to permissions/roles take effect immediately on the next request - **no logout/login required**.

2. **Permission Filtering**: Project List endpoint (`GET /api/v2/organizations/:name/projects`) filters projects based on user permissions. Users with organization-level `read-projects` permission see all projects. Users without org-level permission only see projects their teams have access to.

---

## Authentication & Session Behavior

### How Authentication Works

- **JWT Tokens**: Used only for user identification (contains user ID from Zitadel)
- **Permissions**: Checked dynamically from database on each request (not cached in JWT)
- **Session Behavior**: Changes to permissions/roles take effect on the NEXT request
- **Logout Required**: ❌ **NO** - Permission changes are effective immediately

### Testing Authentication Behavior

- [ ] Change user role in backend (admin → member → viewer)
- [ ] Verify permission changes take effect on next API request (no logout needed)
- [ ] Verify JWT token remains valid after permission changes
- [ ] Test that permission changes are reflected immediately in UI (refresh page)

---

## 1. Organization Membership Management

### 1.1 List Organization Members

**Endpoint**: `GET /api/v2/organization-memberships`  
**Handler**: `OrganizationMembershipHandlerV2.List()` - `backend/internal/api/v2/handlers/organization_memberships.go`

- [ ] List all organization memberships (admin user)
- [ ] Verify JSON:API format response
- [ ] Verify user data is included in `included` array
- [ ] Verify role and created-at attributes are present
- [ ] Test pagination (page, per_page)
- [ ] Test filtering: `?filter[email]=user@example.com`
- [ ] Test filtering: `?filter[status]=active`
- [ ] Test filtering: `?filter[status]=invited`
- [ ] Test search: `?q=searchterm` (searches name and email)
- [ ] Test include options: `?include=user,teams`
- [ ] Verify non-admin users cannot list memberships (403 Forbidden)

### 1.2 Create Organization Membership

**Endpoint**: `POST /api/v2/organization-memberships`  
**Handler**: `OrganizationMembershipHandlerV2.Create()` - `backend/internal/api/v2/handlers/organization_memberships.go`

- [ ] Create membership for existing user (by email)
- [ ] Create membership for new user (creates placeholder user)
- [ ] Verify placeholder user has `status="invited"`
- [ ] Verify case-insensitive duplicate email check
- [ ] Test with different roles (admin, member, viewer)
- [ ] Verify admin-only permission check (403 Forbidden for non-admins)
- [ ] Verify JSON:API format response
- [ ] Verify user data in `included` array

### 1.3 Get Organization Membership

**Endpoint**: `GET /api/v2/organization-memberships/:id`  
**Handler**: `OrganizationMembershipHandlerV2.Get()` - `backend/internal/api/v2/handlers/organization_memberships.go`

- [ ] Get membership by ID
- [ ] Verify JSON:API format response
- [ ] Verify user data in `included` array
- [ ] Test with invalid ID (404 Not Found)

### 1.4 Update Organization Membership (Role)

**Endpoint**: `PATCH /api/v2/organization-memberships/:id`  
**Handler**: `OrganizationMembershipHandlerV2.Update()` - `backend/internal/api/v2/handlers/organization_memberships.go`

- [ ] Update role (admin → member → viewer)
- [ ] Verify role change takes effect immediately (no logout needed)
- [ ] Test updating other attributes (if supported)
- [ ] Verify admin-only permission check (403 Forbidden for non-admins)
- [ ] Verify members cannot change admin roles (security test)

### 1.5 Delete Organization Membership

**Endpoint**: `DELETE /api/v2/organization-memberships/:id`  
**Handler**: `OrganizationMembershipHandlerV2.Delete()` - `backend/internal/api/v2/handlers/organization_memberships.go`

- [ ] Remove user from organization
- [ ] Verify user cannot access organization after removal
- [ ] Verify admin-only permission check (403 Forbidden for non-admins)
- [ ] Test with invalid ID (404 Not Found)

---

## 2. Teams Management

### 2.1 List Teams

**Endpoint**: `GET /api/v2/organizations/:name/teams`  
**Handler**: `TeamHandlerV2.List()` - `backend/internal/api/v2/handlers/teams.go`

- [ ] List all teams in organization
- [ ] Verify JSON:API format response
- [ ] Test pagination (page, per_page)
- [ ] Verify team visibility (organization vs secret)
- [ ] Verify member count is included
- [ ] Test filtering by visibility (if supported)

### 2.2 Create Team

**Endpoint**: `POST /api/v2/organizations/:name/teams`  
**Handler**: `TeamHandlerV2.Create()` - `backend/internal/api/v2/handlers/teams.go`

- [ ] Create team with name and visibility
- [ ] Create team with SSO Team ID
- [ ] Create team with "Allow Member Token Management" enabled
- [ ] Verify admin-only permission check (`PermissionOrgManageTeams`)
- [ ] Test duplicate team name (409 Conflict)
- [ ] Verify JSON:API format response

### 2.3 Get Team

**Endpoint**: `GET /api/v2/teams/:id`  
**Handler**: `TeamHandlerV2.GetByID()` - `backend/internal/api/v2/handlers/teams.go`

- [ ] Get team by ID
- [ ] Verify team details (name, visibility, SSO Team ID, etc.)
- [ ] Verify organization access permissions included
- [ ] Test with invalid ID (404 Not Found)

### 2.4 Update Team

**Endpoint**: `PATCH /api/v2/teams/:id`  
**Handler**: `TeamHandlerV2.UpdateByID()` - `backend/internal/api/v2/handlers/teams.go`

- [ ] Update team name
- [ ] Update team visibility (organization ↔ secret)
- [ ] Update SSO Team ID
- [ ] Update "Allow Member Token Management" setting
- [ ] Verify admin-only permission check (`PermissionOrgManageTeams`)
- [ ] Test with invalid ID (404 Not Found)

### 2.5 Delete Team

**Endpoint**: `DELETE /api/v2/teams/:id`  
**Handler**: `TeamHandlerV2.DeleteByID()` - `backend/internal/api/v2/handlers/teams.go`

- [ ] Delete team
- [ ] Verify team access is removed (cascading delete)
- [ ] Verify admin-only permission check (`PermissionOrgManageTeams`)
- [ ] Test with invalid ID (404 Not Found)

---

## 3. Team Members Management

### 3.1 List Team Members

**Endpoint**: `GET /api/v2/teams/:id/relationships/organization-memberships`  
**Handler**: `TeamMembersHandlerV2.ListOrganizationMemberships()` - `backend/internal/api/v2/handlers/team_members.go`

- [ ] List all members of a team
- [ ] Verify JSON:API format response
- [ ] Verify user data in `included` array
- [ ] Test pagination
- [ ] Verify consistent ordering (by ID)

### 3.2 Add Team Member (via Organization Memberships)

**Endpoint**: `POST /api/v2/teams/:id/relationships/organization-memberships`  
**Handler**: `TeamMemberHandlerV2.AddOrganizationMemberships()` - `backend/internal/api/v2/handlers/team_members.go:157`

- [ ] Add organization memberships to team (by organization-membership ID)
- [ ] Verify admin-only permission check (`PermissionOrgManageTeams`)
- [ ] Test duplicate member (handled gracefully)
- [ ] Verify user inherits team permissions immediately
- [ ] Verify JSON:API format request/response

### 3.3 Remove Team Member (via Organization Memberships)

**Endpoint**: `DELETE /api/v2/teams/:id/relationships/organization-memberships`  
**Handler**: `TeamMemberHandlerV2.RemoveOrganizationMemberships()` - `backend/internal/api/v2/handlers/team_members.go:333`

- [ ] Remove organization memberships from team (by organization-membership ID)
- [ ] Verify admin-only permission check (`PermissionOrgManageTeams`)
- [ ] Verify user loses team permissions immediately
- [ ] Test with invalid membership ID (404 Not Found)
- [ ] Verify JSON:API format request/response

**Note**: TFE-compatible endpoints using organization-membership IDs are implemented. Direct user ID endpoints (`/relationships/users`) are not yet implemented.

---

## 4. Team Organization Access

### 4.1 View Team Organization Access

**Location**: Edit Team dialog in UI (`frontend/src/pages/Settings/Users.tsx`)

- [ ] View organization access permissions for team
- [ ] Verify TFE-style structure:
  - Project permissions (radio: None, View all, Manage all)
  - Workspace permissions (radio: None, View all, Manage all)
  - Team permissions (radio: None, Manage membership, Manage teams, Manage organization access)
  - Settings permissions (checkboxes: policies, VCS, agent pools, etc.)
  - Private registry permissions (parent checkbox + nested modules/providers)
  - Visibility section (radio: Visible, Secret)

### 4.2 Update Team Organization Access

**Location**: Edit Team dialog in UI  
**Endpoint**: `PATCH /api/v2/teams/:id` (organization-access relationship)

- [ ] Update project permissions (None → View all → Manage all)
- [ ] Update workspace permissions (None → View all → Manage all)
- [ ] Update team permissions
- [ ] Update settings permissions (checkboxes)
- [ ] Update private registry permissions
- [ ] Verify admin-only permission check (`PermissionOrgManageOrganizationAccess`)
- [ ] Verify changes take effect immediately (no logout needed)

### 4.3 Permission Inheritance Testing

- [ ] Test "View all" projects permission → users can list all projects
- [ ] Test "Manage all" projects permission → users can create/update/delete projects
- [ ] Test "None" projects permission → users only see projects their teams have access to
- [ ] Test workspace permissions inheritance
- [ ] Test team permissions inheritance
- [ ] Test settings permissions inheritance

---

## 5. Team Project Access (Backend API - Terraform Provider)

**Note**: Project/Workspace access UI is deferred to Project Settings page. Backend APIs are complete and working via Terraform provider.

### 5.1 List Team Project Access

**Endpoint**: `GET /api/v2/team-projects`  
**Handler**: `TeamProjectAccessHandlerV2.List()` - `backend/internal/api/v2/handlers/team_project_access.go`

- [ ] List team project access (with optional project filter)
- [ ] Test filtering: `?filter[project][id]=project-id`
- [ ] Verify JSON:API format response
- [ ] Verify access levels (admin, maintain, write, read, custom)

### 5.2 Create Team Project Access

**Endpoint**: `POST /api/v2/team-projects`  
**Handler**: `TeamProjectAccessHandlerV2.Create()` - `backend/internal/api/v2/handlers/team_project_access.go`

- [ ] Create project access with fixed level (admin, maintain, write, read)
- [ ] Create project access with custom permissions
- [ ] Verify custom access requires both project-access and workspace-access blocks
- [ ] Verify admin-only permission check (`PermissionOrgManageTeams`)
- [ ] Test duplicate access (409 Conflict)

### 5.3 Update Team Project Access

**Endpoint**: `PATCH /api/v2/team-projects/:id`  
**Handler**: `TeamProjectAccessHandlerV2.Update()` - `backend/internal/api/v2/handlers/team_project_access.go`

- [ ] Update access level
- [ ] Update custom permissions
- [ ] Verify admin-only permission check (`PermissionOrgManageTeams`)

### 5.4 Delete Team Project Access

**Endpoint**: `DELETE /api/v2/team-projects/:id`  
**Handler**: `TeamProjectAccessHandlerV2.Delete()` - `backend/internal/api/v2/handlers/team_project_access.go`

- [ ] Remove team project access
- [ ] Verify admin-only permission check (`PermissionOrgManageTeams`)
- [ ] Verify users lose project permissions immediately

---

## 6. Team Workspace Access (Backend API - Terraform Provider)

**Note**: Workspace access UI is deferred to Project Settings page. Backend APIs are complete and working via Terraform provider.

### 6.1 List Team Workspace Access

**Endpoint**: `GET /api/v2/team-workspaces`  
**Handler**: `TeamWorkspaceAccessHandlerV2.List()` - `backend/internal/api/v2/handlers/team_workspace_access.go`

- [ ] List team workspace access (with optional workspace filter)
- [ ] Test filtering: `?filter[workspace][id]=workspace-id`
- [ ] Verify JSON:API format response
- [ ] Verify access levels (admin, write, plan, read, custom)

### 6.2 Create Team Workspace Access

**Endpoint**: `POST /api/v2/team-workspaces`  
**Handler**: `TeamWorkspaceAccessHandlerV2.Create()` - `backend/internal/api/v2/handlers/team_workspace_access.go`

- [ ] Create workspace access with fixed level (admin, write, plan, read)
- [ ] Create workspace access with custom permissions
- [ ] Verify custom access requires all 6 permission fields
- [ ] Verify admin-only permission check (`PermissionOrgManageTeams`)
- [ ] Test duplicate access (409 Conflict)

### 6.3 Update Team Workspace Access

**Endpoint**: `PATCH /api/v2/team-workspaces/:id`  
**Handler**: `TeamWorkspaceAccessHandlerV2.Update()` - `backend/internal/api/v2/handlers/team_workspace_access.go`

- [ ] Update access level
- [ ] Update custom permissions
- [ ] Verify admin-only permission check (`PermissionOrgManageTeams`)

### 6.4 Delete Team Workspace Access

**Endpoint**: `DELETE /api/v2/team-workspaces/:id`  
**Handler**: `TeamWorkspaceAccessHandlerV2.Delete()` - `backend/internal/api/v2/handlers/team_workspace_access.go`

- [ ] Remove team workspace access
- [ ] Verify admin-only permission check (`PermissionOrgManageTeams`)
- [ ] Verify users lose workspace permissions immediately

---

## 7. Projects Management

### 7.1 List Projects

**Endpoint**: `GET /api/v2/organizations/:name/projects`  
**Handler**: `ProjectHandlerV2.List()` - `backend/internal/api/v2/handlers/projects.go:92-259`

- [ ] List all projects for organization (if user has org-level `read-projects` permission)
- [ ] List only accessible projects (if user does NOT have org-level permission)
- [ ] Verify users with "View all" projects permission see all projects
- [ ] Verify users with "None" projects permission only see projects their teams have access to
- [ ] Verify users with no team project access see empty list
- [ ] Test pagination (page, per_page)
- [ ] Verify JSON:API format response

**Implementation**: Uses `rbacService.CheckOrgReadProjects()` to check organization-level permission. If user has org-level permission, shows all projects. Otherwise, filters to projects the user's teams have access to.

### 7.2 Get Project

**Endpoint**: `GET /api/v2/projects/:id`  
**Handler**: `ProjectHandlerV2.GetByID()` - `backend/internal/api/v2/handlers/projects.go:189-267`

- [ ] Get project by ID
- [ ] Verify organization membership check (403 Forbidden if not member)
- [ ] Verify JSON:API format response
- [ ] Test with invalid ID (404 Not Found)

### 7.3 Create Project

**Endpoint**: `POST /api/v2/organizations/:name/projects`  
**Handler**: `ProjectHandlerV2.Create()` - `backend/internal/api/v2/handlers/projects.go:271-455`

- [ ] Create project (requires `PermissionOrgManageProjects`)
- [ ] Verify admin-only permission check
- [ ] Verify "owners" team automatically gets admin access
- [ ] Test duplicate name (409 Conflict)
- [ ] Verify JSON:API format response

### 7.4 Update Project

**Endpoint**: `PATCH /api/v2/organizations/:name/projects/:name`  
**Handler**: `ProjectHandlerV2.Update()` - `backend/internal/api/v2/handlers/projects.go:459-618`

- [ ] Update project name
- [ ] Update project description
- [ ] Verify permission check (`PermissionOrgManageProjects`)
- [ ] Test duplicate name (409 Conflict)

### 7.5 Delete Project

**Endpoint**: `DELETE /api/v2/projects/:id`  
**Handler**: `ProjectHandlerV2.DeleteByID()` - `backend/internal/api/v2/handlers/projects.go:727-841`

- [ ] Delete project (requires `PermissionOrgManageProjects` or project-level write)
- [ ] Verify permission check
- [ ] Verify cascading delete of team project access

---

## 8. Workspaces Management

### 8.1 List Workspaces

**Endpoint**: `GET /api/v2/organizations/:name/workspaces`  
**Handler**: `WorkspaceHandlerV2.List()` - `backend/internal/api/v2/handlers/workspaces.go`

- [ ] List all workspaces for organization
- [ ] Verify permission filtering (workspaces user has access to)
- [ ] Test pagination
- [ ] Verify JSON:API format response

### 8.2 Create Workspace

**Endpoint**: `POST /api/v2/organizations/:name/workspaces`  
**Handler**: `WorkspaceHandlerV2.Create()` - `backend/internal/api/v2/handlers/workspaces.go`

- [ ] Create workspace (requires `PermissionOrgManageWorkspaces`)
- [ ] Verify permission check
- [ ] Verify JSON:API format response

### 8.3 Update Workspace

**Endpoint**: `PATCH /api/v2/organizations/:name/workspaces/:name`  
**Handler**: `WorkspaceHandlerV2.Update()` - `backend/internal/api/v2/handlers/workspaces.go`

- [ ] Update workspace (requires `PermissionOrgManageWorkspaces`)
- [ ] Verify permission check

### 8.4 Delete Workspace

**Endpoint**: `DELETE /api/v2/organizations/:name/workspaces/:name`  
**Handler**: `WorkspaceHandlerV2.Delete()` - `backend/internal/api/v2/handlers/workspaces.go`

- [ ] Delete workspace (requires `PermissionOrgManageWorkspaces`)
- [ ] Verify permission check

---

## 9. Permission Resolution Testing

### 9.1 Direct Organization Membership

- [ ] Test admin role permissions (all permissions)
- [ ] Test member role permissions (day-to-day tasks, no admin tasks)
- [ ] Test viewer role permissions (read-only)
- [ ] Verify role changes take effect immediately

### 9.2 Team-Based Permissions

- [ ] Test additive permissions (user in multiple teams)
- [ ] Test organization-level team permissions
- [ ] Test project-level team permissions
- [ ] Test workspace-level team permissions (overrides project)

### 9.3 Permission Hierarchy

- [ ] Verify workspace access overrides project access
- [ ] Verify project access applies to all resources in project
- [ ] Verify organization access applies to all resources in organization
- [ ] Test permission resolution with multiple teams

### 9.4 Granular Terraform Permissions

- [ ] Test state versions permissions (none, read, read-outputs, write)
- [ ] Test variables permissions (none, read, write)
- [ ] Test runs permissions (read, plan, apply)
- [ ] Test workspace locking permission
- [ ] Test run tasks permission
- [ ] Test sentinel mocks permission

---

## 10. Frontend UI Testing

### 10.1 Users & Teams Page

**Location**: `/app/:orgName/settings/users`  
**File**: `frontend/src/pages/Settings/Users.tsx`

- [ ] Verify page is only accessible to admins (403 for non-admins)
- [ ] Verify Users tab displays all organization members
- [ ] Verify Teams tab displays all teams
- [ ] Verify member count displays correctly
- [ ] Verify pending invitation status badge displays
- [ ] Test adding user to organization
- [ ] Test updating user role
- [ ] Test removing user from organization

### 10.2 Edit Team Dialog

**Location**: Teams tab → Edit Team  
**File**: `frontend/src/pages/Settings/Users.tsx`

- [ ] Verify TFE-style organization access structure
- [ ] Test updating team name
- [ ] Test updating team visibility
- [ ] Test updating SSO Team ID
- [ ] Test updating "Allow Member Token Management"
- [ ] Test updating organization access permissions
- [ ] Verify all permissions save correctly
- [ ] Test managing team members (add/remove)

### 10.3 Permission-Based UI Hiding

- [ ] Verify "Users & Teams" settings hidden from non-admins
- [ ] Verify project list filters by permissions correctly
- [ ] Verify workspace list filters by permissions
- [ ] Verify action buttons disabled based on permissions

---

## 11. Terraform Provider Compatibility

### 11.1 Teams Resource

- [ ] Create team via Terraform
- [ ] Read team via Terraform
- [ ] Update team via Terraform
- [ ] Delete team via Terraform
- [ ] Verify all team attributes work (visibility, SSO Team ID, etc.)

### 11.2 Organization Memberships Resource

- [ ] Create membership via Terraform
- [ ] Update membership role via Terraform
- [ ] Delete membership via Terraform

### 11.3 Team Access Resources

- [ ] Create team project access via Terraform
- [ ] Create team workspace access via Terraform
- [ ] Update team access via Terraform
- [ ] Delete team access via Terraform
- [ ] Test custom permissions via Terraform

---

## Implementation Status

All previously identified issues have been resolved:

### ✅ Project List Permission Filtering - **RESOLVED**

**Implementation**: `backend/internal/api/v2/handlers/projects.go:124-241`

- Uses `rbacService.CheckOrgReadProjects()` to check organization-level permission
- Users with org-level `read-projects` permission see all projects
- Users without org-level permission see only projects their teams have access to
- Returns empty list if user has no team project access

### ✅ Team Organization Access Mutual Exclusivity - **RESOLVED**

**Implementation**: `backend/internal/api/v2/handlers/teams.go:71-145` (`updateOrganizationAccessFromRequest`)

- Handles mutual exclusivity for radio button groups
- Automatically clears mutually exclusive fields when one is set
- Applied to `Create()`, `Update()`, and `UpdateByID()` handlers

**Reference**: See `docs/testing/TEAMS_TESTING_ANALYSIS.md` for details.

---

## Testing Checklist Summary

### Backend API Testing
- [ ] Organization Memberships (List, Create, Get, Update, Delete)
- [ ] Teams (List, Create, Get, Update, Delete)
- [ ] Team Members (List, Add, Remove)
- [ ] Team Organization Access (Update via team update)
- [ ] Team Project Access (List, Create, Update, Delete)
- [ ] Team Workspace Access (List, Create, Update, Delete)
- [ ] Projects (List ⚠️, Get, Create, Update, Delete)
- [ ] Workspaces (List, Create, Update, Delete)

### Permission Testing
- [ ] Direct organization membership permissions
- [ ] Team-based permissions (organization, project, workspace)
- [ ] Permission hierarchy (workspace > project > organization)
- [ ] Granular Terraform permissions
- [ ] Permission changes take effect immediately

### Frontend UI Testing
- [ ] Users & Teams page (admin-only)
- [ ] Edit Team dialog (all permissions)
- [ ] Permission-based UI hiding
- [ ] Project list filtering (currently broken)

### Terraform Provider Testing
- [ ] Teams resource
- [ ] Organization memberships resource
- [ ] Team access resources

---

## Test Data Setup

### Recommended Test Users

1. **Admin User**: Full organization access
2. **Member User**: Day-to-day tasks, no admin tasks
3. **Viewer User**: Read-only access
4. **Team Member User**: Access via team permissions only

### Recommended Test Teams

1. **Owners Team**: Auto-created, has all permissions
2. **Test Team 1**: Custom permissions for testing
3. **Test Team 2**: Project-level access only
4. **Test Team 3**: Workspace-level access only

### Recommended Test Scenarios

1. **Organization-Level Permissions**: Test "View all" vs "Manage all" vs "None"
2. **Project-Level Permissions**: Test different access levels (admin, maintain, write, read)
3. **Workspace-Level Permissions**: Test different access levels (admin, write, plan, read)
4. **Permission Overrides**: Test workspace access overriding project access
5. **Multi-Team Scenarios**: Test user in multiple teams with different permissions

---

## References

- **Implementation Plan**: `docs/architecture/auth/teams/TEAMS_IMPLEMENTATION_PLAN.md`
- **Team Access UI**: `docs/architecture/auth/teams/ui/TEAM_ACCESS_UI_IMPLEMENTATION.md`
- **RBAC Service**: `backend/internal/services/rbac/service.go`
- **Project Handler**: `backend/internal/api/v2/handlers/projects.go`
- **Organization Memberships Handler**: `backend/internal/api/v2/handlers/organization_memberships.go`
- **Teams Handler**: `backend/internal/api/v2/handlers/teams.go`
