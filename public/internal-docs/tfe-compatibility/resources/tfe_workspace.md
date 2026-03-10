<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# tfe_workspace

**TFE Registry**: https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/workspace

**Status**: Implemented (go-tfe compatible for create/update/read, including VCS-backed and workspace_settings flow)

## Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `name` | string (Required) | `name` | Implemented | |
| `organization` | string (Optional) | via project | Implemented | Omit if set in provider |
| `description` | string (Optional) | `description` | Implemented | |
| `allow_destroy_plan` | bool (Optional) | `allow_destroy_plan` | Implemented | TFE default: true |
| `assessments_enabled` | bool (Optional) | `assessments_enabled` | Implemented | TFE default: false |
| `auto_apply` | bool (Optional) | `auto_apply` | Implemented | TFE default: false |
| `auto_apply_run_trigger` | bool (Optional) | `auto_apply_run_trigger` | Implemented | Auto-apply for run-trigger runs. Default: false |
| `auto_destroy_activity_duration` | string (Optional) | - | Not Implemented | Duration string (e.g. `7d`, `24h`). Conflicts with `auto_destroy_at` |
| `auto_destroy_at` | string (Optional) | - | Not Implemented | RFC3339 datetime. Conflicts with `auto_destroy_activity_duration` |
| `agent_pool_id` | string (Optional) | `agent_pool_id` | Implemented | **Deprecated** in TFE; use `tfe_workspace_settings`. For agent execution |
| `execution_mode` | string (Optional) | `execution_mode` | Implemented | **Deprecated** in TFE; use `tfe_workspace_settings`. remote / local / agent |
| `file_triggers_enabled` | bool (Optional) | `file_triggers_enabled` | Implemented | Filter runs by changed files. TFE default: true |
| `force_delete` | bool (Optional) | `force_delete` | Implemented | Workspace attribute; also supports `?force=true` query param on DELETE |
| `global_remote_state` | bool (Optional) | `global_remote_state` | Implemented | Org-wide state access. Default: false |
| `operations` | bool (Optional) | In response | Implemented | **Deprecated**. Returned as `true` in response |
| `project_id` | string (Optional) | `project_id` | Implemented | |
| `queue_all_runs` | bool (Optional) | `queue_all_runs` | Implemented | TFE API default: false; provider default: true |
| `remote_state_consumer_ids` | list (Optional) | - | Not Implemented | **Deprecated**; use `tfe_workspace_settings`. Explicit state consumers |
| `source_name` | string (Optional) | `source_name` | Implemented | "Created via &lt;source_name&gt;". Requires `source_url`. Immutable |
| `source_url` | string (Optional) | `source_url` | Implemented | URL for client/source. Requires `source_name`. Immutable |
| `speculative_enabled` | bool (Optional) | `speculative_enabled` | Implemented | TFE default: true |
| `structured_run_output_enabled` | bool (Optional) | `structured_run_output_enabled` | Implemented | TFE default: true |
| `ssh_key_id` | string (Optional) | - | Not Implemented | |
| `tag_names` | list (Optional) | `tag_names` | Implemented | Stored as JSON array. Lowercase letters, numbers, colons, hyphens only |
| `ignore_additional_tag_names` | bool (Optional) | - | Not Implemented | Ignore tags not in config |
| `tags` | map (Optional) | - | Not Implemented | Key-value tags |
| `ignore_additional_tags` | bool (Optional) | - | Not Implemented | Ignore tags not in config |
| `terraform_version` | string (Optional) | `terraform_version` | Implemented | Exact or constraint (e.g. `~> 1.0.0`). Default: latest |
| `trigger_patterns` | list (Optional) | `trigger_patterns` | Implemented | Glob patterns; mutually exclusive with `trigger_prefixes`. Stored as JSON array |
| `trigger_prefixes` | list (Optional) | `trigger_prefixes` | Implemented | Repository-root-relative paths. Stored as JSON array |
| `vcs_repo` | block (Optional) | See below | Implemented | VCS-driven workflow; omit for CLI/API-only |
| `working_directory` | string (Optional) | `working_directory` | Implemented | Relative path. Default: repo root |

### VCS Repo Block

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `identifier` | string (Required) | `vcs_repository` | Implemented | e.g. `owner/repo` |
| `branch` | string (Optional) | `vcs_branch` | Implemented | Default: `main` |
| `github_app_installation_id` | string (Optional) | `vcs_connection_id` | Implemented | Conflicts with `oauth_token_id` |
| `ingress_submodules` | bool (Optional) | `vcs_ingress_submodules` | Implemented | Fetch submodules. Default: false |
| `oauth_token_id` | string (Optional) | VCS connection UUID | Implemented | Maps to StackWeaver VCS connection ID; use when not using GitHub App |
| `tags_regex` | string (Optional) | `vcs_tags_regex` | Implemented | Regex for tag-triggered runs. Conflicts with trigger_patterns/trigger_prefixes |

## Attributes Reference (Computed)

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `id` | string | `id` | Implemented | `ws-` prefixed |
| `resource_count` | int | In response | Implemented | Returned as 0 in API response |
| `html_url` | string | - | Not Implemented | Browsable workspace URL |
| `inherits_project_auto_destroy` | bool | - | Not Implemented | Project auto-destroy inheritance |
| `effective_tags` | map | - | Not Implemented | Tags including project-inherited |
| `hyok_enabled` | bool | - | Not Implemented | (HCP Terraform) HYOK enabled |

## Custom StackWeaver Attributes

| Attribute | Type | Notes |
|-----------|------|-------|
| `run_timeout` | int | Custom extension; run timeout in seconds |
| `drift_detection_schedule` | string | Cron for drift detection |
| `drift_detection_timezone` | string | Timezone for drift schedule |

## API Endpoints

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/v2/organizations/:org/workspaces` | GET | Implemented | List |
| `/api/v2/organizations/:org/workspaces` | POST | Implemented | Create |
| `/api/v2/organizations/:org/workspaces/:name` | GET | Implemented | Get by name |
| `/api/v2/organizations/:org/workspaces/:name` | PATCH | Implemented | Update |
| `/api/v2/organizations/:org/workspaces/:name` | DELETE | Implemented | Delete |
| `/api/v2/workspaces/:id` | GET | Implemented | Get by ID (used by go-tfe ReadByID; required for tfe_workspace_settings read) |
| `/api/v2/workspaces/:id` | PATCH | Implemented | Update by ID (used by go-tfe UpdateByID; required for tfe_workspace_settings) |
| `/api/v2/workspaces/:id` | DELETE | Implemented | Delete by ID; supports `?force=true` |
| `/api/v2/workspaces/:id/actions/safe-delete` | POST | Implemented | TFE safe delete (checks active resources) |
| `/api/v2/workspaces/:id/actions/lock` | POST | Implemented | Lock |
| `/api/v2/workspaces/:id/actions/unlock` | POST | Implemented | Unlock |

## Example TFE Usage

```hcl
resource "tfe_workspace" "test" {
  name         = "my-workspace"
  organization = "my-org"
  project_id   = tfe_project.example.id

  description       = "Example workspace"
  terraform_version = "1.5.0"
  working_directory = "terraform/"
  auto_apply        = true
  queue_all_runs    = true
  assessments_enabled = true

  vcs_repo {
    identifier                 = "owner/repo"
    branch                     = "main"
    github_app_installation_id = tfe_github_app_installation.example.id
  }
}
```

## go-tfe / API Compatibility

- **Create (POST)**: Accepts all TFE workspace attributes in `data.attributes` using kebab-case JSON:API format. Supports `data.attributes.vcs-repo` as nested object (`identifier`, `branch`, `oauth-token-id`, `github-app-installation-id`, `ingress-submodules`, `tags-regex`). VCS connection is resolved via `GetByInstallationID` or by using `oauth-token-id` as VCS connection UUID. Accepts `data.relationships.project.data.id` for project assignment.
- **Update (PATCH)**: Same attribute and `vcs-repo` handling on both org+name and by-ID routes. All boolean attributes accept pointer values (only update when provided).
- **Response**: Workspace payload includes `agent-pool` as relationship (required by tfe_workspace_settings), `setting-overwrites` (execution-mode, agent-pool), `vcs-repo` with `oauth-token-id`, `github-app-installation-id`, `branch`, `ingress-submodules`, and `tags-regex` when VCS is configured. Also includes `actions`, `source`, `resource-count`, `trigger-prefixes`, `trigger-patterns`, `tag-names`, `auto-apply-run-trigger`, `file-triggers-enabled`, `global-remote-state`, `structured-run-output-enabled`, `assessments-enabled`, `source-name`, `source-url`.

## StackWeaver Implementation

**Model**: `backend/internal/models/workspace.go`
**Handler**: `backend/internal/api/v2/handlers/terraform/workspaces.go`
**Repository**: `backend/internal/repository/workspace.go`

## Missing Features

1. **SSH keys**: `ssh_key_id` not implemented.
2. **Auto destroy**: `auto_destroy_at`, `auto_destroy_activity_duration`, `inherits_project_auto_destroy` not implemented.
3. **Tag maps**: `tags` (key-value map format) and `ignore_additional_*` variants not implemented. `tag_names` (list format) IS implemented.
4. **Remote state consumers**: `remote_state_consumer_ids` not implemented (deprecated in TFE).

## Testing

- `stackweaver-tests/tfe-tests/main.tf` — basic workspace data source
- `stackweaver-tests/tfe-tests/agent-pools.tf` — `tfe_workspace` (VCS-backed with `michielvha/stackweaver-tests` + `github_app_installation_id`, and CLI-only), plus `tfe_workspace_settings` for agent execution mode
