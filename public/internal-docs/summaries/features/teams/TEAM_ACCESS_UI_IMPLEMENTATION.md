<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Team Access UI Implementation Summary

**Date**: 2024-12-XX  
**Status**: ✅ **PARTIALLY COMPLETE** - Organization access UI implemented, Project/Workspace access UI deferred to Project Settings

**Architecture Update (2024-12-XX)**: 
- Per user feedback and architecture decision, project/workspace-level team access management will be implemented in Project Settings page (similar to TFE), not in team management UI
- Organization-level team access is correctly implemented in Edit Team dialog with TFE-style structure

## Overview

Implemented UI components for managing team project and workspace access, allowing admins to assign permissions to teams for testing and configuration of the permission model.

## Features Implemented

### 1. Organization-Level Team Access Management ✅ **COMPLETE**

**Location**: `frontend/src/pages/Settings/Users.tsx` - Edit Team Dialog

**Implementation**: TFE-style organization access structure with:
- Project permissions (radio: None, View all, Manage all)
- Workspace permissions (radio: None, View all, Manage all)  
- Team permissions (radio: None, Manage membership, Manage teams, Manage organization access)
- Settings permissions (checkboxes: policies, VCS, agent pools, etc.)
- Private registry permissions (parent checkbox + nested modules/providers)
- Visibility section (radio: Visible, Secret)

**Status**: ✅ Complete and matches TFE UI structure

### 2. Team Project Access Management (Issue #62) ⏳ **DEFERRED**

**Original Plan**: UI in team management dialog
**Current Status**: Backend API complete, UI deferred to Project Settings page

**Backend APIs Available** (working via Terraform):
- ✅ `GET /api/v2/team-projects` - List team project access
- ✅ `POST /api/v2/team-projects` - Create team project access
- ✅ `PATCH /api/v2/team-projects/:id` - Update team project access
- ✅ `DELETE /api/v2/team-projects/:id` - Delete team project access

**Future Implementation**: Project Settings page will have "Team Access" section where admins can assign teams to projects with specific access levels

**Location**: `frontend/src/pages/Settings/Users.tsx`

**Components Added**:
- `TeamProjectAccessManager` component
- "Manage Project Access" button in Teams table (FolderKanban icon)
- Dialog for assigning/updating/removing project access

**Functionality**:
- ✅ List all projects in organization
- ✅ Show current team project access assignments
- ✅ Assign new project access with access level (admin, maintain, write, read)
- ✅ Update existing project access levels inline
- ✅ Remove project access assignments
- ✅ Prevent duplicate assignments (projects already assigned are disabled)

**Access Levels**:
- **Admin** - Full control
- **Maintain** - Manage workspaces, runs, variables
- **Write** - Modify workspaces, create runs
- **Read** - View only

### 3. Team Workspace Access Management (Issue #63) ⏳ **DEFERRED**

**Original Plan**: UI in team management dialog
**Current Status**: Backend API complete, UI deferred to Project Settings page

**Backend APIs Available** (working via Terraform):
- ✅ `GET /api/v2/team-workspaces` - List team workspace access
- ✅ `POST /api/v2/team-workspaces` - Create team workspace access
- ✅ `PATCH /api/v2/team-workspaces/:id` - Update team workspace access
- ✅ `DELETE /api/v2/team-workspaces/:id` - Delete team workspace access

**Future Implementation**: Project Settings page will have workspace access management where admins can assign teams to specific workspaces with access levels

**Note**: Removed from team edit dialog per user feedback - consolidated all organization access into Edit Team dialog, project/workspace access will be in Project Settings (similar to TFE architecture)

**Location**: `frontend/src/pages/Settings/Users.tsx`

**Components Added**:
- `TeamWorkspaceAccessManager` component
- "Manage Workspace Access" button in Teams table (FolderOpen icon)
- Dialog for assigning/updating/removing workspace access

**Functionality**:
- ✅ List all workspaces in organization
- ✅ Show current team workspace access assignments
- ✅ Assign new workspace access with access level (admin, write, plan, read)
- ✅ Update existing workspace access levels inline
- ✅ Remove workspace access assignments
- ✅ Prevent duplicate assignments (workspaces already assigned are disabled)

**Access Levels**:
- **Admin** - Full control
- **Write** - Modify and create runs
- **Plan** - Read and plan runs (no apply)
- **Read** - View only

### 4. API Client Methods (Backend Ready, Frontend for Project Settings)

**Location**: `frontend/src/api/client.ts`

**Added APIs**:
- `teamProjectAccessApi.list()` - List team project access (with optional project filter)
- `teamProjectAccessApi.create()` - Create team project access
- `teamProjectAccessApi.update()` - Update team project access
- `teamProjectAccessApi.delete()` - Delete team project access

- `teamWorkspaceAccessApi.list()` - List team workspace access (with optional workspace filter)
- `teamWorkspaceAccessApi.create()` - Create team workspace access
- `teamWorkspaceAccessApi.update()` - Update team workspace access
- `teamWorkspaceAccessApi.delete()` - Delete team workspace access

**Type Definitions**:
- `TeamProjectAccess` interface
- `TeamWorkspaceAccess` interface

## UI/UX Features

### Edit Team Dialog - Organization Access

**Current Implementation** (TFE-style structure):
- ✅ Project permissions section (radio buttons: None, View all, Manage all)
- ✅ Workspace permissions section (radio buttons: None, View all, Manage all)
- ✅ Team permissions section (radio buttons: None, Manage membership, Manage teams, Manage organization access)
- ✅ Settings permissions section (checkboxes for policies, VCS, agent pools, etc.)
- ✅ Private registry permissions section (parent checkbox + nested modules/providers)
- ✅ Visibility section (radio buttons: Visible, Secret)
- ✅ "Include secret teams" checkbox
- ✅ All permissions consolidated in single Edit Team dialog (no separate dialogs)

### Project/Workspace Access Management (Future - Project Settings)

**Planned Features** (to be implemented in Project Settings page):
- Team access assignment for projects
- Team access assignment for workspaces within projects
- Similar structure to TFE's project settings UI

**Note**: Removed separate project/workspace access dialogs from team management per architecture decision - these will be in Project Settings instead.

## Backend Integration

**API Endpoints Used**:
- `GET /api/v2/team-projects` - List team project access
- `POST /api/v2/team-projects` - Create team project access
- `PATCH /api/v2/team-projects/:id` - Update team project access
- `DELETE /api/v2/team-projects/:id` - Delete team project access

- `GET /api/v2/team-workspaces` - List team workspace access
- `POST /api/v2/team-workspaces` - Create team workspace access
- `PATCH /api/v2/team-workspaces/:id` - Update team workspace access
- `DELETE /api/v2/team-workspaces/:id` - Delete team workspace access

**Response Format**: JSON:API format (handled by existing API client)

## Testing Capabilities

This UI enables admins to:

1. **Test Permission Resolution**:
   - Assign viewer user to a team
   - Grant team "write" access to a project
   - Verify user can create runs in that project's workspaces
   - Test that org-level viewer role doesn't block team permissions

2. **Test Access Level Granularity**:
   - Assign "read" access and verify user cannot create runs
   - Assign "plan" access (workspace) and verify user can plan but not apply
   - Assign "write" access and verify user can create/apply runs

3. **Test Multi-Project/Workspace Scenarios**:
   - Assign team to multiple projects with different access levels
   - Assign team to specific workspaces with different access than project
   - Verify workspace access overrides project access

4. **Test Permission Hierarchy**:
   - Verify team permissions are correctly resolved
   - Test org-level vs team-level permission resolution
   - Debug why team permissions might not be working

## Files Modified

### Frontend

1. **`frontend/src/pages/Settings/Users.tsx`**:
   - Added imports for team access APIs, projects API, workspaces API
   - Added state management for access dialogs
   - Added `openProjectAccessDialog()` and `openWorkspaceAccessDialog()` functions
   - Added action buttons to Teams table
   - Added dialog components for project/workspace access management
   - Added `TeamProjectAccessManager` component
   - Added `TeamWorkspaceAccessManager` component

2. **`frontend/src/api/client.ts`**:
   - Added `TeamProjectAccess` interface
   - Added `TeamWorkspaceAccess` interface
   - Added `teamProjectAccessApi` with list, create, update, delete methods
   - Added `teamWorkspaceAccessApi` with list, create, update, delete methods

### Documentation

3. **`docs/architecture/MULTI_TENANCY_PERMISSIONS_ANALYSIS.md`**:
   - Created comprehensive analysis of permission models for multi-tenancy
   - Recommended hybrid additive model
   - Documented current issues and migration path

## Next Steps

### Immediate Testing

1. **Test UI Functionality**:
   - [ ] Verify team project access assignment works
   - [ ] Verify team workspace access assignment works
   - [ ] Test updating access levels
   - [ ] Test removing access assignments
   - [ ] Verify duplicate prevention works

2. **Test Permission Resolution**:
   - [ ] Create viewer user
   - [ ] Add viewer to team
   - [ ] Assign team "write" access to project
   - [ ] Verify viewer can create runs (team permission should work)
   - [ ] Debug if team permissions are not working

### Follow-up Work

3. **Permission Model Migration** (if needed):
   - [ ] Decide on additive vs hierarchical model based on testing
   - [ ] Implement hybrid additive model if recommended
   - [ ] Update permission resolution logic
   - [ ] Test with multiple teams and access levels

4. **UI Enhancements** (optional):
   - [ ] Add bulk assignment (assign multiple projects/workspaces at once)
   - [ ] Add search/filter for projects/workspaces in large organizations
   - [ ] Show access level descriptions/tooltips
   - [ ] Add visual indicators for access inheritance (project → workspace)

## Current Status Summary

### ✅ Completed
- Organization-level team access UI (TFE-style in Edit Team dialog)
- Backend APIs for project/workspace access (working via Terraform)
- Team organization access management (all permissions in one dialog)

### ⏳ Deferred to Project Settings
- Project-level team access UI (will be in Project Settings page)
- Workspace-level team access UI (will be in Project Settings page)

### Known Limitations

1. **No Custom Permissions UI**: Organization access uses TFE-style structure. Custom permissions for project/workspace access not yet implemented in UI (backend supports it).

2. **Project Settings Page Not Yet Created**: Project/workspace access management UI deferred until Project Settings page is implemented.

3. **No Permission Debugging UI**: No UI to see why a user has/doesn't have a permission (would require backend debugging endpoint).

## References

- **Backend Handlers**: 
  - Team Project Access: `backend/internal/api/v2/handlers/team_project_access.go`
  - Team Workspace Access: `backend/internal/api/v2/handlers/team_workspace_access.go`
  
- **Models**: 
  - `backend/internal/models/team_project_access.go`
  - `backend/internal/models/team_workspace_access.go`

- **Routes**: `backend/internal/api/v2/routes/routes.go:197-218`

- **Permission Resolution**: `backend/internal/services/rbac/service.go:239-397`
