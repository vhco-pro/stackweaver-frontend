<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Agent Pools Implementation Plan

This plan implements TFE-compatible **agent pools** and integrates them with the self-hosted runners design. Agent pools group runners and scope which workspaces/projects can use them. Implementation follows go-tfe and terraform-provider-tfe so `tfe_agent_pool`, `tfe_agent_pool_allowed_projects`, `tfe_agent_pool_allowed_workspaces`, and `tfe_agent_pool_excluded_workspaces` work unchanged.

**Decision**: Agent pools are **part of the self-hosted runners design**, not a separate feature. Pools are the parent of runners; runners register into a pool. Workspaces with `execution_mode=agent` use `agent_pool_id` to target a pool, and job routing selects runners from that pool. This plan is the implementation checklist for the agent-pools slice of that design.

**Design**: See [Self-Hosted Runners Design — Agent Pools](./SELF_HOSTED_RUNNERS_DESIGN.md#agent-pools-tfe-compatible).

**References**:
- go-tfe: `agent_pool.go`, `agent.go` — API surface, types, endpoints
- terraform-provider-tfe: `resource_tfe_agent_pool*.go`, `data_source_agent_pool.go`, `agent_pool_helpers.go`
- TFE API: [Agents and agent pools](https://developer.hashicorp.com/terraform/cloud-docs/api-docs/agents), [Manage agent pools](https://developer.hashicorp.com/terraform/cloud-docs/agents/agent-pools)

---

## Implementation Status (summary)

| Area | Status | Notes |
|------|--------|-------|
| Backend: DB, models, repository | Done | GORM AutoMigrate; see `backend/internal/models/agent_pool.go`, `backend/internal/repository/agent_pool.go` |
| Backend: API handlers & routes | Done | `backend/internal/api/v2/handlers/agent_pools.go`, `routes/routes.go` |
| Backend: RBAC | Done | `requireManageAgentPools` on all agent-pool endpoints |
| Frontend: Settings > Agent Pools | Done | `frontend/src/pages/Settings/AgentPools.tsx`, route `/app/:orgName/settings/agent-pools`, gated by manage-agent-pools |
| Frontend: Pool selector in Add Runner | Pending | When runner registration UI exists |
| Runners & job routing | Pending | `GET /agent-pools/:id/agents` implemented (returns empty until runners exist); runners table and Phase 3 not done |
| TFE Provider Testing | **Done** | All agent pool resources tested with terraform-provider-tfe |

## TFE Provider Compatibility (Tested)

All the following resources work with the official `hashicorp/tfe` provider:
- `tfe_agent_pool` - Create, read, update, delete
- `tfe_agent_pool_allowed_projects` - Scope to projects
- `tfe_agent_pool_allowed_workspaces` - Scope to workspaces  
- `tfe_agent_pool_excluded_workspaces` - Exclude workspaces

Test file: `stackweaver-tests/tfe-tests/agent-pools.tf`

---

## Backend

### 1. Database

- [x] Schema: `agent_pools` with unique `(organization_id, name)`. **Implemented via GORM AutoMigrate** in `backend/cmd/api/main.go`.
- [x] Join tables: `agent_pool_allowed_workspaces`, `agent_pool_allowed_projects`, `agent_pool_excluded_workspaces` created by GORM many2many on `AgentPool` (see `backend/internal/models/agent_pool.go`).
- [x] Index on `agent_pools(organization_id)` via model. Explicit SQL migration files not used; GORM creates tables.

### 2. Models

- [x] `AgentPool` model: `ID`, `Name`, `OrganizationScoped`, `CreatedAt`; relations `AllowedWorkspaces`, `AllowedProjects`, `ExcludedWorkspaces` (many2many). **Implemented** in `backend/internal/models/agent_pool.go`. Agent count derived in response (0 until runners exist).
- [x] Many-to-many via GORM tags; no separate join models.
- [x] `Workspace` has `AgentPoolID` and `ExecutionMode` in `backend/internal/models/workspace.go`.

### 3. Repository

- [x] `AgentPoolRepository`: `Create`, `GetByID`, `ListByOrganization` (with `q`, pagination, `sort`). **Implemented** in `backend/internal/repository/agent_pool.go`. Filters `allowed_workspaces[name]` / `allowed_projects[name]` not implemented.
- [x] `Update`, `Delete` for pools.
- [x] `ReplaceAllowedWorkspaces`, `ReplaceAllowedProjects`, `ReplaceExcludedWorkspaces` (replace entire set; used by PATCH).
- [x] `GetByOrganizationAndName(orgID, name)` for import/lookup by org+name.

### 4. API Handlers & Routes

- [x] `GET /api/v2/organizations/:name/agent-pools` — list; `page[number]`, `page[size]`, `q`, `sort`. **Implemented** (List).
- [x] `POST /api/v2/organizations/:name/agent-pools` — create, JSON:API with optional relations. **Implemented** (Create).
- [x] `GET /api/v2/agent-pools/:id` — read with relations preloaded. **Implemented** (GetByID).
- [x] `PATCH /api/v2/agent-pools/:id` — update name/org-scoped; relation-only updates (allowed-workspaces, allowed-projects, excluded-workspaces); empty array clears. **Implemented** (Update).
- [x] `DELETE /api/v2/agent-pools/:id`. **Implemented** (Delete).
- [x] `GET /api/v2/agent-pools/:id/agents` — list runners in pool (TFE Agent shape). **Implemented** (ListAgents); returns empty list until runners exist.
- [x] Routes registered in `backend/internal/api/v2/routes/routes.go`.

### 5. RBAC

- [x] `org:manage-agent-pools` enforced for list, create, get, update, delete, list-agents via `requireManageAgentPools(c, orgID)` in `agent_pools.go`; uses `rbac.CheckOrgManageAgentPools`.
- [x] Organization resolved from `:name`; pool ownership checked on all mutations and reads.

---

## Frontend

- [x] Settings > Agent Pools: route `/app/:orgName/settings/agent-pools`, list/create/delete pools. **Implemented** in `frontend/src/pages/Settings/AgentPools.tsx`; route in `App.tsx`; Settings entry in `Settings.tsx`.
- [x] Pool detail or modal: edit name, `organization_scoped`; manage allowed workspaces, allowed projects, excluded workspaces (multi-select + removable badges). Wired to `agentPoolsApi` (JSON:API). **Implemented** (Edit dialog).
- [x] Gate UI with `org:manage-agent-pools`: Settings section shown only if `agentPoolsApi.list(orgName)` succeeds (403 hides it). **Implemented** in `Settings.tsx`.
- [ ] Runner registration flow: add agent pool selector (and optional “Create pool” entry point). **Pending** — when Add Runner / runner registration UI is implemented (see SELF_HOSTED_RUNNERS_DESIGN.md).

---

## Integration with Runners

- [ ] Add `agent_pool_id` to `runners` table; runner registration requires `agent_pool_id`. Implement and use in `POST /api/v2/runner/register`. **Pending** — part of broader self-hosted runners work.
- [x] `GET /api/v2/agent-pools/:id/agents` returns runners for that pool. **Implemented**; returns empty list until runners exist; will map to TFE Agent shape when runners are implemented.
- [ ] Job routing (Phase 3): when workspace has `execution_mode=agent` and `agent_pool_id`, resolve pool, apply scoping, select runners. **Pending** — see [Self-Hosted Runners Design — Phase 3](./SELF_HOSTED_RUNNERS_DESIGN.md#phase-3-job-routing--ui-week-3).

---

## Testing

- [ ] Unit tests for repository (CRUD, allowed/excluded replace logic).
- [ ] Handler tests for list/create/read/update/delete and for UpdateAllowed*/UpdateExcluded* (including “clear” with empty array).
- [x] Integration test: create pool → create `tfe_agent_pool_allowed_workspaces` / `_allowed_projects` / `_excluded_workspaces` via API → verify terraform-provider-tfe plan/apply succeeds. **Done** — tested in `stackweaver-tests/tfe-tests/agent-pools.tf`.
- [ ] Verify workspace `agent_pool_id` compatibility: workspace create/update with `execution_mode=agent` and `agent_pool_id` when pools exist.
- [ ] **Runtime Access Enforcement**: Verify runners only execute jobs for allowed projects/workspaces at runtime. See GitHub issue for tracking.

---

## Order of Work

1. ~~Migrations + models + repository.~~ **Done.**
2. ~~Agent pool API handlers + routes + RBAC.~~ **Done.**
3. ~~`GET /api/v2/agent-pools/:id/agents` (runners in pool).~~ **Done** (returns empty until runners exist).
4. ~~Frontend: Settings > Agent Pools~~ **Done.** Pool selector in Add Runner — **pending** when runner registration UI exists.
5. Runner registration and job routing updates (pool-aware) — **pending** as part of broader self-hosted runners work.

---

## Dependencies

- Workspace model already has `AgentPoolID` and `ExecutionMode` (`backend/internal/models/workspace.go`).
- `org:manage-agent-pools` and team `manage-agent-pools` exist; ensure they’re enforced on new endpoints.
- Runners and runner registration are defined in the self-hosted runners design; agent pools are implemented first so that registration can require a pool.


### Reference
https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/agent_pool_excluded_workspaces
https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/agent_pool_allowed_workspaces
https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/agent_pool_allowed_projects
https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/agent_pool