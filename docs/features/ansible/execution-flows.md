---
description: "How Ansible execution works in Stackweaver: job lifecycle and launch gates, how launchers claim and place jobs on hosted capacity and agent pools, inventory syncs, workflows, ad hoc commands, and webhook triggers - with flow diagrams"
covers:
  - "backend/cmd/ansible-runner/**"
  - "backend/internal/launcher/**"
  - "backend/internal/executor/**"
  - "core/services/ansible/**"
  - "core/repository/ansible_*"
  - "core/models/ansible_schedule*"
  - "backend/internal/api/v2/handlers/ansible/**"
  - "backend/internal/api/v2/handlers/runner_agent.go"
  - "backend/internal/api/v2/handlers/vcs_app_installation.go"
capabilities: [
  {
    "id": "ansible-job-execution",
    "name": "Job templates and execution",
    "summary": "Reuse launch settings, apply timeout and concurrency controls, split hosts into slices, and inspect task output in matrix, timeline or stream views.",
    "area": "ansible",
    "availability": "available",
    "limitations": "Job output is polled while the job runs. A disabled template refuses every launch path.",
    "evidence": [
      "core/services/ansible/job.go",
      "core/services/ansible/inventory_slice_test.go",
      "frontend/src/pages/Ansible/run-viewer/adapter.test.ts",
      "backend/cmd/ansible-runner/main.go",
      "backend/internal/executor/ansibleexec/run.go"
    ]
  },
  {
    "id": "ansible-schedules",
    "name": "Scheduled automation",
    "summary": "Schedule job templates, inventory-source syncs and workflows.",
    "area": "ansible",
    "availability": "available",
    "limitations": "Use a dedicated inventory-source schedule. The source form's Sync Schedule field does not activate recurring syncs. Playbook-sync scheduling is not supported.",
    "evidence": [
      "core/services/ansible/scheduler.go",
      "core/models/ansible_schedule.go"
    ]
  },
  {
    "id": "ansible-workflows",
    "name": "Workflows and approvals",
    "summary": "Chain jobs, inventory syncs and approval gates with success/failure branches and convergence rules.",
    "area": "ansible",
    "availability": "available",
    "limitations": "Configure graph nodes and edges through the API. Nested workflows and launch-time survey prompts are not supported.",
    "evidence": [
      "core/services/ansible/workflow_engine.go",
      "core/services/ansible/workflow_referents_test.go",
      "frontend/src/pages/Ansible/Workflows.tsx"
    ]
  },
  {
    "id": "ansible-webhook-launches",
    "name": "Repository-triggered jobs",
    "summary": "Launch an opted-in job template from a GitHub or Azure DevOps push.",
    "area": "ansible",
    "availability": "available",
    "limitations": "Fresh mode captures branch HEAD in a snapshot sync before the job runs; it does not pin the webhook commit. Cached mode can race snapshot synchronization.",
    "evidence": [
      "backend/internal/api/v2/handlers/vcs_app_installation.go",
      "backend/internal/api/v2/handlers/vcs_push_ansible_sync_test.go"
    ]
  },
  {
    "id": "ansible-callbacks",
    "name": "Provisioning callbacks",
    "summary": "Let a provisioned host request a template launch limited to that host.",
    "area": "ansible",
    "availability": "available",
    "limitations": "The template must allow callbacks and the requesting host must already be in its inventory.",
    "evidence": [
      "backend/internal/api/v2/handlers/ansible/callbacks.go",
      "backend/internal/api/v2/handlers/ansible/callback_tagged_address_test.go"
    ]
  },
  {
    "id": "ansible-agent-pools",
    "name": "Self-hosted Ansible execution",
    "summary": "Run jobs and ad hoc commands on agents that can reach your private hosts.",
    "area": "ansible",
    "availability": "available",
    "limitations": "Choose the pool on the job template or ad hoc launch, or set a project or organization default. Snapshot syncs, VCS inventory syncs and constructed rebuilds execute on the hosted capacity.",
    "evidence": [
      "core/services/ansible/job.go",
      "backend/internal/launcher/launcher.go",
      "backend/internal/api/v2/handlers/runner_agent.go"
    ]
  }
]
---
# Understand Ansible execution

Follow a job from launch to output, choose where it executes, and understand why it may wait.
The same execution model connects manual jobs, schedules, workflows, ad hoc commands and
repository triggers. Use the diagrams below to locate the stage you need to investigate.

## Where the work runs

Stackweaver's Ansible engine is built from a small number of cooperating services. The API owns all state and decisions; launchers only claim work and place it. Every job and every sync is a row in PostgreSQL that waits for a launcher of its pool, which is either the organization's hosted pool, served by the installation's own launchers, or an agent pool whose launchers run in your network. Launchers reach the API over HTTPS only and hold no database, storage or Redis credential.

```mermaid
flowchart LR
    UI["Web UI / API clients"] --> API["API server"]
    GH["GitHub / Azure DevOps webhooks"] --> API
    CB["Provisioned hosts (callbacks)"] --> API
    API --> PG[("PostgreSQL")]
    API -.->|"wakeups"| Redis[("Redis")]
    Hosted["Hosted launcher"] -->|"heartbeat, claim, job token over HTTPS"| API
    Agent["Launcher in an agent pool"] -->|"heartbeat, claim, job token over HTTPS"| API
    Hosted --> E1["Executor in a job container or pod"]
    Agent --> E2["Executor (in-process, container or pod)"]
    E1 -->|"inputs, events, result"| API
    E2 -->|"inputs, events, result"| API
    API -.->|"scheduler tick (30s)"| API
```

<details>
<summary><strong>Components (Legend)</strong></summary>

1. **API server** - owns every decision: launch gates, RBAC, variable merging, workflow progression, notification dispatch. Runs the scheduler tick, and is the only service that reads and writes the database and object storage on a job's behalf.
2. **PostgreSQL** - jobs, syncs, events, inventories, sync history, workflow state. A job or sync waiting for a launcher is a row with its pool, not a queue message.
3. **Redis** - carries wakeups, so a launcher holding an open heartbeat is answered as soon as work for its pool appears. No launcher connects to it.
4. **Launcher** - the `stackweaver-ansible-runner` image, on the hosted capacity or in an agent pool. It keeps one heartbeat open, is offered work for its pool up to its free capacity, claims a job atomically and asks the API for a token valid for that job alone.
5. **Executor** - placed by the launcher's driver as a child process, a container or a pod. It fetches the job's inputs with the job token, installs Galaxy requirements, runs `ansible-playbook`, and posts events and the result back.
6. **Scheduler tick** - a 30-second loop inside the API that runs schedules, releases held jobs, advances workflows, dispatches notifications, and cleans up expired jobs.

</details>

## Why a launched job can wait

A disabled template rejects a launch with `409`; it does not create a held job. Inventory
dependencies and concurrency limits can hold an otherwise valid job until the blocking
condition clears. The scheduler rechecks held jobs periodically.

```mermaid
flowchart TD
    L1["UI / API launch"] --> GATE
    L2["Schedule"] --> GATE
    L3["Workflow node"] --> GATE
    L4["VCS push (launch on webhook)"] --> GATE
    L5["Provisioning callback"] --> GATE
    L6["Ad hoc command"] --> GATE
    GATE{"Template disabled?"} -->|yes| REJ["409 rejected"]
    GATE -->|no| VARS["Merge variables<br/>(platform → sets → template → launch)"]
    VARS --> DEP{"Inventory dependencies stale?<br/>(update-on-launch sources,<br/>constructed rebuild)"}
    DEP -->|yes| SYNC["Queue syncs + HOLD job"]
    DEP -->|no| CONC{"Concurrency gate?<br/>(allow_simultaneous off +<br/>active run exists)"}
    CONC -->|yes| HOLD["HOLD job"]
    CONC -->|no| DISPATCH
    SYNC --> TICK["Scheduler tick releases<br/>when syncs settle"]
    HOLD --> TICK
    TICK --> DISPATCH{"Agent pool on the template,<br/>project or organization?"}
    DISPATCH -->|no| HOSTED["Offer to the hosted pool's launchers"]
    DISPATCH -->|yes| POLL["Offer to that pool's launchers"]
```

<details>
<summary><strong>Gate details (Legend)</strong></summary>

1. **Disabled gate** - a disabled template refuses every launch path with 409, including schedules and callbacks.
2. **Variable merge** - platform variables, then variable sets, then template variables, then launch-time overrides; later layers win.
3. **Dependency gate** - inventory sources with *update on launch* whose cache window lapsed are synced first; constructed inventories rebuild from their inputs. The job stays held until no dependency sync is running (a sync stuck longer than 30 minutes stops blocking).
4. **Concurrency gate** - without *allow simultaneous*, one run per template at a time; the check-then-create runs under a per-template database lock so concurrent launches cannot both pass. Sliced jobs skip this gate by design.
5. **Release** - the scheduler tick re-evaluates held jobs every 30 seconds and dispatches the ones whose gates cleared. A dependency sync that failed (or stopped blocking after 30 minutes) does not fail the job: it runs on the source's last successful hosts, and before it is dispatched the API records the source on the job (`inventory-sync-warnings`) and writes the notice as the job's first output event, which the job's own output follows. See [Dynamic inventories](../../user-guides/dynamic-inventories.md#when-an-update-on-launch-sync-fails).

</details>

Job slicing happens at launch: a template with a slice count above one fans out into N jobs, each receiving a deterministic subset of the inventory's hosts (sorted, distributed round-robin). Slices run simultaneously and are grouped under one slice group.

> [!IMPORTANT]
> A failed update-on-launch inventory sync does not necessarily fail the job. Once its
> dependency gate clears, the job can use the last successful hosts and carry a warning.
> A sync still running after 30 minutes can stop blocking. Review the recorded warning
> and inventory freshness before trusting the job's result.


## Configure and launch a template

### Declare launch settings with Terraform

Configure the [Stackweaver provider](../../user-guides/terraform-provider.md), then manage
an existing template or create one from existing resources in the same organization:

```hcl
variable "project_id" { type = string }
variable "playbook_id" { type = string }
variable "inventory_id" { type = string }

resource "stackweaver_ansible_job_template" "baseline" {
  organization       = "example-platform"
  name               = "Production baseline"
  project_id         = var.project_id
  playbook_id        = var.playbook_id
  inventory_id       = var.inventory_id
  enabled            = true
  timeout_seconds    = 1800
  allow_simultaneous = false
  job_slice_count    = 1
}
```

This manages the template, not an execution. Import an existing template before adopting
it into a new Terraform configuration, review the plan and apply it. Credentials are
attached through the provider's template-credential attachment resource shown below or the template's UI/API.
For an existing stored credential, add this attachment to the same configuration:

```hcl
variable "credential_id" { type = string }

resource "stackweaver_ansible_job_template_credential" "baseline" {
  job_template_id = stackweaver_ansible_job_template.baseline.id
  credential_id   = var.credential_id
}
```

The credential must belong to the same organization. Creating a credential alone does not
attach it to a template. The [API explorer](/docs/api-reference/explorer) provides the
complete launch schema.

### Launch once through the API

Use a token allowed to execute the template. Set the API origin, token and `TEMPLATE_ID`.
Save this as `launch.json`:

```json
{
  "data": {
    "type": "ansible-jobs",
    "attributes": {
      "extra-vars": {"deployment_environment": "production"},
      "limit": "web",
      "tags": "configure"
    }
  }
}
```

```bash
curl --fail-with-body --request POST \
  --header "Authorization: Bearer $STACKWEAVER_TOKEN" \
  --header 'Content-Type: application/vnd.api+json' \
  --data-binary @launch.json \
  "$STACKWEAVER_API_URL/api/v2/ansible/job-templates/$TEMPLATE_ID/launch"
```

With no body, or an empty object, this endpoint uses the template's launch values. Overrides
belong under `data.attributes`, not top-level snake-case fields. Invalid documents return
`400` and launch nothing. Check the returned job ID and status, then inspect its output.

| Launch field | Effect on this execution |
|---|---|
| `extra-vars` | Merge keys over template variables. Unmentioned keys keep their values. |
| `limit`, `tags`, `skip-tags` | Replace the template value. An explicit empty string clears it; omission preserves it. |
| Template credentials | Copied onto the launched job. Editing the template later does not change that job. |

Every slice receives the same overrides. Relaunching a job uses that original job's
configuration and credentials, rather than silently substituting today's template values.
A direct organization job launch can also carry a `credentials` relationship; each named
credential must belong to that organization or the request is refused.

### Inspect the queue

Set `ORG` to the organization name, then read its pending/running jobs, oldest first:

```bash
curl --fail-with-body \
  --header "Authorization: Bearer $STACKWEAVER_TOKEN" \
  "$STACKWEAVER_API_URL/api/v2/organizations/$ORG/ansible/jobs/queue"
```

For a sliced launch, list project jobs with `filter[slice-group-id]` set to the slice-group
ID. That query returns the group's slices together in slice order. There is no management
YAML object that replaces template registration or a launch request. Your playbook YAML
still defines what Ansible executes.

<a id="choose-platform-or-self-hosted-execution" style="scroll-margin-top: 7rem"></a>

## Choose hosted or self-hosted execution

Every job takes the same path, whether its pool is the organization's hosted capacity or an agent pool in your network. What differs between pools is only where the launcher runs and which driver it uses.

| | Hosted capacity | Agent pool |
|---|---|---|
| Who runs the launchers | The installation (the `ansible-launcher` service on Docker Compose, the Ansible launcher Deployment on Kubernetes) | You, on your own hosts or cluster |
| Which jobs it gets | Jobs whose template, project and organization name no agent pool, every snapshot capture, VCS inventory file sync and constructed rebuild, and dynamic source syncs without an agent pool default | Jobs whose template targets the pool, or whose project or organization defaults to it |
| Driver | Container or Kubernetes | In-process, container or Kubernetes |
| Network position | Inside the Stackweaver deployment | Anywhere with outbound HTTPS to the API |

### Follow a job through a launcher

```mermaid
sequenceDiagram
    participant Launcher
    participant API
    participant DB as PostgreSQL
    participant Executor
    loop long-poll heartbeat
        Launcher->>API: heartbeat (pool, free capacity)
        API->>DB: released jobs and syncs of this pool (bounded by free capacity)
        API-->>Launcher: offers (when work appears, or the poll interval ends)
    end
    Launcher->>API: POST job start (atomic claim)
    API-->>Launcher: 200 claimed / 409 already taken, skip
    Launcher->>API: POST job token
    API-->>Launcher: token valid for this job and attempt only
    Launcher->>Executor: place (in-process, container or pod) with the job token
    Executor->>API: GET job artifacts
    API-->>Executor: inventory (sliced), credentials, vault passwords,<br/>env vars, per-run identity tokens, playbook source, cache descriptor
    Executor->>API: GET playbook snapshot
    API-->>Executor: snapshot tarball (streamed from object storage)
    Note over Executor: install requirements.yml<br/>(from the organization's verified cache first)
    Executor->>API: POST source banner + Galaxy install events
    Executor->>Executor: ansible-playbook
    Executor->>API: POST events + final status
```

<details>
<summary><strong>What the flow guarantees (Legend)</strong></summary>

1. **Held jobs apply everywhere** - a launcher is only offered jobs that the gates have released, so concurrency limits and dependency syncs behave the same on every pool.
2. **Credential handling** - the executor alone receives decrypted job credentials in the artifacts response. It writes them with owner-only permissions into a directory that exists for that job and removes them on every exit path, and the job token is refused once the job has finished. Protect the hosts your launchers run on; cleanup is not a guarantee against host access or an interrupted process.
3. **Every job starts from a snapshot** - a `cached` playbook runs its last synced snapshot. A `fresh` playbook, and a `cached` one that has not been synced yet, is captured by a snapshot sync on the hosted capacity first, and the job waits for it. No job clones from your VCS provider, so launchers never need a route to it or a VCS credential.
4. **Ad hoc commands** - the transient playbook is generated server-side and shipped as content in the artifacts, so no repository access is needed.
5. **Job claiming** - the API limits offered work to each launcher's free capacity and atomically claims a job on start. A launcher that loses the claim skips it; this prevents that claim race from starting the same job or slice twice.
6. **A lost launcher** - if a launcher disappears while a job runs, the job ends as errored with "runner lost during job", because a playbook may not be safe to run twice; relaunch it to run a new attempt. A sync is offered again as a new attempt. The token of an earlier attempt is refused.
7. **Choosing the path** - set an agent pool on the job template (or pick one in the Run Command dialog), or a default on the project or organization; leave them all empty to run on the hosted capacity.

</details>

## Follow an inventory sync

Every way an inventory can refresh becomes a sync that a launcher claims like a job, and lands in the same sync history (the Syncs tab), each run with its captured output. Long syncs can be tailed live: the sync's output is flushed to the run's history row every couple of seconds while it executes, and the output dialog polls while a run is active. Use these read operations, with your inventory or sync ID:

| API operation | Result |
|---|---|
| `GET /api/v2/ansible/inventories/{id}/syncs` | Newest sync runs first, without output. |
| `GET /api/v2/ansible/inventory-syncs/{sync_id}` | One run including its `output`. |

```mermaid
flowchart TD
    T1["Manual sync / Rebuild button"] --> Q["Sync work item"]
    T2["Schedule"] --> Q
    T3["VCS push webhook"] --> Q
    T4["Update-on-launch (job launch)"] --> Q
    T5["Workflow sync node"] --> ENG["runs in API"]
    Q --> R["Ansible launcher places it"]
    R --> B1["VCS file inventory (hosted, platform image):<br/>clone repo, parse file"]
    R --> B2["Dynamic source (its pool and image):<br/>ansible-inventory with cloud plugin"]
    R --> B3["Constructed inventory (hosted, platform image):<br/>export inputs, apply rules"]
    B1 --> REC["Reconcile hosts/groups in DB"]
    B2 --> REC
    B3 --> REC
    REC --> HIST["Sync history row<br/>(status, trigger, counts, output)"]
```

<details>
<summary><strong>Reconciliation semantics (Legend)</strong></summary>

1. **Source ownership** - dynamic sources stamp the hosts and groups they discover. With *overwrite* on, a source prunes only its own rows when the provider stops reporting them; manual entries and other sources' rows are never touched.
2. **Where syncs run** - a VCS inventory file sync and a constructed rebuild always run on the hosted capacity in the platform image, with the only clone credential held in that sync's memory. A dynamic source sync runs on the project's or organization's default agent pool when one is set, otherwise on the hosted capacity, in the execution environment and with the identity binding its source resolves, bounded by its sync timeout.
3. **A failed run reconciles nothing** - for a dynamic source sync and for a constructed inventory build, the sync tells `ansible-inventory` to exit non-zero when it cannot parse any one of the sources it was given (rejected credentials, an unreachable endpoint, a configuration the plugin refuses, an input it cannot read). Such a run is recorded as failed with the plugin's error in its output, and the rows stay as the last successful run left them. A run that succeeds with no hosts is a different outcome: with *overwrite* on it prunes everything the source owned.
4. **Variable merging** - by default synced host variables merge into existing ones (your manual keys survive); *overwrite variables* switches to wholesale replacement.
5. **Constructed inventories** - are derived-only: their hosts and groups come from the build alone, and every successful rebuild replaces the materialized set from the inputs and rules. The API refuses to add a host, a group or an inventory source to a constructed inventory, to add a host to one of its groups, or to move one of its groups under another, so every row a rebuild removes is one it derived. A host or group can still be deleted, and the next rebuild derives it again if the inputs and rules still produce it.
6. **History and live tail** - each run records who triggered it (manual, schedule, launch, workflow, webhook), host/group counts, duration, and the full diagnostics; raise the source's verbosity for more detail.

</details>

<a id="workflow-execution" style="scroll-margin-top: 7rem"></a>

## Follow a workflow

Launching a workflow snapshots its graph and creates a run; from there the scheduler tick advances execution. Nodes start when their parents finish with a matching edge condition, approval nodes pause the run until a human decides, and the run rolls up once no node can advance.

```mermaid
flowchart TD
    LAUNCH["Launch (UI, API, or schedule)"] --> SNAP["Snapshot graph into a run"]
    SNAP --> ROOT["Start root nodes"]
    ROOT --> TICKLOOP["Scheduler tick"]
    TICKLOOP --> DONE{"Node finished?"}
    DONE -->|on_success / on_failure / always| NEXT["Evaluate child edges"]
    NEXT --> CONV{"Convergence: any parent<br/>or all parents?"}
    CONV -->|satisfied| START["Claim + start child node"]
    START --> KIND{"Node type"}
    KIND -->|job template| JOB["Launch job (full gates)"]
    KIND -->|approval| APPR["Wait for approve/deny<br/>(timeout denies)"]
    KIND -->|inventory sync| ISYNC["Sync the source"]
    JOB --> TICKLOOP
    APPR --> TICKLOOP
    ISYNC --> TICKLOOP
    TICKLOOP --> ROLLUP["All terminal → run successful/failed"]
```

<details>
<summary><strong>Engine guarantees (Legend)</strong></summary>

1. **Snapshot** - edits to the workflow after launch never affect a running run.
2. **Single start** - nodes are claimed atomically, so a tick racing an approval click cannot start the same node twice.
3. **Skipped paths** - when an edge condition is not met, the unreachable subtree is marked skipped rather than left dangling.
4. **Approvals** - pending approvals surface in the run dialog with Approve/Deny; an optional timeout auto-denies.
5. **Organization boundary** - a node starts only when everything it names belongs to the workflow's organization. A node that names anything else fails without starting a job or a sync, and the run follows its failure edges.

</details>

Launching a workflow and approving/denying an approval node require job-execution permission
in its project. A launch without a body uses the workflow's variables. To override keys,
save this as `workflow-launch.json`:

```json
{
  "data": {
    "type": "ansible-workflow-jobs",
    "attributes": {"extra-vars": {"deployment_environment": "production"}}
  }
}
```

```bash
curl --fail-with-body --request POST \
  --header "Authorization: Bearer $STACKWEAVER_TOKEN" \
  --header 'Content-Type: application/vnd.api+json' \
  --data-binary @workflow-launch.json \
  "$STACKWEAVER_API_URL/api/v2/ansible/workflows/$WORKFLOW_ID/launch"
```

Unlike a template launch, an empty object is not a valid supplied workflow body. A malformed
document or non-object `extra-vars` returns `400` without a run. A workflow whose own project
or inventory lies outside its organization is refused with `409`. Check the returned run
and each node's result rather than treating launch acceptance as completion.

Configure graph nodes and edges through the API; the UI creates, lists and launches
workflows but has no drag-and-drop graph editor. Nested workflows and launch-time survey
prompts are not supported. See the [Ansible integration reference](./roadmap.md#workflows)
for graph fields and validation. The graph is not a playbook YAML file.

## Run an ad hoc command

Run Command executes a single module against an inventory without a playbook or template. The platform generates a one-task playbook from the module and arguments and pushes it through the normal job pipeline, so ad hoc runs get live output, events, and statistics like any job, on the hosted capacity or any agent pool.

```mermaid
flowchart LR
    RC["Run Command dialog"] --> ALLOW{"Module in org allowlist?"}
    ALLOW -->|no| DENY["400 rejected"]
    ALLOW -->|yes| PERM{"ansible:adhoc:execute?"}
    PERM -->|no| FORBID["403 rejected"]
    PERM -->|yes| GEN["Generate transient playbook<br/>(action: module + args)"]
    GEN --> PIPE["Normal job pipeline<br/>(gates, dispatch, events)"]
```

The allowed modules are an organization setting (Settings → Ansible), defaulting to AWX's list, and the permission is distinct from template execution so you can grant ad hoc access separately.

The API command is:

```text
POST /api/v2/ansible/inventories/{id}/actions/run-command
```

The job runs under the project named by the optional `project-id` attribute. Without it the job runs under the inventory's own project, or under the organization's `default` project when the inventory belongs to none. The credential, the agent pool and the project the request names must belong to the inventory's organization: one that does not exist there is rejected with `400`, and the detail says which one was not found.

## Webhook Triggers

Two unauthenticated-by-design entry points exist, both validated by their own secret:

```mermaid
flowchart TD
    PUSH["Git push (GitHub / Azure DevOps)"] --> WH["Webhook endpoint<br/>(signature verified)"]
    WH --> S1["Sync affected playbooks<br/>and VCS inventories"]
    WH --> S2["Launch templates with<br/>launch on webhook enabled"]
    HOST["Freshly provisioned host"] --> CBEP["Callback endpoint<br/>(host config key, constant-time)"]
    CBEP --> MATCH{"Caller IP in the<br/>template's inventory?"}
    MATCH -->|yes| CBJOB["Launch job limited to that host"]
    MATCH -->|no| CBDENY["400 rejected"]
```

For *launch on webhook*, `fresh` source mode captures the selected branch's HEAD in a snapshot sync before the job runs; it does not pin the job to the triggering commit. In `cached` mode a launch can race the snapshot sync and run the previous captured commit. Provisioning callbacks require the template to allow callbacks and the calling host to already exist in the template's inventory.

## Scheduled work and delayed transitions

A single 30-second loop in the API drives everything time-based. Knowing what it owns explains most "why did this happen a few seconds later" questions:

1. **Schedules** - due cron schedules launch their job template, inventory source sync, or workflow. A due `playbook_sync` schedule records a run and queues no sync.
2. **Held-job release** - re-evaluates jobs held by the concurrency or dependency gates and dispatches the ones whose conditions cleared.
3. **Workflow progression** - advances running workflow runs node by node.
4. **Notification dispatch** - finds job/workflow transitions and delivers configured webhook, email and Microsoft Teams messages. Treat the notification as a signal to inspect the run, not as a transaction proving a remote receiver acted exactly once.
5. **Retention cleanup** - once a day, deletes finished jobs older than the organization's retention window (template overrides apply; each template's most recent job is always kept).

### Configure schedules

| `schedule-type` | Target attribute | Behavior |
|---|---|---|
| `job_template` | `job-template-id` | Launch the template through normal gates. |
| `inventory_source` | `inventory-source-id` | Refresh that source. |
| `workflow` | `workflow-id` | Launch the workflow. |
| `playbook_sync` | `playbook-id` | Accepted as a target type but does not queue a playbook sync; do not use for recurring sync. |

Use the dedicated inventory-source schedule. A source form's **Sync Schedule** field alone
does not activate recurring execution. Invalid cron expressions, timezones or targets from
another organization are rejected with `400`; the error identifies the failed input.

A schedule update uses a `schedules` document. Supplied `name`, `description`,
`cron-expression`, `timezone` and `config` fields change; omitted ones remain. Updated
cron/timezone values are validated again.

- **Enable** recalculates the next run without launching immediately. A schedule can be
  enabled even if its template is disabled; each refused due launch records a failed run.
- **Disable** stops recurring launches.
- **Run now** executes without waiting for cron. A disabled job template returns `409`
  without a launch.
- A target missing from the schedule's organization at execution time records a failure.

The enable, disable and run-now actions return the resulting schedule. Use the
[API explorer](/docs/api-reference/explorer) for the schedule endpoints and the
[canonical Ansible catalogue](./README.md) to choose the task guide for each capability.
