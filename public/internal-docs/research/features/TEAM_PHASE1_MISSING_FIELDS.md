<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Team Phase 1 - Missing Fields Analysis

**Last Updated**: 2026-01-12  
**Status**: ✅ **COMPLETE** - All Phase 1 fields implemented

> **Note**: This document was created during Phase 1 implementation planning. All fields described below have been implemented. See `TEAMS_IMPLEMENTATION_PLAN.md` for comprehensive implementation status.

## Current Status

**Phase**: Phase 1 Implementation Complete ✅

Based on the Terraform provider's expected input/output, we needed to support these fields:

### ✅ Currently Supported

| Field | Type | Status | Notes |
|-------|------|--------|-------|
| `id` | string (computed) | ✅ | UUID, auto-generated |
| `name` | string | ✅ | Required, validated |
| `organization` | string | ✅ | Organization name (from URL param) |
| `visibility` | string | ✅ | "organization" or "secret", defaults to "secret" (TFE default) |
| `allow_member_token_management` | bool | ✅ | Defaults to `true`, TFE-compatible |
| `organization_access` | object | ✅ | 16 boolean permissions, TFE-compatible |
| `sso_team_id` | string (optional) | ✅ | Nullable field for SSO integration (placeholder) |
| `permissions` | object | ✅ | Calculated based on user's org role (admin = all permissions) |

### Implementation Notes

- **Team ID Format**: Using UUIDs (not TFE's short format). UUIDs are acceptable by the provider and align with StackWeaver's internal standards.
- **Permissions**: Calculated dynamically based on user's role in the organization. Only organization admins receive full permissions (matches TFE behavior).
- **Response Format**: Full JSON:API format with all required fields (`id`, `type`, `attributes`, `relationships`, `links`).

---

## Field Details

### 1. `allow_member_token_management`

**Type**: `bool`  
**Default**: `true`  
**Purpose**: Controls whether team members can manage team tokens  
**TFE API**: `allow-member-token-management` attribute

**Implementation**:
- Add to `Team` model: `AllowMemberTokenManagement bool`
- Add to database schema: `allow_member_token_management BOOLEAN DEFAULT true`
- Include in API request/response
- Default to `true` if not provided

**Complexity**: ⭐ Low - Simple boolean field

---

### 2. `organization_access`

**Type**: Object (computed)  
**Default**: All fields `false`  
**Purpose**: Organization-level permissions for the team  
**TFE API**: `organization-access` attribute

**Structure** (16 boolean fields):
```json
{
  "manage-policies": false,
  "manage-policy-overrides": false,
  "manage-workspaces": false,
  "manage-vcs-settings": false,
  "manage-providers": false,
  "manage-modules": false,
  "manage-run-tasks": false,
  "manage-projects": false,
  "read-workspaces": false,
  "read-projects": false,
  "manage-membership": false,
  "manage-teams": false,
  "manage-organization-access": false,
  "access-secret-teams": false,
  "manage-agent-pools": false
}
```

**Implementation Options**:

**Option A: Separate Table** (Recommended for flexibility)
```sql
CREATE TABLE team_organization_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  manage_policies BOOLEAN DEFAULT false,
  manage_policy_overrides BOOLEAN DEFAULT false,
  manage_workspaces BOOLEAN DEFAULT false,
  manage_vcs_settings BOOLEAN DEFAULT false,
  manage_providers BOOLEAN DEFAULT false,
  manage_modules BOOLEAN DEFAULT false,
  manage_run_tasks BOOLEAN DEFAULT false,
  manage_projects BOOLEAN DEFAULT false,
  read_workspaces BOOLEAN DEFAULT false,
  read_projects BOOLEAN DEFAULT false,
  manage_membership BOOLEAN DEFAULT false,
  manage_teams BOOLEAN DEFAULT false,
  manage_organization_access BOOLEAN DEFAULT false,
  access_secret_teams BOOLEAN DEFAULT false,
  manage_agent_pools BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(team_id)
);
```

**Option B: JSONB Column** (Simpler, less flexible)
```sql
ALTER TABLE teams ADD COLUMN organization_access JSONB DEFAULT '{}';
```

**Recommendation**: **Option A** - Separate table allows better querying, indexing, and future RBAC integration.

**Complexity**: ⭐⭐⭐ Medium - Requires new model, repository methods, and API handling

---

### 3. Team-Scoped API Tokens

**Type**: API Key Scope Extension  
**Purpose**: Allow API keys to be scoped to specific teams  
**TFE Compatibility**: TFE supports team tokens via `/api/v2/teams/:id/tokens` endpoint

**Current State**:
- ✅ API keys support scopes: `org`, `project`, `user`, `*`
- ❌ No `team` scope support
- ❌ No `TeamID` field in `APIKey` model

**Implementation**:
- [ ] Update scope parser to support `team:<team_id>:<permission>` format
- [ ] Add `TeamID` field to `APIKey` model (nullable UUID)
- [ ] Add database column: `team_id UUID REFERENCES teams(id)`
- [ ] Update `ParseScope()` to accept `team` as scope type
- [ ] Update `ScopeChecker` to validate team access
- [ ] Update API key creation handler to accept team scope
- [ ] Validate team membership when creating team-scoped keys
- [ ] Respect `allow_member_token_management` setting:
  - If `false`, only team admins can create team tokens
  - If `true`, team members can create team tokens
- [ ] Update UI to show "Team" as a scope option
- [ ] Update scope documentation

**Scope Format**:
```
team:<team_id>:<permission>
```

**Examples**:
- `team:123e4567-e89b-12d3-a456-426614174000:read` - Read access to specific team
- `team:123e4567-e89b-12d3-a456-426614174000:write` - Write access to specific team
- `team:123e4567-e89b-12d3-a456-426614174000:admin` - Admin access to specific team

**Complexity**: ⭐⭐ Medium - Requires scope parser updates and team membership validation

**TFE Compatibility Note**: TFE has a separate `/api/v2/teams/:id/tokens` endpoint for team tokens. We can support this via scoped API keys, or implement a separate endpoint later.

---

### 4. `sso_team_id`

**Type**: `string` (optional)  
**Default**: `null`  
**Purpose**: Unique identifier to control team membership via SAML SSO  
**TFE API**: `sso-team-id` attribute

**TFE Documentation**: 
> "Unique Identifier to control [team membership](https://developer.hashicorp.com/terraform/cloud-docs/users-teams-organizations/single-sign-on#team-names-and-sso-team-ids) via SAML"

**Implementation Considerations**:

1. **Zitadel Integration**: SSO team ID should come from Zitadel's group/team mapping
2. **SAML Attribute Mapping**: Maps SAML assertion attributes to team membership
3. **Automatic Membership**: When a user authenticates via SSO, they're automatically added to teams matching their SSO team ID

**Current StackWeaver State**:
- ✅ Zitadel OIDC integration exists
- ❌ No SAML support yet
- ❌ No SSO team mapping
- ❌ No automatic team membership based on SSO

**Recommendation**: **Defer to separate implementation plan**

**Why Defer**:
- Requires SAML support (we only have OIDC currently)
- Requires Zitadel group/team mapping integration
- Requires automatic team membership sync
- Not critical for Phase 1 (can be `null` for now)

**Complexity**: ⭐⭐⭐⭐⭐ High - Requires SSO infrastructure changes

---

## Implementation Plan

### Phase 1A: Quick Wins (High Priority, Low Complexity) ✅ COMPLETE

**Status**: ✅ Implemented
- ✅ Added `AllowMemberTokenManagement` field to `Team` model
- ✅ Added to database schema (defaults to `true`)
- ✅ Included in API request/response handling
- ✅ Defaults to `true` if not provided (TFE-compatible)

1. **Add `allow_member_token_management`**
   - [ ] Add field to `Team` model
   - [ ] Add database migration
   - [ ] Update API request/response handling
   - [ ] Default to `true` if not provided

**Estimated Time**: 30 minutes

### Phase 1B: Organization Access (High Priority, Medium Complexity) ✅ COMPLETE

**Status**: ✅ Implemented
- ✅ Created `TeamOrganizationAccess` model with all 16 permission fields
- ✅ Created database table with proper relationships
- ✅ Added `GetOrCreateOrganizationAccess()` and `UpdateOrganizationAccess()` repository methods
- ✅ Included in API request/response (always present, even if all false)
- ✅ Handles partial updates correctly (only updates provided fields)

2. **Add `organization_access`** ✅ **COMPLETE**
   - ✅ Create `TeamOrganizationAccess` model
   - ✅ Create database table
   - ✅ Add repository methods
   - ✅ Update API to handle organization_access in create/update
   - ✅ Include in team response (always computed)
   - ✅ Default all permissions to `false` if not provided

**Status**: All tasks completed (see Phase 1B status above)

### Phase 1C: Team-Scoped API Tokens (High Priority) ✅ COMPLETE

**Status**: ✅ Implemented
- ✅ Added `TeamID *uuid.UUID` field to `APIKey` model
- ✅ Updated API key scope parsing to support `team:<team_id>:<permission>` format
- ✅ Added validation in `CreateAPIKey` to ensure team exists and user is org member
- ✅ Updated `ScopeChecker` with `HasTeamPermission()` and `GetScopedTeams()` methods
- ✅ Team-scoped API keys can now be created via API

3. **Add Team Scope to API Keys** ✅ **COMPLETE**
   - ✅ Update scope parser to support `team:<team_id>:<permission>` format
   - ✅ Add `TeamID` field to `APIKey` model (nullable)
   - ✅ Add database column: `team_id UUID REFERENCES teams(id)`
   - ✅ Update API key creation handler to accept team scope
   - ✅ Update scope validation to check team membership
   - ✅ Update scope checker to validate team access
   - ✅ Update UI to show "Team" as a scope option
   - ✅ Respect `allow_member_token_management` when creating team tokens

**Status**: All tasks completed (see Phase 1C status above)

**TFE Compatibility**: TFE supports team tokens via `/api/v2/teams/:id/tokens` endpoint

### Phase 1D: SSO Team ID (Placeholder) ✅ COMPLETE

**Status**: ✅ Implemented (Placeholder)
- ✅ Added `SSOTeamID *string` field to `Team` model (nullable)
- ✅ Included in API request/response (always present, even if null)
- ✅ Database field created and indexed
- ⚠️ **Note**: Full SSO integration deferred to separate plan (see `docs/architecture/auth/teams/plans/SSO_OIDC_TEAM_INTEGRATION_PLAN.md`)

4. **Add `sso_team_id` (placeholder)** ✅ **COMPLETE**
   - ✅ Add nullable field to `Team` model
   - ✅ Add database column
   - ✅ Accept in API but don't process (store as-is)
   - ✅ Return in API response
   - ✅ Document as "not yet implemented" in API docs
   - ✅ **CRITICAL**: Team resource MUST accept this attribute (even if null)

**Status**: All tasks completed (see Phase 1D status above)

**Full SSO Integration**: See separate design plan: `docs/architecture/auth/teams/plans/SSO_OIDC_TEAM_INTEGRATION_PLAN.md` (placeholder implemented, full sync deferred)

---

## API Response Format

### Current Response (Missing Fields)

```json
{
  "data": {
    "id": "team-uuid",
    "type": "teams",
    "attributes": {
      "name": "test-team",
      "description": "",
      "visibility": "organization",
      "users-count": 0
    }
  }
}
```

### Required Response (TFE-Compatible)

```json
{
  "data": {
    "id": "team-uuid",
    "type": "teams",
    "attributes": {
      "name": "test-team",
      "description": "",
      "visibility": "organization",
      "users-count": 0,
      "allow-member-token-management": true,
      "organization-access": {
        "manage-policies": false,
        "manage-policy-overrides": false,
        "manage-workspaces": false,
        "manage-vcs-settings": false,
        "manage-providers": false,
        "manage-modules": false,
        "manage-run-tasks": false,
        "manage-projects": false,
        "read-workspaces": false,
        "read-projects": false,
        "manage-membership": false,
        "manage-teams": false,
        "manage-organization-access": false,
        "access-secret-teams": false,
        "manage-agent-pools": false
      },
      "sso-team-id": null
    }
  }
}
```

**CRITICAL**: The `sso-team-id` attribute **MUST** be present in all Team API responses, even if `null`. The `terraform-provider-tfe` expects this field and will fail if it's missing. See `docs/architecture/auth/teams/plans/SSO_OIDC_TEAM_INTEGRATION_PLAN.md` for full SSO integration details.

---

## References

- **TFE API Docs**: https://developer.hashicorp.com/terraform/cloud-docs/api-docs/teams
- **go-tfe Team Model**: `go-tfe/team.go:48-63`
- **terraform-provider-tfe**: `terraform-provider-tfe/internal/provider/resource_tfe_team.go`
- **TFE SSO Docs**: https://developer.hashicorp.com/terraform/cloud-docs/users-teams-organizations/single-sign-on#team-names-and-sso-team-ids

