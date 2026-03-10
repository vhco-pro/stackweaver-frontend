<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# TFE Endpoint Compatibility Sitrep

**Date**: 2026-01-07  
**Last Updated**: 2026-01-12  
**Status**: ✅ **RESOLVED** - Team workspace access endpoints implemented

> **Note**: This document describes endpoint compatibility issues that were identified and resolved. The team-workspaces endpoints are now implemented and working. Kept for historical reference.

## Summary

After thorough analysis of `go-tfe` and `terraform-provider-tfe` source code, several critical endpoint mismatches were identified and subsequently fixed.

## Critical Issues (RESOLVED)

### 1. ✅ Team Workspace Access Endpoints - **FIXED**

**What `go-tfe` expects:**
- `GET /api/v2/team-workspaces` (with `filter[workspace][id]` query param)
- `POST /api/v2/team-workspaces`
- `GET /api/v2/team-workspaces/:id`
- `PATCH /api/v2/team-workspaces/:id`
- `DELETE /api/v2/team-workspaces/:id`

**What we have:**
- ✅ `/api/v2/team-workspaces` (all endpoints implemented)

**Status**: ✅ **FIXED** - All endpoints implemented and working

**Reference**: `backend/internal/api/v2/routes/routes.go:177-184`

### 2. ✅ Workspace ReadByID - **FIXED**

**What `go-tfe` expects:**
- `GET /api/v2/workspaces/:id`

**What we have:**
- ✅ `/api/v2/workspaces/:id` (just added)

**Status**: Fixed in this session.

### 3. ✅ Teams ReadByID - **CORRECT**

**What `go-tfe` expects:**
- `GET /api/v2/teams/:id`
- `PATCH /api/v2/teams/:id`
- `DELETE /api/v2/teams/:id`

**What we have:**
- ✅ `/api/v2/teams/:id` (GET, PATCH, DELETE)

**Status**: Correct.

## Team ID Format

**Question**: Does TFE require a specific team ID format like workspaces (`ws-...`)?

**Answer**: **NO** - Teams can use UUIDs.

**Evidence**:
- `go-tfe/team.go:49` - Team struct has `ID string` with no format constraint
- `go-tfe/validations.go:14` - `validStringID` only checks: `^[^/\s]+$` (no `/` or whitespace)
- TFE API docs don't specify a format for team IDs
- UUIDs are acceptable for teams

**Decision**: ✅ **Stick with UUIDs for teams** - This is correct and compatible.

## Required Endpoint Changes

### Add TFE-Compatible Team Workspace Access Endpoints

We need to add `/api/v2/team-workspaces` endpoints that match `go-tfe`'s expectations:

1. **List**: `GET /api/v2/team-workspaces?filter[workspace][id]=ws-...`
   - Returns list of team access entries for a workspace
   - Reference: `go-tfe/team_access.go:166-183`

2. **Create**: `POST /api/v2/team-workspaces`
   - Creates a new team workspace access entry
   - Reference: `go-tfe/team_access.go:186-203`

3. **Read**: `GET /api/v2/team-workspaces/:id`
   - Reads a team access entry by ID
   - Reference: `go-tfe/team_access.go:206-224`

4. **Update**: `PATCH /api/v2/team-workspaces/:id`
   - Updates a team access entry
   - Reference: `go-tfe/team_access.go:227-245`

5. **Delete**: `DELETE /api/v2/team-workspaces/:id`
   - Deletes a team access entry
   - Reference: `go-tfe/team_access.go:248-260`

### Implementation Notes

- The `List` endpoint uses query parameters: `filter[workspace][id]=ws-...`
- The request/response format is JSON:API
- The resource type is `team-workspaces` (not `team-access`)
- Team and Workspace are passed as relationships in the request body

## Team Membership Relationship Endpoints

**Note**: These endpoints are DIFFERENT from team-workspace access. They manage adding/removing users from teams.

According to [TFE API docs](https://developer.hashicorp.com/terraform/cloud-docs/api-docs/team-members):

- ⏳ `POST /api/v2/teams/:team_id/relationships/users` - Add users to team (by user ID) - **NOT IMPLEMENTED**
- ✅ `POST /api/v2/teams/:team_id/relationships/organization-memberships` - Add users to team (by org membership ID) - **IMPLEMENTED**
- ⏳ `DELETE /api/v2/teams/:team_id/relationships/users` - Remove users from team (by username) - **NOT IMPLEMENTED**
- ✅ `DELETE /api/v2/teams/:team_id/relationships/organization-memberships` - Remove users from team (by org membership ID) - **IMPLEMENTED**

**Status**: ✅ **PARTIALLY IMPLEMENTED** - Organization-memberships endpoints are implemented (via organization-membership IDs), but `/relationships/users` endpoints are not yet implemented.

**Reference**: See `backend/internal/api/v2/routes/routes.go:124-126` and `backend/internal/api/v2/handlers/team_members.go`

## Verified Correct Endpoints

### Workspaces
- ✅ `GET /api/v2/organizations/:name/workspaces` - List
- ✅ `POST /api/v2/organizations/:name/workspaces` - Create
- ✅ `GET /api/v2/organizations/:name/workspaces/:name` - Read by name
- ✅ `GET /api/v2/workspaces/:id` - Read by ID (just fixed)
- ✅ `PATCH /api/v2/organizations/:name/workspaces/:name` - Update
- ✅ `DELETE /api/v2/organizations/:name/workspaces/:name` - Delete
- ✅ `POST /api/v2/workspaces/:id/actions/lock` - Lock
- ✅ `POST /api/v2/workspaces/:id/actions/unlock` - Unlock

### Teams
- ✅ `GET /api/v2/organizations/:name/teams` - List
- ✅ `POST /api/v2/organizations/:name/teams` - Create
- ✅ `GET /api/v2/organizations/:name/teams/:teamName` - Read by name
- ✅ `GET /api/v2/teams/:id` - Read by ID
- ✅ `PATCH /api/v2/teams/:id` - Update by ID
- ✅ `DELETE /api/v2/teams/:id` - Delete by ID

### Runs
- ✅ `POST /api/v2/runs` - Create
- ✅ `GET /api/v2/runs/:id` - Read
- ✅ `POST /api/v2/runs/:id/actions/apply` - Apply
- ✅ `POST /api/v2/runs/:id/actions/cancel` - Cancel

### State Versions
- ✅ `GET /api/v2/workspaces/:id/state-versions` - List
- ✅ `POST /api/v2/workspaces/:id/state-versions` - Create
- ✅ `GET /api/v2/state-versions/:id` - Read
- ✅ `GET /api/v2/state-versions/:id/outputs` - Get outputs

### Variables
- ✅ `GET /api/v2/workspaces/:id/vars` - List
- ✅ `POST /api/v2/workspaces/:id/vars` - Create
- ✅ `PATCH /api/v2/workspaces/:id/vars/:id` - Update
- ✅ `DELETE /api/v2/workspaces/:id/vars/:id` - Delete

## Next Steps

1. **URGENT**: Add `/api/v2/team-workspaces` endpoints
2. Update `TeamWorkspaceAccessHandlerV2` to handle both endpoint patterns (if needed for backward compatibility)
3. Test `tfe_team_access` resource creation/update/delete
4. Verify all endpoints work with `terraform-provider-tfe`

## References

- `go-tfe/team_access.go` - Team access API implementation
- `go-tfe/workspace.go` - Workspace API implementation
- `go-tfe/team.go` - Team API implementation
- `terraform-provider-tfe/internal/provider/resource_tfe_team_access.go` - Provider resource implementation
- TFE API Docs: https://developer.hashicorp.com/terraform/cloud-docs/api-docs

