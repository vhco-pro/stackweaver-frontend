---
description: "Configure the native Terraform provider, authenticate and safely assess an existing TFE configuration."
covers:
  - "backend/internal/api/v2/routes/**"
---

# Manage Stackweaver with Terraform or OpenTofu

Use `vhco-pro/stackweaver` to manage platform resources as code. This configures
Stackweaver itself; the workspace's OpenTofu run manages your infrastructure separately.
Use the [generated feature catalogue](../features/README.md) for product capabilities and
the [provider reference](https://registry.terraform.io/providers/vhco-pro/stackweaver/latest/docs)
for the resources and arguments supported by the version you install.

## 1. Choose the host and credentials

Create an API token under **Settings > API Tokens** with the permissions needed for the
target organization. Supply it through your shell or CI secret store as `TFE_TOKEN`.
Do not commit a token or put it in command history. `TFE_HOSTNAME` can supply the host;
this example pins it explicitly to avoid connecting to the wrong service.

Personal tokens inherit the user's access; scoped team/organization tokens have their own
boundaries. A token that can read a resource may still be unable to create or delete it.
The Terraform/OpenTofu CLI credential store is another supported credential source;
`terraform login stackweaver.example.com` signs in for that hostname.

## 2. Declare a small configuration

Save as `main.tf`. Replace the host and organization with an existing organization where
you can manage projects. Select and pin a provider version compatible with your installed
Stackweaver release, and keep the dependency lock file in version control.

```hcl
terraform {
  required_providers {
    stackweaver = {
      source = "vhco-pro/stackweaver"
    }
  }
}

provider "stackweaver" {
  hostname     = "stackweaver.example.com"
  organization = "my-org"
}

resource "stackweaver_project" "platform" {
  name         = "platform"
  organization = "my-org"
}
```

The provider's default host is `app.stackweaver.io`. Self-hosted installations should
explicitly choose their host. A provider configuration does not deploy the Stackweaver
server; use the [self-hosting guides](../get-started/self-hosting/README.md) for that.
There is no equivalent management YAML or Stackweaver CLI for this example.

## 3. Preview, apply and verify

```bash
terraform init
terraform plan
terraform apply
terraform state show stackweaver_project.platform
```

Open **Projects** in the same organization and confirm the project exists. Stop if the plan
proposes unexpected deletion or replacement. These commands can create or destroy real
platform resources. With OpenTofu, use `tofu` for the same CLI sequence.

## Install-wide automation

Install-wide resources need a platform admin token. The OpenTofu versions catalogue, which `tfe_terraform_version` manages, belongs to the installation rather than to an organization, and its API answers only a token that carries the platform admin scope. A [platform administrator](./platform-administration.md) mints one under **Settings > API Tokens** by ticking **Platform admin** in the create dialog; the checkbox appears only to platform administrators, and `terraform login` always mints a plain token. Inside organizations a platform admin token acts exactly as a plain token of the same person, so one token can manage `tfe_terraform_version` and that person's organization resources in the same configuration. The token stops working for the install-wide resources as soon as its owner stops being a platform administrator.

## Existing TFE configurations

The native provider exposes its supported TFE-compatible resources under `tfe_*` aliases
as well as `stackweaver_*` names. Native-only resources use `stackweaver_*`. This does not
promise support for every upstream TFE feature. Check the installed provider schema and the
[compatibility evidence](./migrating-from-terraform-cloud.md) for the operations you need.

To keep using HashiCorp's provider against Stackweaver, choose its source and your
Stackweaver hostname explicitly:

```hcl
terraform {
  required_providers {
    tfe = {
      source = "hashicorp/tfe"
    }
  }
}

provider "tfe" {
  hostname = "stackweaver.example.com"
}

resource "tfe_workspace" "app" {
  name         = "app"
  organization = "my-org"
}
```

`TFE_TOKEN` supplies credentials. Without the hostname, the upstream provider targets its
own default service. Unsupported operations do not become supported merely by changing
the provider source.

## Change provider source without changing the platform

A source change and a move from Terraform Cloud are different operations. Follow
[the migration guide](./migrating-from-terraform-cloud.md) to transfer platform objects and
state; do not point existing management state at another host and apply it blindly.

For an existing state **already managing the same Stackweaver installation**, assess a
source change separately:

1. Pause concurrent operations, save configuration/lock files and take a protected state
   backup. State can contain secrets.
2. Check that every managed resource type is supported by the target provider version.
3. Change only the required provider source while retaining the local name `tfe` and the
   existing `tfe_*` resource addresses:

   ```hcl
   terraform {
     required_providers {
       tfe = {
         source = "vhco-pro/stackweaver"
       }
     }
   }
   ```

4. If state still references the upstream provider, review the affected addresses and use
   Terraform's provider-address migration, keeping state locking enabled:

   ```bash
   terraform state replace-provider \
     registry.terraform.io/hashicorp/tfe \
     registry.terraform.io/vhco-pro/stackweaver
   terraform init
   terraform plan
   ```

5. Stop on schema errors or unexpected changes; restore/reconcile from your protected
   backup through your normal state-recovery procedure.

This is not a verified cross-version migration recipe. Test it on a copy first. Renaming
`tfe_*` resource **types** to `stackweaver_*` is a separate state migration; do not assume
that `moved` blocks or `state mv` support cross-type conversion. Keeping supported aliases
avoids that unnecessary change.

See Terraform's [replace-provider reference](https://developer.hashicorp.com/terraform/cli/commands/state/replace-provider).
The native provider derives from `terraform-provider-tfe` under MPL-2.0; it is not an
official HashiCorp product.
