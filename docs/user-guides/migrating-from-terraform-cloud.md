---
description: "Moving Terraform Cloud or Terraform Enterprise workspaces onto Stackweaver: pointing the CLI at a Stackweaver host, token equivalence, migrating state, and an evidence-backed table of which terraform-provider-tfe resources have been verified to work."
covers:
  - "scripts/tfe-compat/**"
  - "backend/internal/services/apikey/**"
  - "backend/internal/services/auth/**"
---

# Migrate from Terraform Cloud or Enterprise

Move a workspace's configuration, inputs and state to a Stackweaver host, then review a plan before allowing changes. TFE API compatibility helps reuse tooling, but changing a hostname alone does not copy workspaces, credentials or state.

## Plan the cutover

| Move or recreate | Keep separately |
|---|---|
| Create the destination organization, project and workspace. | Keep the old workspace readable for its run and audit history. |
| Reconnect VCS and recreate variables, variable sets and other settings. | Sensitive source values cannot be read back for export. Recover them from their original secret source. |
| Transfer state using a method supported by your CLI/backend combination. | Keep a protected state backup and record which backend is authoritative. |
| Recreate API credentials on Stackweaver. | Source-platform tokens do not become Stackweaver tokens. |

Use [the provider guide](./terraform-provider.md) for destination resource configuration and the evidence table below to assess your TFE resources. A state transfer does not transfer variables or VCS settings.

## Connect your CLI

Replace the host and organization below with your installation. Discovery is available at:

```bash
curl --fail-with-body --silent --show-error \
  https://your-stackweaver-host/.well-known/terraform.json
```

For a destination workspace, the `cloud` block in your root configuration is:

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

This selects a backend; it does not perform the transfer. A `remote` backend also accepts the Stackweaver hostname. The `hashicorp/tfe` provider uses `TFE_HOSTNAME` and `TFE_TOKEN`; configure it separately from backend login.

```bash
terraform login your-stackweaver-host
```

Use a Stackweaver `tfe-` API credential authorized for the destination organization:

- A **personal user token**, created under **Settings > API Tokens** or by `terraform login`,
  acts as your user across organizations you belong to. Each organization can disable
  this access with its **Allow user tokens** policy.
- An **organization API key**, created under the organization's **Settings > API Keys**,
  is bound to one organization and can have narrower scopes. Use one key per organization
  when automation should stay within that boundary.

Organization creation requires a user credential and must also be allowed by the deployment's
organization-creation policy. See [Using the API](../architecture/using-the-api.md) for token
restrictions. A Zitadel access token is not an API credential.

## Transfer and verify state

1. Stop automatic triggers and concurrent applies on the source and destination while transferring ownership. Record which workspace currently owns the infrastructure.
2. With the CLI still connected to the **source**, take a backup:

   ```bash
   terraform state pull > source-workspace.tfstate
   ```

   Treat the file as secret material, keep it outside version control, and confirm it is a readable state snapshot before changing backend settings.
3. Prepare the destination workspace, variables, credentials and execution settings. Use the bounded empty-destination transfer below if its prerequisites apply. Review each initialization prompt; do not assume `terraform init` offers an automatic transfer between two hosted workspaces.
4. Confirm the destination state contains the expected resource addresses and lineage. Review a destination plan against the intended configuration before any apply. Unexpected creates, destroys or replacements are a reason to stop and compare state, inputs and provider versions.
5. Enable destination triggers only after the review, and leave the source unable to apply. Keep the backup and source history for your retention period.

A clean plan is useful evidence, but it does not by itself prove that every source setting or state object migrated. Check outputs, provider identities and workspace inputs too. If transfer is uncertain, keep both sides paused and reconcile against the saved backup before retrying.

### Manual transfer to an empty destination

Use this path only when the destination workspace has no managed resources or state to preserve, both sides are paused, and your Terraform CLI supports the configured backend and state format. Use the same CLI version as the source initially and a credential with destination state-write permission. Rehearse against a disposable workspace first.

In a **separate clean checkout** of the same root module and dependency lock file, configure the destination hostname/organization/workspace as above. Do not copy the source checkout's `.terraform` directory. Initialize that destination checkout:

```bash
terraform init
```

Confirm the selected hostname and workspace are the empty destination. Stop if they are wrong or initialization asks you to overwrite an existing state. Place the protected source backup outside this checkout, then run from the initialized destination checkout:

```bash
terraform state push /secure-backups/source-workspace.tfstate
terraform state pull > /secure-backups/destination-workspace.tfstate
terraform state list
terraform plan
```

Replace `/secure-backups` with an existing protected directory. Confirm the destination readback's lineage, resource addresses and outputs against the source backup, then review the plan. Keep sensitive readback files out of version control. A version, lineage or serial refusal is a stop condition: do not bypass it with `-force` or `-ignore-remote-version`. Preserve the destination snapshot and investigate the mismatch before retrying.

[Terraform state push](https://developer.hashicorp.com/terraform/cli/commands/state/push) writes to the currently configured backend and includes overwrite safeguards. It is a manual state operation, not a transfer of settings or history. For another CLI or a destination with existing state, choose its documented migration procedure instead of applying this example unchanged. See [remote backend configuration](https://developer.hashicorp.com/terraform/language/backend/remote) for backend constraints.

## Which resources are verified

The following table is generated from a lifecycle-test snapshot. It is not a live guarantee for your installed version.

| Result | Meaning |
|---|---|
| Verified. | That recorded fixture completed apply, no-drift and destroy checks. |
| Did not pass. | The fixture did not complete. The result alone does not identify an implementation defect or an unsupported resource. |
| Untested. | No fixture supplied evidence for that resource. |

<!-- BEGIN GENERATED: tfe-compat-table -->

Verified by driving the stock `hashicorp/tfe` provider against a running Stackweaver: **59 verified**, 5 did not pass, 0 untested, 64 fixtures total.

Evidence from a run on **2026-09-12T07:05:09Z** using hashicorp/tfe ~> 0.77. A row says what that run showed; it does not say whether Stackweaver implements the resource.

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
| `tfe_platform_admin_terraform_version` | ✅ verified | lifecycle passed against a running Stackweaver |
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

Check the timestamp and provider version above against your migration target. For endpoint details use the [API explorer](/docs/api-reference/explorer); for practical request setup use [Using the API](../architecture/using-the-api.md).
