<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Azure OIDC Configuration

Azure OIDC (OpenID Connect) configuration enables keyless authentication from Stackweaver-managed Terraform and Ansible runs to Azure. Instead of storing a long-lived client secret in your workspace variables, Stackweaver issues a short-lived signed JWT at run time, which Azure accepts in exchange for an access token via workload identity federation.

## How It Works

1. Stackweaver acts as an OIDC identity provider, exposing a signing key at `/.well-known/jwks` and a discovery document at `/.well-known/openid-configuration`.
2. You create an Azure App Registration and configure a federated credential that trusts Stackweaver as the issuer.
3. You register the App Registration's identifiers in Stackweaver using the TFE Terraform provider.
4. At run time, the runner generates a short-lived JWT scoped to the specific workspace and run phase, and injects it alongside the Azure identifiers as environment variables. The `azurerm` Terraform provider and Ansible Azure collection pick these up automatically, so no stored secret is needed.

## Prerequisites

- You must have permission to create App Registrations and assign RBAC roles in your Azure tenant.
- You must be an organization owner in Stackweaver, or have the `manage-vcs-settings` permission.
- You must have the `hashicorp/tfe` Terraform provider configured against your Stackweaver instance.

## Step 1: Create an App Registration in Azure Entra ID

1. Sign in to the [Azure Portal](https://portal.azure.com).
2. Navigate to **Microsoft Entra ID** > **App registrations**.
3. Click **New registration**.
4. Fill in the form:
   - **Name**: something descriptive, such as `stackweaver-automation`.
   - **Supported account types**: "Accounts in this organizational directory only (Single tenant)".
   - **Redirect URI**: leave blank.
5. Click **Register**.
6. On the **Overview** page, note these three values:

   | TFE provider argument | Azure Portal label |
   |-----------------------|--------------------|
   | `client_id` | Application (client) ID |
   | `tenant_id` | Directory (tenant) ID |
   | `subscription_id` | Found under **Subscriptions** in the portal |

## Step 2: Assign Azure RBAC Roles

The App Registration needs sufficient permissions to create and manage Azure resources on behalf of your Terraform and Ansible automation.

Because Terraform often needs to assign roles to resources (e.g., granting a managed identity access to a Key Vault), the `Contributor` role is not sufficient; role assignment requires `Owner`.

1. Navigate to the **Subscription** (or **Management Group** for cross-subscription scope) where your automation will run.
2. Go to **Access control (IAM)** > **Add role assignment**.
3. Select **Owner**.
4. Under **Assign access to**, select **User, group, or service principal**, search for the App Registration name from Step 1, and select it.
5. Click **Review + assign**.

> [!WARNING]
> `Owner` at subscription scope grants full control over all resources and role assignments in that subscription. Assign it only to service principals, not to user accounts, and revoke it if the principal is no longer needed. If your automation never manages RBAC assignments, `Contributor` is a safer alternative.

For automation spanning multiple subscriptions, assign the role at the **Management Group** level instead of per subscription.

## Step 3: Configure a Federated Identity Credential

A federated credential tells Azure which OIDC tokens it should trust for this App Registration. You configure one credential per scope you want to allow. Because `plan` and `apply` produce different subjects, you need two credentials per workspace (or use wildcard subjects if your tenant supports them).

1. In the App Registration, go to **Certificates & secrets** > **Federated credentials**.
2. Click **Add credential**.
3. For **Federated credential scenario**, select **Other issuer**.
4. Fill in the fields:

   | Field | Value |
   |-------|-------|
   | **Issuer** | The public URL of your Stackweaver instance, e.g. `https://stackweaver.example.com` |
   | **Subject identifier** | See subject format below |
   | **Name** | A descriptive label, e.g. `stackweaver-my-org-plan` |
   | **Audience** | `api://AzureADTokenExchange` |

5. Click **Add**.

### Subject Format

Stackweaver embeds a subject in every workload identity token. The format depends on the resource type:

**Terraform workspace runs** (plan/apply):

```
organization:<org-name>:project:<project-name>:workspace:<workspace-name>:run_phase:<plan|apply>
```

For example, for the `apply` phase of the `production` workspace in project `infra` under organization `main`:

```
organization:main:project:infra:workspace:production:run_phase:apply
```

Create one federated credential for `run_phase:plan` and one for `run_phase:apply` to cover the full Terraform run lifecycle.

**Ansible inventory sync** (StackWeaver-native format, no `run_phase:`):

```
organization:<org-name>:project:<project-name>:inventory:<name>:sync
```

The `<name>` depends on the inventory type:

- **VCS-backed inventories** use the **inventory name**. For example, a VCS inventory called `azure-vms` in project `infra`:

  ```
  organization:main:project:infra:inventory:azure-vms:sync
  ```

- **UI-configured (dynamic) inventories** use the **source name**, not the inventory name. This allows a single inventory to have multiple cloud sources, each with its own federated credential. For example, a source called `azure-prod` on an inventory in project `infra`:

  ```
  organization:main:project:infra:inventory:azure-prod:sync
  ```

Create one federated credential per VCS inventory or per UI-configured source that should authenticate via OIDC. The `<project-name>` is the StackWeaver project the resource belongs to, or `default` for org-scoped inventories without a project.

**Ansible job execution** (StackWeaver-native format):

```
organization:<org-name>:project:<project-name>:job:<job-name>:run
```

For example, for a job named `deploy-app` in project `infra`:

```
organization:main:project:infra:job:deploy-app:run
```

## Step 4: Register the Configuration in Stackweaver

Add a `tfe_azure_oidc_configuration` resource to your TFE provider configuration. Stackweaver stores the three identifiers and uses them to populate Azure authentication environment variables on every run in that organization.

```hcl
resource "tfe_azure_oidc_configuration" "main" {
  organization    = "your-org-name"
  client_id       = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # Application (client) ID
  subscription_id = "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"  # Azure subscription ID
  tenant_id       = "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz" # Directory (tenant) ID
}
```

After `terraform apply`, Stackweaver returns an `id` in the form `azoidc-{16-char-alphanumeric}`.

## Step 5: Configure the azurerm Provider in Your Workspaces

In the Terraform code that runs inside your Stackweaver workspaces, configure the `azurerm` provider to use OIDC. Do not set `client_secret` or `use_msi`:

```hcl
provider "azurerm" {
  features {}
  use_oidc = true
}
```

The runner injects the following environment variables automatically, which the provider reads at run time:

| Variable | Description |
|----------|-------------|
| `TFC_WORKLOAD_IDENTITY_TOKEN` | Short-lived RS256 JWT signed by Stackweaver |
| `ARM_OIDC_TOKEN` | Same JWT (read by the `azurerm` and `azapi` providers) |
| `ARM_CLIENT_ID` | The `client_id` you registered in Step 4 |
| `ARM_SUBSCRIPTION_ID` | The `subscription_id` you registered in Step 4 |
| `ARM_TENANT_ID` | The `tenant_id` you registered in Step 4 |
| `ARM_USE_OIDC` | `true` (instructs the `azurerm` provider to use OIDC instead of a secret) |

No workspace variables are needed for Azure authentication when OIDC is configured for the organization.

## Operator Configuration (deploy/oidc.env)

Two variables in `deploy/oidc.env` control how Stackweaver issues OIDC tokens. Copy `deploy/oidc.env.example` to `deploy/oidc.env` and fill in the values.

| Variable | Required | Description |
|----------|----------|-------------|
| `OIDC_SIGNING_KEY` | **Yes** | Base64-encoded RSA-2048 private key used to sign workload identity tokens. |
| `OIDC_ISSUER_URL` | **Yes** | The public URL embedded in tokens and the OIDC discovery document. Must match the **Issuer** field you configured in the Azure federated credential exactly (no trailing slash). |

### Why the signing key is required

Stackweaver runs two separate containers that participate in OIDC: the API (which serves the JWKS public key endpoint that Azure fetches) and the runner (which signs the workload identity token injected into each run). If `OIDC_SIGNING_KEY` is not set, each container auto-generates its own independent RSA key pair on startup. The runner then signs tokens with its key, while the API advertises a completely different public key in the JWKS endpoint. Azure fetches the JWKS, cannot find a key matching the `kid` in the runner's token, and rejects it with `AADSTS700211: No matching federated identity record found`.

Setting a shared `OIDC_SIGNING_KEY` ensures both containers use the same key pair, so the `kid` in every token matches the public key Azure retrieves from the JWKS endpoint.

### Why the key must be base64-encoded

Docker Compose `env_file` does not support multi-line values. A raw PEM key spans multiple lines and cannot be stored directly in an env file. The base64-encoded format collapses the entire key to a single line that `env_file` can read correctly.

### Generating the signing key

The simplest approach is the built-in make target:

```bash
make setup-oidc-key
```

This generates a 2048-bit RSA key, base64-encodes it, and appends it to `deploy/oidc.env` automatically.

Alternatively, generate and encode manually:

```bash
openssl genrsa 2048 | base64 -w 0
# Copy the single-line output and set it as OIDC_SIGNING_KEY in deploy/oidc.env
```

After editing `oidc.env`, run `make fresh-backend` to restart the API and runner with the new configuration.

## Troubleshooting

### `403 Forbidden` when creating the OIDC configuration

Your Stackweaver token does not have the `manage-vcs-settings` permission. Perform the configuration as an organization owner, or ask an owner to grant you that permission.

### Azure returns `AADSTS70021: No matching federated identity record found`

The issuer or subject in the token does not match any federated credential on the App Registration. Check the following:

- The **Issuer** in the Azure federated credential matches `OIDC_ISSUER_URL` (or `API_URL` if that variable is not set) exactly, with no trailing slash.
- The **Subject** matches the run that failed. For Terraform runs the subject is `organization:<org>:project:<project>:workspace:<workspace>:run_phase:<plan|apply>`; `plan` and `apply` phases have different subjects and each needs its own federated credential. For Ansible inventory sync the subject is `organization:<org>:project:<project>:inventory:<name>:sync` where `<name>` is the inventory name (VCS) or source name (UI-configured). Note: there is no `run_phase:` because StackWeaver-native resources use a different format than TFE. For Ansible jobs the subject is `organization:<org>:project:<project>:job:<job_name>:run`.
- The **Audience** is `api://AzureADTokenExchange`.

### Azure returns `AADSTS700211` even though the issuer and subject look correct

The API and runner are using different RSA keys. This happens when `OIDC_SIGNING_KEY` is not set: each container auto-generates its own key on startup, so the `kid` in the runner's token does not match any key in the JWKS endpoint served by the API. Generate a shared key with `make setup-oidc-key`, add it to `deploy/oidc.env`, and run `make fresh-backend`.

### Tokens are rejected after a Stackweaver restart

`OIDC_SIGNING_KEY` is not set, so a new RSA key pair was generated on startup. Azure fetches the new public key from the JWKS endpoint automatically, but any in-flight runs that received a token signed with the old key will fail. Set a stable `OIDC_SIGNING_KEY` in `deploy/oidc.env` to prevent this.

### `Contributor` role is not sufficient

If Terraform receives an `AuthorizationFailed` error when attempting to create role assignments (e.g., for managed identities), the App Registration needs the `Owner` role, not `Contributor`. Update the role assignment from Step 2.
