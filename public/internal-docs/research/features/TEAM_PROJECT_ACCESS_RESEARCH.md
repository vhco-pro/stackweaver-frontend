<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Team Project Access Research

**Date**: 2026-01-05  
**Last Updated**: 2026-01-12  
**Status**: ✅ **IMPLEMENTED** - Phase 2 complete (see `TEAMS_IMPLEMENTATION_PLAN.md`)  
**Related**: `tfe_team_project_access` Terraform resource

> **Note**: This document was created during the research phase for team project access. The implementation is now complete. See `TEAMS_IMPLEMENTATION_PLAN.md` Phase 2 for implementation details.

## Overview

The `tfe_team_project_access` resource associates a team with permissions on a project. Based on the [TFE provider documentation](https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/team_project_access), this resource has a different structure than `tfe_team_access` (workspace access).

## Implementation Status

✅ **COMPLETE** - Team project access API fully implemented

**Model**: `TeamProjectAccess` in `backend/internal/models/team_project_access.go`

**Current Fields**:
- `ID` - UUID primary key
- `TeamID` - Reference to team
- `ProjectID` - Reference to project (UUID)
- `Access` - String field: "read", "write", "maintain", "admin", "custom", or NULL
- Custom permission fields (when `Access` is "custom" or NULL)

**API Endpoints**: ✅ **IMPLEMENTED**
- `GET /api/v2/team-projects`
- `POST /api/v2/team-projects`
- `GET /api/v2/team-projects/:id`
- `PATCH /api/v2/team-projects/:id`
- `DELETE /api/v2/team-projects/:id`

**Handler**: `backend/internal/api/v2/handlers/team_project_access.go`

**Status**: All TFE-compatible endpoints implemented, tested with `terraform-provider-tfe` ✅

## TFE Provider Requirements

Based on [TFE provider documentation](https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/team_project_access):

### Arguments

1. **`team_id`** (Required) - ID of the team
2. **`project_id`** (Required) - ID of the project
3. **`access`** (Required) - Type of fixed access. Valid values:
   - `admin`
   - `maintain` ⚠️ **Different from workspace access (which uses "plan")**
   - `write`
   - `read`
   - `custom` ⚠️ **Different from workspace access (which doesn't have "custom")**

### Custom Access (when `access = "custom"`)

When using `access = "custom"`, you must provide two blocks:

#### 1. `project_access` block

Controls permissions on the project itself:

- `settings` (Default: "read") - "read", "update", or "delete"
- `teams` (Default: "none") - "none", "read", or "manage"
- `variable_sets` (Default: "none") - "none", "read", or "write"

#### 2. `workspace_access` block

Controls permissions on all workspaces within the project:

- `runs` (Default: "read") - "read", "plan", or "apply"
- `sentinel_mocks` (Default: "none") - "none" or "read"
- `state_versions` (Default: "none") - "none", "read-outputs", "read", or "write"
- `variables` (Default: "none") - "none", "read", or "write"
- `create` (Default: false) - Boolean (permission to create workspaces in project)
- `locking` (Default: false) - Boolean (permission to lock/unlock workspaces)
- `delete` (Default: false) - Boolean (permission to delete workspaces)
- `move` (Default: false) - Boolean (permission to move workspaces)
- `run_tasks` (Default: false) - Boolean (permission to manage run tasks)

### Key Differences from Workspace Access

1. **Access Levels**: Project access uses `maintain` instead of `plan` (workspace access uses "plan")
2. **Custom Access**: Project access has `custom` option (workspace access uses either `access` OR `permissions`, not `custom`)
3. **Two Blocks**: Project custom access has `project_access` AND `workspace_access` blocks
4. **Workspace Permissions**: Project access workspace permissions apply to ALL workspaces in the project
5. **Additional Permissions**: Project access has `create`, `delete`, `move` workspace permissions

## Missing Implementation

### 1. Model Updates

**Current**: Simple `Access` string field  
**Required**: Support fixed access levels AND custom access with two permission blocks

**Recommended Structure**:
```go
type TeamProjectAccess struct {
    ID        uuid.UUID
    TeamID    uuid.UUID
    ProjectID uuid.UUID
    
    // Fixed access level
    Access    string  // "admin", "maintain", "write", "read", or "custom"
    
    // Custom project access permissions (if access = "custom")
    ProjectSettings    *string  // nullable, one of: "read", "update", "delete"
    ProjectTeams       *string  // nullable, one of: "none", "read", "manage"
    ProjectVariableSets *string  // nullable, one of: "none", "read", "write"
    
    // Custom workspace access permissions (if access = "custom")
    WorkspaceRuns         *string  // nullable, one of: "read", "plan", "apply"
    WorkspaceSentinelMocks *string  // nullable, one of: "none", "read"
    WorkspaceStateVersions *string  // nullable, one of: "none", "read-outputs", "read", "write"
    WorkspaceVariables     *string  // nullable, one of: "none", "read", "write"
    WorkspaceCreate        *bool    // nullable
    WorkspaceLocking       *bool    // nullable
    WorkspaceDelete        *bool    // nullable
    WorkspaceMove          *bool    // nullable
    WorkspaceRunTasks      *bool    // nullable
}
```

**Alternative**: Could use JSONB column for custom permissions, but separate fields are clearer and easier to query.

### 2. Access Level Values

**Current**: Need to verify current implementation  
**Required**: 
- `"admin"`, `"maintain"`, `"write"`, `"read"`, `"custom"`
- Note: `"maintain"` is different from workspace access `"plan"`

### 3. API Endpoints

**TFE API Endpoints** (from TFE API docs):
- `GET /api/v2/projects/:id/relationships/team-access` - List team access
- `POST /api/v2/projects/:id/relationships/team-access` - Add team access
- `PATCH /api/v2/projects/:id/relationships/team-access/:id` - Update team access
- `DELETE /api/v2/projects/:id/relationships/team-access/:id` - Remove team access

**Response Format**: JSON:API format with team-project-access relationship data

**Reference**: Need to verify exact TFE API format (may differ from workspace access)

### 4. Validation Logic

- `access` is required (unlike workspace access where either `access` OR `permissions` is required)
- If `access = "custom"`, validate that custom permission fields are provided
- If `access != "custom"`, custom permission fields should be null
- Validate enum values for each permission field

## Comparison: Project Access vs Workspace Access

| Feature | Project Access | Workspace Access |
|---------|---------------|------------------|
| Fixed Access Levels | admin, maintain, write, read, custom | admin, read, plan, write |
| Custom Access | `access = "custom"` + two blocks | `access` OR `permissions` (mutually exclusive) |
| Permission Blocks | `project_access` + `workspace_access` | Single `permissions` block |
| Additional Permissions | create, delete, move workspaces | workspace_locking, run_tasks (boolean) |
| Scope | All workspaces in project | Single workspace |

## Implementation Plan

### Phase 1.6: Team Project Access API (NEW PHASE - Should be after Phase 1.5)

**Status**: ⏳ Not started

**Why After Phase 1.5?**
- Similar structure to workspace access, but different
- Can learn from workspace access implementation
- Needed for complete team access support

**Tasks**:

1. **Update Model** (`backend/internal/models/team_project_access.go`)
   - Add fields for custom project access (settings, teams, variable_sets)
   - Add fields for custom workspace access (runs, variables, state_versions, etc.)
   - Add "maintain" and "custom" to access level enum
   - Update validation logic

2. **Update Repository** (`backend/internal/repository/team.go`)
   - Update methods to handle custom permissions
   - Add validation for custom access requirements

3. **Create API Handler** (`backend/internal/api/v2/handlers/team_project_access.go`)
   - Implement CRUD operations
   - Handle both fixed access and custom permissions
   - JSON:API format responses

4. **Register Routes** (`backend/internal/api/v2/routes/routes.go`)
   - `GET /api/v2/projects/:id/relationships/team-access`
   - `POST /api/v2/projects/:id/relationships/team-access`
   - `PATCH /api/v2/projects/:id/relationships/team-access/:id`
   - `DELETE /api/v2/projects/:id/relationships/team-access/:id`

5. **Database Migration**
   - Add new columns for custom permissions
   - Update indexes

6. **Test with Provider**
   - Test fixed access levels (admin, maintain, write, read)
   - Test custom access with both permission blocks
   - Test validation

**Deliverables**:
- ✅ `tfe_team_project_access` resource fully supported
- ✅ Both fixed access and custom permissions work
- ✅ Provider can create, update, delete team project access
- ✅ All TFE API endpoints implemented

## TFE API Reference

**Team Access API**: Need to verify exact TFE API endpoints for project access

**Project Permissions Docs**: https://developer.hashicorp.com/terraform/cloud-docs/users-teams-organizations/permissions/project

**Provider Docs**: https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/team_project_access

## Notes

- Project access permissions apply to ALL workspaces within the project
- Workspace-specific access (from `tfe_team_access`) overrides project-level access
- The `maintain` access level is specific to projects (not used in workspace access)
- Custom access requires both `project_access` and `workspace_access` blocks when `access = "custom"`

---

**Next Steps**: Update TEAMS_IMPLEMENTATION_PLAN.md to clarify Phase 1.5 vs Phase 1.6 vs Phase 3

