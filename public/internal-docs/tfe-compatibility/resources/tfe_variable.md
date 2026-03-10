<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# tfe_variable

**TFE Registry**: https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/variable

**Status**: Implemented

## Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `key` | string | `key` | Implemented | Variable name |
| `value` | string | `value` | Implemented | Variable value |
| `value_wo` | string (Optional, Write-Only) | - | Not Implemented | Write-only; never in state or plan. Mutually exclusive with `value` |
| `category` | string | `category` | Implemented | "terraform" or "env" |
| `description` | string | `description` | Implemented | |
| `hcl` | bool | `hcl` | Implemented | HCL format flag |
| `sensitive` | bool | `sensitive` | Implemented | |
| `workspace_id` | string | `workspace_id` | Implemented | For workspace vars |
| `variable_set_id` | string | `variable_set_id` | Implemented | For varset vars |

## Computed Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `id` | string | `id` (UUID) | Implemented | |
| `readable_value` | string | computed | Implemented | Masked if sensitive |

## API Endpoints

### Workspace Variables
| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/v2/workspaces/:id/vars` | GET | Implemented | List |
| `/api/v2/workspaces/:id/vars` | POST | Implemented | Create |
| `/api/v2/workspaces/:id/vars/:var_id` | GET | Implemented | Get by ID |
| `/api/v2/workspaces/:id/vars/:var_id` | PATCH | Implemented | Update |
| `/api/v2/workspaces/:id/vars/:var_id` | DELETE | Implemented | Delete |

### Variable Set Variables
| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/v2/varsets/:id/relationships/vars` | GET | Implemented | List |
| `/api/v2/varsets/:id/relationships/vars` | POST | Implemented | Create |
| `/api/v2/varsets/:id/relationships/vars/:var_id` | GET | Implemented | Get by ID |
| `/api/v2/varsets/:id/relationships/vars/:var_id` | PATCH | Implemented | Update |
| `/api/v2/varsets/:id/relationships/vars/:var_id` | DELETE | Implemented | Delete |

## Example TFE Usage

```hcl
# Workspace variable
resource "tfe_variable" "aws_region" {
  key          = "AWS_REGION"
  value        = "us-east-1"
  category     = "env"
  workspace_id = tfe_workspace.test.id
}

# Terraform variable
resource "tfe_variable" "instance_type" {
  key          = "instance_type"
  value        = "t3.micro"
  category     = "terraform"
  workspace_id = tfe_workspace.test.id
}

# Sensitive variable
resource "tfe_variable" "api_key" {
  key          = "api_key"
  value        = var.api_key
  category     = "terraform"
  sensitive    = true
  workspace_id = tfe_workspace.test.id
}

# Variable set variable
resource "tfe_variable" "common_var" {
  key             = "COMMON_VAR"
  value           = "shared-value"
  category        = "env"
  variable_set_id = tfe_variable_set.common.id
}
```

## StackWeaver Implementation

**Model**: `backend/internal/models/variable.go`
**Handler**: `backend/internal/api/v2/handlers/terraform/variables.go`
**Repository**: `backend/internal/repository/variable.go`

## value_wo (Write-Only)

TFE supports `value_wo` as a write-only attribute: it is never stored in state and never shown in plan output. Use it for sensitive values (e.g. from external secret managers) when you want to avoid them appearing in Terraform state. Either `value` or `value_wo` can be set, not both. StackWeaver does **not** implement `value_wo`; use `value` with `sensitive = true` and careful state handling instead.

## Known Issues

1. **Drift Detection**: Fixed in January 2026 - `tfe_variable` resources were showing drift due to missing GET endpoint
2. **Variable Precedence**: Workspace vars override variable set vars (TFE-compatible)
3. **value_wo**: Not implemented; use `value` + `sensitive` for secrets

## Testing

Test file: `stackweaver-tests/tfe-tests/variables.tf`
