---
description: "Guide to organization-level settings and policies: admin contact, token access, force-delete policy, health assessments, and pull request status behavior"
covers:
  - "frontend/src/pages/Settings/Organization.tsx"
  - "backend/internal/api/v2/handlers/organizations*"
  - "backend/internal/api/middleware/org_wall*"
  - "core/models/organization*"
---

# Organization Settings

Every organization carries a set of organization-wide settings and policies that its workspaces and members inherit. You manage them in the UI under **Settings → Organization**, and every setting is equally available as code through the `tfe_organization` resource of the Terraform provider, using the same attribute names Terraform Cloud and Enterprise use. This guide explains what each setting does at run time.

## General

The admin email is the organization's contact address, stored for TFE compatibility and returned by the API. The collaborator authentication policy can be set to `password` or `two_factor_mandatory`; the value is stored and round-trips through the provider, but enforcement of mandatory two-factor authentication is not wired up yet - it arrives together with the identity provider's MFA integration. Session timeout settings that exist in Terraform Enterprise have no equivalent here because sessions are owned by the identity provider (Zitadel); if you migrate a configuration that sets `session_timeout_minutes` or `session_remember_minutes`, remove those attributes or the plan will show permanent drift.

## Creating organizations

Creating an organization requires a user token - a personal API token or a `terraform login` session. Organization tokens are deliberately rejected on the create endpoint, matching the Terraform Cloud model where an automation token scoped to one organization cannot mint new organizations for its owner. The user who creates an organization is automatically added to it as a member and placed in its `owners` team, and the organization is bootstrapped with `owners` and `viewers` teams and a `default` project.

Note that organization names are permanently reserved once used. Deleting an organization does not free its name, because workload-identity token subjects embed the organization name and a re-registered name could otherwise be trusted by the original tenant's cloud federation. Terraform Enterprise would allow the reuse; here a create with a previously-used name returns a 422, so pick a new name.

## Token access

The **Allow user tokens** policy (`user_tokens_enabled`, default on) controls whether personal, user-bound API tokens may access the organization's API at all. When you switch it off, non-owner members' personal tokens and their `terraform login` sessions receive a 403 against every route of this organization, and automation should authenticate with the organization token instead (minted under **Settings → Organization Token**). Organization owners' user tokens keep working even when the policy is off - a deliberate divergence from Terraform Enterprise that prevents an organization from locking itself out before it has minted an organization token. Browser sessions are never affected by this policy.

## Workspace policies

**Allow force-deleting workspaces** (`allow_force_delete_workspaces`, default off) governs who may delete a workspace that still has resources under management. With the policy off, a force deletion of such a workspace requires organization-owner permissions; workspace admins can still delete workspaces whose infrastructure has been destroyed. Switching the policy on restores the more permissive behavior where workspace admins may force-delete regardless of remaining resources.

**Enforce health assessments** (`assessments_enforced`, default off) pulls every eligible workspace of the organization into drift detection, regardless of each workspace's own assessment or drift settings. Workspaces without a drift schedule of their own are checked on a default daily cadence; workspaces that already carry an explicit drift detection schedule keep it. A workspace-level opt-out is ignored while the organization enforces assessments - that is what enforcement means.

**Cost estimation** (`cost_estimation_enabled`, default on) is stored and round-trips through the provider; the estimation engine itself is under development and tracked separately, so the flag has no run-time effect yet.

## Pull request behavior

**Speculative plan management** (`speculative_plan_management_enabled`, default on) keeps pull requests tidy: when a newer commit is pushed to a branch or pull request, still-pending speculative plans from the outdated commits of that same branch are cancelled automatically. Plans belonging to other open pull requests on the same workspace are never touched, and neither are plan-and-apply runs.

**Aggregated status checks** (`aggregated_commit_status_enabled`, default off) is for monorepos where one pull request fans out into many workspace plans. Instead of one commit status per workspace, the organization posts a single rolled-up `terraform-plan` status per commit whose state is the worst of all the commit's workspace plans, with a passed-of-total summary in the description.

**Passing statuses for untriggered plans** (`send_passing_statuses_for_untriggered_speculative_plans`, default off) helps when required status checks are configured on a repository connected to several workspaces with path filtering. Workspaces that a pull request does not trigger - because none of the changed files fall inside their working directory or trigger paths - post an immediate passing status, so a required check never blocks a pull request that simply does not concern that workspace.

The last two settings are mutually exclusive: enabling one turns the other off, and the API rejects a request that would enable both.

## Managing these settings as code

All of the above maps onto the `tfe_organization` resource, so a migrated Terraform Cloud configuration keeps working - see [Managing StackWeaver with Terraform](./terraform-provider.md) for provider setup and the migration path. Attributes with no backing subsystem (`enforce_hyok`, `stacks_enabled`, `max_ttl_enabled`, `owners_team_saml_role_id`, and the session settings) are returned as stable defaults and should stay unset in your configuration.
