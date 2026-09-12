---
description: "Moving Terraform Cloud or Terraform Enterprise workspaces onto Stackweaver: pointing the CLI at a Stackweaver host, token equivalence, migrating state, and an evidence-backed table of which terraform-provider-tfe resources have been verified to work."
covers:
  - "scripts/tfe-compat/**"
  - "backend/internal/services/apikey/**"
  - "backend/internal/services/auth/**"
---

# Migrating from Terraform Cloud or Enterprise

Stackweaver speaks the Terraform Enterprise API, so most of a migration is repointing the CLI rather than rewriting configuration. This guide covers what changes, what does not, and how to tell in advance whether the resources you use are supported.

The short version: your `terraform` or `tofu` binary, your modules and your state all stay as they are. What changes is the hostname you talk to and the token you talk to it with.

## Pointing the CLI at Stackweaver

Terraform discovers a backend's capabilities from a well-known document, and Stackweaver serves the same one Terraform Enterprise does. You can see exactly what your host advertises:

```
curl https://your-stackweaver-host/.well-known/terraform.json
```

Change the hostname in your `cloud` block and nothing else:

```hcl
terraform {
  cloud {
    hostname     = "your-stackweaver-host"
    organization = "your-org"

    workspaces {
      name = "production"
    }
  }
}
```

The same applies to a `remote` backend block, and to the `hashicorp/tfe` provider, which reads `TFE_HOSTNAME` and `TFE_TOKEN` natively.

## Tokens

`terraform login your-stackweaver-host` works the way it does against Terraform Cloud, and stores its credential in the same place.

Stackweaver API tokens and Terraform Cloud tokens are the same kind of credential on the wire: Stackweaver mints its keys with a `tfe-` prefix, and the API treats that prefix as authoritative for programmatic access. A token you create in Stackweaver's UI can be pasted into `~/.terraform.d/credentials.tfrc.json`, exported as `TFE_TOKEN`, or used with `curl` against the API, without conversion.

One difference worth planning for: **Stackweaver API tokens are organization-scoped**. A Terraform Cloud user token spans every organization you belong to, whereas a Stackweaver token is bound to one. If your automation touches several organizations, it needs one token per organization rather than one token overall.

## Migrating state

State lives in Stackweaver's own object storage, and there is no special import path - the ordinary Terraform state commands do the work.

For each workspace, point the `cloud` block at Stackweaver, then run `terraform init` and let Terraform migrate the state when it offers to. Take a `terraform state pull` from the old backend first: it costs nothing and it is the only copy you control if something goes wrong mid-migration.

Run `terraform plan` before `terraform apply` on the other side. A clean plan is the signal that the state arrived intact; a plan proposing to recreate resources is the signal to stop and look at why.

## What to expect at cutover

- **Runs and their history do not migrate.** Workspaces arrive with their state and their variables, not with their past runs. Keep the old organization readable for as long as you need the audit trail.
- **VCS connections are re-established, not moved.** Stackweaver's VCS integration is its own OAuth app, so repositories are reconnected once per organization.
- **Variable sets and workspace variables carry over as configuration**, but sensitive values do not: Stackweaver cannot read them from Terraform Cloud, and neither can you. Plan to re-enter every sensitive variable.
- **The API is JSON:API**, as Terraform Enterprise's is, so tooling written against `go-tfe` works unmodified. Stackweaver also publishes a full [OpenAPI description](/docs/api-reference) of every endpoint it serves, which you can read in the browser or generate a client from.

## Which resources are verified

The table below is **generated from a test harness**, not written by hand. The harness drives the stock `hashicorp/tfe` provider against a running Stackweaver and asserts a full lifecycle for each resource: apply, confirm no drift, destroy, then confirm the resource is really gone.

Read the states precisely, because they say different things:

- **verified** - the lifecycle passed. This resource works.
- **did not pass** - a fixture exists and the run did not complete. That may mean Stackweaver does not implement the resource, or that the fixture itself is wrong. The table does not guess which.
- **untested** - no fixture exercises this resource. It may work perfectly; nothing here demonstrates that either way.

Deliberately absent is any row claiming a resource is *unsupported*. That is a judgment, and this table only reports evidence. For attribute-level detail and the honest supported/divergent/unsupported assessment, see the per-resource compatibility docs in the repository under `docs/internal/tfe-compatibility/`.

<!-- BEGIN GENERATED: tfe-compat-table -->

Verified by driving the stock `hashicorp/tfe` provider against a running Stackweaver: **58 verified**, 5 did not pass, 0 untested, 63 fixtures total.

Evidence from a run on **2026-09-12T07:05:09Z** using hashicorp/tfe ~> 0.77. A row says what that run showed; it does not say whether Stackweaver implements the resource. See the per-resource docs for that judgment.

| Resource | State | Detail |
|---|---|---|
| `tfe_agent_pool` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_agent_pool_allowed_projects` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_agent_pool_allowed_workspaces` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_agent_pool_excluded_workspaces` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_agent_token` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_audit_trail_token` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_aws_oidc_configuration` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_azure_oidc_configuration` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_data_agent_pool` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_data_current_user` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_data_organization` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_data_organization_members` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_data_organization_membership` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_data_organization_run_task` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_data_organization_run_task_global_settings` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_data_organizations` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_data_project` | ❌ did not pass | terraform apply failed |
| `tfe_data_projects` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_data_registry_gpg_key` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_data_registry_gpg_keys` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_data_registry_provider` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_data_registry_providers` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_data_team` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_data_team_access` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_data_team_project_access` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_data_teams` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_data_variable_set` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_data_workspace` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_data_workspace_ids` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_data_workspace_ids_tags` | ❌ did not pass | terraform apply failed |
| `tfe_data_workspace_run_task` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_data_workspace_tags` | ❌ did not pass | terraform apply failed |
| `tfe_gcp_oidc_configuration` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_notification_configuration` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_organization` | ❌ did not pass | terraform apply failed |
| `tfe_organization_default_settings` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_organization_membership` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_organization_run_task` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_organization_run_task_global_settings` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_organization_token` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_project` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_project_notification_configuration` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_project_settings` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_project_variable_set` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_registry_gpg_key` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_registry_provider` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_run_trigger` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_team` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_team_access` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_team_members` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_team_notification_configuration` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_team_organization_member` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_team_organization_members` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_team_project_access` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_team_token` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_terraform_version` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_variable` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_variable_set` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_vault_oidc_configuration` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_workspace` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_workspace_run` | ❌ did not pass | terraform apply failed |
| `tfe_workspace_run_task` | ✅ verified | lifecycle passed against a running Stackweaver |
| `tfe_workspace_settings` | ✅ verified | lifecycle passed against a running Stackweaver |

<!-- END GENERATED: tfe-compat-table -->

## Getting help

If a resource you depend on is untested or did not pass, that is worth raising - the compatibility surface is actively worked on, and a resource with a real user behind it is prioritised differently from one without.
