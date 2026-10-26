---
nav_order: 20
description: "Index page for all user guides"
covers:
  - "frontend/src/pages/Docs/**"
  - "frontend/src/components/docs/**"
---

# User guides

Choose a task below. If you are new to Stackweaver, start with [your first OpenTofu workspace](../get-started/your-first-opentofu-workspace.md) or [your first Ansible job](../get-started/your-first-ansible-job.md).

## Operate OpenTofu workspaces

| I want to... | Guide |
|---|---|
| Understand a plan, approval or failed apply. | [Read OpenTofu runs](./understanding-opentofu-runs.md). |
| Supply inputs or share values across workspaces. | [Manage workspace variables](./managing-workspace-variables.md). |
| Track work that needs fixing. | [File and archive change requests](./change-requests.md). |
| Add an external check to a run. | [Set up run tasks](./run-tasks.md). |
| Control organization-wide policies. | [Configure organization settings](./organization-settings.md). |
| Move an existing workspace. | [Migrate from Terraform Cloud or Enterprise](./migrating-from-terraform-cloud.md). |

## Run Ansible automation

| I want to... | Guide |
|---|---|
| Register or bulk-import repository files. | [Manage Ansible playbooks](./managing-ansible-playbooks.md). |
| Discover hosts from a cloud or repository. | [Configure dynamic inventories](./dynamic-inventories.md). |
| Read secrets without a stored Azure credential. | [Read Azure Key Vault from playbooks](./azure-key-vault-from-playbooks.md). |

For supported capabilities and their limits, use the [generated feature catalogue](../features/README.md) and its [Ansible view](../features/ansible/README.md).

## Connect systems and manage access

| I want to... | Guide |
|---|---|
| Manage install-wide access and catalogues. | [Platform administration](./platform-administration.md). |
| Manage Stackweaver resources as code. | [Use the Terraform provider](./terraform-provider.md). |
| Make a direct API request. | [Use the API](../architecture/using-the-api.md). |
| Run inside my own network. | [Set up self-hosted runners](./self-hosted-runners.md). |
| Authenticate runs to a cloud or Vault. | [Configure workload identity](./oidc-configuration.md). |
| Connect a repository. | [Choose a VCS integration](./vcs/README.md), then configure [GitHub App](./vcs/github-app.md) or [Azure DevOps](./vcs/azure-devops.md). |
| Set up sign-in for a self-hosted installation. | [Initialize Zitadel](./authentication/zitadel-setup.md) and [configure its domain](./authentication/zitadel-custom-domain.md). |
| Use an external identity provider. | [Set up SSO](./sso/README.md) with [Entra ID](./sso/azure-ad.md), [Okta](./sso/okta.md), [Cognito](./sso/aws-cognito.md) or [generic OIDC](./sso/generic-oidc.md), then [map groups to teams](./sso/team-mapping.md). |

[Authentication overview](./authentication/README.md) explains the difference between browser sign-in, API tokens and workload identity.

## Find and diagnose work

[Read the dashboard](./reading-the-dashboard.md) for cross-organization attention items. Use [Usage and analytics](./usage-analytics.md) for delivery health and [Troubleshooting](./troubleshooting-common-issues.md) when a task fails.

Browse the [documentation homepage](/docs) or use the folder sidebar. Press **Ctrl+K** on Windows/Linux or **Cmd+K** on macOS to search titles and content. On a phone, open **Navigation** to browse folders.
