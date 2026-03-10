<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# SSO/OIDC Team Integration Design Plan

## Executive Summary

This document outlines the design plan for integrating SSO/OIDC team membership with StackWeaver teams. This enables automatic team membership assignment based on OIDC/SAML group claims from identity providers like Zitadel.

**CRITICAL**: The `Team` resource in StackWeaver **MUST** support the `sso_team_id` attribute as required by the Terraform Enterprise API specification. This attribute is expected by `terraform-provider-tfe` and must be present in API responses (even if `null`).

### Companion Document

This plan covers the **downstream team sync** (mapping SSO claims to team membership within StackWeaver). For the **upstream federation** (configuring Zitadel to accept external IdPs like Azure AD, Okta, and AWS Cognito), see:

**[Third-Party OIDC Federation Plan](../oidc-federation/THIRD_PARTY_OIDC_FEDERATION_PLAN.md)**

The federation plan's Phase B (group claim passthrough via Zitadel Actions) implements the claim extraction described in Phase 2 of this document, and Phase C (automatic team assignment) implements Phase 3 of this document.

---

## Current State

### What Exists

✅ **Zitadel OIDC Integration**
- OIDC authentication via Authorization Code Flow with PKCE
- JWT access tokens
- User auto-creation on first login
- Identity mapping: Zitadel `subject` → StackWeaver `User.ID`

✅ **Team Model**
- Basic team structure with `name`, `visibility`, `description`
- Team members (many-to-many with users)
- Organization-scoped teams

✅ **SSO Team ID Placeholder** (Phase 1 Complete)
- `sso_team_id` field on Team model (nullable string, unique)
- Accepted in create/update API requests
- Returned in API responses (satisfies TFE API requirement)

❌ **Missing**
- Third-party IdP federation in Zitadel (see [OIDC Federation Plan](../oidc-federation/THIRD_PARTY_OIDC_FEDERATION_PLAN.md))
- OIDC group/team claim mapping
- Automatic team membership sync
- SAML support (currently only OIDC)

---

## TFE API Requirement

### Team Resource Attributes

The Terraform Enterprise API requires teams to support:

```json
{
  "data": {
    "type": "teams",
    "attributes": {
      "name": "example-team",
      "sso-team-id": "7dddb675-73e0-4858-a8ad-0e597064301b",  // REQUIRED attribute
      "visibility": "organization",
      "allow-member-token-management": true,
      "organization-access": { ... }
    }
  }
}
```

**Key Points**:
- `sso-team-id` is an **optional but expected** attribute
- Must be present in API responses (can be `null`)
- Used to map OIDC/SAML groups to teams
- Enables automatic team membership assignment

---

## Design Goals

1. **TFE Compatibility**: Support `sso_team_id` attribute in Team API (required by terraform-provider-tfe)
2. **OIDC Integration**: Map OIDC group claims to team membership
3. **Automatic Sync**: Automatically add/remove users from teams based on OIDC claims
4. **Zitadel Integration**: Leverage Zitadel's group/team management
5. **Backward Compatible**: Teams without SSO team ID continue to work normally
6. **Future SAML Support**: Design should accommodate SAML SSO later

---

## Architecture Overview

```
┌─────────────────┐
│   Zitadel       │
│  (OIDC Provider)│
│                 │
│  - Groups       │
│  - Team Claims  │
└────────┬────────┘
         │
         │ OIDC Token
         │ (with group claims)
         │
         ▼
┌─────────────────┐
│  StackWeaver    │
│  Auth Service   │
│                 │
│  1. Extract     │
│     group claims│
│  2. Map to      │
│     sso_team_id │
│  3. Sync team    │
│     membership   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Team Model     │
│                 │
│  sso_team_id    │
│  (UUID/String)  │
└─────────────────┘
```

---

## Database Schema

### Teams Table Update

```sql
-- Add SSO team ID column to existing teams table
ALTER TABLE teams 
ADD COLUMN sso_team_id VARCHAR(255) NULL UNIQUE;

CREATE INDEX idx_teams_sso_team_id ON teams(sso_team_id);
```

**Notes**:
- `sso_team_id` is nullable (teams can exist without SSO)
- Unique constraint prevents duplicate SSO team IDs
- Can be UUID (from Zitadel) or custom string identifier

---

## OIDC Group Claim Mapping

### Standard OIDC Claims

OIDC tokens typically include group information in:

1. **`groups` claim** (array of strings)
   ```json
   {
     "groups": ["developers", "admins", "team-alpha"]
   }
   ```

2. **`team_ids` claim** (array of UUIDs/strings)
   ```json
   {
     "team_ids": ["7dddb675-73e0-4858-a8ad-0e597064301b"]
   }
   ```

3. **Custom claim** (Zitadel-specific)
   ```json
   {
     "https://zitadel.example.com/claims/teams": ["team-uuid-1", "team-uuid-2"]
   }
   ```

### Zitadel Configuration

Zitadel supports:
- **Groups**: Can be assigned to users
- **Custom Claims**: Can include group/team IDs in tokens
- **Project Roles**: Can map to teams

**Recommended Approach**: Use Zitadel groups with custom claim mapping

---

## Implementation Phases

### Phase 1: Placeholder Support (Immediate)

**Goal**: Support `sso_team_id` attribute in API without processing

**Tasks**:
- [x] Add `sso_team_id` field to `Team` model (nullable string)
- [x] Add database column
- [x] Accept in create/update API requests
- [x] Return in API responses
- [x] Store as-is (no validation/processing yet)

**Status**: ✅ **PHASE 1 COMPLETE** - Placeholder field implemented (accepts/store/returns `sso_team_id`)

**Note**: Full SSO integration (OIDC claim extraction, team sync) is deferred to future phases. The field is implemented as a placeholder to satisfy TFE API requirements.

**Time**: 15 minutes (placeholder only)

---

### Phase 2: OIDC Claim Extraction

**Goal**: Extract group/team claims from OIDC tokens

**Status**: ✅ **PHASE 2 COMPLETE** — `ExtractUserInfo()` reads `sso_groups` from JWT, stores in gin context, `UserInfo.Groups` field implemented.

**Prerequisite**: Third-party IdP federation must be configured in Zitadel (see [OIDC Federation Plan - Phase A](../oidc-federation/THIRD_PARTY_OIDC_FEDERATION_PLAN.md#phase-a-enable-external-idp-authentication)) and Zitadel Actions must be in place to forward group claims (see [OIDC Federation Plan - Phase B](../oidc-federation/THIRD_PARTY_OIDC_FEDERATION_PLAN.md#phase-b-group-claim-passthrough-via-zitadel-actions)).

**How it works**: External IdP group claims (e.g., Azure AD `groups`) are captured by Zitadel Actions V2 webhooks during external authentication, stored as user metadata, and included as `sso_groups` custom claim in the Zitadel JWT. StackWeaver extracts this normalized `sso_groups` claim from the JWT.

**Tasks**:
- [x] Update auth service to extract `sso_groups` claim from JWT (set by Zitadel Actions V2)
- [x] Add `Groups []string` field to `UserInfo` struct
- [x] Store extracted claims in gin context for downstream use
- [x] Log claim extraction for debugging

**Files Modified**:
- `backend/internal/services/auth/zitadel.go` (extract `sso_groups` in `ExtractUserInfo()`)
- `backend/internal/services/auth/service.go` (store in gin context)

---

### Phase 3: Team Membership Sync

**Goal**: Automatically sync team membership based on OIDC claims

**Status**: ✅ **PHASE 3 COMPLETE** — `TeamSyncService` implemented, wired into auth middleware, auto-provisions org membership, configurable removal.

**Tasks**:
- [x] Create `TeamSyncService` for managing team membership sync
- [x] On user login:
  1. Extract `sso_groups` from gin context (set by Phase 2)
  2. Find teams where `sso_team_id` matches any group in `sso_groups`
  3. Add user to matching teams (auto-create org membership if needed)
  4. Remove user from SSO-managed teams not in claims (optional, configurable via `OIDC_REMOVE_FROM_NON_SSO_TEAMS`)
- [x] Handle edge cases:
  - User already in team
  - Team doesn't exist for a given group ID
  - Auto-create organization membership when adding to SSO-mapped team
- [x] Add sync logging/audit trail
- [x] Never modify manually-managed teams (teams without `sso_team_id`)

**Files Created**:
- `backend/internal/services/team_sync/service.go`

**Files Modified**:
- `backend/internal/services/auth/service.go` (call sync on login)
- `backend/internal/repository/team.go` (add `FindBySSOTeamIDs()` query)
- `backend/cmd/api/main.go` (wire up service)

---

### Phase 4: Zitadel Group Integration

**Goal**: Integrate with Zitadel's group management

**Tasks**:
- [ ] Research Zitadel API for group management
- [ ] Create Zitadel client for group operations
- [ ] Map Zitadel groups to StackWeaver teams
- [ ] Support bidirectional sync (optional):
  - Zitadel group → StackWeaver team
  - StackWeaver team → Zitadel group
- [ ] UI for managing Zitadel group mappings

**Files to Create**:
- `backend/internal/services/zitadel/client.go`
- `backend/internal/services/zitadel/groups.go`

**Time**: 8-12 hours

---

### Phase 5: SAML Support (Future)

**Goal**: Support SAML SSO team membership (beyond OIDC)

**Tasks**:
- [ ] Add SAML authentication support
- [ ] Extract team IDs from SAML assertions
- [ ] Map SAML attributes to `sso_team_id`
- [ ] Support SAML-specific team membership rules

**Time**: 16-24 hours (separate project)

---

## API Changes

### Team Create/Update Request

**Current** (Phase 1):
```json
{
  "data": {
    "type": "teams",
    "attributes": {
      "name": "example-team",
      "visibility": "organization",
      "sso-team-id": null  // Accepted but not processed
    }
  }
}
```

**Future** (Phase 3+):
```json
{
  "data": {
    "type": "teams",
    "attributes": {
      "name": "example-team",
      "visibility": "organization",
      "sso-team-id": "7dddb675-73e0-4858-a8ad-0e597064301b"  // Processed for sync
    }
  }
}
```

### Team Response

Always includes `sso-team-id` (even if `null`):
```json
{
  "data": {
    "id": "team-uuid",
    "type": "teams",
    "attributes": {
      "name": "example-team",
      "sso-team-id": "7dddb675-73e0-4858-a8ad-0e597064301b",
      "visibility": "organization",
      "users-count": 5
    }
  }
}
```

---

## Team Sync Service Design

### Service Interface

```go
type TeamSyncService interface {
    // SyncUserTeams syncs a user's team membership based on OIDC claims
    SyncUserTeams(ctx context.Context, userID uuid.UUID, groupClaims []string) error
    
    // FindTeamsBySSOID finds teams matching SSO team IDs
    FindTeamsBySSOID(ctx context.Context, ssoTeamIDs []string) ([]*models.Team, error)
    
    // AddUserToSSOTeams adds user to teams based on SSO team IDs
    AddUserToSSOTeams(ctx context.Context, userID uuid.UUID, ssoTeamIDs []string) error
    
    // RemoveUserFromNonSSOTeams removes user from teams not in SSO claims (optional)
    RemoveUserFromNonSSOTeams(ctx context.Context, userID uuid.UUID, ssoTeamIDs []string) error
}
```

### Sync Logic

```go
func (s *TeamSyncService) SyncUserTeams(ctx context.Context, userID uuid.UUID, groupClaims []string) error {
    // 1. Find teams with matching sso_team_id
    teams, err := s.FindTeamsBySSOID(ctx, groupClaims)
    if err != nil {
        return err
    }
    
    // 2. Get user's current team memberships
    currentTeams, err := s.teamRepo.GetTeamsByUserID(userID)
    if err != nil {
        return err
    }
    
    // 3. Add user to SSO teams (if not already member)
    for _, team := range teams {
        if !s.isUserInTeam(currentTeams, team.ID) {
            err := s.teamRepo.AddMember(team.ID, userID)
            if err != nil {
                log.Printf("Failed to add user %s to team %s: %v", userID, team.ID, err)
                // Continue with other teams
            }
        }
    }
    
    // 4. Optionally remove from teams not in SSO claims
    if s.config.RemoveFromNonSSOTeams {
        err := s.RemoveUserFromNonSSOTeams(ctx, userID, groupClaims)
        if err != nil {
            log.Printf("Failed to remove user from non-SSO teams: %v", err)
        }
    }
    
    return nil
}
```

---

## Configuration

### Environment Variables

```bash
# Enable OIDC team sync (default: false -- opt-in)
ENABLE_OIDC_TEAM_SYNC=false

# Remove users from SSO-managed teams not in current claims (default: false)
# Only affects teams with sso_team_id set; never removes from manually-managed teams
OIDC_REMOVE_FROM_NON_SSO_TEAMS=false

# External IdP configuration (see OIDC Federation Plan for full list)
# Azure AD: AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_TENANT_ID
# Generic OIDC: OIDC_IDP_NAME, OIDC_IDP_ISSUER, OIDC_IDP_CLIENT_ID, OIDC_IDP_CLIENT_SECRET
```

**Note:** The `OIDC_GROUP_CLAIMS` variable is no longer needed. Zitadel Actions (configured in the [OIDC Federation Plan](../oidc-federation/THIRD_PARTY_OIDC_FEDERATION_PLAN.md)) normalize all provider-specific group claim names (Azure AD `groups`, Cognito `cognito:groups`, etc.) into a single `sso_groups` custom claim in the Zitadel JWT.

---

## Security Considerations

1. **SSO Team ID Validation**
   - Validate format (UUID or allowed string pattern)
   - Prevent injection attacks
   - Rate limit team sync operations

2. **Team Membership Permissions**
   - Only admins can set `sso_team_id` on teams
   - Users cannot manually join SSO-managed teams (if configured)
   - Audit all team membership changes

3. **Token Validation**
   - Verify OIDC token signature
   - Check token expiration
   - Validate issuer (Zitadel)

4. **Sync Conflicts**
   - Handle manual team membership vs SSO sync
   - Configurable conflict resolution strategy
   - Log all sync operations

---

## Testing Strategy

### Unit Tests

- [ ] OIDC claim extraction
- [ ] Team lookup by SSO ID
- [ ] Team membership sync logic
- [ ] Edge cases (duplicate IDs, missing teams, etc.)

### Integration Tests

- [ ] End-to-end OIDC login with team sync
- [ ] Zitadel group mapping
- [ ] Team membership changes on re-login

### Manual Testing

- [ ] Create team with `sso_team_id`
- [ ] Login with OIDC token containing matching group claim
- [ ] Verify automatic team membership
- [ ] Test with terraform-provider-tfe

---

## Migration Path

### Step 1: Add Placeholder Support (Phase 1)
- ✅ Already completed
- Teams can have `sso_team_id` set to `null`

### Step 2: Enable OIDC Claim Extraction (Phase 2)
- Deploy with `ENABLE_OIDC_TEAM_SYNC=false` initially
- Test claim extraction in staging
- Enable sync gradually

### Step 3: Enable Team Sync (Phase 3)
- Start with read-only sync (add only, don't remove)
- Monitor logs for issues
- Enable removal after validation

### Step 4: Zitadel Integration (Phase 4)
- Configure Zitadel groups
- Map groups to teams
- Test bidirectional sync (if implemented)

---

## References

- **TFE API Docs**: https://developer.hashicorp.com/terraform/cloud-docs/api-docs/teams
- **TFE SSO Docs**: https://developer.hashicorp.com/terraform/cloud-docs/users-teams-organizations/single-sign-on#team-names-and-sso-team-ids
- **OIDC Claims**: https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims
- **Zitadel Docs**: https://zitadel.com/docs
- **go-tfe Team Model**: `go-tfe/team.go:56` - `SSOTeamID string`

---

## Critical Notes

### ⚠️ Terraform Provider Requirement

**The `sso_team_id` attribute MUST be present in Team API responses**, even if it's `null`. The `terraform-provider-tfe` expects this field and will fail if it's missing.

**Current Implementation Status**:
- ✅ Field exists in Team model (nullable)
- ✅ Field accepted in create/update requests
- ✅ Field returned in API responses
- ❌ Not yet processed for team sync (Phase 2+)

**Action Required**: Ensure all Team API endpoints return `sso-team-id` in the attributes object, even if `null`.

---

## Next Steps

1. **Immediate**: Verify `sso_team_id` is returned in all Team API responses
2. **Upstream prerequisite**: Implement third-party IdP federation in Zitadel (see [OIDC Federation Plan - Phase A](../oidc-federation/THIRD_PARTY_OIDC_FEDERATION_PLAN.md))
3. **Upstream prerequisite**: Configure Zitadel Actions for group claim passthrough (see [OIDC Federation Plan - Phase B](../oidc-federation/THIRD_PARTY_OIDC_FEDERATION_PLAN.md))
4. **Phase 2**: Implement OIDC claim extraction in StackWeaver auth middleware
5. **Phase 3**: Implement team membership sync
6. **Phase 4**: Integrate with Zitadel groups (bidirectional sync)
7. **Future**: Add SAML support

