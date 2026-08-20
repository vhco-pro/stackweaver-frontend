---
description: "GitOps-style path filtering that triggers workspace runs only when the files a workspace monitors actually change"
covers:
  - "backend/internal/api/v2/handlers/**"
---

# VCS Path Filtering

StackWeaver intelligently filters which workspaces should trigger runs based on which files actually changed in your repository. This GitOps-style filtering prevents unnecessary runs when multiple workspaces share the same repository but monitor different paths.

## How It Works

When you push code to your repository, StackWeaver checks which files changed and only triggers workspaces that monitor at least one of them. By default a workspace monitors its working directory; the settings described under [Configuration](#configuration) widen or replace that.

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

These are the rules a workspace follows when it relies on its working directory alone, which is the default.

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

Path filtering needs no configuration to be useful: as soon as a workspace has a working directory, it only triggers when files in that directory change, and leaving the working directory blank monitors the whole repository. The same rules apply to every event StackWeaver receives, so a push, a pull request that opens a speculative plan, and an Azure DevOps delivery all reach the same verdict for the same change.

Three workspace settings adjust that default. They are part of the TFE-compatible API, so you set them through the API or the Terraform provider rather than the web interface.

### Always Trigger Runs

Setting `file_triggers_enabled` to `false` turns path filtering off for that workspace. Every change to the tracked branch queues a run, and the working directory, trigger prefixes and trigger patterns are all ignored. Use this when a workspace depends on the whole repository in ways its directory layout does not express.

### Monitoring Extra Directories

`trigger_prefixes` takes a list of repository-root-relative directories that are monitored **in addition to** the working directory. A workspace whose working directory is `environments/production` and whose trigger prefixes are `["modules/network"]` triggers for changes in either location, which is the usual way to make an environment react to the shared modules it consumes. Prefixes match on directory boundaries, so `modules/net` does not match `modules/network/main.tf`.

### Matching With Glob Patterns

`trigger_patterns` takes a list of glob patterns, always relative to the repository root. When patterns are set they are the only thing consulted - the working directory is no longer monitored on its own, which is what makes patterns able to express "any `.tf` file anywhere" as `**/*.tf`. Within a pattern, `**` spans directory separators, `*` matches within a single path segment, and `?` matches exactly one character. A pattern written as a directory, such as `modules/`, matches everything underneath it.

```hcl
resource "tfe_workspace" "production" {
  name              = "production"
  organization      = "acme"
  working_directory = "environments/production"

  trigger_prefixes = ["modules/network", "modules/database"]
  # or, instead of prefixes:
  # trigger_patterns = ["environments/production/**", "modules/**/*.tf"]
}
```

Trigger patterns and trigger prefixes are mutually exclusive. Setting both in one request is rejected with a `422`, and setting one on a workspace that already has the other replaces it.

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
