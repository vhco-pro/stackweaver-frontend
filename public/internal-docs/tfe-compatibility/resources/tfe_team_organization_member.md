<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# tfe_team_organization_member

**TFE Registry**: https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/team_organization_member

**Status**: Implemented

Adds a **single** organization membership to a team. Uses `organization_membership_id` (not user ID). TFE exposes this via `POST /api/v2/teams/:id/relationships/organization-memberships` with one membership in the payload.

## Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `team_id` | string (Required) | from path | Implemented | |
| `organization_membership_id` | string (Required) | `data[].id` | Implemented | Org membership UUID |

## API Endpoints

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `GET /api/v2/teams/:id/relationships/organization-memberships` | GET | Implemented | List memberships for team |
| `POST /api/v2/teams/:id/relationships/organization-memberships` | POST | Implemented | Add one or more memberships |
| `DELETE /api/v2/teams/:id/relationships/organization-memberships` | DELETE | Implemented | Remove memberships (body: `data: [{ type, id }]`) |

The provider resource `tfe_team_organization_member` adds a single member; it maps to one `data` entry in the POST above.

## Example TFE Usage

```hcl
resource "tfe_team_organization_member" "dev" {
  team_id                   = tfe_team.developers.id
  organization_membership_id = tfe_organization_membership.dev.id
}
```

## StackWeaver Implementation

**Model**: `backend/internal/models/team_member.go` (team–user link). Team members are stored by user ID; we resolve `organization_membership_id` → user, then add `TeamMember`.

**Handler**: `backend/internal/api/v2/handlers/team_members.go`
- `AddOrganizationMemberships`: POST, accepts `data: [{ type: "organization-memberships", id }]`
- `RemoveOrganizationMemberships`: DELETE, same shape

**Repository**: `backend/internal/repository/team.go` (AddMember, RemoveMember, etc.)

## Notes

- We use **organization-membership IDs** only. TFE also supports `relationships/users` (user ID); we do not implement that.
- Adding a membership adds the underlying user to the team. Removing a membership removes that user from the team.

## References

- [TFE Endpoint Compatibility Sitrep](../../status/TFE_ENDPOINT_COMPATIBILITY_SITREP.md) — organization-memberships vs users
- [Team-Based Org Access Fix](../../status/auth/TEAM_BASED_ORG_ACCESS_FIX.md)
