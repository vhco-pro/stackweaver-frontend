---
description: "Ansible capabilities, execution limits and links to the guides for using them."
covers:
  - "scripts/capabilities/**"
---

# Ansible features

Register a playbook, choose its inventory and credentials, and launch it through a job
template. Start with [your first Ansible job](../../get-started/your-first-ansible-job.md)
for a guided run. Read [execution flows](./execution-flows.md) to understand launch gates,
runner assignment and inventory synchronization.

## Capabilities

<!-- capabilities:start -->

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

<!-- capabilities:end -->

## Further reading

[All platform features](../README.md) includes OpenTofu and shared platform capabilities.
Use the [API explorer](/docs/api-reference/explorer) for operation schemas, or the
[Stackweaver changelog](../../changelog.md) for released changes.

The [existing Ansible changelog](./changelog.md) remains available. The
[current limitations reference](./roadmap.md#not-yet-available) describes unsupported behavior.
