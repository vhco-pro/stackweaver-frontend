---
title: "Route work to a pool"
nav_order: 3
description: "Send OpenTofu workspaces, Ansible templates and syncs to an agent pool or to hosted capacity, set defaults, and give Ansible jobs their configuration and network routes."
covers:
  - "core/settings/**"
  - "backend/internal/api/v2/handlers/effective_settings.go"
  - "frontend/src/components/settings/**"
---

# Route work to a pool

## OpenTofu workspaces

Open the workspace's edit form, set **Execution Mode** to **Agent**, select **Agent Pool**, then save. Verify both the mode and pool on the saved workspace before starting a test plan. A workspace in **remote** execution mode runs on the organization's hosted capacity.

Pool eligibility alone does not select agent execution. A workspace assigned to a pool with no available launcher waits; there is no automatic fallback to the hosted capacity.

A VCS-backed workspace's run starts from a snapshot of its repository, which a sync on the hosted capacity captured, so the launcher and the run never clone it. Module sources are different: `tofu init` fetches them from the run itself, and private git module sources get no platform credential. A `git::` source on a private Git host works only with a credential you give the run, for example in a sensitive environment variable your git configuration reads, and over a route from the run to that host.

## Routing every workspace by default

Setting each workspace individually does not scale once you have more than a handful. Instead, set an organization-wide default: open **Settings > Agent Pools** and use the **Default execution** section at the top to choose **Agent** and the pool you want. Every workspace then runs on that pool without being configured, and you only touch the ones that need something different. A project can carry its own default too, on the **Edit project** dialog of the project page.

Stackweaver resolves execution settings when a run starts, taking the most specific setting that applies. A workspace with its own execution mode always wins. Otherwise the workspace's project decides, if the project set its own defaults. Only when neither has expressed a preference does the organization default apply. A project that has deliberately chosen a non-agent mode is respected, so it will not be pulled onto agents by an organization default.

The same settings are available to Terraform configuration through the `tfe_organization_default_settings` resource, so you can manage them alongside the rest of your platform.

## Ansible jobs

Select **Agent Pool (Optional)** on the job template, or the agent-pool choice for an ad hoc command. A job launched from a template runs on the template's pool. When the template names none, it runs on the project's default pool, then the organization's, when that level's execution mode is **Agent**, and otherwise on the organization's hosted capacity. An ad hoc command runs on the pool you choose for it, or on the hosted capacity. The pool must belong to the same organization and permit the relevant scope.

The template's effective settings (`GET /api/v2/ansible/job-templates/:id/effective-settings`) name the pool its jobs use and the level it comes from (`agent-pool-id`). Check them and start a non-destructive test job before routing production automation.

Syncs are routed by the kind of sync. A dynamic inventory source sync runs on the project's or the organization's default agent pool when one is set, and on the hosted capacity otherwise. The syncs that capture a snapshot from your VCS provider (a playbook snapshot, a VCS inventory file, a constructed inventory rebuild, the configuration of a VCS-backed workspace, and a registry module version published from a Git tag) always run on the hosted capacity in the Ansible job image, so the launchers in your pools never need a route to your VCS host or a VCS credential.

## Configure Ansible dependencies

If you use Ansible, you can customize `ansible.cfg` per organization or project so that jobs run with your preferred settings (e.g. timeouts, SSH options, callback plugins).

1. Go to **Settings > Ansible Configuration**.
2. Choose the scope: **Organization** or **Project**.
3. Edit the configuration content. Edit sections such as `[defaults]` and `[ssh_connection]`.
4. Save.

When a job runs, on the hosted capacity or on your launchers, Stackweaver writes the appropriate `ansible.cfg` into the job. The settings UI exposes organization and project configuration; a project override takes precedence over the organization default.

### What an Ansible job needs from the network

An Ansible job starts from a snapshot of its playbook's repository, which a sync on the hosted capacity captured, so the launcher and its jobs never clone from your VCS provider. A `fresh` playbook is captured again for every launch, and the job waits for that capture.

When the playbook repository contains a `requirements.yml`, the job first installs what the organization's cache holds for it and then runs `ansible-galaxy` for the rest. The job therefore needs a route to wherever the remaining collections and roles come from: `galaxy.ansible.com`, your Git host for `type: git` entries, or a private Galaxy server or Automation Hub. Configure a private server in the `[galaxy]` section of the `ansible.cfg` described above, or for the whole installation with `STACKWEAVER_GALAXY_SERVERS` on the API. `ansible-galaxy` gets no platform credential, so a `type: git` entry on a private Git host needs a credential you give the job. If the install fails, the job output says so and the play still runs. See [Galaxy Collections](../../features/ansible/galaxy-collections.md) for the details.

Jobs run in the Ansible job image unless they select an execution environment. [Run Images and Execution Environments](./run-images-and-execution-environments.md) explains when you need one and how an AWX execution environment runs on Stackweaver.
