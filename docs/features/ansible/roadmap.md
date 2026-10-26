---
description: "Reference job-event queries, credential boundaries, workflow configuration, notifications and current Ansible limits."
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
capabilities: [
  {
    "id": "ansible-credentials",
    "name": "Credentials and multiple vaults",
    "summary": "Store built-in credential types and attach multiple credentials, including distinct vault IDs, to templates.",
    "area": "ansible",
    "availability": "available",
    "limitations": "One credential per type, except vault credentials with distinct vault IDs. Custom credential types are not supported.",
    "evidence": [
      "core/services/ansible/credential.go",
      "core/repository/ansible_playbook.go",
      "backend/cmd/ansible-runner/main.go",
      "backend/cmd/ansible-runner/agent_mode.go"
    ]
  },
  {
    "id": "ansible-notifications",
    "name": "Job and workflow notifications",
    "summary": "Send start, success and failure notifications over webhook, email or Microsoft Teams.",
    "area": "ansible",
    "availability": "available",
    "limitations": "Private webhook and Teams destinations require an operator opt-in. There is no Slack channel type.",
    "evidence": [
      "core/services/ansible/notifications.go",
      "core/services/ansible/notifications_test.go",
      "backend/internal/api/v2/handlers/ansible/notification_attachment_flags_test.go"
    ]
  }
]
---

# Ansible integration reference

Use this page for job events, credentials, workflow configuration and notification
behavior. Browse the [generated Ansible catalogue](./README.md) for supported capabilities
and their task guides. Unsupported behavior is listed [below](#not-yet-available); this
reference does not promise future delivery dates.

## Read job output and events

The job page offers a host-by-task matrix, timeline and chronological stream over the same
recorded events. Status filters, host/task search and a shared detail drawer let you move
from a failed host to its task result. Output that cannot be structured remains in the stream.
The page polls during execution; it is not a WebSocket feed.

For programmatic reads, set the API origin, token and job ID. This example reads one page
of failed results for a host:

```bash
curl --fail-with-body --get \
  --header "Authorization: Bearer $STACKWEAVER_TOKEN" \
  --data-urlencode 'filter[host]=web-01' \
  --data-urlencode 'filter[status]=failed' \
  --data-urlencode 'page[number]=1' --data-urlencode 'page[size]=100' \
  "$STACKWEAVER_API_URL/api/v2/ansible/jobs/$JOB_ID/events"
```

| Read option | Behavior |
|---|---|
| Paging | Events are ordered by counter. `meta.pagination.total-count` counts the filtered results. |
| `after` | Return counters greater than this value, up to 2,000 events, without a pagination block. Continue from the last received counter. |
| `filter[host]`, `filter[task]` | Match the inventory host or exact task name. |
| `filter[counter]` | Fetch one event, including full detail when you have its counter. |
| `filter[status]` | One of `ok`, `changed`, `failed`, `unreachable`, `skipped`. Other values return `400`. |
| `fields[events]=summary` | Reduced payload for large runs; other field selections return `400`. |

Filters combine with one another, `after` and paging. A per-host result carries its module
return under `event-data.hosts.<host>`. The output endpoint concatenates only the first
10,000 events; use the paged events endpoint for longer jobs.

### Large-run summary payloads

The UI uses summaries above 5,000 events and fetches a full event when opened. A summary
has empty `stdout` and `stderr` and is marked `summary: true`.

It retains callback identity/timestamp, task/play identity and duration, recap statistics,
and per-host action/outcome flags, return code, attempts, skip reason and a message capped
at 200 characters. Gathered facts, module arguments, loop results and diffs are omitted.
Use the event counter to retrieve the full event when those details matter.

## Credentials and inventory boundaries

Credential types are `ssh`, `machine-ssh`, `vault`, `aws`, `azure`, `gcp` and `vmware`.
Unknown types and the unsupported `scm` type are rejected. Configure repository access through a VCS connection, not an Ansible SCM credential. Responses expose presence flags for SSH keys, passwords,
vault passwords and become passwords, not the secret values themselves.

| Operation | Constraint |
|---|---|
| Template credential set | One credential per type, except multiple vault credentials with distinct vault IDs. |
| Create a template with `credentials` | Attach the supplied set. |
| Update with `credentials` | Replace the set; an empty array clears it and omission preserves it. |
| Attach one credential | Use the template credentials relationship endpoint. A type/vault-ID conflict returns `409`. |
| Delete a credential | Existing jobs that used it block deletion with `409`. Otherwise it is removed from templates, inventory sources and workflow nodes that referenced it. |
| Delete a job template | Its jobs and targeting schedules are also deleted. |

> [!WARNING]
> Credential deletion can detach it from future automation even when no old job blocks it.
> Template deletion removes execution history. Review dependents before either action.

A template's playbook, inventory and credentials must belong to its organization. Likewise,
a VCS inventory's connection belongs to that inventory's organization, and a nested group's
parent belongs to the same inventory. Invalid references return `400` and store nothing.
Hosts, groups and sources inherit access from the enclosing inventory: reads require read
access, and mutation or source sync requires write access. Unprojected inventories use the
organization's Ansible permissions.

The template's **Access** view summarizes team access from its organization/project rules.
Use [Execution flows](./execution-flows.md#configure-and-launch-a-template) for Terraform
settings and launch examples, and [Dynamic inventories](../../user-guides/dynamic-inventories.md)
for source authentication and reconciliation.

## Workflows

Configure the graph through the API, then launch and inspect runs through the UI or API.
The engine follows success/failure/always edges, supports any-parent/all-parents convergence
and can pause for approval. Node overrides win when merged with workflow variables.

| Configuration | Accepted values and rules |
|---|---|
| Node type | `job_template`, `workflow`, `inventory_sync`, `approval`. Nested workflow execution is unsupported even though the type can be stored. |
| Edge condition | `on_success`, `on_failure`, `always`. |
| Configuration `extra-vars` | A JSON object encoded as a string. Nonempty invalid JSON and arrays are rejected. Launch-time overrides instead use an object in the launch document. |
| Workflow/node PATCH | Supplied fields change; explicit empty string, `false` or `0` are stored. Empty `extra-vars` clears variables. |
| Name | Required; an empty name is rejected. |
| Relationships | UUIDs in the same organization. Invalid IDs, missing/foreign references or edges outside the selected graph are refused without storing a change. |

The workflow's project/inventory, node job template/inventory/credential and both edge
endpoints must satisfy those boundaries. Approval nodes support approve/deny and an optional
timeout that denies. Graph edits after launch do not rewrite the running graph snapshot.

| Task | API operation |
|---|---|
| List/create workflows | `GET/POST /organizations/{name}/ansible/workflows` |
| Read/update/delete workflow | `GET/PATCH/DELETE /ansible/workflows/{id}` |
| Manage nodes and edges | Workflow `nodes` and `edges` endpoints; node PATCH/DELETE and edge DELETE endpoints. |
| Launch/list workflow runs | Workflow `launch` and `jobs` endpoints. |

Paths are relative to `/api/v2`. See the [API explorer](/docs/api-reference/explorer) for
operation schemas and [workflow launch example](./execution-flows.md#follow-a-workflow)
for the body shape, permissions and completion checks. There is no workflow YAML import
or drag-and-drop graph editor in this interface.

## Notifications

Notification templates send webhook, SMTP email or Microsoft Teams messages. Attach one
to a job template or workflow and choose whether it fires at start, success or failure.

| Channel | Non-secret `config` fields |
|---|---|
| `webhook` | `url`, `method`, `headers`, `username`, `skip_tls_verify` |
| `email` | `host`, `port`, `username`, `from`, `to`, `use_tls` |
| `teams` | `url` |

Use `secret` for the webhook basic-auth password or SMTP password. It is encrypted at rest
and not returned as a readable value; responses report whether one exists. Unsupported
channel types are rejected.

### Manage notifications with Terraform

Configure the native [Stackweaver provider](../../user-guides/terraform-provider.md) for
the organization, then add a channel and attachment to your management configuration:

```hcl
variable "job_template_id" { type = string }

resource "stackweaver_ansible_notification_template" "operations" {
  name = "Operations webhook"
  type = "webhook"
  config = jsonencode({
    url    = "https://hooks.example.com/ansible"
    method = "POST"
  })
}

resource "stackweaver_ansible_notification_attachment" "operations" {
  notification_template_id = stackweaver_ansible_notification_template.operations.id
  job_template_id          = var.job_template_id
  on_started               = true
  on_success               = true
  on_failure               = true
}
```

The channel's organization comes from provider configuration. For a workflow, set
`workflow_id` instead of `job_template_id`; choose exactly one target. Review a plan and
apply it to an authorized test target, then verify delivery. Protect Terraform state if
you set the resource's sensitive `secret` field. Do not create duplicate channels when
adopting resources already managed through another interface.

### Create and attach a webhook notification

Use an authorized token and an HTTPS receiver you control. Save this as `notification.json`,
replacing the endpoint and name:

```json
{
  "data": {
    "type": "ansible-notification-templates",
    "attributes": {
      "name": "Operations webhook",
      "notification-type": "webhook",
      "config": {"url": "https://hooks.example.com/ansible", "method": "POST"}
    }
  }
}
```

```bash
curl --fail-with-body --request POST \
  --header "Authorization: Bearer $STACKWEAVER_TOKEN" \
  --header 'Content-Type: application/vnd.api+json' \
  --data-binary @notification.json \
  "$STACKWEAVER_API_URL/api/v2/organizations/$ORG/ansible/notification-templates"
```

Set `NOTIFICATION_ID` to the returned template ID. The test action sends a **real message**;
use a receiver you control and confirm delivery before attaching production automation:

```bash
curl --fail-with-body --request POST \
  --header "Authorization: Bearer $STACKWEAVER_TOKEN" \
  "$STACKWEAVER_API_URL/api/v2/ansible/notification-templates/$NOTIFICATION_ID/test"
```

Save `attachment.json` with actual template IDs from the same organization:

```json
{
  "data": {
    "type": "ansible-notification-attachments",
    "attributes": {"on-started": true, "on-success": true, "on-failure": true},
    "relationships": {
      "notification-template": {"data": {"type": "ansible-notification-templates", "id": "replace-with-notification-id"}},
      "job-template": {"data": {"type": "ansible-job-templates", "id": "replace-with-job-template-id"}}
    }
  }
}
```

```bash
curl --fail-with-body --request POST \
  --header "Authorization: Bearer $STACKWEAVER_TOKEN" \
  --header 'Content-Type: application/vnd.api+json' \
  --data-binary @attachment.json \
  "$STACKWEAVER_API_URL/api/v2/organizations/$ORG/ansible/notification-attachments"
```

Attach to exactly one job template or workflow. The flags are independent; omitted flags
default to success/failure on and started off. Read back the attachment, run a controlled
test and inspect the receiver. A channel definition alone is not an active attachment.
The native Terraform resources above and these API operations configure the same channel
and attachment types. Deployment YAML configures service policy,
not these organization-scoped notification resources.

### Delivery boundaries and inventory warnings

Webhook and Teams receivers must resolve to public addresses, including after redirects.
Private or link-local targets are refused when connecting. `skip_tls_verify` affects TLS
certificate verification, not destination restrictions. For a deliberate internal receiver,
use the operator opt-in described in [Environment variables](../../get-started/self-hosting/environment-variables.md).

A job using inventory that failed to refresh includes warnings in every message, including
started and successful notifications. The payload carries human-readable `warnings` and
structured `extra.inventory_sync_warnings`. Email subjects add **(with warnings)** and
successful Teams notifications use amber. Read those warnings before treating success as
proof of fresh inventory. See [inventory sync failures](../../user-guides/dynamic-inventories.md#when-an-update-on-launch-sync-fails).

## Not yet available

- **Nested workflows:** a workflow node that invokes another workflow fails when reached.
- **Launch-time survey prompts:** a stored survey definition is not an interactive launch form;
  pass explicit extra variables instead.
- **Fact caching:** `use_fact_cache` and stored host facts are unsupported.
- **Slack notifications:** no Slack channel type.
- **Custom credential types:** use the built-in types above.
- **Visual workflow graph editor:** create graph nodes and edges through the API.
- **Push-based job output:** the job page polls recorded events.

For repository dependencies, use [Galaxy collections](./galaxy-collections.md). For webhook
launching and runner selection, use [Execution flows](./execution-flows.md). Organization
activity is covered by [Usage and analytics](../../user-guides/usage-analytics.md).
