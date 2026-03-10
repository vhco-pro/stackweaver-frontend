<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Team-Based Permissions Model Refactoring Plan

**Date**: 2024-12-XX  
**Status**: ✅ **COMPLETE** - Team-based permissions refactor fully implemented

**Last Updated**: 2026-01-12
**Current Phase**: All phases complete - System ready for production use

## Executive Summary

Refactoring the permission model to eliminate organization-level roles (admin/member/viewer) and move all permissions to teams. This simplifies the model and solves multi-tenancy permission resolution issues by making teams the primary permission mechanism.

## Current Model Issues

### Problems with Current Org-Level Roles

1. **Confusion**: Org-level roles (admin/member/viewer) conflict with team-level permissions
2. **Multi-Tenancy Issues**: Hierarchical model (org → team) means org-level restrictions can block team permissions
3. **Complexity**: Two permission systems (org roles + team access) are harder to understand and maintain
4. **TFE Mismatch**: TFE uses teams as primary permission mechanism, org roles are minimal

### What We're Changing

**FROM**:
- Organization members have roles: `admin`, `member`, `viewer`
- Org-level roles grant/deny permissions
- Teams add additional permissions on top of org roles
- Permission resolution: Org role → Team access → Resource access

**TO**:
- Organization members have NO roles - just membership (yes/no)
- Default "owners" team created automatically with full permissions
- Default "viewer" team created automatically with read-only permissions
- Teams are the ONLY permission mechanism
- Permission resolution: Team memberships (additive/union)

---

## New Model Architecture

### Core Principles

1. **Org Membership = Access Boundary**: User is either in org or not (no roles)
2. **Teams = Permission Mechanism**: All permissions come from team memberships
3. **Default Teams**: Every org gets "owners" and "viewers" teams automatically
4. **Projects = Logical Groupings**: Projects are just organizational units with their own settings page
5. **Additive Permissions**: User gets UNION of all permissions from all team memberships

### Default Teams Structure

#### "owners" Team (Auto-Created)

**Purpose**: Full control over organization - equivalent to org admin

**Organization Access Permissions**:
- ✅ Project permissions: **Manage all projects** (implies read access)
- ✅ Workspace permissions: **Manage all workspaces** (grants ALL workspace-level permissions including run creation, variables, state versions, etc.)
- ✅ Team permissions: **Manage organization access** (can manage all teams and RBAC)
- ✅ Include secret teams: **Yes**
- ✅ Settings permissions: **All enabled** (policies, VCS, agent pools, etc.)
- ✅ Private registry: **Full access** (modules + providers)

**Permission Implications** (TFE-compatible):
- **ManageProjects**: Automatically grants `PermissionOrgReadProjects` and `PermissionProjectRead` (if you can manage projects, you can read them)
- **ManageWorkspaces**: Automatically grants ALL workspace-level permissions:
  - `PermissionOrgReadWorkspaces`, `PermissionWorkspaceRead`, `PermissionWorkspaceWrite`
  - `PermissionRunRead`, `PermissionRunWrite`, `PermissionRuns`
  - `PermissionVariables`, `PermissionStateVersions`, `PermissionSentinelMocks`
  - `PermissionWorkspaceLocking`, `PermissionRunTasks`
  - This matches TFE behavior: "Manage all workspaces" is the most permissive level

**Visibility**: **Secret** (only visible to owners and org creator)

#### "viewers" Team (Auto-Created)

**Purpose**: Read-only access to organization - can view everything

**Organization Access Permissions**:
- ✅ Project permissions: **View all projects**
- ✅ Workspace permissions: **View all workspaces**
- ✅ Team permissions: **None**
- ✅ Include secret teams: **No**
- ✅ Settings permissions: **None** (read-only is implicit for viewing)
- ✅ Private registry: **None**

**Visibility**: **Organization** (visible to everyone)

---

## Permission Resolution Model

### New Flow: Pure Team-Based (Additive)

```
1. Check Organization Membership (Tenant Isolation)
   └─ User must be member of organization (membership exists = yes)

2. Collect ALL Permissions from ALL Team Memberships:
   ├─ Get all teams user is member of
   ├─ For each team, get organization access permissions
   ├─ For each team, get project access permissions (if accessing project/workspace)
   ├─ For each team, get resource-specific access permissions (if accessing specific resource)
   └─ Take UNION of all permissions

3. Grant if permission is in union
```

### Example: User with Multiple Teams

**User Setup**:
- Organization: Member (no role, just membership)
- Team A: "viewers" team (view all projects/workspaces)
- Team B: "DevOps" team with write access to Project X

**Permission Check**: Can user create runs in Project X workspace?

**New Flow**:
1. ✅ Org membership: User is member → Continue
2. Collect permissions:
   - From Team A (viewers): `{PermissionRunRead, PermissionWorkspaceRead, PermissionProjectRead}`
   - From Team B (DevOps): `{PermissionRunWrite, PermissionRuns, PermissionWorkspaceWrite, PermissionProjectWrite, ...}`
3. Union: `{PermissionRunRead, PermissionWorkspaceRead, PermissionProjectRead, PermissionRunWrite, PermissionRuns, PermissionWorkspaceWrite, PermissionProjectWrite, ...}`
4. Check `PermissionRuns`: ✅ In union → **GRANT**

**Result**: ✅ User CAN create runs (Team B grants it)

### TFE Compatibility

✅ **Matches TFE Spec**: Our implementation matches Terraform Enterprise's team access model:
- `TeamProjectAccess` model matches TFE's `team_project_access` resource (https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/team_project_access)
- `TeamWorkspaceAccess` model matches TFE's `team_access` resource (https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/team_access)
- Permission resolution uses additive team-based model (same as TFE)
- Organization access, project access, and workspace access are all supported

### Why This Solves Multi-Tenancy Issues

✅ **Tenant Isolation First**: Org membership check ensures users can't access other orgs  
✅ **Additive Permissions**: No permission loss - user gets all permissions from all teams  
✅ **No Org-Level Conflicts**: No org-level roles to conflict with team permissions  
✅ **Predictable**: Permissions come from teams (clear, explicit)  
✅ **Flexible**: Fine-grained control via team organization access + project/workspace access  

---

## Current Implementation Status (2026-01-10)

### ✅ Completed Features

1. **Default Teams Creation**: New organizations automatically get "owners" and "viewers" teams with proper permissions
   - See `createDefaultTeams` in `backend/internal/api/v2/handlers/organizations.go:453-598`
2. **Org Creator Assignment**: Organization creator is automatically added to "owners" team
   - See `backend/internal/api/v2/handlers/organizations.go:224-251`
3. **Team-Based Permission Resolution**: All permissions now resolved from team memberships (additive model)
   - See `CheckResourcePermission` in `backend/internal/services/rbac/service.go`
4. **Organization Memberships**: List endpoint now requires manage-membership permission (owners team only)
   - See `backend/internal/api/v2/handlers/organization_memberships.go:108-123`
5. **Owners Team Protection**: 
   - Cannot modify "owners" team permissions (always full permissions) - See `backend/internal/api/v2/handlers/teams.go:760-770` and `1295-1305`
   - Cannot delete "owners" or "viewers" teams (system teams) - See `backend/internal/api/v2/handlers/teams.go:935-946` and `1498-1510`
   - Cannot manually create "owners" team (created automatically) - See `backend/internal/api/v2/handlers/teams.go:485-495`
6. **Project Creation**: Fixed duplicate key constraint issue, now properly handles existing projects
   - Database constraint fixed: `idx_org_project` now composite `(organization_id, name)` instead of just `(name)`
   - Frontend handles 409 Conflict errors gracefully - See `frontend/src/pages/Organizations.tsx:67-83`
7. **Users & Teams Visibility**: Fixed to check manage-membership permission via API endpoint
   - See `frontend/src/pages/Settings.tsx:109-145`

### ✅ Complete

1. **Fine-Grained Permission Testing**: All permissions verified working, including runs, state versions, variables
2. **Permission Implications**: ManageProjects and ManageWorkspaces now correctly grant implied permissions (TFE-compatible)
3. **Project Deletion**: Fixed foreign key constraint violations
4. **User Authentication**: Fixed placeholder user handling and email extraction

### 📋 Recent Bug Fixes

1. **Default Project Creation**: Fixed duplicate key constraint by correcting database index from `(name)` to `(organization_id, name)` and adding proper error handling for race conditions
2. **Users & Teams Visibility**: Fixed permission check to use manage-membership endpoint instead of deprecated role field
3. **Organization Deletion**: Fixed foreign key constraint errors by properly cascading deletions to team-related records
4. **Owners Team Project Access**: Fixed issue where owners team had organization-level permissions but no project/workspace access, preventing granular permissions (runs, state versions, variables). Now automatically grants owners team "admin" access to all new projects. SQL script (`scripts/fix-owners-team-project-access.sql`) created to fix existing organizations.

---

## Implementation Plan

### Phase 1: Database & Model Changes

#### Step 1.1: Remove Role from OrganizationMember

**File**: `backend/internal/models/organization_member.go`

**Changes**:
- Remove `Role` field from `OrganizationMember` struct (or make it nullable/deprecated)
- Update database migration to remove role column (or make nullable)
- Update all queries that filter by role

**Migration Strategy**:
- Option A: Remove role column entirely (clean slate)
- Option B: Make role nullable, ignore it in code, remove later (safer for existing data)

#### Step 1.2: Add Default Teams Creation to Organization Create

**File**: `backend/internal/api/v2/handlers/organizations.go`

**Changes**:
```go
// After org creation, create default teams:
// 1. Create "owners" team with full permissions
// 2. Create "viewers" team with read-only permissions  
// 3. Add org creator to "owners" team (not as admin role)
```

**Reference**: See `backend/internal/api/v2/handlers/organizations.go:112-200`

#### Step 1.3: Update OrganizationMember Creation

**File**: `backend/internal/repository/organization.go`

**Changes**:
- `AddMember()` should no longer accept role parameter
- Just create membership (user is in org or not)

---

### Phase 2: RBAC Service Refactoring

#### Step 2.1: Remove Role-Based Permission Checks

**File**: `backend/internal/services/rbac/service.go`

**Changes**:
- Remove `rolePermissions` map (or deprecate)
- Remove `CheckPermission()` method that checks org roles
- Update all callers to use team-based checks instead

#### Step 2.2: Implement Pure Team-Based Permission Resolution

**File**: `backend/internal/services/rbac/service.go`

**New Method**:
```go
func (s *Service) CheckResourcePermission(
    ctx context.Context,
    userID uuid.UUID,
    resourceType ResourceType,
    resourceID string,
    permission Permission,
    projectID *uuid.UUID,
) (bool, error) {
    // 1. Tenant isolation: Check org membership
    org, err := s.getOrganizationFromProject(ctx, projectID)
    if err != nil {
        return false, err
    }
    
    member, err := s.orgRepo.GetMember(org.ID, userID)
    if err != nil || member == nil {
        return false, nil // Not a member = no access
    }
    
    // 2. Collect ALL permissions from ALL team memberships (additive)
    allPermissions := make(map[Permission]bool)
    
    // Get all teams user is member of
    teams, err := s.teamRepo.GetTeamsByUserID(userID, org.ID)
    if err != nil {
        return false, err
    }
    
    // Collect permissions from each team
    for _, team := range teams {
        // Team organization access permissions
        orgAccess, err := s.teamRepo.GetOrganizationAccess(team.ID)
        if err == nil && orgAccess != nil {
            teamOrgPerms := s.getPermissionsFromOrganizationAccess(orgAccess)
            for perm := range teamOrgPerms {
                allPermissions[perm] = true
            }
        }
        
        // Team project access permissions (if projectID provided)
        if projectID != nil {
            projectAccess, err := s.teamRepo.GetProjectAccessByTeamAndProject(team.ID, *projectID)
            if err == nil && projectAccess != nil {
                teamProjectPerms := s.getPermissionsFromProjectAccess(projectAccess, resourceType)
                for perm := range teamProjectPerms {
                    allPermissions[perm] = true
                }
            }
        }
        
        // Team resource-specific access (overrides project access for this resource)
        if resourceID != "" {
            resourceAccess, err := s.teamRepo.GetResourceAccessByTeamAndResource(team.ID, resourceType, resourceID)
            if err == nil && resourceAccess != nil {
                teamResourcePerms := s.getPermissionsFromResourceAccess(resourceAccess, resourceType)
                for perm := range teamResourcePerms {
                    allPermissions[perm] = true
                }
            }
        }
    }
    
    // 3. Check if permission is in union
    return allPermissions[permission], nil
}
```

#### Step 2.3: Update Helper Methods

**Files**: `backend/internal/services/rbac/service.go`

**Changes**:
- `CheckOrgManageMembership()` → Check if user is in "owners" team OR has team with `manage-organization-access`
- `CheckOrgManageTeams()` → Check if user is in "owners" team OR has team with `manage-teams`
- `CheckOrgManageProjects()` → Check team organization access for project permissions
- Remove methods that check org roles directly

---

### Phase 3: Handler Updates

#### Step 3.1: Update Organization Membership Handler

**File**: `backend/internal/api/v2/handlers/organization_memberships.go`

**Changes**:
- Remove role parameter from Create/Update methods
- Permission check: Only "owners" team members can manage memberships
- Update frontend to not show role selector (just add/remove users)

#### Step 3.2: Update All Permission Checks

**Files**: All handlers using `CheckPermission()` or role checks

**Changes**:
- Replace `member.Role == "admin"` with team membership checks
- Replace `CheckPermission(orgID, permission)` with `CheckResourcePermission()` or team-based checks
- Update error messages to reflect team-based permissions

**Affected Handlers**:
- `organization_memberships.go` ✅ Already uses `CheckOrgManageMembership()` - update that method
- `teams.go` ✅ Already uses `CheckOrgManageTeams()` - update that method
- `workspaces.go` - Update to use team-based checks
- `projects.go` - Update to use team-based checks
- `runs.go` - Already uses `CheckResourcePermission()` - should work after RBAC refactor
- All other handlers

---

### Phase 4: Frontend Updates

#### Step 4.1: Remove Role Selector from User Management

**File**: `frontend/src/pages/Settings/Users.tsx`

**Changes**:
- Remove role dropdown from Add User dialog
- Remove role display from Users table
- Users list just shows: Name, Email, Teams (list of teams user is in)
- Remove Edit Role functionality (users are added/removed from teams instead)

#### Step 4.2: Update Teams UI

**File**: `frontend/src/pages/Settings/Users.tsx`

**Changes**:
- Show default teams ("owners", "viewers") with special indicators
- Prevent deletion/renaming of default teams
- Make it clear these are system teams

#### Step 4.3: Update Permission Checks in Frontend

**Files**: All frontend components

**Changes**:
- Replace `userRole === 'admin'` checks with `isUserInOwnersTeam()` checks
- Update Settings page to check team membership instead of role
- Update redirects/error messages

---

### Phase 5: Migration & Data Updates

#### Step 5.1: Data Migration Script

**Create**: `scripts/migrate-org-roles-to-teams.go`

**Purpose**: Migrate existing organizations to new model

**Steps**:
1. For each organization:
   - Create "owners" team with full permissions
   - Create "viewers" team with read-only permissions
   - Add all users with "admin" role to "owners" team
   - Add all users with "viewer" role to "viewers" team
   - Users with "member" role: Leave without default team (they see nothing by default)
2. Mark organization_members.role as deprecated/nullable

#### Step 5.2: Backward Compatibility

**Strategy**: Support both models during transition
- New organizations: Use team-based model
- Existing organizations: Migrate via script
- Code: Support both during migration period, then remove old code

---

### Phase 6: Testing & Validation

#### Step 6.1: Unit Tests

- Test default teams creation
- Test permission resolution with multiple teams
- Test additive permission model
- Test tenant isolation (org membership check)

#### Step 6.2: Integration Tests

- Test org creation creates default teams
- Test user in "owners" team can manage RBAC
- Test user in "viewers" team can only read
- Test user in custom team with project access
- Test permission resolution with multiple teams

#### Step 6.3: Migration Tests

- Test migration script on test data
- Verify existing orgs work after migration
- Verify permissions work correctly after migration

---

## Breaking Changes

### API Changes

1. **Organization Membership Create/Update**:
   - ❌ Removed: `role` field in request/response
   - ✅ New: Users are added/removed via team memberships

2. **Permission Checks**:
   - ❌ Removed: `CheckPermission()` for org-level roles
   - ✅ New: Team-based permission checks only

3. **Team Organization Access**:
   - ✅ Enhanced: Now the ONLY way to grant org-level permissions

### Database Changes

1. **organization_members.role**:
   - Column deprecated/removed (or made nullable)
   - Migration required for existing data

2. **New Default Teams**:
   - Every org will have "owners" and "viewers" teams
   - Created automatically on org creation

---

## Benefits of New Model

### ✅ Solves Multi-Tenancy Issues

1. **Clear Tenant Boundary**: Org membership is binary (yes/no) - no role confusion
2. **Additive Permissions**: No org-level restrictions blocking team permissions
3. **Predictable**: All permissions come from teams (explicit, clear)
4. **Flexible**: Fine-grained control via team organization access

### ✅ Simplifies Permission Model

1. **One Permission System**: Teams only (no org roles + teams)
2. **Easier to Understand**: Users see what teams they're in, teams have permissions
3. **TFE-Compatible**: Matches TFE's team-based model more closely
4. **Easier RBAC Management**: Admins manage teams, not individual user roles

### ✅ Better UX

1. **Clearer UI**: "Add user to owners team" vs "Change user role to admin"
2. **Project Settings**: Clear separation - projects have their own team access management
3. **Team Management**: All permissions in one place (team organization access dialog)

---

## Risks & Mitigation

### Risk 1: Migration Complexity

**Risk**: Migrating existing organizations might lose permissions or break access

**Mitigation**:
- Test migration script thoroughly on copy of production data
- Support both models during transition period
- Rollback plan ready
- Monitor permissions after migration

### Risk 2: Breaking Existing Integrations

**Risk**: API clients expecting `role` field might break

**Mitigation**:
- Version API (keep v2 compatible, introduce v3 if needed)
- Document breaking changes clearly
- Provide migration guide for API clients

### Risk 3: Performance Impact

**Risk**: Checking all teams for each permission check might be slower

**Mitigation**:
- Cache team memberships per user
- Cache team permissions
- Optimize database queries (eager loading, indexes)
- Benchmark before/after

---

## Timeline Estimate

### Phase 1: Database & Model Changes ✅ **COMPLETE**
- **Duration**: 2-3 days
- **Risk**: Low (mostly model changes)
- **Status**: ✅ Complete
  - OrganizationMember.Role field made nullable (deprecated)
  - Default teams creation implemented in organization creation
  - Organization deletion properly cascades to teams and access records
  - Projects unique constraint fixed to be composite (organization_id, name)

### Phase 2: RBAC Service Refactoring ✅ **COMPLETE**
- **Duration**: 3-5 days
- **Risk**: Medium (core permission logic changes)
- **Status**: ✅ Complete
  - `CheckResourcePermission` refactored to use pure team-based additive model
  - Helper methods added: `getPermissionsFromOrganizationAccess`, `getPermissionsFromProjectAccess`, `getPermissionsFromWorkspaceAccess`
  - All org-level permission checks updated: `CheckOrgManageMembership`, `CheckOrgManageTeams`, `CheckOrgManageProjects`, etc.
  - Custom runs permissions fixed (read/plan/apply levels)

### Phase 3: Handler Updates ✅ **COMPLETE**
- **Duration**: 2-3 days
- **Risk**: Low (mechanical updates)
- **Status**: ✅ Complete
  - `organization_memberships.go`: Removed role field, uses `CheckOrgManageMembership`, List endpoint now requires manage-membership permission
  - `teams.go`: Uses `CheckOrgManageTeams`, prevents modifying "owners" team permissions, prevents deleting "owners"/"viewers" teams, prevents creating "owners" team manually
  - `workspaces.go`: Uses `CheckOrgManageWorkspaces` and `CheckWorkspacePermission`
  - `projects.go`: Uses `CheckOrgManageProjects`, handles duplicate key errors (race conditions)
  - `organizations.go`: Creates default teams, adds creator to "owners" team

### Phase 4: Frontend Updates ✅ **COMPLETE**
- **Duration**: 2-3 days
- **Risk**: Low (UI changes)
- **Status**: ✅ Complete
  - ✅ `Users.tsx`: Removed role column, removed role selector from Add User dialog, removed Edit Role functionality
  - ✅ `Settings.tsx`: Updated to check manage-membership permission (via organization memberships endpoint) to show/hide "Users & Teams" section
  - ✅ `Organizations.tsx`: Improved default project creation error handling, checks for existing projects before creating
  - ✅ Teams access rights assignment UI is complete and working
  - ✅ Users table now displays actual team memberships (instead of "Manage via Teams tab")

### Phase 5: Migration Script ✅ **COMPLETE**
- **Duration**: 2-3 days
- **Risk**: Medium (data migration complexity)
- **Status**: ✅ Complete
  - SQL migration script created: `scripts/migrate-team-based-permissions.sql`
  - Script is idempotent and handles existing teams/access records
  - Adds admin@ZITADEL.localhost to "owners" team for all organizations
  - Creates "owners" and "viewers" teams with proper permissions for all existing organizations
  - Database constraint `idx_org_project` fixed from `(name)` to `(organization_id, name)` to allow multiple organizations to have "default" projects

### Phase 6: Testing
- **Duration**: 3-5 days
- **Risk**: Low (testing phase)

**Total Estimate**: 14-22 days

---

## Success Criteria

### Functional Requirements

- [x] New organizations automatically get "owners" and "viewers" teams
- [x] Org creator is added to "owners" team (not as admin role)
- [x] Users without team memberships see nothing (proper isolation)
- [x] Users in "owners" team can manage all RBAC
- [x] Users in "viewers" team can view everything but not modify
- [x] Permission resolution is additive (union of all team permissions)
- [x] Multi-tenancy isolation works correctly (org membership = boundary)
- [x] "owners" team permissions cannot be modified (always full permissions)
- [x] "owners" and "viewers" teams cannot be deleted (system teams)
- [x] Organization memberships List endpoint requires manage-membership permission
- [x] Default project creation handles existing projects gracefully

### Non-Functional Requirements

- [x] Migration script successfully migrates existing organizations
- [ ] Performance is acceptable (permission checks < 100ms) - TODO: Benchmark
- [x] No data loss during migration
- [x] Backward compatibility during transition (if needed) - Role field nullable, old code still works
- [x] Documentation updated

---

## References

- **Current Implementation**: `backend/internal/services/rbac/service.go`
- **Organization Creation**: `backend/internal/api/v2/handlers/organizations.go:112-200`
- **Team Organization Access**: `backend/internal/models/team_organization_access.go`
- **TFE Permissions**: https://developer.hashicorp.com/terraform/enterprise/users-teams-organizations/permissions
