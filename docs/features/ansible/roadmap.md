---
description: "Ansible capability status: what the Ansible integration provides today and the gaps that are not yet available"
covers:
  - "core/services/ansible/**"
  - "core/repository/ansible_*"
  - "core/models/ansible_*"
  - "core/models/fk_delete_rules.go"
  - "backend/cmd/ansible-runner/**"
  - "backend/internal/api/v2/handlers/ansible/**"
  - "backend/internal/api/v2/routes/ansible_routes.go"
  - "backend/internal/services/rbac/**"
  - "frontend/src/pages/Ansible/**"
---

# Ansible Roadmap

This page summarises what the Ansible integration provides today and lists the gaps that are not yet available. It does not commit to dates.

## Available Today

### Live Output and the Run Viewer

Jobs run with the `ansible.posix.jsonl` callback, so events are recorded line by line as tasks execute, and the job page polls for new events while a job runs. The job page opens on a Run tab with three views over the same events: a host-by-task matrix, a task timeline, and a chronological stream. One filter state (status tiles plus a search box covering hosts, task names, and module results) and one detail drawer apply to all three views. Events that cannot be structured appear verbatim in the stream, so the page never shows less than a plain terminal view.

`GET /api/v2/ansible/jobs/:id/events` returns a job's events in counter order. A per-host task result carries the module's whole return value under `event-data.hosts.<host>`. `page[number]` and `page[size]` page the stream, and `meta.pagination.total-count` counts the events that match the filters in use, so a client walking the pages of a filtered query gets the filtered count. `after` returns only the events whose counter is greater than the one given, at most 2,000 in one response and without a pagination block. It is what a client polling a running job uses, and a burst larger than the cap is picked up by the next call. `filter[host]` keeps the events of one inventory host, `filter[task]` the events of one task matched on its exact name, and `filter[counter]` the single event with that counter. `filter[status]` keeps the per-host results with one outcome, which is `ok`, `changed`, `failed`, `unreachable` or `skipped`, and any other value is rejected with `400`. The filters combine with one another, with `after` and with paging.

`fields[events]=summary` returns a reduced form of each event for very large runs, and any other value is rejected with `400`. A summary event has empty `stdout` and `stderr`, is marked `"summary": true`, and reduces `event-data` to the callback's `_event` and `_timestamp`, the `task` and `play` identity (`id`, `name`, `path`, `duration`), the recap `stats` when present, and for each host `action`, `changed`, `failed`, `skipped`, `unreachable`, `rc`, `attempts`, `skip_reason` and a `msg` cut to 200 characters. Gathered facts, module arguments, loop results and diffs are left out, and `filter[counter]` fetches the full event. The web UI uses this form above 5,000 events and fetches a full event when you open it.

`GET /api/v2/ansible/jobs/:id/output` returns the concatenated standard output of the job's first 10,000 events. Read the events endpoint, which pages, for a longer run.

### Galaxy Collections

The runner image ships with commonly used collections pre-installed (for example `community.general` and `ansible.posix`). Before a job runs, the runner looks for a `requirements.yml` in the playbook directory, in `collections/`, or in `roles/`, installs the collections it lists with `ansible-galaxy collection install`, and caches them per project under `$WORKSPACES_DIR/galaxy-cache/<project-id>` so later runs are faster.

### Inventories and Groups

An inventory kept in a Git repository names its VCS connection in the `vcs_connection` relationship. The connection must belong to the inventory's own organization: creating or updating an inventory is rejected with `400` and the detail `VCS connection not found` when the connection does not exist in that organization, and nothing is stored. A group can be nested under another by naming it in the `parent` relationship, on create and on update. The parent must be a group of the same inventory: a request that names any other group is rejected with `400` and the detail `parent group not found`, and nothing is stored.

### Dynamic Inventories

Azure dynamic inventory sources can authenticate with OIDC workload identity, reusing the organization's Azure OIDC configuration, and fall back to a stored credential. Custom inventory sources can be backed by a Git repository, and sources can sync on a schedule. See [Dynamic Inventories](../../user-guides/dynamic-inventories.md).

### Credentials

A credential's `credential-type` is one of `ssh`, `machine-ssh`, `scm`, `vault`, `aws`, `azure`, `gcp` or `vmware`, and any other value is rejected with `400`. Secret values are never returned: a credential reports `has-ssh-private-key`, `has-password`, `has-vault-password` and `has-become-password` in their place. Deleting a credential is rejected with `409 Conflict` while a job that ran with it still exists. Job templates, inventory sources and workflow nodes do not hold a credential back: deleting it removes it from them.

### Workflows

Workflows chain job templates, inventory syncs, and approval gates. The execution engine follows `on_success`, `on_failure`, and `always` edges, supports any-parent and all-parents convergence, merges workflow extra vars into node launches (node overrides win), and can run on a schedule. Approval nodes can be approved or denied, with an optional deny on timeout. Workflow runs show per-node status with links to each job's output.

The workflow endpoints are:

- `GET/POST /api/v2/organizations/:name/ansible/workflows` - list and create workflows
- `GET/PATCH/DELETE /api/v2/ansible/workflows/:id` - read, update, and delete a workflow
- `GET/POST /api/v2/ansible/workflows/:id/nodes` and `/edges` - manage nodes and edges
- `POST /api/v2/ansible/workflows/:id/launch` and `GET /api/v2/ansible/workflows/:id/jobs` - launch a workflow and list its runs
- `PATCH/DELETE /api/v2/ansible/workflow-nodes/:id` and `DELETE /api/v2/ansible/workflow-edges/:id` - update or delete individual nodes and edges

A `PATCH` on a workflow or on a node changes only the attributes its document carries and leaves the others as they are. An attribute sent with an empty string, `false` or `0` is stored as that value, and an empty `extra-vars` clears the variables. The name is the exception, because a workflow must have one: an empty name is rejected with `400` when a workflow is created and when a `PATCH` carries it.

On a workflow and on a node, `extra-vars` is a JSON object sent as a string. A value that is not empty and is not a JSON object, such as text that is not JSON or a JSON list, is rejected with `400`, and so is an inventory, job template or credential relationship whose identifier is not a UUID. Nothing is stored when a request is rejected.

A node's `node-type` is one of `job_template`, `workflow`, `inventory_sync` or `approval`, and an edge's `condition` is one of `on_success`, `on_failure` or `always`. Any other value is rejected with `400`. Everything a workflow names must belong to the workflow's own organization: creating a workflow is rejected with `400` when its project or inventory does not exist in that organization, creating a node is rejected with `400` when its job template, inventory or credential does not, and creating an edge is rejected with `400` unless both of its ends are nodes of the workflow in the URL. The `detail` of the error says which one was not found.

### Job Templates

A job template holds a set of credentials rather than a single one: at most one per type, plus any number of vault credentials with distinct vault IDs. Sending the `credentials` relationship when a template is created attaches them. Sending it on an update replaces the set wholesale, an empty array clears it, and leaving it out keeps the set as it is. The same set can be managed one credential at a time with `GET` and `POST` on `/api/v2/ansible/job-templates/:id/credentials` and `DELETE` on `/api/v2/ansible/job-templates/:id/credentials/:credential_id`, where attaching a credential that breaks the rule is rejected with `409 Conflict`. The playbook, the inventory and every credential a job template names must belong to the template's own organization. Creating or updating a template, or attaching a credential, is rejected with `400` when one of them does not exist in that organization, the `detail` of the error says which one was not found, and nothing is stored. Deleting a job template also deletes the jobs launched from it and the schedules that target it.

### Launching from Repository Pushes

Job templates can opt into launching automatically when the playbook's repository receives a push, from both GitHub and Azure DevOps webhooks. See the [changelog](./changelog.md) for this and the other job template controls (multiple credentials, timeouts, concurrency, job slicing, and provisioning callbacks).

### Notifications

Notification templates deliver job events over webhook, email (SMTP), or Microsoft Teams. Each template attachment chooses whether it fires when a job starts, succeeds, or fails.

A notification template's `type` is `webhook`, `email` or `teams`, and any other value is rejected with `400`. Its `config` depends on the type: a webhook takes `url`, `method`, `headers`, `username` and `skip_tls_verify`, an email channel takes `host`, `port`, `username`, `from`, `to` and `use_tls`, and a Teams channel takes `url`. The optional `secret`, which is the basic-auth password of a webhook or the SMTP password, is stored encrypted and is never returned: a template reports only whether it has one. `POST /api/v2/ansible/notification-templates/:id/test` delivers a test message over the channel. An attachment binds a template to one job template or one workflow. Its `on_started`, `on_success` and `on_failure` flags are stored as sent, so an attachment can fire on start only, and a flag that is left out defaults to on for `on_success` and `on_failure` and to off for `on_started`.

### Access Control and Activity

Ansible resources follow the platform's team-based access control, and the job template page shows which teams can view, edit, and execute it. Jobs can run on self-hosted runners through agent pools. Organization activity, including Ansible jobs, appears in [Usage & Analytics](../../user-guides/usage-analytics.md).

Hosts, groups and inventory sources take their access from the inventory they belong to. Reading one requires read permission on that inventory, and creating, updating or deleting one, or starting a source sync, requires write permission on it. For an inventory that belongs to no project, those are the organization's Ansible read and manage permissions. `GET /api/v2/ansible/job-templates/:id/access` returns the team summary shown on the job template page, derived from each team's organization and project access.

## Not Yet Available

These gaps are known and are not supported today:

- **Visual workflow builder**: workflow nodes and edges are managed through the API; the Workflows page creates, lists, and launches workflows, but there is no drag-and-drop graph editor.
- **Nested workflows**: a workflow node that runs another workflow fails when the workflow reaches it.
- **Survey prompts at launch**: a workflow can store a survey definition, but launches do not prompt for survey answers. Pass values as extra vars instead.
- **Fact caching**: `use_fact_cache` and stored host facts are not supported.
- **Slack notifications**: there is no Slack channel type.
- **Custom credential types**: credentials use the built-in types only.
- **Push-based output**: the job page polls for new events; there is no WebSocket stream.
