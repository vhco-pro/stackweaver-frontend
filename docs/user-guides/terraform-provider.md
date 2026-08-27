---
description: "Guide to managing StackWeaver itself as code with the official Terraform provider, including installation, authentication, and migrating from terraform-provider-tfe"
covers:
  - "backend/internal/api/v2/routes/**"
---

# Managing StackWeaver with Terraform

StackWeaver publishes an official Terraform provider, so the platform itself can be managed as code. Instead of clicking through the UI to create organizations, projects, workspaces, teams, variables, agent pools, and Ansible job templates, you can declare them in Terraform configuration and apply them like any other infrastructure.

The provider is published on the public Terraform Registry as [`vhco-pro/stackweaver`](https://registry.terraform.io/providers/vhco-pro/stackweaver/latest). The full reference documentation, with an argument reference and example for every resource and data source, lives on the Registry, and the source is on GitHub at [vhco-pro/terraform-provider-stackweaver](https://github.com/vhco-pro/terraform-provider-stackweaver). This guide covers how to get started and how the provider relates to the Terraform Cloud and Enterprise provider you may already be using.

## What You Can Manage

The provider covers the platform surface you see in the UI. On the Terraform side that means organizations and their default settings, projects, workspaces and workspace settings, variables and variable sets, run triggers, team access and team tokens, agent pools and agent tokens, run tasks, notification configurations, OIDC configurations for cloud workload identity, and the private module and provider registry.

Because StackWeaver is a multi-IaC platform, the provider also covers the Ansible surface, which has no Terraform Cloud equivalent: playbooks, inventories, inventory sources, hosts and groups, credentials, job templates and their variables, schedules, notification templates, and ad-hoc jobs. This means an entire StackWeaver installation, both its Terraform and its Ansible configuration, can be described in one Terraform workspace.

Alongside those resources there are data sources for reading existing state, including workspaces, projects, teams, variables, runners, VCS repositories and branches, and the Ansible collection and inventory-sync surfaces. See the [Registry documentation](https://registry.terraform.io/providers/vhco-pro/stackweaver/latest/docs) for the complete, versioned list.

## Installing the Provider

Declare the provider in your `required_providers` block and configure it with your StackWeaver host, an API token, and optionally a default organization.

```hcl
terraform {
  required_providers {
    stackweaver = {
      source  = "vhco-pro/stackweaver"
      version = "~> 0.1"
    }
  }
}

provider "stackweaver" {
  hostname     = "stackweaver.example.com" # your self-hosted host
  token        = var.stackweaver_token
  organization = "my-org"
}

resource "stackweaver_project" "platform" {
  organization = "my-org"
  name         = "platform"
}
```

If you are self-hosting, set `hostname` to the host that serves your StackWeaver UI and API. The provider defaults to the hosted platform at `app.stackweaver.io` when `hostname` is not set, which is almost certainly not what you want on a self-hosted installation.

## Authenticating

The provider authenticates with a StackWeaver API token. Create one in the UI under **Settings > API Tokens**, or run `terraform login` against your StackWeaver host to have the CLI generate and store one for you. Personal tokens act as your user across every organization you belong to, so the provider can manage anything your account has permission to manage.

For anything beyond local experimentation, keep the token out of your configuration and supply it through the `TFE_TOKEN` environment variable rather than the `token` argument. The host can be set the same way through `TFE_HOSTNAME`. These variable names are deliberately the ones `terraform-provider-tfe` uses, so existing pipelines and credential blocks keep working unchanged.

> [!NOTE]
> A token used by the provider can create and destroy real workspaces, teams, and variables. Treat it like any other privileged credential: store it in a secret manager, scope the account appropriately, and rotate it on the same schedule as your other platform credentials.

## Relationship to terraform-provider-tfe

The StackWeaver provider is a standalone provider derived from HashiCorp's [`terraform-provider-tfe`](https://github.com/hashicorp/terraform-provider-tfe) and, like its upstream, is licensed under MPL-2.0. It is not an official HashiCorp product and is not affiliated with or endorsed by HashiCorp.

Every resource that has a Terraform Cloud or Enterprise equivalent is registered under both a native `stackweaver_*` name and a `tfe_*` alias. StackWeaver-native resources, such as the entire Ansible surface, are available under `stackweaver_*` only. This is why StackWeaver's API is kept compatible with the TFE API: the upstream provider works against StackWeaver too, and this provider is the same surface plus everything TFE does not have.

## Using hashicorp/tfe Against StackWeaver

Because StackWeaver implements the TFE API, you can point HashiCorp's own provider at a StackWeaver host without changing anything else. This is useful when you want to try StackWeaver against an existing configuration before committing to a provider swap, or when a policy in your organization restricts you to providers published by HashiCorp.

Set the provider's `hostname` to your StackWeaver host and authenticate with a StackWeaver API token exactly as you would with the native provider.

```hcl
terraform {
  required_providers {
    tfe = {
      source  = "hashicorp/tfe"
      version = "~> 0.77"
    }
  }
}

provider "tfe" {
  hostname     = "stackweaver.example.com" # your StackWeaver host, not app.terraform.io
  token        = var.stackweaver_token
  organization = "my-org"
}

resource "tfe_workspace" "app" {
  name         = "app"
  organization = "my-org"
}
```

The same environment variables apply, so `TFE_HOSTNAME` and `TFE_TOKEN` configure the host and token without putting either in your configuration. If you omit `hostname`, the provider talks to Terraform Cloud at `app.terraform.io` instead, which is the most common mistake when setting this up.

The limitation of this approach is coverage rather than correctness. The upstream provider only knows about resources that exist in Terraform Cloud, so nothing StackWeaver adds beyond the TFE surface, most notably every Ansible resource, is reachable this way. A small number of TFE resources also depend on features StackWeaver does not implement, such as Sentinel policy sets, and those will fail at apply time rather than at plan time. If you hit one, the native provider is the better answer, since it registers the same `tfe_*` names and simply has more behind them.

## Migrating from terraform-provider-tfe

If you already manage Terraform Cloud or Enterprise with `terraform-provider-tfe`, the migration is a source swap rather than a rewrite. Point the `tfe` provider's `source` at `vhco-pro/stackweaver` and your existing `resource "tfe_*"` blocks continue to work against the alias, with no changes to resource names or state addresses.

```hcl
terraform {
  required_providers {
    tfe = {
      source  = "vhco-pro/stackweaver"
      version = "~> 0.1"
    }
  }
}
```

Once you are running against StackWeaver, you can rename resources to their native `stackweaver_*` names at your own pace using `moved {}` blocks, or `terraform state mv` if you are on an older Terraform version. The aliases are maintained rather than deprecated, so there is no deadline on finishing that rename, and you can adopt `stackweaver_*` for new resources while leaving existing ones on the alias.

## Related Documentation

- [Understanding OpenTofu Runs](./understanding-opentofu-runs.md): how to read the plan and apply output of the runs your configuration creates
- [Managing Workspace Variables](./managing-workspace-variables.md): the variable and variable-set model the provider's variable resources map onto
- [Self-Hosted Runners](./self-hosted-runners.md): agent pools and runners, which the provider can also create and manage
- [Your First OpenTofu Workspace](../get-started/your-first-opentofu-workspace.md): the UI walkthrough of the same objects, if you are new to the platform
