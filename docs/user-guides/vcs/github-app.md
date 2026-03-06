<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# GitHub App Setup Guide (Self-Service)

## Overview

This platform uses **GitHub Apps** (not OAuth Apps) for VCS integration. This allows users to self-service install the app on their own organizations without requiring platform admin configuration.

## How It Works

1. **Platform owner creates ONE GitHub App** (one-time setup)
2. **User clicks "Connect GitHub"** in organization settings
3. **User is redirected** to GitHub App installation page
4. **User installs the app** on their organization/repositories
5. **GitHub sends webhook** with installation details
6. **Platform stores installation ID** and generates installation tokens automatically
7. **User can now select repositories** and branches when creating workspaces

## Setup Steps

### 1. Create GitHub App (One-Time, Platform Owner)

1. Go to https://github.com/settings/apps/new
2. Fill in the form:
   - **GitHub App name**: `Stackweaver-instance-$` (or your choice)
   - **Homepage URL**: `http://localhost:5173` (your frontend URL)
   - **setup URL**: `http://localhost:5173/vcs/github/installed`
   - **Webhook URL**:
     - **For development (using ngrok)**: `https://your-ngrok-url.ngrok.io/api/v2/vcs-connections/github/webhook`
       - Install ngrok: `source <(curl -fsSL https://raw.githubusercontent.com/michielvha/PDS/main/bash/common/software/ngrok.sh)`
       - Start ngrok: `ngrok http 8022` (or your API port)
       - Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
       - Use: `https://abc123.ngrok.io/api/v2/vcs-connections/github/webhook`
     - **For production / Kubernetes**: `https://your-domain.com/api/v2/vcs-connections/github/webhook`
   - **Setup URL** (important — this is where GitHub redirects after installation):
     - **For development**: leave blank, or use `https://your-ngrok-url.ngrok.io/api/v2/vcs-connections/github/setup`
     - **For production / Kubernetes**: `https://your-domain.com/api/v2/vcs-connections/github/setup`
     - The API relays this redirect to the correct frontend URL automatically — do not use `http://localhost:5173` here
   - **Webhook secret**: Generate a random secret (store securely) - must match `GITHUB_WEBHOOK_SECRET` environment variable
   - **Webhook events**: Ensure "Push" events are enabled (required for tag-based module publishing)
   - **Repository permissions**:
     - **Contents**: Read (to read repo files)
     - **Metadata**: Read (required)
     - **Pull requests**: Read (for PR-based runs)
     - **Commit statuses**: **Read and write** (required for PR status checks) ⚠️ **IMPORTANT**
     - **Webhooks**: Write (to create webhooks)
   - **Organization permissions** (if needed):
     - **Members**: Read (to check org membership)
   - **Where can this GitHub App be installed?**: 
     - Select "Any account" for self-service
3. Click "Create GitHub App"
4. **Copy the App ID** (you'll see it on the app settings page)
5. **Generate a Private Key**:
   - Scroll down to "Private keys"
   - Click "Generate a private key"
   - **Download the .pem file** - you'll only see it once!
   - Save it securely

### 1b. Make the GitHub App Public (required for self‑service installs)

By default, private apps can only be installed on the owner’s account. To let any user or organization install your app:

1. Open your app’s settings: `https://github.com/settings/apps/<your-app-slug>`
2. In the sidebar, click "General"
3. Under "App visibility", select "Public" and save
4. Under "Where can this GitHub App be installed?", ensure "Any account" is selected
5. Share the install URL when needed: `https://github.com/apps/<your-app-slug>/installations/new`

### 2. Configure Your Deployment

#### Docker Compose

The private key file is mounted directly from the `deploy/` directory. Place your downloaded `.pem` file there:

```bash
cp ~/Downloads/your-app-name.*.private-key.pem deploy/github-app-private-key.pem
```

Then set the three non-secret values directly in `deploy/docker-compose.yml` (they are already wired up under the `api` and `orchestrator` services):

```yaml
- GITHUB_APP_ID=<your-app-id>
- GITHUB_APP_NAME=<your-app-slug>
- GITHUB_APP_PRIVATE_KEY_PATH=/etc/github-app-private-key.pem
- GITHUB_WEBHOOK_SECRET=<your-webhook-secret>
```

The compose file bind-mounts `deploy/github-app-private-key.pem` → `/etc/github-app-private-key.pem` inside the container, so no additional steps are needed.

#### Kubernetes (Helm)

The Helm chart stores the private key and webhook secret in a Kubernetes Secret and mounts it as a volume. The chart wires everything up automatically once you provide the secret name.

**Step 1 — Create the Kubernetes Secret:**

```bash
kubectl create secret generic stackweaver-github-app \
  --namespace stackweaver \
  --from-file=private-key=deploy/github-app-private-key.pem \
  --from-literal=webhook-secret='<your-webhook-secret>'
```

**Step 2 — Set values in your `values.yaml`:**

```yaml
secrets:
  githubApp:
    secretName: stackweaver-github-app
    keys:
      privateKey: private-key       # must match the key name used in kubectl create secret
      webhookSecret: webhook-secret  # must match the key name used in kubectl create secret

api:
  githubApp:
    id: "<your-app-id>"
    name: "<your-app-slug>"

orchestrator:
  githubApp:
    id: "<your-app-id>"
    name: "<your-app-slug>"
```

The chart then automatically:
- Mounts the secret as a read-only volume at `/etc/github-app/` in both the `api` and `orchestrator` pods.
- Sets `GITHUB_APP_PRIVATE_KEY_PATH=/etc/github-app/private-key.pem` in each pod.
- Injects `GITHUB_APP_ID`, `GITHUB_APP_NAME`, and `GITHUB_WEBHOOK_SECRET` as environment variables.

No other configuration is required. If `secrets.githubApp.secretName` is empty, GitHub App support is disabled entirely and none of the above env vars are injected.

**Required Variables** (reference):
- `GITHUB_APP_ID` — Your GitHub App ID (found on the app settings page)
- `GITHUB_APP_NAME` — The slug from the GitHub App URL (e.g. `my-stackweaver-app`)
- `GITHUB_APP_PRIVATE_KEY_PATH` — Path to the `.pem` file inside the container (set automatically by the chart)
- `GITHUB_WEBHOOK_SECRET` — Webhook secret for verifying webhook signatures

### 3. User Flow (Self-Service)

1. User navigates to Organization Settings → VCS Connections
2. User clicks "Connect GitHub"
3. User is redirected to GitHub App installation page
4. User selects organization/repositories to install on
5. User clicks "Install"
6. GitHub redirects back to platform
7. Platform receives webhook with installation details
8. Platform stores installation ID
9. User can now select repositories and branches

## Important Notes

- **App must be Public for self-service installs**. Private apps are only installable on the owner’s account.
- **GitHub App vs OAuth App**: We use **GitHub App** (self-service, per-installation tokens), not **OAuth App** (requires manual setup)
- **Installation Tokens**: Tokens are generated automatically from installation ID (valid for 1 hour)
- **Self-Service**: Users install the app on their own organizations - no admin configuration needed
- **Security**: Private key must be kept secure and never exposed

## Troubleshooting

### After Installation, Browser Redirects to `localhost:5173`

This means the GitHub App's **Setup URL** is still pointing to the old localhost address. GitHub uses the Setup URL for all post-installation redirects (new installs, permission updates, uninstalls).

Fix:
1. Go to `https://github.com/settings/apps/<your-app-slug>` → General
2. Set **Setup URL** to `https://your-domain.com/api/v2/vcs-connections/github/setup`
3. Save changes

The API's `/setup` endpoint receives the redirect from GitHub and forwards it to the correct frontend URL based on the `STACKWEAVER_APP_URL` environment variable (set automatically by the Helm chart, or via `STACKWEAVER_APP_URL` in Docker Compose).

### "GitHub App is not configured" Error
- Make sure `GITHUB_APP_ID` and `GITHUB_APP_NAME` are set
- Verify private key is correctly loaded (check logs for parsing errors)

### Installation Not Working
- Check webhook URL is correct in GitHub App settings
- Verify webhook secret matches `GITHUB_WEBHOOK_SECRET`
- Check webhook delivery logs in GitHub App settings

### Token Generation Fails
- Verify private key is correct (PEM format)
- Check App ID matches the GitHub App
- Ensure installation ID is valid

### 403 "Resource not accessible by integration" Error (Status Checks)
- **This means the GitHub App lacks required permissions**
- Go to your GitHub App settings: https://github.com/settings/apps
- Select your app, then go to "Permissions & events" in the sidebar
- Under "Repository permissions", scroll down to find **"Commit statuses"**
- Set it to **"Read and write"** (this allows creating/updating PR status checks)
- **Important**: After changing permissions, you must **reinstall the app** on the organization/repository for permissions to take effect
- Go to https://github.com/organizations/YOUR_ORG/settings/installations
- Find your app installation and click "Configure"
- Click "Update" or "Save" to reinstall with new permissions

## References

- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [GitHub App Installation Flow](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/installing-github-apps)
- [Terraform Enterprise VCS Integration](https://developer.hashicorp.com/terraform/cloud-docs/vcs)


