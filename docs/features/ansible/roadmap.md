---
description: "Ansible development roadmap covering workflow templates, surveys, and future phases"
covers:
  - "core/services/ansible/**"
  - "backend/cmd/ansible-runner/**"
---

# Development Roadmap

## Completed Features

### Live Output Streaming ✅ (December 2025)
- Uses `ansible.posix.jsonl` callback for line-by-line streaming
- Events appear as tasks execute with live progress
- Frontend polls for updates during job execution
- Output tab shows raw JSONL, Events tab shows parsed task details

### Galaxy Collection Support ✅ (December 2025)
- Pre-installed essential collections (community.general, ansible.posix, etc.)
- Collection caching at `/home/iac/galaxy-cache/` for faster subsequent runs
- `GalaxyRequirements` field added to job template model

### Dynamic Inventory OIDC & VCS Enhancements ✅ (January 2025)
- Azure dynamic inventory sources can authenticate via OIDC workload identity (keyless, auto-rotating tokens)
- Reuses the organization's Azure OIDC Configuration (same as Terraform)
- OIDC-first authentication with automatic fallback to stored credential
- VCS-backed custom inventory sources (link inventory scripts to Git repositories)
- Sync schedule support for automatic periodic inventory synchronization
- Frontend source configuration UI with auth method selection, VCS pickers, and schedule presets
- Added `azure-mgmt-compute`, `azure-mgmt-network`, `azure-mgmt-subscription` to runner image

---

## In Progress

### Workflow Templates 🚧 (January 2025)

**Status**: Backend complete, Frontend list page complete, Visual builder pending

**Completed**:
- ✅ Data models: `AnsibleWorkflow`, `AnsibleWorkflowNode`, `AnsibleWorkflowEdge`, `AnsibleWorkflowJob`, `AnsibleWorkflowNodeJob`
- ✅ Repository layer with full CRUD operations
- ✅ API handlers for workflows, nodes, and edges
- ✅ Routes registered at `/api/v2/organizations/:name/ansible/workflows` and `/api/v2/ansible/workflows/:id`
- ✅ Frontend list page with create dialog
- ✅ Sidebar navigation item added

**Remaining**:
- 🔲 Visual workflow builder (React Flow)
- 🔲 Workflow job execution engine
- 🔲 Workflow job status visualization
- 🔲 Variable passing between nodes
- 🔲 Approval gate support

**Data Model**:
```go
type AnsibleWorkflow struct {
    ID, OrganizationID, ProjectID, Name, Description
    AllowSimultaneous, AskVariablesOnLaunch, AskInventoryOnLaunch
    InventoryID, ExtraVars, Limit, SurveyEnabled, SurveySpec
    Nodes []AnsibleWorkflowNode
}

type AnsibleWorkflowNode struct {
    ID, WorkflowID, JobTemplateID, InventoryID, CredentialID
    NodeType (job_template | workflow | inventory_sync | approval)
    PositionX, PositionY  // For visual editor
    AllParentsMustConverge
}

type AnsibleWorkflowEdge struct {
    ID, WorkflowID, SourceNodeID, TargetNodeID
    Condition (on_success | on_failure | always)
}
```

**API Endpoints**:
- `GET/POST /api/v2/organizations/:name/ansible/workflows` - List/Create workflows
- `GET/PATCH/DELETE /api/v2/ansible/workflows/:id` - Workflow CRUD
- `GET/POST /api/v2/ansible/workflows/:id/nodes` - Node management
- `GET/POST /api/v2/ansible/workflows/:id/edges` - Edge management
- `PATCH/DELETE /api/v2/ansible/workflow-nodes/:id` - Node update/delete
- `DELETE /api/v2/ansible/workflow-edges/:id` - Edge delete

---

## Immediate Priorities

### 1. Auto-install Galaxy Collections from requirements.yml (P1)

**Goal**: Automatically install collections from `requirements.yml` before job execution.

**Current State**:
- Essential collections pre-installed in runner image
- Manual Dockerfile updates for new collections  
- `GalaxyRequirements` field exists in model

**Target State**:
- Detect `requirements.yml` in playbook repo
- Install collections before running playbook
- Cache for faster subsequent runs

**Implementation Plan**:
1. After cloning repo in runner, check for `requirements.yml` or `collections/requirements.yml`
2. Run `ansible-galaxy collection install -r requirements.yml` if found
3. Log installation output as job events
4. UI to display detected/installed collections

### 2. WebSocket for Real-time Updates (P2 - Optional)

**Goal**: Sub-second output updates instead of 3-second polling.

**Current State**:
- Polling works well with 3-second interval
- Acceptable for most use cases

**Target State**:
- WebSocket connection for instant event streaming
- Fallback to polling if WebSocket unavailable

---

## Phase 2 Roadmap

### 2.1 Survey Prompts ⏳

**Estimated**: 3-4 days

1. **Survey definition**
   - Add survey fields to job template
   - Support text, choice, password types
   
2. **Launch UI**
   - Dynamic form generation from survey
   - Validation before launch

### 2.2 GitHub Webhook Enhancement ⏳

**Estimated**: 1 week

---

## Phase 3 Roadmap

### 3.1 Visual Workflow Builder

**Estimated**: 2-3 weeks

**Design**:
```
┌─────────┐     ┌─────────┐     ┌─────────┐
│  Job 1  │────▶│  Job 2  │────▶│  Job 3  │
└────┬────┘     └─────────┘     └─────────┘
     │ on failure
     ▼
┌─────────┐
│ Rollback│
└─────────┘
```

**Features**:
- Visual workflow editor using React Flow
- Success/Failure/Always paths
- Convergence nodes
- Parallel execution
- Inventory override per node

### 3.2 Surveys (Job Prompts)

**Estimated**: 2-3 weeks

**Survey Field Types**:
- Text (single line, multi-line)
- Number (integer, float)
- Password (encrypted)
- Multiple Choice
- Multiple Select

**Implementation**:
- Survey specification stored as JSON in job template
- Dynamic form generation on launch
- Validation before submission
- Variables injected into extra_vars

### 3.3 Notifications

**Estimated**: 2-3 weeks

**Supported Channels**:
- Slack
- Email
- Webhook
- Microsoft Teams

**Trigger Points**:
- Job started
- Job successful
- Job failed
- Job timed out

---

## Phase 4 Roadmap

### 4.1 Enhanced RBAC

**Estimated**: 4-6 weeks

**Permission Model**:
| Resource | Permissions |
|----------|-------------|
| Inventory | View, Edit, Admin, Use |
| Credential | View, Use, Admin |
| Playbook | View, Edit, Admin |
| Job Template | View, Edit, Execute, Admin |
| Workflow | View, Edit, Execute, Admin |

**Features**:
- Team-based access control
- Credential use separation (can use but not view)
- Audit trail for permission changes

### 4.2 Unified Terraform + Ansible Workflows

**Estimated**: 6-8 weeks

**Use Cases**:
1. Provision with Terraform → Configure with Ansible
2. Share Terraform outputs as Ansible variables
3. Rollback Ansible on failure

**Design**:
```yaml
workflow:
  - name: provision
    type: terraform
    workspace: production-infra
    
  - name: configure
    type: ansible
    template: configure-servers
    variables_from: provision.outputs
    
  - name: rollback
    type: ansible
    template: rollback-config
    on: failure
```

### 4.3 Custom Credential Types

**Estimated**: 3-4 weeks

**Implementation**:
- Credential type definition model
- Custom input fields specification
- Injector templates (env vars, files)
- UI for creating custom types

---

## Phase 5 Roadmap

### 5.1 Audit Logging

**Estimated**: 2-3 weeks

**Events to Log**:
- Resource CRUD operations
- Job executions
- Credential usage
- Authentication events

**Features**:
- Searchable audit log viewer
- Export to SIEM systems
- Retention policies

### 5.2 Metrics & Dashboard

**Estimated**: 3-4 weeks

**Prometheus Metrics**:
- `ansible_jobs_total` (by status)
- `ansible_job_duration_seconds`
- `ansible_hosts_managed`
- `ansible_runner_queue_depth`

**Dashboard Widgets**:
- Job success rate over time
- Average job duration
- Most active playbooks
- Failed tasks by host

### 5.3 Instance Groups

**Estimated**: 4-6 weeks

**Features**:
- Multiple runner pools
- Job routing by instance group
- Resource isolation per group
- Custom execution environments

---

## Success Metrics

### Performance

| Metric | Target |
|--------|--------|
| Job launch latency | < 5 seconds |
| First event visible | < 2 seconds |
| Concurrent jobs per runner | 10+ |
| Output streaming delay | < 1 second |

### Reliability

| Metric | Target |
|--------|--------|
| Job execution success | > 99% (excluding Ansible failures) |
| Runner availability | > 99.9% |
| API availability | > 99.9% |

### Usability

| Metric | Target |
|--------|--------|
| Time to first job | < 10 minutes |
| Playbook sync time | < 30 seconds |
| Job output searchable | ✓ |
| Events filterable | ✓ |

---

## Timeline Overview

```
2025 Q1:
├── Phase 2.1: Live Output Streaming
├── Phase 2.2: Ansible Galaxy Integration
└── Phase 2.3: Webhook Enhancement

2025 Q2:
├── Phase 3.1: Workflow Templates
├── Phase 3.2: Surveys
└── Phase 3.3: Notifications

2025 Q3:
├── Phase 4.1: Enhanced RBAC
└── Phase 4.2: Unified Workflows

2025 Q4:
├── Phase 4.3: Custom Credential Types
├── Phase 5.1: Audit Logging
├── Phase 5.2: Metrics & Dashboard
└── Phase 5.3: Instance Groups
```

---

## Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Live output streaming | High | Medium | P1 |
| Galaxy integration | Medium | Medium | P2 |
| Workflow templates | High | High | P2 |
| Surveys | Medium | Low | P2 |
| Notifications | Medium | Medium | P2 |
| Enhanced RBAC | High | High | P2 |
| Unified workflows | High | Very High | P3 |
| Custom credentials | Low | Medium | P3 |
| Audit logging | Medium | Low | P2 |
| Metrics | Medium | Medium | P3 |
| Instance groups | Medium | High | P3 |
