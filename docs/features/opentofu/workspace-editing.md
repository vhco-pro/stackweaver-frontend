---
description: "Editing workspace settings after creation including safe changes and state-affecting VCS changes"
covers:
  - "backend/internal/api/v2/handlers/terraform/**"
  - "frontend/src/pages/WorkspaceDetail.tsx"
---

# Workspace Editing

StackWeaver allows you to edit workspace settings after initial creation, enabling you to modify workspace configuration without needing to delete and recreate workspaces.

## What Can Be Edited?

Most workspace settings can be modified after creation. The platform distinguishes between changes that are safe and changes that might affect existing state.

### Safe Changes (No Warnings)

These changes don't impact existing infrastructure state:

- **Name**: Workspace name (must be unique within the project)
- **Description**: Workspace description
- **Working Directory**: Path within the repository where OpenTofu files are located
- **OpenTofu Version**: Which OpenTofu version to use for runs
- **Auto Queue Runs**: Automatically trigger runs when code is pushed to the repository
- **Auto Apply**: Automatically apply plans that complete successfully
- **Execution Mode**: Choose between `remote` (platform-managed runners), `local`, or `agent` modes
- **Run Timeout**: Maximum duration for apply operations (in seconds)

### Changes Requiring Warnings

These changes might affect existing state and the platform will show a warning:

- **VCS Connection**: Changing the VCS connection used for the workspace
- **VCS Repository**: Changing which repository the workspace pulls from
- **VCS Branch**: Changing the Git branch used by the workspace

> [!WARNING]
> Changing VCS connection, repository, or branch may invalidate existing state because the workspace will pull OpenTofu code from a different source. Review carefully before making these changes.

## Editing a Workspace

To edit a workspace:

1. Open the workspace detail page
2. Click "Edit" in the workspace header
3. Modify the settings you need
4. Review any warnings shown for state-invalidating changes
5. Save your changes

The workspace will use the new settings for all future runs.

## Use Cases

Common scenarios for editing workspaces:

- **Updating OpenTofu version**: Upgrade to a newer OpenTofu version for new features or bug fixes
- **Changing working directory**: Reorganize your repository structure without recreating workspaces
- **Adjusting automation**: Enable or disable auto-apply or auto-queue based on your workflow needs
- **Setting timeouts**: Configure timeouts for long-running applies to prevent jobs from getting stuck

## Related Documentation

- [Your First OpenTofu Workspace](../../get-started/your-first-opentofu-workspace.md) - Get started with workspaces
- [Backend API Reference](../../internal/api-reference/backend-api-reference.md) - API for workspace management
