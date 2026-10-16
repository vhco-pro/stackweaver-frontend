---
description: "Guide for creating and configuring a GitHub App for VCS connections"
covers:
  - "core/vcs/**"
  - "deploy/vcs.env.example"
  - "deploy/helm/**"
---

# GitHub App Setup Guide (Self-Service)

## Overview

This platform uses **GitHub Apps** (not OAuth Apps) for VCS integration. This allows users to self-service install the app on their own organizations without requiring platform admin configuration.

## How It Works

```mermaid
sequenceDiagram
    participant Owner as Platform Owner
    participant User
    participant SW as StackWeaver
    participant GH as GitHub

    Owner->>GH: Creates GitHub App (one-time)
    User->>SW: Clicks "Connect GitHub"
    SW->>GH: Redirects to install page
    User->>GH: Installs app on org/repos
    GH->>SW: Redirects the user back with the installation ID
    SW->>GH: Sends the user on to authorize the app
    GH->>SW: Redirects the user back with an authorization code
    SW->>GH: Checks the user can access the installation
    SW->>SW: Stores installation ID, generates tokens
    User->>SW: Selects repositories and branches
```

<details>
<summary><strong>Flow Steps (Legend)</strong></summary>

1. **App creation** - The platform owner creates a single GitHub App (one-time setup).
2. **User connects** - A user clicks "Connect GitHub" in organization settings.
3. **Installation** - The user is redirected to GitHub's App installation page, selects their org/repos, and installs.
4. **Return** - GitHub redirects the user back to StackWeaver with the installation ID.
5. **Authorization** - StackWeaver sends the user on to GitHub to authorize the app. GitHub shows its authorization page the first time only; a user who has authorized the app before is sent straight back. StackWeaver asks GitHub which installations of the app that user can access, and records the installation for the organization the user started from only when it is one of them. The connection is recorded in the user's signed-in session, and not from a webhook delivery.
6. **Ready** - The user can now select repositories and branches when creating workspaces.

</details>

## Setup Steps

### 1. Create GitHub App (One-Time, Platform Owner)

1. Go to https://github.com/settings/apps/new
2. Fill in the form:
   - **GitHub App name**: `Stackweaver-instance-$` (or your choice)
   - **Homepage URL**: `http://localhost:5173` (your frontend URL)
   - **Callback URL**: set this to `https://your-domain.com/vcs/github/authorized` (for local Docker Compose development, `http://localhost:5173/vcs/github/authorized`). GitHub returns the user here after they authorize the app, which is how StackWeaver confirms they can access the installation they connect.
   - **Request user authorization (OAuth) during installation**: leave this unchecked. It replaces the Setup URL below, which StackWeaver needs.
   - **Setup URL**: set this to your **frontend URL**: `https://your-domain.com/vcs/github/installed`
     - For local Docker Compose development, set this to `http://localhost:5173/vcs/github/installed`.
     - If you need one GitHub App to work across both environments, you will need separate GitHub App registrations (one per environment), or use a tool like ngrok to expose your local frontend.
   - **Webhook URL**:
     - **For development (using ngrok)**: `https://your-ngrok-url.ngrok.io/api/v2/vcs-connections/github/webhook`
       - Install ngrok: `source <(curl -fsSL https://raw.githubusercontent.com/michielvha/PDS/main/bash/common/software/ngrok.sh)`
       - Start ngrok: `ngrok http 8022` (or your API port)
       - Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
       - Use: `https://abc123.ngrok.io/api/v2/vcs-connections/github/webhook`
     - **For production / Kubernetes**: `https://your-domain.com/api/v2/vcs-connections/github/webhook`
   - **Webhook secret**: Generate a random secret (store securely); it must match the `GITHUB_WEBHOOK_SECRET` environment variable. If the secret contains a `$` and you deploy with Docker Compose, escape it as `$$` where you set the variable, because Compose expands `$VAR` sequences and would otherwise hand the API a truncated secret that rejects every delivery.
   - **Webhook events**: subscribe to the following:

     | Event | Why |
     |---|---|
     | Push | Triggers workspace runs on branch pushes and publishes module versions on tag pushes |
     | Pull requests | Triggers speculative plans on PR open/update and posts plan results as commit status checks |
     | Workflow job | Required for GitHub Actions integration and workflow status tracking |
     | Installation, Installation repositories | Removes the organization's connection when the app is uninstalled. A delivery for a new installation or a change in repository access is acknowledged and changes nothing |

   - **Repository permissions**:

     | Permission | Level | Why |
     |---|---|---|
     | Contents | Read | Read repository files for runs |
     | Metadata | Read | Required by GitHub for all apps |
     | Pull requests | Read | Required to comment and react to PR events |
     | Commit statuses | **Read and write** ⚠️ | Post plan results as PR status checks |
     | Webhooks | Write | Register repository-level webhooks |

   - **Organization permissions**:

     | Permission | Level | Why |
     |---|---|---|
     | Members | Read | Verify organization membership during authorization |

   - **Where can this GitHub App be installed?**: Select "Any account" to allow self-service installs by your users
3. Click "Create GitHub App"
4. **Copy the App ID** (you'll see it on the app settings page)
5. **Generate a Private Key**:
   - Scroll down to "Private keys"
   - Click "Generate a private key"
   - **Download the .pem file** - you'll only see it once!
   - Save it securely
6. **Copy the Client ID and generate a client secret**: on the same settings page, copy the **Client ID**, then under "Client secrets" click "Generate a new client secret" and copy it - GitHub shows it only once. Connecting an installation needs both.

If your GitHub App was created without a Callback URL or a client secret, add them as described in steps 2 and 6 and set `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET` (below) before your users connect further installations. Connections that already exist keep working without them.

### 1b. Make the GitHub App Public (required for self‑service installs)

By default, private apps can only be installed on the owner’s account. To let any user or organization install your app:

1. Open your app’s settings: `https://github.com/settings/apps/<your-app-slug>`
2. In the sidebar, click "General"
3. Under "App visibility", select "Public" and save
4. Under "Where can this GitHub App be installed?", ensure "Any account" is selected
5. Share the install URL when needed: `https://github.com/apps/<your-app-slug>/installations/new`

### 2. Configure Your Deployment

#### Docker Compose

Run these steps in your Compose directory (the directory that holds `docker-compose.yml`). First place the downloaded private key next to `docker-compose.yml`:

```bash
cp ~/Downloads/your-app-name.*.private-key.pem ./github-app-private-key.pem
```

In `docker-compose.yml`, uncomment the GitHub App lines under both the `api` and `orchestrator` services: the `GITHUB_APP_ID`, `GITHUB_APP_NAME`, and `GITHUB_APP_PRIVATE_KEY_PATH` environment entries, and the `volumes:` block that mounts `./github-app-private-key.pem` at `/etc/github-app-private-key.pem`. Leave the `GITHUB_WEBHOOK_SECRET` line under `api` commented out. Then set the two non-secret values in `.env`, which Compose substitutes into those entries:

```bash
GITHUB_APP_ID=<your-app-id>
GITHUB_APP_NAME=<your-app-slug>
```

Put the webhook secret and the app's OAuth client in `vcs.env`, which the `api` service loads directly:

```bash
GITHUB_WEBHOOK_SECRET=<your-webhook-secret>
GITHUB_APP_CLIENT_ID=<your-client-id>
GITHUB_APP_CLIENT_SECRET=<your-client-secret>
```

Keep it out of `docker-compose.yml`: an uncommented `GITHUB_WEBHOOK_SECRET` entry under `environment:` takes precedence over `vcs.env`, and would blank the secret unless the same value is also in `.env`. Compose also expands `$VAR` sequences inside `vcs.env` values, so write every `$` in the secret as `$$` (a secret of `s3cr3t$Alt!x` becomes `GITHUB_WEBHOOK_SECRET=s3cr3t$$Alt!x`). You can confirm the value the container receives with `docker compose config | grep GITHUB_WEBHOOK_SECRET`.

Apply the change with `docker compose up -d api orchestrator`.

#### Kubernetes (Helm)

The Helm chart stores the private key and webhook secret in a Kubernetes Secret and mounts it as a volume. The chart wires everything up automatically once you provide the secret name.

**Step 1: Create the Kubernetes Secret:**

```bash
kubectl create secret generic stackweaver-github-app \
  --namespace stackweaver \
  --from-file=private-key=./github-app-private-key.pem \
  --from-literal=webhook-secret='<your-webhook-secret>' \
  --from-literal=client-secret='<your-client-secret>'
```

**Step 2: Set values in your `values.yaml`:**

```yaml
secrets:
  githubApp:
    secretName: stackweaver-github-app
    keys:
      privateKey: private-key       # must match the key name used in kubectl create secret
      webhookSecret: webhook-secret  # must match the key name used in kubectl create secret
      clientSecret: client-secret    # must match the key name used in kubectl create secret

api:
  githubApp:
    id: "<your-app-id>"
    name: "<your-app-slug>"
    clientId: "<your-client-id>"

orchestrator:
  githubApp:
    id: "<your-app-id>"
    name: "<your-app-slug>"
```

The chart then automatically:
- Mounts the secret as a read-only volume at `/etc/github-app/` in both the `api` and `orchestrator` pods.
- Sets `GITHUB_APP_PRIVATE_KEY_PATH=/etc/github-app/private-key.pem` in each pod.
- Injects `GITHUB_APP_ID`, `GITHUB_APP_NAME`, and `GITHUB_WEBHOOK_SECRET` as environment variables, and on the `api` pod also `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET`.

No other configuration is required. If `secrets.githubApp.secretName` is empty, GitHub App support is disabled entirely and none of the above env vars are injected.

#### Using ExternalSecrets or a Secret Manager

If you manage Kubernetes secrets via an external system (1Password, HashiCorp Vault, AWS Secrets Manager, etc.) rather than `kubectl create secret --from-file`, you must ensure that PEM newline characters are preserved in the synced secret. Many secret managers strip or collapse newlines when storing multiline values in text fields.

For **1Password**: store the `.pem` file as a **document attachment** on the 1Password item, not as a text or password field. Text fields in 1Password can collapse newlines to spaces, which breaks PEM parsing.

For **HashiCorp Vault**: use file-based input to preserve formatting:

```bash
vault kv put secret/stackweaver-github-app \
  private-key=@github-app-private-key.pem \
  webhook-secret='<your-webhook-secret>'
```

After the secret is synced, verify PEM formatting:

```bash
kubectl get secret stackweaver-github-app -n stackweaver \
  -o jsonpath='{.data.private-key}' | base64 -d | head -1
```

Expected output is the PEM header on its own line with no trailing content:

```
-----BEGIN RSA PRIVATE KEY-----
```

If instead you see the base64 key data on the same line as the header, the newlines have been lost and the key will fail to load.

**Required environment variables** (reference):

| Variable | Description |
|---|---|
| `GITHUB_APP_ID` | Your GitHub App ID, shown on the app settings page |
| `GITHUB_APP_NAME` | The slug from the GitHub App URL (e.g. `my-stackweaver-app`) |
| `GITHUB_APP_PRIVATE_KEY_PATH` | Path to the `.pem` file inside the container (set automatically by the Helm chart) |
| `GITHUB_WEBHOOK_SECRET` | Webhook secret used to verify incoming webhook signatures |
| `GITHUB_APP_CLIENT_ID` | The app's OAuth client ID, shown on the app settings page; needed to connect an installation |
| `GITHUB_APP_CLIENT_SECRET` | A client secret generated on the app settings page; needed to connect an installation |

### 3. User Flow (Self-Service)

Connecting an organization to GitHub requires being an organization owner in Stackweaver, or having the `manage-vcs-settings` permission in that organization. A member without it is refused when they click "Connect GitHub" and again if they return from GitHub with an installation. The installation is recorded only when the person who clicked "Connect GitHub" returns from GitHub within 15 minutes, signed in to Stackweaver as themselves, and only when the GitHub account they authorize the app with can access the installation. It is recorded for the organization they started from. Starting the connection with an organization API token requires a token with write scope on that organization.

```mermaid
sequenceDiagram
    participant User
    participant SW as StackWeaver
    participant GH as GitHub

    User->>SW: Settings > VCS Connections
    User->>SW: Clicks "Connect GitHub"
    SW->>GH: Redirect to install page
    User->>GH: Selects org/repos, clicks Install
    GH->>SW: Redirect back to platform with the installation ID
    SW->>GH: Redirect to authorize the app
    User->>GH: Authorizes the app (first time only)
    GH->>SW: Redirect back with an authorization code
    SW->>SW: Confirms the user can access the installation, stores the installation ID
    User->>SW: Selects repositories and branches
```

<details>
<summary><strong>Flow Steps (Legend)</strong></summary>

1. **Navigate** - User goes to Organization Settings > VCS Connections.
2. **Connect** - User clicks "Connect GitHub" and is redirected to GitHub's App installation page.
3. **Install** - User selects organization/repositories and clicks "Install".
4. **Setup URL** - GitHub redirects the user back to StackWeaver, to the Setup URL, with the installation ID.
5. **Authorize** - StackWeaver sends the user on to GitHub to authorize the app. GitHub shows its authorization page the first time; afterwards it returns the user straight away, to the Callback URL.
6. **Ready** - StackWeaver confirms with GitHub that the user can access the installation and stores the installation ID for the organization the user started from; the user can now select repositories and branches.

</details>

## Important Notes

- **App must be Public for self-service installs**. Private apps are only installable on the owner’s account.
- **GitHub App vs OAuth App**: We use **GitHub App** (self-service, per-installation tokens), not **OAuth App** (requires manual setup)
- **Installation Tokens**: Tokens are generated automatically from installation ID (valid for 1 hour)
- **Self-Service**: Users install the app on their own organizations - no admin configuration needed
- **Security**: Private key must be kept secure and never exposed

## Troubleshooting

### After Installation, Browser Redirects to `localhost:5173`

Root cause: The GitHub App **Setup URL** is set to `http://localhost:5173/vcs/github/installed`, which only works for local Docker Compose development. In Kubernetes (production), the Setup URL must point to your actual frontend domain.

Fix:
1. Go to `https://github.com/settings/apps/<your-app-slug>` → General
2. Set **Setup URL** to `https://your-domain.com/vcs/github/installed`
3. Save changes

If you need the same GitHub App to work for both local dev and production, set up two separate GitHub App registrations, one per environment.

### "Connect GitHub" Shows Error or "GitHub App Not Configured"

This means the GitHub App Manager failed to initialize at API startup. The most common cause is a malformed PEM private key in the Kubernetes Secret (newlines stripped by a secret manager).

Diagnosis:

1. Check API logs for the initialization error:

```bash
kubectl logs -n stackweaver deploy/stackweaver-api | grep "GitHub App"
```

2. Verify PEM format in the secret (should be ~28 lines, not 0 or 1):

```bash
kubectl get secret stackweaver-github-app -n stackweaver \
  -o jsonpath='{.data.private-key}' | base64 -d | wc -l
```

3. If the PEM is a single line, the secret source (1Password, Vault, etc.) likely stripped newlines during storage or retrieval. See the "Using ExternalSecrets or a Secret Manager" section above for how to fix this.

4. Make sure `GITHUB_APP_ID` and `GITHUB_APP_NAME` are set in your Helm values.

### Installation Not Working
- Check the Setup URL in GitHub App settings: the connection is recorded when GitHub redirects the user back to it, so an installation that never returns to StackWeaver leaves the organization without a connection
- Start the installation from "Connect GitHub" in StackWeaver. Installing the app directly from GitHub does not connect any organization
- Finish the installation on GitHub within 15 minutes of clicking "Connect GitHub", and return to StackWeaver signed in as the person who clicked it. Otherwise StackWeaver refuses the installation and asks you to connect again
- "GitHub App user authorization is not configured": set `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET` from the app's settings page, and register `https://your-domain.com/vcs/github/authorized` as a Callback URL of the app
- GitHub shows "The redirect_uri is not associated with this application": the Callback URL registered for the app does not match your frontend URL (`STACKWEAVER_APP_URL`) followed by `/vcs/github/authorized`
- "The GitHub account you authorized cannot access this installation": the account you authorized the app with has no access to the account or organization the app was installed on. Authorize with an account that is an owner or member there, or install the app on an account you can access

### Pushes Do Not Trigger Runs
- Check webhook URL is correct in GitHub App settings
- Verify webhook secret matches `GITHUB_WEBHOOK_SECRET`
- Check webhook delivery logs in GitHub App settings

### Every Delivery Returns 401 (Signature Mismatch)
The GitHub App's delivery log shows deliveries reaching Stackweaver but failing with `401`. This almost always means the secret the API received is not the secret GitHub signed with. On Docker Compose the usual cause is `$` expansion: Compose interpolates `$VAR` sequences in `environment:` entries **and** in `env_file` values, so a secret containing `$Alt` arrives with those four characters removed and you also see a `The "Alt" variable is not set` warning on every `docker compose` command. Escape each `$` as `$$` where you set the variable, recreate the API container, and confirm the effective value with `docker compose config | grep GITHUB_WEBHOOK_SECRET`.

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


