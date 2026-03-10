<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Ansible Integration Design Document

## Executive Summary

This document outlines the architectural design for extending the existing IaC orchestration platform to support Ansible playbook management alongside the current Terraform workspace functionality. The goal is to create a unified platform that provides a management interface for both Terraform and Ansible, leveraging existing organizational structures while introducing Ansible-specific features.

## Background & Motivation

The platform currently provides a Spacelift-like DevOps interface for managing Terraform workspaces. This integration extends the platform's capabilities to include Ansible automation, creating a comprehensive IaC and configuration management solution.

### Key Design Principles

1. **Reuse existing infrastructure**: Leverage current org/user management and project grouping
2. **Reuse core platform components**: VCS integration (GitHub App), authentication, RBAC, and storage systems should be shared with Terraform workspaces rather than creating parallel implementations
3. **Modern VCS integration only**: Use GitHub App authentication for repository access - no legacy SCM credentials or manual URL entry. This provides:
   - Better user experience with automatic token management
   - Secure credential handling (tokens managed by platform, not users)
   - Self-service repository connections (users install app on their accounts)
   - Same experience across Terraform and Ansible workflows
4. **Don't reinvent the wheel**: Utilize native Ansible features and ecosystem tools
5. **Maintain technology consistency**: Implement backend in Go, avoiding Python dependencies where possible
6. **Seamless integration**: Ensure Ansible features integrate naturally into existing UI/UX patterns

### VCS Integration Philosophy

StackWeaver uses a **platform-managed VCS** approach rather than legacy SCM credentials:

**Why No SCM Credentials?**
- **Security**: Credentials stored and rotated by the platform, never exposed to users
- **Self-Hosted Runners**: Even with self-hosted runners, the platform passes short-lived tokens securely - no static credentials needed
- **User Experience**: Users select repositories from a dropdown, not copy-paste URLs
- **Unified Experience**: Same VCS workflow for Terraform workspaces and Ansible playbooks

**Supported VCS Providers:**
- ✅ **GitHub** (via GitHub App) - Fully implemented
- 🔲 **GitLab** (planned) - GitLab App integration
- 🔲 **Bitbucket** (planned) - Bitbucket App integration

See [GITHUB_APP_VS_OAUTH-sitrep.md](../status/GITHUB_APP_VS_OAUTH-sitrep.md) for technical details on the GitHub App implementation.

## Research & Investigation

### 1. Ansible Binary & Architecture

#### How Ansible Works

Ansible is a Python-based automation tool that operates primarily through:

- **ansible-playbook**: Main binary for executing playbooks
- **ansible**: Ad-hoc command execution
- **ansible-galaxy**: Role and collection management
- **ansible-inventory**: Inventory management and inspection

#### Execution Model

```
┌─────────────┐
│   Control   │
│    Node     │ ──────> SSH/WinRM ──────> ┌─────────────┐
│  (Ansible)  │                            │ Managed     │
└─────────────┘                            │ Hosts       │
                                           └─────────────┘
```

Ansible is **agentless** and uses SSH (or WinRM for Windows) to execute tasks on remote hosts. It:
- Generates Python code from playbooks
- Transfers code to target hosts
- Executes remotely
- Collects results and returns them

#### Native API Considerations

**Important Finding**: Ansible itself does **not** provide a REST API. It's a CLI tool. AWX (and its upstream Tower) were created specifically to provide:
- REST API wrapper around Ansible
- Job scheduling and execution
- Inventory management
- Credential storage
- RBAC

### 2. AWX Architecture Analysis

AWX (now deprecated in favor of Ansible Automation Platform) provided:

```
┌──────────────────────────────────────────────────┐
│                   AWX Web UI                      │
└──────────────────┬───────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────┐
│              AWX REST API (Django)                │
└──────────────────┬───────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────┐
│          Task Engine (Celery/Redis)               │
└──────────────────┬───────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────┐
│         Execution Nodes (ansible-runner)          │
└───────────────────────────────────────────────────┘
```

**Key Components**:
- **Django REST API**: Handles all HTTP requests
- **PostgreSQL**: Stores jobs, inventories, credentials, etc.
- **Redis/RabbitMQ**: Message broker for task distribution
- **Celery**: Distributed task queue
- **ansible-runner**: Python library that wraps ansible-playbook execution

### 3. Go vs Python Backend Feasibility

#### Can We Use Go?

**Yes, with caveats:**

✅ **Possible**:
- Execute `ansible-playbook` binary as subprocess (similar to Terraform approach)
- Parse JSON output using `ANSIBLE_STDOUT_CALLBACK=json`
- Manage job lifecycle, scheduling, and orchestration in Go
- Build REST API in Go (Gin, Echo, or Fiber)
- Store state in PostgreSQL/MySQL

❌ **Challenges**:
- No native Go library for Ansible (unlike Terraform which has `terraform-exec`)
- Must rely on CLI output parsing
- Limited ability to hook into Ansible internals
- Callback plugins are Python-only

#### Recommended Approach

**Hybrid Architecture**:
- **Go Backend**: API, orchestration, job scheduling, authentication, RBAC
- **Ansible Execution**: Direct CLI invocation via Go's `os/exec` package
- **Output Parsing**: Use Ansible's JSON callback plugin for structured output

This mirrors the current Terraform integration approach and maintains consistency.

## Proposed Architecture

### High-Level System Design

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend (React)                    │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐            │
│  │Terraform │  │ Ansible  │  │   Org      │            │
│  │Workspaces│  │   Jobs   │  │ Management │            │
│  └──────────┘  └──────────┘  └────────────┘            │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Go Backend (REST API)                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │  /api/v2/ansible/*                               │   │
│  │  - inventories, playbooks, jobs, credentials     │   │
│  └─────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                   Orchestrator                           │
│  ┌──────────────┐         ┌──────────────┐             │
│  │  Terraform   │         │   Ansible    │             │
│  │ Orchestrator │         │ Orchestrator │             │
│  └──────────────┘         └──────────────┘             │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  Runner Pool                             │
│  ┌──────────────┐         ┌──────────────┐             │
│  │  Terraform   │         │   Ansible    │             │
│  │   Runners    │         │   Runners    │             │
│  └──────────────┘         └──────────────┘             │
└──────────────────────────────────────────────────────────┘
```

### Data Model

#### Core Entities

```go
// Reused from existing platform
type Organization struct {
    ID        uuid.UUID
    Name      string
    Projects  []Project
    Users     []User
}

type Project struct {
    ID              uuid.UUID
    OrganizationID  uuid.UUID
    Name            string
    // Now contains both Terraform and Ansible resources
    Workspaces      []TerraformWorkspace
    AnsibleJobs     []AnsibleJob
}

// New Ansible-specific entities
type AnsibleInventory struct {
    ID              uuid.UUID
    OrganizationID  uuid.UUID
    Name            string
    Description     string
    Type            string // "static", "dynamic", "vcs"
    Source          string // File path, VCS URL, or plugin config
    Variables       map[string]interface{}
    CreatedAt       time.Time
    UpdatedAt       time.Time
}

type AnsiblePlaybook struct {
    ID              uuid.UUID
    ProjectID       uuid.UUID
    Name            string
    Description     string
    // VCS Integration - Uses platform's GitHub App integration exclusively
    // No legacy SCM credentials - modern auth only for better security and UX
    VCSConnectionID *uuid.UUID  // References shared VCS connection (required)
    VCSRepository   string      // e.g., "owner/repo-name"
    VCSBranch       string      // Branch to use (defaults to "main")
    PlaybookPath    string      // Path to playbook file within repo
    LastSyncAt      *time.Time
    LastSyncStatus  string      // "success", "failed"
    LastSyncCommit  string      // Git commit SHA
    LastSyncError   string
    CreatedAt       time.Time
    UpdatedAt       time.Time
}

type AnsibleJob struct {
    ID              uuid.UUID
    ProjectID       uuid.UUID
    PlaybookID      uuid.UUID
    InventoryID     uuid.UUID
    Name            string
    Status          string // "pending", "running", "success", "failed", "canceled"
    ExtraVars       map[string]interface{}
    Limit           string // Host pattern limit
    Tags            string // Ansible tags to run
    SkipTags        string
    Verbosity       int
    CredentialID    *uuid.UUID
    StartedAt       *time.Time
    FinishedAt      *time.Time
    Output          string // Job output/logs
    CreatedBy       uuid.UUID
    CreatedAt       time.Time
}

type AnsibleCredential struct {
    ID              uuid.UUID
    OrganizationID  uuid.UUID
    Name            string
    Description     string
    Type            string // "ssh", "vault", "scm", "cloud"
    Username        string
    // Encrypted fields
    SSHPrivateKey   []byte
    Password        []byte
    VaultPassword   []byte
    CreatedAt       time.Time
    UpdatedAt       time.Time
}

type AnsibleJobEvent struct {
    ID              uuid.UUID
    JobID           uuid.UUID
    Event           string // "playbook_on_start", "runner_on_ok", etc.
    EventData       map[string]interface{}
    Timestamp       time.Time
    Counter         int
}
```

### API Design

#### Endpoint Structure

Following existing `/api/v2` patterns:

```
# Inventories
GET    /api/v2/organizations/{orgId}/inventories
POST   /api/v2/organizations/{orgId}/inventories
GET    /api/v2/inventories/{id}
PUT    /api/v2/inventories/{id}
DELETE /api/v2/inventories/{id}
GET    /api/v2/inventories/{id}/hosts
POST   /api/v2/inventories/{id}/hosts

# Playbooks
GET    /api/v2/projects/{projectId}/playbooks
POST   /api/v2/projects/{projectId}/playbooks
GET    /api/v2/playbooks/{id}
PUT    /api/v2/playbooks/{id}
DELETE /api/v2/playbooks/{id}
POST   /api/v2/playbooks/{id}/sync  # Sync from SCM

# Jobs
GET    /api/v2/projects/{projectId}/jobs
POST   /api/v2/projects/{projectId}/jobs  # Create/launch job
GET    /api/v2/jobs/{id}
DELETE /api/v2/jobs/{id}  # Cancel job
GET    /api/v2/jobs/{id}/events  # Stream job events
GET    /api/v2/jobs/{id}/output  # Get job output

# Credentials
GET    /api/v2/organizations/{orgId}/credentials
POST   /api/v2/organizations/{orgId}/credentials
GET    /api/v2/credentials/{id}
PUT    /api/v2/credentials/{id}
DELETE /api/v2/credentials/{id}
```

### Runner Architecture

#### Ansible Runner Design

Similar to Terraform runner pattern. Both runners share a workspace volume (`runner-workspaces`) with unified UID 1001 for the `iac` user. This ensures consistent file permissions across both Terraform and Ansible execution environments.

**Key Implementation Details:**
- Both runners use UID 1001 (`iac` user) for consistent volume permissions
- Workspaces are separated by subdirectory:
  - `/home/iac/workspaces/ansible-sync` - For VCS sync operations
  - `/home/iac/workspaces/ansible-jobs` - For job execution
  - Terraform workspaces use workspace ID-based directories
- The `runner-workspaces` Docker volume is shared between runners

```go
type AnsibleRunner struct {
    ID              string
    OrganizationID  uuid.UUID
    Status          string
    Capacity        int
    CurrentJobs     int
    LastHeartbeat   time.Time
}

type AnsibleExecutor struct {
    runner          *AnsibleRunner
    workDir         string
    credentialStore CredentialStore
}

func (e *AnsibleExecutor) ExecuteJob(job *AnsibleJob) error {
    // 1. Prepare workspace
    workDir := e.prepareWorkspace(job)
    
    // 2. Sync playbook from SCM
    if err := e.syncPlaybook(job.Playbook, workDir); err != nil {
        return err
    }
    
    // 3. Generate inventory file
    inventoryPath, err := e.generateInventory(job.Inventory, workDir)
    if err != nil {
        return err
    }
    
    // 4. Prepare credentials (SSH keys, vault passwords)
    if err := e.setupCredentials(job.Credential, workDir); err != nil {
        return err
    }
    
    // 5. Build ansible-playbook command
    cmd := e.buildAnsibleCommand(job, inventoryPath, workDir)
    
    // 6. Execute with streaming output
    return e.executeWithStreaming(cmd, job)
}

func (e *AnsibleExecutor) buildAnsibleCommand(
    job *AnsibleJob,
    inventoryPath string,
    workDir string,
) *exec.Cmd {
    args := []string{
        "ansible-playbook",
        job.Playbook.PlaybookPath,
        "-i", inventoryPath,
        "--extra-vars", marshalExtraVars(job.ExtraVars),
    }
    
    if job.Limit != "" {
        args = append(args, "--limit", job.Limit)
    }
    
    if job.Tags != "" {
        args = append(args, "--tags", job.Tags)
    }
    
    if job.Verbosity > 0 {
        args = append(args, strings.Repeat("-v", job.Verbosity))
    }
    
    // Use JSON callback for structured output
    cmd := exec.Command(args[0], args[1:]...)
    cmd.Env = append(os.Environ(),
        "ANSIBLE_STDOUT_CALLBACK=json",
        "ANSIBLE_LOAD_CALLBACK_PLUGINS=true",
    )
    cmd.Dir = workDir
    
    return cmd
}
```

### Integration with Existing Platform

#### UI Changes

**Organization View** - Add new sections:

1. **Inventories** (new top-level section)
   - List all inventories in the organization
   - Create/edit/delete inventories
   - View inventory hosts and groups
   - Dynamic inventory sync status

2. **Runs** (existing - Terraform runs only)
   - Keep existing Terraform runs section unchanged
   - Shows Terraform workspace execution history

3. **Jobs** (new top-level section - Ansible jobs only)
   - Dedicated section for Ansible job executions
   - Job status, duration, and output
   - Re-run capabilities
   - Separate from Terraform runs for clarity

3. **Settings → Credentials** (new subsection)
   - SSH keys
   - Vault passwords
   - SCM credentials
   - Cloud provider credentials

**Project View** - Enhanced:

- **Workspaces** tab (existing Terraform workspaces)
- **Playbooks** tab (new - Ansible playbooks)
- Both tabs visible, switch between them

#### Database Schema Changes

```sql
-- New tables
CREATE TABLE ansible_inventories (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    source TEXT,
    variables JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ansible_playbooks (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    scm_type VARCHAR(50),
    scm_url TEXT,
    scm_branch VARCHAR(255),
    scm_credential_id UUID REFERENCES ansible_credentials(id),
    playbook_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ansible_jobs (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    playbook_id UUID REFERENCES ansible_playbooks(id),
    inventory_id UUID REFERENCES ansible_inventories(id),
    name VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    extra_vars JSONB,
    limit VARCHAR(255),
    tags VARCHAR(255),
    skip_tags VARCHAR(255),
    verbosity INT DEFAULT 0,
    credential_id UUID REFERENCES ansible_credentials(id),
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    output TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ansible_credentials (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    username VARCHAR(255),
    ssh_private_key BYTEA,  -- Encrypted
    password BYTEA,         -- Encrypted
    vault_password BYTEA,   -- Encrypted
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ansible_job_events (
    id UUID PRIMARY KEY,
    job_id UUID REFERENCES ansible_jobs(id),
    event VARCHAR(100) NOT NULL,
    event_data JSONB,
    timestamp TIMESTAMP DEFAULT NOW(),
    counter INT NOT NULL
);

CREATE INDEX idx_ansible_jobs_project ON ansible_jobs(project_id);
CREATE INDEX idx_ansible_jobs_status ON ansible_jobs(status);
CREATE INDEX idx_ansible_job_events_job ON ansible_job_events(job_id, counter);
```

## Feature Implementation Plan

### Phase 1: Core Infrastructure (MVP)

1. **Database schema** - Create tables for inventories, playbooks, jobs, credentials
2. **API endpoints** - Implement basic CRUD for all entities
3. **Runner integration** - Extend runner pool to support Ansible jobs
4. **Job execution** - Basic ansible-playbook execution with output capture
5. **Credential management** - Secure storage and retrieval of SSH keys

### Phase 2: Enhanced Features

1. **Ansible Galaxy integration**
   - Browse and install roles/collections
   - Manage requirements.yml
   - Auto-install dependencies before job execution

2. **Dynamic inventories**
   - Support for inventory plugins (AWS, Azure, GCP, etc.)
   - Periodic inventory sync
   - Inventory caching

3. **Advanced job features**
   - Job templates (pre-configured jobs)
   - Scheduled jobs (cron-like)
   - Job chaining/workflows
   - Approval gates

4. **Real-time output streaming**
   - WebSocket connection for live job output
   - Event-based updates using ansible callback plugins
   - Progress indicators

### Phase 3: Advanced Integration

1. **Unified workflows**
   - Combine Terraform and Ansible in single workflow
   - Terraform → Ansible handoff (e.g., provision infra → configure)
   - Shared variables between Terraform and Ansible

2. **Enhanced RBAC**
   - Ansible-specific permissions
   - Inventory-level access control
   - Credential access policies

3. **Audit logging**
   - Track all Ansible job executions
   - Compliance reporting
   - Change tracking

## Technical Considerations

### Security

1. **Credential Encryption**
   - Use AES-256 for encrypting SSH keys and passwords at rest
   - Separate encryption keys per organization
   - Never log credentials or expose in API responses

2. **SSH Key Management**
   - Generate ephemeral SSH keys per job (optional)
   - Support for SSH agent forwarding
   - Key rotation policies

3. **Vault Integration**
   - Support Ansible Vault for encrypted variables
   - Secure vault password storage
   - Runtime vault password injection

### Scalability

1. **Runner Pool**
   - Horizontal scaling of Ansible runners
   - Job queue management (similar to Terraform)
   - Runner affinity (pin jobs to specific runners)

2. **Job Output Storage**
   - Store full output in object storage (S3/MinIO) for large jobs
   - Keep recent output in database for quick access
   - Automatic cleanup of old job outputs

3. **Concurrent Execution**
   - Multiple jobs per runner (configurable capacity)
   - Resource limits per job
   - Job prioritization

### Ansible-Specific Challenges

1. **Output Parsing**
   - Ansible's JSON callback provides structured output
   - Parse events in real-time for UI updates
   - Handle different output formats (JSON, YAML, default)

2. **Playbook Validation**
   - Run `ansible-playbook --syntax-check` before execution
   - Validate inventory before job launch
   - Dry-run support (`--check` mode)

3. **Dependency Management**
   - Ensure Ansible is installed on runners
   - Support multiple Ansible versions
   - Auto-install Galaxy requirements

## Open Questions & Decisions Needed

### 1. Ansible Version Support ✅ **DECIDED**

**Decision**: Support multiple Ansible versions starting from the latest stable release.

**Implementation approach**:
- Runners should support multiple Ansible installations (e.g., `/opt/ansible/2.15`, `/opt/ansible/2.16`, etc.)
- Jobs can specify which Ansible version to use (default to latest stable)
- Version selection available in job configuration UI
- Backward compatibility maintained for at least 2-3 minor versions
- Version information stored in job metadata for audit trail

**Technical considerations**:
- Use version-specific binary paths: `/opt/ansible/{version}/bin/ansible-playbook`
- Validate version availability before job execution
- Display available versions in UI dropdown
- Consider using virtual environments or containers for version isolation

### 2. Inventory Source of Truth ✅ **DECIDED**

**Decision**: Store inventories in the database as the primary source of truth.

**Implementation approach**:
- All inventory data (hosts, groups, variables) stored in PostgreSQL
- Generate Ansible-compatible inventory files on-demand during job execution
- Support for both static inventories (manually defined) and dynamic inventories (plugin-based)
- Dynamic inventories sync to DB for caching and querying

**Benefits**:
- Full queryability and search capabilities
- RBAC integration at inventory/host level
- API-driven inventory management
- Audit trail for inventory changes
- Fast inventory access without external dependencies

### 3. Galaxy Plugin Integration ✅ **DECIDED**

**Decision**: Support Ansible Galaxy plugins (collections and roles) through automatic installation.

**Implementation approach**:
- Support `requirements.yml` file in playbook repositories
- Auto-install Galaxy dependencies before job execution
- Cache installed collections/roles per runner to avoid repeated downloads
- Support both Galaxy Hub and private Galaxy servers

**Scope**:
- **Phase 1**: Automatic installation from `requirements.yml`
  - Parse requirements file from playbook repo
  - Execute `ansible-galaxy install -r requirements.yml` before playbook run
  - Log installation output for debugging
- **Phase 2** (future): Enhanced UI features
  - Browse available collections/roles
  - Version management interface
  - Dependency visualization

**Key plugins to support**:
- Dynamic inventory plugins (AWS, Azure, GCP, VMware, etc.)
- Cloud modules and collections
- Community collections
- Custom/private collections from Git repos

### 4. Job Execution Isolation

**Question**: How should we isolate job executions?

**Options**:
- **A**: Process isolation only (separate working directories)
- **B**: Container isolation (Docker/Podman per job)
- **C**: VM isolation (extreme security)

**Recommendation**: Start with A, add B as optional in Phase 2

## Success Metrics

1. **Functional**
   - Successfully execute Ansible playbooks via API
   - Manage inventories through UI
   - Secure credential storage and usage

2. **Performance**
   - Job launch latency < 5 seconds
   - Support 10+ concurrent jobs per runner
   - Real-time output streaming with < 1s delay

3. **Integration**
   - Seamless UX alongside existing Terraform features
   - Unified project/org management
   - No breaking changes to existing API

## Next Steps

1. **Validate design** - Review and approve this document
2. **Prototype** - Build minimal Ansible executor in Go
3. **Test integration** - Verify ansible-playbook execution and output parsing
4. **Implement Phase 1** - Build MVP with core features
5. **User testing** - Gather feedback on UX integration
6. **Iterate** - Refine based on feedback and move to Phase 2

## References

- [Ansible Documentation](https://docs.ansible.com/)
- [AWX GitHub Repository](https://github.com/ansible/awx)
- [Ansible Runner (Python)](https://ansible-runner.readthedocs.io/)
- [Ansible JSON Callback Plugin](https://docs.ansible.com/ansible/latest/collections/ansible/posix/json_callback.html)
- [Ansible Galaxy](https://galaxy.ansible.com/)

---

## Implementation Status

### Phase 1: Core Infrastructure - ✅ COMPLETED

This section documents the actual implementation of the Ansible integration as of the current version.

#### 1. Data Models (✅ Implemented)

Located in `/backend/internal/models/`:

| File | Models | Status |
|------|--------|--------|
| `ansible_inventory.go` | `AnsibleInventory`, `AnsibleInventoryHost`, `AnsibleInventoryGroup`, `InventoryVariables` | ✅ Complete |
| `ansible_playbook.go` | `AnsiblePlaybook`, `AnsibleJobTemplate` | ✅ Complete |
| `ansible_job.go` | `AnsibleJob`, `AnsibleJobEvent`, `JobExtraVars` | ✅ Complete |
| `ansible_credential.go` | `AnsibleCredential` | ✅ Complete |

**Key Model Features**:
- UUID primary keys with `uuid_generate_v4()` PostgreSQL function
- Soft deletes using `gorm.DeletedAt`
- JSONB fields for flexible variable storage (`InventoryVariables`, `JobExtraVars`)
- Encrypted credential fields with `json:"-"` tags (never exposed via API)
- Full relationship support between models

**Credential Types Supported**:
- SSH (`ssh`) - Username, SSH Private Key, Passphrase
- Machine SSH (`machine-ssh`) - Username, Password, SSH Key  
- SCM (`scm`) - Username, Password/Token, SSH Key
- Ansible Vault (`vault`) - Vault Password
- AWS (`aws`) - Access Key ID, Secret Access Key
- Azure (`azure`) - Subscription ID, Tenant ID, Client ID, Client Secret
- GCP (`gcp`) - Service Account Email, Project, JSON Credentials
- VMware (`vmware`) - Host, Username, Password

#### 2. Repositories (✅ Implemented)

Located in `/backend/internal/repository/`:

| File | Repositories | Key Operations |
|------|--------------|----------------|
| `ansible_inventory.go` | `AnsibleInventoryRepository` | CRUD for inventories, hosts, groups; preloading relationships |
| `ansible_playbook.go` | `AnsiblePlaybookRepository`, `AnsibleJobTemplateRepository` | CRUD for playbooks and templates; SCM sync tracking |
| `ansible_job.go` | `AnsibleJobRepository` | Job lifecycle, status updates, event management |
| `ansible_credential.go` | `AnsibleCredentialRepository` | CRUD with credential type filtering |

#### 3. Services (✅ Implemented)

Located in `/backend/internal/services/ansible/`:

| File | Service | Key Features |
|------|---------|--------------|
| `credential.go` | `CredentialService` | AES-256-GCM encryption/decryption, secure credential handling |
| `inventory.go` | `InventoryService` | Inventory CRUD, host/group management, dynamic inventory generation (JSON/YAML/INI formats) |
| `job.go` | `JobService` | Job launch, cancellation, relaunch, queue integration, event tracking |

**Credential Encryption Details**:
- Uses AES-256-GCM authenticated encryption
- 12-byte random nonce per encryption
- Encryption key configured via `ANSIBLE_ENCRYPTION_KEY` or `ENCRYPTION_KEY` environment variable
- Keys can be hex-encoded or raw bytes, padded/truncated to 32 bytes

**Dynamic Inventory Formats**:
- JSON format compatible with Ansible `--inventory` flag
- YAML format for human-readable inventories
- INI format for traditional Ansible inventory files

#### 4. API Handlers (✅ Implemented)

Located in `/backend/internal/api/v2/handlers/ansible/`:

| File | Handler | Endpoints |
|------|---------|-----------|
| `inventories.go` | `InventoryHandler` | List, Create, Get, Update, Delete, GetInventoryINI, GetInventoryJSON |
| `hosts.go` | `HostHandler` | List, Create, Get, Update, Delete |
| `groups.go` | `GroupHandler` | List, Create, Get, Update, Delete (with parent hierarchy support) |
| `credentials.go` | `CredentialHandler` | List, Create, Get, Update, Delete |
| `playbooks.go` | `PlaybookHandler` | CRUD for Playbooks and Job Templates |
| `jobs.go` | `JobHandler` | Launch, Get, Cancel, Relaunch, GetEvents, GetOutput, LaunchFromTemplate |

**JSON:API Response Format**:
All handlers follow TFE-compatible JSON:API format with:
- `data` object containing `id`, `type`, `attributes`, `relationships`
- Pagination via `meta.pagination` with `current-page`, `page-size`, `total-count`, `total-pages`
- Error responses with `errors` array containing `status`, `title`, `detail`

**JSON:API Request Format for Create/Update Operations**:
The frontend API client sends requests in JSON:API format. Example for creating an inventory:

```json
{
  "data": {
    "type": "inventories",
    "attributes": {
      "name": "production-servers",
      "description": "Production server inventory",
      "inventory-type": "static"
    }
  }
}
```

Example for creating a credential:

```json
{
  "data": {
    "type": "credentials",
    "attributes": {
      "name": "aws-production",
      "description": "AWS production credentials",
      "credential-type": "aws",
      "aws-access-key-id": "AKIA...",
      "aws-secret-access-key": "..."
    }
  }
}
```

Note: Field names in JSON:API use kebab-case (e.g., `inventory-type`, `credential-type`, `ssh-private-key`).

#### 5. API Routes (✅ Implemented)

Located in `/backend/internal/api/v2/routes/ansible_routes.go`:

```
# Inventory Routes
GET    /api/v2/organizations/:name/ansible/inventories     - List inventories
POST   /api/v2/organizations/:name/ansible/inventories     - Create inventory
GET    /api/v2/ansible/inventories/:id                     - Get inventory
PATCH  /api/v2/ansible/inventories/:id                     - Update inventory
DELETE /api/v2/ansible/inventories/:id                     - Delete inventory
GET    /api/v2/ansible/inventories/:id/ini                 - Export as INI
GET    /api/v2/ansible/inventories/:id/json                - Export as JSON
GET    /api/v2/ansible/inventories/:id/hosts               - List hosts
POST   /api/v2/ansible/inventories/:id/hosts               - Create host
GET    /api/v2/ansible/inventories/:id/groups              - List groups
POST   /api/v2/ansible/inventories/:id/groups              - Create group

# Host Routes
GET    /api/v2/ansible/hosts/:id                           - Get host
PATCH  /api/v2/ansible/hosts/:id                           - Update host
DELETE /api/v2/ansible/hosts/:id                           - Delete host

# Group Routes
GET    /api/v2/ansible/groups/:id                          - Get group
PATCH  /api/v2/ansible/groups/:id                          - Update group
DELETE /api/v2/ansible/groups/:id                          - Delete group

# Credential Routes
GET    /api/v2/organizations/:name/ansible/credentials     - List credentials
POST   /api/v2/organizations/:name/ansible/credentials     - Create credential
GET    /api/v2/ansible/credentials/:id                     - Get credential
PATCH  /api/v2/ansible/credentials/:id                     - Update credential
DELETE /api/v2/ansible/credentials/:id                     - Delete credential

# Playbook Routes (TFE-compatible: org-scoped for list/create)
GET    /api/v2/organizations/:name/ansible/playbooks       - List all playbooks in org
POST   /api/v2/organizations/:name/ansible/playbooks       - Create playbook (project optional in body)
GET    /api/v2/projects/:id/ansible/playbooks              - List playbooks by project (read-only)
GET    /api/v2/ansible/playbooks/:id                       - Get playbook
PATCH  /api/v2/ansible/playbooks/:id                       - Update playbook
DELETE /api/v2/ansible/playbooks/:id                       - Delete playbook
POST   /api/v2/ansible/playbooks/:id/actions/sync          - Sync from SCM

# Job Template Routes (TFE-compatible: org-scoped for list/create)
GET    /api/v2/organizations/:name/ansible/job-templates   - List all templates in org
POST   /api/v2/organizations/:name/ansible/job-templates   - Create template (project optional in body)
GET    /api/v2/projects/:id/ansible/job-templates          - List templates by project (read-only)
GET    /api/v2/ansible/job-templates/:id                   - Get template
PATCH  /api/v2/ansible/job-templates/:id                   - Update template
DELETE /api/v2/ansible/job-templates/:id                   - Delete template
POST   /api/v2/ansible/job-templates/:id/launch            - Launch from template

# Job Routes (TFE-compatible: org-scoped for list/create)
GET    /api/v2/organizations/:name/ansible/jobs            - List all jobs in org
POST   /api/v2/organizations/:name/ansible/jobs            - Launch job (project optional in body)
GET    /api/v2/organizations/:name/ansible/jobs/queue      - Get job queue
GET    /api/v2/projects/:id/ansible/jobs                   - List jobs by project (read-only)
GET    /api/v2/ansible/jobs/:id                            - Get job
POST   /api/v2/ansible/jobs/:id/actions/cancel             - Cancel job
POST   /api/v2/ansible/jobs/:id/actions/relaunch           - Relaunch job
GET    /api/v2/ansible/jobs/:id/events                     - Get job events
GET    /api/v2/ansible/jobs/:id/output                     - Get job output
```

#### 6. Database Migrations (✅ Implemented)

GORM AutoMigrate configured in `/backend/cmd/api/main.go` includes all Ansible models:
- `models.AnsibleInventory`
- `models.AnsibleInventoryHost`
- `models.AnsibleInventoryGroup`
- `models.AnsiblePlaybook`
- `models.AnsibleJobTemplate`
- `models.AnsibleJob`
- `models.AnsibleJobEvent`
- `models.AnsibleCredential`

### Implementation Deviations from Design

1. **VCS-Only Integration**: The original design mentioned both legacy SCM fields (`SCMType`, `SCMUrl`, `SCMBranch`) and VCS connections. The implementation now uses **VCS connections exclusively** via GitHub App integration. The `AnsiblePlaybook` model uses `VCSConnectionID`, `VCSRepository`, and `VCSBranch` fields only - no legacy SCM credentials.

2. **Job Templates**: Added `AnsibleJobTemplate` model for reusable job configurations with pre-set parameters.

3. **Queue Interface**: Uses `queue.Queue` interface instead of concrete `*queue.RedisQueue` for better testability.

4. **Storage Client**: The routes setup doesn't require `storage.Client` as job output is stored differently than originally planned.

### Pending Implementation

#### Ansible Runner (✅ Implemented)

The job execution runner that actually invokes `ansible-playbook` has been implemented.

**Location**: `/backend/cmd/ansible-runner/main.go`

**Features**:
1. **Job Queue Processing**:
   - Pulls jobs from Redis queue (`ansible_jobs`)
   - Updates job status throughout lifecycle (pending → running → successful/failed)
   - Handles job cancellation

2. **Playbook Preparation**:
   - Clones Git repositories via VCS connection (GitHub App integration)
   - Uses platform-managed access tokens for secure repository access
   - Extracts playbook archives from storage for non-VCS playbooks
   - Supports branch selection via `VCSBranch` field

3. **Inventory Generation**:
   - Generates JSON inventory from database
   - Writes to temporary file for ansible-playbook

4. **Credential Handling**:
   - Decrypts credentials using AES-256-GCM
   - Writes SSH keys to temporary files (mode 0600)
   - Sets environment variables for cloud providers (AWS, Azure, GCP, VMware)
   - Writes Ansible Vault passwords to files

5. **Execution**:
   - Runs `ansible-playbook` via `os/exec`
   - Supports version-specific Ansible binaries (`/opt/ansible/{version}/bin/ansible-playbook`)
   - Uses JSON callback plugin for structured output
   - Captures stdout/stderr

6. **Output Processing**:
   - Parses JSON events from Ansible output
   - Stores events in database for real-time UI updates
   - Extracts execution statistics (ok, changed, failed, skipped, unreachable)

7. **Cleanup**:
   - Removes temporary workspace directories
   - Securely deletes SSH key files
   - Configurable workspace retention via `ANSIBLE_RUNNER_KEEP_WORKSPACE=true`

**Runner Docker Image**: `/runner-images/ansible/Dockerfile`

Includes:
- Python 3.13 with Ansible (latest stable)
- Common Ansible collections (AWS, Azure, GCP, VMware, community.general)
- SSH client, git, sshpass
- Non-root user execution

**Docker Compose Integration**: Added to `/deploy/docker-compose.yml` as `ansible-runner` service.

**Environment Variables**:
| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | localhost | Redis server host |
| `REDIS_PORT` | 6379 | Redis server port |
| `DATABASE_HOST` | localhost | PostgreSQL host |
| `DATABASE_PORT` | 5432 | PostgreSQL port |
| `DATABASE_USER` | iac | PostgreSQL user |
| `DATABASE_PASSWORD` | iac_password | PostgreSQL password |
| `DATABASE_NAME` | iac_platform | PostgreSQL database |
| `STORAGE_ENDPOINT` | localhost:9000 | MinIO/S3 endpoint |
| `STORAGE_ACCESS_KEY` | minioadmin | MinIO/S3 access key |
| `STORAGE_SECRET_KEY` | minioadmin | MinIO/S3 secret key |
| `STORAGE_BUCKET` | ansible-artifacts | Storage bucket name |
| `ANSIBLE_ENCRYPTION_KEY` | - | Credential encryption key (hex or raw) |
| `WORKSPACES_DIR` | /home/iac/workspaces | Job workspace directory |
| `ANSIBLE_BINARY_PATH` | ansible-playbook | Path to ansible-playbook binary |
| `ANSIBLE_HOST_KEY_CHECKING` | false | Disable SSH host key checking |
| `ANSIBLE_RETRY_FILES_ENABLED` | false | Disable .retry file creation |
| `ANSIBLE_DEPRECATION_WARNINGS` | false | Suppress Ansible deprecation warnings |
| `ANSIBLE_COMMAND_WARNINGS` | false | Suppress Ansible command warnings |

### Frontend Implementation (✅ Implemented)

The React frontend has been updated with Ansible-specific pages and components.

#### API Client

Located in `/frontend/src/api/ansible.ts`:

**Types**:
- `AnsibleInventory`, `AnsibleInventoryHost`, `AnsibleInventoryGroup`
- `AnsibleCredential`, `CreateCredentialInput`, `UpdateCredentialInput`
- `AnsiblePlaybook`, `CreatePlaybookInput`
- `AnsibleJobTemplate`, `CreateJobTemplateInput`
- `AnsibleJob`, `AnsibleJobEvent`, `CreateJobInput`
- `CredentialType`, `InventoryType`, `AnsibleJobStatus`

**API Functions**:
- `ansibleInventoriesApi` - CRUD for inventories, export INI/JSON
- `ansibleHostsApi` - CRUD for inventory hosts
- `ansibleGroupsApi` - CRUD for inventory groups  
- `ansibleCredentialsApi` - CRUD for credentials with type filtering
- `ansiblePlaybooksApi` - CRUD for playbooks, SCM sync
- `ansibleJobTemplatesApi` - CRUD for templates, launch from template
- `ansibleJobsApi` - List, launch, cancel, relaunch, get events/output

#### Pages

Located in `/frontend/src/pages/Ansible/`:

| File | Description |
|------|-------------|
| `Inventories.tsx` | List, create, delete inventories with type badges and search |
| `InventoryDetail.tsx` | Detailed inventory view with hosts, groups, and sources (dynamic inventories) management |
| `Credentials.tsx` | Manage credentials with type-specific form fields for SSH, AWS, Azure, GCP, VMware, Vault. Includes edit and delete functionality |
| `Playbooks.tsx` | List, search, sync, delete playbooks with SCM information display |
| `PlaybookDetail.tsx` | Detailed playbook view with YAML syntax highlighting, job templates, recent jobs |
| `JobTemplates.tsx` | List, search, launch, delete job templates with configuration display |
| `Jobs.tsx` | List jobs with status badges, duration, stats; cancel and relaunch actions |
| `JobDetail.tsx` | Detailed job view with output streaming, events tab, execution stats, details tab |
| `Schedules.tsx` | Schedule management with cron builder, enable/disable, run-now functionality |
| `index.ts` | Barrel exports for all Ansible pages |

#### UI Components

Located in `/frontend/src/components/ui/`:
- `card.tsx` - Card component for consistent UI styling

Located in `/frontend/src/components/code/`:
- `YamlViewer.tsx` - YAML syntax highlighting component with line numbers, copy button, word wrap toggle

#### Navigation

Updated `/frontend/src/components/layout/Sidebar.tsx`:
- Sidebar organized into collapsible sections:
  - **Terraform** - Workspaces, Registry (Terraform-specific)
  - **Ansible** - Inventories, Playbooks, Job Templates, Jobs, Schedules
  - **Core** - Projects (shared), Usage, Settings
- Visible in organization-scoped view

#### Routes

Updated `/frontend/src/App.tsx`:
- `/app/:orgName/ansible/inventories` - Inventories list
- `/app/:orgName/ansible/inventories/:inventoryId` - Inventory detail with hosts/groups/sources
- `/app/:orgName/ansible/credentials` - Credentials list
- `/app/:orgName/ansible/playbooks` - Playbooks list
- `/app/:orgName/ansible/playbooks/:playbookId` - Playbook detail with YAML viewer
- `/app/:orgName/ansible/job-templates` - Job Templates list
- `/app/:orgName/ansible/job-templates/:templateId` - Job Template detail
- `/app/:orgName/ansible/jobs` - Jobs list
- `/app/:orgName/ansible/jobs/:jobId` - Job detail
- `/app/:orgName/ansible/schedules` - Schedules list

---

## Implementation Status

### Phase 1 Completion Checklist

| Feature | Status | Notes |
|---------|--------|-------|
| **Database Schema** | ✅ Complete | Tables for inventories, playbooks, jobs, credentials, hosts, groups |
| **Inventory API** | ✅ Complete | CRUD operations with JSON:API format |
| **Inventory Hosts API** | ✅ Complete | Add/edit/delete hosts with variables |
| **Inventory Groups API** | ✅ Complete | Add/edit/delete groups with hierarchy |
| **Credentials API** | ✅ Complete | CRUD with encrypted storage for SSH, AWS, Azure, GCP, VMware, Vault |
| **Playbooks API** | ✅ Complete | CRUD operations with organization-level listing |
| **Playbooks VCS Sync** | ✅ Complete | Queue-based sync with runner, auto-sync on create |
| **Job Templates API** | ✅ Complete | CRUD operations with organization-level listing |
| **Jobs API** | ✅ Complete | Create, list, get, cancel, relaunch jobs |
| **Runner Integration** | ✅ Complete | Ansible runner container with job execution |
| **Runner VCS Sync** | ✅ Complete | Dedicated sync worker, clone repos, verify playbooks |
| **Frontend - Inventories** | ✅ Complete | List, create, search, filter, detail view |
| **Frontend - Inventory Detail** | ✅ Complete | Edit inventory, manage hosts, groups, and sources |
| **Frontend - Inventory Sources** | ✅ Complete | Sources tab for dynamic inventories, sync button |
| **Frontend - Credentials** | ✅ Complete | List, create, edit, delete with type-specific forms |
| **Frontend - Playbooks** | ✅ Complete | List, search, SCM sync, delete, auto-select VCS |
| **Frontend - Playbook Detail** | ✅ Complete | YAML syntax highlighting, sync status, commit hash |
| **Frontend - Job Templates** | ✅ Complete | List, search, launch, delete |
| **Frontend - Jobs** | ✅ Complete | List, view details, cancel, relaunch |
| **Frontend - Job Detail** | ✅ Complete | Output viewer, events, execution stats |
| **Frontend - Schedules** | ✅ Complete | List, create, enable/disable, run-now, cron presets |
| **Error Handling** | ✅ Complete | Toast notifications for all API errors including duplicates |

### Phase 1.5: VCS Sync Implementation ✅ COMPLETE

**Timeline**: 1 week
**Status**: Completed

This phase implements actual VCS synchronization for playbooks, replacing the placeholder sync functionality.

#### Architecture

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Frontend  │ ──→   │  API Server │ ──→   │   Redis     │
│ Sync Button │       │ Queue Sync  │       │ ansible_sync│
└─────────────┘       └─────────────┘       └──────┬──────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────┐
│                  Ansible Runner                          │
│  ┌─────────────┐      ┌─────────────┐                   │
│  │ Job Worker  │      │ Sync Worker │                   │
│  │ansible_jobs │      │ansible_sync │                   │
│  └─────────────┘      └──────┬──────┘                   │
│                              │                           │
│                              ▼                           │
│                   ┌─────────────────┐                   │
│                   │  syncPlaybook() │                   │
│                   │  - Clone repo   │                   │
│                   │  - Verify file  │                   │
│                   │  - Get commit   │                   │
│                   │  - Update DB    │                   │
│                   └─────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

#### Implementation Details

**Backend - API Handler** (`/backend/internal/api/v2/handlers/ansible/playbooks.go`):
- `SyncPlaybook()` endpoint now queues sync job to Redis `ansible_sync` queue
- Validates playbook has VCS configuration before queuing
- Sets initial status to "syncing" with timestamp
- Auto-sync triggered on playbook creation when VCS is configured

**Backend - Ansible Runner** (`/backend/cmd/ansible-runner/main.go`):
- Added `PlaybookSyncMessage` struct for queue messages
- Added dedicated sync worker goroutine listening on `ansible_sync` queue
- `processSyncJob()` - Dequeues and processes sync messages
- `syncPlaybook()` - Main sync logic:
  1. Fetches playbook and VCS connection from database
  2. Clones repository using VCS access token for authentication
  3. Verifies playbook file exists at specified path
  4. Gets latest commit SHA via `git rev-parse HEAD`
  5. Updates playbook record with sync status, commit, and error (if any)

**Frontend - Playbook Detail** (`/frontend/src/pages/Ansible/PlaybookDetail.tsx`):
- Enhanced "Sync from VCS" button triggers actual sync
- Status card shows:
  - Sync status badge (Synced ✓, Syncing ⟳, Failed ✗, Never synced)
  - Last sync timestamp
  - Last commit SHA (shortened, linked to GitHub)
  - Sync error message (if failed)
- Auto-refresh on sync status change

**Frontend - Playbook Create** (`/frontend/src/pages/Ansible/Playbooks.tsx`):
- Auto-selects VCS connection when only one is available
- Repository field is now clickable link to GitHub

#### Queue Messages

**PlaybookSyncMessage**:
```go
type PlaybookSyncMessage struct {
    PlaybookID uuid.UUID `json:"playbook_id"`
}
```

#### Database Fields Used

| Field | Description |
|-------|-------------|
| `last_sync_status` | "success", "failed", "syncing" |
| `last_sync_at` | Timestamp of last sync attempt |
| `last_sync_commit` | Git commit SHA of synced version |
| `last_sync_error` | Error message if sync failed |

#### Known Limitations

1. **No incremental sync** - Full clone on each sync (could use `git pull` in future)
2. ~~**No webhook triggers** - Manual sync or on-create only (GitHub webhooks planned)~~ ✅ **GitHub webhooks implemented** - Push events trigger auto-sync for affected playbooks
3. **No branch switching** - Branch specified at playbook creation
4. **Single file verification** - Only checks main playbook file exists, not role dependencies

### GitHub Webhook Integration ✅ NEW

The platform now supports GitHub push webhooks for automatic playbook synchronization.

**Implementation**:
- Webhook endpoint: `POST /api/v2/webhooks/github`
- Validates webhook signature using `GITHUB_WEBHOOK_SECRET` environment variable
- Parses push event payload to extract repository, branch, and changed files
- Finds all playbooks linked to the affected repository and branch
- Triggers sync for playbooks whose paths match changed files
- Logs all webhook activity for debugging

**Supported Events**:
- `push` - Triggers playbook sync when files change

**Setup**:
1. In GitHub repository settings, add webhook URL: `https://your-domain/api/v2/webhooks/github`
2. Set content type to `application/json`
3. Add secret (same as `GITHUB_WEBHOOK_SECRET` env var)
4. Select "Push events" only

### Inventory JSON Format

The platform generates Ansible-compatible JSON inventory files for job execution. The format follows Ansible's JSON inventory requirements:

**Correct Format**:
```json
{
  "_meta": {
    "hostvars": {
      "webserver1": {
        "ansible_host": "192.168.1.100"
      }
    }
  },
  "all": {
    "children": {
      "webservers": null,
      "ungrouped": null
    }
  },
  "webservers": {
    "hosts": {
      "webserver1": null
    }
  },
  "ungrouped": {
    "hosts": {
      "standalone_host": null
    }
  }
}
```

**Key Requirements** (per Ansible documentation):
- `hosts` must be a dictionary, not an array: `{"hostname": null}` not `["hostname"]`
- `children` must be a dictionary, not an array: `{"groupname": null}` not `["groupname"]`
- `_meta.hostvars` is the only valid content in `_meta` group
- Host variables go in `_meta.hostvars`, not inline with hosts

**Implementation**: See `GenerateInventoryJSON()` in `/backend/internal/services/ansible/inventory.go`

### Known Limitations (Phase 1)

1. ~~**No dynamic inventory sync** - Only static inventories supported~~ ✅ **Dynamic inventories implemented** - AWS, Azure, GCP, VMware via native Ansible plugins
2. **No Galaxy integration** - Manual role/collection management
3. ~~**No scheduled jobs** - Manual triggering only~~ ✅ **Scheduled jobs implemented** - Cron-based scheduling for job templates, inventory sync, playbook sync
4. **No approval gates** - All jobs execute immediately
5. **No real-time WebSocket streaming** - Polling-based updates only

---

## Detailed Implementation Roadmap

This section provides a comprehensive phased implementation plan comparing to AWX functionality.

### AWX Feature Comparison

| AWX Feature | Current Status | Priority |
|-------------|----------------|----------|
| Inventories (static) | ✅ Complete | P0 |
| Inventories (dynamic - AWS, Azure, GCP) | ❌ Not Started | P1 |
| Credentials | ✅ Complete | P0 |
| Projects (Playbooks with SCM) | ✅ Complete | P0 |
| **Project SCM Sync** | ✅ Complete | P0 |
| Job Templates | ✅ Complete | P0 |
| Jobs | ✅ Complete | P0 |
| Job Events Streaming | ⚠️ Polling Only | P1 |
| Workflow Templates | ❌ Not Started | P2 |
| Schedules (Cron) | ❌ Not Started | P2 |
| Notifications | ❌ Not Started | P2 |
| Teams/RBAC | ⚠️ Basic Auth Only | P2 |
| Instance Groups | ❌ Not Started | P3 |
| Custom Credential Types | ❌ Not Started | P3 |
| Surveys (Job Prompts) | ❌ Not Started | P2 |

### Phase 2: Enhanced Features (Next Priority)

**Timeline**: 4-6 weeks

#### 2.1 Dynamic Inventories ✅ IMPLEMENTED
- [x] Implement cloud inventory plugins (AWS EC2, Azure, GCP, VMware)
- [x] Add inventory source configuration model
- [x] Implement periodic inventory sync using native Ansible plugins
- [x] Add inventory caching with DB storage
- [x] Show sync status and last sync time
- [x] Add inventory source configuration UI (frontend complete)

**Implementation Details**:

The dynamic inventory implementation uses **native Ansible inventory plugins** via the `ansible-inventory` CLI rather than reimplementing cloud provider APIs in Go. This approach:
- Uses well-maintained Ansible Galaxy collections (amazon.aws.ec2, azure.azcollection.azure_rm, google.cloud.gcp_compute, community.vmware.vmware_vm_inventory)
- Maintains compatibility with AWX/AAP approaches
- Reduces maintenance burden by leveraging community-maintained plugins

**Backend Implementation (Complete)**:
- Created `AnsibleInventorySource` model with provider-specific configuration (AWS regions/filters, Azure resource groups, GCP projects/zones, VMware datacenters)
- Created `AnsibleInventorySourceRepository` for CRUD operations and sync status tracking
- Implemented `InventorySourceService` that:
  - Generates inventory plugin YAML configurations dynamically
  - Executes `ansible-inventory --list` with appropriate credentials
  - Parses JSON output and updates inventory hosts/groups in database
  - Supports grouping by cloud attributes (region, instance type, tags, etc.)
- Created API handlers for inventory source management (`/api/v2/ansible/inventories/:id/sources`)
- Credentials are encrypted with AES-256-GCM and passed via environment variables to ansible-inventory

**Supported Cloud Providers**:
- **AWS EC2**: Uses `amazon.aws.ec2` plugin with region filtering, tag-based grouping
- **Azure**: Uses `azure.azcollection.azure_rm` plugin with resource group filtering
- **GCP**: Uses `google.cloud.gcp_compute` plugin with project/zone filtering
- **VMware vSphere**: Uses `community.vmware.vmware_vm_inventory` plugin with datacenter/cluster filtering

**Frontend Implementation (Complete)**:
- Added "Sources" tab to InventoryDetail.tsx (visible only for dynamic inventory type)
- Source list displays provider type, sync status, host count, last sync time
- Create source dialog with:
  - Provider type selection (AWS, Azure, GCP, VMware, Custom)
  - Credential selector filtered by provider type
  - Hostname variable selection (public_ip, private_ip, name, dns_name)
  - Grouping options (by region, availability zone, instance ID, custom tag)
  - Update on launch toggle
- Sync button triggers immediate inventory refresh
- Error display for failed syncs
- API client functions in `ansibleInventorySourcesApi`
- JSON:API helper `getAnsibleInventorySourceFromJsonApi`

#### 2.2 Real-time Job Output Streaming
- [ ] Implement WebSocket connection for job output
- [ ] Stream job events in real-time
- [ ] Show live task progress
- [ ] Support job cancellation via WebSocket

**Backend Tasks**:
- Add WebSocket handler in Go using gorilla/websocket
- Stream events from Redis pub/sub
- Handle connection lifecycle and reconnection

**Frontend Tasks**:
- Create WebSocket hook for job detail page
- Update JobDetail to show live updates
- Add connection status indicator

#### 2.3 Ansible Galaxy Integration
- [ ] Support `requirements.yml` parsing
- [ ] Auto-install dependencies before job execution
- [ ] Cache installed collections per runner
- [ ] Show installed collections in UI

**Backend Tasks**:
- Parse `requirements.yml` from playbook repo
- Run `ansible-galaxy install` before playbook execution
- Track installed collections in database

**Frontend Tasks**:
- Display Galaxy requirements in playbook detail
- Show installed collections status

### Phase 2.5: Usability Improvements ✅ COMPLETE

**Timeline**: 2-3 weeks
**Status**: Completed

#### 2.5.1 Playbook Detail Page ✅
- [x] Create PlaybookDetail.tsx component
- [x] Show playbook SCM configuration
- [x] Display related job templates
- [x] Add edit/delete functionality
- [x] Show recent job history
- [x] Add SCM sync button

#### 2.5.2 Job Template Detail Page ✅
- [x] Create JobTemplateDetail.tsx component
- [x] Show template configuration
- [x] Display linked playbook and inventory
- [x] Show execution settings (verbosity, forks, privilege escalation)
- [x] Display launch form with variable overrides
- [x] Show recent job history with status badges
- [x] Add edit functionality

#### 2.5.3 Launch Job from UI ✅
- [x] Create job launch dialog with:
  - Extra variables input (JSON)
  - Limit/Tags/Skip-tags options
- [x] Support launching from job template detail page
- [ ] Support launching from inventory page (future)
- [ ] Support launching from playbook page (future)

#### 2.5.4 List Page Create Dialogs ✅
- [x] Add create dialog to Playbooks list page
- [x] Add create dialog to Job Templates list page (with playbook/inventory/credential selectors)
- [x] Update empty state messages to reflect org-scoped creation

#### 2.5.5 Navigation Improvements ✅
- [x] Add "All Organizations" link to sidebar when in org-scoped view
- [x] Add "Organizations" link to sidebar in global view

### Phase 3: Advanced Integration

**Timeline**: 6-8 weeks

#### 3.1 Workflow Templates
- [ ] Design workflow graph data model
- [ ] Implement workflow execution engine
- [ ] Create workflow visual editor (React Flow)
- [ ] Support conditional branching
- [ ] Support parallel execution

**AWX Workflow Features to Support**:
- Success/Failure/Always paths
- Convergence nodes
- Inventory/credential override at node level
- Workflow visualization

#### 3.2 Scheduled Jobs ✅ IMPLEMENTED
- [x] Create scheduling model with cron expressions
- [x] Implement scheduler service
- [x] Support enabling/disabling schedules
- [x] Show next run time calculation
- [x] Support multiple schedule types (job templates, inventory sync, playbook sync)
- [x] Add schedule management UI (frontend complete)

**Implementation Details**:

The scheduler service provides AWX-like scheduled execution for various Ansible operations.

**Backend Implementation (Complete)**:
- Created `AnsibleSchedule` model with:
  - Cron expression support (standard 5-field format)
  - Timezone support
  - Multiple schedule types: `job_template`, `inventory_source`, `playbook_sync`
  - Configurable target (job template ID, inventory source ID, or playbook ID)
  - Status tracking (enabled/disabled), last run info, next run time
  - Schedule-specific configuration (extra_vars overrides, etc.)

- Created `SchedulerService` with:
  - Background worker that checks for due schedules every 30 seconds
  - Uses `robfig/cron/v3` for cron expression parsing
  - Calculates next run time based on cron + timezone
  - Executes schedules by type (launch job, sync inventory, sync playbook)
  - Updates last run status and calculates next run time after execution
  - Graceful startup/shutdown integration with API server

- Created API handlers for schedule management:
  - `GET/POST /api/v2/organizations/:name/ansible/schedules` - List/create schedules
  - `GET/PATCH/DELETE /api/v2/ansible/schedules/:id` - Manage individual schedules
  - `POST /api/v2/ansible/schedules/:id/actions/enable` - Enable schedule
  - `POST /api/v2/ansible/schedules/:id/actions/disable` - Disable schedule
  - `POST /api/v2/ansible/schedules/:id/actions/run-now` - Trigger immediate execution
  - `POST /api/v2/ansible/schedules/validate-cron` - Validate cron expression
  - `GET /api/v2/ansible/schedules/cron-presets` - Get common cron presets

**Cron Presets Provided**:
- `@hourly` → `0 * * * *`
- `@daily` → `0 0 * * *`
- `@weekly` → `0 0 * * 0`
- `@monthly` → `0 0 1 * *`
- `every_6_hours` → `0 */6 * * *`
- `every_12_hours` → `0 */12 * * *`
- `weekdays_9am` → `0 9 * * 1-5`

**Frontend Implementation (Complete)**:
- Created `/frontend/src/pages/Ansible/Schedules.tsx` with full schedule management
- Schedule list page with:
  - Stats cards (total, active, disabled, total runs)
  - Search and filter by status/type
  - Table view with schedule details
- Schedule creation dialog with:
  - Name and description
  - Schedule type selector (Job Template, Inventory Sync, Playbook Sync)
  - Job template selector for job_template type
  - Cron expression input with preset dropdown
  - Timezone selector
- Schedule actions:
  - Enable/disable toggle
  - Run now button
  - Delete
- Display columns:
  - Name and description
  - Type badge
  - Cron expression with timezone
  - Next run time (calculated)
  - Last run time with status badge
  - Run count
  - Status badge (enabled/disabled)
- Added route `/app/:orgName/ansible/schedules`
- Added sidebar navigation link under Ansible section
- API client functions in `ansibleSchedulesApi` (list, create, update, delete, enable, disable, runNow)
- JSON:API helper `getAnsibleScheduleFromJsonApi`

#### 3.3 Surveys (Job Prompts)
- [ ] Add survey specification to job templates
- [ ] Generate dynamic form from survey spec
- [ ] Validate survey responses
- [ ] Pass survey variables to job

**Survey Field Types to Support**:
- Text (single line, multi-line)
- Number (integer, float)
- Password (encrypted)
- Multiple Choice
- Multiple Select

#### 3.4 Notifications
- [ ] Create notification template model
- [ ] Support Slack, Email, Webhook notifications
- [ ] Trigger on job start/success/failure
- [ ] Add notification configuration UI

### Phase 4: Enterprise Features

**Timeline**: 8-12 weeks

#### 4.1 Enhanced RBAC
- [ ] Define Ansible-specific permissions
- [ ] Implement inventory-level access control
- [ ] Add credential usage permissions
- [ ] Support organization admin roles
- [ ] Audit permission changes

**Permission Types**:
- Inventory: View, Edit, Admin, Use
- Credential: View, Use, Admin
- Project/Playbook: View, Edit, Admin
- Job Template: View, Edit, Execute, Admin

#### 4.2 Unified Terraform + Ansible Workflows
- [ ] Design unified workflow model
- [ ] Support Terraform → Ansible handoff
- [ ] Share outputs/variables between runs
- [ ] Create visual workflow designer

**Use Cases**:
- Provision with Terraform, configure with Ansible
- Pass Terraform outputs as Ansible variables
- Rollback on Ansible failure

#### 4.3 Custom Credential Types
- [ ] Create credential type definition model
- [ ] Support custom input fields
- [ ] Support custom injector templates
- [ ] Add credential type management UI

#### 4.4 Instance Groups / Execution Environments
- [ ] Support multiple runner pools
- [ ] Add instance group assignment
- [ ] Support custom execution environments
- [ ] Container-based job isolation

### Phase 5: Observability & Operations

**Timeline**: 4-6 weeks

#### 5.1 Audit Logging
- [ ] Log all Ansible resource changes
- [ ] Log all job executions
- [ ] Add audit log viewer UI
- [ ] Support audit export

#### 5.2 Metrics & Dashboard
- [ ] Add Prometheus metrics endpoint
- [ ] Track job duration, success rate
- [ ] Create Ansible dashboard widgets
- [ ] Show resource usage trends

#### 5.3 Compliance Reporting
- [ ] Generate compliance reports
- [ ] Track host compliance status
- [ ] Support policy checks
- [ ] Export audit data

---

## API Reference Updates

### TFE-Compatible API Pattern (Updated)

**Design Principle**: All Ansible API endpoints now follow the same pattern as Terraform/TFE endpoints:
- **List/Create operations** are **organization-scoped** (not project-scoped)
- **Get/Update/Delete operations** are by **resource ID**
- **Projects are logical groupings for UI** - optionally specified in request body, defaults to first project if not provided

This ensures a unified API structure between TFE (Terraform) and AWX (Ansible) functionality.

### Organization-Scoped Endpoints (Current)

```
# Inventories (Organization-scoped - unchanged)
GET    /api/v2/organizations/:name/ansible/inventories       - List all inventories
POST   /api/v2/organizations/:name/ansible/inventories       - Create inventory

# Credentials (Organization-scoped - unchanged)
GET    /api/v2/organizations/:name/ansible/credentials       - List all credentials
POST   /api/v2/organizations/:name/ansible/credentials       - Create credential

# Playbooks (Organization-scoped - UPDATED)
GET    /api/v2/organizations/:name/ansible/playbooks         - List all playbooks in org
POST   /api/v2/organizations/:name/ansible/playbooks         - Create playbook (project optional in body)

# Job Templates (Organization-scoped - UPDATED)
GET    /api/v2/organizations/:name/ansible/job-templates     - List all templates in org
POST   /api/v2/organizations/:name/ansible/job-templates     - Create template (project optional in body)

# Jobs (Organization-scoped - UPDATED)
GET    /api/v2/organizations/:name/ansible/jobs              - List all jobs in org
POST   /api/v2/organizations/:name/ansible/jobs              - Launch job (project optional in body)
GET    /api/v2/organizations/:name/ansible/jobs/queue        - Get job queue
```

### Project-Scoped Endpoints (Read-only, for filtering)

```
# Playbooks (Project-scoped - read-only)
GET    /api/v2/projects/:id/ansible/playbooks                - List playbooks by project

# Job Templates (Project-scoped - read-only)
GET    /api/v2/projects/:id/ansible/job-templates            - List templates by project

# Jobs (Project-scoped - read-only)
GET    /api/v2/projects/:id/ansible/jobs                     - List jobs by project
```

### Resource ID Endpoints (Unchanged)

```
# Inventories
GET    /api/v2/ansible/inventories/:id
PATCH  /api/v2/ansible/inventories/:id
DELETE /api/v2/ansible/inventories/:id

# Credentials
GET    /api/v2/ansible/credentials/:id
PATCH  /api/v2/ansible/credentials/:id
DELETE /api/v2/ansible/credentials/:id

# Playbooks
GET    /api/v2/ansible/playbooks/:id
PATCH  /api/v2/ansible/playbooks/:id
DELETE /api/v2/ansible/playbooks/:id
POST   /api/v2/ansible/playbooks/:id/actions/sync

# Job Templates
GET    /api/v2/ansible/job-templates/:id
PATCH  /api/v2/ansible/job-templates/:id
DELETE /api/v2/ansible/job-templates/:id
POST   /api/v2/ansible/job-templates/:id/launch

# Jobs
GET    /api/v2/ansible/jobs/:id
POST   /api/v2/ansible/jobs/:id/actions/cancel
POST   /api/v2/ansible/jobs/:id/actions/relaunch
GET    /api/v2/ansible/jobs/:id/events
GET    /api/v2/ansible/jobs/:id/output
```

### Request Body Format for Create Operations

When creating playbooks, job templates, or jobs, the `project` relationship is **optional**. If not provided, the backend will use the first project in the organization (matching Terraform workspace creation behavior).

**Example - Create Playbook with explicit project:**
```json
{
  "data": {
    "type": "ansible-playbooks",
    "attributes": {
      "name": "webserver-setup",
      "scm-type": "git",
      "scm-url": "https://github.com/example/playbooks.git",
      "scm-branch": "main",
      "playbook-path": "site.yml"
    },
    "relationships": {
      "project": {
        "data": { "id": "project-uuid", "type": "projects" }
      }
    }
  }
}
```

**Example - Create Playbook without project (uses default):**
```json
{
  "data": {
    "type": "ansible-playbooks",
    "attributes": {
      "name": "webserver-setup",
      "scm-type": "git",
      "scm-url": "https://github.com/example/playbooks.git"
    }
  }
}
```

---

**Document Version**: 1.9  
**Last Updated**: 2025-12-13  
**Status**: Phase 1 Complete, Phase 2.5 Complete (with list page create dialogs), TFE-Compatible API Pattern Implemented

---

## Implementation Notes and Known Issues

### Docker Volume Permissions

**Issue**: The ansible-runner container may fail with "permission denied" errors when trying to create directories in `/home/iac/workspaces/`.

**Root Cause**: The Docker volume `runner-workspaces` is shared between the terraform runner and ansible-runner containers. If the volume is created with different UID ownership, the `iac` user (UID 1000) cannot write to it.

**Solution**: Ensure the volume data directory has correct ownership:
```bash
# Fix permissions on the host
sudo chown -R 1000:1000 /var/lib/docker/volumes/deploy_runner-workspaces/_data/

# Or fix inside the container as root
docker compose exec -u root ansible-runner chown -R iac:iac /home/iac/workspaces
```

**Prevention**: The Dockerfile already creates the workspaces directory with correct ownership. However, when using Docker volumes, the volume's permissions take precedence over the container's filesystem.

### JSON:API Response Parsing

**Issue**: Frontend displayed "Unknown" for Playbook and Inventory in job detail pages.

**Root Cause**: The API returns data in JSON:API format with `{ id, type, attributes, relationships }` structure, but the frontend was treating `res.data` as a flat object instead of parsing the JSON:API format.

**Solution**: Added `parseJobFromJsonApi()` function in `frontend/src/api/ansible.ts` that properly extracts:
- Attributes from `resource.attributes` (using kebab-case keys like `extra-vars`, `become-enabled`)
- Related IDs from `resource.relationships` (project, playbook, inventory, credential, etc.)

### Sync Worker Architecture

The ansible-runner runs two separate worker goroutines:
1. **Job Worker** - Listens on `ansible_jobs` Redis queue for playbook execution
2. **Sync Worker** - Listens on `ansible_sync` Redis queue for VCS sync operations

Both must be running for full functionality. Check logs for:
```
Ansible Runner started, waiting for jobs...
Ansible Sync Worker started, waiting for sync requests...
```

### Phase 1.6: UX Improvements and Bug Fixes ✅ COMPLETE

**Timeline**: December 2025
**Status**: Completed

This phase addresses several UX issues and bug fixes discovered during testing.

#### Bug Fixes

**1. Connection Status Badge Not Dismissing**

**Issue**: The "Connection restored" badge remained visible after reconnecting, even when the user interacted with the UI.

**Solution**: Added event listeners in `ConnectionStatus.tsx` for `focus`, `click`, and `keydown` events that automatically hide the badge when the user interacts with the window.

**2. Inventory JSON Format Fix**

**Issue**: Ansible job execution failed with "exit status 4" (hosts unreachable). Investigation revealed the inventory JSON format was using arrays for hosts instead of dictionaries.

**Root Cause**: Ansible JSON inventory expects hosts as `{"hostname": {}}` (dict), not `["hostname"]` (array).

**Fix**: Updated `GenerateInventoryJSON()` in `/backend/internal/services/ansible/inventory.go` to generate hosts as dictionaries:
```go
// Before (incorrect):
hostList := []string{}
groupData["hosts"] = hostList

// After (correct):
hostDict := make(map[string]interface{})
hostDict[host.Name] = nil
groupData["hosts"] = hostDict
```

**3. Improved Error Capture in Ansible Runner**

**Issue**: When ansible-playbook failed, only the exit code was captured, not the actual error output explaining why.

**Fix**: Updated `runAnsiblePlaybook()` in ansible-runner to:
- Use `sync.WaitGroup` to ensure stdout/stderr goroutines complete before `cmd.Wait()`
- Capture stderr separately and include in error messages
- Log stderr output for debugging

#### New Features

**1. Clickable Job Templates**

**Issue**: Job template cards in the list view weren't navigating to detail pages when clicked.

**Solution**: Added `onClick` handler to Card component in `JobTemplates.tsx` that navigates to the job template detail page.

**2. Playbook File Content Viewer**

**Issue**: Users couldn't view the actual playbook file content from the PlaybookDetail page.

**Solution**: 
- Added `GetFileContent()` method to GitHubAppService to fetch file content from repositories
- Created `/api/v2/vcs-connections/:id/repositories/:owner/:repo/contents/*path` endpoint
- Added frontend API function `vcsConnectionsApi.getFileContent()`
- Added "Content" tab to PlaybookDetail page with:
  - File content display in syntax-highlighted pre block
  - Refresh button to reload content
  - Loading and error states
  - Graceful handling when VCS not configured

**3. Auto-Generated Playbook Names**

**Issue**: Users had to manually enter playbook names when creating from VCS.

**Solution**: Auto-generate name from `{repository}-{branch}-{path}` when VCS fields are selected.

**4. Auto-Fill Inventory Host Names**

**Issue**: Users had to enter both "name" and "hostname/IP" fields when adding hosts, even though they're often the same.

**Solution**: Auto-fill the "Name" field with the hostname/IP value if name is empty when hostname is entered.

**5. Error Message Display in Job Output**

**Issue**: Job failures only showed status badge, not the actual error message.

**Solution**: Added error_message display in JobDetail output tab when job has failed status.

### Phase 1.7: Job Event Parsing and UI Improvements ✅ COMPLETE

**Timeline**: December 2025
**Status**: Completed

This phase addresses issues with job output parsing and improves the UI for viewing job events.

#### Issues Resolved

**1. JSON Callback Output Parsing**

**Issue**: The Ansible JSON callback (`ANSIBLE_STDOUT_CALLBACK=json`) outputs a single multi-line JSON object. The runner was parsing line-by-line, resulting in fragmented events like `{`, `"custom_stats": {},`, etc.

**Solution**: Changed stdout handling to:
1. Capture complete stdout output using `io.ReadAll()`
2. Parse the complete JSON after command execution
3. Extract structured events (plays, tasks, hosts) from the JSON
4. Store meaningful events with proper host, task, play, and status information

**2. Working Directory for Playbooks**

**Issue**: When playbook path was `ansible/site.yml`, the runner set working directory to repo root. Ansible couldn't find roles at `roles/` because they were at `ansible/roles/`.

**Solution**: The runner now sets the working directory to the directory containing the playbook file, not the repo root. This ensures Ansible can find relative paths to roles, group_vars, inventory files, etc.

**3. Encryption Key Mismatch**

**Issue**: The API service was missing the `ANSIBLE_ENCRYPTION_KEY` environment variable, causing credentials encrypted by the API to fail decryption in the ansible-runner.

**Solution**: Added `ANSIBLE_ENCRYPTION_KEY` to the API service in docker-compose.yml, ensuring both services use the same encryption key.

**4. Deprecation Warnings UI**

**Issue**: Deprecation warnings were displayed as error events mixed with actual task events, making it hard to distinguish warnings from real errors.

**Solution**: 
- Warnings and deprecation messages are now separated into their own card
- Yellow translucent card with warning icon for warnings
- Warnings section appears before the Events tab
- Regular events tab only shows task execution events

#### UI Improvements

**Job Events Display**:
- Events now show structured information: Play name, Task name, Host
- Status badges are color-coded: OK (green), FAILED (red), UNREACHABLE (red), SKIPPED (gray)
- Host shown with server icon badge
- Task name displayed prominently
- Output/message shown in preformatted block

**Warnings Card**:
- Separate card with yellow border and background
- Warning icon with count
- Scrollable list of warning messages
- Doesn't clutter the events tab

#### Technical Details

**Revised Event Structure**:
```go
// Events from ansible-playbook JSON callback are now properly parsed
event := &models.AnsibleJobEvent{
    JobID:   jobID,
    Event:   "runner_on_ok" | "runner_on_failed" | "runner_on_unreachable" | "runner_on_skipped",
    Host:    hostName,
    Task:    taskName,
    Play:    playName,
    Stdout:  msg,          // Message from ansible output
    Changed: changed,      // Whether task made changes
    Failed:  failed,       // Whether task failed
    Skipped: skipped,      // Whether task was skipped
}
```

**Frontend Event Filtering**:
```typescript
const { warnings, regularEvents } = useMemo(() => {
  const warnings: AnsibleJobEvent[] = [];
  const regularEvents: AnsibleJobEvent[] = [];
  
  for (const event of events) {
    const isWarning = 
      event.event_type === 'runner_stderr' && 
      (event.stderr?.includes('[WARNING]') || 
       event.stderr?.includes('[DEPRECATION WARNING]'));
    
    if (isWarning) warnings.push(event);
    else regularEvents.push(event);
  }
  
  return { warnings, regularEvents };
}, [events]);
```

### Phase 1.8: Schedules API, Deletion Constraints & Compact Job UI ✅ COMPLETE

**Timeline**: December 2025
**Status**: Completed

This phase fixes API issues with schedules and improves the Job Detail UI.

#### Issues Resolved

**1. Schedules API Organization ID**

**Issue**: The schedules API was expecting `organization_id` from context (set by middleware), but the organization-scoped routes use `:name` URL parameter.

**Root Cause**: `ScheduleHandler` didn't have access to `orgRepo` to look up organization by name.

**Solution**: 
- Added `orgRepo *repository.OrganizationRepository` to `ScheduleHandler` struct
- Updated `NewScheduleHandler()` to accept orgRepo parameter
- Changed `Create()` and `ListByOrganization()` to get org by name from URL param like other handlers

**2. Credential Deletion Foreign Key Constraint**

**Issue**: Deleting a credential failed with FK constraint error because job templates reference credentials.

**Solution**: 
- Added proper error handling in credential delete endpoint
- Returns HTTP 409 Conflict with helpful message: "Cannot delete credential: it is referenced by one or more job templates, jobs, or inventory sources. Remove the credential from those resources first."

**3. Job Template Deletion Foreign Key Constraint**

**Issue**: Deleting a job template failed with FK constraint error because schedules reference job templates.

**Solution**:
- Added proper error handling in job template delete endpoint  
- Returns HTTP 409 Conflict with helpful message: "Cannot delete job template: it is referenced by one or more schedules or jobs. Delete those first."

#### UI Improvements

**Compact Job Detail Page**:

The Job Detail page was completely rewritten with a more compact layout:

1. **Compact Header Bar**:
   - Single horizontal bar with job name, status badge
   - Duration, playbook, inventory shown inline (not in separate cards)
   - Cancel/Relaunch buttons in header

2. **Inline Stats Bar**:
   - Horizontal stats bar (OK, Changed, Failed, Skipped, Unreachable)
   - Only shown for completed jobs
   - Much more compact than previous 5-card grid

3. **Collapsible Warnings Banner**:
   - Yellow banner with warning count
   - Click to expand/collapse warning details
   - Checks both stderr and stdout for [WARNING] and [DEPRECATION WARNING]

4. **Searchable Output**:
   - Search bar at top of output panel
   - Highlights matching text in yellow
   - Clear button to reset search

5. **Filterable Events**:
   - Search box for events
   - Host filter dropdown (only shown if multiple hosts)
   - Status filter (All/OK/Failed/Skipped/Unreachable)
   - Events count badge on tab
   - Compact event display with status icons

#### Code Changes

**Backend - schedules.go**:
```go
type ScheduleHandler struct {
    schedulerService *ansible.SchedulerService
    orgRepo          *repository.OrganizationRepository  // Added
}

func (h *ScheduleHandler) ListByOrganization(c *gin.Context) {
    // Changed from context lookup to URL param
    orgName := c.Param("name")
    org, err := h.orgRepo.GetByName(orgName)
    // ...
}
```

**Backend - credentials.go**:
```go
if strings.Contains(errStr, "violates foreign key constraint") {
    c.JSON(http.StatusConflict, gin.H{
        "errors": []gin.H{
            {"status": "409", "title": "Conflict", "detail": "Cannot delete credential..."},
        },
    })
    return
}
```

**Frontend - JobDetail.tsx**:
- Complete rewrite with compact layout
- Added `outputSearch`, `eventSearch`, `hostFilter`, `statusFilter` state
- Added `useMemo` for `filteredEvents` and `highlightedOutput`
- Collapsible warnings banner with `showWarnings` state

#### Technical Details

**VCS File Content API**:
```go
// Handler: VCSConnectionHandlerV2.GetFileContent
// Route: GET /api/v2/vcs-connections/:id/repositories/:owner/:repo/contents/*path
// Query params: ?ref=branch_name (optional)
// Response: { data: { content: string, path: string, ref: string } }
```

**Frontend Integration**:
```typescript
// API client addition
vcsConnectionsApi.getFileContent(connectionId, owner, repo, path, ref?)

// PlaybookDetail tabs now include:
// - Overview (existing)
// - Content (new - shows playbook file)
// - Job Templates (existing)
// - Recent Jobs (existing)
```

### Current Implementation Status

### Phase 1.9: Event Type Attribute Fix & Enhanced Warnings Display ✅ COMPLETE

**Timeline**: December 2025
**Status**: Completed

This phase fixes event type attribute naming inconsistency and improves warnings/events display.

#### Issues Resolved

**1. Event Type Attribute Mismatch**

**Issue**: Events displayed gray play icons instead of proper status icons (green checkmark, red X, etc.)

**Root Cause**: Backend `formatEventResponse` returned `"event": event.Event` but frontend expected `"event-type"` attribute (JSON:API kebab-case convention).

**Solution**: Changed backend to use `"event-type": event.Event` for consistency with JSON:API naming.

```go
// Before
"event": event.Event,

// After  
"event-type": event.Event,
```

**2. Test Playbook Permission Error**

**Issue**: Test playbook failed with "Permission denied" when creating `/opt/stackweaver` and `/var/log/stackweaver` directories.

**Root Cause**: The "Ensure common directories exist" task in `roles/common/tasks/main.yml` was missing `become: true`.

**Solution**: Added `become: true` to the task:
```yaml
- name: Ensure common directories exist
  ansible.builtin.file:
    path: "{{ item }}"
    state: directory
    mode: '0755'
  loop:
    - /opt/stackweaver
    - /var/log/stackweaver
  become: true  # Added
```

#### UI Improvements

**1. Individual Warning Parsing**

Warnings are now parsed and displayed as separate items instead of raw text blocks:

- **Before**: Single `<pre>` block with all warning text concatenated
- **After**: Each warning is extracted and displayed as a separate card

**Implementation**:
```typescript
// Parse individual warnings from text
const parseWarnings = (text: string): { type: 'warning' | 'deprecation'; message: string }[] => {
  const result = [];
  const regex = /\[(DEPRECATION )?WARNING\]:\s*([^\[]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    result.push({
      type: match[1] ? 'deprecation' : 'warning',
      message: match[2].trim().replace(/\s+/g, ' ')
    });
  }
  return result;
};
```

**Visual presentation**:
- Each warning displayed in its own styled card
- DEPRECATED warnings: Orange badge, orange border
- Regular warnings: Yellow badge, yellow border
- Duplicate warnings are deduplicated by message

**2. AWX-Style Event Status Display**

Events now show AWX-like status indicators with colored icons and badges:

| Status | Icon | Color | Background |
|--------|------|-------|------------|
| OK | CheckCircle | Green | None |
| Changed | CheckCircle | Yellow | Light yellow |
| Failed | AlertCircle | Red | Red tint |
| Unreachable | AlertTriangle | Orange | Orange tint |
| Skipped | Ban | Gray | None |
| Other | Play | Muted | None |

**Status Badge**: Added inline badge showing status text (OK, CHANGED, FAILED, etc.) with matching colors.

**Status Filter**: Added "Changed" option to the status filter dropdown.

**Status Logic**: Updated to check both `event_type` and boolean flags:
```typescript
const getEventStatus = () => {
  if (event.event_type?.includes('failed') || event.failed) return 'failed';
  if (event.event_type?.includes('unreachable')) return 'unreachable';
  if (event.event_type?.includes('skipped') || event.skipped) return 'skipped';
  if (event.changed) return 'changed';
  if (event.event_type?.includes('ok')) return 'ok';
  return 'other';
};
```

#### Code Changes

**Backend - jobs.go**:
```go
// formatEventResponse - Fixed attribute naming
"event-type": event.Event,  // Was "event"
```

**Backend - roles/common/tasks/main.yml**:
```yaml
become: true  # Added to directory creation task
```

**Frontend - JobDetail.tsx**:
- Added `parseWarnings()` function for individual warning extraction
- Changed `warnings` to `parsedWarnings` (array of {type, message})
- Added status badge next to host badge in event rows
- Updated status logic to handle `changed` state
- Added "Changed" option to status filter dropdown
- Updated filter logic to use same status determination

#### Technical Notes

**JSON:API Consistency**:
The backend now consistently uses kebab-case for all attribute names in JSON:API responses:
- `event-type` (not `event`)
- `event-data`
- `created-at`
- etc.

**Warning Regex Pattern**:
```regex
/\[(DEPRECATION )?WARNING\]:\s*([^\[]+)/g
```
This captures both `[WARNING]` and `[DEPRECATION WARNING]` patterns, extracting the message text until the next `[` or end of string.


#### ✅ Implemented Features
- Organization-scoped inventories (static type)
- Host and group management within inventories
- Credential management (multiple types: SSH, machine, cloud providers)
- VCS-backed playbooks (GitHub App integration)
- Job templates with playbook + inventory + credential associations
- Job execution with real-time output streaming
- Sync from VCS functionality
- Playbook file content viewing
- Auto-generated names for playbooks
- Auto-fill host names in inventories
- Improved error capture and display
- Dynamic inventory with cloud source configuration (AWS, Azure, GCP, VMware)
- Cascade delete for job templates (automatically removes associated jobs and schedules)
- Enhanced job details with clickable playbook/inventory links and stats icons
- Schedule management with color-coded status indicators

#### 🔄 In Progress
- Job scheduling (cron-based)
- Advanced RBAC for Ansible resources

#### 📋 Planned
- Ansible Facts collection and display
- Role and collection management
- Workflow templates (multi-playbook orchestration)
- Survey/prompt variables for job templates

---

## Update Log - December 15, 2025

### Dynamic Inventory UI/UX Improvements

The dynamic inventory feature has been redesigned for better usability:

**Changes:**

1. **API Endpoint Fixes** (`inventory_sources.go`):
   - Fixed `List` handler to use path parameter `c.Param("id")` instead of query parameter `c.Query("inventory_id")`
   - Fixed `Create` handler to get inventory ID from path parameter for route `/ansible/inventories/:id/sources`
   - Updated other handlers (`Get`, `Update`, `Delete`, `Sync`) to use `:source_id` path parameter correctly

2. **Inventory Creation Flow** (`Inventories.tsx`):
   - Added informative type descriptions when selecting inventory type
   - Dynamic inventories now redirect to detail page with `?setup=true` parameter
   - Added icons to inventory type selection (Database, Cloud, GitBranch)

3. **Dynamic Inventory Detail Page** (`InventoryDetail.tsx`):
   - Auto-opens source configuration dialog when created with `?setup=true`
   - Shows info banner explaining that hosts are managed by cloud sources
   - Hides "Add Host" button for dynamic inventories (hosts come from sources)
   - Hides host delete dropdown for dynamic inventories
   - Defaults to Sources tab for dynamic inventories
   - Fixed Radix UI select error for credential dropdown (changed empty string to "none" value)

4. **Schedule Status Icons** (`Schedules.tsx`):
   - Added color coding to all stats card icons:
     - Total Schedules: Blue
     - Active: Green
     - Disabled: Yellow  
     - Total Runs: Purple
   - Added colored text to counts

5. **Job Template Delete Cascade** (`playbooks.go`, `ansible_job.go`):
   - Added `DeleteByTemplateID` function to job repository
   - Updated `DeleteTemplate` handler to cascade delete:
     1. Delete all schedules referencing the template
     2. Delete all jobs created from the template (including job events)
     3. Delete the template itself
   - No longer returns 409 Conflict, handles cleanup automatically

6. **Job Detail Enhancements** (`JobDetail.tsx`):
   - Made playbook and inventory names clickable links in header bar
   - Made playbook and inventory clickable in Details tab
   - Added icons to job stats bar:
     - OK: CheckCircle (green)
     - Changed: RefreshCw (yellow)
     - Failed: AlertCircle (red)
     - Skipped: Ban (gray)
     - Unreachable: AlertTriangle (orange)

### Technical Notes

**Path Parameter Usage:**
- Routes under `/ansible/inventories/:id/sources` use `c.Param("id")` for inventory ID
- Routes under `/ansible/inventory-sources/:source_id` use `c.Param("source_id")` for source ID
- This matches the route definitions in `ansible_routes.go`

**Cascade Delete Pattern:**
```go
// Delete associated schedules first
h.scheduleRepo.DeleteByJobTemplate(id)

// Delete associated jobs and their events
h.jobRepo.DeleteByTemplateID(id)

// Finally delete the template
h.templateRepo.Delete(id)
```

