<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# tfe_organization_membership

**TFE Registry**: https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/organization_membership

**Status**: Implemented (email-based create; some caveats)

Adds a user to an organization by **email**. The user may not exist yet; TFE (and StackWeaver) can create placeholder users for invited members.

## Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `organization` | string (Required) | org from path | Implemented | |
| `email` | string (Required) | `attributes.email` | Implemented | User lookup/create by email |
| `role` | string (Optional) | - | Deprecated | TFE deprecates org-level roles; we use team-based permissions |

## Computed / Attributes Reference

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `id` | string | `id` (UUID) | Implemented | Organization membership ID |
| `user_id` | string | via `user` relationship | Implemented | User ID |
| `status` | string | `active` | Implemented | |

## API Endpoints

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `GET /api/v2/organizations/:name/organization-memberships` | GET | Implemented | List |
| `POST /api/v2/organizations/:name/organization-memberships` | POST | Implemented | Create (email in body) |
| `GET /api/v2/organization-memberships/:id` | GET | Implemented | Read |
| `PATCH /api/v2/organization-memberships/:id` | PATCH | Implemented | Update (role updates no-op; we use teams) |
| `DELETE /api/v2/organization-memberships/:id` | DELETE | Implemented | Delete |

## Example TFE Usage

```hcl
resource "tfe_organization_membership" "dev" {
  organization = "my-org"
  email        = "developer@example.com"
}
```

## StackWeaver Implementation

**Model**: `backend/internal/models/organization_member.go`
**Handler**: `backend/internal/api/v2/handlers/organization_memberships.go`
**Repository**: `backend/internal/repository/organization.go` (ListMembers, AddMember, etc.)

**Create flow**: Look up user by email (exact, then case-insensitive). If not found, create placeholder user, then add org membership. Duplicate email in org → 409.

## Caveats

1. **Email lookup**: Case-insensitive fallback and placeholder user creation. See [tfe-provider-compatibiltiy-checklist](../../testing/tfe-provider-compatibiltiy-checklist.md) note on email lookup.
2. **Role**: `role` is deprecated in TFE; we use team memberships for permissions. PATCH role updates are no-op.
3. **Teams**: Creating an org membership does not add the user to any team. Use `tfe_team_organization_member` or `tfe_team_organization_members` to add them to teams.

## References

- [Team-Based Org Access Fix](../../status/auth/TEAM_BASED_ORG_ACCESS_FIX.md)
- [User Creation Flow Sitrep](../../status/auth/USER_CREATION_FLOW_SITREP.md)
- [TFE Organization memberships API](https://developer.hashicorp.com/terraform/cloud-docs/api-docs/organization-memberships)
