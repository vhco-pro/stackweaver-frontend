<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# StackWeaver Permissions Model v2.0 - Team-Based Architecture

**Last Updated**: 2026-01-12  
**Version**: 2.0  
**Status**: ✅ **IMPLEMENTED** - Team-based permission model fully implemented

> [!NOTE]
> This document describes the **team-based permission model** that has been implemented. See `docs/architecture/auth/teams/TEAM_BASED_PERMISSIONS_REFACTOR.md` for implementation details.

## Executive Summary

StackWeaver v2.0 uses a **pure team-based permission model** where:
- Organization membership is binary (yes/no) - no roles
- Default "owners" and "viewers" teams are auto-created
- All permissions come from team memberships (additive/union)
- Projects are logical groupings with their own team access settings
- This model solves multi-tenancy permission resolution issues

---

## Architecture Overview

### Current Model (v1.0) - Deprecated

```
Organization Member (has role: admin/member/viewer)
  └─ Role grants org-level permissions
  └─ Teams add additional permissions
```

**Problems**:
- Org-level roles conflict with team permissions
- Hierarchical model (org → team) means org restrictions block teams
- Complex permission resolution logic
- Multi-tenancy issues with permission conflicts

### New Model (v2.0) - Team-Based

```
Organization Member (no role, just membership)
  └─ Teams grant ALL permissions (additive/union)
  └─ Default teams: "owners" (full control), "viewers" (read-only)
  └─ Custom teams: Fine-grained permissions via organization access
```

**Benefits**:
- ✅ Single permission system (teams only)
- ✅ Additive permissions (no conflicts)
- ✅ Clear tenant boundary (org membership)
- ✅ Solves multi-tenancy issues
- ✅ TFE-compatible model

---

## Organization Membership

### Binary Membership Model

**No Roles**: Users are either members of an organization or not. There is no "admin", "member", or "viewer" role at the organization level.

**Membership = Access Boundary**:
- ✅ **Member**: User can access organization resources (through teams)
- ❌ **Not Member**: User cannot access any resources in the organization

**Implementation**:
- `OrganizationMember` model: Remove `Role` field (or make nullable/deprecated)
- API: No role parameter in organization membership create/update
- Database: `organization_members.role` column removed or deprecated

---

## Default Teams

### Auto-Creation

When an organization is created:
1. **"owners" team** is automatically created with full permissions
2. **"viewers" team** is automatically created with read-only permissions
3. **Organization creator** is automatically added to "owners" team

### "owners" Team

**Name**: `owners` (reserved, cannot be renamed/deleted)  
**Visibility**: `secret` (only visible to owners and org creator)  
**Purpose**: Full organization control - equivalent to org administrators

**Organization Access Configuration**:

| Permission Category | Setting | Description |
|---------------------|---------|-------------|
| **Project permissions** | Manage all projects | Full control over all projects |
| **Workspace permissions** | Manage all workspaces | Full control over all workspaces |
| **Team permissions** | Manage organization access | Can manage all teams and RBAC |
| **Include secret teams** | ✅ Enabled | Can access all teams including secret ones |
| **Settings permissions** | ✅ All enabled | Policies, VCS, agent pools, etc. |
| **Private registry** | ✅ Full access | Modules + providers |

**Default Members**: Organization creator (added automatically)

### "viewers" Team

**Name**: `viewers` (reserved, cannot be renamed/deleted)  
**Visibility**: `organization` (visible to everyone)  
**Purpose**: Read-only access to organization

**Organization Access Configuration**:

| Permission Category | Setting | Description |
|---------------------|---------|-------------|
| **Project permissions** | View all projects | Read-only access to all projects |
| **Workspace permissions** | View all workspaces | Read-only access to all workspaces |
| **Team permissions** | None | Cannot manage teams |
| **Include secret teams** | ❌ Disabled | Cannot access secret teams |
| **Settings permissions** | ❌ None | Read-only is implicit |
| **Private registry** | ❌ None | No registry access |

**Default Members**: None (users must be explicitly added)

---

## Team Organization Access

### Permission Structure (TFE-Compatible)

Teams can be granted organization-level permissions via the **Team Organization Access** configuration (UI implemented, see `Users.tsx` Edit Team dialog).

#### Project Permissions (Radio Buttons)

- **None**: No explicit access to projects (permissions may still be granted on individual projects)
- **View all projects**: Can view all projects in the organization
- **Manage all projects**: Can create, edit, delete, and assign team access to all projects

#### Workspace Permissions (Radio Buttons)

- **None**: No explicit access to workspaces (permissions may still be granted on individual workspaces)
- **View all workspaces**: Can view all workspaces in the organization
- **Manage all workspaces**: Can create, edit, delete, and assign team access to all workspaces

#### Team Permissions (Radio Buttons)

- **None**: Cannot manage teams
- **Manage membership**: Can add/remove users from organization and manage team memberships
- **Manage teams**: Can create/delete teams and manage team tokens
- **Manage organization access**: Can manage all teams, permissions, and organization access (similar to org owner)

#### Settings Permissions (Checkboxes)

- **Manage policies**: Create, edit, delete Sentinel policies
- **Manage policy overrides**: Override soft-mandatory policy checks
- **Manage run tasks**: Create, update, delete run tasks
- **Manage version control settings**: Manage VCS providers and SSH keys
- **Manage agent pools**: Create, update, delete agent pools

#### Private Registry Permissions (Parent + Nested Checkboxes)

- **Manage private registry** (parent):
  - **Manage modules**: Publish and delete modules
  - **Manage providers**: Publish and delete providers

#### Other Settings

- **Include secret teams**: Allow access to secret teams
- **Visibility**: Team visibility setting (organization/secret)

---

## Permission Resolution Model

### Additive (Union) Model

**Key Principle**: Users get the **UNION** of all permissions from **ALL** teams they're members of.

### Resolution Flow

```
1. Check Organization Membership (Tenant Isolation)
   └─ User must be member of organization
   └─ If NOT member → DENY (no access)

2. Collect ALL Permissions from ALL Team Memberships
   ├─ Get all teams user is member of in this organization
   ├─ For each team:
   │   ├─ Get team organization access permissions
   │   ├─ Get team project access permissions (if accessing project/workspace)
   │   └─ Get team resource-specific access permissions (if accessing specific resource)
   └─ Take UNION of all permissions

3. Check Permission
   └─ If permission is in union → GRANT
   └─ If permission is NOT in union → DENY
```

### Example: Multiple Team Memberships

**User Setup**:
- Organization: Member (no role, just membership)
- Team A: "viewers" team (view all projects/workspaces)
- Team B: "DevOps" team with write access to Project X

**Permission Check**: Can user create runs in Project X workspace?

**Resolution**:
1. ✅ Org membership: User is member → Continue
2. Collect permissions:
   - From Team A (viewers): `{PermissionRunRead, PermissionWorkspaceRead, PermissionProjectRead}`
   - From Team B (DevOps): `{PermissionRunWrite, PermissionRuns, PermissionWorkspaceWrite, PermissionProjectWrite, ...}`
3. Union: `{PermissionRunRead, PermissionWorkspaceRead, PermissionProjectRead, PermissionRunWrite, PermissionRuns, PermissionWorkspaceWrite, PermissionProjectWrite, ...}`
4. Check `PermissionRuns`: ✅ In union → **GRANT**

**Result**: ✅ User CAN create runs (Team B grants it)

### Why This Solves Multi-Tenancy Issues

✅ **Tenant Isolation First**: Org membership check ensures users can't access other orgs  
✅ **Additive Permissions**: No permission loss - user gets all permissions from all teams  
✅ **No Conflicts**: No org-level roles to conflict with team permissions  
✅ **Predictable**: Permissions come from teams (explicit, clear)  
✅ **Flexible**: Fine-grained control via team organization access + project/workspace access  

---

## Projects: Logical Groupings

### Projects Are NOT Permission Scopes

**Key Principle**: Projects are **logical groupings** for organizing resources, not permission boundaries.

**Projects Provide**:
- ✅ **Logical Organization**: Group related workspaces/resources together
- ✅ **Team Access Management**: Projects have their own settings page where you can assign team access to that specific project
- ✅ **Resource Visibility**: Help users find and organize workspaces

**Projects Do NOT Provide**:
- ❌ **Permission Inheritance**: Projects don't grant permissions (teams do)
- ❌ **Access Control**: Permission checks don't use project membership
- ❌ **Scope Isolation**: Projects are not security boundaries

### Project Settings Page

Projects will have their own settings interface (separate from organization settings) where:
- **Team Access Management**: Assign teams to the project with specific access levels
- **Resource List**: View all workspaces/resources in the project
- **Project Configuration**: Manage project name, description, etc.

This is similar to TFE's project settings page.

---

## Permission Scopes Summary

### Scope 1: Organization Membership
- **Purpose**: Tenant isolation boundary
- **Model**: Binary (member or not)
- **Grants**: Access to organization resources (through teams)

### Scope 2: Team Organization Access
- **Purpose**: Organization-level permissions
- **Model**: Team-based, configured via organization access settings
- **Grants**: Permissions for projects, workspaces, teams, settings, registry

### Scope 3: Team Project Access
- **Purpose**: Project-level permissions (for specific project)
- **Model**: Team-based, assigned at project settings
- **Grants**: Permissions for all workspaces in that project

### Scope 4: Team Resource-Specific Access
- **Purpose**: Resource-level permissions (for specific workspace/resource)
- **Model**: Team-based, assigned at resource level
- **Grants**: Permissions for that specific resource (overrides project access)

---

## Implementation Status

### ✅ Completed (All Phases)

**Team-Based Permissions Model**:
- ✅ Team organization access UI (Edit Team dialog with TFE-style structure)
- ✅ Team project access handlers and models
- ✅ Team workspace access handlers and models
- ✅ Team organization access models
- ✅ Organization-level roles removed (OrganizationMember has no role field)
- ✅ Default teams auto-created on organization creation ("owners" and "viewers")
- ✅ RBAC service refactored to pure team-based resolution (additive/union model)
- ✅ All handlers updated to use team-based permission checks
- ✅ Frontend updated (role selectors removed, default teams shown)

**See**: `docs/architecture/auth/teams/TEAM_BASED_PERMISSIONS_REFACTOR.md` for detailed implementation status

---

## References

- **Implementation Details**: `docs/architecture/auth/teams/TEAM_BASED_PERMISSIONS_REFACTOR.md`
- **Multi-Tenancy Analysis**: `docs/architecture/auth/permissions/MULTI_TENANCY_PERMISSIONS_ANALYSIS.md`
- **Teams Implementation Plan**: `docs/internal/plans/features/teams/TEAMS_IMPLEMENTATION_PLAN.md`
- **Handler RBAC Status**: `docs/architecture/auth/teams/implementation/HANDLER_RBAC_SITREP.md`
- **Auth & RBAC State**: `docs/architecture/auth/AUTH_RBAC_STATE.md`
- **TFE Permissions**: https://developer.hashicorp.com/terraform/enterprise/users-teams-organizations/permissions
