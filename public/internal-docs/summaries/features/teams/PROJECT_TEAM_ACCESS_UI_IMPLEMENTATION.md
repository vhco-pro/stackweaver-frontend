<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Project Team Access UI Implementation Plan

**Date**: 2026-01-10  
**Status**: 📋 **PLANNED**  
**Related Issue**: TBD

## Executive Summary

Implement a fine-grained team access management UI in project settings, similar to Terraform Enterprise's project team access interface. This allows organization admins to assign granular permissions to teams at the project level, with support for both predefined permission groups (Read, Write, Maintain, Admin) and custom permission sets.

## Current Status

✅ **Backend Complete**:
- `TeamProjectAccess` model with all granular permissions
- `TeamProjectAccessHandlerV2` with full CRUD operations
- API endpoints: `/api/v2/team-projects` (TFE-compatible)
- Frontend API client: `teamProjectAccessApi` in `client.ts`

❌ **Frontend Missing**:
- Project settings page/section for team access
- UI for listing team access assignments
- UI for adding/editing team access with permission groups
- UI for custom permission configuration
- Integration with ProjectDetail page

## Design Goals

1. **TFE-Compatible UI**: Match Terraform Enterprise's project team access interface
2. **Permission Groups**: Support predefined groups (Read, Write, Maintain, Admin, Custom)
3. **Custom Permissions**: Allow fine-grained permission configuration
4. **Project Settings Integration**: Accessible from project detail page
5. **User-Friendly**: Clear, intuitive interface with good UX

## UI Structure

### Location

**Project Settings** → `/app/:orgName/projects/:projectName/settings/team-access`

Should be accessible from:
- Project detail page settings tab/section
- Direct navigation from project sidebar

### Main Components

1. **Team Access List View**
   - Table/list of teams with access to the project
   - Columns: Team name, Permission level, Actions (Edit, Remove)
   - "Add team access" button

2. **Add/Edit Team Access Dialog**
   - Two-column layout:
     - **Left**: Permission groups (radio buttons)
       - Read: "Can view everything in the project"
       - Write: "Can update everything in the project"
       - Maintain: "Full control of everything in the project, but not the project itself"
       - Admin: "Full control of the project"
       - Custom: "Create a custom permission set for this team"
   - **Right**: Custom permissions panel (shown when "Custom" selected, or as preview for other groups)
     - Project access section
     - Workspace access section
     - Variable access section
     - Other controls section

3. **Permission Configuration Sections**

   **Project Access**:
   - Settings: Radio buttons (Read, Update, Delete)
   - Teams: Radio buttons (None, Read, Manage)
   - Variable sets: Radio buttons (None, Read, Write)

   **Workspace Access** (applies to all workspaces in project):
   - Runs: Radio buttons (Read, Plan, Apply)
   - Sentinel mocks: Radio buttons (None, Read)
   - State versions: Radio buttons (None, Read outputs only, Read, Read and write)
   - Variables: Radio buttons (No access, Read, Read and write)
   - Variable set access: Radio buttons (No access, Read, Manage)
   - Create workspaces: Checkbox
   - Delete workspaces: Checkbox
   - Move workspaces: Checkbox
   - Lock/unlock workspaces: Checkbox
   - Manage workspace Run Tasks: Checkbox
   - Download Sentinel mocks: Checkbox

## Implementation Phases

### Phase 1: Project Settings Structure

**Goal**: Add project settings navigation and routing

**Tasks**:
- [ ] Create project settings page component structure
- [ ] Add route: `/app/:orgName/projects/:projectName/settings`
- [ ] Add sub-route: `/app/:orgName/projects/:projectName/settings/team-access`
- [ ] Add settings navigation/sidebar to ProjectDetail page
- [ ] Create placeholder settings sections

**Files to Create**:
- `frontend/src/pages/ProjectSettings.tsx` (main settings page)
- `frontend/src/pages/ProjectSettings/TeamAccess.tsx` (team access component)

**Files to Modify**:
- `frontend/src/App.tsx` (add routes)
- `frontend/src/pages/ProjectDetail.tsx` (add settings navigation)

**Time**: 2-3 hours

---

### Phase 2: Team Access List View

**Goal**: Display list of teams with access to the project

**Tasks**:
- [ ] Create TeamAccessList component
- [ ] Fetch team project access via `teamProjectAccessApi.list(projectId)`
- [ ] Display teams in table/card layout
- [ ] Show permission level (Read/Write/Maintain/Admin/Custom)
- [ ] Add "Add team access" button
- [ ] Add Edit/Delete actions for each team

**Files to Create**:
- `frontend/src/pages/ProjectSettings/TeamAccess.tsx` (main component)
- `frontend/src/components/project/TeamAccessList.tsx` (list component)

**Files to Modify**:
- `frontend/src/api/client.ts` (verify teamProjectAccessApi is complete)

**Time**: 3-4 hours

---

### Phase 3: Permission Groups UI

**Goal**: Implement permission group selection (Read/Write/Maintain/Admin/Custom)

**Tasks**:
- [ ] Create PermissionGroupSelector component (radio buttons)
- [ ] Map permission groups to backend access levels:
  - Read → `access: "read"`
  - Write → `access: "write"`
  - Maintain → `access: "maintain"`
  - Admin → `access: "admin"`
  - Custom → `access: "custom"`
- [ ] Show descriptions for each group
- [ ] Handle group selection state

**Files to Create**:
- `frontend/src/components/project/PermissionGroupSelector.tsx`

**Files to Modify**:
- `frontend/src/pages/ProjectSettings/TeamAccess.tsx` (add dialog)

**Time**: 2-3 hours

---

### Phase 4: Custom Permissions UI

**Goal**: Implement custom permission configuration panel

**Tasks**:
- [ ] Create CustomPermissionsPanel component
- [ ] Implement Project Access section:
  - Settings (Read/Update/Delete radio buttons)
  - Teams (None/Read/Manage radio buttons)
  - Variable sets (None/Read/Write radio buttons)
- [ ] Implement Workspace Access section:
  - Runs (Read/Plan/Apply radio buttons)
  - Sentinel mocks (None/Read radio buttons)
  - State versions (None/Read outputs only/Read/Read and write radio buttons)
  - Variables (No access/Read/Read and write radio buttons)
  - Variable set access (No access/Read/Manage radio buttons)
  - Create workspaces (checkbox)
  - Delete workspaces (checkbox)
  - Move workspaces (checkbox)
  - Lock/unlock workspaces (checkbox)
  - Manage workspace Run Tasks (checkbox)
  - Download Sentinel mocks (checkbox)
- [ ] Show/hide based on "Custom" selection
- [ ] Show preview for other permission groups (read-only)

**Files to Create**:
- `frontend/src/components/project/CustomPermissionsPanel.tsx`
- `frontend/src/components/project/ProjectAccessSection.tsx`
- `frontend/src/components/project/WorkspaceAccessSection.tsx`

**Files to Modify**:
- `frontend/src/pages/ProjectSettings/TeamAccess.tsx` (integrate panel)

**Time**: 6-8 hours

---

### Phase 5: Add/Edit Dialog

**Goal**: Complete add/edit team access dialog

**Tasks**:
- [ ] Create AddTeamAccessDialog component
- [ ] Integrate PermissionGroupSelector and CustomPermissionsPanel
- [ ] Add team selection dropdown
- [ ] Handle form state and validation
- [ ] Submit to `teamProjectAccessApi.create()` or `update()`
- [ ] Handle errors and success feedback
- [ ] Support edit mode (pre-populate form with existing access)

**Files to Create**:
- `frontend/src/components/project/AddTeamAccessDialog.tsx`

**Files to Modify**:
- `frontend/src/pages/ProjectSettings/TeamAccess.tsx` (integrate dialog)
- `frontend/src/api/client.ts` (verify API methods match backend)

**Time**: 4-5 hours

---

### Phase 6: Permission Group Mapping

**Goal**: Map permission groups to actual permission values

**Tasks**:
- [ ] Create permission mapping utilities:
  - `getPermissionsForGroup(group: 'read' | 'write' | 'maintain' | 'admin')`
  - `getGroupFromPermissions(permissions: CustomPermissions): string`
- [ ] Map predefined groups to custom permission sets:
  - Read: minimal read permissions
  - Write: write permissions but no admin capabilities
  - Maintain: full workspace/project control but no project deletion
  - Admin: full control
- [ ] Handle conversion between access levels and custom permissions

**Files to Create**:
- `frontend/src/utils/permissionMappings.ts`

**Files to Modify**:
- `frontend/src/components/project/AddTeamAccessDialog.tsx` (use mappings)

**Time**: 3-4 hours

---

### Phase 7: Integration & Polish

**Goal**: Integrate everything and polish the UI

**Tasks**:
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add success notifications
- [ ] Add confirmation dialogs for delete
- [ ] Test all permission combinations
- [ ] Verify TFE compatibility
- [ ] Add tooltips/help text
- [ ] Responsive design
- [ ] Accessibility improvements

**Files to Modify**:
- All created components

**Time**: 4-5 hours

---

## Permission Group Definitions

Based on TFE behavior and backend implementation:

### Read
- **Project Settings**: Read
- **Project Teams**: Read
- **Project Variable Sets**: Read
- **Workspace Runs**: Read
- **Workspace Sentinel Mocks**: None
- **Workspace State Versions**: Read outputs only
- **Workspace Variables**: Read
- **Variable Set Access**: Read
- **Create Workspaces**: false
- **Delete Workspaces**: false
- **Move Workspaces**: false
- **Lock/Unlock Workspaces**: false
- **Manage Run Tasks**: false
- **Download Sentinel Mocks**: false

### Write
- **Project Settings**: Update
- **Project Teams**: Read
- **Project Variable Sets**: Write
- **Workspace Runs**: Apply
- **Workspace Sentinel Mocks**: None
- **Workspace State Versions**: Read
- **Workspace Variables**: Read and write
- **Variable Set Access**: Read
- **Create Workspaces**: true
- **Delete Workspaces**: false
- **Move Workspaces**: false
- **Lock/Unlock Workspaces**: true
- **Manage Run Tasks**: false
- **Download Sentinel Mocks**: false

### Maintain
- **Project Settings**: Update
- **Project Teams**: Manage
- **Project Variable Sets**: Write
- **Workspace Runs**: Apply
- **Workspace Sentinel Mocks**: Read
- **Workspace State Versions**: Read
- **Workspace Variables**: Read and write
- **Variable Set Access**: Manage
- **Create Workspaces**: true
- **Delete Workspaces**: true
- **Move Workspaces**: true
- **Lock/Unlock Workspaces**: true
- **Manage Run Tasks**: true
- **Download Sentinel Mocks**: true

### Admin
- **Project Settings**: Delete
- **Project Teams**: Manage
- **Project Variable Sets**: Write
- **Workspace Runs**: Apply
- **Workspace Sentinel Mocks**: Read
- **Workspace State Versions**: Read and write
- **Workspace Variables**: Read and write
- **Variable Set Access**: Manage
- **Create Workspaces**: true
- **Delete Workspaces**: true
- **Move Workspaces**: true
- **Lock/Unlock Workspaces**: true
- **Manage Run Tasks**: true
- **Download Sentinel Mocks**: true

### Custom
- User selects all permissions individually

## API Integration

### List Team Access
```typescript
const response = await teamProjectAccessApi.list(projectId);
// Returns: { data: TeamProjectAccess[] }
```

### Create Team Access
```typescript
// Fixed access level
await teamProjectAccessApi.create(teamId, projectId, 'admin');

// Custom permissions
await teamProjectAccessApi.create(teamId, projectId, 'custom', {
  'project-access': {
    settings: 'update',
    teams: 'read',
    'variable-sets': 'write',
  },
  'workspace-access': {
    runs: 'apply',
    'sentinel-mocks': 'read',
    'state-versions': 'read',
    variables: 'read',
    create: true,
    locking: true,
    delete: false,
    move: false,
    'run-tasks': false,
  },
});
```

### Update Team Access
```typescript
await teamProjectAccessApi.update(accessId, 'custom', customPermissions);
```

### Delete Team Access
```typescript
await teamProjectAccessApi.delete(accessId);
```

## Related Documentation

- Team-Based Permissions Refactor: `docs/architecture/auth/teams/TEAM_BASED_PERMISSIONS_REFACTOR.md`
- Team Project Access Model: `backend/internal/models/team_project_access.go`
- Team Project Access Handler: `backend/internal/api/v2/handlers/team_project_access.go`
- TFE API Docs: https://developer.hashicorp.com/terraform/cloud-docs/api-docs/team-project-access

## Acceptance Criteria

- [ ] Project settings page accessible from project detail page
- [ ] Team access list displays all teams with access to the project
- [ ] Permission groups (Read/Write/Maintain/Admin/Custom) work correctly
- [ ] Custom permissions panel allows fine-grained configuration
- [ ] Add team access dialog works (create)
- [ ] Edit team access dialog works (update)
- [ ] Delete team access works
- [ ] Permission groups map correctly to backend access levels
- [ ] UI matches TFE's project team access interface (visual design)
- [ ] All permission combinations work correctly
- [ ] Error handling and loading states implemented
- [ ] Responsive design works on mobile/tablet

## Notes

- This is a frontend-only implementation (backend is complete)
- Should follow TFE's UI patterns for familiarity
- Permission groups are convenience shortcuts for common permission sets
- Custom permissions allow maximum flexibility
- All permissions apply to all workspaces within the project (project-scoped)
