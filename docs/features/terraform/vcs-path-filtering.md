---
description: "GitOps-style path filtering that triggers workspace runs only when files in the configured working directory change"
covers:
  - "core/vcs/**"
  - "backend/cmd/orchestrator/**"
---

# VCS Path Filtering

StackWeaver intelligently filters which workspaces should trigger runs based on which files actually changed in your repository. This GitOps-style filtering prevents unnecessary runs when multiple workspaces share the same repository but monitor different paths.

## How It Works

When you push code to your repository, StackWeaver checks which files changed and only triggers workspaces whose working directories contain those changed files.

### Example: Multiple Environments in One Repository

Many teams organize infrastructure by environment in a single repository:

```
terraform/
├── environments/
│   ├── dev/
│   │   └── main.tf
│   ├── staging/
│   │   └── main.tf
│   └── production/
│       └── main.tf
```

With path filtering:

- **Dev workspace** (`working_directory: environments/dev`) only triggers when files in `environments/dev/` change
- **Staging workspace** (`working_directory: environments/staging`) only triggers when files in `environments/staging/` change
- **Production workspace** (`working_directory: environments/production`) only triggers when files in `environments/production/` change

If you push changes to `environments/dev/main.tf`, only the dev workspace triggers a run. Staging and production workspaces remain unaffected.

## Path Matching Rules

### Root-Level Workspaces

Workspaces with empty or `/` working directory:

- Trigger for **any** file change in the repository
- Use this when the workspace monitors the entire repository

### Subfolder Workspaces

Workspaces with a configured working directory (like `environments/prod`):

- Only trigger when files **within that subfolder** are changed
- Matches any file path that starts with the configured working directory
- Subdirectories within the working directory are included

For example, if your working directory is `infrastructure/network`:

- ✅ Triggers for: `infrastructure/network/main.tf`, `infrastructure/network/modules/firewall/main.tf`
- ❌ Does not trigger for: `infrastructure/storage/main.tf`, `application/api/main.tf`

## GitOps Benefits

This filtering enables GitOps-style workflows where:

- **Single source of truth**: Keep all infrastructure code in one repository
- **Logical separation**: Organize by environment, team, or service
- **Selective execution**: Only relevant workspaces run on each change
- **Reduced noise**: Avoid unnecessary runs that would just show "no changes"

## Configuration

Path filtering is **automatic** - no configuration needed. It works based on your workspace's working directory setting:

1. When creating a workspace, set the "Working Directory" to the subfolder path
2. The workspace will only trigger when files in that path change
3. Leave it blank to monitor the entire repository

## Common Use Cases

### Multi-Environment Setup

One repository with separate workspaces for dev, staging, and production:

- Workspace: "dev-infrastructure" → Working Directory: `environments/dev`
- Workspace: "staging-infrastructure" → Working Directory: `environments/staging`
- Workspace: "prod-infrastructure" → Working Directory: `environments/production`

### Service-Based Organization

Multiple services in one repository:

- Workspace: "api-infrastructure" → Working Directory: `services/api/infrastructure`
- Workspace: "web-infrastructure" → Working Directory: `services/web/infrastructure`

### Team-Based Structure

Separate infrastructure per team:

- Workspace: "platform-team-infra" → Working Directory: `teams/platform/infrastructure`
- Workspace: "product-team-infra" → Working Directory: `teams/product/infrastructure`

## Related Documentation

- [Workspace Editing](./workspace-editing.md) - How to set working directories
- [Your First Terraform Workspace](../../get-started/your-first-terraform-workspace.md) - Workspace setup and configuration
- [Connecting to GitHub](../../user-guides/vcs/github-app.md) - Setting up VCS integration
