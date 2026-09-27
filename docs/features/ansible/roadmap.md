---
description: "Ansible capability status: what the Ansible integration provides today and the gaps that are not yet available"
covers:
  - "core/services/ansible/**"
  - "backend/cmd/ansible-runner/**"
  - "backend/internal/api/v2/routes/ansible_routes.go"
  - "frontend/src/pages/Ansible/**"
---

# Ansible Roadmap

This page summarises what the Ansible integration provides today and lists the gaps that are not yet available. It does not commit to dates.

## Available Today

### Live Output and the Run Viewer

Jobs run with the `ansible.posix.jsonl` callback, so events are recorded line by line as tasks execute, and the job page polls for new events while a job runs. The job page opens on a Run tab with three views over the same events: a host-by-task matrix, a task timeline, and a chronological stream. One filter state (status tiles plus a search box covering hosts, task names, and module results) and one detail drawer apply to all three views. Events that cannot be structured appear verbatim in the stream, so the page never shows less than a plain terminal view.

### Galaxy Collections

The runner image ships with commonly used collections pre-installed (for example `community.general` and `ansible.posix`). Before a job runs, the runner looks for a `requirements.yml` in the playbook directory, in `collections/`, or in `roles/`, installs the collections it lists with `ansible-galaxy collection install`, and caches them per project under `$WORKSPACES_DIR/galaxy-cache/<project-id>` so later runs are faster.

### Dynamic Inventories

Azure dynamic inventory sources can authenticate with OIDC workload identity, reusing the organization's Azure OIDC configuration, and fall back to a stored credential. Custom inventory sources can be backed by a Git repository, and sources can sync on a schedule. See [Dynamic Inventories](../../user-guides/dynamic-inventories.md).

### Workflows

Workflows chain job templates, inventory syncs, and approval gates. The execution engine follows `on_success`, `on_failure`, and `always` edges, supports any-parent and all-parents convergence, merges workflow extra vars into node launches (node overrides win), and can run on a schedule. Approval nodes can be approved or denied, with an optional deny on timeout. Workflow runs show per-node status with links to each job's output.

The workflow endpoints are:

- `GET/POST /api/v2/organizations/:name/ansible/workflows` - list and create workflows
- `GET/PATCH/DELETE /api/v2/ansible/workflows/:id` - read, update, and delete a workflow
- `GET/POST /api/v2/ansible/workflows/:id/nodes` and `/edges` - manage nodes and edges
- `POST /api/v2/ansible/workflows/:id/launch` and `GET /api/v2/ansible/workflows/:id/jobs` - launch a workflow and list its runs
- `PATCH/DELETE /api/v2/ansible/workflow-nodes/:id` and `DELETE /api/v2/ansible/workflow-edges/:id` - update or delete individual nodes and edges

### Launching from Repository Pushes

Job templates can opt into launching automatically when the playbook's repository receives a push, from both GitHub and Azure DevOps webhooks. See the [changelog](./changelog.md) for this and the other job template controls (multiple credentials, timeouts, concurrency, job slicing, and provisioning callbacks).

### Notifications

Notification templates deliver job events over webhook, email (SMTP), or Microsoft Teams. Each template attachment chooses whether it fires when a job starts, succeeds, or fails.

### Access Control and Activity

Ansible resources follow the platform's team-based access control, and the job template page shows which teams can view, edit, and execute it. Jobs can run on self-hosted runners through agent pools. Organization activity, including Ansible jobs, appears in [Usage & Analytics](../../user-guides/usage-analytics.md).

## Not Yet Available

These gaps are known and are not supported today:

- **Visual workflow builder**: workflow nodes and edges are managed through the API; the Workflows page creates, lists, and launches workflows, but there is no drag-and-drop graph editor.
- **Nested workflows**: a workflow node that runs another workflow fails when the workflow reaches it.
- **Survey prompts at launch**: a workflow can store a survey definition, but launches do not prompt for survey answers. Pass values as extra vars instead.
- **Fact caching**: `use_fact_cache` and stored host facts are not supported.
- **Slack notifications**: there is no Slack channel type.
- **Custom credential types**: credentials use the built-in types only.
- **Push-based output**: the job page polls for new events; there is no WebSocket stream.
