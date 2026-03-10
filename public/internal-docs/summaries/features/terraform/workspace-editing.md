<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Workspace Editing Feature

## Overview

StackWeaver allows users to edit workspace settings after initial creation. This feature enables users to modify workspace configuration without needing to delete and recreate the workspace, while providing appropriate warnings for changes that may affect existing state.

## Editable Fields

The following workspace fields can be modified after creation:

### Safe to Edit (No State Impact)
- **Name**: Workspace name (must be unique within project)
- **Description**: Workspace description
- **Working Directory**: Path within repository (e.g., `/terraform`, `/infra/prod`)
- **Terraform Version**: Terraform version to use
- **Auto Queue Runs**: Automatically queue runs on VCS push
- **Auto Apply**: Automatically apply successful plans
- **Execution Mode**: `remote`, `local`, or `agent`
- **Run Timeout**: Custom extension - Maximum duration for apply operations (in seconds)

### State-Invalidating Changes (Warning Required)
- **VCS Connection**: Changing the VCS connection
- **VCS Repository**: Changing the repository source
- **VCS Branch**: Changing the Git branch

**Note**: Changing VCS connection, repository, or branch may invalidate existing state because the workspace will pull from a different source. The UI displays a warning when these changes are detected.

## API Reference

### Backend API

**Route Registration**: See `backend/internal/api/v2/routes/routes.go:86`  
**Handler Implementation**: See `WorkspaceHandlerV2.Update()` - `backend/internal/api/v2/handlers/terraform/workspaces.go:645-771`

#### `PATCH /api/v2/organizations/:name/workspaces/:name`

Update a workspace by organization and workspace name.

**Request Format** (JSON:API):
```json
{
  "data": {
    "type": "workspaces",
    "attributes": {
      "name": "updated-workspace-name",
      "description": "Updated description",
      "vcs-connection-id": "uuid-or-null",
      "vcs-repository": "owner/repo",
      "vcs-branch": "main",
      "working-directory": "/terraform",
      "terraform-version": "1.9.0",
      "auto-queue-runs": true,
      "auto-apply": false,
      "execution-mode": "remote",
      "run-timeout": 7200
    }
  }
}
```

**Response**: JSON:API `workspaces` resource (supports `?format=simple` for frontend)

**Validation**:
- Requires authentication and organization membership
- Validates VCS connection belongs to organization
- Checks workspace name uniqueness within project
- Validates repository is provided when VCS connection is set

### Frontend API

**Implementation**: See `workspacesApi.update()` in `frontend/src/api/client.ts:331-346`

#### `workspacesApi.update(organizationName: string, workspaceName: string, data)`

Update a workspace.

**Parameters**:
- `organizationName`: Organization name
- `workspaceName`: Current workspace name
- `data`: Object with optional fields (see API reference for full list)

**Returns**: Updated `Workspace` object

## UI Implementation

### Edit Workspace Dialog

**Component**: `EditWorkspaceDialog` - `frontend/src/components/workspace/EditWorkspaceDialog.tsx`

**Features**:
- Pre-populates form with existing workspace values
- Displays warning banner when state-invalidating changes are detected
- Validates VCS connection, repository, and branch relationships
- Supports all editable workspace fields
- Refreshes workspace data after successful update

**Usage**: Accessed via "Edit" button on workspace detail page

### Workspace Detail Page

**Component**: `WorkspaceDetail` - `frontend/src/pages/WorkspaceDetail.tsx`

**Edit Button Location**: Header action buttons (next to Lock/Unlock and Delete buttons)

**Integration**: 
- Opens `EditWorkspaceDialog` when clicked
- Refreshes workspace data after successful update
- Updates UI to reflect changes immediately

## State Management

### State-Invalidating Changes

When a user modifies VCS connection, repository, or branch:

1. **Warning Display**: The UI shows a warning banner explaining the potential impact
2. **User Confirmation**: User can proceed with the change after acknowledging the warning
3. **State Impact**: The workspace will pull from a different source, which may cause issues if:
   - The new source has different Terraform code
   - The new source references different resources
   - The new source has different variable requirements

**Note**: The system does not prevent these changes, but warns users about potential issues. Users should ensure the new source is compatible with existing state.

### Safe Changes

Changes to name, description, working directory, Terraform version, auto-queue-runs, auto-apply, execution mode, and run-timeout do not affect existing state and can be made safely at any time.

## Activity Logging

All workspace updates are logged to the activity feed, including:
- Field name
- Old value (if applicable)
- New value
- User who made the change
- Timestamp

**Implementation**: See `backend/internal/api/v2/handlers/terraform/workspaces.go:738-757`

## Permissions

Workspace editing requires:
- User authentication
- Organization membership (admin or member role)
- Workspace access (inherited from organization/project permissions)

**Implementation**: See `backend/internal/api/v2/handlers/terraform/workspaces.go:647-683`

## Related Features

- **Workspace Creation**: See `CreateWorkspaceDialog` - `frontend/src/components/workspace/CreateWorkspaceDialog.tsx`
- **Run Timeout Configuration**: See `docs/features/run-timeout.md`
- **Workspace Locking**: See workspace lock/unlock actions in `WorkspaceDetail.tsx`

