<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Teams Organization Access Update Analysis

**Status**: ✅ **RESOLVED** - Mutual exclusivity fix implemented

**Date**: 2024-12-XX  
**Last Updated**: 2025-01-12

## Issue Summary

Team organization access updates for mutually exclusive permissions (radio button groups) were not properly handled. This has been **resolved**.

## Solution Implemented

The backend now handles mutual exclusivity properly via the `updateOrganizationAccessFromRequest()` helper function.

**Location**: `backend/internal/api/v2/handlers/teams.go:71-145`

**Implementation**: When updating organization access permissions, the function automatically clears mutually exclusive fields when one is set:

1. **Project permissions**: `manage-projects` and `read-projects` are mutually exclusive
2. **Workspace permissions**: `manage-workspaces` and `read-workspaces` are mutually exclusive  
3. **Team permissions**: `manage-organization-access`, `manage-teams`, `manage-membership` are mutually exclusive

**Applied to handlers**:
- `Create()` - `backend/internal/api/v2/handlers/teams.go`
- `Update()` - `backend/internal/api/v2/handlers/teams.go`
- `UpdateByID()` - `backend/internal/api/v2/handlers/teams.go:1338`

## Testing

When implementing tests, verify:
1. Setting `manage-projects: true` clears `read-projects`
2. Setting `read-projects: true` clears `manage-projects`
3. Same behavior for workspace permissions
4. Same behavior for team permissions
5. Other permissions (checkboxes) update independently

## References

- **Implementation**: `backend/internal/api/v2/handlers/teams.go:71-145` (`updateOrganizationAccessFromRequest`)
- **Usage**: `backend/internal/api/v2/handlers/teams.go:833` (Update), `backend/internal/api/v2/handlers/teams.go:1338` (UpdateByID)