---
description: "Guide for run tasks: hooking external services (security scanners, cost checks, custom gates) into your Terraform runs at stage boundaries, with advisory or mandatory enforcement"
covers:
  - "core/models/run_task*"
  - "core/models/workspace_task*"
  - "core/models/task_stage*"
  - "core/models/task_result*"
  - "core/services/runtask/**"
  - "backend/internal/api/v2/handlers/terraform/run_tasks*"
  - "backend/internal/api/v2/handlers/terraform/workspace_run_tasks*"
  - "backend/internal/api/v2/handlers/terraform/task_stages*"
  - "backend/internal/api/v2/handlers/terraform/task_result_callback*"
  - "frontend/src/pages/Settings/RunTasks*"
  - "frontend/src/components/workspace/WorkspaceRunTasks*"
  - "frontend/src/components/runs/RunTaskStages*"
---

# Run Tasks

Run tasks let external services participate in your Terraform runs. At a stage boundary the run pauses, Stackweaver sends the service a signed webhook describing the run, and the service reports back a pass or fail verdict before the run continues. This is how you plug in security scanners, cost estimators, compliance checks, or your own custom gates without Stackweaver having to implement each integration.

## How a run task works

A run task is defined once per organization: a name, the URL of the external service, and an optional HMAC key the service can use to verify that requests really came from Stackweaver. When you save the task, Stackweaver sends the URL a verification request (a payload carrying the sentinel access token `test-token`) and requires a successful response, so a mistyped or dead endpoint is caught at configuration time rather than in the middle of someone's run.

You then attach the task to workspaces, choosing one or more stages and an enforcement level. The four stages bracket the run's two phases: `pre_plan` runs before the plan is queued, `post_plan` after the plan finishes (this is the default and by far the most common, since the service can inspect the machine-readable plan), `pre_apply` after a user confirms but before the apply starts, and `post_apply` after the apply completes. The enforcement level decides what a failure means: an `advisory` task records its result and the run carries on regardless, while a `mandatory` task blocks the run until the service passes it, or until someone with apply permissions explicitly overrides the failure.

When a run reaches a stage with tasks attached, it pauses and each task's service receives a webhook containing the run's details, a short-lived access token, and a callback URL. With that token the service can download the machine-readable plan (from `post_plan` onward) or the configuration archive itself (useful at `pre_plan`, before any plan exists), do its analysis, and report the verdict back to the callback, optionally attaching detailed findings that appear on the run page. If a service never answers, the stage times out: ten minutes without progress, or sixty minutes in total, after which a mandatory task's silence fails the run rather than leaving it stuck forever.

The set of tasks that applies to a run is fixed when the run is created. Attaching, editing, or removing tasks affects future runs only, so an in-flight run can never have its gates changed from under it.

## Setting up a run task

Define tasks under your organization's settings, on the Run Tasks page. Each task needs a name, an HTTP(S) endpoint URL, and optionally a description and an HMAC key. The key is write-only: it is stored encrypted, never shown again, and used to sign every webhook so the receiving service can authenticate them. Services built for HCP Terraform work unchanged, because the payload, the signature header, and the callback contract match TFE's run task integration API.

A task can also be applied globally from the same dialog. A global task runs on every workspace in the organization at the stages and enforcement level you pick, with no per-workspace attachment needed. If a workspace also attaches the same task directly, the workspace's own attachment wins, so teams can tighten (or relax) the global default for their workspace.

To attach a task to a single workspace, open the workspace and use its Run Tasks tab. Pick the task, the stages, and whether it is advisory or mandatory for this workspace.

## Run tasks on the run page

A run with task stages shows them on its detail page between the phases they gate. Each stage lists its tasks with their current status, the message the service reported, a link to the service's own detail page if it provided one, and any structured findings the service attached, with severity-colored tags.

When a mandatory task fails, the run holds and the stage shows an override action to users with apply permissions. Overriding records who continued the run and why (an optional comment), and the run proceeds exactly as if the stage had passed. A mandatory task that errored or could not be reached at all cannot be overridden; the run fails, because there is no verdict to overrule. Runs waiting on task stages can always be cancelled, and a run waiting at a failed mandatory stage can be discarded instead of overridden.

## Terraform provider support

The full family is supported by the `hashicorp/tfe` provider against Stackweaver: `tfe_organization_run_task`, `tfe_workspace_run_task`, and `tfe_organization_run_task_global_settings`, plus their data sources. Use the plural `stages` attribute on workspace attachments; the singular `stage` is deprecated upstream and only served for compatibility. For the exact attribute mapping and the documented divergences, see the internal compatibility specs under `docs/internal/tfe-compatibility/resources/run-tasks/`.

## Building your own task service

A task service is a small HTTP endpoint. It must answer the verification request (recognizable by the `access_token` value `test-token`) with a success status and do nothing else with it. For real requests it verifies the `X-TFC-Task-Signature` header (the hex HMAC-SHA512 of the raw request body, keyed with the task's HMAC key), does its work, and sends a PATCH to the payload's `task_result_callback_url` with the verdict (`passed`, `failed`, or `running` as a progress heartbeat for long checks), authenticated by the payload's `access_token` as a bearer token. Findings can be attached to the callback and are stored and rendered on the run page, with a one-megabyte limit per finding body. A minimal reference implementation lives at `scripts/tfe-compat/runtime/mock-task-service/main.go`, which the runtime test suite drives against a live stack.
