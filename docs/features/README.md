---
title: "Platform features"
layout: overview
nav_order: 30
description: "Find Stackweaver capabilities and their task guides across OpenTofu, Ansible and the platform."
covers:
  - "scripts/capabilities/**"
---

# Platform features

Stackweaver runs OpenTofu infrastructure changes and Ansible automation. Explore an area
below to find what you can do, the constraints that matter and the guide to use it.

For a first run, start with [an OpenTofu workspace](../get-started/your-first-opentofu-workspace.md)
or [an Ansible job](../get-started/your-first-ansible-job.md). This catalogue covers documented
capabilities and is not a complete compatibility matrix. Check the guide for setup and access requirements.

<!-- capabilities:start -->

<details>
<summary>OpenTofu (9)</summary>

[Browse OpenTofu](/docs/features/opentofu)

| Capability | What you can do |
|---|---|
| [External run checks](/docs/user-guides/run-tasks) | Call external services at run-stage boundaries and enforce advisory or mandatory results. **Limits:** An unreachable or errored mandatory check fails the gate. A reported failure can wait for an authorized override. |
| [Plans, applies and run history](/docs/user-guides/understanding-opentofu-runs) | Preview infrastructure changes, confirm an apply and inspect the recorded result. **Limits:** Auto-apply removes the confirmation step, including for destroy runs. Plan-only runs cannot be applied. |
| [Repository path filters](/docs/features/opentofu/vcs-path-filtering) | Trigger workspace runs only when monitored files change, using directories or glob patterns. **Limits:** Turning file triggers off ignores path filters; branch and automatic-queue gates still apply. |
| [Run cancellation](/docs/features/opentofu/run-cancellation) | Cancel queued or executing work from the run page or API. **Limits:** Cancellation does not roll back infrastructure changes already made. |
| [Run output](/docs/features/opentofu/opentofu-streaming) | Follow plan and apply output while a run executes and read its stored logs afterwards. |
| [Run timeouts](/docs/features/opentofu/run-timeout) | Set a workspace timeout to limit long-running apply operations. **Limits:** Initial platform plans have a separate deadline. Agent commands and platform provider-error retries can continue after the run is marked failed. |
| [Variables and shared sets](/docs/user-guides/managing-workspace-variables) | Pass Terraform and environment variables to runs and share sets across projects or workspaces. **Limits:** Sensitive values are protected in storage, but code running in a job can expose values it receives. |
| [Workspace change requests](/docs/user-guides/change-requests) | Record work for workspace owners and archive each request when it is done. **Limits:** Filing needs organization workspace-management permission; archiving needs workspace write access. UI views load one page; use API pagination for larger backlogs. |
| [Workspace settings](/docs/features/opentofu/workspace-editing) | Change a workspace name, working directory, OpenTofu version and execution settings without recreating it. **Limits:** Changing repository or branch points existing state at different configuration. Review state-affecting changes carefully. |

</details>

<details>
<summary>Ansible (15)</summary>

[Browse Ansible](/docs/features/ansible)

| Capability | What you can do |
|---|---|
| [Ad hoc commands](/docs/user-guides/dynamic-inventories) | Run an allowed module against selected inventory hosts without registering a playbook. **Limits:** Modules are restricted by an allowlist. Ad hoc jobs do not install repository Galaxy requirements. |
| [Azure identity for playbooks](/docs/user-guides/azure-key-vault-from-playbooks) | Read Azure resources using an attached credential, organization federation or the runner environment. **Limits:** An attached Azure credential takes precedence over organization OIDC. Azure role assignments are still required. |
| [Cloud and Git inventories](/docs/user-guides/dynamic-inventories) | Refresh hosts from cloud inventory plugins or a Git repository, with sync history and per-source merge controls. **Limits:** Inventory syncs execute on platform infrastructure, not self-hosted agent pools. Azure sources can use federated identity. |
| [Constructed inventories](/docs/user-guides/dynamic-inventories) | Combine existing inventories and derive groups, variables and a host subset for a job. **Limits:** Hosts and groups are derived from input inventories, not edited directly. |
| [Credentials and multiple vaults](/docs/features/ansible/roadmap) | Store built-in credential types and attach multiple credentials, including distinct vault IDs, to templates. **Limits:** One credential per type, except vault credentials with distinct vault IDs. Custom credential types are not supported. |
| [Galaxy collections and roles](/docs/features/ansible/galaxy-collections) | Install repository requirements before jobs, with per-project caching on platform and self-hosted runners. **Limits:** An installation failure is reported but the play still runs. Private servers require runner network access and configuration. |
| [Job and workflow notifications](/docs/features/ansible/roadmap) | Send start, success and failure notifications over webhook, email or Microsoft Teams. **Limits:** Private webhook and Teams destinations require an operator opt-in. There is no Slack channel type. |
| [Job templates and execution](/docs/features/ansible/execution-flows) | Reuse launch settings, apply timeout and concurrency controls, split hosts into slices, and inspect task output in matrix, timeline or stream views. **Limits:** Job output is polled while the job runs. A disabled template refuses every launch path. |
| [Playbook registration and sync](/docs/user-guides/managing-ansible-playbooks) | Register a playbook or bulk-import a repository, then choose a cached snapshot or fresh checkout for execution. **Limits:** Cached mode can still clone on a snapshot miss or an older agent. Fresh mode fetches branch HEAD at execution, not a pinned webhook commit. |
| [Provisioning callbacks](/docs/features/ansible/execution-flows) | Let a provisioned host request a template launch limited to that host. **Limits:** The template must allow callbacks and the requesting host must already be in its inventory. |
| [Repository-triggered jobs](/docs/features/ansible/execution-flows) | Launch an opted-in job template from a GitHub or Azure DevOps push. **Limits:** Fresh mode fetches branch HEAD at job execution; it does not pin the webhook commit. Cached mode can race snapshot synchronization. |
| [Scheduled automation](/docs/features/ansible/execution-flows) | Schedule job templates, inventory-source syncs and workflows. **Limits:** Use a dedicated inventory-source schedule. The source form's Sync Schedule field does not activate recurring syncs. Playbook-sync scheduling is not supported. |
| [Self-hosted Ansible execution](/docs/features/ansible/execution-flows) | Run jobs and ad hoc commands on agents that can reach your private hosts. **Limits:** Choose the pool on the job template or ad hoc launch. Inventory syncs still execute on platform infrastructure. |
| [Static inventories](/docs/get-started/your-first-ansible-job) | Define hosts and groups directly and use the inventory when launching a playbook. |
| [Workflows and approvals](/docs/features/ansible/execution-flows) | Chain jobs, inventory syncs and approval gates with success/failure branches and convergence rules. **Limits:** Configure graph nodes and edges through the API. Nested workflows and launch-time survey prompts are not supported. |

</details>

<details>
<summary>Platform (5)</summary>

| Capability | What you can do |
|---|---|
| [Cross-organization dashboard](/docs/user-guides/reading-the-dashboard) | Find waiting approvals, failed work and running operations across organizations you can access. **Limits:** Runner and change-request rows require their respective organization management permissions. |
| [GitHub and Azure DevOps connections](/docs/user-guides/vcs) | Connect repositories for code-driven infrastructure and Ansible workflows. |
| [OIDC workload identity](/docs/user-guides/oidc-configuration) | Authenticate OpenTofu runs to Azure, AWS, GCP or Vault with short-lived workload tokens. **Limits:** Operators must configure signing keys and each target cloud must trust the intended run subject. |
| [Organization policies](/docs/user-guides/organization-settings) | Configure token access, workspace policies and pull-request behavior for an organization. |
| [REST API and OpenAPI explorer](/docs/architecture/using-the-api) | Automate platform operations and browse request and response schemas in the API explorer. **Limits:** Terraform-compatible operations and Stackweaver-specific endpoints have different coverage. Check the schema for the operation you use. |

</details>

<!-- capabilities:end -->

## Operating Stackweaver

Read the [architecture overview](../architecture/README.md) for service boundaries and
[self-hosting guides](../get-started/self-hosting/README.md) for deployment. The
[Stackweaver changelog](../changelog.md) explains released changes and any action to take.
