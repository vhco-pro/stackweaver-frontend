---
title: "Terraform Cloud alternatives: choosing how you run IaC"
description: "Compare HCP Terraform, Terraform Enterprise, Stackweaver and CI with remote state. Check execution, European hosting and migration work."
canonical: /compare/terraform-cloud
author: Michiel VH
status: draft
updated: 2026-10-27
topics: [OpenTofu, Comparisons]
---
Before replacing Terraform Cloud, decide which part you want to replace.
Keeping state somewhere else is a much smaller change than moving the service that plans and applies infrastructure.
I would make that distinction first, then compare the work your team will have to operate.

> I build Stackweaver at VH & Co BV, a company based in Europe.
> This is a product author's comparison of documented workflows, not a performance benchmark or a completed migration trial.

## Techstack

- HCP Terraform, the current name for Terraform Cloud.
- Terraform Enterprise for a self-hosted HashiCorp deployment.
- Stackweaver's OpenTofu workspaces and TFE-compatible API surface.
- Terraform or OpenTofu CLI, depending on the platform and configuration.

## Separate state storage from remote execution

A [remote backend][tf-remote] can keep your state in a shared location while the CLI runs on a developer machine or a CI worker.
HCP Terraform can also execute runs remotely and retain their results alongside the workspace.
Those are different responsibilities, even when one product handles both.

If your team already has a dependable CI pipeline and only needs shared state, compare backends before installing another application.
You will still need to decide how the pipeline handles concurrent work and apply credentials.
You also need a way to review the plan that will actually be applied.

If you want a shared workspace interface and a managed run lifecycle, a backend alone will leave more work for you.
That is the comparison this article focuses on.

| Option | Who operates the control plane? | What to check before choosing it |
| --- | --- | --- |
| HCP Terraform | HashiCorp operates the hosted application. | Your subscription's capabilities, execution mode and regional offering. |
| Terraform Enterprise | Your team operates HashiCorp's self-hosted distribution. | Deployment requirements and the commercial agreement. |
| Stackweaver | Your team operates a self-hosted installation today. | OpenTofu execution requirements and the documented API compatibility limits. |
| CI with a remote backend | Your team maintains the pipeline and backend configuration. | Locking support, review controls and how execution records are retained. |

[Terraform Enterprise][tf-enterprise] is the self-hosted HashiCorp distribution.
It should be on the shortlist when you want to retain that application model on infrastructure you operate.
Self-hosting does not by itself make Stackweaver the closest replacement.

## Compare a complete plan and apply

Create an evaluation repository with `main.tf` in a separate directory:

```hcl
terraform {
  required_version = ">= 1.6.0"
}

resource "terraform_data" "evaluation" {
  input = "staging"
}

output "environment" {
  value = terraform_data.evaluation.output
}
```

The built-in [`terraform_data` resource][tofu-data] records a value in state without creating a cloud resource.
This example needs no external provider credentials.
It is useful for checking the run lifecycle before involving infrastructure you care about.

In HCP Terraform, create a VCS-connected workspace pointing at that directory and leave automatic application disabled.
Use the [VCS run workflow][hcp-runs] to plan the configuration, review the proposed resource, then confirm the apply.
Check the output and the workspace's retained state.

In Stackweaver, follow [the first-workspace guide][sw-first-workspace] with the same repository and working directory.
Select an available OpenTofu version and keep auto-apply off.
Queue a run, review the plan and confirm the apply.
The workspace keeps its state and run history in Stackweaver.

Change the input to `staging-review` and repeat the workflow.
Ask a teammate to find the first apply and explain the second plan.
Then check whether a user without apply permission can still change infrastructure through another route your team intends to use.
That permission check needs to cover your actual integration, not only the button in the browser.

This exercise does not prove compatibility with your cloud providers or existing state.
Use a representative non-production workspace for that next step.

## Check OpenTofu and API compatibility separately

Stackweaver's documented workspace execution path uses OpenTofu.
Accepting Terraform configuration or exposing TFE-compatible endpoints does not establish that it executes your chosen HashiCorp Terraform binary.
Keep runtime compatibility separate from API compatibility when evaluating an alternative.

The [migration guide][sw-migration] includes a dated resource-by-resource test snapshot for the stock `hashicorp/tfe` provider.
It also records fixtures that did not pass.
Use the operations your automation needs as the checklist, and verify them against the release you intend to install.
An endpoint with a familiar name is not enough evidence for a drop-in migration.

For new management configuration, the [native Stackweaver provider][sw-provider] manages the platform itself.
Your workspace configuration manages infrastructure separately.
Do not put those two jobs in one state file merely because they both use HCL.

## European hosting and private execution

HashiCorp offers [HCP Terraform in Europe][hcp-europe], with accounts and workspaces separate from its other regions.
The European offering has its own documented differences, including account administration and billing.
Check those details rather than assuming a US subscription behaves identically in Europe.

[HCP Terraform agents][hcp-agents] also let execution reach private infrastructure.
Running an agent inside your network does not move the hosted control plane there.
Ask where the state and run records are stored as well as where the commands execute.

Stackweaver can be self-hosted on infrastructure you select.
VH & Co is based in Europe, and a managed Stackweaver SaaS offering is planned.
The company's location does not establish that future service's hosting region or contractual terms.
Do not choose it today on the assumption that those terms have already been published.

## Migration includes the inputs outside state

Start by making a protected state backup and choosing a cutover window with both sides paused.
Recreate the destination workspace and recover sensitive variables from their original source.
VCS connections and access rules need their own migration work.
The state snapshot does not contain all of that configuration, and the source platform's API token does not become a destination token.

Follow a transfer procedure supported by your exact CLI and backend combination.
The [Stackweaver migration guide][sw-migration] has a bounded manual procedure for an empty destination, with safeguards and stop conditions.
Do not treat a new hostname in a `cloud` block as a completed transfer.

After transfer, compare the destination state and outputs with the backup, then inspect a plan before allowing an apply.
Unexpected creates or replacements are a reason to stop.
Leave the source unable to apply when you enable the destination, and retain the old run history for your retention period.

## Choose the work you want to own

I would keep HCP Terraform if its workflow fits and the goal is to avoid operating the control plane.
Compare Terraform Enterprise when the requirement is a self-hosted HashiCorp application.
Evaluate Stackweaver when you want OpenTofu workspaces alongside Ansible and are willing to operate the platform.

Stackweaver is source-available under [BSL 1.1][sw-license], not OSI open source.
Read the license when assessing your intended deployment.
For a practical first check, use the [small workspace example][sw-first-workspace] before migrating state that manages anything valuable.

## References and scope

Competitor documentation checked on 27 October 2026.
HCP Terraform is a hosted service; plan entitlements and regional terms need checking against the offer you intend to buy.
This article does not compare quoted prices or claim equal feature coverage.

[tf-remote]: https://developer.hashicorp.com/terraform/language/backend/remote
[tf-enterprise]: https://developer.hashicorp.com/terraform/enterprise
[hcp-runs]: https://developer.hashicorp.com/terraform/cloud-docs/workspaces/run/ui
[hcp-agents]: https://developer.hashicorp.com/terraform/cloud-docs/agents
[hcp-europe]: https://developer.hashicorp.com/terraform/cloud-docs/europe
[tofu-data]: https://opentofu.org/docs/language/resources/tf-data/
[sw-first-workspace]: /docs/get-started/your-first-opentofu-workspace
[sw-migration]: /docs/user-guides/migrating-from-terraform-cloud
[sw-provider]: /docs/user-guides/terraform-provider
[sw-license]: https://github.com/michielvha/stackweaver/blob/main/LICENSE
