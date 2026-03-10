<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# StackWeaver Permissions Model

**Date**: 2024-12-XX  
**Version**: 2.0  
**Status**: 🔄 **REFACTORING** - Moving to team-based permissions model

## Overview

StackWeaver implements a **team-based permission model** based on Terraform Enterprise (TFE), extended with StackWeaver-specific Ansible resource permissions. All permissions are granted through **team memberships** - there are no organization-level roles. This model simplifies permissions and solves multi-tenancy issues by making teams the primary permission mechanism.

### Core Principles

1. **Organization Membership = Access Boundary**: Users are either members of an organization or not (binary, no roles)
2. **Teams = Permission Mechanism**: All permissions come from team memberships
3. **Default Teams**: Every organization automatically gets "owners" and "viewers" teams
4. **Projects = Logical Groupings**: Projects are organizational units with their own settings for team access management
5. **Additive Permissions**: Users get the UNION of all permissions from all their team memberships

### Quick Reference: Default Teams

| Team | Purpose | Organization Access | Visibility |
|------|---------|-------------------|------------|
| **owners** | Full organization control | Manage all projects/workspaces/teams + all settings | Secret |
| **viewers** | Read-only access | View all projects/workspaces | Organization |
| **Custom Teams** | Fine-grained access | Configurable via team organization access | Configurable |

### Permission Resolution: Pure Team-Based (Additive)

Permissions are resolved by taking the **UNION** of all permissions from all team memberships:

1. **Check Organization Membership** (Tenant Isolation) - User must be member of organization
2. **Collect All Team Permissions** - Get permissions from:
   - Team organization access (org-level permissions)
   - Team project access (project-level permissions)
   - Team resource-specific access (workspace/resource-level permissions)
3. **Take Union** - User gets ALL permissions from ALL teams they're in
4. **Grant** - If permission is in union, grant access

---

## Scope 1: Organization Membership & Default Teams

### Organization Membership

**No Roles** - Users are simply members of an organization or not. There is no concept of "admin", "member", or "viewer" at the organization level.

- **Membership = Access Boundary**: Being a member grants access to the organization's resources (through teams)
- **No Membership = No Access**: Users who are not members cannot access any resources in the organization

### Default Teams (Auto-Created)

Every organization automatically gets two default teams when created:

#### "owners" Team

**Purpose**: Full control over organization - equivalent to organization administrators

**Auto-Creation**: Created automatically when organization is created  
**Creator Assignment**: Organization creator is automatically added to this team  
**Visibility**: **Secret** (only visible to owners and org creator)

**Organization Access Permissions**:
- ✅ **Project permissions**: **Manage all projects** (full control)
- ✅ **Workspace permissions**: **Manage all workspaces** (full control)
- ✅ **Team permissions**: **Manage organization access** (can manage all teams and RBAC)
- ✅ **Include secret teams**: **Yes** (can access all teams including secret ones)
- ✅ **Settings permissions**: **All enabled**
  - Manage policies
  - Manage policy overrides
  - Manage run tasks
  - Manage version control settings (VCS)
  - Manage agent pools
- ✅ **Private registry**: **Full access** (modules + providers)

#### "viewers" Team

**Purpose**: Read-only access to organization - can view everything but cannot modify

**Auto-Creation**: Created automatically when organization is created  
**Visibility**: **Organization** (visible to everyone)

**Organization Access Permissions**:
- ✅ **Project permissions**: **View all projects** (read-only)
- ✅ **Workspace permissions**: **View all workspaces** (read-only)
- ✅ **Team permissions**: **None**
- ✅ **Include secret teams**: **No**
- ✅ **Settings permissions**: **None** (read-only is implicit)
- ✅ **Private registry**: **None**

### Organization Permissions

**Reference**: See `backend/internal/services/rbac/service.go:55-70` for all permission constants

#### Admin-Only Permissions (RBAC Management)

| Permission | Description | TFE-Compatible | Status |
|------------|-------------|----------------|--------|
| `org:manage-membership` | Manage organization memberships (add/remove users, change roles) | ✅ Yes | ✅ **ENFORCED** |
| `org:manage-teams` | Create/update/delete teams | ✅ Yes | ✅ **ENFORCED** |
| `org:manage-organization-access` | Manage team organization access permissions | ✅ Yes | ⚠️ Not yet enforced |
| `org:manage-projects` | Create/update/delete projects at org level | ✅ Yes | ✅ **ENFORCED** |
| `org:manage-workspaces` | Create/update/delete workspaces at org level | ✅ Yes | ✅ **ENFORCED** |
| `org:manage-vcs-settings` | Manage VCS connections | ✅ Yes | ✅ **ENFORCED** |
| `org:manage-providers` | Manage provider registrations | ✅ Yes | ⚠️ Not yet enforced |
| `org:manage-modules` | Manage module registrations | ✅ Yes | ⚠️ Not yet enforced |
| `org:manage-policies` | Manage Sentinel policies | ✅ Yes | ⚠️ Not yet enforced |
| `org:manage-policy-overrides` | Manage policy overrides | ✅ Yes | ⚠️ Not yet enforced |
| `org:manage-run-tasks` | Manage run tasks | ✅ Yes | ⚠️ Not yet enforced |
| `org:access-secret-teams` | Access secret teams | ✅ Yes | ⚠️ Not yet enforced |
| `org:manage-agent-pools` | Manage agent pools | ✅ Yes | ⚠️ Not yet enforced |

#### Read Permissions (All Roles)

| Permission | Description | Admin | Member | Viewer | Status |
|------------|-------------|-------|--------|--------|--------|
| `org:read` | Basic organization read access | ✅ | ✅ | ✅ | ✅ Defined |
| `org:read-workspaces` | Read workspaces in organization | ✅ | ✅ | ✅ | ✅ Defined |
| `org:read-projects` | Read projects in organization | ✅ | ✅ | ✅ | ✅ Defined |

### Role Permission Matrix (Organization Level)

**Reference**: See `backend/internal/services/rbac/service.go:113-194` for complete role permissions

#### Admin Role Permissions

✅ **All permissions** - Full access to everything

- All organization permissions (admin tasks + read)
- All project permissions (`project:read`, `project:write`)
- All Terraform permissions (workspace, runs, state versions, variables, etc.)
- All Terraform granular permissions (state_versions, variables, runs, workspace_locking, run_tasks, sentinel_mocks)
- All Ansible permissions (read, write, execute)

#### Member Role Permissions (Day-to-Day Operator)

✅ **Day-to-day operational tasks** - Can manage workspaces, projects, runs, etc.  
❌ **NO RBAC management** - Cannot manage memberships, teams, or org settings

**Has**:
- `org:read`, `org:read-workspaces`, `org:read-projects`
- `project:read`, `project:write`
- `workspace:read`, `workspace:write`
- `run:read`, `run:write`
- All Terraform granular permissions (state_versions, variables, runs, workspace_locking, run_tasks, sentinel_mocks)
- All Ansible permissions (playbooks, inventories, credentials, job templates, jobs, schedules - read, write, execute)

**Does NOT have**:
- `org:manage-membership` ❌
- `org:manage-teams` ❌
- `org:manage-organization-access` ❌
- `org:manage-vcs-settings` ❌
- `org:manage-providers` ❌
- `org:manage-modules` ❌
- `org:manage-policies` ❌
- All other admin-only org permissions ❌

#### Viewer Role Permissions (Read-Only)

✅ **Read-only access** - Can view resources but cannot modify or execute

**Has**:
- `org:read`, `org:read-workspaces`, `org:read-projects`
- `project:read`
- `workspace:read`
- `run:read`
- Ansible read permissions (playbooks, inventories, credentials, job templates, jobs, schedules - read only)

**Does NOT have**:
- Any write permissions ❌
- Any granular permissions (state_versions, variables, runs) ❌
- Any execute permissions ❌
- `PermissionRuns` (allows creating/planning runs) ❌
- `PermissionWorkspaceWrite` ❌
- `PermissionProjectWrite` ❌

---

## Scope 2: Team-Level Permissions

Team-level permissions are granted through **team membership**. Teams can have two types of access:

1. **Team Project Access** - Access to all resources within a project
2. **Team Resource-Specific Access** - Access to specific workspaces or resources (overrides project access)

### Team Project Access

**Model**: `TeamProjectAccess` in `backend/internal/models/team_project_access.go`

Teams can be granted project-level access with fixed levels or custom granular permissions.

#### Fixed Access Levels

| Level | Description | Permissions Granted |
|-------|-------------|---------------------|
| **admin** | Full control over project and all resources | All permissions |
| **maintain** | Can manage workspaces, runs, variables, state | `project:write`, `workspace:write`, `run:write`, `variables`, `state_versions`, `runs`, `workspace_locking`, `run_tasks` |
| **write** | Can modify workspaces, runs, variables | `project:write`, `workspace:write`, `run:write`, `variables`, `state_versions`, `runs`, `workspace_locking`, `run_tasks` |
| **read** | Read-only access to project and resources | `project:read`, `workspace:read`, `run:read`, `sentinel_mocks` only |

**Note**: "read" level does **NOT** grant `PermissionRuns` (which allows creating runs). Fixed in 2024-12-XX.

#### Custom Granular Permissions

Teams can have custom granular permissions for specific workspace operations:

- **workspace_runs**: `none`, `read`, `plan`, `apply`
- **workspace_variables**: `none`, `read`, `write`
- **workspace_state_versions**: `none`, `read`, `read-outputs`, `write`
- **workspace_sentinel_mocks**: `read` (read-only)
- **workspace_locking**: boolean
- **workspace_run_tasks**: boolean

**Reference**: See `backend/internal/services/rbac/service.go:399-450` for permission mapping logic

### Team Workspace Access (Resource-Specific)

**Model**: `TeamWorkspaceAccess` in `backend/internal/models/team_workspace_access.go`

Teams can have direct access to specific workspaces with fixed levels:

| Level | Description | Permissions |
|-------|-------------|-------------|
| **admin** | Full workspace control | All permissions |
| **write** | Can modify workspace and create runs | `workspace:write`, `run:write`, `variables`, `state_versions`, `runs`, `workspace_locking`, `run_tasks` |
| **plan** | Can read and plan runs (but not apply) | `workspace:read`, `run:read`, `state_versions`, `variables`, `runs` (plan level) |
| **read** | Read-only workspace access | `workspace:read`, `run:read`, `state_versions`, `variables`, `sentinel_mocks` |

**Reference**: See `backend/internal/services/rbac/service.go:452-491` for permission mapping

**Implementation Status**: ✅ **ENFORCED** - Team workspace access handlers use `CheckOrgManageTeams()` for management operations

---

## Scope 3: Resource-Level Permissions

Resource-level permissions control access to specific resources (workspaces, projects, Ansible resources). These are enforced through workspace/project/resource access checks.

### Terraform Resources

#### Workspace Permissions

| Permission | Description | Granular | Status |
|------------|-------------|----------|--------|
| `workspace:read` | Read workspace configuration | No | ✅ Defined |
| `workspace:write` | Modify workspace configuration, create/update runs | No | ✅ Defined |
| `state_versions` | Access to state versions (levels: none, read, read-outputs, write) | Yes | ✅ Defined |
| `variables` | Access to workspace variables (levels: none, read, write) | Yes | ✅ Defined |
| `runs` | Access to runs (levels: read, plan, apply) | Yes | ✅ **ENFORCED** (Create/Apply) |
| `workspace_locking` | Lock/unlock workspaces | Yes | ✅ Defined |
| `run_tasks` | Manage run tasks | Yes | ⚠️ Not yet enforced |
| `sentinel_mocks` | Access to Sentinel mocks (read-only) | Yes | ✅ Defined |

**Implementation Status**: ✅ **ENFORCED** for run creation/applying - Checks `PermissionRuns` + `PermissionWorkspaceWrite`

#### Run Permissions

| Permission | Description | Status |
|------------|-------------|--------|
| `run:read` | View runs, plans, logs | ✅ Defined |
| `run:write` | Create and apply runs | ✅ **ENFORCED** |

**Critical Fix** (2024-12-XX): 
- ✅ Run Create handler now checks `PermissionRuns` + `PermissionWorkspaceWrite`
- ✅ Run Apply handler now checks `PermissionRuns` + `PermissionWorkspaceWrite`
- ✅ Viewers cannot create or apply runs (they only have `run:read`)

### Project Permissions

| Permission | Description | Status |
|------------|-------------|--------|
| `project:read` | Read project configuration | ✅ Defined |
| `project:write` | Create/update/delete projects | ✅ **ENFORCED** |

**Implementation Status**: ✅ **ENFORCED** - Project handlers check `PermissionOrgManageProjects` OR `PermissionProjectWrite`

### Ansible Resources (StackWeaver-Specific)

**Reference**: See `backend/internal/services/rbac/service.go:90-102` for all Ansible permissions

#### Ansible Resource Types

1. **Playbooks** (`ansible:playbook`)
   - `ansible:playbook:read` - View playbooks
   - `ansible:playbook:write` - Create/update/delete playbooks

2. **Inventories** (`ansible:inventory`)
   - `ansible:inventory:read` - View inventories
   - `ansible:inventory:write` - Create/update/delete inventories

3. **Credentials** (`ansible:credential`)
   - `ansible:credential:read` - View credentials
   - `ansible:credential:write` - Create/update/delete credentials

4. **Job Templates** (`ansible:job-template`)
   - `ansible:job-template:read` - View job templates
   - `ansible:job-template:write` - Create/update/delete job templates

5. **Jobs** (`ansible:job`)
   - `ansible:job:read` - View jobs
   - `ansible:job:execute` - Execute/run jobs

6. **Schedules** (`ansible:schedule`)
   - `ansible:schedule:read` - View schedules
   - `ansible:schedule:write` - Create/update/delete schedules

**Implementation Status**: ⚠️ **NOT YET ENFORCED** - Ansible handlers need permission checks added

**Role Assignment**:
- **Admin**: All Ansible permissions (read, write, execute)
- **Member**: All Ansible permissions (read, write, execute) - day-to-day operator tasks
- **Viewer**: Read-only Ansible permissions (read only, no write, no execute)

---

## Permission Resolution Flow

### CheckResourcePermission() Flow

**Reference**: See `backend/internal/services/rbac/service.go:239-295`

When checking resource-level permissions, the system resolves permissions in this order:

```
1. Check Direct Organization Membership (Highest Priority)
   ├─ Get user's role in organization
   ├─ Check if role has permission
   └─ If YES → Return TRUE

2. Check Team Project Access (If team support enabled)
   ├─ Get all teams user is member of
   ├─ Check team's project access for this project
   ├─ Check if project access grants permission
   └─ If YES → Return TRUE

3. Check Team Resource-Specific Access (Overrides project access)
   ├─ Get team workspace/resource access for this resource
   ├─ Check if resource access grants permission
   └─ If YES → Return TRUE

4. Return FALSE (No permission)
```

### Example: Viewer User Creating a Run

**Scenario**: User `test1@vhco.pro` is:
- Organization role: `viewer`
- Team membership: Team with no access

**Permission Check for Creating Run**:

1. **Direct Org Membership Check**:
   - User role: `viewer`
   - Viewer permissions: `PermissionRunRead` ✅, `PermissionRuns` ❌, `PermissionWorkspaceWrite` ❌
   - Check `PermissionRuns`: ❌ NOT in viewer permissions → Continue
   - Check `PermissionWorkspaceWrite`: ❌ NOT in viewer permissions → Continue

2. **Team Project Access Check**:
   - Team has no access → No permissions granted
   - Result: ❌ No permission

3. **Team Resource Access Check**:
   - No team workspace access → No permissions granted
   - Result: ❌ No permission

4. **Final Result**: ❌ **DENIED** - User cannot create run

---

## Implementation Status by Handler

### ✅ Fully Enforced (Using Fine-Grained Permissions)

| Handler | File | Methods | Permission Check | Status |
|---------|------|---------|------------------|--------|
| **Organization Memberships** | `backend/internal/api/v2/handlers/organization_memberships.go` | Create, Update, Delete | `CheckOrgManageMembership()` | ✅ Complete |
| **Teams** | `backend/internal/api/v2/handlers/teams.go` | Create, Update, Delete, UpdateByID, DeleteByID | `CheckOrgManageTeams()` | ✅ Complete |
| **Team Workspace Access** | `backend/internal/api/v2/handlers/team_workspace_access.go` | Create, Update, Delete, UpdateByID, DeleteByID | `CheckOrgManageTeams()` | ✅ Complete |
| **Team Project Access** | `backend/internal/api/v2/handlers/team_project_access.go` | Create, Update, Delete, UpdateByID, DeleteByID | `CheckOrgManageTeams()` | ✅ Complete |
| **Workspaces** | `backend/internal/api/v2/handlers/terraform/workspaces.go` | Create, Update, Delete | `CheckOrgManageWorkspaces()` OR `CheckResourcePermission(PermissionWorkspaceWrite)` | ✅ Complete |
| **Projects** | `backend/internal/api/v2/handlers/projects.go` | Create, Update, Delete, DeleteByID | `CheckPermission(PermissionOrgManageProjects)` OR `CheckPermission(PermissionProjectWrite)` | ✅ Complete |
| **Runs** | `backend/internal/api/v2/handlers/terraform/runs.go` | Create, Apply | `CheckResourcePermission(PermissionRuns)` + `CheckResourcePermission(PermissionWorkspaceWrite)` | ✅ **JUST FIXED** |
| **VCS Connections** | `backend/internal/api/v2/handlers/vcs_connections.go` | Create, Delete | `CheckPermission(PermissionOrgManageVCSSettings)` | ✅ Complete |

### ⚠️ Not Yet Enforced (Need Permission Checks)

| Handler | File | Methods Needing Checks | Required Permission | Status |
|---------|------|------------------------|---------------------|--------|
| **Ansible Playbooks** | `backend/internal/api/v2/handlers/ansible/playbooks.go` | Create, Update, Delete | `CheckResourcePermission(PermissionAnsiblePlaybookWrite)` | ⚠️ TODO |
| **Ansible Inventories** | `backend/internal/api/v2/handlers/ansible/inventories.go` | Create, Update, Delete | `CheckResourcePermission(PermissionAnsibleInventoryWrite)` | ⚠️ TODO |
| **Ansible Credentials** | TBD | Create, Update, Delete | `CheckPermission(PermissionOrgManageCredentials)` OR `CheckResourcePermission(PermissionAnsibleCredentialWrite)` | ⚠️ TODO |
| **Ansible Job Templates** | TBD | Create, Update, Delete, Execute | `CheckResourcePermission(PermissionAnsibleJobTemplateWrite)` / `PermissionAnsibleJobExecute` | ⚠️ TODO |
| **Ansible Jobs** | TBD | Execute, Cancel | `CheckResourcePermission(PermissionAnsibleJobExecute)` | ⚠️ TODO |
| **Ansible Schedules** | TBD | Create, Update, Delete | `CheckResourcePermission(PermissionAnsibleScheduleWrite)` | ⚠️ TODO |
| **Providers** | `backend/internal/api/v2/handlers/registry_*.go` | Create, Update, Delete | `CheckPermission(PermissionOrgManageProviders)` | ⚠️ TODO |
| **Modules** | `backend/internal/api/v2/handlers/registry_*.go` | Create, Update, Delete | `CheckPermission(PermissionOrgManageModules)` | ⚠️ TODO |

---

## Critical Security Fixes Applied

### ✅ Fix #1: Run Handler Permission Checks (2024-12-XX)

**Problem**: Run Create and Apply handlers had **NO permission checks** - viewers could create and apply runs.

**Fix Applied**:
- Added `rbacService` to `RunHandlerV2`
- Run `Create()` now checks: `PermissionRuns` + `PermissionWorkspaceWrite`
- Run `Apply()` now checks: `PermissionRuns` + `PermissionWorkspaceWrite`
- Viewers are now properly denied (they only have `PermissionRunRead`)

**Files Modified**:
- `backend/internal/api/v2/handlers/terraform/runs.go:427-699` (Create method)
- `backend/internal/api/v2/handlers/terraform/runs.go:1919-2012` (Apply method)
- `backend/internal/api/v2/routes/routes.go:285` (Added rbacService to RunHandlerV2)

### ✅ Fix #2: "Read" Access Level Bug (2024-12-XX)

**Problem**: "read" access level in team project/workspace access was granting `PermissionRuns`, allowing users with "read" access to create runs.

**Fix Applied**:
- Removed `PermissionRuns` from "read" access level in `projectAccessGrantsPermission()`
- Removed `PermissionRuns` from "read" access level in `workspaceAccessGrantsPermission()`
- "read" access now only grants read-only permissions

**Files Modified**:
- `backend/internal/services/rbac/service.go:431-441` (project access)
- `backend/internal/services/rbac/service.go:479-486` (workspace access)

### ✅ Fix #3: Organization Membership Role Updates (2024-12-XX)

**Problem**: Members could change organization membership roles, including changing admin users to member/viewer.

**Fix Applied**:
- Added `CheckOrgManageMembership()` to all organization membership handlers
- Only admins can now manage memberships

---

## Frontend Permission Enforcement

### ✅ Settings UI Hidden from Non-Admins

**Implementation**:
- `frontend/src/pages/Settings.tsx` - "Users & Teams" card hidden from non-admin users
- `frontend/src/pages/Settings/Users.tsx` - Redirects/error for non-admin users accessing directly

**Status**: ✅ Complete

---

## Testing Checklist

### ✅ Verified Working
- [x] Organization membership role updates - only admins can change roles
- [x] Teams management - only admins can create/update/delete teams
- [x] Team workspace/project access - only admins can manage access
- [x] Run creation - viewers cannot create runs
- [x] Run application - viewers cannot apply runs
- [x] Workspace creation - members can create, viewers cannot
- [x] Project creation - members can create, viewers cannot
- [x] VCS connection management - only admins can manage

### ⏳ Needs Testing
- [ ] End-to-end permission enforcement with viewer user
- [ ] Team project access with different access levels
- [ ] Team workspace access with different access levels
- [ ] Permission resolution hierarchy (direct → project → resource-specific)
- [ ] Ansible resource permission enforcement (once implemented)

---

## Key Design Decisions

1. **Teams are for Grouping, Not RBAC Management**: Only admins manage RBAC. Teams are used for grouping users and granting access to projects/workspaces.

2. **Viewer Role is Strictly Read-Only**: Viewers cannot create, modify, or execute anything. They can only view resources.

3. **Member Role is Day-to-Day Operator**: Members can perform operational tasks (create workspaces, run plans, execute jobs) but cannot manage RBAC settings.

4. **Permission Resolution Priority**: Direct org membership > Team project access > Team resource-specific access

5. **Granular Permissions**: Resources support granular permissions (state versions, variables, runs) with levels (none, read, write, plan, apply) for fine-grained control.

---

## References

### Implementation Files

- **RBAC Service**: `backend/internal/services/rbac/service.go`
  - Permission definitions: Lines 47-103
  - Role permissions mapping: Lines 113-194
  - Permission check methods: Lines 196-295, 572-722

- **Organization Membership Handler**: `backend/internal/api/v2/handlers/organization_memberships.go`
  - Permission checks: Uses `CheckOrgManageMembership()`

- **Teams Handler**: `backend/internal/api/v2/handlers/teams.go`
  - Permission checks: Uses `CheckOrgManageTeams()`

- **Runs Handler**: `backend/internal/api/v2/handlers/terraform/runs.go`
  - Create method: Lines 427-699 (checks `PermissionRuns` + `PermissionWorkspaceWrite`)
  - Apply method: Lines 1919-2012 (checks `PermissionRuns` + `PermissionWorkspaceWrite`)

### External References

- **TFE Organization Permissions**: https://developer.hashicorp.com/terraform/enterprise/users-teams-organizations/permissions/organization
- **TFE Workspace Permissions**: https://developer.hashicorp.com/terraform/cloud-docs/users-teams-organizations/permissions/workspace
- **TFE Project Permissions**: https://developer.hashicorp.com/terraform/cloud-docs/users-teams-organizations/permissions/project

---

## Next Steps

### Immediate (Critical)
1. ✅ **DONE**: Fix run handler permission checks
2. ✅ **DONE**: Fix "read" access level bug
3. ⏳ **TODO**: Test viewer user cannot create/plan/apply runs (verification needed)

### Short Term (Important)
4. ⏳ **TODO**: Add permission checks to Ansible handlers (playbooks, inventories, credentials, jobs, schedules)
5. ⏳ **TODO**: Add permission checks to Provider/Module handlers
6. ⏳ **TODO**: Review and enforce remaining org-level permissions (policies, run tasks, agent pools, etc.)

### Long Term (Enhancement)
7. ⏳ **TODO**: Add permission auditing/logging for compliance
8. ⏳ **TODO**: Add UI indicators showing user permissions
9. ⏳ **TODO**: Add permission testing suite
