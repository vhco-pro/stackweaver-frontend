<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Terraform Variables Testing Guide

This guide explains how to test the Terraform variables integration in StackWeaver.

## Overview

StackWeaver supports two types of variables for Terraform runs:

1. **Workspace Variables**: Variables defined directly on a workspace
2. **Variable Sets**: Reusable groups of variables that can be applied to multiple workspaces

Both types are automatically included in Terraform runs. **Workspace variables override variable set variables** if they have the same key.

The `stackweaver-tests` repository includes a test variable (`test_var`) and an output (`test_var_output`) to verify the integration is working.

## Sensitive Variables

Variables marked as **Sensitive** are:
- Encrypted at rest in the database
- Masked in the UI (displayed as `••••••••`)
- Decrypted only when needed for Terraform runs
- Never exposed in API responses (values are masked)

**Note**: The sensitive toggle works for both workspace variables and variable set variables.

### Editing Sensitive Variables

Sensitive variables can be edited after creation:
- **Key**: Can be modified (must be unique within the workspace)
- **Value**: Can be updated (the current value is hidden in the UI, but you can enter a new value)
- **Description**: Can be modified
- **Category**: Can be changed between "terraform" and "env"
- **HCL**: Can be toggled (for Terraform variables only)
- **Sensitive flag**: Can be toggled (changing from sensitive to non-sensitive will decrypt the value)

When editing a sensitive variable, the value field will show a placeholder indicating that the current value is hidden. Enter a new value to update it.

## Quick Test

### Step 1: Set the Test Variable

Use the provided script to set the test variable:

```bash
cd stackweaver-tests

# Set required environment variables
export TFE_TOKEN="your-tfe-token"
export STACKWEAVER_HOST="your-stackweaver-host:port"  # e.g., "localhost:8080" or "stack.truyens.pro"
export ORG_NAME="your-org-name"

# Set the test variable (with optional custom value)
./test-variable.sh <workspace-id> "my-test-value"
```

The script will:
- Create the `test_var` variable in your workspace
- Set it to the value you provide (or a timestamped default)
- Update it if it already exists

### Step 2: Verify in StackWeaver

1. Navigate to your workspace in StackWeaver UI
2. Go to the **Variables** tab
3. Verify `test_var` is listed with your value

### Step 3: Trigger a Run

1. In your workspace, click **Create Run**
2. Select **Plan Only** or **Plan and Apply**
3. Wait for the run to complete

### Step 4: Check the Output

In the run output, look for:

```
Outputs:

test_var_output = "my-test-value"
```

If you see your custom value in the output, the variable integration is working correctly! ✅

## Manual Testing (Alternative)

If you prefer to set the variable manually via the UI:

1. Navigate to your workspace → **Variables** tab
2. Click **Add Variable**
3. Set:
   - **Key**: `test_var`
   - **Value**: Any string value (e.g., `"test-value-123"`)
   - **Category**: `terraform`
   - **Sensitive**: No
   - **Encrypted**: No
4. Save the variable
5. Trigger a run and check the `test_var_output` in the results

## Troubleshooting

### Variable Not Appearing in Output

- **Check variable category**: Must be `terraform` (not `env`)
- **Check variable key**: Must be exactly `test_var` (case-sensitive)
- **Check run logs**: Verify variables are being written to `terraform.tfvars`
- **Check workspace**: Ensure you're using the correct workspace

### Script Errors

- **TFE_TOKEN not set**: Export your TFE token: `export TFE_TOKEN="your-token"`
- **ORG_NAME not set**: Export your org name: `export ORG_NAME="your-org"`
- **Workspace ID**: Get the workspace ID from the StackWeaver UI (workspace detail page)

### Wrong Value in Output

- Verify the variable value in the StackWeaver UI
- Check that you're looking at the correct run
- Ensure the variable was set before triggering the run

## Testing Variable Sets

Variable sets allow you to define variables once and reuse them across multiple workspaces. They are automatically included in Terraform runs.

### Creating a Variable Set

1. Navigate to **Organization Settings** → **Variable Sets**
2. Click **Create Variable Set**
3. Set the scope (Organization or Workspace)
4. Add variables to the set (ensure `category` is `terraform`)
5. Assign the variable set to your workspace (if workspace-scoped)

### Testing Variable Set Variables

1. **Create a variable set** with a test variable:
   - Key: `test_var_from_set`
   - Value: `"value-from-variable-set"`
   - Category: `terraform`
   - Sensitive: No

2. **Assign the variable set** to your workspace (if workspace-scoped)

3. **Add an output** in your Terraform configuration:
   ```hcl
   output "test_var_from_set_output" {
     value = var.test_var_from_set
   }
   ```

4. **Trigger a run** and verify the output shows the variable set value

5. **Test precedence**: Create a workspace variable with the same key (`test_var_from_set`) and verify that the workspace variable value overrides the variable set value in the output

### Variable Set Categories

- **`terraform`**: Variables passed to Terraform (included in runs)
- **`env`**: Environment variables (not currently used in Terraform runs)

Only variables with `category = "terraform"` are included in Terraform runs.

## Related Files

- Test variable definition: `stackweaver-tests/variables.tf`
- Test output: `stackweaver-tests/main.tf`
- Test script: `stackweaver-tests/test-variable.sh`
