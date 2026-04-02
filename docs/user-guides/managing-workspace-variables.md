---
description: "Guide for setting up Terraform variables across workspaces, variable sets, and projects"
covers:
  - "core/services/variable/**"
  - "backend/internal/api/v2/handlers/variable*"
---

# Managing Workspace Variables

Learn how to set up, organize, and manage variables across your Terraform workspaces and projects.

## Overview

Variables let you customize Terraform configurations without changing code. This separation of configuration from code is essential for managing infrastructure across environments, securely handling secrets, creating reusable modules, and enabling team collaboration through centralized configuration management.

Instead of hardcoding values like instance types or region names in your Terraform files, you define variables and set their values in StackWeaver. This means the same code can deploy to any environment with different settings by simply changing the variables.

## Variable Scopes

StackWeaver supports variables at different levels:

1. **Workspace variables**: Apply only to one workspace
2. **Variable sets**: Reusable groups of variables you can attach to multiple workspaces
3. **Terraform variables**: Variables defined in your `.tf` files

### When to Use What

Each variable scope serves different purposes:

| Variable Type | Best For | Example |
|--------------|----------|---------|
| **Workspace variables** | Workspace-specific overrides, one-off customizations, testing values | `instance_type = "t2.large"` for just this one workspace |
| **Variable sets** | Shared configurations across workspaces, environment-specific settings (dev/staging/prod), common values used by many workspaces | A "production-defaults" set attached to all production workspaces |
| **Terraform variables** | Default values, documentation, type validation | Default instance type in your `.tf` files with descriptions |

Most teams use a combination: variable sets for shared environment values, workspace variables for workspace-specific overrides, and Terraform variables for defaults and documentation.

## Creating Workspace Variables

To add variables directly to a workspace, open your workspace and navigate to the "Variables" tab. Click "Add Variable" and fill in the details.

| Field | Description | Example |
|-------|-------------|---------|
| **Key** | The variable name (must match what Terraform expects) | `instance_type` |
| **Value** | The variable value | `t2.small` |
| **Category** | Terraform variable (passed to Terraform) or environment variable (available as env var) | Usually "Terraform variable" |
| **Sensitive** | Encrypt and hide this value in the UI | Check for passwords, API keys |
| **HCL** | Parse the value as HCL code (for lists, maps) | Check for `["list", "items"]` |

> [!TIP]
> Variable keys should match what your Terraform code expects. Check your `.tf` files for variable declarations like `variable "instance_type" {}`.

Once you've filled in the details, save the variable and it will be available for your next Terraform run.

## Working with Variable Sets

Variable sets let you manage groups of related variables together.

### Creating a Variable Set

1. Go to your organization's Variable Sets
2. Click "New Variable Set"
3. Give it a name like "production-defaults" or "common-settings"
4. Add variables the same way as workspace variables
5. Save the set

### Attaching Variable Sets to Workspaces

Once created, you can attach a variable set to one or more workspaces:

1. Open a workspace
2. Go to the Variables tab
3. Click "Attach Variable Set"
4. Select the set you want to use
5. The variables from the set are now available to the workspace

### Variable Precedence

If the same variable exists in multiple places, StackWeaver resolves conflicts using this priority order (highest priority wins):

| Priority | Variable Source | Example |
|----------|----------------|---------|
| **1 (Highest)** | Workspace variables | `instance_type = "t2.large"` in workspace |
| **2** | Variable set variables | `instance_type = "t2.medium"` in attached set |
| **3 (Lowest)** | Terraform variable defaults | `default = "t2.micro"` in your `.tf` file |

By default, workspace variables override variable set values. However, variable sets have a **Priority** option: when enabled, the variable set's values take precedence over workspace variables. This is useful for enforcing organization-wide standards (e.g. required tags) that individual workspaces should not be able to override.

## Variable Categories

Variables fall into two categories, each serving different purposes:

| Category | How It's Used | When to Use |
|----------|---------------|-------------|
| **Terraform variables** | Written to `stackweaver.auto.tfvars` and passed to Terraform | Most variables - instance types, region names, resource counts |
| **Environment variables** | Set as environment variables during runs | Provider credentials (`AWS_ACCESS_KEY_ID`), tools that read env vars, secrets providers need directly |

Most of the time, you'll use Terraform variables since they're directly consumed by your Terraform code. Environment variables are mainly for provider configuration or when external tools need to read values from the environment.

## How StackWeaver passes variables to Terraform

StackWeaver writes workspace and variable set values (Terraform category) to **`stackweaver.auto.tfvars`** in the run directory. Terraform automatically loads `*.auto.tfvars` files, and our file is loaded after `terraform.tfvars`, so our values override the repo’s `terraform.tfvars` for any overlapping keys.

**Your `terraform.tfvars` is not overwritten.** If you keep `terraform.tfvars` in your repository with default or shared values, those values stay. StackWeaver only adds or overrides the variables we manage in `stackweaver.auto.tfvars`.

> [!IMPORTANT]  
> **Do not edit `stackweaver.auto.tfvars` in your repo.** StackWeaver creates and overwrites this file on every run. Put your own defaults in `terraform.tfvars` or other `*.auto.tfvars` files you control.

## Platform variables (workspace, project, organization)

StackWeaver injects **platform variables** as **environment variables** (not in `stackweaver.auto.tfvars`). They are always available during runs and will not trigger Terraform “value for undeclared variable” warnings if you do not use them. This follows the same pattern as Terraform Cloud’s `TFC_WORKSPACE_ID`, `TFC_RUN_ID`, and similar: values are provided in the environment so configs that do not declare or use them keep working without warnings.

| Variable | Description |
|----------|-------------|
| `TF_WORKSPACE_ID` | The workspace ID |
| `TF_WORKSPACE_NAME` | The workspace name |
| `TF_PROJECT_ID` | The project ID |
| `TF_PROJECT_NAME` | The project name |
| `TF_ORGANIZATION_ID` | The organization ID |
| `TF_ORGANIZATION_NAME` | The organization name |

### Using platform variables in Terraform

Terraform and OpenTofu do **not** have an `env()` or `getenv()` function. To use arbitrary environment variables in expressions, you need the **`external` data source**: it runs a program that prints JSON to stdout, and you use `data.external.<name>.result` in your config. That’s the usual workaround. Below: a small script (cleanest) or a self-contained inline variant.

**Option 1: Script file (cleanest)**

Put a small script in your repo (e.g. `get-platform-env.sh` next to your `.tf` files):

```bash
#!/bin/sh
# get-platform-env.sh - outputs StackWeaver platform env vars as JSON for data.external
cat <<EOF
{
  "workspace_id": "$TF_WORKSPACE_ID",
  "workspace_name": "$TF_WORKSPACE_NAME",
  "project_id": "$TF_PROJECT_ID",
  "organization_id": "$TF_ORGANIZATION_ID"
}
EOF
```

Then in Terraform:

```hcl
data "external" "platform" {
  program = ["sh", "${path.module}/get-platform-env.sh"]
}

# Use in resources or outputs
resource "aws_instance" "example" {
  tags = {
    StackWeaverWorkspace = data.external.platform.result.workspace_id
  }
}

output "workspace_id" {
  value = data.external.platform.result.workspace_id
}
```

**Option 2: Self-contained (no extra file)**

If you prefer not to add a script, you can inline it with `sh -c` and a heredoc (avoids the `printf` escape maze):

```hcl
data "external" "platform" {
  program = ["sh", "-c", <<-EOT
    cat <<EOF
{"workspace_id":"$TF_WORKSPACE_ID","workspace_name":"$TF_WORKSPACE_NAME"}
EOF
  EOT
  ]
}
```

**Provisioners**

In `local-exec` (and similar) the `command` runs in a shell that already has the platform env vars, so you can use them directly:

```hcl
resource "null_resource" "example" {
  provisioner "local-exec" {
    command = "echo Running in workspace $TF_WORKSPACE_ID"
  }
}
```

## Sensitive Variables

Mark variables as sensitive when they contain:

- Passwords
- API keys
- Private keys
- Tokens
- Any other secret data

Sensitive variables are:
- Encrypted at rest
- Hidden from UI display (shown as `***` or masked)
- Not included in logs or outputs
- Only accessible to users with workspace permissions

> [!IMPORTANT]
> Never commit sensitive values to your Terraform code. Always use StackWeaver variables for secrets.

## Variable Values and HCL

By default, variable values are treated as strings. If you check "HCL", StackWeaver will parse the value as HCL code.

Use HCL parsing for:
- Lists: `["item1", "item2"]`
- Maps: `{key = "value"}`
- Complex structures: `{subkey = ["value"]}`

Leave HCL unchecked for:
- Simple strings
- Numbers (they'll be converted automatically)
- Boolean values (use `true` or `false` as strings)

### Examples

**String variable (HCL unchecked):**
```
Key: environment_name
Value: production
```

**List variable (HCL checked):**
```
Key: allowed_cidrs
Value: ["10.0.0.0/8", "192.168.0.0/16"]
```

**Map variable (HCL checked):**
```
Key: tags
Value: {Environment = "prod", Team = "platform"}
```

## Organizing Variables

Good variable organization makes management easier:

### Use Descriptive Names

Bad: `var1`, `value`, `setting`  
Good: `instance_type`, `database_password`, `vpc_cidr`

### Group Related Variables

Create variable sets for logical groups:
- Environment settings (dev, staging, prod)
- Application-specific configs
- Infrastructure-wide defaults

### Document Variables

Use variable descriptions in your Terraform code:

```hcl
variable "instance_type" {
  description = "EC2 instance type for web servers"
  type        = string
  default     = "t2.micro"
}
```

## Best Practices

**Keep secrets in StackWeaver**

Never hardcode sensitive values in your Terraform files. Always use StackWeaver variables marked as sensitive.

**Use variable sets for shared configs**

If multiple workspaces use the same values, create a variable set instead of duplicating variables.

**Version control your Terraform variables**

Keep variable declarations (without values) in your code. This documents what variables are expected and their types.

**Test with different variable sets**

Use different variable sets for testing before applying to production.

**Review variable usage regularly**

Periodically review which variables are used where. Remove unused variables and consolidate duplicates.

## Troubleshooting

**Variable not found error**

- Check the variable key matches what Terraform expects (case-sensitive)
- Verify the variable category (Terraform vs environment)
- Ensure the variable set is attached to the workspace

**Variable has wrong type**

- Check if HCL parsing is enabled for complex types
- Verify the value format matches the expected type
- Review Terraform variable type declarations

**Sensitive variable visible in output**

- Check that the variable is marked as sensitive
- Verify it's not being output in your Terraform code
- Review run logs to ensure masking is working

## Next Steps

- Read about [workspace editing](../features/terraform/workspace-editing.md)
- Explore [VCS path filtering](../features/terraform/vcs-path-filtering.md) for multi-environment workflows
