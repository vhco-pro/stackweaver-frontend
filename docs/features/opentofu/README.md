---
title: "OpenTofu features"
layout: overview
description: "OpenTofu capabilities and guides for workspaces, runs and automation."
covers:
  - "scripts/capabilities/**"
---

# OpenTofu features

Use workspaces to keep infrastructure configuration, variables and state together. A run
plans a change and, when approved or configured for auto-apply, applies it. Start with
[your first OpenTofu workspace](../../get-started/your-first-opentofu-workspace.md).

## Capabilities

<!-- capabilities:start -->

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

<!-- capabilities:end -->

## Further reading

[All platform features](../README.md) includes Ansible and shared platform capabilities.
For automation, read [Using the API](../../architecture/using-the-api.md) or
[Managing Stackweaver with Terraform](../../user-guides/terraform-provider.md).
