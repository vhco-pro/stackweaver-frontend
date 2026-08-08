---
description: "Guide for automatic team assignment based on IdP group claims using Zitadel webhooks"
covers:
  - "scripts/zitadel-init/**"
  - "deploy/sso.env.example"
  - "deploy/helm/**"
  - "backend/internal/services/auth/**"
---

# SSO Team Mapping

StackWeaver can automatically assign users to teams based on their identity provider (IdP) group memberships. When a user logs in via SSO, their group claims are forwarded through the JWT, and StackWeaver maps those groups to teams that have a matching `sso_team_id` configured.

## How It Works

1. The user authenticates via an external IdP (Azure AD, Okta, Cognito, etc.) through Zitadel.
2. The IdP returns group memberships in the token (e.g., `groups: ["engineering", "platform-team"]`).
3. Zitadel Actions V2 webhooks capture the groups from the IdP response, store them as user metadata, and include them as an `sso_groups` claim in the StackWeaver JWT.
4. On each login, StackWeaver's Team Sync service finds all teams across all organizations that have a `sso_team_id` matching one of the user's groups.
5. The user is automatically added to those teams and their parent organizations.

This process runs on every login, so changes to a user's IdP groups take effect the next time they sign in.

## Architecture: Zitadel Actions V2

StackWeaver uses Zitadel Actions V2, the officially supported webhook mechanism for Login V2. Unlike the legacy Actions V1 (which used embedded JavaScript), Actions V2 uses external HTTP endpoints that Zitadel calls during specific operations.

Two webhooks are configured automatically by `zitadel-init`:

1. **IDP Sync webhook** (`/api/v2/zitadel/actions/idp-sync`): A Response execution on `RetrieveIdentityProviderIntent`. When a user authenticates via any external OIDC provider, Zitadel sends the IdP's raw claims (including group memberships) to this webhook. The webhook extracts the groups and stores them as user metadata in Zitadel via the Management API.

2. **Complement Token webhook** (`/api/v2/zitadel/actions/complement-token`): A Function execution on `preaccesstoken`. Before every access token is created, Zitadel sends the user's metadata to this webhook. The webhook reads the `sso_groups` metadata and includes it as a custom claim in the JWT.

This approach is provider-agnostic and works with any OIDC provider that includes group claims in its token (Azure AD, Okta, Cognito, Google Workspace, etc.).

For more details on Zitadel Actions V2, see the [Zitadel Actions V2 documentation](https://zitadel.com/docs/concepts/features/actions_v2) and the [migration guide](https://zitadel.com/docs/guides/integrate/actions/migrate-from-v1).

## Enabling Team Sync

Choose the instructions for your deployment method.

### Docker Compose

Add the following environment variables to **`deploy/sso.env`** (this file is not overwritten by the auto-generated `deploy/.env`):

```bash
# Enable automatic team assignment based on SSO group claims
ENABLE_OIDC_TEAM_SYNC=true

# Optional: remove users from SSO-managed teams when their group claims
# no longer include that team's sso_team_id (default: false)
OIDC_REMOVE_FROM_NON_SSO_TEAMS=false
```

Then restart the API service:

```bash
cd deploy
docker compose up -d api
```

### Kubernetes / Helm

Add the team sync values to your Helm values file:

```yaml
sso:
  enableOidcTeamSync: true
  oidcRemoveFromNonSsoTeams: false  # set to true to remove users when groups change
```

Then upgrade the release:

```bash
helm upgrade stackweaver oci://ghcr.io/vhco-pro/charts/stackweaver \
  --namespace stackweaver \
  --values my-values.yaml
```

## Configuring Team Mappings

To map an IdP group to a StackWeaver team, set the team's `sso_team_id` field to match the group identifier from your IdP.

### Using the Terraform Provider

The recommended way to create teams with SSO mappings is using the `tfe_team` resource from the Terraform Enterprise provider. This ensures the team is created with the correct `sso_team_id` in a single declarative configuration.

First, configure the provider to point at your StackWeaver instance:

```hcl
terraform {
  required_providers {
    tfe = {
      source  = "hashicorp/tfe"
      version = "~> 0.72.0"
    }
  }
}

provider "tfe" {
  hostname = "stackweaver.example.com"  # Your StackWeaver hostname
  token    = var.stackweaver_token
}
```

Then create a team mapped to an IdP group. Replace the `sso_team_id` value with the actual group identifier from your identity provider (for Azure AD, this is the group's Object ID from the Azure Portal):

```hcl
resource "tfe_team" "platform_engineering" {
  name         = "platform-engineering"
  organization = "my-org"
  visibility   = "organization"

  # Azure AD group Object ID - must match exactly
  sso_team_id = "7dddb675-73e0-4858-a8ad-0e597064301b"
}
```

You can verify the mapping was created:

```bash
terraform apply
terraform output
```

Multiple teams can be mapped to different groups in the same configuration:

```hcl
resource "tfe_team" "devops" {
  name         = "devops-engineers"
  organization = "my-org"
  visibility   = "organization"
  sso_team_id  = "<azure-ad-devops-group-object-id>"
}

resource "tfe_team" "security" {
  name         = "security-team"
  organization = "my-org"
  visibility   = "organization"
  sso_team_id  = "<azure-ad-security-group-object-id>"
}
```

A user who is a member of both IdP groups will be automatically added to both StackWeaver teams on their next login.

### Using the API

You can also update a team's `sso_team_id` directly via the StackWeaver API:

```bash
curl -X PATCH "http://localhost:8022/api/v2/teams/{team-id}" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/vnd.api+json" \
  -d '{
    "data": {
      "type": "teams",
      "id": "{team-id}",
      "attributes": {
        "sso-team-id": "engineering"
      }
    }
  }'
```

The `sso-team-id` value must exactly match the group identifier sent by your IdP. For Azure AD, this is typically a GUID (the group's Object ID). For Okta and Cognito, this is usually the group name.

### Example Mapping

Consider an organization with these teams and an Azure AD tenant with these groups:

| StackWeaver Team | `sso_team_id` | Azure AD Group |
|------------------|---------------|----------------|
| Platform Engineering | `platform-engineers` | `platform-engineers` |
| Security Team | `security` | `security` |
| Viewers | (not set) | - |

When a user who belongs to the `platform-engineers` and `security` Azure AD groups logs in:

1. Their JWT contains `sso_groups: ["platform-engineers", "security"]`.
2. Team Sync finds the "Platform Engineering" team (matching `sso_team_id = "platform-engineers"`) and the "Security Team" (matching `sso_team_id = "security"`).
3. The user is added to both teams and to the parent organization.

Teams without an `sso_team_id` (like "Viewers" in this example) are never affected by the sync process.

## Organization Membership

When a user is added to a team via SSO group mapping, they are also automatically added as a member of the team's parent organization. This ensures the user can access the organization's resources.

The sync only grants membership to organizations that contain teams matching the user's group claims. A user from Company A cannot gain access to Company B's organization unless Company B has a team with an `sso_team_id` that matches one of Company A's IdP groups. For this reason, use unique, organization-specific values for `sso_team_id` to maintain tenant isolation.

## Removal Behavior

By default, team sync only adds memberships. It does not remove users from teams, even if their IdP group claims change. This is the safe default to prevent accidental access revocation.

To enable automatic removal, set `OIDC_REMOVE_FROM_NON_SSO_TEAMS=true` in `deploy/sso.env` (Docker Compose) or `sso.oidcRemoveFromNonSsoTeams: true` in your Helm values (Kubernetes).

When enabled, on each login, StackWeaver will:

1. Check all SSO-managed teams the user is currently a member of (teams with a non-empty `sso_team_id`).
2. Remove the user from any SSO-managed team whose `sso_team_id` is no longer in the user's current group claims.

This only affects teams with `sso_team_id` set. Teams without an `sso_team_id` (manually-managed teams) are never modified by the sync process.

### Example: Removal Flow

A user is a member of the "Platform Engineering" team (`sso_team_id = "platform-engineers"`) and the "Security Team" (`sso_team_id = "security"`).

The user is removed from the `security` group in the IdP. On the next login:

1. The JWT contains `sso_groups: ["platform-engineers"]` (no longer includes `security`).
2. Team Sync detects the user is in the "Security Team" but `security` is no longer in their claims.
3. The user is removed from the "Security Team" (but stays in "Platform Engineering").

## Multi-Tenant Considerations

StackWeaver is a multi-tenant platform. The `sso_team_id` field is globally unique (enforced by a database unique constraint). This means:

- Two teams in different organizations cannot share the same `sso_team_id`. This is by design to prevent unintended cross-tenant access.
- If users from multiple organizations use the same IdP, use distinct `sso_team_id` values per organization (e.g., prefix with the org name: `acme-engineering`, `globex-engineering`).

## Finding Group Identifiers

The value you set as `sso_team_id` on a team must match the group identifier your IdP sends in its token. The format depends on the provider:

| Provider | Where to find the group ID | Format | Example |
|----------|---------------------------|--------|---------|
| Azure AD / Entra ID | Azure Portal → Entra ID → Groups → select group → Object Id | UUID | `7dddb675-73e0-4858-a8ad-0e597064301b` |
| Okta | Okta Admin → Directory → Groups → select group | Group name | `engineering` |
| AWS Cognito | Cognito console → User Pool → Groups | Group name | `platform-team` |
| Keycloak | Keycloak Admin → Realm → Groups | Group path or name | `/engineering` |
| Generic OIDC | Check your provider's admin console | Varies | - |

For Azure AD, if you configured group claims to use "Group ID" (the default), the groups claim contains Object IDs (UUIDs). If you selected "sAMAccountName" or display names instead, use those values as the `sso_team_id`.

To verify what values your provider sends, check the API logs after an SSO login:

**Docker Compose:**
```bash
docker compose -f deploy/docker-compose.yml logs api | grep -i "extracted.*groups"
```

**Kubernetes:**
```bash
kubectl logs deployment/stackweaver-api -n stackweaver | grep -i "extracted.*groups"
```

The log will show the exact group values extracted from the IdP token.

## Users Without Group Claims

If a user logs in via SSO but their token does not contain group claims (either because the IdP is not configured to send them or the user is not in any groups), the team sync process is skipped entirely. The user is still provisioned in StackWeaver but has no organization access until an administrator invites them manually.

## Environment Variable Reference

| Variable | Helm value | Default | Description |
|----------|-----------|---------|-------------|
| `ENABLE_OIDC_TEAM_SYNC` | `sso.enableOidcTeamSync` | `false` | Enable automatic team assignment based on SSO group claims |
| `OIDC_REMOVE_FROM_NON_SSO_TEAMS` | `sso.oidcRemoveFromNonSsoTeams` | `false` | Remove users from SSO-managed teams when their groups change |

## Troubleshooting

### User is not being added to expected teams

1. Verify the team has an `sso_team_id` set, and that it exactly matches the group identifier from the IdP (case-sensitive).
2. Verify team sync is enabled: `ENABLE_OIDC_TEAM_SYNC=true` in `deploy/sso.env` (Docker Compose) or `sso.enableOidcTeamSync: true` in Helm values (Kubernetes).
3. Check the API service logs for "TeamSync" messages:
   ```bash
   # Docker Compose
   docker compose -f deploy/docker-compose.yml logs api | grep -i teamsync
   # Kubernetes
   kubectl logs deployment/stackweaver-api -n stackweaver | grep -i teamsync
   ```
4. Check the API service logs for "Zitadel IDP sync webhook" messages to verify the webhook is receiving IdP claims:
   ```bash
   # Docker Compose
   docker compose -f deploy/docker-compose.yml logs api | grep -i "idp sync webhook"
   # Kubernetes
   kubectl logs deployment/stackweaver-api -n stackweaver | grep -i "idp sync webhook"
   ```
5. Check the API service logs for "complement token webhook" messages to verify the sso_groups claim is being appended:
   ```bash
   # Docker Compose
   docker compose -f deploy/docker-compose.yml logs api | grep -i "complement token webhook"
   # Kubernetes
   kubectl logs deployment/stackweaver-api -n stackweaver | grep -i "complement token webhook"
   ```
6. Verify the user's JWT contains the `sso_groups` claim. You can decode the JWT at [jwt.io](https://jwt.io) to inspect its claims.
7. If webhooks are not being called, verify the Actions V2 targets and executions are configured in Zitadel. Check the zitadel-init logs:
   ```bash
   # Docker Compose
   docker compose -f deploy/docker-compose.yml logs zitadel-init | grep -i "actions v2"
   # Kubernetes
   kubectl logs deployment/stackweaver-zitadel -c zitadel-init -n stackweaver | grep -i "actions v2"
   ```

### User is not being removed from teams

Verify that removal is enabled: `OIDC_REMOVE_FROM_NON_SSO_TEAMS=true` in `deploy/sso.env` (Docker Compose) or `sso.oidcRemoveFromNonSsoTeams: true` in Helm values (Kubernetes). When set to `false` (the default), users are never removed automatically.

### Changes are not taking effect

Team sync runs on each login. Ask the user to sign out and sign back in for group changes to take effect. Changes to IdP group memberships do not propagate until the next authentication.

### Duplicate `sso_team_id` error

The `sso_team_id` field has a unique constraint. If you see a duplicate key error when setting a team's `sso_team_id`, another team already uses that value. Use the API to search for the conflicting team and resolve the conflict.
