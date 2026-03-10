<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Teams & Permissions Testing Implementation Plan

**Issue**: #65 - Comprehensive testing of teams and permissions implementation  
**Date**: 2024-12-XX  
**Status**: Planning

## Overview

This document outlines the implementation plan for comprehensive testing of the teams and permissions feature. This testing will be performed in a separate branch to validate all implemented functionality.

## Testing Scope

The testing will cover all implemented teams and permissions features, organized by functional area:

1. **Organization Membership Management** - User invitations, role management
2. **Team Management** - Team CRUD operations, organization-level access
3. **Team Project Access** - Project-level team permissions
4. **Team Workspace Access** - Workspace-level team permissions
5. **Permission Resolution** - RBAC service validation
6. **UI Components** - Frontend team access management

## Backend Fixes Applied

Before testing begins, the following backend fixes have been implemented:

### 1. Team Organization Access Mutual Exclusivity Fix

**Issue**: Organization access permissions with mutual exclusivity (radio button groups) were not properly handled during updates.

**Files Modified**:
- `backend/internal/api/v2/handlers/teams.go`

**Changes**:
- Added `updateOrganizationAccessFromRequest()` helper function to handle mutual exclusivity
- Applied to `Create`, `Update`, and `UpdateByID` handlers
- Enforces mutual exclusivity for:
  - `manage-projects` / `read-projects`
  - `manage-workspaces` / `read-workspaces`
  - `manage-organization-access` / `manage-teams` / `manage-membership`

**Status**: ✅ Completed

### 2. Project List Permission Filtering Fix

**Issue**: Project list endpoint (`GET /api/v2/organizations/:name/projects`) did not filter projects based on user permissions.

**Files Modified**:
- `backend/internal/api/v2/handlers/projects.go`

**Changes**:
- Added user authentication check
- Added organization-level `read-projects` permission check
- If user has `PermissionOrgReadProjects`: show all projects
- If user does NOT have org-level permission: filter to projects the user has team project access to
- Returns empty list if user has no team project access

**Status**: ✅ Completed

## Testing Approach

### Phase 1: Backend API Testing

**Focus**: Validate all API endpoints work correctly with permission checks

1. **Organization Membership APIs**
   - Test all CRUD operations
   - Verify permission checks (admin-only operations)
   - Test filtering and pagination

2. **Team APIs**
   - Test team creation/update/delete
   - Verify organization access updates with mutual exclusivity
   - Test team member management

3. **Team Project Access APIs**
   - Test creating/updating/deleting project access
   - Verify permission filtering in project list endpoint
   - Test access level changes (read/write/none)

4. **Team Workspace Access APIs**
   - Test creating/updating/deleting workspace access
   - Verify permission checks for workspace operations
   - Test access level changes

### Phase 2: Permission Resolution Testing

**Focus**: Validate RBAC service correctly resolves permissions

1. **Organization-Level Permissions**
   - Test all organization permissions
   - Verify team-based permission aggregation
   - Test permission precedence (manage vs read)

2. **Project-Level Permissions**
   - Test project read/write permissions
   - Verify team project access resolution
   - Test permission inheritance (org-level vs project-level)

3. **Workspace-Level Permissions**
   - Test workspace read/write permissions
   - Verify team workspace access resolution
   - Test permission inheritance

### Phase 3: Integration Testing

**Focus**: End-to-end workflows with real-world scenarios

1. **User Journey Tests**
   - User invited to organization
   - User added to team with project access
   - User performs actions based on permissions
   - Permission changes and immediate effect

2. **Team Management Workflows**
   - Create team with organization access
   - Update team permissions (mutual exclusivity)
   - Add/remove team members
   - Assign project/workspace access

3. **Permission Edge Cases**
   - User in multiple teams with different permissions
   - Permission changes while user is active
   - Removing user from organization/teams

### Phase 4: UI Testing

**Focus**: Validate frontend components work correctly

1. **Organization Access UI**
   - Team organization access management
   - Permission toggles and mutual exclusivity
   - Permission display

2. **Project/Workspace Access UI**
   - Team project access management (if implemented)
   - Team workspace access management (if implemented)
   - Access level selection

3. **User Experience**
   - Permission changes reflected immediately
   - Error messages for permission violations
   - Loading states and error handling

## Test Data Setup

### Organizations
- Create test organization(s) for testing

### Users
- Create multiple test users with different roles/permissions
- Users in different teams with varying access levels

### Teams
- Owners team (full permissions)
- Test teams with various organization access configurations
- Teams with project/workspace access

### Projects & Workspaces
- Multiple projects for testing project-level access
- Workspaces within projects for workspace-level access

## Testing Checklist Reference

For detailed test cases, refer to:
- `docs/testing/TEAMS_PERMISSIONS_TESTING.md` - Comprehensive testing checklist

## Implementation Status

### Completed Fixes
1. ✅ **Team organization access mutual exclusivity** - Implemented in `backend/internal/api/v2/handlers/teams.go:71-145` (`updateOrganizationAccessFromRequest`)
2. ✅ **Project list permission filtering** - Implemented in `backend/internal/api/v2/handlers/projects.go:124-241`

Both fixes are complete and ready for testing. See `docs/testing/TEAMS_TESTING_ANALYSIS.md` for detailed analysis of the mutual exclusivity implementation.

## Success Criteria

### Backend API
- All API endpoints respond correctly with permission checks
- Permission filtering works as expected
- Mutual exclusivity enforced correctly
- No unauthorized access possible

### Permission Resolution
- RBAC service correctly resolves all permission combinations
- Team-based permissions aggregate correctly
- Permission inheritance works correctly

### Integration
- End-to-end workflows complete successfully
- Permission changes take effect immediately
- Edge cases handled gracefully

### UI
- All UI components display correct permissions
- User actions respect permission checks
- Error messages are clear and actionable

## Testing Timeline

1. **Backend API Testing**: ~2-3 days
2. **Permission Resolution Testing**: ~1-2 days
3. **Integration Testing**: ~2-3 days
4. **UI Testing**: ~1-2 days
5. **Bug Fixes & Re-testing**: ~2-3 days

**Total Estimated Time**: ~8-13 days

## Next Steps

1. ✅ Backend fixes applied
2. ⏳ Create test branch
3. ⏳ Set up test data
4. ⏳ Execute Phase 1: Backend API Testing
5. ⏳ Execute Phase 2: Permission Resolution Testing
6. ⏳ Execute Phase 3: Integration Testing
7. ⏳ Execute Phase 4: UI Testing
8. ⏳ Document findings and create issues for any bugs
9. ⏳ Merge test branch after validation

## Notes

- All testing should be performed in a separate branch
- Document any bugs/issues found during testing
- Verify fixes work correctly before marking as complete
- Update this document with testing progress and findings
