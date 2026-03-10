<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Self-Hosted Runners Management System Design

Important: be sure to use the JSON:API everywhere, aswell as in the frontend to be consistent with the rest of the platform and make sure the design is consistent with other components.

## Overview

This document outlines the design for a self-hosted runners management system that allows users to register, manage, and monitor their own runner infrastructure for both Terraform and Ansible workloads.

**Key Principle**: Self-hosted runners use the **exact same runner images** (`runner-images/ansible/` and `runner-images/terraform/`) as platform-hosted runs. The only difference is:
- **Platform-hosted**: Orchestrator spins up runner containers directly
- **Self-hosted**: User runs the container with an agent mode that polls for jobs

This is NOT a separate runner implementation - it's the same code, just with a different communication model.

## Goals

1. **Unified Runner Management**: Single UI in Settings for managing both Terraform and Ansible runners
2. **Same Images**: Use existing `runner-images/` Dockerfiles - no separate runner agent binary
3. **Reuse Existing API Key System**: Use the existing API key infrastructure (`api_keys` table) with runner-specific scopes - no separate token system
4. **TFE API Compatibility**: Ensure runner endpoints don't conflict with TFE API spec and follow `/api/v2/` versioning
5. **Easy Setup**: Simple `docker run` with environment variables using existing API keys
6. **Visibility**: Real-time status monitoring of runners including health, capacity, and job history
7. **Ansible Configuration**: Support for configurable `ansible.cfg` via UI for organization/project/workspace scopes

---

## Architecture

### How It Works

```
Platform-Hosted Flow (current):
┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐
│ API Request │───▶│ Orchestrator │───▶│ Spawn Runner Pod    │
│ (run job)   │    │              │    │ (runner-images/*)   │
└─────────────┘    └──────────────┘    └─────────────────────┘

Self-Hosted Flow (new):
┌─────────────────────────────────────────────────────────────┐
│                    User's Infrastructure                     │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  docker run stackweaver/runner:latest                   ││
│  │    --mode agent                                         ││
│  │    --token tfe-xxx...                                   ││
│  │    --server https://stackweaver.io                      ││
│  │                                                         ││
│  │  (Same image as runner-images/ansible or terraform)     ││
│  └────────────────────┬────────────────────────────────────┘│
└───────────────────────│─────────────────────────────────────┘
                        │
                        │ Poll for jobs / Send results
                        ▼
              ┌─────────────────┐
              │ StackWeaver API │
              │ /api/v2/runner/ │
              └─────────────────┘
```

### Runner Image Modifications

The existing runner images need minimal changes to support agent mode:

```dockerfile
# runner-images/ansible/Dockerfile (additions)
# ... existing Dockerfile content ...

# Add agent mode entrypoint script
COPY agent-entrypoint.sh /agent-entrypoint.sh

# Default: direct execution mode (platform-hosted)
# With --mode agent: poll for jobs (self-hosted)
ENTRYPOINT ["/entrypoint.sh"]
```

The `agent-entrypoint.sh` script:
1. Registers with the StackWeaver API using an API key with `runner:register` scope
2. Polls `/api/v2/runner/heartbeat` for pending work
3. Downloads job artifacts (playbook, inventory, vars, ansible.cfg content)
4. Writes `ansible.cfg` to the playbook working directory if provided (Ansible will auto-detect it)
5. Executes jobs using the same code paths as platform-hosted
6. Streams output back to the API

### High-Level Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                         StackWeaver Platform                         │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────────────┐   │
│  │  Frontend   │───▶│   Backend    │───▶│      Database         │   │
│  │  Settings   │    │   API        │    │  - runners            │   │
│  │  UI         │    │              │    │  - api_keys (reused)  │   │
│  └─────────────┘    └──────────────┘    └───────────────────────┘   │
│                            ▲                                        │
│                            │                                        │
└────────────────────────────│────────────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │  Same Runner    │
                    │  Image with     │
                    │  Agent Mode     │
                    ├─────────────────┤
                    │ - Heartbeat     │
                    │ - Job Polling   │
                    │ - Same executor │
                    └─────────────────┘
```

### Database Schema

**Key Design Decision**: We reuse the existing `api_keys` table instead of creating a separate `runner_tokens` table. API keys with runner scopes (`runner:register`) can be used to register runners. This maintains consistency with the existing authentication system.

**Agent Pools**: Runners belong to an **agent pool** (TFE-compatible). Pools provide grouping and scoping: which workspaces/projects can use the pool, and which workspaces are excluded. See the [Agent Pools](#agent-pools-tfe-compatible) section below.

```sql
-- Note: api_keys table already exists (see backend/internal/models/api_key.go)
-- We extend it with runner-specific scopes:
--   - "runner:register" - allows registering a new runner
--   - "runner:terraform" - runner can execute Terraform jobs
--   - "runner:ansible" - runner can execute Ansible jobs
--   - "runner:combined" - runner can execute both Terraform and Ansible jobs
--
-- Example scopes for a runner API key:
--   ["org:<org_id>:runner:register", "org:<org_id>:runner:combined"]

-- Agent pools (TFE-compatible). Reference: go-tfe/agent_pool.go, terraform-provider-tfe agent_pool resources.
CREATE TABLE agent_pools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    organization_scoped BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

CREATE TABLE agent_pool_allowed_workspaces (
    agent_pool_id UUID NOT NULL REFERENCES agent_pools(id) ON DELETE CASCADE,
    workspace_id VARCHAR(20) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    PRIMARY KEY (agent_pool_id, workspace_id)
);

CREATE TABLE agent_pool_allowed_projects (
    agent_pool_id UUID NOT NULL REFERENCES agent_pools(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    PRIMARY KEY (agent_pool_id, project_id)
);

CREATE TABLE agent_pool_excluded_workspaces (
    agent_pool_id UUID NOT NULL REFERENCES agent_pools(id) ON DELETE CASCADE,
    workspace_id VARCHAR(20) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    PRIMARY KEY (agent_pool_id, workspace_id)
);

CREATE INDEX idx_agent_pools_org ON agent_pools(organization_id);

-- Registered runners (belong to an agent pool)
CREATE TABLE runners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    agent_pool_id UUID NOT NULL REFERENCES agent_pools(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    runner_type VARCHAR(50) NOT NULL DEFAULT 'combined', -- 'terraform', 'ansible', 'combined'
    status VARCHAR(50) NOT NULL DEFAULT 'offline', -- 'online', 'offline', 'busy', 'error'
    
    -- Runner metadata (reported by agent)
    hostname VARCHAR(255),
    ip_address INET,
    os_type VARCHAR(100),
    os_version VARCHAR(100),
    agent_version VARCHAR(50),
    labels JSONB DEFAULT '[]',  -- Custom labels for job targeting
    
    -- Capabilities (reported by agent)
    terraform_version VARCHAR(50),
    ansible_version VARCHAR(50),
    available_collections JSONB DEFAULT '[]',  -- Ansible Galaxy collections installed
    max_concurrent_jobs INTEGER DEFAULT 1,
    
    -- Heartbeat & health
    last_heartbeat_at TIMESTAMP WITH TIME ZONE,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- API key used to register this runner (references existing api_keys table)
    registered_with_api_key_id UUID REFERENCES api_keys(id),
    
    UNIQUE(organization_id, name)
);

-- Runner job history (links jobs to runners)
CREATE TABLE runner_job_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    runner_id UUID NOT NULL REFERENCES runners(id),
    job_type VARCHAR(50) NOT NULL, -- 'terraform_run', 'ansible_job'
    job_id UUID NOT NULL,  -- References terraform_runs or ansible_jobs
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- Indexes
CREATE INDEX idx_runners_org_status ON runners(organization_id, status);
CREATE INDEX idx_runners_agent_pool ON runners(agent_pool_id);
CREATE INDEX idx_runners_heartbeat ON runners(last_heartbeat_at);
CREATE INDEX idx_runner_job_executions_runner ON runner_job_executions(runner_id);

-- Ansible configuration storage (for customizable ansible.cfg)
CREATE TABLE ansible_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    project_id UUID REFERENCES projects(id),
    workspace_id UUID REFERENCES terraform_workspaces(id),
    config_content TEXT NOT NULL,  -- ansible.cfg content
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Only one config per scope (most specific wins: workspace > project > org)
    UNIQUE(workspace_id),
    UNIQUE(project_id),
    UNIQUE(organization_id)
);

CREATE INDEX idx_ansible_configs_org ON ansible_configs(organization_id);
CREATE INDEX idx_ansible_configs_project ON ansible_configs(project_id);
CREATE INDEX idx_ansible_configs_workspace ON ansible_configs(workspace_id);
```

---

## TFE API Compatibility

**Important**: We maintain compatibility with the Terraform Enterprise / HCP Terraform API and `terraform-provider-tfe` where applicable:

1. **API Versioning**: All endpoints use `/api/v2/` to match our existing API versioning strategy
2. **JSON:API Format**: Agent pool and runner endpoints follow JSON:API format for consistency
3. **Authentication**: Runners use the same TFE-compatible API key format (`tfe-xxx...`) that works with existing Terraform CLI
4. **Agent Pools**: Agent pool API is **TFE-compatible** so `tfe_agent_pool`, `tfe_agent_pool_allowed_projects`, `tfe_agent_pool_allowed_workspaces`, and `tfe_agent_pool_excluded_workspaces` work unchanged.

**TFE API Endpoints** (for reference - these are already implemented):
- `/api/v2/organizations/:name/workspaces` - Workspace management
- `/api/v2/runs/:id` - Run management
- `/api/v2/state-versions` - State version management

**TFE-Compatible Agent Pool Endpoints** (new, to be implemented):
- `GET/POST /api/v2/organizations/:name/agent-pools` - List/create agent pools
- `GET/PATCH/DELETE /api/v2/agent-pools/:id` - Read/update/delete agent pool
- `UpdateAllowedWorkspaces` / `UpdateAllowedProjects` / `UpdateExcludedWorkspaces` via `PATCH /api/v2/agent-pools/:id` with relations
- `GET /api/v2/agent-pools/:id/agents` - List agents (runners) in pool

**StackWeaver Runner Endpoints** (new, StackWeaver-specific; not in TFE spec):
- `/api/v2/runner/register` - Runner registration (specify `agent_pool_id`)
- `/api/v2/runner/heartbeat` - Runner heartbeat and job polling
- `/api/v2/organizations/:name/runners` - Runner management UI (optional convenience; TFE uses agent-pools/:id/agents)

---

## Agent Pools (TFE-Compatible)

Agent pools group self-hosted runners and scope which workspaces/projects can use them. This matches [Terraform Enterprise / HCP Terraform agent pools](https://developer.hashicorp.com/terraform/cloud-docs/agents/agent-pools) and enables `terraform-provider-tfe` resources `tfe_agent_pool`, `tfe_agent_pool_allowed_projects`, `tfe_agent_pool_allowed_workspaces`, and `tfe_agent_pool_excluded_workspaces`.

### Reverse-Engineered TFE API (go-tfe / terraform-provider-tfe)

**go-tfe** (`agent_pool.go`, `agent.go`):
- **AgentPools**: `List`, `Create`, `Read` / `ReadWithOptions`, `Update`, `UpdateAllowedWorkspaces`, `UpdateAllowedProjects`, `UpdateExcludedWorkspaces`, `Delete`
- **AgentPool** type: `ID`, `Name`, `AgentCount`, `OrganizationScoped`, `CreatedAt`; relations: `Organization`, `AllowedWorkspaces`, `AllowedProjects`, `ExcludedWorkspaces`, `Workspaces`, `HYOKConfigurations` (we omit HYOK)
- **Agents**: `List(agentPoolID)`, `Read(agentID)`. Agent: `ID`, `Name`, `IP`, `Status`, `LastPingAt`
- **Endpoints**: `GET/POST organizations/:org/agent-pools`, `GET/PATCH/DELETE agent-pools/:id`, `GET agent-pools/:id/agents`
- **List filters**: `filter[allowed_workspaces][name]`, `filter[allowed_projects][name]`; optional `include`: `workspaces`, `hyok-configurations`; `q` for search

**terraform-provider-tfe** resources:
- `tfe_agent_pool`: `name`, `organization`, `organization_scoped`. Create/Read/Update/Delete map to AgentPools CRUD.
- `tfe_agent_pool_allowed_projects`: `agent_pool_id`, `allowed_project_ids` (set). Uses `UpdateAllowedProjects`; empty set clears.
- `tfe_agent_pool_allowed_workspaces`: `agent_pool_id`, `allowed_workspace_ids` (set). Uses `UpdateAllowedWorkspaces`; empty set clears.
- `tfe_agent_pool_excluded_workspaces`: `agent_pool_id`, `excluded_workspace_ids` (set). Uses `UpdateExcludedWorkspaces`; empty set clears.

**Workspace link**: When `execution_mode` is `agent`, workspace must have `agent_pool_id` (see `WorkspaceCreateOptions` / `WorkspaceUpdateOptions` in go-tfe `workspace.go`). Our workspace model already has `AgentPoolID` and `ExecutionMode`.

### Scoping Semantics

- **organization_scoped = true**: Pool is available to all workspaces in the organization, unless excluded. `excluded_workspaces` can remove specific workspaces.
- **organization_scoped = false**: Pool is restricted to **allowed_workspaces** only. Typically used with `tfe_agent_pool_allowed_workspaces` (and optionally `allowed_projects`).
- **allowed_projects**: Restrict which projects can use the pool. When set, pool appears only for workspaces in those projects (together with allowed/excluded workspace rules).
- **excluded_workspaces**: When org-scoped, these workspaces cannot use the pool. Ignored when `organization_scoped = false` and allowed_workspaces is used.

**Clear semantics**: To clear allowed/excluded lists, TFE uses dedicated update calls with an empty array. `Update` cannot clear these; use `UpdateAllowedWorkspaces`, `UpdateAllowedProjects`, or `UpdateExcludedWorkspaces` with empty payloads. See go-tfe `updateArrayAttribute` and provider Delete handlers.

### Agent Pool API (TFE-Compatible)

**Route Registration**: See `backend/internal/api/v2/routes/routes.go`  
**Handler Implementation**: See `backend/internal/api/v2/handlers/agent_pools.go` (to be created)

```
GET    /api/v2/organizations/:name/agent-pools
POST   /api/v2/organizations/:name/agent-pools
GET    /api/v2/agent-pools/:id
PATCH  /api/v2/agent-pools/:id
DELETE /api/v2/agent-pools/:id
GET    /api/v2/agent-pools/:id/agents
```

**List**: Query params `filter[allowed_workspaces][name]`, `filter[allowed_projects][name]`, `page[size]`, `page[number]`, `q`, `sort` (e.g. `name`, `created-at`). Optional `include`: `workspaces` (we skip `hyok-configurations`).

**Create/Update**: JSON:API `agent-pools` type. Attributes: `name`, `organization-scoped`. Relations: `allowed-workspaces`, `allowed-projects`, `excluded-workspaces` (arrays of `{ type, id }`). Update cannot clear relations; use dedicated update endpoints for that.

**Allowed/Excluded updates**: `PATCH /api/v2/agent-pools/:id` with body containing only the relation to replace (e.g. `allowed-workspaces` or `excluded-workspaces`). Empty array clears that list.

**Agents list**: `GET /api/v2/agent-pools/:id/agents` returns runners in the pool. Use our `runners` model; map to TFE Agent shape (`id`, `name`, `ip-address`, `status`, `last-ping-at`).

### RBAC

Agent pool management requires `org:manage-agent-pools`. See `PermissionOrgManageAgentPools` in `backend/internal/services/rbac/service.go` and team org-access `manage-agent-pools` in `backend/internal/api/v2/handlers/teams.go`. Enforce this on all agent-pool mutating endpoints and on list if we filter by org.

**Implementation plan**: See [Agent Pools Implementation Plan](AGENT_POOLS_IMPLEMENTATION_PLAN.md) for a task-level checklist.

---

## Job Template → Agent Pool Assignment (Ansible)

Ansible job templates can be assigned to a specific agent pool. When a job is launched from a template, the `agent_pool_id` is automatically propagated to the `AnsibleJob` record, so the runner heartbeat query matches it to runners in that pool.

**How it works:**
1. User creates/edits a job template and selects an agent pool (optional dropdown in the UI)
2. When the template is launched, the `LaunchFromTemplate` service copies `template.AgentPoolID` → `job.AgentPoolID`
3. **Job routing decision** in `LaunchJob`: If `job.AgentPoolID` is set, the job is **not** enqueued to Redis. It remains in `pending` status so that self-hosted runners discover it during heartbeat polling. If `job.AgentPoolID` is nil, the job goes to the Redis queue for platform-hosted runners.
4. During runner heartbeat, `findPendingJobsForRunner` queries pending ansible jobs where `agent_pool_id` matches the runner's pool, creates a `RunnerJobExecution` tracking record, and returns the jobs to the runner
5. The runner picks up and executes the job

**If no agent pool is assigned**: The job runs on the built-in platform runner (Redis queue → platform runner worker), not on self-hosted runners.

**Relaunch behavior**: When a job is relaunched, the `AgentPoolID` from the original job is preserved so the relaunched job routes to the same pool. See `RelaunchJob` in `backend/internal/services/ansible/job.go`.

**Job detail visibility**: The job detail page shows which agent pool and runner executed the job. See `formatJobResponse` in `backend/internal/api/v2/handlers/ansible/jobs.go` and the Details tab in `frontend/src/pages/Ansible/JobDetail.tsx`.

**Implementation references:**
- Model: `AnsibleJobTemplate.AgentPoolID` in `backend/internal/models/ansible_playbook.go`
- API: `agent-pool` relationship in `CreateJobTemplateRequest` / `UpdateJobTemplateRequest` in `backend/internal/api/v2/handlers/ansible/playbooks.go`
- Job routing: `LaunchJob` in `backend/internal/services/ansible/job.go` — conditional Redis enqueue based on `AgentPoolID`
- Relaunch: `RelaunchJob` in `backend/internal/services/ansible/job.go` — preserves `AgentPoolID`
- Heartbeat dispatch: `findPendingJobsForRunner` in `backend/internal/api/v2/handlers/runner_agent.go` — queries pending jobs, creates execution records
- Frontend: Agent pool dropdown in `frontend/src/pages/Ansible/JobTemplates.tsx` (create) and `frontend/src/pages/Ansible/JobTemplateDetail.tsx` (edit)

**Note**: For Terraform workspaces, the agent pool is assigned on the workspace itself (`workspace.AgentPoolID` when `execution_mode=agent`). This is separate from the Ansible job template assignment.

---

## Agent Mode Execution Pipeline

When a self-hosted runner executes an Ansible job, the following pipeline runs:

### 1. Job Discovery & Assignment (Server)
- Runner heartbeats to `/api/v2/runner/heartbeat`
- `findPendingJobsForRunner` queries `ansible_jobs` with `status=pending AND agent_pool_id=runner.pool`
- Creates `RunnerJobExecution` record for tracking
- Returns pending jobs to the runner

### 2. Artifact Download
- Runner calls `GET /api/v2/runner/jobs/:id/artifacts`
- Server returns: playbook path, inventory content, ansible.cfg, extra vars, credential data, VCS clone info
- VCS info includes authenticated clone URL (with access token), branch, and repository name
- See `GetJobArtifacts` in `backend/internal/api/v2/handlers/runner_agent.go`

### 3. Repository Cloning
- Agent clones the VCS repository using `git clone --depth 1 --single-branch --branch <branch> <url>`
- Playbook path is resolved as an absolute path within the cloned repo (e.g., `repo/ansible-examples/playbooks/hello-world.yml`)
- Working directory is set to the playbook's parent directory so Ansible can find relative paths (roles/, group_vars/, etc.)
- See `cloneRepo` and `runAnsiblePlaybook` in `backend/cmd/ansible-runner/agent_mode.go`

### 4. Job Start Notification
- Runner calls `POST /api/v2/runner/jobs/:id/start`
- Server updates `AnsibleJob.Status` → `running`, sets `StartedAt` and `RunnerID`
- Updates `RunnerJobExecution.Status` → `running`

### 5. Playbook Execution with JSONL Streaming
- Agent runs `ansible-playbook` with `ANSIBLE_STDOUT_CALLBACK=ansible.posix.jsonl` for structured output
- Each JSONL line is streamed to `POST /api/v2/runner/jobs/:id/output`
- Server's `JobOutput` handler parses each JSONL line and creates structured `AnsibleJobEvent` records
- Events include: host facts, task results, play stats — same format as platform-hosted execution
- `v2_playbook_on_stats` events update the job's host stats (`HostsOk`, `HostsChanged`, etc.)
- See `JobOutput` and `parseAndStoreAgentEvent` in `backend/internal/api/v2/handlers/runner_agent.go`

### 6. Job Completion
- Runner calls `POST /api/v2/runner/jobs/:id/complete` with status and error message
- Server updates `AnsibleJob.Status` → `successful`/`failed`/`canceled`, sets `FinishedAt`
- Counts warnings from stderr events and sets `HasWarnings`/`WarningsCount`
- Updates `RunnerJobExecution.Status` accordingly
- Work directory is cleaned up on the runner

### Key Differences from Platform Mode
| Aspect | Platform Mode | Agent Mode |
|--------|--------------|------------|
| Job queue | Redis queue (`ansible_jobs`) | Heartbeat polling (DB query) |
| VCS access | Direct DB + VCS service | VCS clone URL in artifacts |
| Event storage | Direct DB writes | HTTP streaming → server parses |
| Playbook files | Server-local clone | Agent-side clone |
| OIDC workload identity | Runner generates tokens locally (has signing key) | API generates tokens server-side, sent via artifacts |

### OIDC Workload Identity for Self-Hosted Runners

Self-hosted runners support OIDC workload identity authentication for cloud providers (Azure, AWS, GCP). Unlike platform-hosted runners which generate OIDC tokens locally using the signing key, self-hosted runners receive pre-generated tokens from the API server via the artifacts endpoint. This avoids distributing the OIDC signing key to external machines.

**How it works:**

1. Runner requests job artifacts via `GET /api/v2/runner/jobs/:id/artifacts`
2. The API checks if the job's organization has an `AzureOIDCConfiguration`
3. If configured, the API generates an OIDC JWT using the platform signing key
4. The token and Azure configuration (client ID, tenant ID, subscription ID) are included in the `environment_vars` field of the artifacts response
5. The runner sets these as environment variables on the Ansible/Terraform command

**Terraform runs** receive: `TFC_WORKLOAD_IDENTITY_TOKEN`, `ARM_OIDC_TOKEN`, `ARM_CLIENT_ID`, `ARM_SUBSCRIPTION_ID`, `ARM_TENANT_ID`, `ARM_USE_OIDC=true`

**Ansible jobs** receive: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_FEDERATED_TOKEN`, `ARM_OIDC_TOKEN`, `ARM_CLIENT_ID`, `ARM_SUBSCRIPTION_ID`, `ARM_TENANT_ID`, `ARM_USE_OIDC=true`

**Implementation files:**
- `backend/internal/api/v2/handlers/runner_agent.go` — `GetJobArtifacts()` and `getTerraformRunArtifacts()` inject OIDC env vars into artifacts response
- `backend/internal/api/v2/routes/routes.go` — Wires `SetOIDCServices()` with signing key and Azure OIDC repo
- `backend/cmd/ansible-runner/agent_mode.go` — Consumes `environment_vars` from artifacts and sets them on the command

---

## Runner Type Filtering (Mixed Pools)

A single agent pool can contain both Terraform and Ansible runners. The platform filters jobs by runner type so that ansible jobs are never dispatched to terraform-only runners, and vice versa.

### Runner Types

Defined in `backend/internal/models/runner.go`:
- `terraform` — Can only execute Terraform runs
- `ansible` — Can only execute Ansible jobs
- `combined` — Can execute both

Helper methods: `CanExecuteTerraform()` and `CanExecuteAnsible()` return true for the matching type or `combined`.

### How Type Is Determined

Runner type is determined **server-side** during registration based on the version fields reported by the runner:
- If `terraform_version` is set but `ansible_version` is empty → `terraform`
- If `ansible_version` is set but `terraform_version` is empty → `ansible`
- If both are set → `combined`

See `backend/internal/api/v2/handlers/runner_agent.go:Register()` (lines 164-170).

### Filtering During Job Dispatch

**Heartbeat-based dispatch** (`findPendingJobsForRunner` in `runner_agent.go`):
- Only queries `ansible_jobs` (pending, matching `agent_pool_id`)
- If the runner's type is `terraform` (not `ansible` or `combined`), returns empty immediately — terraform-only runners never receive ansible jobs
- Ansible and combined runners receive matching ansible jobs

**Routing service** (`FindAvailableRunner` in `backend/internal/repository/runner.go`):
- For `terraform_run` jobs: filters runners to `terraform` or `combined` types
- For `ansible_job` jobs: filters runners to `ansible` or `combined` types
- Used by `RoutingService.RouteJob()` in `backend/internal/services/runner/routing.go`

### Current Gap: Terraform Self-Hosted Runners (Frontend + Heartbeat)

1. **Frontend**: There is no UI to assign an agent pool to a Terraform workspace when `execution_mode=agent`. The workspace model and API support `agent_pool_id`, but the workspace create/edit dialogs do not show an agent pool selector. **TODO**: Add agent pool dropdown to workspace create and edit (when execution mode is agent), consistent with TFE workspace settings and `frontend/src/pages/Settings/AgentPools.tsx` patterns.

2. **Heartbeat dispatch**: `findPendingJobsForRunner` currently only queries Ansible jobs. Terraform runs assigned to an agent pool are not returned via heartbeat, so self-hosted Terraform runners do not receive jobs through the heartbeat polling mechanism. **TODO**: Add Terraform run querying to `findPendingJobsForRunner` and implement artifact download + execution in the Terraform runner agent (same pull model as Ansible).

---

## API Design

### Using Existing API Key System

**Key Principle**: Runners use the existing API key system. Users create API keys with runner scopes through the existing Settings > API Keys UI. No separate token management system needed.

**Runner API Key Scopes** (extending existing scope system):
- `org:<org_id>:runner:register` - Allows registering a runner for the organization
- `org:<org_id>:runner:terraform` - Runner can execute Terraform jobs
- `org:<org_id>:runner:ansible` - Runner can execute Ansible jobs  
- `org:<org_id>:runner:combined` - Runner can execute both (shorthand for terraform + ansible)
- `runner:<runner_id>:*` - Runner-specific scopes (auto-generated after registration for least privilege)

**Implementation**: 
- **Scope System**: See `backend/internal/services/apikey/scopes.go` for scope parsing and validation
- **API Key Service**: See `backend/internal/services/apikey/service.go` for API key creation and verification
- **API Key Handlers**: See `backend/internal/api/handlers/apikey.go` for API key CRUD endpoints
- **Scope Checker**: See `backend/internal/services/apikey/scopes.go:ScopeChecker` for permission checking

**Frontend**: See `frontend/src/pages/Settings/ApiKeys.tsx` for the existing UI pattern that will be extended to include runner scope options.

### Runner Management

**Route Registration**: See `backend/internal/api/v2/routes/routes.go` for route patterns
**Handler Implementation**: See `backend/internal/api/v2/handlers/` for handler patterns

```
GET    /api/v2/organizations/:name/runners
GET    /api/v2/organizations/:name/runners/:id
DELETE /api/v2/organizations/:name/runners/:id
PATCH  /api/v2/organizations/:name/runners/:id  (update labels, description)
```

#### List Runners
```json
// GET /api/v2/organizations/:name/runners
// Response follows JSON:API format (TFE-compatible)
{
    "data": [
        {
            "type": "runners",
            "id": "uuid",
            "attributes": {
                "name": "prod-runner-01",
                "agent_pool_id": "uuid",
                "runner_type": "combined",
                "status": "online",
                "hostname": "runner-prod-01.internal",
                "ip_address": "10.0.1.50",
                "os_type": "Linux",
                "os_version": "Ubuntu 22.04",
                "agent_version": "1.0.0",
                "terraform_version": "1.5.7",
                "ansible_version": "2.15.0",
                "available_collections": ["community.general", "ansible.posix"],
                "labels": ["production", "high-memory"],
                "max_concurrent_jobs": 4,
                "current_jobs": 1,
                "last_heartbeat_at": "2025-01-01T12:00:00Z",
                "registered_at": "2024-06-01T00:00:00Z"
            }
        }
    ]
}
```

### Runner Agent API (used by runner agents)

**Note**: These endpoints are internal to StackWeaver and are NOT part of the TFE API spec. They use `/api/v2/` for consistency but are StackWeaver-specific.

**Route Registration**: See `backend/internal/api/v2/routes/routes.go` for route patterns
**Handler Implementation**: See `backend/internal/api/v2/handlers/runners.go` (to be created)

```
POST   /api/v2/runner/register      # Register new runner with API key
POST   /api/v2/runner/heartbeat     # Send heartbeat, get pending jobs
GET    /api/v2/runner/jobs/:id/status   # Get run/job status (for cancellation polling)
GET    /api/v2/runner/jobs/:id/artifacts
POST   /api/v2/runner/jobs/:id/start
POST   /api/v2/runner/jobs/:id/output
POST   /api/v2/runner/jobs/:id/complete
```

#### Cancellation

Cancellation is important for both Terraform runs and Ansible jobs. When a user cancels a run or job in the UI, the API sets the run/job status to `canceled`. Self-hosted runners do not receive a push notification; they must **poll for cancellation** during execution.

- **GET /api/v2/runner/jobs/:id/status** — Returns `{"status": "<status>"}` for the run or job. For Terraform jobs (id is run id, e.g. `run-xxx`) the value is the run status (e.g. `canceled`, `applying`). For Ansible jobs (id is job UUID) the value is the job status (e.g. `canceled`, `running`). Authenticated with the same runner token as other job endpoints.

- **Agent behavior**: Both the Terraform and Ansible self-hosted runners poll this endpoint every 2 seconds while executing a job. When the status is `canceled`, the runner cancels the execution context, which terminates the Terraform or Ansible process, then reports completion with status `canceled` via `POST /api/v2/runner/jobs/:id/complete`. The run/job remains in a canceled state and is not overwritten to applied/successful.

- **Rebuilding**: After changes to cancellation (API endpoint or agent polling logic), rebuild and redeploy the **API** (for the status endpoint) and the **runner image** you use (Terraform and/or Ansible) so the agent binary includes the polling logic.

#### Register Runner
```json
// POST /api/v2/runner/register
// Header: Authorization: Bearer tfe-xxx... (existing API key with runner:register scope)
{
    "agent_pool_id": "uuid",
    "name": "prod-runner-01",
    "hostname": "runner-prod-01.internal",
    "os_type": "Linux",
    "os_version": "Ubuntu 22.04",
    "agent_version": "1.0.0",
    "terraform_version": "1.5.7",
    "ansible_version": "2.15.0",
    "available_collections": ["community.general", "ansible.posix"],
    "max_concurrent_jobs": 4,
    "labels": ["production"]
}

// Response
{
    "runner_id": "uuid",
    "runner_api_key": "tfe-xxx...",  // New API key scoped to this runner only
    "poll_interval_seconds": 10
}
```

**Note**: `agent_pool_id` is required. The runner registers into that pool; the pool must exist and belong to the organization implied by the API key scopes. After registration, the runner receives a new API key scoped specifically to that runner (`runner:<runner_id>:*`). This key is used for subsequent heartbeats and job operations.

#### Heartbeat & Poll
```json
// POST /api/v2/runner/heartbeat
// Header: Authorization: Bearer tfe-xxx... (runner-specific API key)
{
    "runner_id": "uuid",
    "status": "online",  // or "busy"
    "current_jobs": 1,
    "available_capacity": 3
}

// Response (includes pending jobs)
{
    "pending_jobs": [
        {
            "job_id": "uuid",
            "job_type": "terraform_run",
            "workspace_id": "uuid",
            "workspace_name": "my-workspace",
            "run_type": "plan",
            "priority": 1
        }
    ]
}
```

### Ansible Configuration API

**Route Registration**: See `backend/internal/api/v2/routes/routes.go`
**Handler Implementation**: See `backend/internal/api/v2/handlers/ansible_configs.go` (to be created)

```
GET    /api/v2/organizations/:name/ansible-config
PUT    /api/v2/organizations/:name/ansible-config
GET    /api/v2/organizations/:name/projects/:project_name/ansible-config
PUT    /api/v2/organizations/:name/projects/:project_name/ansible-config
GET    /api/v2/organizations/:name/workspaces/:workspace_name/ansible-config
PUT    /api/v2/organizations/:name/workspaces/:workspace_name/ansible-config
```

**Priority**: Workspace config > Project config > Organization config (most specific wins)

### How Ansible Configuration Works

**Key Insight**: Ansible does NOT need the config file baked into the image. Ansible looks for `ansible.cfg` in this order:
1. `ANSIBLE_CONFIG` environment variable (path to config file)
2. `ansible.cfg` in the current working directory (where `ansible-playbook` is executed)
3. `~/.ansible.cfg` (user home directory)
4. `/etc/ansible/ansible.cfg` (system-wide)

**Implementation Approach**:

1. **Job Assignment**: When a job is assigned to a runner (platform-hosted or self-hosted), the backend determines which `ansible.cfg` to use:
   - Check if workspace has an `ansible_configs` entry
   - If not, check project
   - If not, check organization
   - If none exist, use default Ansible behavior

2. **Config Injection** (for both platform-hosted and self-hosted runners):
   - The backend includes the `ansible.cfg` content in the job payload/artifacts
   - The runner writes `ansible.cfg` to the **working directory** (where the playbook is located) before executing `ansible-playbook`
   - Since `ansible-playbook` runs from that directory, it automatically picks up the config file

3. **Code Changes Needed**:
   - **Backend** (`backend/cmd/ansible-runner/main.go:executeJob()`): 
     - Query `ansible_configs` table to get config for workspace/project/org
     - Write `ansible.cfg` to `workDir` before calling `runAnsiblePlaybook()`
   - **Self-hosted runners**: Same logic - when downloading job artifacts, include `ansible.cfg` and write it to the working directory

**Example Flow**:
```
1. User creates ansible.cfg for workspace "production" via UI
2. Job is created for workspace "production"
3. Backend queries: ansible_configs WHERE workspace_id = 'production'
4. If found, include config_content in job artifacts
5. Runner (platform or self-hosted) receives job
6. Runner writes ansible.cfg to /workspace/ansible-jobs/{job_id}/playbook/ansible.cfg
7. Runner executes: cd /workspace/ansible-jobs/{job_id}/playbook && ansible-playbook ...
8. Ansible automatically finds ansible.cfg in current directory
```

**Reference**: 
- See `backend/cmd/ansible-runner/main.go:runAnsiblePlaybook()` - the `workDir` is set to the playbook directory (line 785: `cmd.Dir = workDir`), so writing `ansible.cfg` there will work automatically
- See `backend/cmd/ansible-runner/main.go:buildAnsibleArgs()` - `workDir` is set to `filepath.Dir(absolutePlaybookPath)` (line 700), which is where the playbook is located

**Implementation Details**:
- **Platform-hosted**: Modify `backend/cmd/ansible-runner/main.go:executeJob()` to write `ansible.cfg` to `workDir` after line 397 (after `buildAnsibleArgs` determines `workDir`)
- **Self-hosted**: When downloading job artifacts via `/api/v2/runner/jobs/:id/artifacts`, include `ansible.cfg` content, then write it to the playbook directory before execution
- **No image changes needed**: The config is written at runtime, not baked into the image

---

## Frontend UI Design

**Implementation Reference**: See `frontend/src/pages/Settings/ApiKeys.tsx` for the existing Settings UI pattern that should be followed.

### Settings > Agent Pools Page

**Route**: `/app/:orgName/settings/agent-pools` (organization-scoped). Requires `org:manage-agent-pools`.

**Component Structure**: Follow the pattern from `frontend/src/pages/Settings/ApiKeys.tsx`. List pools; create/edit/delete; manage allowed/excluded workspaces and allowed projects per pool (e.g. detail page or modal). TFE provider resources `tfe_agent_pool`, `tfe_agent_pool_allowed_projects`, `tfe_agent_pool_allowed_workspaces`, `tfe_agent_pool_excluded_workspaces` can manage the same data via API.

### Settings > Runners Page

**Route**: `/app/:orgName/settings/runners` (organization-scoped, similar to other org settings)

**Component Structure**: Follow the pattern from `frontend/src/pages/Settings/ApiKeys.tsx`:
- Use same UI components (`Button`, `Input`, `Label`, etc. from `@/components/ui/`)
- Same layout structure and styling
- Consistent card-based design for runner list items

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Settings > Runners                                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Active Runners                                        [+ Add Runner]    │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 🟢 prod-runner-01   prod-pool   Combined   runner-prod-01.internal│   │
│  │    Ubuntu 22.04 • Terraform 1.5.7 • Ansible 2.15.0               │   │
│  │    Labels: production, high-memory                                │   │
│  │    Last seen: 5s ago • 1/4 jobs                          [⋮]     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 🟢 dev-runner-01    dev-pool    Terraform  runner-dev-01.internal │   │
│  │    Ubuntu 22.04 • Terraform 1.5.7                                │   │
│  │    Labels: development                                            │   │
│  │    Last seen: 12s ago • 0/2 jobs                         [⋮]     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 🔴 staging-runner-01  staging-pool  Ansible  runner-stg-01.internal│   │
│  │    Ubuntu 22.04 • Ansible 2.15.0                                 │   │
│  │    Labels: staging                                                │   │
│  │    Last seen: 5m ago (offline)                           [⋮]     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Add Runner Dialog

**Key Change**: Instead of generating a separate token, users create an API key through the existing Settings > API Keys UI with runner scopes, then use that key to register the runner. Runners must belong to an **agent pool**; create one under Settings > Agent Pools first if needed.

```
┌────────────────────────────────────────────────────────────────┐
│  Register a Self-Hosted Runner                            [×]  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. Create an API Key with Runner Scopes                      │
│  ───────────────────────────────────────────────────────────   │
│                                                                │
│  Go to Settings > API Keys and create a new key with:          │
│                                                                │
│  • Scope: Organization: [This Organization ▼]                 │
│  • Permissions: [✓] Runner: Register                           │
│                 [✓] Runner: Terraform (or Ansible/Combined)   │
│                                                                │
│  Or use an existing API key that has runner permissions.       │
│                                                                │
│  [Open API Keys Settings →]                                   │
│                                                                │
│  ───────────────────────────────────────────────────────────   │
│                                                                │
│  2. Run the Runner (same image as platform-hosted!)            │
│  ───────────────────────────────────────────────────────────   │
│                                                                │
│  Agent pool: [prod-pool ▼]  [Create pool →]                   │
│  API Key: [tfe-xxx...________________] [📋]                   │
│                                                                │
│  Ansible Runner:                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ docker run -d --restart unless-stopped \               │   │
│  │   -e RUNNER_MODE=agent \                              │   │
│  │   -e RUNNER_AGENT_POOL_ID=<pool-uuid> \                │   │
│  │   -e STACKWEAVER_TOKEN=tfe-xxx... \                  │   │
│  │   -e STACKWEAVER_SERVER=https://stackweaver.io \      │   │
│  │   -e RUNNER_NAME=my-ansible-runner \                  │   │
│  │   stackweaver/runner-ansible:latest                   │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                          [📋] │
│                                                                │
│  Terraform Runner:                                             │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ docker run -d --restart unless-stopped \               │   │
│  │   -e RUNNER_MODE=agent \                              │   │
│  │   -e RUNNER_AGENT_POOL_ID=<pool-uuid> \                │   │
│  │   -e STACKWEAVER_TOKEN=tfe-xxx... \                  │   │
│  │   -e STACKWEAVER_SERVER=https://stackweaver.io \      │   │
│  │   -e RUNNER_NAME=my-terraform-runner \                │   │
│  │   stackweaver/runner-terraform:latest                 │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                          [📋] │
│                                                                │
│  Kubernetes (Helm):                                            │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ helm install stackweaver-runner stackweaver/runner \  │   │
│  │   --set token=tfe-xxx... \                            │   │
│  │   --set agentPoolId=<pool-uuid> \                     │   │
│  │   --set server=https://stackweaver.io                 │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                          [📋] │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Ansible Configuration UI

**Location**: Settings > Ansible Configuration (organization/project/workspace scoped)

**Implementation**: Follow the pattern from Settings pages, use a code editor component (similar to variable editing) for `ansible.cfg` content.

```
┌────────────────────────────────────────────────────────────────┐
│  Settings > Ansible Configuration                          [×]  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Configuration Scope: [Organization ▼]                        │
│                                                                │
│  Priority: Workspace > Project > Organization                  │
│  (Most specific configuration wins)                            │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ [defaults]                                              │   │
│  │ inventory = ./inventory.ini                            │   │
│  │ remote_user = ansible                                    │   │
│  │                                                          │   │
│  │ [privilege_escalation]                                  │   │
│  │ become = True                                            │   │
│  │ become_method = sudo                                     │   │
│  │                                                          │   │
│  │ [inventory]                                              │   │
│  │ enable_plugins = host_list, script, auto, yaml, ini     │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│  [Save Configuration]                                           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Runner Detail Page

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Runners / prod-runner-01                              [Delete Runner] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  🟢 Online                                                               │
│                                                                          │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────────┐ │
│  │ System Info         │  │ Capabilities        │  │ Current Load     │ │
│  ├─────────────────────┤  ├─────────────────────┤  ├──────────────────┤ │
│  │ Host: runner-prod   │  │ Type: Combined      │  │ ████████░░ 3/4   │ │
│  │ OS: Ubuntu 22.04    │  │ TF: 1.5.7          │  │ jobs running     │ │
│  │ IP: 10.0.1.50       │  │ Ansible: 2.15.0    │  │                  │ │
│  │ Agent: 1.0.0        │  │                     │  │ Last heartbeat:  │ │
│  │ Registered: 6mo ago │  │ Collections:        │  │ 5 seconds ago    │ │
│  │                     │  │ • community.general │  │                  │ │
│  │                     │  │ • ansible.posix     │  │                  │ │
│  │                     │  │ • kubernetes.core   │  │                  │ │
│  └─────────────────────┘  └─────────────────────┘  └──────────────────┘ │
│                                                                          │
│  Labels: [production] [high-memory] [+ Add Label]                        │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  Recent Jobs                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Job ID          │ Type      │ Workspace       │ Status  │ Duration │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │ run-abc123      │ TF Plan   │ production      │ ✓ Done  │ 2m 34s   │ │
│  │ job-def456      │ Ansible   │ deploy-servers  │ Running │ 1m 12s   │ │
│  │ run-ghi789      │ TF Apply  │ staging         │ ✓ Done  │ 5m 01s   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Runner Image Agent Mode

### Key Principle: Same Image, Different Mode

The self-hosted runner is **NOT** a separate binary or Docker image. It's the exact same `runner-images/ansible/` and `runner-images/terraform/` images with an **agent mode** flag.

```bash
# Platform-hosted (current) - Orchestrator calls this:
docker run stackweaver/runner-ansible:latest \
  --playbook /workspace/playbook.yml \
  --inventory /workspace/inventory.ini

# Self-hosted (new) - User runs this on their infrastructure:
docker run -d stackweaver/runner-ansible:latest \
  --mode agent \
  --token tfe-xxx... \
  --server https://stackweaver.io \
  --name my-runner
```

### Changes to Existing Runner Images

Minimal changes needed to `runner-images/`:

```go
// runner-images/ansible/main.go (pseudocode)
func main() {
    if os.Getenv("RUNNER_MODE") == "agent" || hasFlag("--mode", "agent") {
        // Agent mode: poll for jobs
        runAgentMode()
    } else {
        // Direct mode: execute job immediately (current behavior)
        runDirectMode()
    }
}

func runAgentMode() {
    // 1. Register with server
    register(serverURL, token, detectCapabilities())
    
    // 2. Poll loop
    for {
        jobs := pollForJobs()
        for _, job := range jobs {
            // 3. Execute using same code path as direct mode
            executeJob(job)
        }
        time.Sleep(pollInterval)
    }
}
```

### Agent Mode Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│              Runner Container (Agent Mode) Lifecycle             │
└─────────────────────────────────────────────────────────────────┘

1. STARTUP (--mode agent)
   ├── Detect capabilities (ansible version, collections, etc.)
   ├── POST /api/v2/runner/register (agent_pool_id, name, ...; API key with runner:register scope)
   └── Receive runner_id, runner-specific API key, and poll_interval

2. MAIN LOOP
   ├── POST /api/v2/runner/heartbeat (every 10s, using runner-specific API key)
   │   └── Response contains pending_jobs[]
   │
   ├── If pending job assigned:
   │   ├── Download job artifacts (playbook, inventory, vars, ansible.cfg content if configured)
   │   ├── Write ansible.cfg to playbook working directory (if provided)
   │   ├── Execute using SAME code as platform-hosted
   │   ├── Stream output via POST /api/v2/runner/jobs/:id/output
   │   └── POST /api/v2/runner/jobs/:id/complete with results
   │
   └── Handle SIGTERM (graceful shutdown, drain jobs)

3. SHUTDOWN
   ├── Stop accepting new jobs
   ├── Wait for current job to complete
   └── POST /api/v2/runner/deregister
```

### Environment Variables (Agent Mode)

```bash
# Required
RUNNER_MODE=agent
STACKWEAVER_TOKEN=tfe-xxx...       # API key with runner:register scope (from Settings > API Keys)
STACKWEAVER_SERVER=https://stackweaver.io

# Optional
RUNNER_AGENT_POOL_ID=uuid          # Required when registering; pool must exist in org
RUNNER_NAME=my-runner-01           # Default: hostname
RUNNER_LABELS=production,gpu       # Comma-separated
MAX_CONCURRENT_JOBS=4              # Default: 1
POLL_INTERVAL=10s                  # Default: 10s
```

**Note**: The `STACKWEAVER_TOKEN` is a standard API key (format: `tfe-xxx...`) created through Settings > API Keys with appropriate runner scopes. This maintains consistency with the existing authentication system.

---

## Implementation Phases

### Phase 1: Agent Pools & Backend API & Database (Week 1) ✅

**Backend — Agent Pools (TFE-compatible, first):**
- [x] Create database migrations for `agent_pools`, `agent_pool_allowed_workspaces`, `agent_pool_allowed_projects`, `agent_pool_excluded_workspaces`
- [x] Implement agent pool repository and handlers (see go-tfe `agent_pool.go`, terraform-provider-tfe `resource_tfe_agent_pool*`)
- [x] Implement `GET/POST /api/v2/organizations/:name/agent-pools`, `GET/PATCH/DELETE /api/v2/agent-pools/:id`
- [x] Implement `UpdateAllowedWorkspaces`, `UpdateAllowedProjects`, `UpdateExcludedWorkspaces` (PATCH with relation payloads; empty array clears)
- [x] Implement `GET /api/v2/agent-pools/:id/agents` (list runners in pool; map to TFE Agent shape)
- [x] Enforce `org:manage-agent-pools` on agent pool mutations and list

**Backend — Runners & Ansible config:**
- [x] Create database migrations for `runners` (with `agent_pool_id`), `runner_job_executions`, `ansible_configs`
- [x] Extend API key service to support runner scopes (`runner:register`, `runner:terraform`, etc.)
- [x] Implement runner CRUD repository and handlers (see `backend/internal/repository/` and `backend/internal/api/v2/handlers/` patterns)
- [x] Implement `/api/v2/runner/register` endpoint (`agent_pool_id` required; uses existing API key authentication)
- [x] Implement `/api/v2/runner/heartbeat` endpoint (returns pending jobs)
- [x] Add background job to mark runners offline after 30s without heartbeat (`runner.MonitorService`)
- [x] Implement Ansible config CRUD endpoints (`GET/PUT/DELETE /organizations/:name/ansible-config`, `/projects/:id/ansible-config`)

**Frontend:**
- [x] Add Settings > Agent Pools page (list/create/delete pools; manage allowed/excluded workspaces and allowed projects)
- [x] Add Settings > Runners page route (follow `frontend/src/pages/Settings/ApiKeys.tsx` pattern)
- [x] Create runner list component with status indicators and pool column (use existing UI components)
- [x] Update API Keys UI to show runner scope options when creating keys
- [x] Create runner registration dialog (include agent pool selector) with setup instructions
- [x] Add Ansible Configuration page in Settings (organization/project scoped)
  - Use code editor component (Textarea with font-mono) for `ansible.cfg` content
  - Show priority indicator (project > org)
  - Follow JSON:API format for API calls
  - TODO: add syntax highlighting
  - TODO: figure out how to make this gitops compatible -> allow the option to supply one in the image aswell

### Phase 2: Agent Mode in Runner Images (Week 2) ✅

**Runner Images (`runner-images/`):**
- [x] Add agent mode detection to `backend/cmd/ansible-runner/main.go` (`RUNNER_MODE=agent`)
- [x] Implement registration on startup (`RUNNER_AGENT_POOL_ID`, `STACKWEAVER_TOKEN`, `STACKWEAVER_SERVER`)
- [x] Implement heartbeat loop (poll for jobs)
- [x] Implement job download and execution (`downloadJobArtifacts`, `runAnsiblePlaybook`)
- [x] Stream output back to API during execution (`streamWriter`, `sendJobOutput`)
- [x] Same changes for `backend/cmd/runner/` (terraform runner agent mode)
  - Added `RUNNER_MODE=agent` detection in main.go
  - Created agent_mode.go with register, heartbeat, job execution

**Backend:**
- [x] Implement `/api/v2/runner/jobs/:id/start` endpoint
- [x] Implement `/api/v2/runner/jobs/:id/output` endpoint (receives output, needs storage integration)
- [x] Implement `/api/v2/runner/jobs/:id/complete` endpoint
- [x] Add job artifact download endpoint (`GET /api/v2/runner/jobs/:id/artifacts`)
- [x] Modify `backend/cmd/ansible-runner/main.go:executeJob()` to:
  - Query `ansible_configs` table (workspace > project > org priority)
  - Write `ansible.cfg` to `workDir` before executing ansible-playbook
- [x] Self-hosted runner agent: Write `ansible.cfg` to playbook directory when downloading job artifacts

### Phase 3: Job Routing & UI (Week 3) ✅

**Backend:**
- [x] Add `runner_id` and `agent_pool_id` fields to `ansible_jobs` and `runs` tables
- [x] Job routing service (`runner.RoutingService`) with pool scoping (allowed/excluded workspaces, allowed projects)
- [x] Pending job query for heartbeat response (`findPendingJobsForRunner`)
- [x] Modify orchestrator to check for available self-hosted runners when workspace `execution_mode` is `agent` and `agent_pool_id` is set
  - Orchestrator skips Redis enqueue for runs with agent pool, assigns agent_pool_id to run
  - Terraform runs use workspace `agent_pool_id`
  - Ansible jobs use job template `agent_pool_id` (assigned via UI, propagated to job on launch — see Phase 4)

**Frontend:**
- [x] Runner detail page with system info, capabilities, labels, and pool link
- [x] Link from runner list to detail page
- [x] Show "Runner" and "Agent pool" on job detail pages (Ansible jobs)
- [x] Show "Runner" and "Agent pool" on run detail page in the header (Terraform runs)
- [x] Add job history to runner detail
- [x] Real-time status updates via polling (Runners list & detail pages, 10s interval)

### Phase 4: Job Template → Agent Pool Assignment & Runner Type Filtering (Week 4) ✅

**Backend:**
- [x] Add `AgentPoolID` field to `AnsibleJobTemplate` model (`backend/internal/models/ansible_playbook.go`)
- [x] Add `agent-pool` relationship to job template create/update API handlers (`backend/internal/api/v2/handlers/ansible/playbooks.go`)
- [x] Propagate `agent_pool_id` from job template → `AnsibleJob` when launching (`backend/internal/services/ansible/job.go:LaunchFromTemplate`)
- [x] Include `agent-pool` relationship in job template JSON:API responses (`formatJobTemplateResponse`)
- [x] Fix auth middleware to set `api_key_id` and `api_key_scopes` in Gin context for runner registration (`backend/internal/services/auth/service.go`)
- [x] Label-based job routing (e.g., job needs `gpu` label) - `FindAvailableRunner` with `HasAllLabels`
- [ ] Runner token rotation

**Frontend:**
- [x] Add "Agent Pool" dropdown to Job Template create dialog (`frontend/src/pages/Ansible/JobTemplates.tsx`)
- [x] Add "Agent Pool" dropdown to Job Template edit dialog (`frontend/src/pages/Ansible/JobTemplateDetail.tsx`)
- [x] Wire `agent_pool_id` through frontend API client and JSON:API parser (`frontend/src/api/ansible.ts`, `frontend/src/utils/ansible-jsonapi.ts`)
- [x] Label management UI on runner detail (edit dialog with labels)
- [x] Runner metrics (jobs completed, success rate, avg duration)
- [ ] Bulk runner operations (delete, update labels)
- [x] Show runners in agent pool (expandable table, read-only, links to runner detail)

### Phase 5: Agent Mode Execution Pipeline & Bug Fixes (Week 5) ✅

**Critical routing fix — jobs always going to platform runners:**
- [x] `LaunchJob` now conditionally enqueues: only jobs without `AgentPoolID` go to Redis queue; jobs with a pool stay `pending` for heartbeat pickup (`backend/internal/services/ansible/job.go`)
- [x] `findPendingJobsForRunner` creates `RunnerJobExecution` records when assigning jobs to runners (`backend/internal/api/v2/handlers/runner_agent.go`)

**VCS repository cloning in agent mode:**
- [x] Artifacts endpoint now includes VCS clone info (authenticated URL, branch, repo name) from VCS connection (`GetJobArtifacts` in `runner_agent.go`)
- [x] Agent clones VCS repository before running playbook (`cloneRepo` in `agent_mode.go`)
- [x] Playbook path resolved as absolute path within cloned repo
- [x] Working directory set to playbook's parent for relative path resolution (roles, group_vars, etc.)

**JSONL event streaming for agent mode:**
- [x] Agent mode now uses `ANSIBLE_STDOUT_CALLBACK=ansible.posix.jsonl` for structured output (`agent_mode.go`)
- [x] Server `JobOutput` handler parses JSONL lines and creates structured `AnsibleJobEvent` records (`parseAndStoreAgentEvent` in `runner_agent.go`)
- [x] Host facts, task details, and playbook stats now available for agent-executed jobs (Host Facts tab restored)
- [x] `v2_playbook_on_stats` events update job host stats on the server

**Job lifecycle management:**
- [x] `JobStart` handler updates `AnsibleJob.Status` → running, sets `StartedAt` and `RunnerID`
- [x] `JobComplete` handler updates `AnsibleJob.Status` → successful/failed/canceled, sets `FinishedAt`, counts warnings

**Relaunch routing fix:**
- [x] `RelaunchJob` now preserves `AgentPoolID` from original job (`backend/internal/services/ansible/job.go`)

**Job detail agent pool visibility:**
- [x] Backend `formatJobResponse` includes `agent-pool` and `runner` relationships with name attributes
- [x] Repository preloads `AgentPool` and `Runner` relations for job queries
- [x] Frontend parser extracts `agent_pool_id`, `agent_pool_name`, `runner_id`, `runner_name`
- [x] Job detail "Details" tab shows Agent Pool and Runner with icons

**Runner delete cascade:**
- [x] `RunnerRepository.Delete` runs in a transaction: deletes `runner_job_executions` for the runner, nullifies `runner_id` on `ansible_jobs`, then deletes the runner (`backend/internal/repository/runner.go`)

**Organization / project / workspace delete cascade:**
- [x] Removed `OnDelete:CASCADE` from agent pool many-to-many relations in `AgentPool` model to avoid DB-level cascade issues (`backend/internal/models/agent_pool.go`)
- [x] `ProjectRepository.Delete` explicitly deletes from `agent_pool_allowed_projects` before deleting the project (`backend/internal/repository/project.go`)
- [x] `WorkspaceRepository.Delete` explicitly deletes from `agent_pool_allowed_workspaces` and `agent_pool_excluded_workspaces` before deleting the workspace (`backend/internal/repository/workspace.go`)

---

## Branch Sitrep: Self-Hosted Runners (Current Implementation)

**Summary**: Both Ansible and Terraform self-hosted runners are implemented end-to-end. Ansible runners are tested and working in production. Terraform runners have full frontend and backend support and are ready for testing.

### Ansible Self-Hosted Runners — Done & Working

- **Backend**: Runner agent API (`/api/v2/runner/*`), job artifacts endpoint with credential decryption, inventory generation, and VCS clone info.
- **Credential handling**:
  - **Encryption key**: Runner agent uses the same encryption key as Ansible credentials (`ANSIBLE_ENCRYPTION_KEY` or `ENCRYPTION_KEY`). Previously the runner used only `ENCRYPTION_KEY`, so credentials were never decrypted or sent when only `ANSIBLE_ENCRYPTION_KEY` was set — fixed in `backend/internal/api/v2/routes/routes.go` by creating `runnerCryptoSvc` from `encryptionKeyBytes`.
  - **Username**: Credential username is injected into the inventory as `ansible_user` and set as `ANSIBLE_REMOTE_USER` in the agent so the runner does not fall back to the process user (e.g. `iac`). See `injectUserIntoInventory` in `runner_agent.go` and agent `-u` / env in `agent_mode.go`.
  - **Password**: For Machine SSH, decrypted password is injected into the inventory as `ansible_password`. Inventory is written as **`inventory.json`** so Ansible parses it as JSON and picks up host vars; writing as `inventory` (no extension) could be parsed as INI and drop vars.
  - **sshpass**: SSH password auth requires `sshpass` on the runner; the agent checks for it and fails with a clear message if missing.
- **Diagnostics**: Agent logs inventory size, presence of `ansible_user`/`ansible_password`, credential summary (type, has username/password/ssh_key), and extra vars keys (to spot overrides).
- **Frontend**: Settings > Runners, Runner detail, Agent Pools, Job Template agent pool dropdown, Job detail shows runner/agent pool. Credential edit allows changing username and resetting password for Machine SSH.

### Terraform Self-Hosted Runners — Implemented & Tested

- **Frontend — Workspace Agent Pool Assignment**:
  - `CreateWorkspaceDialog` and `EditWorkspaceDialog` now show an "Agent Pool" dropdown when `execution_mode=agent`. Pools are fetched from `agentPoolsApi.list()` on dialog open.
  - `Workspace` interface and API client include `agent_pool_id` in create/update payloads (`frontend/src/api/client.ts`).
  - When execution mode is changed away from "agent", the agent pool selection is cleared.
  - Workspace detail page shows agent pool name in metadata row (with `Server` icon) for agent-mode workspaces.
  - Run detail page shows the specific runner name (not pool name) that executed each run.
- **Backend — Workspace Handler**:
  - Full TFE `tfe_workspace` attribute support: `name`, `description`, `terraform-version`, `auto-apply`, `auto-apply-run-trigger`, `allow-destroy-plan`, `queue-all-runs`, `speculative-enabled`, `file-triggers-enabled`, `trigger-prefixes`, `trigger-patterns`, `global-remote-state`, `structured-run-output-enabled`, `assessments-enabled`, `source-name`, `source-url`, `tag-names`, `working-directory`, `execution-mode`, `agent-pool-id`.
  - VCS repo block support: `identifier`, `branch` (defaults to `main`), `github-app-installation-id`, `oauth-token-id`, `ingress-submodules`, `tags-regex`.
  - `formatWorkspaceResponse` returns all attributes from model (no hardcoded values for booleans).
  - Organization relationship included (required by `go-tfe` client to prevent nil pointer dereference).
- **Backend — Run Creation for Agent Workspaces**:
  - Platform skips VCS cloning for `execution_mode=agent` workspaces — the self-hosted runner handles its own VCS clone.
  - `AgentPoolID` is explicitly set on the `Run` model during creation for proper job routing.
- **Backend — Heartbeat Dispatch for Terraform Runs**:
  - `findPendingJobsForRunner` queries both Ansible jobs AND Terraform runs, filtered by runner type capabilities.
  - Heartbeat handler derives `availableCapacity` from runner's `max_concurrent_jobs` if not explicitly provided.
  - Terraform runs include `run_type` (plan/apply/destroy) in the `PendingJob` response.
- **Backend — Terraform Run Artifacts** (`getTerraformRunArtifacts`):
  - Returns configuration tarball (base64-encoded from MinIO), or VCS info for cloning if no config version exists.
  - VCS clone URL includes fresh GitHub App installation token (generated per-request via `GenerateInstallationToken`).
  - Returns Terraform variables and environment variables from the variable service, respecting variable set precedence.
  - Returns `terraform_version` and `working_directory` from workspace metadata.
- **Backend — JobStart/JobComplete for Terraform Runs**:
  - ID-based routing: if job ID starts with `run-`, the Terraform handler is called; otherwise UUID parse for Ansible.
  - `JobStart`: Updates run status to `planning` (from pending) or records `ApplyStartedAt` (from applying). Sets `RunnerID`.
  - `JobComplete`: Handles plan/apply completion, failure (stores `ErrorMessage` or `Output` for UI display), and cancellation. Uses `Output` as fallback for `ErrorMessage` when runner sends error details.
- **Backend — Runner Registration**:
  - Supports re-registration: if a runner with the same name already exists (e.g. container restart), the existing entry is updated and reused instead of returning 409 Conflict.
- **Backend — JobOutput for Terraform Runs**:
  - Terraform output is stored in MinIO logs (`runs/{runID}/logs/{phase}.log`) appended per output chunk.
  - Supports plan, apply, and destroy phase log streams — runner sends `stream` field ("plan", "apply", or "destroy") to route output to the correct log file.
- **Backend — Runner Deletion**:
  - Runner delete correctly nullifies `runner_id` on both `ansible_jobs` and `runs` tables to prevent foreign key constraint errors.
- **Backend — Workspace Force Delete (TFE-compatible)**:
  - `ForceDelete` boolean field on workspace model (TFE `force_delete` attribute).
  - Delete handler checks both `?force=true` query param and the workspace's `ForceDelete` attribute.
  - `DeleteByID`, `SafeDelete`, `SafeDeleteByID` endpoints for TFE API compatibility.
  - Frontend: Delete dialog with force delete mode (workspace name confirmation required). Edit workspace dialog has "Destruction and Deletion" section with force delete toggle.
- **Runner Agent** (`backend/cmd/runner/agent_mode.go`):
  - Updated `TFJobArtifacts` struct with `WorkingDirectory`, `VCS` info, and base64 string config tarball.
  - `runTerraform`: extracts config tarball OR clones VCS repo, handles working directory, writes `stackweaver.auto.tfvars` from variables, replaces remote/cloud backend with local backend, runs `terraform init -reconfigure` before plan/apply/destroy.
  - `replaceRemoteBackendForAgent`: Uses brace-counting parser (`removeHCLBlock`) to properly remove entire `cloud { ... }` and `backend "remote" { ... }` blocks, replacing with `backend "local" {}`. Previous simple string replacement produced invalid HCL.
  - Error propagation: When execution fails (clone, init, plan, apply), both the error and the captured command output are sent to the server via `error_message` field, ensuring error details are visible in the UI.
  - Clone URL logging: Masked token output for debugging VCS clone issues.
  - **Real-time log streaming**: `tfStreamWriter` streams output to server with correct `runner_id`, `stream` (phase), and `output` fields. Separate buffers for streaming (reset on flush) and full output accumulation (for return value). Final flush after command completes ensures no output is lost.
  - **Phase-aware streaming**: Log phase determined from job run type — "plan" for plan jobs, "apply" for apply jobs, "destroy" for destroy jobs — matching the backend's log retrieval expectations.
- **Frontend — Plan-and-Apply Confirmation**:
  - Fixed: "Plan and Apply" runs now correctly wait for user confirmation before applying (unless workspace has auto-apply enabled). Previously, all plan-and-apply runs auto-applied because the frontend conflated the operation type with the auto-apply flag.
  - Frontend sends explicit `operation` field ("plan-only", "plan-and-apply", "destroy") and derives `auto_apply_after_plan` from the workspace's `auto_apply` setting.
- **Frontend — Cancelled Run Display**:
  - Fixed: Cancelled/discarded runs now show the apply phase as "cancelled" (grey) instead of "pending" on both platform and self-hosted runners.
- **Orchestrator**: Already assigns `AgentPoolID` to runs from workspace and skips Redis enqueue.

### Changes on This Branch (Representative)

| Area | Change |
|------|--------|
| Routes | Runner agent handler wired with `variableService` and `configStorageClient` for Terraform artifacts; crypto service uses same key as Ansible credentials (`encryptionKeyBytes`) |
| Runner agent API | `findPendingJobsForRunner` queries Terraform runs in addition to Ansible jobs; `GetJobArtifacts` dispatches to `getTerraformRunArtifacts` for `run-*` IDs; `JobStart`/`JobComplete`/`JobOutput` handle both Ansible (UUID) and Terraform (`run-*`) job IDs; re-registration support for existing runners; `JobOutput` phase routing for plan/apply/destroy streams |
| Workspace handler | Full TFE `tfe_workspace` attribute support (all boolean/list/string attributes in create/update/response); VCS repo block with `branch`, `ingress-submodules`, `tags-regex`; `force_delete` attribute and force delete endpoint |
| Terraform runner agent | Full tarball extraction, VCS clone with masked URL logging, brace-counting backend replacement (`removeHCLBlock`), `terraform init -reconfigure`, error propagation with command output, phase-aware real-time log streaming (plan/apply/destroy) |
| Run creation | Skips platform VCS clone for agent-mode workspaces; sets `AgentPoolID` on runs for job routing; explicit `operation` field support for correct plan-and-apply flow |
| Error visibility | `JobCompleteRequest` includes `Output` field; `jobCompleteTerraformRun` uses `Output` as fallback for `ErrorMessage` |
| Runner deletion | Nullifies `runner_id` on `runs` and `ansible_jobs` tables before deleting runner to prevent FK violations |
| Workspace force delete | `ForceDelete` field on `Workspace` model; frontend force delete dialog with name confirmation; TFE-compatible delete endpoints |
| Logging | All `fmt.Printf` calls replaced with `github.com/michielvha/logger` package throughout handler files |
| Ansible-runner agent | Write inventory as `inventory.json`; set `ANSIBLE_REMOTE_USER` when credential has username; check for `sshpass` when using password auth; diagnostic logging for credential/inventory/extra vars |
| Workspace UI (frontend) | Agent Pool dropdown in CreateWorkspaceDialog and EditWorkspaceDialog when execution_mode=agent; agent pool in metadata row; runner name in run detail; force delete dialog |
| Run UI (frontend) | Plan-and-apply confirmation respects workspace auto-apply setting; cancelled runs show "cancelled" apply phase; explicit operation type in run creation |
| Credentials (frontend) | Edit credential: allow changing username for SSH/Machine SSH; allow resetting password for Machine SSH (new + confirm, no view of current) |
| Credentials (API) | Update credential API sends `username` and optional `password` in PATCH body |

---

## Security Considerations

1. **API Key Security** (reusing existing system)
   - API keys are hashed (bcrypt) before storage - see `backend/internal/services/apikey/service.go:HashKey()`
   - Keys only shown once on creation - see `backend/internal/api/handlers/apikey.go:CreateAPIKey()`
   - Keys can be revoked immediately through Settings > API Keys
   - Support for key expiration - see `backend/internal/models/api_key.go:IsExpired()`
   - Scope-based permissions ensure runners only have necessary access

2. **Runner Authentication**
   - Runners register using API keys with `runner:register` scope
   - After registration, runners receive a new API key scoped specifically to that runner
   - Runner-specific keys are scoped to `runner:<runner_id>:*` for least privilege
   - Keys can be rotated through the existing API key management UI

3. **Network Security**
   - Runners initiate all connections (outbound only)
   - No inbound ports required on runner
   - TLS required for all API communication

4. **Job Security**
   - Jobs include workspace secrets only when assigned to runner
   - Secrets never stored on runner disk
   - Job artifacts cleaned up after completion

---

## Monitoring & Observability

### Metrics to Track

- `runners_total` - Total registered runners
- `runners_online` - Currently online runners
- `runner_heartbeat_latency` - Time between heartbeats
- `runner_job_duration` - Job execution time by runner
- `runner_job_queue_length` - Pending jobs per runner type

### Health Checks

- Runner marked offline after 30s without heartbeat
- Alert if no runners available for job type
- Alert if job wait time exceeds threshold

---

## Future Enhancements

1. **Agent Pools**: Implemented as part of this design (TFE-compatible pools, scoping, runner membership).
2. ~~**Terraform Workspace → Agent Pool UI**~~: Done — agent pool selector added to workspace create/edit dialogs.
3. ~~**Terraform Heartbeat Dispatch**~~: Done — `findPendingJobsForRunner` queries Terraform runs; full artifact/execution flow implemented.
4. **Auto-scaling**: Integration with cloud providers to auto-scale runner capacity per pool
5. **Runner Logs**: Central collection of runner agent logs (Terraform logs currently stored in MinIO per-run)
6. **Custom Runner Images**: Support for custom Docker images with pre-installed tools
7. **Workspace Affinity**: Pin workspaces to specific runners for caching benefits
8. **TFE Agent Token** (`tfe_agent_token`): Implement pool-scoped tokens for TFE provider compatibility. See `docs/internal/tfe-compatibility/resources/tfe_agent_token.md` for analysis.
9. **Workspace Run Detail**: Show agent pool and runner info on run detail page when `execution_mode=agent`
10. **Terraform State Management for Agents**: Self-hosted runners currently use local state; integrate with StackWeaver state service for remote state storage and locking.

---

## Notes

### Background Heartbeat Monitor

The repository already has `MarkOfflineIfStale(threshold)`. Implement a background goroutine in the API server:

```go
// Run every 30 seconds
func (s *RunnerMonitorService) MarkStaleRunners() {
    threshold := 30 * time.Second
    count, _ := s.runnerRepo.MarkOfflineIfStale(threshold)
    if count > 0 {
        log.Infof("Marked %d runners as offline (no heartbeat)", count)
    }
}
```


the workspace implementation should be compatible with: https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/workspace_settings