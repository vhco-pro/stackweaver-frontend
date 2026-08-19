---
description: "The cross-organization dashboard: why it spans tenants, what the attention list and live operations show, and the two endpoints behind them"
covers:
  - "backend/internal/api/v2/handlers/dashboard*"
  - "core/repository/dashboard*"
  - "frontend/src/pages/Dashboard/**"
---

# Dashboard

The dashboard at `/dashboard` is the landing page for every authenticated user, and the only screen in the product that spans organizations. Its job is to tell you *which* organization needs you, and hand you off to it.

## Why it is not scoped to an organization

StackWeaver's routing already draws the line: `/app/:orgName/*` is organization space, and everything outside it — the organization list, the activity log, settings, this page — is user space. The dashboard sits in user space and deliberately has no organization selector.

That is a design constraint, not an omission. An organization-scoped dashboard can only ever be a lesser copy of that organization's own pages: its live work is the workspace list, its trends are the Usage page, and both are one click away and better at the job. Spanning tenants is the only thing this page can do that they cannot, and it is exactly what makes the page worth opening — you cannot be told that an organization needs you if you have to name the organization first.

Two consequences follow, and both are deliberate:

- **There is no chart.** A day-by-day breakdown is worth reading when you can drill into a day, next to the status donut, duration percentiles and busiest-workspace tables that explain it. All of that is [Usage & Analytics](../../user-guides/usage-analytics.md), which the organization cards link to.
- **There is no shortcut row.** A cross-organization "Workspaces" button has no organization to point at. Choosing the organization you mean is the first real step, so the organization cards *are* the navigation.

## What the page shows

**Needs your attention** is the page. It is a list, not a row of totals: every row names one organization, one problem, and a count, and links into that organization. Rows only exist when their count is non-zero, so the length of the list is the size of the problem — something a grid of mostly-zero cards would destroy.

The list covers both halves of the product. Terraform and Ansible kinds are interleaved rather than grouped, so the ranking says how urgent something is and not which platform it came from. In order:

| Rank | Kind | Platform | Means |
|---|---|---|---|
| 1 | Runs waiting to apply | Terraform | A plan finished and is holding for someone to confirm |
| 2 | Workflow approvals waiting | Ansible | A workflow approval node is holding for someone to approve or deny |
| 3 | Workspaces left broken | Terraform | Most recent run errored, nothing has run since |
| 4 | Job templates left failing | Ansible | Most recent job errored, nothing has run since |
| 5 | Inventories failed to sync | Ansible | The hosts a job would target are stale or wrong |
| 6 | Runners offline | Both | Capacity to execute anything is degraded |
| 7 | Terraform runs failed | Terraform | Failure events inside the recent-failure window |
| 8 | Ansible jobs failed | Ansible | The same, for the other platform |
| 9 | Open change requests | Terraform | Notes the team filed against workspaces |

The ranking is by who is blocked rather than by how alarming the wording is: an execution waiting on a confirm is blocking a person right now, automation broken for a month is not blocking anyone but will not fix itself, and a change request is a note about future work. Rows 1–2 and 3–4 are deliberate pairs — each platform's confirm step, and each platform's "left broken" — because the concepts exist on both sides under different names.

Failures are counted per platform rather than as one "executions" total: which half of the estate is unhealthy is the actionable part, and the two rows lead to different pages. Ad-hoc Ansible jobs are excluded from "job templates left failing" (a one-off that failed is an event in the failure count, not standing automation left broken) but are included in the failure count itself.

Runners and change requests are admin-only. The API resolves that per organization and omits the field entirely where the reader lacks the permission, so a member sees no row rather than a zero — a zero would read as "nothing wrong" to someone who was never allowed to know.

**Live operations** lists the Terraform runs and Ansible jobs executing right now across every organization, each row naming its organization, how long it has been going and its status. Nothing else in the product shows this: the Usage page reports a *count* of executions from a selected window that are still running, and the workspace and job lists are per organization. Runs parked at the confirm step are deliberately absent — they are waiting on a person, which the attention list already reports, so the same run is never counted twice.

**Your organizations** gives each organization a card with its projects, workspaces and playbooks, plus one line of state: what needs attention, what is running, or what succeeded this month. Cards with something waiting are outlined. **Recent activity** is the reader's own last few actions, across organizations.

Until an organization, a project and a workspace all exist, a three-step **Getting started** checklist replaces the attention and live-operations sections: a fresh install has no operations to report, and an empty checklist is more useful than two empty sections.

Every section folds away from its heading, and the choice is remembered per section in local storage. A collapsed section is unmounted rather than hidden, so one that owns a polling query stops polling; that only holds because each section's query lives in its body component rather than in the component that renders the collapsible shell.

## The API

Two endpoints back the page, both cross-organization and neither taking an organization parameter. Both are classified `agnostic()` in the org-resolution wall (`backend/internal/api/middleware/org_wall_registry.go`), because there is no single target organization to resolve.

`GET /api/v2/dashboard/stats` returns the roll-up: totals across the caller's memberships, plus one entry per organization carrying `projects`, `terraform_workspaces`, `ansible_playbooks`, `active_terraform_runs`, `pending_terraform_runs`, `awaiting_approval`, `pending_workflow_approvals`, `errored_workspaces`, `errored_job_templates`, `failed_inventory_syncs`, `recent_run_failures`, `recent_job_failures`, `active_ansible_jobs` and the two `completed_*_this_month` counts. `open_change_requests`, `runners_total` and `runners_offline` appear only for organizations where the caller may see them. The top level repeats the same fields summed, and adds `recent_failure_window_days` so the UI can name the window it is reporting rather than hard-coding it.

`GET /api/v2/dashboard/operations` returns the in-flight executions, bounded, each carrying its organization, name, status and start time, with a `truncated` flag so the UI can say when there is more.

Within an organization, every count is organization-wide. Runs and jobs used to be filtered to the requesting user while projects, workspaces and playbooks were not, so "active operations" meant *your* operations sitting beside a workspace count that meant everyone's. One organization now means one population: what the team has, not what you personally started. The "this month" counts run from the first instant of the current month in UTC.

## Implementation

Both endpoints read through `core/repository/dashboard.go`, a purpose-built cross-organization read model rather than a dozen more methods spread across the run, job, workspace, project, playbook, change-request and runner repositories. The dashboard asks every question for every organization at once, which per-organization repositories can only answer with N queries per metric — the shape AUD-063 already had to rescue this endpoint from once. Every method takes the whole set of organization ids and returns one row per organization from a single grouped query, so adding an organization to a user's memberships costs nothing.

The three "left broken" counts are top-1-per-group problems — latest run per workspace, latest job per template, latest sync per inventory — answered with Postgres `DISTINCT ON` rather than correlated subqueries. Those, and the four-table join that finds a workflow approval waiting on a person, are covered by `core/repository/dashboard_test.go` under the `integration` tag: inventory syncs and workflow approvals have no rows on a typical dev stack, so seeding a scratch organization is the only way to know that SQL is right rather than merely runnable.

The page is one section component per concern under `frontend/src/pages/Dashboard/`, each with its own skeleton and its own error state with a retry, so a failing section reports the failure in place while the rest of the page stays usable. The attention list is derived by a pure function (`attention.ts`) from the stats payload, which is what makes its ranking, pluralisation and permission behaviour testable without rendering anything. The folding shell is `frontend/src/components/ui/collapsible-section.tsx`.

## Related documentation

- [Reading the dashboard](../../user-guides/reading-the-dashboard.md) — the operator-facing guide
- [Usage & Analytics](../../user-guides/usage-analytics.md) — the per-organization delivery-health page this one hands off to
