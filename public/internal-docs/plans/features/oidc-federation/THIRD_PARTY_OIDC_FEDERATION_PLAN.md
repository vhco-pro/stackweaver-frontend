<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Third-Party OIDC Identity Provider Federation Plan

**Status:** ✅ Substantially complete — external IdPs enabled in Zitadel, Azure AD configured via `zitadel-init`, Zitadel Actions V2 webhooks for group claim passthrough, `sso_groups` extraction in auth middleware, and `TeamSyncService` for automatic team membership sync are all implemented.

## Executive Summary

This document outlines the design plan for integrating third-party OIDC identity providers (Azure AD/Entra ID, Okta, AWS Cognito, and any generic OIDC provider) with StackWeaver via Zitadel identity brokering.

Zitadel acts as an **identity broker** between external IdPs and StackWeaver. Users authenticate at their corporate IdP, Zitadel federates the authentication and issues its own JWT, and StackWeaver's existing auth code processes it transparently. The primary work involves configuring Zitadel to accept external IdPs and ensuring group claims pass through for automatic team assignment.

**Primary test case:** Azure AD / Entra ID
**Prerequisite:** Phase 1 of `SSO_OIDC_TEAM_INTEGRATION_PLAN.md` (complete -- `sso_team_id` placeholder on Team model)

---

## Current State

### What Exists

- Zitadel OIDC authentication with Authorization Code Flow + PKCE
- JWT access tokens verified via Zitadel JWKS
- User auto-provisioning on first login via `GetOrCreateByZitadelSubject()` in `backend/internal/repository/user.go`
- Email-based user matching (supports pre-invited users with `invited-*` placeholder subjects)
- Team model with `sso_team_id` field (nullable, placeholder -- Phase 1 of SSO plan complete)
- Team-based RBAC with org/project/workspace level permissions

### What's Missing

- ~~`AllowExternalIDPs: false` in `deploy/zitadel-defaults.yaml` -- external IdPs are disabled~~ **DONE**
- ~~No external IdP configured in Zitadel~~ **DONE** (Azure AD configured via `zitadel-init`)
- ~~No Zitadel Actions for group claim passthrough~~ **DONE** (Actions V2 webhooks: IDP sync + complement token)
- ~~No group claim extraction in StackWeaver auth middleware~~ **DONE** (`ExtractUserInfo` reads `sso_groups`)
- ~~No automatic team sync based on IdP group membership~~ **DONE** (`TeamSyncService` in `backend/internal/services/team_sync/service.go`)

---

## Architecture Overview

### Authentication Flow with External IdP

```
┌─────────────────────────┐
│   External IdP          │
│   (Azure AD / Okta /    │
│    AWS Cognito / OIDC)  │
└───────────┬─────────────┘
            │
            │ 1. User authenticates at external IdP
            │ 2. Auth code returned to Zitadel callback
            │
            ▼
┌─────────────────────────┐
│   Zitadel               │
│   (Identity Broker)     │
│                         │
│   - Exchanges auth code │
│   - Extracts claims     │
│   - JIT creates/links   │
│     user in Zitadel     │
│   - Issues Zitadel JWT  │
│   - Actions: capture &  │
│     forward group claims│
└───────────┬─────────────┘
            │
            │ 3. Zitadel JWT (with Zitadel subject, NOT external sub)
            │    Custom claim: sso_groups (from Zitadel Actions)
            │
            ▼
┌─────────────────────────┐
│   StackWeaver           │
│                         │
│   - Auth middleware      │
│     verifies Zitadel JWT│
│   - GetOrCreateBy       │
│     ZitadelSubject()    │
│     auto-provisions user│
│   - TeamSyncService     │
│     maps sso_groups to  │
│     sso_team_id         │
└─────────────────────────┘
```

### Key Insight: Transparent Authentication

StackWeaver's existing auth code works **unchanged** for basic authentication. The `GetOrCreateByZitadelSubject()` method receives a Zitadel subject ID regardless of which upstream IdP was used. The user is auto-provisioned in StackWeaver's database on first login.

The only new work is:
1. Configuring Zitadel to accept external IdPs (Phase A)
2. Forwarding group claims through Zitadel (Phase B)
3. Mapping groups to team membership (Phase C)

---

## OIDC: A Well-Defined Standard

OIDC (OpenID Connect) is a standardized protocol built on OAuth 2.0. All major identity providers implement the same core specification:

- **Discovery:** `/.well-known/openid-configuration` endpoint
- **Authorization:** Authorization Code Flow with PKCE
- **Token Exchange:** Standard token endpoint
- **Claims:** Standard claim names (`sub`, `email`, `name`, `groups`)

The core integration pattern (Generic OIDC) works the same across all providers. Provider-specific differences are limited to:

| Aspect | Azure AD | Okta | AWS Cognito | Generic OIDC |
|---|---|---|---|---|
| Zitadel template | Dedicated `AddAzureADProvider` | Generic OIDC | Generic OIDC | Generic OIDC |
| Group claim name | `groups` (Object IDs) | `groups` | `cognito:groups` | Varies |
| email_verified | Not sent (set `emailVerified: true`) | Sent | Sent | Varies |
| App registration | Azure Portal | Okta Admin Console | AWS Console | Provider-specific |
| Tenant config | Tenant ID required | Org URL as issuer | User Pool ID in issuer URL | Issuer URL |

---

## Implementation Phases

### Phase A: Enable External IdP Authentication

**Goal:** Users from Azure AD (and other OIDC providers) can authenticate into StackWeaver via Zitadel federation and immediately receive baseline read-only access. No group-based mapping yet; advanced team assignment comes in Phase C.

**Status:** Not started

#### A.1: Enable External IdPs in Zitadel Defaults

**File:** `deploy/zitadel-defaults.yaml`

Change the login policy to allow external identity providers:

```yaml
DefaultInstance:
  LoginPolicy:
    AllowUsernamePassword: true
    AllowExternalIDPs: true    # Changed from false
```

This enables the external IdP login buttons on the Zitadel login page. Without individual IdP configurations (A.2), no buttons will appear.

#### A.2: Extend zitadel-init to Configure IdP Providers

**File:** `scripts/zitadel-init/main.go`

Add a new method `ConfigureIdentityProviders()` that programmatically creates IdP configurations using the Zitadel Go SDK v3 (already a dependency via `github.com/zitadel/zitadel-go/v3`).

**Conditional execution:** Only configure if the relevant environment variables are set. If `AZURE_AD_CLIENT_ID` is empty, skip Azure AD setup. If `OIDC_IDP_CLIENT_ID` is empty, skip Generic OIDC setup. This preserves current behavior for existing deployments.

**Azure AD / Entra ID Configuration:**

Uses the dedicated `AddAzureADProvider` template in the Zitadel SDK.

```go
func (c *ZitadelClient) ConfigureAzureADProvider(clientID, clientSecret, tenantID string) error {
    // Use Zitadel Management API: AddAzureADProvider
    //
    // Key fields:
    //   Name:            "Microsoft"
    //   ClientId:        clientID (from Azure App Registration)
    //   ClientSecret:    clientSecret (from Azure App Registration)
    //   Tenant:          AzureADTenantType with specific tenant ID
    //   EmailVerified:   true (Azure AD doesn't send email_verified claim)
    //   Scopes:          ["openid", "profile", "email", "User.Read"]
    //   ProviderOptions:
    //     IsAutoCreation:   true   (JIT provisioning)
    //     IsAutoUpdate:     true   (sync profile on subsequent logins)
    //     IsLinkingAllowed: true   (link to existing Zitadel users)
    //     AutoLinking:      AUTO_LINKING_OPTION_EMAIL (match by email)
    //
    // After creation, add to login policy:
    //   AddIDPToLoginPolicy(idpID)
}
```

**Generic OIDC Configuration (Okta, AWS Cognito, etc.):**

Uses `AddGenericOIDCProvider` for any OIDC-compliant provider.

```go
func (c *ZitadelClient) ConfigureGenericOIDCProvider(name, issuer, clientID, clientSecret string) error {
    // Use Zitadel Management API: AddGenericOIDCProvider
    //
    // Key fields:
    //   Name:              name (display name on login screen)
    //   Issuer:            issuer (OIDC issuer URL)
    //   ClientId:          clientID
    //   ClientSecret:      clientSecret
    //   Scopes:            ["openid", "profile", "email"]
    //   IsIdTokenMapping:  false (use userinfo endpoint)
    //   ProviderOptions:
    //     IsAutoCreation:   true
    //     IsAutoUpdate:     true
    //     IsLinkingAllowed: true
    //     AutoLinking:      AUTO_LINKING_OPTION_EMAIL
    //
    // After creation, add to login policy:
    //   AddIDPToLoginPolicy(idpID)
}
```

**Idempotency:** Follow the existing `GetOrCreate` pattern used throughout `zitadel-init/main.go`. Check if an IdP with the same name exists before creating. If it exists, verify configuration matches and update if needed.

#### A.3: New Environment Variables

**File:** `deploy/.env` (added by user, documented)

```bash
# Azure AD / Entra ID (optional -- omit or leave empty to disable)
AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=
AZURE_AD_TENANT_ID=

# Generic OIDC Provider (optional -- omit or leave empty to disable)
OIDC_IDP_NAME=
OIDC_IDP_ISSUER=
OIDC_IDP_CLIENT_ID=
OIDC_IDP_CLIENT_SECRET=
```

#### A.4: Update Docker Compose

**File:** `deploy/docker-compose.yml`

Pass IdP environment variables to the `zitadel-init` service:

```yaml
zitadel-init:
  environment:
    # Existing vars...
    - AZURE_AD_CLIENT_ID=${AZURE_AD_CLIENT_ID:-}
    - AZURE_AD_CLIENT_SECRET=${AZURE_AD_CLIENT_SECRET:-}
    - AZURE_AD_TENANT_ID=${AZURE_AD_TENANT_ID:-}
    - OIDC_IDP_NAME=${OIDC_IDP_NAME:-}
    - OIDC_IDP_ISSUER=${OIDC_IDP_ISSUER:-}
    - OIDC_IDP_CLIENT_ID=${OIDC_IDP_CLIENT_ID:-}
    - OIDC_IDP_CLIENT_SECRET=${OIDC_IDP_CLIENT_SECRET:-}
```

#### A.5: Default SSO Team Assignment

**Problem:** After Phase A, a federated user is auto-provisioned in StackWeaver but has zero org/team membership and therefore no access to anything. Without group claims (Phase B+C), the admin must manually add every federated user to an org and team.

**Solution:** Every organization already has a default **"viewers" team** with read-only permissions (created automatically in `createDefaultTeams()` at `backend/internal/api/v2/handlers/organizations.go:864-932`). We leverage this existing team by automatically adding new SSO users to it on first login.

**How it works:**

1. During user auto-provisioning in `GetOrCreateByZitadelSubject()`, detect when a **new user** is created (not an existing user logging in again)
2. For new users: look up organizations that have SSO enabled (i.e., an external IdP is configured)
3. Add the user as an organization member and to the org's "viewers" team
4. The user immediately has read-only access to workspaces and projects

No new configuration needed -- the "viewers" team already exists with the right permissions (`ReadWorkspaces: true`, `ReadProjects: true`, all manage permissions `false`). This is a sensible default that gives immediate baseline access without any admin intervention.

**Relationship to Phase C:** This default assignment is a **fallback**. When Phase C (group-based team sync) is enabled and the user has group claims, the group-based assignment takes precedence and can place the user into more privileged teams. The "viewers" default ensures users always get at least baseline access even when group claims are absent.

**Files to modify:**
- `backend/internal/repository/user.go` or `backend/internal/services/auth/service.go` -- Add "viewers" team assignment on new user creation

#### A.6: No Changes Required (Transparent)

These components work unchanged:

- **Frontend:** Zitadel's login page automatically shows IdP buttons when configured. The StackWeaver frontend redirects to Zitadel for auth and receives a Zitadel JWT back, regardless of which IdP was used.
- **Backend auth middleware:** `backend/internal/services/auth/zitadel.go` verifies Zitadel JWTs. The JWT issuer is always Zitadel, regardless of the upstream IdP.
- **User auto-provisioning:** `backend/internal/repository/user.go:GetOrCreateByZitadelSubject()` creates users based on Zitadel subject. The Zitadel subject is a Zitadel-internal ID, not the external IdP subject.

---

### Phase B: Group Claim Passthrough via Zitadel Actions

**Goal:** External IdP group claims are preserved through Zitadel and appear in the JWT that StackWeaver receives, enabling automatic team mapping.

**Status:** Not started
**Depends on:** Phase A

#### The Problem

Zitadel does **not** natively forward external IdP group claims in its own JWTs. When a user authenticates via Azure AD, the Azure AD `groups` claim is available during the Zitadel external auth callback but is dropped when Zitadel issues its own token to StackWeaver.

#### Solution: Zitadel Actions

Zitadel Actions are JavaScript functions that execute at specific points in authentication flows. Two actions are needed:

**Action 1: Capture Groups on External Authentication**

Trigger: External Authentication → Post Authentication

```javascript
// Capture group claims from external IdP and store as Zitadel user metadata.
// Handles multiple claim formats from different providers:
//   Azure AD:    "groups" (array of Object IDs)
//   Okta:        "groups" (array of group names)
//   AWS Cognito: "cognito:groups" (array of group names)
function postAuthentication(ctx, api) {
    // Try standard "groups" claim first (Azure AD, Okta)
    var groups = ctx.getClaim("groups");

    // Fall back to Cognito-specific claim
    if (!groups) {
        groups = ctx.getClaim("cognito:groups");
    }

    if (groups && Array.isArray(groups) && groups.length > 0) {
        // Store as user metadata for later retrieval in token complement
        api.v1.user.appendMetadata("sso_groups", JSON.stringify(groups));
    }
}
```

**Action 2: Include Groups in Zitadel JWT**

Trigger: Complement Token → Pre Access Token Creation

```javascript
// Read stored group metadata and add as custom claim to Zitadel's JWT.
// StackWeaver reads the "sso_groups" claim for automatic team assignment.
function preAccessTokenCreation(ctx, api) {
    var groupsJson = api.v1.user.getMetadata("sso_groups");
    if (groupsJson) {
        try {
            var groups = JSON.parse(groupsJson);
            api.v1.claims.setClaim("sso_groups", groups);
        } catch (e) {
            // Metadata corrupted, skip
        }
    }
}
```

This normalizes all provider-specific claim names into a single `sso_groups` claim that StackWeaver can rely on.

#### B.1: Extend zitadel-init to Create Zitadel Actions

**File:** `scripts/zitadel-init/main.go`

Add method `ConfigureActions()` that uses the Zitadel Management API to:
1. Create/update the two JavaScript actions
2. Set flow triggers (External Authentication → Post Authentication, Complement Token → Pre Access Token Creation)

**Conditional:** Only create actions if at least one IdP is configured (Azure AD or Generic OIDC env vars are set).

#### B.2: Extract Group Claims in Backend Auth

**File:** `backend/internal/services/auth/zitadel.go`

Extend the `UserInfo` struct and `ExtractUserInfo()` function:

```go
type UserInfo struct {
    // ... existing fields ...
    Groups []string  // SSO group IDs from external IdP (via Zitadel Actions)
}

func ExtractUserInfo(...) *UserInfo {
    // ... existing extraction logic ...

    // Extract SSO groups (set by Zitadel Actions from external IdP claims)
    if groups, ok := claimsMap["sso_groups"]; ok {
        if groupSlice, ok := groups.([]interface{}); ok {
            for _, g := range groupSlice {
                if gs, ok := g.(string); ok {
                    info.Groups = append(info.Groups, gs)
                }
            }
        }
    }

    return info
}
```

#### B.3: Pass Groups Through Middleware Context

**File:** `backend/internal/services/auth/service.go`

After extracting user info in the auth middleware, store groups in the gin context:

```go
if len(userInfo.Groups) > 0 {
    c.Set("sso_groups", userInfo.Groups)
}
```

This makes groups available to downstream handlers and the TeamSyncService (Phase C).

---

### Phase C: Automatic Team Assignment

**Goal:** Users from external IdPs are automatically assigned to StackWeaver teams based on their group memberships.

**Status:** Not started
**Depends on:** Phase B
**Aligns with:** Phases 2-3 of `SSO_OIDC_TEAM_INTEGRATION_PLAN.md`

#### C.1: Create TeamSyncService

**New file:** `backend/internal/services/team_sync/service.go`

```go
type TeamSyncService interface {
    // SyncUserTeams syncs a user's team membership based on SSO group claims.
    // Called after successful authentication when sso_groups are present.
    SyncUserTeams(ctx context.Context, userID uuid.UUID, orgID uuid.UUID, ssoGroups []string) error
}
```

**Sync logic on each login:**

1. Extract `sso_groups` from gin context
2. Query teams where `sso_team_id IN (ssoGroups)` within the user's organization(s)
3. For each matching team:
   - If user is not a member → add user to team
   - If user is already a member → no-op
4. If `OIDC_REMOVE_FROM_NON_SSO_TEAMS=true`:
   - Find SSO-managed teams (teams with non-null `sso_team_id`) where user is a member but the team's `sso_team_id` is NOT in the current `sso_groups`
   - Remove user from those teams
   - Never remove from manually-managed teams (teams without `sso_team_id`)

#### C.2: Auto Organization Membership

When a user is synced to a team via SSO, they also need organization membership. The TeamSyncService should auto-create an `OrganizationMember` record if the user isn't already a member of the team's organization.

#### C.3: Repository Addition

**File:** `backend/internal/repository/team.go`

Add query method:

```go
// FindBySSOTeamIDs returns all teams where sso_team_id matches any of the given IDs
func (r *TeamRepository) FindBySSOTeamIDs(ctx context.Context, orgID uuid.UUID, ssoTeamIDs []string) ([]models.Team, error)
```

#### C.4: Integration Point

**File:** `backend/internal/services/auth/service.go`

After successful JWT verification and user provisioning, call TeamSyncService if groups are present:

```go
if len(userInfo.Groups) > 0 && teamSyncEnabled {
    // Get user's organizations (or all orgs with SSO-mapped teams)
    err := teamSyncService.SyncUserTeams(ctx, user.ID, orgID, userInfo.Groups)
    if err != nil {
        // Log but don't fail authentication
        logger.Warnf("Team sync failed for user %s: %v", user.ID, err)
    }
}
```

#### C.5: Configuration

```bash
# Enable automatic team sync based on SSO groups (default: false)
ENABLE_OIDC_TEAM_SYNC=false

# Remove users from SSO-managed teams when group is no longer in claims (default: false)
# Only affects teams with sso_team_id set; never removes from manually-managed teams
OIDC_REMOVE_FROM_NON_SSO_TEAMS=false
```

#### C.4: Admin Workflow

1. Admin creates a team in StackWeaver (via API or UI)
2. Admin sets the `sso_team_id` to match the external IdP group identifier:
   - For Azure AD: the group's Object ID (UUID from Azure Portal)
   - For Okta: the group name or ID
   - For AWS Cognito: the Cognito group name
3. Admin configures team permissions (org access, project access, workspace access)
4. When a user from that group logs in, they are automatically added to the team
5. User inherits all team permissions

---

### Phase D: User-Facing Documentation

**Goal:** Comprehensive user-facing documentation in `docs/` that guides StackWeaver operators through configuring SSO with each major identity provider.

**Status:** Not started
**Depends on:** Phase A (minimum), ideally after Phase C is complete so docs cover the full feature

#### D.1: SSO Overview Guide

**New file:** `docs/user-guides/sso/README.md`

Covers:
- What SSO federation is and how it works in StackWeaver (Zitadel as identity broker)
- Supported identity providers (Azure AD, Okta, AWS Cognito, Generic OIDC)
- Architecture diagram showing the authentication flow
- Prerequisites (StackWeaver deployed, admin access to external IdP)
- Quick start: minimum configuration to get SSO working
- How default SSO team assignment works (baseline access without group claims)
- How group-based team assignment works (advanced, requires group claim configuration)
- Troubleshooting common issues (redirect URI mismatch, email not matching, user has no access)

#### D.2: Azure AD / Entra ID Configuration Guide

**New file:** `docs/user-guides/sso/azure-ad.md`

Step-by-step guide with screenshots/descriptions:
1. Create App Registration in Azure Portal
2. Configure redirect URI (with exact URL for StackWeaver)
3. Generate client secret
4. Set environment variables in StackWeaver (`AZURE_AD_CLIENT_ID`, etc.)
5. Restart services (`make restage` or `make fresh`)
6. Verify: login page shows "Login with Microsoft" button
7. (Optional) Configure group claims for automatic team assignment
   - Enable `groupMembershipClaims` in app manifest
   - Map Azure AD group Object IDs to StackWeaver team `sso_team_id`
8. Azure AD-specific notes (email_verified, 200 group limit, tenant types)

#### D.3: Okta Configuration Guide

**New file:** `docs/user-guides/sso/okta.md`

Step-by-step guide:
1. Create OIDC Web Application in Okta Admin Console
2. Configure redirect URI
3. Copy client ID and secret
4. Set environment variables (`OIDC_IDP_NAME=Okta`, `OIDC_IDP_ISSUER`, etc.)
5. Restart services
6. Verify login
7. (Optional) Configure group claims in Authorization Server for automatic team assignment

#### D.4: AWS Cognito Configuration Guide

**New file:** `docs/user-guides/sso/aws-cognito.md`

Step-by-step guide:
1. Create or select Cognito User Pool
2. Create confidential app client
3. Configure callback URLs
4. Set environment variables (`OIDC_IDP_NAME=AWS Cognito`, `OIDC_IDP_ISSUER`, etc.)
5. Restart services
6. Verify login
7. Group claims (`cognito:groups`) are automatic -- just map to StackWeaver teams

#### D.5: Generic OIDC Provider Guide

**New file:** `docs/user-guides/sso/generic-oidc.md`

Guide for any OIDC-compliant provider not covered above:
1. Requirements: provider must support OIDC discovery (`/.well-known/openid-configuration`)
2. Register a confidential client application in the provider
3. Configure redirect URI
4. Set environment variables
5. Restart and verify
6. Notes on group claim configuration (varies by provider)

#### D.6: SSO Team Mapping Guide

**New file:** `docs/user-guides/sso/team-mapping.md`

Guide for configuring automatic team assignment:
1. How `sso_team_id` works on teams
2. Finding group identifiers in each provider (Azure AD Object IDs, Okta group names, etc.)
3. Creating teams with `sso_team_id` via API and UI
4. Enabling `ENABLE_OIDC_TEAM_SYNC`
5. Configuring removal behavior (`OIDC_REMOVE_FROM_NON_SSO_TEAMS`)
6. Default SSO team configuration for baseline access
7. Verifying team sync is working

#### Documentation Standards

All guides must follow the existing user-facing documentation standards defined in `.cursorrules`:
- Full sentences, not just bullet points
- Provide context and explanations
- Practical examples with exact commands/URLs
- Proper markdown formatting with headings
- Reference actual source files where relevant (not code blocks)
- Listed in `docs/README.md` for the docs viewer

---

## Provider-Specific Setup Guides (Internal Reference)

### Azure AD / Entra ID

#### Azure Portal App Registration

1. Go to Azure Portal → Microsoft Entra ID → App registrations → New registration
2. Name: "StackWeaver" (or your preferred name)
3. Supported account types: Choose based on your needs
   - "Single tenant" for your organization only
   - "Multitenant" for any Azure AD organization
4. Redirect URI:
   - Type: Web
   - URI: `{ZITADEL_ISSUER}/ui/login/login/externalidp/callback`
   - For local dev: `http://localhost:8080/ui/login/login/externalidp/callback`
5. Click Register

#### Client Secret

1. Go to Certificates & secrets → New client secret
2. Add a description, set expiration
3. Copy the secret **Value** (not the Secret ID)

#### Group Claims (Required for Phase B/C)

1. Go to Token configuration → Add groups claim
2. Select "Security groups"
3. For the ID token, select "Group ID" (returns Object IDs)
4. Alternatively, edit the app manifest directly:
   ```json
   "groupMembershipClaims": "SecurityGroup"
   ```

#### Environment Variables

```bash
AZURE_AD_CLIENT_ID=<Application (client) ID from Azure Portal>
AZURE_AD_CLIENT_SECRET=<Client secret Value>
AZURE_AD_TENANT_ID=<Directory (tenant) ID from Azure Portal>
```

#### Azure AD-Specific Notes

- Azure AD does **not** send the `email_verified` claim. The Zitadel provider configuration sets `emailVerified: true` to trust Azure AD emails.
- Group claims return Object IDs (UUIDs) by default, not group names. The `sso_team_id` in StackWeaver should match these Object IDs.
- Azure AD has a limit of 200 groups in token claims. For users in more than 200 groups, use the Microsoft Graph API to fetch groups (not covered in this plan).

---

### Okta

#### Okta Application Setup

1. Go to Okta Admin Console → Applications → Create App Integration
2. Sign-in method: OIDC - OpenID Connect
3. Application type: Web Application
4. Redirect URI: `{ZITADEL_ISSUER}/ui/login/login/externalidp/callback`
5. Assignments: Assign to users/groups as needed

#### Group Claims (Required for Phase B/C)

1. Go to Security → API → Authorization Servers → default
2. Claims tab → Add Claim
3. Name: `groups`
4. Include in: ID Token (Always)
5. Value type: Groups
6. Filter: Matches regex `.*` (or specific group filter)

#### Environment Variables

Uses Generic OIDC configuration:

```bash
OIDC_IDP_NAME=Okta
OIDC_IDP_ISSUER=https://<your-okta-domain>.okta.com
OIDC_IDP_CLIENT_ID=<Client ID from Okta>
OIDC_IDP_CLIENT_SECRET=<Client Secret from Okta>
```

---

### AWS Cognito

#### Cognito User Pool Setup

1. Go to AWS Console → Cognito → User Pools → Select your pool
2. App integration → App clients → Create app client
3. Client type: Confidential client
4. Generate a client secret
5. Allowed callback URLs: `{ZITADEL_ISSUER}/ui/login/login/externalidp/callback`
6. Allowed OAuth flows: Authorization code grant
7. Allowed OAuth scopes: openid, profile, email

#### Group Claims

Cognito automatically includes `cognito:groups` in tokens when a user is in Cognito groups. No additional configuration needed.

#### Environment Variables

Uses Generic OIDC configuration:

```bash
OIDC_IDP_NAME=AWS Cognito
OIDC_IDP_ISSUER=https://cognito-idp.<region>.amazonaws.com/<user-pool-id>
OIDC_IDP_CLIENT_ID=<App client ID>
OIDC_IDP_CLIENT_SECRET=<App client secret>
```

---

## Files to Modify/Create

| File | Phase | Change |
|---|---|---|
| `deploy/zitadel-defaults.yaml` | A | Set `AllowExternalIDPs: true` |
| `scripts/zitadel-init/main.go` | A+B | Add `ConfigureIdentityProviders()`, `ConfigureActions()`, `AddIDPToLoginPolicy()` |
| `scripts/zitadel-init/go.mod` | A | May need additional Zitadel SDK imports for IdP/Action APIs |
| `deploy/docker-compose.yml` | A | Pass IdP env vars to `zitadel-init` service |
| `backend/internal/services/auth/service.go` | A+B+C | Auto-add new users to "viewers" team, store groups in context, call TeamSyncService |
| `backend/internal/services/auth/zitadel.go` | B | Add `Groups []string` to `UserInfo`, extract `sso_groups` in `ExtractUserInfo()` |
| `backend/internal/services/team_sync/service.go` | C | **New** -- Team sync logic |
| `backend/internal/repository/team.go` | C | Add `FindBySSOTeamIDs()` query |
| `docs/user-guides/sso/README.md` | D | **New** -- SSO overview guide |
| `docs/user-guides/sso/azure-ad.md` | D | **New** -- Azure AD setup guide |
| `docs/user-guides/sso/okta.md` | D | **New** -- Okta setup guide |
| `docs/user-guides/sso/aws-cognito.md` | D | **New** -- AWS Cognito setup guide |
| `docs/user-guides/sso/generic-oidc.md` | D | **New** -- Generic OIDC provider guide |
| `docs/user-guides/sso/team-mapping.md` | D | **New** -- SSO team mapping guide |

---

## Testing Strategy

### Phase A: Basic Authentication

1. Register app in Azure AD Portal, configure redirect URI pointing to Zitadel callback
2. Set `AZURE_AD_*` env vars in `deploy/.env`
3. Run `make restage` to reinitialize Zitadel with IdP configuration
4. Visit StackWeaver login → Zitadel login page should show "Login with Microsoft" button
5. Click button → should redirect to Microsoft login
6. Authenticate with Azure AD account
7. Verify: user auto-created in Zitadel (check Zitadel console at `localhost:8080`)
8. Verify: user auto-created in StackWeaver database (check `users` table or API)
9. Test with a second provider (Generic OIDC) to confirm multi-IdP support
10. Test: existing Zitadel-native login still works alongside external IdP

### Phase B: Group Claim Passthrough

1. Configure Azure AD app manifest with `groupMembershipClaims: "SecurityGroup"`
2. Assign test user to an Azure AD security group
3. Login via Azure AD
4. Check Zitadel user metadata (via Zitadel console or API) → should contain `sso_groups`
5. Decode the StackWeaver JWT (browser dev tools) → verify `sso_groups` claim contains Azure AD group Object IDs
6. Check StackWeaver backend logs → should log extracted groups

### Phase C: Automatic Team Assignment

1. Create a team in StackWeaver with `sso_team_id` set to the Azure AD group Object ID
2. Set `ENABLE_OIDC_TEAM_SYNC=true` in env
3. Login as a user who is a member of that Azure AD group
4. Verify: user is automatically added to the StackWeaver team
5. Verify: user has correct permissions from team membership
6. Test removal: set `OIDC_REMOVE_FROM_NON_SSO_TEAMS=true`, remove user from Azure AD group, re-login, verify user is removed from StackWeaver team
7. Test: verify manually-managed teams (without `sso_team_id`) are never affected by sync
8. Test with `terraform-provider-tfe` to confirm TFE API compatibility for teams with SSO

---

## Security Considerations

1. **Client secret storage:** IdP client secrets must be stored only in `deploy/.env` (gitignored), never in code or config files.
2. **Email trust:** When `emailVerified: true` is set for Azure AD, we trust that Azure AD has verified the email. This is safe for corporate Azure AD tenants but should be documented.
3. **Auto-linking by email:** `AUTO_LINKING_OPTION_EMAIL` automatically links external identities to existing Zitadel users by email match. This is the right default for StackWeaver since it already uses email as a key identifier, but means an attacker who controls an external IdP could impersonate any user whose email they know. This is acceptable when the admin explicitly configures and trusts the external IdP.
4. **Group claim size:** Azure AD limits group claims to 200 groups per token. For users in many groups, only the first 200 are included. Document this limitation.
5. **Team sync logging:** All automatic team membership changes should be logged for audit trail.
6. **Conservative defaults:** `ENABLE_OIDC_TEAM_SYNC=false` and `OIDC_REMOVE_FROM_NON_SSO_TEAMS=false` ensure no automatic changes unless explicitly enabled.

---

## Migration Path

### For Existing Deployments

1. **Phase A is opt-in:** Existing deployments with no `AZURE_AD_*` or `OIDC_IDP_*` env vars continue to work exactly as before. The only default change is `AllowExternalIDPs: true` in Zitadel, which has no effect without configured IdPs.
2. **Phase B is transparent:** Zitadel Actions only fire when external auth is used. Native Zitadel logins are unaffected.
3. **Phase C is opt-in:** `ENABLE_OIDC_TEAM_SYNC=false` by default. Existing team memberships are never modified unless explicitly enabled.

### For New Deployments

1. Register app with external IdP (Azure AD, Okta, or AWS Cognito)
2. Set env vars in `deploy/.env`
3. Run `make up` → Zitadel is configured with IdP automatically
4. Users can authenticate via external IdP immediately and get baseline read-only access (auto-added to the existing "viewers" team)
5. (Optional) Configure group claims and `sso_team_id` mappings for fine-grained team assignment

---

## Relationship to Existing Plans

This document covers the **upstream federation** (getting external IdP users into Zitadel and StackWeaver). It complements the existing `SSO_OIDC_TEAM_INTEGRATION_PLAN.md` which covers the **downstream team sync** (mapping SSO claims to team membership).

**Mapping to existing SSO plan phases:**
- SSO Plan Phase 1 (sso_team_id placeholder) → **Complete**
- SSO Plan Phase 2 (OIDC claim extraction) → Covered by **Phase B** of this plan
- SSO Plan Phase 3 (Team membership sync) → Covered by **Phase C** of this plan
- SSO Plan Phase 4 (Zitadel group integration) → Out of scope for initial implementation; can be added later using Zitadel Management API for bidirectional group sync
- SSO Plan Phase 5 (SAML support) → Out of scope; Zitadel supports SAML federation with a similar pattern to OIDC, can be added as a future phase

**Phase summary and dependencies:**

```
Phase A: External IdP Authentication + Default SSO Team
    │     (users can log in, get baseline read-only access)
    │     Group claims are NOT required for this phase.
    │
    ├──→ Phase B: Group Claim Passthrough (optional enhancement)
    │     │     (Zitadel Actions capture & forward IdP groups)
    │     │
    │     └──→ Phase C: Automatic Team Assignment (optional enhancement)
    │           (group-based team sync, overrides/supplements default team)
    │
    └──→ Phase D: User-Facing Documentation
          (can start after Phase A, updated as B+C are completed)
```

Phase A is fully functional on its own. Phases B+C add progressive enhancement for organizations that want group-based automatic team assignment. Phase D should be written alongside or after each implementation phase.

---

## References

- TFE SSO Docs: https://developer.hashicorp.com/terraform/cloud-docs/users-teams-organizations/single-sign-on
- Zitadel Identity Providers: https://zitadel.com/docs/guides/integrate/identity-providers/introduction
- Zitadel Azure AD OIDC: https://zitadel.com/docs/guides/integrate/identity-providers/azure-ad-oidc
- Zitadel Okta OIDC: https://zitadel.com/docs/guides/integrate/identity-providers/okta-oidc
- Zitadel Generic OIDC: https://zitadel.com/docs/guides/integrate/identity-providers/generic-oidc
- Zitadel Actions: https://zitadel.com/docs/apis/actions/external-authentication
    - Examples: https://github.com/zitadel/actions/blob/main/examples/
- Zitadel Account Linking: https://zitadel.com/docs/concepts/features/account-linking
- OIDC Core Spec: https://openid.net/specs/openid-connect-core-1_0.html
