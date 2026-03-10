<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Team-Based Organization Access (Org Visibility Fix)

**Last Updated**: 2026-01-28  
**Status**: Implemented

## Problem

Org visibility and tenant isolation were driven **only** by the `organization_members` table. If that table was empty or out of sync, users lost visibility of organizations even when they were in teams. Example: admin was in the "owners" team (`team_members`) but had no row in `organization_members` → orgs disappeared in the UI and 403s on access.

## Root cause: why was admin not in `organization_members`?

Most likely one of these:

1. **Migration / backfill that only touched teams**  
   When we moved to the team-based model, a migration or script may have created default teams ("owners", "viewers") and added the admin user to the owners team (`team_members`) for existing orgs, but **did not** insert corresponding rows into `organization_members`. So `organization_members` stayed empty while `team_members` was populated. We don’t have a committed `migrate-team-based-permissions.sql` in the repo anymore, but the refactor doc refers to one that “Adds admin@… to owners team for all organizations” — if that script only wrote to `teams` and `team_members`, it would explain the state you saw.

2. **Org creation flow**  
   For **new** orgs we do both: `AddMember(org.ID, user.ID)` and `AddMember(ownersTeam.ID, user.ID)` (see `organizations.go` Create). So the creator is in both `organization_members` and the owners team. That only applies to orgs created by the current code path; anything created or fixed by an older path or a team-only migration would not get `organization_members` backfilled.

3. **Manual or one-off DB changes**  
   Less likely, but `organization_members` could have been cleared or never populated by a manual change or a one-off script.

So: the bug wasn’t “we dropped the DB” — it was **two sources of “who is in the org”** (org membership vs team membership) that got out of sync because some path only updated teams.

## Solution (TFE-compatible)

We keep **both** concepts and treat “user is in org” as:

- **In `organization_members`** (e.g. created by [tfe_organization_membership](https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/organization_membership)), **or**
- **In at least one team in that org** (`team_members` → `teams` → org).

So:

1. **Organization list** (`ListByUser`): Orgs where the user is in `organization_members` **or** has at least one team in that org.  
   See `backend/internal/repository/organization.go` — `ListByUser()`.

2. **Tenant isolation** (`UserInOrg`): Same rule — true if user is in `organization_members` for that org **or** has at least one team in that org.  
   Used in RBAC and handlers (projects, team workspace access, API key scope).  
   See `OrganizationRepository.UserInOrg()` in `backend/internal/repository/organization.go`.

Result:

- **`tfe_organization_membership` still works**: Creating an org membership (our `POST /organizations/:name/organization-memberships`) adds a row to `organization_members`; that user is now “in org” and will see the org and pass tenant checks even before being added to any team (same idea as TFE).
- **Team-only users still work**: If someone is only in `team_members` (e.g. migration added them to “owners” but not to `organization_members`), they still see the org and pass tenant checks.

## Current RBAC in simple terms

1. **“Am I in this org?” (tenant isolation)**  
   Yes if **either** you have a row in `organization_members` for that org **or** you are in at least one team in that org (`UserInOrg`). No → 403, can’t see the org or its resources.

2. **“What can I do inside the org?” (permissions)**  
   Only from **teams**. We look at all teams you’re in for that org and take the **union** of their permissions (organization access, project access, workspace access). No org-level roles; it’s all team-based.  
   See `backend/internal/services/rbac/service.go` (e.g. `CheckResourcePermission`, `checkOrgPermission`, `CheckOrgManageMembership`, `CheckOrgManageTeams`).

3. **Organization memberships API**  
   `organization_members` and the TFE-style `organization-memberships` API are still used for:
   - Listing “who is in the org” (Users & Teams UI),
   - Creating/updating/deleting org memberships (e.g. `tfe_organization_membership`),
   - Adding users to teams by membership ID (TFE flow: invite to org → add that membership to teams).

So: **org membership** = “in the org” (visibility + tenant check). **Team membership** = what you’re allowed to do (and also counts as “in the org” if you have no org membership row). Both paths are supported and TFE-compatible.

## References

- Team-based permissions refactor: [TEAM_BASED_PERMISSIONS_REFACTOR.md](../../summaries/features/teams/TEAM_BASED_PERMISSIONS_REFACTOR.md)
- RBAC state: [AUTH_RBAC_STATE.md](./AUTH_RBAC_STATE.md)
- TFE organization memberships API: [Organization memberships API reference](https://developer.hashicorp.com/terraform/cloud-docs/api-docs/organization-memberships)
- Implementation: `backend/internal/repository/organization.go` (`ListByUser`, `UserInOrg`), `backend/internal/services/rbac/service.go`, handlers (projects, team_workspace_access, apikey).
