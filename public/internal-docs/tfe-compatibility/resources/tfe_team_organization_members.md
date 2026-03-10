<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# tfe_team_organization_members

**TFE Registry**: https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/team_organization_members

**Status**: Implemented

Adds **multiple** organization memberships to a team in one resource. Same API as `tfe_team_organization_member`, but the provider manages a list of `organization_membership_id`s and creates/updates/deletes the relationship so the team has exactly that set of members.

## Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `team_id` | string (Required) | from path | Implemented | |
| `organization_membership_ids` | set of string (Required) | `data[].id` | Implemented | Org membership UUIDs |

## Behavior

- **Create**: Add all given memberships to the team.
- **Update**: Diff current vs desired; add new memberships, remove ones no longer in the set.
- **Destroy**: Remove all managed memberships from the team.

## API Endpoints

Same as [tfe_team_organization_member](./tfe_team_organization_member.md):

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `GET /api/v2/teams/:id/relationships/organization-memberships` | GET | Implemented | List |
| `POST /api/v2/teams/:id/relationships/organization-memberships` | POST | Implemented | Add (multiple `data` entries) |
| `DELETE /api/v2/teams/:id/relationships/organization-memberships` | DELETE | Implemented | Remove (multiple `data` entries) |

## Example TFE Usage

```hcl
resource "tfe_team_organization_members" "dev_all" {
  team_id                    = tfe_team.developers.id
  organization_membership_ids = [
    tfe_organization_membership.alice.id,
    tfe_organization_membership.bob.id,
  ]
}
```

## StackWeaver Implementation

Same as `tfe_team_organization_member`: **Handler** `team_members.go`, **Repository** `team.go`. The provider splits `organization_membership_ids` into multiple POST/DELETE `data` entries.

## References

- [tfe_team_organization_member](./tfe_team_organization_member.md)
- [TFE Endpoint Compatibility Sitrep](../../status/TFE_ENDPOINT_COMPATIBILITY_SITREP.md)
