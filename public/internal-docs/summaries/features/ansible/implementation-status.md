<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Implementation Status

## Phase Overview

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Complete | Core Infrastructure MVP |
| Phase 1.5 | ✅ Complete | VCS Sync Implementation |
| Phase 1.6 | ✅ Complete | UX Improvements & Bug Fixes |
| Phase 1.7 | ✅ Complete | Job Event Parsing & UI |
| Phase 1.8 | ✅ Complete | Schedules API & Compact Job UI |
| Phase 1.9 | ✅ Complete | Event Type Fix & Enhanced Warnings |
| Phase 2 | 🔄 In Progress | Enhanced Features |
| Phase 2.5 | ✅ Complete | Usability Improvements |
| Phase 3 | ⏳ Planned | Advanced Integration |

## Phase 1: Core Infrastructure ✅

### Data Models

| File | Models | Status |
|------|--------|--------|
| `ansible_inventory.go` | `AnsibleInventory`, `AnsibleInventoryHost`, `AnsibleInventoryGroup`, `InventoryVariables` | ✅ Complete |
| `ansible_playbook.go` | `AnsiblePlaybook`, `AnsibleJobTemplate` | ✅ Complete |
| `ansible_job.go` | `AnsibleJob`, `AnsibleJobEvent`, `JobExtraVars` | ✅ Complete |
| `ansible_credential.go` | `AnsibleCredential` | ✅ Complete |

### Repositories

| File | Repositories | Status |
|------|--------------|--------|
| `ansible_inventory.go` | `AnsibleInventoryRepository` | ✅ Complete |
| `ansible_playbook.go` | `AnsiblePlaybookRepository`, `AnsibleJobTemplateRepository` | ✅ Complete |
| `ansible_job.go` | `AnsibleJobRepository` | ✅ Complete |
| `ansible_credential.go` | `AnsibleCredentialRepository` | ✅ Complete |

### Services

| File | Service | Status |
|------|---------|--------|
| `credential.go` | `CredentialService` | ✅ Complete |
| `inventory.go` | `InventoryService` | ✅ Complete |
| `job.go` | `JobService` | ✅ Complete |
| `scheduler.go` | `SchedulerService` | ✅ Complete |
| `inventory_source.go` | `InventorySourceService` | ✅ Complete |

### API Handlers

| File | Handler | Status |
|------|---------|--------|
| `inventories.go` | `InventoryHandler` | ✅ Complete |
| `hosts.go` | `HostHandler` | ✅ Complete |
| `groups.go` | `GroupHandler` | ✅ Complete |
| `credentials.go` | `CredentialHandler` | ✅ Complete |
| `playbooks.go` | `PlaybookHandler` | ✅ Complete |
| `jobs.go` | `JobHandler` | ✅ Complete |
| `schedules.go` | `ScheduleHandler` | ✅ Complete |
| `inventory_sources.go` | `InventorySourceHandler` | ✅ Complete |

### Frontend Pages

| Page | Description | Status |
|------|-------------|--------|
| Inventories | List, create, search, filter | ✅ Complete |
| InventoryDetail | Edit, manage hosts/groups/sources | ✅ Complete |
| Credentials | CRUD with type-specific forms | ✅ Complete |
| Playbooks | List, VCS sync, YAML viewer | ✅ Complete |
| PlaybookDetail | Content viewer, templates, jobs | ✅ Complete |
| JobTemplates | List, launch, detail view | ✅ Complete |
| Jobs | List with status badges | ✅ Complete |
| JobDetail | Output, events, stats | ✅ Complete |
| Schedules | Cron management, run-now | ✅ Complete |

### Runner

| Feature | Status |
|---------|--------|
| Job queue processing | ✅ Complete |
| Playbook execution | ✅ Complete |
| Inventory generation | ✅ Complete |
| Credential handling | ✅ Complete |
| VCS sync worker (playbooks) | ✅ Complete |
| VCS sync worker (inventories) | ✅ Complete |
| Output parsing (JSON callback) | ✅ Complete |

## Phase 2: Enhanced Features 🔄

### Dynamic Inventories ✅

| Feature | Status |
|---------|--------|
| Inventory source model | ✅ Complete |
| AWS EC2 plugin integration | ✅ Complete |
| Azure plugin integration | ✅ Complete |
| GCP plugin integration | ✅ Complete |
| VMware plugin integration | ✅ Complete |
| Periodic sync | ✅ Complete |
| Frontend sources UI | ✅ Complete |

### Real-time Output Streaming ✅

| Feature | Status |
|---------|--------|
| JSONL callback | ✅ Complete |
| Line-by-line streaming | ✅ Complete |
| Incremental stats | ✅ Complete |
| WebSocket (optional) | ⏳ Deferred |

### Ansible Galaxy ✅

| Feature | Status |
|---------|--------|
| Pre-installed collections (essentials) | ✅ Complete |
| requirements.yml detection | ✅ Complete |
| Auto-install before execution | ✅ Complete |
| Galaxy install events | ✅ Complete |
| Collection caching | ✅ Complete |
| UI collection display | ✅ Complete |
| Collection version pinning (model) | ✅ Complete |
| Version pinning UI | ⏳ Planned |

## Phase 3: Advanced Integration ⏳

### Workflow Templates 🔄 In Progress

| Feature | Status |
|---------|--------|
| Workflow data model | ✅ Complete |
| Workflow repository | ✅ Complete |
| Workflow API handlers | ✅ Complete |
| Workflow routes | ✅ Complete |
| Frontend list page | ✅ Complete |
| Sidebar navigation | ✅ Complete |
| Execution engine | ⏳ Planned |
| Visual editor (React Flow) | ⏳ Planned |
| Conditional branching | ✅ Model ready |
| Approval gates | ✅ Model ready |

**Models Created**:
- `AnsibleWorkflow` - workflow template definition
- `AnsibleWorkflowNode` - nodes in workflow (job_template, workflow, inventory_sync, approval)
- `AnsibleWorkflowEdge` - connections between nodes (on_success, on_failure, always)
- `AnsibleWorkflowJob` - workflow job execution instance
- `AnsibleWorkflowNodeJob` - individual node execution status

**API Endpoints**:
- `GET/POST /api/v2/organizations/:name/ansible/workflows`
- `GET/PATCH/DELETE /api/v2/ansible/workflows/:id`
- `GET/POST /api/v2/ansible/workflows/:id/nodes`
- `GET/POST /api/v2/ansible/workflows/:id/edges`
- `PATCH/DELETE /api/v2/ansible/workflow-nodes/:id`
- `DELETE /api/v2/ansible/workflow-edges/:id`

### Surveys (Job Prompts) ⏳

| Feature | Status |
|---------|--------|
| Survey specification model | ⏳ Planned |
| Dynamic form generation | ⏳ Planned |
| Survey variable injection | ⏳ Planned |

### Notifications ⏳

| Feature | Status |
|---------|--------|
| Notification template model | ⏳ Planned |
| Slack integration | ⏳ Planned |
| Email integration | ⏳ Planned |
| Webhook integration | ⏳ Planned |

## AWX Feature Comparison

| AWX Feature | Status | Priority |
|-------------|--------|----------|
| Inventories (static) | ✅ Complete | P0 |
| Inventories (dynamic) | ✅ Complete | P1 |
| Credentials | ✅ Complete | P0 |
| Projects (Playbooks with VCS) | ✅ Complete | P0 |
| Project VCS Sync | ✅ Complete | P0 |
| Job Templates | ✅ Complete | P0 |
| Jobs | ✅ Complete | P0 |
| Job Events Streaming | ⚠️ Polling Only | P1 |
| Schedules (Cron) | ✅ Complete | P1 |
| Workflow Templates | 🔄 Backend Ready | P2 |
| Notifications | ⏳ Planned | P2 |
| Teams/RBAC | ⚠️ Basic Auth | P2 |
| Instance Groups | ⏳ Planned | P3 |
| Custom Credential Types | ⏳ Planned | P3 |
| Surveys (Job Prompts) | ⏳ Planned | P2 |

## Known Limitations

1. **Polling-based updates**: No WebSocket streaming yet (3-second polling, works well)
2. **Basic RBAC**: Uses platform-level auth, no Ansible-specific permissions
3. **Single runner**: No instance groups or execution environments yet
4. **No approval gates**: Model ready, UI pending
5. **Workflow visual builder pending**: API ready, React Flow UI in progress

## Recent Fixes

### January 2025

- ✅ Workflow Templates backend complete (models, repository, handlers, routes)
- ✅ Frontend workflow list page with create dialog
- ✅ Sidebar navigation item for Workflows
- ✅ Output tab API fix (client returning data directly)

### December 2025

- ✅ JSONL streaming for live output (ansible.posix.jsonl callback)
- ✅ Events grouped by task (not per-host duplicates)
- ✅ Auto-refresh polling for events AND output
- ✅ Galaxy auto-install from requirements.yml
- ✅ Slimmed down pre-installed collections (7 essentials vs 50+)
- ✅ Output tab shown first with live spinner
- ✅ Fixed event type attribute naming (`event-type` vs `event`)
- ✅ Fixed JSON inventory format (hosts as dict, not array)
- ✅ Fixed credential deletion FK constraint handling
- ✅ Fixed job template cascade delete
- ✅ Added clickable links in job detail
- ✅ Added icons to job stats bar
- ✅ Enhanced warning/event display with AWX-style badges
- ✅ Added individual warning parsing
