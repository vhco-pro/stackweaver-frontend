<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

﻿# Open-Source IaC Orchestration Platform
## Architecture Design Document v1.0

**This document was the original architecture design document for Stackweaver. It's fully deprecated and the platform has evolved past this state since the beginning but is still available for reference.**

---

## 1. Executive Summary

This document outlines the architecture for an open-source Infrastructure as Code (IaC) orchestration platform designed to replace proprietary solutions like Terraform Enterprise and Spacelift, while incorporating the workflow capabilities of Ansible AWX. The platform will be modular, extensible, and built with modern technologies.

**Core Technologies:**
- Backend: Go (Golang)
- Frontend: TypeScript (React)
- Database: PostgreSQL
- Message Queue: NATS/Redis
- Storage: S3-compatible object storage

---

## 2. System Overview

### 2.1 Design Principles

1. **Modularity**: Plugin-based architecture for IaC tools
2. **Scalability**: Horizontal scaling for runners and API services
3. **Security**: Zero-trust architecture with RBAC and audit logging
4. **Extensibility**: Easy integration of new IaC tools
5. **Cloud-Native**: Container-first, Kubernetes-ready
6. **Open Standards**: OpenAPI, gRPC, webhooks

### 2.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Load Balancer                         │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐   ┌────────▼────────┐   ┌───────▼────────┐
│   Web UI       │   │   API Gateway   │   │   Webhooks     │
│  (TypeScript)  │   │   (Go)          │   │   Service      │
└────────────────┘   └─────────────────┘   └────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐   ┌────────▼────────┐   ┌───────▼────────┐
│  Core API      │   │  Workspace      │   │  Runner        │
│  Service       │   │  Service        │   │  Orchestrator  │
└───────┬────────┘   └────────┬────────┘   └────────┬───────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐   ┌────────▼────────┐   ┌───────▼────────┐
│  PostgreSQL    │   │  NATS/Redis     │   │  Object        │
│  (Metadata)    │   │  (Queue)        │   │  Storage (S3)  │
└────────────────┘   └─────────────────┘   └────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
            ┌───────▼────────┐  ┌───────▼────────┐
            │  Runner Pool   │  │  Runner Pool   │
            │  (Terraform)   │  │  (Ansible)     │
            └────────────────┘  └────────────────┘
```

---

## 3. Backend Architecture (Go)

### 3.1 Microservices Breakdown

#### 3.1.1 API Gateway Service
**Responsibility**: Entry point, authentication, rate limiting, routing

```go
// Key Components
- HTTP/gRPC server
- JWT/OAuth2 authentication
- API versioning (v1, v2)
- Request validation
- Rate limiting per user/org
```

**Endpoints Structure:**
```
/api/v1/
  ├── /auth
  ├── /organizations
  ├── /projects
  ├── /workspaces
  ├── /runs
  ├── /state
  ├── /variables
  ├── /policies
  └── /audit
```

#### 3.1.2 Core API Service
**Responsibility**: Business logic, orchestration, CRUD operations

**Key Modules:**
- Organization management
- Project management
- Workspace configuration
- Variable management (encrypted)
- Policy engine (OPA integration)
- RBAC enforcement
- Audit logging

#### 3.1.3 Workspace Service
**Responsibility**: Workspace lifecycle, VCS integration, state management

**Features:**
- Git provider integrations (GitHub, GitLab, Bitbucket, Gitea)
- Webhook handling for push/PR events
- Terraform/Ansible state management
- State locking (distributed locks)
- State versioning and rollback
- Workspace templates

#### 3.1.4 Runner Orchestrator Service
**Responsibility**: Job scheduling, runner assignment, execution monitoring

**Features:**
- Job queue management (NATS/Redis)
- Runner pool management
- Job prioritization
- Retry logic with exponential backoff
- Timeout handling
- Parallel execution control
- Runner health checks

#### 3.1.5 Runner Agents
**Responsibility**: Execute IaC operations in isolated environments

**Architecture:**
```go
type RunnerAgent struct {
    ID          string
    Plugins     map[string]IaCPlugin
    Executor    ContainerExecutor
    StateStore  StateStorage
    Logger      LogStreamer
}

type IaCPlugin interface {
    Init(config PluginConfig) error
    Plan(workspace Workspace) (*PlanResult, error)
    Apply(workspace Workspace, plan Plan) (*ApplyResult, error)
    Destroy(workspace Workspace) (*DestroyResult, error)
    Validate(workspace Workspace) error
}
```

**Plugin System:**
- Terraform plugin
- Ansible plugin
- Pulumi plugin (future)
- OpenTofu plugin
- Custom plugin interface

#### 3.1.6 Notification Service
**Responsibility**: Send notifications via multiple channels

**Features:**
- Slack integration
- Email notifications
- Webhook callbacks
- MS Teams integration
- Custom notification handlers

#### 3.1.7 Policy Service
**Responsibility**: Policy evaluation using Open Policy Agent (OPA)

**Features:**
- Pre-plan policy checks
- Pre-apply policy checks
- Cost estimation policies
- Security compliance (Sentinel-like)
- Custom Rego policies

### 3.2 Database Schema (PostgreSQL)

```sql
-- Core Entities

CREATE TABLE organizations (
    id UUID PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE projects (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE workspaces (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    name VARCHAR(255) NOT NULL,
    iac_type VARCHAR(50), -- terraform, ansible, pulumi
    vcs_provider VARCHAR(50),
    vcs_repo_url TEXT,
    vcs_branch VARCHAR(255),
    working_directory VARCHAR(255),
    terraform_version VARCHAR(20),
    auto_apply BOOLEAN DEFAULT false,
    state_version INT DEFAULT 0,
    locked BOOLEAN DEFAULT false,
    locked_by UUID,
    locked_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(project_id, name)
);

CREATE TABLE runs (
    id UUID PRIMARY KEY,
    workspace_id UUID REFERENCES workspaces(id),
    run_type VARCHAR(50), -- plan, apply, destroy
    status VARCHAR(50), -- pending, planning, planned, applying, applied, errored, canceled
    trigger_type VARCHAR(50), -- manual, vcs, api, scheduled
    triggered_by UUID REFERENCES users(id),
    plan_output TEXT,
    apply_output TEXT,
    error_output TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP
);

CREATE TABLE state_versions (
    id UUID PRIMARY KEY,
    workspace_id UUID REFERENCES workspaces(id),
    version INT NOT NULL,
    state_data JSONB,
    serial BIGINT,
    terraform_version VARCHAR(20),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP,
    UNIQUE(workspace_id, version)
);

CREATE TABLE variables (
    id UUID PRIMARY KEY,
    workspace_id UUID REFERENCES workspaces(id),
    key VARCHAR(255) NOT NULL,
    value TEXT,
    encrypted BOOLEAN DEFAULT false,
    sensitive BOOLEAN DEFAULT false,
    hcl BOOLEAN DEFAULT false,
    description TEXT,
    category VARCHAR(50), -- terraform, ansible, env
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE policies (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    enforcement_level VARCHAR(50), -- advisory, soft-mandatory, hard-mandatory
    policy_type VARCHAR(50), -- opa, sentinel
    policy_code TEXT,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(255),
    resource_type VARCHAR(100),
    resource_id UUID,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP
);

CREATE TABLE runner_pools (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(255),
    max_runners INT DEFAULT 10,
    runner_type VARCHAR(50), -- docker, kubernetes, vm
    created_at TIMESTAMP
);

CREATE TABLE runners (
    id UUID PRIMARY KEY,
    pool_id UUID REFERENCES runner_pools(id),
    status VARCHAR(50), -- idle, busy, offline
    last_heartbeat TIMESTAMP,
    capabilities JSONB, -- supported IaC tools
    current_run_id UUID REFERENCES runs(id),
    created_at TIMESTAMP
);
```

### 3.3 API Design (RESTful + gRPC)

#### REST API Examples

```go
// Workspace Management
POST   /api/v1/organizations/{org}/projects/{project}/workspaces
GET    /api/v1/organizations/{org}/projects/{project}/workspaces
GET    /api/v1/workspaces/{id}
PATCH  /api/v1/workspaces/{id}
DELETE /api/v1/workspaces/{id}

// Run Management
POST   /api/v1/workspaces/{id}/runs
GET    /api/v1/workspaces/{id}/runs
GET    /api/v1/runs/{id}
POST   /api/v1/runs/{id}/actions/apply
POST   /api/v1/runs/{id}/actions/cancel
GET    /api/v1/runs/{id}/logs (SSE stream)

// State Management
GET    /api/v1/workspaces/{id}/state/current
GET    /api/v1/workspaces/{id}/state/versions
POST   /api/v1/workspaces/{id}/state/lock
DELETE /api/v1/workspaces/{id}/state/lock
POST   /api/v1/workspaces/{id}/state/rollback/{version}

// Variables
POST   /api/v1/workspaces/{id}/variables
GET    /api/v1/workspaces/{id}/variables
PATCH  /api/v1/workspaces/{id}/variables/{var_id}
DELETE /api/v1/workspaces/{id}/variables/{var_id}
```

#### gRPC Services (Internal)

```protobuf
service RunnerOrchestrator {
    rpc AssignJob(JobRequest) returns (JobAssignment);
    rpc ReportStatus(StatusReport) returns (Acknowledgment);
    rpc StreamLogs(stream LogChunk) returns (Acknowledgment);
    rpc HeartBeat(RunnerInfo) returns (Acknowledgment);
}

service StateManager {
    rpc LockState(LockRequest) returns (LockResponse);
    rpc UnlockState(UnlockRequest) returns (UnlockResponse);
    rpc GetState(StateRequest) returns (StateData);
    rpc PutState(StateData) returns (StateVersion);
}
```

### 3.4 Plugin System Architecture

```go
// pkg/plugins/interface.go
package plugins

type IaCPlugin interface {
    // Lifecycle
    Init(ctx context.Context, config PluginConfig) error
    Shutdown(ctx context.Context) error
    
    // Core Operations
    Validate(ctx context.Context, workspace *Workspace) (*ValidationResult, error)
    Plan(ctx context.Context, workspace *Workspace, opts PlanOptions) (*PlanResult, error)
    Apply(ctx context.Context, workspace *Workspace, plan *Plan) (*ApplyResult, error)
    Destroy(ctx context.Context, workspace *Workspace) (*DestroyResult, error)
    
    // State Management
    GetState(ctx context.Context, workspace *Workspace) ([]byte, error)
    
    // Metadata
    Name() string
    Version() string
    SupportedVersions() []string
}

// Plugin Implementation Example: Terraform
type TerraformPlugin struct {
    config PluginConfig
    executor CommandExecutor
}

func (p *TerraformPlugin) Plan(ctx context.Context, workspace *Workspace, opts PlanOptions) (*PlanResult, error) {
    // 1. Prepare workspace directory
    // 2. Write variables to terraform.tfvars
    // 3. Execute terraform init
    // 4. Execute terraform plan -out=plan.tfplan
    // 5. Parse plan output
    // 6. Return structured PlanResult
}

// Plugin Registry
type PluginRegistry struct {
    plugins map[string]IaCPlugin
    mu      sync.RWMutex
}

func (r *PluginRegistry) Register(name string, plugin IaCPlugin) error
func (r *PluginRegistry) Get(name string) (IaCPlugin, error)
```

---

## 4. Frontend Architecture (TypeScript + React)

### 4.1 Technology Stack

- **Framework**: React 18+ with TypeScript
- **State Management**: Zustand or Redux Toolkit
- **Routing**: React Router v6
- **API Client**: Axios with TypeScript types
- **UI Components**: shadcn/ui or Ant Design
- **Forms**: React Hook Form + Zod validation
- **Real-time**: Server-Sent Events (SSE) / WebSockets
- **Code Editor**: Monaco Editor (for Terraform/Ansible code)
- **Build Tool**: Vite
- **Testing**: Vitest + React Testing Library

### 4.2 Application Structure

```
frontend/
├── src/
│   ├── api/               # API client and types
│   │   ├── client.ts
│   │   ├── types.ts
│   │   ├── organizations.ts
│   │   ├── workspaces.ts
│   │   └── runs.ts
│   ├── components/        # Reusable components
│   │   ├── common/
│   │   ├── workspace/
│   │   ├── runs/
│   │   └── layouts/
│   ├── pages/            # Route pages
│   │   ├── Dashboard.tsx
│   │   ├── Organizations/
│   │   ├── Projects/
│   │   ├── Workspaces/
│   │   ├── Runs/
│   │   └── Settings/
│   ├── hooks/            # Custom React hooks
│   ├── stores/           # State management
│   ├── utils/            # Helper functions
│   ├── types/            # TypeScript interfaces
│   └── App.tsx
├── package.json
└── tsconfig.json
```

### 4.3 Key Features & Views

#### Dashboard
- Organization overview
- Recent runs across all workspaces
- Resource count by workspace
- Run success/failure metrics
- Activity feed

#### Workspace View
```typescript
interface WorkspaceView {
  // Tabs:
  - Overview      // VCS info, last run status, quick actions
  - Runs          // Run history with filters
  - State         // Current state browser, version history
  - Variables     // Environment and Terraform variables
  - Settings      // VCS, notifications, auto-apply
  - Policies      // Attached policies
}
```

#### Run Detail View
- Live log streaming (SSE)
- Plan output with syntax highlighting
- Resource changes (additions, modifications, deletions)
- Policy check results
- Cost estimation (if applicable)
- Approve/Cancel actions

#### Code Editor Integration
- In-browser Terraform/Ansible file editor
- Syntax highlighting
- Validation on save
- Commit directly to VCS

### 4.4 Real-time Updates

```typescript
// hooks/useRunLogs.ts
export function useRunLogs(runId: string) {
  const [logs, setLogs] = useState<string[]>([]);
  
  useEffect(() => {
    const eventSource = new EventSource(
      `/api/v1/runs/${runId}/logs`
    );
    
    eventSource.onmessage = (event) => {
      setLogs(prev => [...prev, event.data]);
    };
    
    return () => eventSource.close();
  }, [runId]);
  
  return logs;
}
```

### 4.5 API Client Pattern

```typescript
// api/client.ts
import axios, { AxiosInstance } from 'axios';

class ApiClient {
  private client: AxiosInstance;
  
  constructor() {
    this.client = axios.create({
      baseURL: '/api/v1',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // Add auth interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      }
    );
  }
  
  // Workspace methods
  async getWorkspace(id: string): Promise<Workspace> {
    const response = await this.client.get(`/workspaces/${id}`);
    return response.data;
  }
  
  async createRun(
    workspaceId: string, 
    data: CreateRunRequest
  ): Promise<Run> {
    const response = await this.client.post(
      `/workspaces/${workspaceId}/runs`,
      data
    );
    return response.data;
  }
}

export const apiClient = new ApiClient();
```

---

## 5. Core Features Implementation

### 5.1 VCS Integration

**Supported Providers:**
- GitHub (Cloud + Enterprise)
- GitLab (Cloud + Self-hosted)
- Bitbucket (Cloud + Server)
- Gitea
- Generic Git (SSH/HTTPS)

**Implementation:**
```go
type VCSProvider interface {
    GetFileContents(repo, path, ref string) ([]byte, error)
    CreateWebhook(repo string, events []string) error
    ValidateWebhook(payload, signature []byte) error
    GetCommitInfo(repo, sha string) (*CommitInfo, error)
}

// Webhook Handler
func (h *WebhookHandler) HandlePush(payload PushEvent) error {
    // 1. Find workspaces linked to this repo/branch
    // 2. Trigger plan run for each workspace
    // 3. If auto-apply enabled, queue apply after plan
}

func (h *WebhookHandler) HandlePullRequest(payload PREvent) error {
    // 1. Trigger speculative plan
    // 2. Post plan output as PR comment
    // 3. Add status check to PR
}
```

### 5.2 State Management

**Features:**
- Remote state storage (S3-compatible)
- State locking (PostgreSQL advisory locks)
- State versioning
- State rollback
- State encryption at rest

**Terraform Remote Backend:**
```hcl
# Users configure Terraform to use our platform
terraform {
  backend "http" {
    address = "https://platform.example.com/api/v1/workspaces/ws-123/state"
    lock_address = "https://platform.example.com/api/v1/workspaces/ws-123/state/lock"
    unlock_address = "https://platform.example.com/api/v1/workspaces/ws-123/state/lock"
  }
}
```

**Implementation:**
```go
func (s *StateService) GetState(workspaceID string) ([]byte, error) {
    // 1. Check permissions
    // 2. Fetch latest state version from DB
    // 3. If large, fetch from S3
    // 4. Return state JSON
}

func (s *StateService) PutState(workspaceID string, state []byte) error {
    // 1. Verify lock is held
    // 2. Increment version
    // 3. Store in DB (or S3 if > threshold)
    // 4. Create state_versions record
    // 5. Trigger backup
}

func (s *StateService) LockState(workspaceID, lockID string) error {
    // Use PostgreSQL advisory locks or Redis distributed lock
    return s.db.Exec(
        "SELECT pg_advisory_lock($1)",
        hashWorkspaceID(workspaceID),
    ).Error
}
```

### 5.3 Variable Management

**Variable Types:**
- Terraform variables (mapped to tfvars)
- Ansible variables (mapped to extra-vars)
- Environment variables (for execution context)

**Encryption:**
```go
type VariableService struct {
    encryptor crypto.Encryptor
}

func (v *VariableService) SetVariable(workspace, key, value string, sensitive bool) error {
    if sensitive {
        encrypted, err := v.encryptor.Encrypt([]byte(value))
        if err != nil {
            return err
        }
        value = base64.StdEncoding.EncodeToString(encrypted)
    }
    
    return v.db.Create(&Variable{
        WorkspaceID: workspace,
        Key:         key,
        Value:       value,
        Sensitive:   sensitive,
        Encrypted:   sensitive,
    }).Error
}

func (v *VariableService) GetDecryptedVariables(workspaceID string) (map[string]string, error) {
    // Fetch, decrypt sensitive vars, return map
}
```

### 5.4 Policy Enforcement (OPA Integration)

**Policy Evaluation Points:**
1. Pre-plan (validate workspace configuration)
2. Post-plan (validate changes before apply)
3. Pre-apply (final checks)

**Implementation:**
```go
type PolicyEngine struct {
    opaClient *opa.Client
}

func (p *PolicyEngine) Evaluate(
    ctx context.Context,
    policy Policy,
    input interface{},
) (*PolicyResult, error) {
    result, err := p.opaClient.Evaluate(
        ctx,
        policy.PolicyCode,
        input,
    )
    
    return &PolicyResult{
        Passed:    result.Allowed,
        Violations: result.Violations,
        Level:     policy.EnforcementLevel,
    }, err
}

// Example Policy (Rego)
package terraform.analysis

deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_s3_bucket"
    not resource.change.after.versioning[_].enabled
    msg := "S3 buckets must have versioning enabled"
}
```

### 5.5 Cost Estimation

**Integration with:**
- Infracost (open-source)
- Custom pricing models

```go
func (c *CostEstimator) EstimatePlan(plan *TerraformPlan) (*CostEstimate, error) {
    // 1. Parse plan JSON
    // 2. Send to Infracost API or internal calculator
    // 3. Return monthly cost breakdown by resource
}
```

### 5.6 RBAC & Permissions

**Permission Model:**
```go
type Permission string

const (
    OrgAdmin       Permission = "org:admin"
    OrgRead        Permission = "org:read"
    ProjectAdmin   Permission = "project:admin"
    ProjectWrite   Permission = "project:write"
    ProjectRead    Permission = "project:read"
    WorkspaceAdmin Permission = "workspace:admin"
    WorkspaceWrite Permission = "workspace:write"
    WorkspaceRead  Permission = "workspace:read"
    RunApply       Permission = "run:apply"
    RunPlan        Permission = "run:plan"
)

type RBACService struct {
    db *gorm.DB
}

func (r *RBACService) CheckPermission(
    userID, resourceType, resourceID string,
    permission Permission,
) (bool, error) {
    // Query role assignments and check permissions
}
```

---

## 6. Runner Architecture

### 6.1 Runner Types

**Docker Runner** (Default)
- Isolated container per run
- Pre-built images with Terraform/Ansible
- Volume mounts for workspace code
- Network isolation

**Kubernetes Runner**
- Job-based execution
- Pod per run with init containers
- Shared workspace via PVC
- Auto-scaling based on queue depth

**VM Runner** (Future)
- Firecracker microVMs
- Complete isolation
- Faster cold starts than traditional VMs

### 6.2 Runner Agent Implementation

```go
type RunnerAgent struct {
    ID       string
    PoolID   string
    Plugins  map[string]plugins.IaCPlugin
    Queue    JobQueue
    Executor ContainerExecutor
}

func (r *RunnerAgent) Start(ctx context.Context) error {
    for {
        select {
        case <-ctx.Done():
            return nil
        default:
            job, err := r.Queue.Dequeue(ctx)
            if err != nil {
                continue
            }
            
            go r.ExecuteJob(ctx, job)
        }
    }
}

func (r *RunnerAgent) ExecuteJob(ctx context.Context, job *Job) error {
    // 1. Update run status to "running"
    // 2. Get appropriate plugin
    plugin := r.Plugins[job.IaCType]
    
    // 3. Prepare workspace
    workspace := r.prepareWorkspace(job)
    
    // 4. Execute operation
    var result interface{}
    var err error
    
    switch job.Operation {
    case "plan":
        result, err = plugin.Plan(ctx, workspace, job.PlanOptions)
    case "apply":
        result, err = plugin.Apply(ctx, workspace, job.Plan)
    case "destroy":
        result, err = plugin.Destroy(ctx, workspace)
    }
    
    // 5. Stream logs in real-time
    // 6. Update run status
    // 7. Store outputs
    
    return err
}
```

### 6.3 Job Queue (NATS)

```go
type JobQueue struct {
    nc *nats.Conn
    js nats.JetStreamContext
}

func (q *JobQueue) Enqueue(job *Job) error {
    data, _ := json.Marshal(job)
    _, err := q.js.Publish("iac.jobs", data)
    return err
}

func (q *JobQueue) Dequeue(ctx context.Context) (*Job, error) {
    sub, _ := q.js.PullSubscribe("iac.jobs", "runners")
    msgs, _ := sub.Fetch(1, nats.MaxWait(10*time.Second))
    
    if len(msgs) == 0 {
        return nil, nil
    }
    
    var job Job
    json.Unmarshal(msgs[0].Data, &job)
    msgs[0].Ack()
    
    return &job, nil
}
```

---

## 7. Deployment Architecture

### 7.1 Kubernetes Deployment

```yaml
# Platform Components
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    spec:
      containers:
      - name: api-gateway
        image: iac-platform/api-gateway:latest
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: runner-orchestrator
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: orchestrator
        image: iac-platform/orchestrator:latest
---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: runner-agents
spec:
  selector:
    matchLabels:
      app: runner-agent
  template:
    spec:
      containers:
      - name: runner
        image: iac-platform/runner:latest
        volumeMounts:
        - name: docker-sock
          mountPath: /var/run/docker.sock
      volumes:
      - name: docker-sock
        hostPath:
          path: /var/run/docker.sock
```

### 7.2 Terraform Module for Self-Hosting

```hcl
module "iac_platform" {
  source = "github.com/yourorg/iac-platform-terraform"
  
  # Infrastructure
  kubernetes_cluster   = var.cluster_name
  database_instance    = "postgresql-13"
  object_storage_bucket = var.state_bucket
  
  # Configuration
  domain_name          = "iac.example.com"
  enable_tls           = true
  runner_pool_size     = 5
  
  # Authentication
  oauth_providers = {
    github = {
      client_id     = var.github_client_id
      client_secret = var.github_client_secret
    }
  }
}
```

---

## 8. Security Considerations

### 8.1 Security Features

1. **Authentication**
   - OAuth2/OIDC (GitHub, GitLab, Google, Azure AD)
   - API tokens with scopes
   - Service accounts

2. **Encryption**
   - TLS for all connections
   - Encryption at rest (database, object storage)
   - Encrypted variables (AES-256-GCM)

3. **Secrets Management**
   - Integration with Vault, AWS Secrets Manager
   - Never log sensitive values
   - Rotate API tokens

4. **Network Security**
   - Private runner pools (no internet access)
   - VPC peering for cloud resources
   - Egress filtering

5. **Audit Logging**
   - All API calls logged
   - State access tracked
   - Compliance reporting (SOC2, GDPR)

### 8.2 Runner Isolation

```go
type ContainerExecutor struct {
    dockerClient *docker.Client
}

func (e *ContainerExecutor) Execute(job *Job) error {
    // Create isolated container
    container, err := e.dockerClient.ContainerCreate(
        ctx,
        &container.Config{
            Image: job.RunnerImage,
            Env:   job.Environment,
            // No network access by default
            NetworkMode: "none",
        },
        &container.HostConfig{
            // Read-only root filesystem
            ReadonlyRootfs: true,
            // Resource limits
            Resources: container.Resources{
                Memory:   job.MemoryLimit,
                CPUQuota: job.CPULimit,
            },
            // Security options
            SecurityOpt: []string{
                "no-new-privileges",
                "seccomp=default",
            },
            // Temporary filesystem
            Tmpfs: map[string]string{
                "/tmp": "rw,noexec,nosuid,size=1g",
            },
        },
        nil,
        nil,
        "",
    )
    
    // Mount workspace as read-only
    // Execute and stream logs
    // Clean up container after execution
}
```

---

## 9. Monitoring & Observability

### 9.1 Metrics (Prometheus)

```go
// metrics/metrics.go
package metrics

import "github.com/prometheus/client_golang/prometheus"

var (
    RunsTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "iac_runs_total",
            Help: "Total number of runs",
        },
        []string{"workspace", "status", "iac_type"},
    )
    
    RunDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "iac_run_duration_seconds",
            Help:    "Run duration in seconds",
            Buckets: prometheus.ExponentialBuckets(1, 2, 10),
        },
        []string{"workspace", "operation"},
    )
    
    ActiveRunners = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "iac_active_runners",
            Help: "Number of active runner agents",
        },
    )
    
    QueueDepth = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "iac_queue_depth",
            Help: "Number of jobs in queue",
        },
    )
)
```

### 9.2 Logging (Structured)

```go
import "go.uber.org/zap"

logger, _ := zap.NewProduction()
defer logger.Sync()

logger.Info("run started",
    zap.String("run_id", run.ID),
    zap.String("workspace_id", run.WorkspaceID),
    zap.String("operation", run.Operation),
    zap.String("triggered_by", run.TriggeredBy),
)
```

### 9.3 Tracing (OpenTelemetry)

```go
import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/trace"
)

func (s *WorkspaceService) CreateRun(ctx context.Context, req *CreateRunRequest) (*Run, error) {
    tracer := otel.Tracer("workspace-service")
    ctx, span := tracer.Start(ctx, "CreateRun")
    defer span.End()
    
    // Add attributes
    span.SetAttributes(
        attribute.String("workspace.id", req.WorkspaceID),
        attribute.String("run.type", req.RunType),
    )
    
    // Business logic...
}
```

### 9.4 Health Checks

```go
// health/checks.go
type HealthChecker struct {
    db    *gorm.DB
    queue JobQueue
    cache *redis.Client
}

func (h *HealthChecker) Check() HealthStatus {
    status := HealthStatus{
        Status: "healthy",
        Checks: make(map[string]CheckResult),
    }
    
    // Database check
    if err := h.db.Exec("SELECT 1").Error; err != nil {
        status.Checks["database"] = CheckResult{
            Status: "unhealthy",
            Error:  err.Error(),
        }
        status.Status = "unhealthy"
    }
    
    // Queue check
    if !h.queue.IsConnected() {
        status.Checks["queue"] = CheckResult{
            Status: "unhealthy",
        }
        status.Status = "unhealthy"
    }
    
    // Cache check
    if err := h.cache.Ping(context.Background()).Err(); err != nil {
        status.Checks["cache"] = CheckResult{
            Status: "degraded",
            Error:  err.Error(),
        }
        if status.Status == "healthy" {
            status.Status = "degraded"
        }
    }
    
    return status
}

// Endpoints
// GET /health/live  - Kubernetes liveness probe
// GET /health/ready - Kubernetes readiness probe
```

---

## 10. Ansible Integration Details

### 10.1 Ansible Plugin Implementation

```go
// plugins/ansible/ansible.go
package ansible

type AnsiblePlugin struct {
    config      PluginConfig
    executor    CommandExecutor
    vaultClient VaultClient
}

func (p *AnsiblePlugin) Plan(ctx context.Context, workspace *Workspace, opts PlanOptions) (*PlanResult, error) {
    // Ansible doesn't have native plan, but we can do:
    // 1. Run playbook with --check flag (dry-run)
    // 2. Parse output to show what would change
    
    cmd := exec.CommandContext(ctx,
        "ansible-playbook",
        workspace.PlaybookPath,
        "--check",
        "--diff",
        "--inventory", workspace.InventoryPath,
    )
    
    output, err := cmd.CombinedOutput()
    
    return &PlanResult{
        Success: err == nil,
        Output:  string(output),
        Changes: p.parseAnsibleDiff(output),
    }, err
}

func (p *AnsiblePlugin) Apply(ctx context.Context, workspace *Workspace, plan *Plan) (*ApplyResult, error) {
    // 1. Prepare inventory (static or dynamic)
    // 2. Inject variables from workspace
    // 3. Handle vault passwords
    // 4. Execute playbook
    
    extraVars := p.buildExtraVars(workspace.Variables)
    
    cmd := exec.CommandContext(ctx,
        "ansible-playbook",
        workspace.PlaybookPath,
        "--inventory", workspace.InventoryPath,
        "--extra-vars", extraVars,
    )
    
    // Stream output in real-time
    stdout, _ := cmd.StdoutPipe()
    stderr, _ := cmd.StderrPipe()
    
    go p.streamLogs(stdout, stderr)
    
    err := cmd.Run()
    
    return &ApplyResult{
        Success: err == nil,
        Output:  p.capturedOutput,
    }, err
}

func (p *AnsiblePlugin) buildExtraVars(vars map[string]Variable) string {
    extraVars := make(map[string]interface{})
    
    for key, v := range vars {
        if v.Category == "ansible" {
            extraVars[key] = v.Value
        }
    }
    
    jsonVars, _ := json.Marshal(extraVars)
    return string(jsonVars)
}
```

### 10.2 Inventory Management

```go
// Workspace can define inventory in multiple ways:
type InventorySource struct {
    Type   string // static, dynamic, plugin
    Source string // file path, script, plugin name
    Config map[string]interface{}
}

// Static inventory stored in database
type StaticInventory struct {
    WorkspaceID string
    Content     string // INI or YAML format
}

// Dynamic inventory integration
type DynamicInventory struct {
    WorkspaceID string
    Provider    string // aws_ec2, gcp_compute, azure_rm
    Filters     map[string]string
    Credentials string
}

// Example: AWS EC2 dynamic inventory
func (d *DynamicInventory) Generate() (string, error) {
    // Use ansible-inventory plugin
    // Or custom implementation using AWS SDK
    
    cfg, _ := config.LoadDefaultConfig(context.TODO())
    ec2Client := ec2.NewFromConfig(cfg)
    
    // Fetch instances with tags matching filters
    result, _ := ec2Client.DescribeInstances(context.TODO(), &ec2.DescribeInstancesInput{
        Filters: d.buildFilters(),
    })
    
    // Build Ansible inventory format
    inventory := p.buildInventoryFromInstances(result.Reservations)
    return inventory, nil
}
```

### 10.3 Ansible Vault Integration

```go
type AnsibleVaultService struct {
    encryptor crypto.Encryptor
}

func (v *AnsibleVaultService) EncryptVariable(value string) (string, error) {
    // Generate vault password (stored securely)
    vaultPassword := v.getVaultPassword()
    
    // Use ansible-vault encrypt_string
    cmd := exec.Command("ansible-vault", "encrypt_string", 
        "--vault-password-file", "/dev/stdin",
        value,
    )
    
    stdin, _ := cmd.StdinPipe()
    stdin.Write([]byte(vaultPassword))
    stdin.Close()
    
    output, err := cmd.Output()
    return string(output), err
}

// Store vault password per workspace or organization
type VaultPassword struct {
    WorkspaceID string
    Password    string // Encrypted with master key
}
```

### 10.4 Ansible Job Templates (AWX-like)

```go
// Job templates define reusable playbook configurations
type JobTemplate struct {
    ID              string
    Name            string
    OrganizationID  string
    ProjectID       string
    PlaybookPath    string
    Inventory       string
    Variables       map[string]Variable
    Credentials     []string
    Limit           string // Host pattern
    Tags            []string
    SkipTags        []string
    Verbosity       int
    JobType         string // run, check
    BecomEnabled    bool
}

type JobTemplateService struct {
    db *gorm.DB
}

func (s *JobTemplateService) LaunchTemplate(templateID string, extraVars map[string]interface{}) (*Run, error) {
    template, _ := s.GetTemplate(templateID)
    
    // Create run from template
    run := &Run{
        WorkspaceID: template.ProjectID,
        RunType:     "ansible_job",
        Config: RunConfig{
            PlaybookPath: template.PlaybookPath,
            Inventory:    template.Inventory,
            Variables:    s.mergeVariables(template.Variables, extraVars),
            Limit:        template.Limit,
            Tags:         template.Tags,
        },
    }
    
    return s.runService.CreateRun(run)
}
```

### 10.5 Ansible Credentials Management

```go
type Credential struct {
    ID             string
    Name           string
    OrganizationID string
    CredentialType string // machine, ssh, vault, cloud
    Inputs         map[string]string // Encrypted
}

// Credential types
const (
    CredentialTypeMachine  = "machine"    // SSH username/password/key
    CredentialTypeVault    = "vault"      // Ansible Vault password
    CredentialTypeAWS      = "aws"        // AWS access keys
    CredentialTypeGCP      = "gcp"        // GCP service account
    CredentialTypeAzure    = "azure"      // Azure credentials
)

func (c *CredentialService) InjectCredentials(run *Run) error {
    credentials := c.GetWorkspaceCredentials(run.WorkspaceID)
    
    for _, cred := range credentials {
        switch cred.CredentialType {
        case CredentialTypeMachine:
            // Write SSH private key to temporary file
            // Set ANSIBLE_PRIVATE_KEY_FILE env var
            c.writeSSHKey(cred.Inputs["private_key"])
            
        case CredentialTypeVault:
            // Set vault password
            c.setVaultPassword(cred.Inputs["vault_password"])
            
        case CredentialTypeAWS:
            // Set AWS env vars for boto
            os.Setenv("AWS_ACCESS_KEY_ID", cred.Inputs["access_key"])
            os.Setenv("AWS_SECRET_ACCESS_KEY", cred.Inputs["secret_key"])
        }
    }
    
    return nil
}
```

---

## 11. Advanced Features

### 11.1 Scheduled Runs

```go
type Schedule struct {
    ID          string
    WorkspaceID string
    CronExpr    string // "0 2 * * *" = daily at 2 AM
    Operation   string // plan, apply
    Enabled     bool
    LastRun     *time.Time
    NextRun     time.Time
}

type Scheduler struct {
    cron *cron.Cron
    db   *gorm.DB
}

func (s *Scheduler) Start() {
    s.cron = cron.New()
    
    schedules, _ := s.db.Find(&Schedule{}).Where("enabled = ?", true)
    
    for _, schedule := range schedules {
        s.cron.AddFunc(schedule.CronExpr, func() {
            s.runService.CreateRun(&Run{
                WorkspaceID: schedule.WorkspaceID,
                RunType:     schedule.Operation,
                TriggerType: "scheduled",
            })
        })
    }
    
    s.cron.Start()
}
```

### 11.2 Drift Detection

```go
type DriftDetector struct {
    runService *RunService
}

func (d *DriftDetector) DetectDrift(workspaceID string) (*DriftReport, error) {
    // 1. Run terraform plan
    // 2. Check if plan shows changes
    // 3. If changes exist, state has drifted
    
    run, err := d.runService.CreateRun(&Run{
        WorkspaceID: workspaceID,
        RunType:     "plan",
        TriggerType: "drift_detection",
    })
    
    // Wait for completion
    result := d.waitForRun(run.ID)
    
    if result.HasChanges {
        return &DriftReport{
            Drifted:       true,
            ResourceCount: result.ChangedResources,
            Details:       result.Changes,
            DetectedAt:    time.Now(),
        }, nil
    }
    
    return &DriftReport{Drifted: false}, nil
}

// Schedule drift detection
func (s *Scheduler) EnableDriftDetection(workspaceID string, interval time.Duration) {
    ticker := time.NewTicker(interval)
    
    go func() {
        for range ticker.C {
            report, _ := s.driftDetector.DetectDrift(workspaceID)
            
            if report.Drifted {
                // Send notification
                s.notificationService.Send(Notification{
                    Type:    "drift_detected",
                    Workspace: workspaceID,
                    Details: report,
                })
            }
        }
    }()
}
```

### 11.3 Workspace Templates

```go
type WorkspaceTemplate struct {
    ID             string
    Name           string
    Description    string
    IaCType        string
    VCSProvider    string
    RepoTemplate   string // Git template repository
    Variables      []VariableTemplate
    Policies       []string
    Settings       WorkspaceSettings
}

type VariableTemplate struct {
    Key         string
    Description string
    DefaultValue string
    Required    bool
    Sensitive   bool
}

func (s *WorkspaceService) CreateFromTemplate(templateID string, params map[string]interface{}) (*Workspace, error) {
    template, _ := s.getTemplate(templateID)
    
    workspace := &Workspace{
        Name:         params["name"].(string),
        IaCType:      template.IaCType,
        VCSProvider:  template.VCSProvider,
        AutoApply:    template.Settings.AutoApply,
    }
    
    // Create workspace
    s.db.Create(workspace)
    
    // Apply variables from template
    for _, varTmpl := range template.Variables {
        value := params[varTmpl.Key]
        if value == nil && varTmpl.Required {
            return nil, fmt.Errorf("required variable %s not provided", varTmpl.Key)
        }
        
        s.variableService.SetVariable(workspace.ID, varTmpl.Key, value)
    }
    
    // Attach policies
    for _, policyID := range template.Policies {
        s.attachPolicy(workspace.ID, policyID)
    }
    
    return workspace, nil
}
```

### 11.4 Multi-Cloud Support

```go
type CloudProvider struct {
    Type        string // aws, azure, gcp, digitalocean
    Credentials string
    DefaultRegion string
}

type WorkspaceCloudConfig struct {
    WorkspaceID string
    Providers   []CloudProvider
}

// Cost estimation across clouds
func (c *CostEstimator) EstimateMultiCloud(plan *Plan) (*MultiCloudCostEstimate, error) {
    estimate := &MultiCloudCostEstimate{
        ByCloud: make(map[string]*CloudCostBreakdown),
    }
    
    for _, resource := range plan.ResourceChanges {
        cloud := c.detectCloud(resource.Type)
        
        if estimate.ByCloud[cloud] == nil {
            estimate.ByCloud[cloud] = &CloudCostBreakdown{}
        }
        
        resourceCost := c.estimateResourceCost(resource, cloud)
        estimate.ByCloud[cloud].MonthlyTotal += resourceCost
    }
    
    return estimate, nil
}
```

### 11.5 Approval Workflows

```go
type ApprovalPolicy struct {
    ID              string
    WorkspaceID     string
    RequireApproval bool
    Approvers       []string // User IDs
    MinApprovals    int
    AutoApplyAfter  bool
}

type Approval struct {
    ID          string
    RunID       string
    ApproverID  string
    Status      string // approved, rejected
    Comment     string
    ApprovedAt  time.Time
}

func (s *RunService) RequestApproval(runID string) error {
    policy := s.getApprovalPolicy(runID)
    
    if !policy.RequireApproval {
        return nil
    }
    
    // Update run status to "pending_approval"
    s.db.Model(&Run{}).Where("id = ?", runID).Update("status", "pending_approval")
    
    // Notify approvers
    for _, approverID := range policy.Approvers {
        s.notificationService.Send(Notification{
            UserID: approverID,
            Type:   "approval_required",
            RunID:  runID,
        })
    }
    
    return nil
}

func (s *RunService) Approve(runID, approverID string) error {
    approval := &Approval{
        RunID:      runID,
        ApproverID: approverID,
        Status:     "approved",
        ApprovedAt: time.Now(),
    }
    
    s.db.Create(approval)
    
    // Check if minimum approvals met
    count := s.db.Where("run_id = ? AND status = ?", runID, "approved").Count()
    policy := s.getApprovalPolicy(runID)
    
    if count >= policy.MinApprovals {
        if policy.AutoApplyAfter {
            // Trigger apply
            s.Apply(runID)
        } else {
            // Update to "approved" status
            s.db.Model(&Run{}).Where("id = ?", runID).Update("status", "approved")
        }
    }
    
    return nil
}
```

### 11.6 Terraform Module Registry

```go
type ModuleRegistry struct {
    db            *gorm.DB
    storageClient *s3.Client
}

type Module struct {
    ID          string
    Namespace   string
    Name        string
    Provider    string
    Version     string
    Source      string // Git URL or uploaded tarball
    Downloads   int
    PublishedAt time.Time
}

// Private module registry endpoint
// GET /api/v1/modules/:namespace/:name/:provider/:version/download
func (r *ModuleRegistry) DownloadModule(namespace, name, provider, version string) (string, error) {
    module := r.getModule(namespace, name, provider, version)
    
    // Return signed S3 URL or tarball
    url := r.storageClient.PresignGetObject(
        fmt.Sprintf("modules/%s/%s/%s/%s.tar.gz", namespace, name, provider, version),
        15*time.Minute,
    )
    
    return url, nil
}

// Terraform configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

module "vpc" {
  source  = "iac-platform.example.com/myorg/vpc/aws"
  version = "2.0.0"
  
  cidr_block = "10.0.0.0/16"
}
```

---

## 12. API Documentation

### 12.1 OpenAPI Specification

```yaml
openapi: 3.0.0
info:
  title: IaC Platform API
  version: 1.0.0
  description: Open-source Infrastructure as Code orchestration platform

servers:
  - url: https://api.iac-platform.example.com/v1

security:
  - BearerAuth: []

paths:
  /organizations:
    get:
      summary: List organizations
      responses:
        '200':
          description: List of organizations
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Organization'
    
    post:
      summary: Create organization
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateOrganizationRequest'
      responses:
        '201':
          description: Organization created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Organization'

  /workspaces/{id}/runs:
    post:
      summary: Create a new run
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                operation:
                  type: string
                  enum: [plan, apply, destroy]
                message:
                  type: string
                auto_apply:
                  type: boolean
      responses:
        '201':
          description: Run created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Run'

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Organization:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        created_at:
          type: string
          format: date-time
    
    Workspace:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        iac_type:
          type: string
          enum: [terraform, ansible, pulumi]
        vcs_repo:
          type: string
        auto_apply:
          type: boolean
        terraform_version:
          type: string
    
    Run:
      type: object
      properties:
        id:
          type: string
        workspace_id:
          type: string
        status:
          type: string
          enum: [pending, planning, planned, applying, applied, errored, canceled]
        operation:
          type: string
          enum: [plan, apply, destroy]
        created_at:
          type: string
          format: date-time
```

---

## 13. Testing Strategy

### 13.1 Backend Testing

```go
// Unit Tests
func TestWorkspaceService_CreateWorkspace(t *testing.T) {
    db := setupTestDB()
    service := NewWorkspaceService(db)
    
    workspace, err := service.CreateWorkspace(&Workspace{
        Name:    "test-workspace",
        IaCType: "terraform",
    })
    
    assert.NoError(t, err)
    assert.NotEmpty(t, workspace.ID)
}

// Integration Tests
func TestRunExecution_Terraform(t *testing.T) {
    if testing.Short() {
        t.Skip("skipping integration test")
    }
    
    // Setup test workspace with actual Terraform code
    workspace := createTestWorkspace(t)
    
    // Create and execute run
    run, err := runService.CreateRun(&Run{
        WorkspaceID: workspace.ID,
        RunType:     "plan",
    })
    
    // Wait for completion
    waitForRun(t, run.ID, 30*time.Second)
    
    // Verify results
    result := getRun(t, run.ID)
    assert.Equal(t, "planned", result.Status)
    assert.NotEmpty(t, result.PlanOutput)
}

// E2E Tests with Docker Compose
func TestE2E_FullWorkflow(t *testing.T) {
    // Start platform services
    compose := testcontainers.NewDockerCompose("docker-compose.test.yml")
    compose.Up()
    defer compose.Down()
    
    // Test full workflow
    // 1. Create organization
    // 2. Create workspace
    // 3. Link VCS repo
    // 4. Trigger run via webhook
    // 5. Verify state was saved
}
```

### 13.2 Frontend Testing

```typescript
// Component Tests
import { render, screen, waitFor } from '@testing-library/react';
import { WorkspaceDetail } from './WorkspaceDetail';

test('displays workspace information', async () => {
  const mockWorkspace = {
    id: 'ws-123',
    name: 'production',
    iac_type: 'terraform',
  };
  
  render(<WorkspaceDetail workspace={mockWorkspace} />);
  
  expect(screen.getByText('production')).toBeInTheDocument();
  expect(screen.getByText('Terraform')).toBeInTheDocument();
});

// Integration Tests
test('creates new run when button clicked', async () => {
  const { user } = setup(<WorkspaceDetail />);
  
  await user.click(screen.getByRole('button', { name: /plan/i }));
  
  await waitFor(() => {
    expect(screen.getByText(/run created/i)).toBeInTheDocument();
  });
});

// E2E Tests (Playwright)
test('full workspace workflow', async ({ page }) => {
  await page.goto('/');
  await page.click('text=New Workspace');
  await page.fill('[name="name"]', 'test-workspace');
  await page.selectOption('[name="iac_type"]', 'terraform');
  await page.click('button[type="submit"]');
  
  await expect(page).toHaveURL(/\/workspaces\/ws-\w+/);
});
```

---

## 14. Migration & Deployment Guide

### 14.1 Database Migrations

```go
// Use golang-migrate or similar tool
// migrations/000001_initial_schema.up.sql

CREATE TABLE organizations (...);
CREATE TABLE projects (...);
CREATE INDEX idx_workspaces_project_id ON workspaces(project_id);

// Migration runner
func RunMigrations(db *gorm.DB) error {
    m, err := migrate.New(
        "file://migrations",
        "postgres://user:pass@localhost:5432/iac_platform?sslmode=disable",
    )
    if err != nil {
        return err
    }
    
    return m.Up()
}
```

### 14.2 Deployment Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: |
          go test ./...
          npm test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build Docker images
        run: |
          docker build -t iac-platform/api:${{ github.sha }} -f Dockerfile.api .
          docker build -t iac-platform/frontend:${{ github.sha }} -f Dockerfile.frontend .
      
      - name: Push to registry
        run: |
          docker push iac-platform/api:${{ github.sha }}
          docker push iac-platform/frontend:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/api-gateway api=iac-platform/api:${{ github.sha }}
          kubectl rollout status deployment/api-gateway
```

### 14.3 Backup Strategy

```go
type BackupService struct {
    db            *gorm.DB
    storageClient *s3.Client
}

func (b *BackupService) BackupDatabase() error {
    // 1. Create PostgreSQL dump
    cmd := exec.Command("pg_dump",
        "-h", dbHost,
        "-U", dbUser,
        "-d", dbName,
        "-F", "c", // Custom format
        "-f", "/tmp/backup.dump",
    )
    
    cmd.Run()
    
    // 2. Compress
    gzipCmd := exec.Command("gzip", "/tmp/backup.dump")
    gzipCmd.Run()
    
    // 3. Upload to S3
    file, _ := os.Open("/tmp/backup.dump.gz")
    defer file.Close()
    
    b.storageClient.PutObject(context.TODO(), &s3.PutObjectInput{
        Bucket: aws.String("backups"),
        Key:    aws.String(fmt.Sprintf("db-backup-%s.dump.gz", time.Now().Format("2006-01-02"))),
        Body:   file,
    })
    
    return nil
}

// Schedule daily backups
func (b *BackupService) ScheduleBackups() {
    ticker := time.NewTicker(24 * time.Hour)
    
    go func() {
        for range ticker.C {
            if err := b.BackupDatabase(); err != nil {
                log.Error("Backup failed", zap.Error(err))
            }
        }
    }()
}
```

---

## 15. Future Roadmap

### Phase 1 (MVP - Months 1-3)
- [ ] Core API services (Go)
- [ ] Basic web UI (TypeScript/React)
- [ ] Terraform plugin
- [ ] PostgreSQL + Redis setup
- [ ] VCS integrations (GitHub, GitLab)
- [ ] State management
- [ ] Basic RBAC
- [ ] Docker runner implementation

### Phase 2 (Months 4-6)
- [ ] Ansible plugin
- [ ] Policy engine (OPA)
- [ ] Cost estimation
- [ ] Scheduled runs
- [ ] Drift detection
- [ ] Notifications (Slack, email)
- [ ] Audit logging
- [ ] Module registry

### Phase 3 (Months 7-9)
- [ ] Kubernetes runner
- [ ] Approval workflows
- [ ] Advanced RBAC
- [ ] Pulumi plugin
- [ ] Multi-tenancy improvements
- [ ] Advanced monitoring/observability
- [ ] Workspace templates
- [ ] Job templates (AWX-style)

### Phase 4 (Months 10-12)
- [ ] Private module registry
- [ ] Secrets management integration (Vault)
- [ ] Custom runner pools
- [ ] SSO/SAML authentication
- [ ] Compliance reporting
- [ ] API rate limiting enhancements
- [ ] GraphQL API
- [ ] Mobile app (React Native)

### Future Enhancements
- [ ] AI-powered policy suggestions
- [ ] Automated remediation
- [ ] Multi-region deployment
- [ ] Disaster recovery
- [ ] Advanced analytics dashboard
- [ ] Terraform Cloud migration tool
- [ ] Spacelift migration tool
- [ ] CDK support
- [ ] Crossplane integration

---

## 16. Project Structure

### 16.1 Repository Organization

```
iac-platform/
├── backend/
│   ├── cmd/
│   │   ├── api/              # API server entry point
│   │   ├── runner/           # Runner agent entry point
│   │   └── orchestrator/     # Orchestrator service
│   ├── internal/
│   │   ├── api/              # API handlers
│   │   │   ├── handlers/
│   │   │   ├── middleware/
│   │   │   └── routes/
│   │   ├── services/         # Business logic
│   │   │   ├── workspace/
│   │   │   ├── run/
│   │   │   ├── state/
│   │   │   ├── variable/
│   │   │   └── policy/
│   │   ├── models/           # Data models
│   │   ├── repository/       # Data access layer
│   │   ├── plugins/          # IaC plugins
│   │   │   ├── terraform/
│   │   │   ├── ansible/
│   │   │   └── interface.go
│   │   ├── vcs/              # VCS integrations
│   │   │   ├── github/
│   │   │   ├── gitlab/
│   │   │   └── interface.go
│   │   ├── queue/            # Job queue
│   │   ├── storage/          # Object storage
│   │   └── auth/             # Authentication
│   ├── pkg/                  # Public packages
│   │   ├── crypto/
│   │   ├── logger/
│   │   └── metrics/
│   ├── migrations/           # Database migrations
│   ├── config/               # Configuration files
│   ├── tests/
│   ├── go.mod
│   └── go.sum
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── stores/
│   │   ├── utils/
│   │   ├── types/
│   │   └── App.tsx
│   ├── public/
│   ├── package.json
│   └── tsconfig.json
├── runner-images/            # Docker images for runners
│   ├── terraform/
│   │   └── Dockerfile
│   ├── ansible/
│   │   └── Dockerfile
│   └── base/
│       └── Dockerfile
├── deploy/
│   ├── kubernetes/           # K8s manifests
│   │   ├── api/
│   │   ├── orchestrator/
│   │   ├── runner/
│   │   └── database/
│   ├── terraform/            # Self-hosting Terraform module
│   │   ├── aws/
│   │   ├── gcp/
│   │   └── azure/
│   └── docker-compose/       # Local development
│       └── docker-compose.yml
├── docs/                     # Documentation
│   ├── getting-started.md
│   ├── api-reference.md
│   ├── plugin-development.md
│   └── deployment-guide.md
├── scripts/                  # Utility scripts
│   ├── generate-api-docs.sh
│   ├── setup-dev.sh
│   └── migrate.sh
├── .github/
│   └── workflows/
│       ├── test.yml
│       ├── build.yml
│       └── deploy.yml
├── LICENSE
├── README.md
└── CONTRIBUTING.md
```

### 16.2 Key Configuration Files

#### Backend Configuration
```yaml
# config/config.yaml
server:
  port: 8080
  host: 0.0.0.0
  
database:
  host: localhost
  port: 5432
  name: iac_platform
  user: postgres
  password: ${DB_PASSWORD}
  ssl_mode: require
  max_connections: 100

queue:
  type: nats
  url: nats://localhost:4222
  
storage:
  type: s3
  bucket: iac-platform-state
  region: us-east-1
  endpoint: ${S3_ENDPOINT} # For MinIO compatibility
  
auth:
  jwt_secret: ${JWT_SECRET}
  token_expiry: 24h
  
  oauth:
    github:
      client_id: ${GITHUB_CLIENT_ID}
      client_secret: ${GITHUB_CLIENT_SECRET}
      enabled: true
    
    gitlab:
      client_id: ${GITLAB_CLIENT_ID}
      client_secret: ${GITLAB_CLIENT_SECRET}
      enabled: false

runners:
  default_pool_size: 5
  max_concurrent_runs: 10
  timeout: 3600s
  
  terraform:
    default_version: "1.6.0"
    allowed_versions: ["1.4.0", "1.5.0", "1.6.0"]
  
  ansible:
    default_version: "2.15"

logging:
  level: info
  format: json
  
metrics:
  enabled: true
  port: 9090
```

#### Frontend Configuration
```typescript
// src/config.ts
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_URL || '/api/v1',
  wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws',
  
  features: {
    costEstimation: true,
    policyEngine: true,
    moduleRegistry: false, // Coming in Phase 4
  },
  
  ui: {
    itemsPerPage: 25,
    logStreamBufferSize: 1000,
  },
};
```

---

## 17. Security Hardening

### 17.1 Security Checklist

#### Infrastructure Level
- [ ] TLS 1.3 for all connections
- [ ] Network segmentation (runners in private subnet)
- [ ] WAF for API endpoints
- [ ] DDoS protection
- [ ] Regular security scans (Trivy, Snyk)
- [ ] Secrets rotation policy
- [ ] Infrastructure as Code for deployment

#### Application Level
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS protection (CSP headers)
- [ ] CSRF tokens for state-changing operations
- [ ] Rate limiting per user/IP
- [ ] API authentication (JWT with short expiry)
- [ ] Audit logging for all sensitive operations

#### Data Level
- [ ] Encryption at rest (database, object storage)
- [ ] Encryption in transit (TLS)
- [ ] Sensitive variable encryption (AES-256-GCM)
- [ ] PII data handling compliance
- [ ] Data retention policies
- [ ] Regular backups with encryption
- [ ] Secure key management (KMS integration)

#### Runner Level
- [ ] Container isolation (no privileged containers)
- [ ] Read-only root filesystem
- [ ] Resource limits (CPU, memory)
- [ ] Network policies (egress filtering)
- [ ] Seccomp/AppArmor profiles
- [ ] Regular image updates
- [ ] Image signing and verification

### 17.2 Vulnerability Management

```go
type SecurityScanner struct {
    trivyClient  *trivy.Client
    snykClient   *snyk.Client
}

func (s *SecurityScanner) ScanRunnerImage(imageTag string) (*ScanReport, error) {
    // Scan Docker images for vulnerabilities
    report, err := s.trivyClient.Scan(imageTag)
    
    if len(report.Vulnerabilities) > 0 {
        // Alert if critical vulnerabilities found
        s.alertSecurityTeam(report)
    }
    
    return report, err
}

// Scheduled vulnerability scanning
func (s *SecurityScanner) StartPeriodicScans() {
    ticker := time.NewTicker(24 * time.Hour)
    
    go func() {
        for range ticker.C {
            images := []string{
                "iac-platform/terraform-runner:latest",
                "iac-platform/ansible-runner:latest",
            }
            
            for _, image := range images {
                s.ScanRunnerImage(image)
            }
        }
    }()
}
```

### 17.3 Secrets Management Integration

```go
// Integration with HashiCorp Vault
type VaultSecretProvider struct {
    client *vault.Client
}

func (v *VaultSecretProvider) GetSecret(path string) (string, error) {
    secret, err := v.client.Logical().Read(path)
    if err != nil {
        return "", err
    }
    
    return secret.Data["value"].(string), nil
}

// Usage in runner
func (r *RunnerAgent) InjectSecrets(workspace *Workspace) error {
    // Instead of storing secrets in DB, fetch from Vault
    for _, varName := range workspace.SecretVariables {
        secret, err := r.secretProvider.GetSecret(
            fmt.Sprintf("workspaces/%s/secrets/%s", workspace.ID, varName),
        )
        
        if err != nil {
            return err
        }
        
        os.Setenv(varName, secret)
    }
    
    return nil
}
```

---

## 18. Performance Optimization

### 18.1 Database Optimization

```go
// Connection pooling
func SetupDatabase(config *Config) (*gorm.DB, error) {
    db, err := gorm.Open(postgres.Open(config.DatabaseURL), &gorm.Config{
        PrepareStmt: true, // Enable prepared statement cache
    })
    
    sqlDB, _ := db.DB()
    
    // Connection pool settings
    sqlDB.SetMaxOpenConns(100)
    sqlDB.SetMaxIdleConns(10)
    sqlDB.SetConnMaxLifetime(time.Hour)
    
    return db, err
}

// Query optimization
func (r *WorkspaceRepository) ListWorkspaces(projectID string, page, pageSize int) ([]Workspace, error) {
    var workspaces []Workspace
    
    err := r.db.
        Preload("Variables"). // Eager load to avoid N+1
        Where("project_id = ?", projectID).
        Limit(pageSize).
        Offset((page - 1) * pageSize).
        Find(&workspaces).Error
    
    return workspaces, err
}

// Add indexes
CREATE INDEX CONCURRENTLY idx_runs_workspace_created 
    ON runs(workspace_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_state_versions_workspace_version 
    ON state_versions(workspace_id, version DESC);
```

### 18.2 Caching Strategy

```go
type CacheService struct {
    redis *redis.Client
}

func (c *CacheService) GetWorkspace(id string) (*Workspace, error) {
    // Try cache first
    cached, err := c.redis.Get(ctx, fmt.Sprintf("workspace:%s", id)).Result()
    
    if err == nil {
        var workspace Workspace
        json.Unmarshal([]byte(cached), &workspace)
        return &workspace, nil
    }
    
    // Cache miss - fetch from database
    workspace, err := c.db.GetWorkspace(id)
    if err != nil {
        return nil, err
    }
    
    // Store in cache with TTL
    data, _ := json.Marshal(workspace)
    c.redis.Set(ctx, fmt.Sprintf("workspace:%s", id), data, 15*time.Minute)
    
    return workspace, nil
}

// Cache invalidation
func (c *CacheService) InvalidateWorkspace(id string) {
    c.redis.Del(ctx, fmt.Sprintf("workspace:%s", id))
}
```

### 18.3 API Response Optimization

```go
// Pagination
type PaginatedResponse struct {
    Data       interface{} `json:"data"`
    Page       int         `json:"page"`
    PageSize   int         `json:"page_size"`
    TotalItems int64       `json:"total_items"`
    TotalPages int         `json:"total_pages"`
}

// Field selection (sparse fieldsets)
// GET /api/v1/workspaces?fields=id,name,status
func (h *WorkspaceHandler) List(c *gin.Context) {
    fields := c.Query("fields")
    
    query := h.db.Model(&Workspace{})
    
    if fields != "" {
        query = query.Select(strings.Split(fields, ","))
    }
    
    // Execute query...
}

// Response compression
func CompressionMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        if strings.Contains(c.GetHeader("Accept-Encoding"), "gzip") {
            c.Header("Content-Encoding", "gzip")
            // Use gzip writer
        }
        c.Next()
    }
}
```

### 18.4 Async Processing

```go
// Long-running operations should be async
func (h *RunHandler) Create(c *gin.Context) {
    var req CreateRunRequest
    c.BindJSON(&req)
    
    // Create run record immediately
    run := &Run{
        WorkspaceID: req.WorkspaceID,
        Status:      "pending",
    }
    h.db.Create(run)
    
    // Return immediately with 202 Accepted
    c.JSON(202, run)
    
    // Process asynchronously
    h.queue.Enqueue(&Job{
        Type:  "run",
        RunID: run.ID,
    })
}

// Client polls for status
// GET /api/v1/runs/{id}
// Or use Server-Sent Events for real-time updates
```

---

## 19. Disaster Recovery

### 19.1 Backup & Restore Procedures

```go
type DisasterRecovery struct {
    db            *gorm.DB
    storageClient *s3.Client
}

// Full backup
func (d *DisasterRecovery) CreateFullBackup() error {
    timestamp := time.Now().Format("20060102-150405")
    
    // 1. Backup database
    dbBackup := fmt.Sprintf("/tmp/db-backup-%s.sql", timestamp)
    exec.Command("pg_dump", "-F", "c", "-f", dbBackup, dbURL).Run()
    
    // 2. Backup state files from S3
    stateBackup := fmt.Sprintf("/tmp/state-backup-%s.tar.gz", timestamp)
    d.backupS3Bucket("state-files", stateBackup)
    
    // 3. Upload to disaster recovery bucket
    d.uploadToDRBucket(dbBackup, stateBackup)
    
    // 4. Verify backup integrity
    return d.verifyBackup(timestamp)
}

// Restore from backup
func (d *DisasterRecovery) RestoreFromBackup(timestamp string) error {
    // 1. Download backup files
    dbBackup := d.downloadFromDRBucket(fmt.Sprintf("db-backup-%s.sql", timestamp))
    stateBackup := d.downloadFromDRBucket(fmt.Sprintf("state-backup-%s.tar.gz", timestamp))
    
    // 2. Restore database
    exec.Command("pg_restore", "-d", dbURL, dbBackup).Run()
    
    // 3. Restore state files to S3
    d.restoreS3Bucket(stateBackup, "state-files")
    
    // 4. Verify restoration
    return d.verifyRestoration()
}
```

### 19.2 High Availability Setup

```yaml
# Kubernetes deployment with HA
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchExpressions:
              - key: app
                operator: In
                values:
                - api-gateway
            topologyKey: kubernetes.io/hostname
      containers:
      - name: api-gateway
        image: iac-platform/api:latest
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
---
# PostgreSQL with replication
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: iac-platform-db
spec:
  instances: 3
  primaryUpdateStrategy: unsupervised
  
  postgresql:
    parameters:
      max_connections: "200"
      shared_buffers: "4GB"
      
  backup:
    barmanObjectStore:
      destinationPath: s3://backups/postgresql
      s3Credentials:
        accessKeyId:
          name: backup-creds
          key: ACCESS_KEY_ID
        secretAccessKey:
          name: backup-creds
          key: SECRET_ACCESS_KEY
    retentionPolicy: "30d"
```

---

## 20. Community & Contribution

### 20.1 Open Source License

```
MIT License

Copyright (c) 2024 IaC Platform Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software...
```

### 20.2 Contribution Guidelines

```markdown
# Contributing to IaC Platform

## Code of Conduct
We are committed to providing a welcoming and inclusive environment.

## How to Contribute

### Reporting Bugs
- Use GitHub Issues
- Include reproduction steps
- Provide system information

### Feature Requests
- Open a discussion first
- Explain use case
- Consider implementation complexity

### Pull Requests
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests
5. Ensure all tests pass (`make test`)
6. Commit with conventional commits
7. Push to branch
8. Open Pull Request

### Code Style
- Go: Follow `gofmt` and `golangci-lint`
- TypeScript: Follow Prettier and ESLint config
- Write meaningful commit messages
- Add comments for complex logic

### Testing Requirements
- Unit tests for new features
- Integration tests for API changes
- E2E tests for critical workflows
- Minimum 80% code coverage
```

### 20.3 Documentation Standards

```markdown
# Documentation Structure

## User Documentation
- Getting Started Guide
- Installation Instructions
- Configuration Reference
- User Guides (Workspaces, Runs, Variables)
- Troubleshooting

## Developer Documentation
- Architecture Overview
- API Reference (auto-generated from OpenAPI)
- Plugin Development Guide
- Contributing Guide
- Code Organization

## Operator Documentation
- Deployment Guide (K8s, Docker Compose, VM)
- Scaling Guide
- Security Hardening
- Backup & Recovery
- Monitoring & Alerting
- Upgrade Guide
```

---

## 21. Conclusion

This architecture document provides a comprehensive blueprint for building an open-source IaC orchestration platform that can replace proprietary solutions like Terraform Enterprise and Spacelift while incorporating the workflow capabilities needed to replace Ansible AWX.

### Key Differentiators

1. **Truly Open Source**: MIT licensed, community-driven
2. **Modular Architecture**: Easy to extend with new IaC tools
3. **Cloud Agnostic**: Run anywhere (K8s, VMs, local)
4. **No Vendor Lock-in**: Standard APIs, exportable data
5. **Enterprise-Ready**: RBAC, SSO, audit logs, compliance
6. **Cost-Effective**: No per-resource pricing

### Success Metrics

- **Performance**: Handle 10,000+ concurrent runs
- **Reliability**: 99.9% uptime for SaaS offering
- **Adoption**: 1,000+ GitHub stars in first year
- **Community**: Active contributors and plugins
- **Security**: Pass security audits, bug bounty program

### Getting Started

```bash
# Clone repository
git clone https://github.com/yourorg/iac-platform.git
cd iac-platform

# Start with Docker Compose
cd deploy/docker-compose
docker-compose up

# Access UI
open http://localhost:3000

# Default credentials
# Username: admin
# Password: changeme
```

### Resources

- **GitHub**: https://github.com/yourorg/iac-platform
- **Documentation**: https://docs.iac-platform.dev
- **Community**: https://discord.gg/iac-platform
- **Roadmap**: https://github.com/yourorg/iac-platform/projects/1

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Maintained By**: IaC Platform Core Team
