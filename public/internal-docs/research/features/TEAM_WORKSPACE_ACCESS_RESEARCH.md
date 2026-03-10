<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Team Workspace Access Research

**Date**: 2026-01-05  
**Last Updated**: 2026-01-12  
**Status**: ✅ **IMPLEMENTED** - Phase 1.5 complete (see `TEAMS_IMPLEMENTATION_PLAN.md`)  
**Related**: `tfe_team_access` Terraform resource

> **Note**: This document was created during the research phase for team workspace access. The implementation is now complete. See `TEAMS_IMPLEMENTATION_PLAN.md` Phase 1.5 for implementation details.

## Overview

The `tfe_team_access` resource associates a team with permissions on a workspace. Based on the [TFE provider documentation](https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/team_access), this resource requires more than the original simple `TeamWorkspaceAccess` model supported.

## Implementation Status

✅ **COMPLETE** - Team workspace access API fully implemented

**Model**: `TeamWorkspaceAccess` in `backend/internal/models/team_workspace_access.go`

**Current Fields**:
- `ID` - UUID primary key
- `TeamID` - Reference to team
- `WorkspaceID` - Workspace ID (string)
- `Access` - String field: "read", "plan", "write", "admin", or NULL (for custom permissions)
- Custom permission fields (when `Access` is NULL)

**API Endpoints**: ✅ **IMPLEMENTED**
- `GET /api/v2/team-workspaces`
- `POST /api/v2/team-workspaces`
- `GET /api/v2/team-workspaces/:id`
- `PATCH /api/v2/team-workspaces/:id`
- `DELETE /api/v2/team-workspaces/:id`

**Handler**: `backend/internal/api/v2/handlers/team_workspace_access.go`

**Status**: All TFE-compatible endpoints implemented, tested with `terraform-provider-tfe` ✅

## TFE Provider Requirements

Based on [TFE provider documentation](https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/team_access):

### Arguments

1. **`team_id`** (Required) - ID of the team
2. **`workspace_id`** (Required) - ID of the workspace
3. **`access`** (Optional) - Type of fixed access. Valid values:
   - `admin`
   - `read`
   - `plan` ⚠️ **We don't support this**
   - `write`
   - **Note**: Cannot be used with `permissions` block

4. **`permissions`** (Optional) - Custom permissions block. Fields:
   - `runs` (Required) - "read", "plan", or "apply"
   - `variables` (Required) - "none", "read", or "write"
   - `state_versions` (Required) - "none", "read", "read-outputs", or "write"
   - `sentinel_mocks` (Required) - "none" or "read"
   - `workspace_locking` (Required) - Boolean
   - `run_tasks` (Required) - Boolean

### Key Requirements

1. **Either `access` OR `permissions` must be provided** (not both)
2. **Custom permissions block** - More granular than simple "read/write/admin"
3. **"plan" access level** - Not currently in our model
4. **API Endpoints** - Must implement TFE-compatible endpoints

## Missing Implementation

### 1. Model Updates

**Current**: Simple `Access` string field  
**Required**: Support both fixed access levels AND custom permissions block

**Options**:

**Option A: Extend Current Model** (Recommended)
```go
type TeamWorkspaceAccess struct {
    ID          uuid.UUID
    TeamID      uuid.UUID
    WorkspaceID string
    
    // Fixed access level (if using simple access)
    Access      *string  // nullable, one of: "admin", "read", "plan", "write"
    
    // Custom permissions (if using custom permissions block)
    Runs            *string  // nullable, one of: "read", "plan", "apply"
    Variables       *string  // nullable, one of: "none", "read", "write"
    StateVersions   *string  // nullable, one of: "none", "read", "read-outputs", "write"
    SentinelMocks   *string  // nullable, one of: "none", "read"
    WorkspaceLocking *bool    // nullable
    RunTasks        *bool     // nullable
}
```

**Option B: Separate Model for Custom Permissions**
- Keep `TeamWorkspaceAccess` for fixed access
- Create `TeamWorkspaceCustomPermissions` for custom permissions
- More complex queries, but cleaner separation

**Recommendation**: **Option A** - Store both in same model, use nullable fields. TFE stores this as a single relationship.

### 2. Access Level Values

**Current**: `"read"`, `"write"`, `"admin"`  
**Required**: Add `"plan"` to supported values

### 3. API Endpoints

**TFE API Endpoints** (from TFE API docs):
- `GET /api/v2/workspaces/:id/relationships/team-access` - List team access
- `POST /api/v2/workspaces/:id/relationships/team-access` - Add team access
- `PATCH /api/v2/workspaces/:id/relationships/team-access/:id` - Update team access
- `DELETE /api/v2/workspaces/:id/relationships/team-access/:id` - Remove team access

**Response Format**: JSON:API format with team-access relationship data

**Reference**: https://developer.hashicorp.com/terraform/cloud-docs/api-docs/team-access

### 4. Validation Logic

- Either `access` OR `permissions` block must be provided (not both)
- If `access` provided, set all custom permission fields to null
- If `permissions` block provided, set `access` to null
- Validate enum values for each permission field

## Implementation Plan

### Phase 1.5: Team Workspace Access API (NEW PHASE)

**Status**: ⏳ Not started

**Why Before Phase 2?**
- User wants to test with provider before moving to Phase 2
- `tfe_team_access` is a critical resource for managing workspace permissions
- Should be tested alongside `tfe_team` resource

**Tasks**:

1. **Update Model** (`backend/internal/models/team_workspace_access.go`)
   - Add nullable fields for custom permissions
   - Add "plan" to access level enum
   - Update validation logic

2. **Update Repository** (`backend/internal/repository/team.go`)
   - Update methods to handle custom permissions
   - Add validation for access vs permissions exclusivity

3. **Create API Handler** (`backend/internal/api/v2/handlers/team_workspace_access.go`)
   - Implement CRUD operations
   - Handle both fixed access and custom permissions
   - JSON:API format responses

4. **Register Routes** (`backend/internal/api/v2/routes/routes.go`)
   - `GET /api/v2/workspaces/:id/relationships/team-access`
   - `POST /api/v2/workspaces/:id/relationships/team-access`
   - `PATCH /api/v2/workspaces/:id/relationships/team-access/:id`
   - `DELETE /api/v2/workspaces/:id/relationships/team-access/:id`

5. **Database Migration**
   - Add new columns for custom permissions
   - Make `access` field nullable
   - Add indexes

6. **Test with Provider**
   - Test fixed access levels (read, plan, write, admin)
   - Test custom permissions block
   - Test validation (cannot use both)

**Deliverables**:
- ✅ `tfe_team_access` resource fully supported
- ✅ Both fixed access and custom permissions work
- ✅ Provider can create, update, delete team workspace access
- ✅ All TFE API endpoints implemented

## TFE API Reference

**Team Access API**: https://developer.hashicorp.com/terraform/cloud-docs/api-docs/team-access

**Key Endpoints**:
- List: `GET /api/v2/workspaces/:workspace_id/relationships/team-access`
- Create: `POST /api/v2/workspaces/:workspace_id/relationships/team-access`
- Update: `PATCH /api/v2/workspaces/:workspace_id/relationships/team-access/:id`
- Delete: `DELETE /api/v2/workspaces/:workspace_id/relationships/team-access/:id`

**Response Format**: JSON:API format with `team-access` as relationship type

## Comparison: Current vs Required

| Feature | Current | Required | Status |
|---------|---------|----------|--------|
| Fixed access levels | read, write, admin | read, plan, write, admin | ❌ Missing "plan" |
| Custom permissions | ❌ Not supported | ✅ Required | ❌ Missing |
| API endpoints | ❌ Not implemented | ✅ Required | ❌ Missing |
| Validation (exclusive) | N/A | ✅ Required | ❌ Missing |
| Model structure | Simple Access field | Access OR Permissions | ❌ Needs update |

## Notes

- TFE uses **additive permissions** - highest permission level wins across all scopes
- Custom permissions provide fine-grained control beyond fixed access levels
- The provider expects either `access` OR `permissions`, never both
- Workspace locking and run tasks are boolean permissions (separate from access level)

---

**Next Steps**: Create Phase 1.5 implementation plan and update main TEAMS_IMPLEMENTATION_PLAN.md

