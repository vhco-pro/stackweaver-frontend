# Azure DevOps VCS Integration

This guide walks you through connecting Azure DevOps repositories to Stackweaver so it can trigger Terraform runs from code pushes and pull requests.

The integration uses **Microsoft Entra ID OAuth2** (the current Microsoft identity platform) to authenticate with Azure DevOps. The older Azure DevOps-specific OAuth flow was deprecated in April 2025 and is no longer available for new applications.

## Prerequisites

You need an Azure DevOps organization with at least one project containing a Git repository. You also need permission to register applications in Microsoft Entra ID (Azure Active Directory), either as an Entra ID administrator or with permission granted by one.

## Step 1: Register an Application in Microsoft Entra ID

Registration is done in the **Azure Portal**, not in Azure DevOps.

Before starting, verify that the Azure DevOps enterprise application exists in your tenant by running:

```bash
az ad sp show --id 499b84ac-1321-427f-aa17-267ca6975798
```

If the command returns an error, the Azure DevOps service principal has not been provisioned in your tenant yet. Create it with:

```bash
az ad sp create --id 499b84ac-1321-427f-aa17-267ca6975798
```

This is a one-time step per tenant. It does not affect any Azure DevOps organizations or users. Without this, Entra ID cannot resolve API permissions for the Azure DevOps resource and authorization will fail with AADSTS650052.

1. Sign in to the [Azure Portal](https://portal.azure.com).
2. Navigate to **Microsoft Entra ID** → **App registrations** → **New registration**.
3. Fill in the registration form:
   - **Name**: `Stackweaver` (or any descriptive name).
   - **Supported account types**: Select **Accounts in any organizational directory (Any Microsoft Entra ID tenant – Multitenant)**. This allows users from any Azure DevOps organization to connect, which is required if you host Stackweaver for multiple teams or clients. If Stackweaver serves only a single Entra tenant, you may choose **Accounts in this organizational directory only** instead.
   - **Redirect URI**: Select **Web** and enter:
     ```
     http://localhost:5173/vcs/azure-devops/callback
     ```
     For production deployments, replace `localhost:5173` with your Stackweaver frontend domain.
4. Click **Register**.
5. On the resulting overview page, copy the following values; you will need them later:
   - **Application (client) ID**: this is your `AZURE_DEVOPS_CLIENT_ID`
   - **Directory (tenant) ID**: only needed if you chose single-tenant in the previous step

## Step 2: Add API Permissions for Azure DevOps

After registration, grant the app permission to read Azure DevOps repositories.

1. In the app registration, go to **API permissions** → **Add a permission**.
2. Select **Azure DevOps** from the list of APIs. If it does not appear immediately, search for it.
3. Select **Delegated permissions** (the app acts on behalf of the signed-in user).
4. Select the following permissions:
   - **Code (read)** (`vso.code`): read source code, commits, and branches.
   - **Code (status)** (`vso.code_status`): read and write commit and pull request status. Required for PR status checks (showing plan results on pull requests).
   - **Project and team (read)** (`vso.project`): read projects, required to list repositories across projects.
5. Click **Add permissions**.

You do not need to click **Grant admin consent** for these delegated permissions. Each user grants consent when they first authorize Stackweaver.

Service hook subscriptions (used for webhook auto-registration) are covered automatically by `vso.code`. According to the [Azure DevOps scope hierarchy](https://learn.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/oauth?view=azure-devops#available-scopes), `vso.code` inherits from `vso.hooks_write`. Do not add `vso.hooks_write` or `vso.hooks` as separate permissions; these scopes are no longer public in Entra ID and will cause an AADSTS650053 authorization error if explicitly requested.

## Step 3: Create a Client Secret

Stackweaver needs a client secret to exchange authorization codes for tokens.

1. In the app registration, go to **Certificates & secrets** → **New client secret**.
2. Add a description (e.g., `Stackweaver production`) and set an expiration period. Microsoft recommends 12 months or less. Note the expiration date; you must rotate this secret before it expires or the integration stops working.
3. Click **Add**.
4. **Copy the secret Value immediately.** It is only shown once. If you navigate away, you must create a new secret.

## Step 4: Set Environment Variables

Add the following to `deploy/vcs.env`:

```bash
# Public base URL of the Stackweaver API — used to auto-register webhook subscriptions.
# Must be reachable from Azure DevOps. For local development, use a tunnel URL (see Step 7).
STACKWEAVER_WEBHOOK_BASE_URL=https://your-stackweaver-domain:8022

# Azure DevOps — Microsoft Entra ID OAuth2
AZURE_DEVOPS_CLIENT_ID=<Application (client) ID from Step 1>
AZURE_DEVOPS_CLIENT_SECRET=<Secret value from Step 3>
AZURE_DEVOPS_REDIRECT_URI=http://localhost:5173/vcs/azure-devops/callback

# Leave AZURE_DEVOPS_TENANT_ID unset (or set to "common") for multi-tenant.
# Set to your specific Entra tenant ID if you chose single-tenant in Step 1.
# AZURE_DEVOPS_TENANT_ID=common
```

The redirect URI must exactly match the URI registered in Step 1. Common mismatches include trailing slashes, `http` vs `https`, and different port numbers.

Replace `your-stackweaver-domain:8022` with the public hostname and port of your Stackweaver API. For local development, see Step 7 for how to use a tunnel.

## Step 5: Restart the API Service

After setting the environment variables, restart the API service to load the new configuration:

```bash
make fresh-backend
```

You can verify the Azure DevOps integration is enabled by checking the API logs:

```bash
docker compose -f deploy/docker-compose.yml logs api | grep -i "azure"
```

## Step 6: Create a VCS Connection in Stackweaver

1. Open Stackweaver in your browser.
2. Navigate to your organization's **Settings** → **VCS Connections**.
3. Click **Add VCS Connection** and select **Azure DevOps**.
4. Enter your Azure DevOps organization name (the subdomain from `dev.azure.com/<org>`).
5. You are redirected to Microsoft for authorization. Sign in with an account that has access to the Azure DevOps organization you want to connect.
6. Review and accept the requested permissions.
7. After authorization, you are redirected back to Stackweaver. The VCS connection is created with the access and refresh tokens stored securely.

The connection now appears in your VCS Connections list. You can use it when creating workspaces to link them to Azure DevOps repositories.

## Step 7: Webhooks for Automatic Runs

Stackweaver automatically registers a Service Hook subscription in Azure DevOps when you link a workspace to a repository (Step 8). The subscription is scoped to that specific repository; Stackweaver does not register broad organization-wide hooks. No subscriptions are created when you first connect the VCS account; they are created on demand as workspaces are linked.

Three subscriptions are created per linked repository:

- **Code pushed**: triggers plan-and-apply runs on matching workspaces.
- **Pull request created**: triggers speculative (plan-only) runs.
- **Pull request updated**: re-runs the plan when new commits are pushed to an open PR.

The subscriptions are registered using the `STACKWEAVER_WEBHOOK_BASE_URL` value set in Step 4. The registration is idempotent: re-saving a workspace does not create duplicate subscriptions.

### Local Development

Azure DevOps cannot reach `localhost` directly, so `STACKWEAVER_WEBHOOK_BASE_URL` must point to a publicly accessible URL. Use a tunnel such as [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) or [ngrok](https://ngrok.com/) to expose port 8022, then set:

```bash
STACKWEAVER_WEBHOOK_BASE_URL=https://<your-tunnel-subdomain>.trycloudflare.com
```

Restart the API after updating the URL, then re-save any linked workspaces to register subscriptions pointing to the new tunnel URL.

### Manual Fallback

If `STACKWEAVER_WEBHOOK_BASE_URL` is not set or the automatic registration fails (for example, if the Azure DevOps organization administrator has disabled Service Hook creation via API), you can create the subscriptions manually.

1. In your Azure DevOps project, go to **Project settings** → **Service hooks**.
2. Click **Create subscription** → **Web Hooks** → **Next**.
3. Select **Code pushed** as the trigger, choose the specific repository, and click **Next**.
4. Set the **URL** to:
   ```
   https://your-stackweaver-domain:8022/api/v2/vcs-connections/azure-devops/webhook
   ```
5. Set **Resource details to send** to **All**, leave the message fields as **None**, and click **Finish**.
6. Repeat steps 2–5 for **Pull request created** and **Pull request updated** triggers.

## Step 8: Create a Workspace with an Azure DevOps Repository

1. In Stackweaver, navigate to your organization and click **Create Workspace**.
2. Under **VCS Connection**, select your Azure DevOps connection.
3. Browse and select the repository and branch. Repositories are listed in `project/repository` format.
4. Configure the workspace settings (working directory, Terraform version, etc.).
5. Save the workspace.

When you push code to the configured branch, Stackweaver automatically queues a Terraform run. Pull requests trigger speculative plan-only runs if the workspace has speculative execution enabled.

## How It Works

### OAuth2 Flow

When you create a VCS connection, Stackweaver redirects you to Microsoft for authorization. After you grant access, Microsoft returns an authorization code. Stackweaver exchanges this code for an access token and a refresh token using standard OAuth2. The access token is used for API calls (listing repos, reading files) and the refresh token obtains new access tokens transparently when they expire. You do not need to re-authorize as long as the refresh token is valid.

### Repository Format

Azure DevOps repositories are identified by the project and repository name together. When browsing repositories in Stackweaver, you will see them listed as `ProjectName/RepositoryName`. Use this same format in workspace settings.

### Clone URL Format

When a runner needs to clone the repository, Stackweaver constructs the clone URL with an embedded OAuth2 token:

```
https://oauth2:<access-token>@dev.azure.com/<org>/<project>/_git/<repo>
```

The token is refreshed automatically before each clone operation if needed.

### Webhook Processing

When Azure DevOps sends a webhook event, Stackweaver:

1. Parses the event into a normalized format (same structure used for GitHub webhooks).
2. Finds matching workspaces by repository path and branch.
3. Queues plan-and-apply runs for push events, or plan-only runs for pull request events.

## Client Secret Rotation

Entra ID client secrets have a maximum lifetime of 24 months and must be rotated before they expire. When a secret expires, the integration stops working for new token exchanges (existing refresh tokens may still work temporarily).

To rotate the secret:

1. In the Azure Portal, go to the app registration → **Certificates & secrets** → **New client secret**.
2. Create the new secret and copy its value.
3. Update `AZURE_DEVOPS_CLIENT_SECRET` in `deploy/vcs.env`.
4. Run `make fresh-backend` to apply the change.
5. Verify the integration works, then delete the old secret from the portal.

## Troubleshooting

### "Azure DevOps integration is not configured" error

Verify that `AZURE_DEVOPS_CLIENT_ID` and `AZURE_DEVOPS_CLIENT_SECRET` are set in `deploy/vcs.env` and that the API container has been restarted after the change.

### OAuth authorization fails with "AADSTS650052: organization lacks a service principal for Azure DevOps"

The Azure DevOps enterprise application has not been provisioned in your Entra tenant. This happens when a tenant has never used Azure DevOps or when the service principal was removed. Fix it by running this once as an Entra administrator:

```bash
az ad sp create --id 499b84ac-1321-427f-aa17-267ca6975798
```

Then retry the authorization flow. See Step 1 for details.

### OAuth authorization fails with "AADSTS650053: scope 'vso.hooks_write' doesn't exist"

`vso.hooks` and `vso.hooks_write` are no longer public scopes in Microsoft Entra ID. They cannot appear in the API permissions list and must not be requested explicitly. Stackweaver requests only `vso.code` and `vso.project`; service hook access is already included because `vso.code` inherits from `vso.hooks_write` in the Azure DevOps scope hierarchy.

If you see this error, you are running an older version of Stackweaver that explicitly requested `vso.hooks_write`. Update Stackweaver and run `make fresh-backend` to reload the corrected scope list.

### OAuth authorization fails with "redirect_uri does not match"

The `AZURE_DEVOPS_REDIRECT_URI` value must exactly match the redirect URI configured in the Entra app registration. Check for trailing slashes, `http` vs `https`, and port number differences. The comparison is case-sensitive.

### OAuth authorization fails with "AADSTS50011"

This error means the redirect URI in the authorization request does not match any URI registered in the app. Go to the app registration → **Authentication** → confirm the redirect URI is listed under **Web**.

### "User is not authorized to access this resource" (HTTP 401 from Azure DevOps API)

An Azure DevOps organization administrator may have disabled third-party application access via OAuth. An administrator can re-enable it under:
`https://dev.azure.com/<your-org-name>/_settings/organizationPolicy` → **Third-party application access via OAuth**

### Webhook subscriptions were not auto-registered

Check the API logs after you save (or re-save) a workspace linked to an Azure DevOps repository:

```bash
docker compose -f deploy/docker-compose.yml logs api | grep -i "webhook"
```

Common causes:

- `STACKWEAVER_WEBHOOK_BASE_URL` is not set or is empty, so subscriptions are skipped silently. Set it in `deploy/vcs.env` and re-save the workspace.
- The authorizing user does not have permission to create Service Hook subscriptions. The user needs at least **Project Administrator** rights on the project.
- The Azure DevOps organization has disabled Service Hook creation via API. An administrator can check this under **Organization settings** → **Extensions** and re-enable it, or you can create subscriptions manually (see Step 7).

### Webhooks are not triggering runs

1. Verify that Service Hook subscriptions exist in your Azure DevOps project under **Project settings** → **Service hooks**.
2. Confirm the webhook URL in the subscription points to the correct Stackweaver API address and port (default 8022).
3. Confirm the webhook can reach Stackweaver. Azure DevOps cannot reach `localhost`, so use a publicly accessible URL.
4. Check the API logs for processing errors:
   ```bash
   docker compose -f deploy/docker-compose.yml logs api | grep -i "webhook"
   ```
5. Use the **Test** button in the Service Hook subscription to send a test payload and inspect the response.

### Token refresh fails

Refresh tokens can expire or be revoked by an administrator. If refresh fails, re-authorize by deleting the VCS connection in Stackweaver and creating a new one.

### Repositories return a 403 "Identity has not been materialized" error

The Azure DevOps organization is not connected to your Entra ID tenant. Fix it once as an organization administrator:

1. In Azure DevOps, go to **Organization settings** → **Microsoft Entra**.
2. Click **Connect directory** and select your Entra ID tenant.
3. Sign in to `https://dev.azure.com/<org>` with your Entra ID account once to activate your identity.
4. Delete the VCS connection in Stackweaver and reconnect.

### Repositories are not showing up

Ensure the app registration has `vso.code`, `vso.code_status`, and `vso.project` delegated permissions added (Step 2). The integration lists all repositories across all projects in the Azure DevOps organization that the authorizing user can access.

### Speculative runs not triggering on pull requests

Pull request triggers require **Pull request created** and **Pull request updated** Service Hook subscriptions. These are created automatically when the workspace is saved with an Azure DevOps repository. If they are missing, re-save the workspace or create them manually as described in Step 7. The workspace must also have speculative execution enabled in its settings.

### PR status checks not appearing on pull requests

PR status checks require the `vso.code_status` scope. If you set up Stackweaver before this scope was added, you need to add it to the Entra ID app registration (Step 2) and then delete and re-create the VCS connection in Stackweaver so the user re-authorizes with the new scope. Existing OAuth tokens do not automatically pick up new scopes.

## Terraform Setup (Declarative)

If you manage infrastructure as code, you can provision the entire Entra ID configuration with Terraform instead of following Steps 1–3 manually. The template is in [docs/user-guides/vcs/entra-setup/main.tf](entra-setup/main.tf).

The template uses the [AzureAD Terraform provider](https://registry.terraform.io/providers/hashicorp/azuread/latest/docs) to:

- Provision the Azure DevOps enterprise application in your tenant (fixes AADSTS650052 if it occurs).
- Create the app registration with `vso.code`, `vso.code_status`, and `vso.project` delegated permissions.
- Create a client secret with a configurable expiry date.
- Output the values ready to paste into `deploy/vcs.env`.

### Authentication

The provider authenticates via the Azure CLI by default. Log in before applying:

```bash
az login
```

Alternatively, set `ARM_CLIENT_ID`, `ARM_CLIENT_SECRET`, and `ARM_TENANT_ID` environment variables for non-interactive environments.

### Usage

```bash
cd docs/user-guides/vcs/entra-setup
terraform init
terraform apply \
  -var='redirect_uris=["https://your-stackweaver-domain/vcs/azure-devops/callback"]' \
  -var='display_name=Stackweaver'
```

For local development, use `http://localhost:5173/vcs/azure-devops/callback` as the redirect URI. You can provide multiple URIs:

```bash
terraform apply \
  -var='redirect_uris=["https://stackweaver.example.com/vcs/azure-devops/callback","http://localhost:5173/vcs/azure-devops/callback"]'
```

### Retrieving outputs

After `terraform apply` succeeds, copy the outputs into `deploy/vcs.env`:

```bash
terraform output AZURE_DEVOPS_CLIENT_ID
terraform output -raw AZURE_DEVOPS_CLIENT_SECRET   # sensitive, printed as plain text with -raw
terraform output AZURE_DEVOPS_TENANT_ID
```

Then restart the API to load the new values:

```bash
make fresh-backend
```

### Secret rotation with Terraform

When the client secret approaches its expiry, create a new one by changing `secret_end_date` and running `terraform apply` again. Terraform will create a new password resource. Remove the old one from the app registration in the Azure Portal after verifying the new secret works.

## References

- [Oauth Authentication Official docs](https://learn.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/oauth?view=azure-devops)
- [Service Principal Authentication Official Docs](https://learn.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/service-principal-managed-identity?view=azure-devops)