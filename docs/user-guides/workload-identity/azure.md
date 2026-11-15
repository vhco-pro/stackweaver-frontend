---
title: "Azure"
nav_order: 1
description: "Let OpenTofu runs reach Azure without a client secret: an Entra app registration with a federated credential that trusts Stackweaver."
covers:
  - "backend/internal/executor/identity/azure_oidc.go"
  - "backend/internal/api/v2/handlers/azure_oidc_configuration.go"
  - "backend/internal/api/v2/handlers/oidc_configuration_dispatch.go"
---

# Configure workload identity for Azure

Keyless auth to Azure uses an Entra ID App Registration with a federated credential that trusts Stackweaver. Check [the prerequisites](./README.md#before-you-start) first.

## Step 1: Create an App Registration in Azure Entra ID

1. Sign in to the [Azure Portal](https://portal.azure.com).
2. Navigate to **Microsoft Entra ID** > **App registrations** > **New registration**.
3. Fill in the form:
   - **Name**: something descriptive, such as `stackweaver-automation`.
   - **Supported account types**: "Accounts in this organizational directory only (Single tenant)".
   - **Redirect URI**: leave blank.
4. Click **Register**.
5. On the **Overview** page, note these values:

   | TFE provider argument | Azure Portal label |
   |-----------------------|--------------------|
   | `client_id` | Application (client) ID |
   | `tenant_id` | Directory (tenant) ID |
   | `subscription_id` | Found under **Subscriptions** in the portal |

## Step 2: Assign Azure RBAC Roles

Grant the service principal only the permissions the workload needs, at the smallest useful scope. Select it under **Access control (IAM) > Add role assignment** on the target resource group, subscription or management group.

`Contributor` can manage resources but cannot assign Azure RBAC roles. If the workload creates role assignments, grant the corresponding role-assignment permissions too, for example a suitably scoped Role Based Access Control Administrator role. `Owner` is a broader option, not a requirement for all automation. See [Azure's privileged built-in roles](https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles/privileged).

> [!WARNING]
> A federated credential authenticates the principal; it does not limit its Azure permissions. Avoid subscription-wide Owner access unless the workload requires that scope and authority.

## Step 3: Configure a Federated Identity Credential

1. In the App Registration, go to **Certificates & secrets** > **Federated credentials** > **Add credential**.
2. For **Federated credential scenario**, select **Other issuer**.
3. Fill in the fields:

   | Field | Value |
   |-------|-------|
   | **Issuer** | The public URL of your Stackweaver instance, e.g. `https://stackweaver.example.com` |
   | **Subject identifier** | A subject from [Token subjects and claims](./token-subjects.md) |
   | **Name** | A descriptive label, e.g. `stackweaver-my-org-plan` |
   | **Audience** | `api://AzureADTokenExchange` |

4. Click **Add**. Create one credential for `run_phase:plan` and one for `run_phase:apply` to cover the full OpenTofu run lifecycle.

## Step 4: Register the Configuration in Stackweaver

```hcl
resource "stackweaver_azure_oidc_configuration" "main" {
  organization    = "your-org-name"
  client_id       = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" # Application (client) ID
  subscription_id = "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy" # Azure subscription ID
  tenant_id       = "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz" # Directory (tenant) ID
}
```

After apply, confirm the registration exists and its returned identifiers match the intended target before starting a run.

### Register through the API

Set `STACKWEAVER_URL` to the origin without a trailing slash, `STACKWEAVER_TOKEN` to an authorized organization credential, and `ORG` to its name. After creating Azure trust, save the identifiers as `azure-oidc.json`:

```json
{
  "data": {
    "type": "azure-oidc-configurations",
    "attributes": {
      "client-id": "11111111-1111-4111-8111-111111111111",
      "subscription-id": "22222222-2222-4222-8222-222222222222",
      "tenant-id": "33333333-3333-4333-8333-333333333333"
    }
  }
}
```

Replace every sample UUID with the matching Azure identifier, then submit:

```bash
curl --fail-with-body --silent --show-error \
  --header "Authorization: Bearer $STACKWEAVER_TOKEN" \
  --header 'Content-Type: application/vnd.api+json' \
  --data @azure-oidc.json \
  "$STACKWEAVER_URL/api/v2/organizations/$ORG/oidc-configurations"
```

Expect an `azure-oidc-configurations` resource with an ID. List the registrations to verify the saved identifiers before retrying an uncertain create. The same endpoint dispatches AWS, GCP and Vault bodies by their JSON:API type; use [the API explorer](/docs/api-reference/explorer) for their complete schemas and the target-specific HCL examples for declarative management.

## Step 5: Configure the azurerm Provider in Your Workspaces

Configure the `azurerm` provider to use OIDC. Do not set `client_secret` or `use_msi`:

```hcl
provider "azurerm" {
  features {}
  use_oidc = true
}
```

The job receives these environment variables automatically:

| Variable | Description |
|----------|-------------|
| `TFC_WORKLOAD_IDENTITY_TOKEN` | Short-lived RS256 JWT signed by Stackweaver |
| `ARM_OIDC_TOKEN` | Same JWT (read by the `azurerm` and `azapi` providers) |
| `ARM_CLIENT_ID` | The `client_id` you registered |
| `ARM_SUBSCRIPTION_ID` | The `subscription_id` you registered |
| `ARM_TENANT_ID` | The `tenant_id` you registered |
| `ARM_USE_OIDC` | `true` |

## Verify a workload

Use a test workspace and review a plan with the intended identity. Check that Azure accepts the issuer, exact subject and audience and permits the required read operations. Confirm apply-phase trust separately before approving changes: plan and apply have different subjects. A saved registration alone does not prove federation or resource permissions work.

If Azure rejects the token or a role assignment fails, see [Troubleshooting](./troubleshooting.md).
