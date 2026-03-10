<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# SSO Team Sync Testing Guide

This guide walks through testing the SSO/OIDC team sync feature using the `terraform-provider-tfe`. It assumes you have already configured Azure AD as an external IdP in Zitadel and can successfully log in to StackWeaver via Microsoft SSO.

## Prerequisites

Before starting, ensure:

1. **Azure AD SSO login works** — you can log in to StackWeaver via the "Login with Microsoft" button on the Zitadel login page.
2. **Azure AD credentials are set** in `deploy/sso.env` (`AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`).
3. **Zitadel Actions V2 are deployed** — the `zitadel-init` service has run and created the `stackweaver-idp-sync` and `stackweaver-complement-token` webhook targets. You can verify this by checking the zitadel-init logs for "Set execution" messages.
4. **A StackWeaver API token** — generate one from the UI or API for use with the terraform provider.

## Step 1: Configure Azure AD Group Claims

By default, Azure AD does **not** include group memberships in the OIDC token. You must explicitly enable this.

### 1.1 Enable Group Claims in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations**.
2. Select your StackWeaver app registration (Client ID: check `deploy/sso.env`).
3. Go to **Token configuration** → **Add groups claim**.
4. Select **Security groups** (or All groups if you want all group types).
5. Under "ID" token type, select **Group ID** (this returns Object IDs, which are UUIDs).
6. Click **Add**.

Alternatively, edit the app manifest directly and set:

```json
"groupMembershipClaims": "SecurityGroup"
```

### 1.2 Create or Identify an Azure AD Security Group

1. In Azure Portal, go to **Microsoft Entra ID** → **Groups**.
2. Create a new Security group (or use an existing one).
3. Add your test user to the group.
4. **Copy the group's Object ID** (a UUID like `7dddb675-73e0-4858-a8ad-0e597064301b`). This is the value you will set as `sso_team_id` on the StackWeaver team.

### 1.3 Verify Group Claims Are in the Token

After enabling group claims, log in to StackWeaver via Azure AD SSO. Check the API logs for the group extraction:

```bash
docker compose -f deploy/docker-compose.yml logs api 2>&1 | grep -i "SSO groups\|TeamSync\|sso_groups"
```

You should see a log line like:

```
ExtractUserInfo - Extracted 2 SSO groups for Subject=<zitadel-subject-id>
```

If you don't see this, the Zitadel Actions may not be capturing the groups. Check:

```bash
docker compose -f deploy/docker-compose.yml logs zitadel-init 2>&1 | grep -i "action"
```

## Step 2: Enable Team Sync

Edit `deploy/sso.env` and set:

```bash
ENABLE_OIDC_TEAM_SYNC=true
OIDC_REMOVE_FROM_NON_SSO_TEAMS=false   # keep false for initial testing
```

Then restart the API to pick up the change:

```bash
make fresh-backend
```

Check the API logs for confirmation:

```bash
docker compose -f deploy/docker-compose.yml logs api 2>&1 | grep -i "team sync"
```

You should see: `SSO team sync enabled`.

## Step 3: Create a Team with `sso_team_id` Using Terraform

### 3.1 Provider Configuration

If you don't already have a terraform config for tfe-provider testing, create a new directory and add:

```hcl
# providers.tf
terraform {
  required_providers {
    tfe = {
      source  = "hashicorp/tfe"
      version = "~> 0.72.0"
    }
  }
}

provider "tfe" {
  hostname = "stackweaver.vhco.pro"    # Your StackWeaver hostname
  token    = var.stackweaver_token
}

variable "stackweaver_token" {
  type      = string
  sensitive = true
}

variable "organization" {
  type    = string
  default = "main"
}
```

### 3.2 Create a Team with SSO Team ID

Add the following to your terraform configuration. Replace the `sso_team_id` value with the **Azure AD group Object ID** you copied in Step 1.2:

```hcl
# sso-team-test.tf

# Create a team mapped to an Azure AD security group
resource "tfe_team" "sso_mapped_team" {
  name         = "azure-ad-developers"
  organization = var.organization
  visibility   = "organization"

  # This is the Azure AD group Object ID
  # Replace with your actual group Object ID from Azure Portal
  sso_team_id = "7dddb675-73e0-4858-a8ad-0e597064301b"
}

# Verify the team was created correctly
output "sso_team_id" {
  value = tfe_team.sso_mapped_team.id
}

output "sso_team_sso_id" {
  value = tfe_team.sso_mapped_team.sso_team_id
}
```

### 3.3 Apply

```bash
terraform init
terraform plan
terraform apply
```

Verify the team was created with the `sso_team_id`:

```bash
terraform output sso_team_sso_id
# Should output: "7dddb675-73e0-4858-a8ad-0e597064301b"
```

You can also verify via the API directly:

```bash
curl -s -H "Authorization: Bearer <your-token>" \
  https://stackweaver.vhco.pro/api/v2/organizations/main/teams \
  | jq '.data[] | select(.attributes.name == "azure-ad-developers") | .attributes["sso-team-id"]'
```

## Step 4: Test Automatic Team Assignment

### 4.1 Log In via Azure AD SSO

1. Open StackWeaver in a browser.
2. Log out if already logged in.
3. Log in using the **"Login with Microsoft"** button.
4. Authenticate with an Azure AD account that is a member of the security group you configured.

### 4.2 Verify Team Membership

After login, check the API logs:

```bash
docker compose -f deploy/docker-compose.yml logs api 2>&1 | grep -i "TeamSync"
```

You should see:

```
TeamSync - Syncing teams for user <user-id> with N SSO groups
TeamSync - Found 1 matching teams for user <user-id>
TeamSync - Added user <user-id> to team 'azure-ad-developers' (sso_team_id=7dddb675-...)
```

You can also verify membership via the API:

```bash
# Get the team ID first
TEAM_ID=$(curl -s -H "Authorization: Bearer <your-token>" \
  https://stackweaver.vhco.pro/api/v2/organizations/main/teams \
  | jq -r '.data[] | select(.attributes.name == "azure-ad-developers") | .id')

# List team members
curl -s -H "Authorization: Bearer <your-token>" \
  "https://stackweaver.vhco.pro/api/v2/teams/$TEAM_ID/organization-memberships" \
  | jq '.data[].attributes'
```

Or use the terraform data source:

```hcl
data "tfe_team" "sso_mapped" {
  name         = "azure-ad-developers"
  organization = var.organization
}

output "sso_team_member_count" {
  value = data.tfe_team.sso_mapped.users_count
}
```

## Step 5: Test Team Permission Inheritance

After automatic team assignment, verify the user inherits the team's permissions. Add team access to a workspace or project:

```hcl
# Give the SSO-mapped team read access to a workspace
data "tfe_workspace" "test" {
  name         = "stackweaver-tests-tfe-provider"
  organization = var.organization
}

resource "tfe_team_access" "sso_team_read" {
  access       = "read"
  team_id      = tfe_team.sso_mapped_team.id
  workspace_id = data.tfe_workspace.test.id
}
```

After applying this, log in as the SSO user and verify they can see the workspace.

## Step 6: Test Team Removal (Optional)

To test automatic removal of users from SSO-managed teams when they are no longer in the Azure AD group:

### 6.1 Enable Removal

Edit `deploy/sso.env`:

```bash
OIDC_REMOVE_FROM_NON_SSO_TEAMS=true
```

Restart the API:

```bash
make fresh-backend
```

### 6.2 Remove User from Azure AD Group

1. In Azure Portal, go to the security group.
2. Remove the test user from the group.
3. Log in to StackWeaver again via Azure AD SSO.

### 6.3 Verify Removal

Check the logs:

```bash
docker compose -f deploy/docker-compose.yml logs api 2>&1 | grep -i "TeamSync.*Removed"
```

You should see:

```
TeamSync - Removed user <user-id> from team 'azure-ad-developers' (sso_team_id=7dddb675-... no longer in claims)
```

**Important**: Only teams with `sso_team_id` set are affected by automatic removal. Manually-managed teams (without `sso_team_id`) are never touched.

## Step 7: Multiple Teams Test

Test mapping multiple Azure AD groups to multiple StackWeaver teams:

```hcl
resource "tfe_team" "devops" {
  name         = "devops-engineers"
  organization = var.organization
  visibility   = "organization"
  sso_team_id  = "<azure-ad-devops-group-object-id>"
}

resource "tfe_team" "platform" {
  name         = "platform-team"
  organization = var.organization
  visibility   = "organization"
  sso_team_id  = "<azure-ad-platform-group-object-id>"
}
```

A user who is a member of both Azure AD groups will be automatically added to both StackWeaver teams on login.

## Cleanup

To remove the test resources:

```bash
terraform destroy
```

To disable team sync, edit `deploy/sso.env`:

```bash
ENABLE_OIDC_TEAM_SYNC=false
OIDC_REMOVE_FROM_NON_SSO_TEAMS=false
```

And restart: `make fresh-backend`.

## Troubleshooting

### No SSO groups in logs

- Verify Azure AD app registration has group claims enabled (Token configuration → groups claim).
- Verify the test user is a member of at least one Azure AD security group.
- Check Zitadel Actions V2 are deployed: check the zitadel-init logs for `stackweaver-idp-sync` and `stackweaver-complement-token` target creation messages.
- Re-run `zitadel-init` if targets are missing: `docker compose -f deploy/docker-compose.yml up -d --build zitadel-init`.

### Groups extracted but team sync not happening

- Verify `ENABLE_OIDC_TEAM_SYNC=true` in `deploy/sso.env`.
- Verify the API was restarted after changing the env var.
- Check that the `sso_team_id` on the team exactly matches the Azure AD group Object ID (case-sensitive UUID).

### Azure AD 200-group limit

Azure AD includes a maximum of 200 groups in token claims. If the user is in more than 200 groups, some groups may be missing from the token. For users with many group memberships, consider using more targeted group claim filters in the Azure AD app registration.

### Team sync runs on every login

This is by design. The sync runs on each authentication to ensure team membership stays in sync with the IdP. It is idempotent — if the user is already in the correct teams, no changes are made.
