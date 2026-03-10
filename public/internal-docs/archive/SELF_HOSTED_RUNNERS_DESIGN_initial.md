<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Self-Hosted Runners Management System Design

TODO: I am having some thougths about this

I'm going to need some kind of management UI in the settings where we can configure our self hosted runners for both terraform and ansible - it should give some explenation on how to do it and we should see all the registered runners there we should probably just be using the same API token flow we are using already now right there is a token to use terraform locally we can do the same flow to auth ansible runners to our platform right ? I should be maybe even capable of setting some kind of default ansible.cfg or make it modifyable in that way via the UI ? use consitent styling with the other components don't reinvent the wheel please make this design better

## Overview

This document outlines the design for a self-hosted runners management system that allows users to register, manage, and monitor their own runner infrastructure for both Terraform and Ansible workloads.

**Key Principle**: Self-hosted runners use the **exact same runner images** (`runner-images/ansible/` and `runner-images/terraform/`) as platform-hosted runs. The only difference is:
- **Platform-hosted**: Orchestrator spins up runner containers directly
- **Self-hosted**: User runs the container with an agent mode that polls for jobs

This is NOT a separate runner implementation - it's the same code, just with a different communication model.

## Goals

1. **Unified Runner Management**: Single UI in Settings for managing both Terraform and Ansible runners
2. **Same Images**: Use existing `runner-images/` Dockerfiles - no separate runner agent binary
3. **Secure Authentication**: API token-based authentication for runner registration
4. **Easy Setup**: Simple `docker run` with environment variables
5. **Visibility**: Real-time status monitoring of runners including health, capacity, and job history

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
│  │    --token swt_xxx                                      ││
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
              │ /api/v1/runner/ │
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
1. Registers with the StackWeaver API
2. Polls `/api/v1/runner/jobs` for pending work
3. Executes jobs using the same code paths as platform-hosted
4. Streams output back to the API

### High-Level Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                         StackWeaver Platform                         │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────────────┐   │
│  │  Frontend   │───▶│   Backend    │───▶│      Database         │   │
│  │  Settings   │    │   API        │    │  - runners            │   │
│  │  UI         │    │              │    │  - runner_tokens      │   │
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

```sql
-- Runner registration tokens (used to register new runners)
CREATE TABLE runner_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,  -- bcrypt hash of token
    token_prefix VARCHAR(8) NOT NULL,   -- First 8 chars for identification
    runner_type VARCHAR(50) NOT NULL DEFAULT 'combined', -- 'terraform', 'ansible', 'combined'
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(organization_id, name)
);

-- Registered runners
CREATE TABLE runners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
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
    
    -- Token used to register this runner
    registered_with_token_id UUID REFERENCES runner_tokens(id),
    
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
CREATE INDEX idx_runners_heartbeat ON runners(last_heartbeat_at);
CREATE INDEX idx_runner_tokens_org ON runner_tokens(organization_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_runner_job_executions_runner ON runner_job_executions(runner_id);
```

---

TODO: I have a remark about the way you choose to design this, I think it is counter intuitive because we already have a system to generate API keys, why would we need a separate system for the runners? Also did we take into account that this system must be fully compatible with the TFE api spec?



## API Design

### Runner Token Management

```
POST   /api/v1/organizations/:org/runner-tokens
GET    /api/v1/organizations/:org/runner-tokens
DELETE /api/v1/organizations/:org/runner-tokens/:id
```

#### Create Runner Token
```json
// POST /api/v1/organizations/:org/runner-tokens
{
    "name": "production-runner-token",
    "runner_type": "combined",  // "terraform", "ansible", "combined"
    "expires_in_days": 365      // optional, null for no expiry
}

// Response (token only shown once)
{
    "id": "uuid",
    "name": "production-runner-token",
    "token": "swt_abc123...xyz",  // Full token, only shown on creation
    "token_prefix": "swt_abc1",
    "runner_type": "combined",
    "expires_at": "2026-01-01T00:00:00Z",
    "created_at": "2025-01-01T00:00:00Z"
}
```

### Runner Management

```
GET    /api/v1/organizations/:org/runners
GET    /api/v1/organizations/:org/runners/:id
DELETE /api/v1/organizations/:org/runners/:id
PATCH  /api/v1/organizations/:org/runners/:id  (update labels, description)
```

#### List Runners
```json
// GET /api/v1/organizations/:org/runners
{
    "data": [
        {
            "id": "uuid",
            "name": "prod-runner-01",
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
    ]
}
```

### Runner Agent API (used by runner agents)

```
POST   /api/v1/runner/register      # Register new runner with token
POST   /api/v1/runner/heartbeat     # Send heartbeat, get pending jobs
POST   /api/v1/runner/jobs/:id/start
POST   /api/v1/runner/jobs/:id/output
POST   /api/v1/runner/jobs/:id/complete
```

#### Register Runner
```json
// POST /api/v1/runner/register
// Header: Authorization: Bearer swt_abc123...xyz
{
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
    "runner_token": "swr_runner_specific_token...",  // Runner-specific auth token
    "poll_interval_seconds": 10
}
```

#### Heartbeat & Poll
```json
// POST /api/v1/runner/heartbeat
// Header: Authorization: Bearer swr_runner_specific_token
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

---

## Frontend UI Design

### Settings > Runners Page

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Settings > Runners                                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌───────────────────┐  ┌───────────────────┐                           │
│  │ Runners           │  │ Registration      │                           │
│  │ ━━━━━━━━━━━━━━━━━ │  │ Tokens            │                           │
│  └───────────────────┘  └───────────────────┘                           │
│                                                                          │
│  Active Runners                                        [+ Add Runner]    │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 🟢 prod-runner-01          Combined     runner-prod-01.internal   │   │
│  │    Ubuntu 22.04 • Terraform 1.5.7 • Ansible 2.15.0               │   │
│  │    Labels: production, high-memory                                │   │
│  │    Last seen: 5s ago • 1/4 jobs                          [⋮]     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 🟢 dev-runner-01           Terraform    runner-dev-01.internal    │   │
│  │    Ubuntu 22.04 • Terraform 1.5.7                                │   │
│  │    Labels: development                                            │   │
│  │    Last seen: 12s ago • 0/2 jobs                         [⋮]     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 🔴 staging-runner-01       Ansible      runner-stg-01.internal    │   │
│  │    Ubuntu 22.04 • Ansible 2.15.0                                 │   │
│  │    Labels: staging                                                │   │
│  │    Last seen: 5m ago (offline)                           [⋮]     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Add Runner Dialog

```
┌────────────────────────────────────────────────────────────────┐
│  Register a Self-Hosted Runner                            [×]  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. Create a Registration Token                                │
│  ───────────────────────────────────────────────────────────   │
│                                                                │
│  Token Name: [production-runner________________]               │
│                                                                │
│  Runner Type:                                                  │
│  ○ Terraform only                                              │
│  ○ Ansible only                                                │
│  ● Combined (Terraform + Ansible)                              │
│                                                                │
│  Expiration:                                                   │
│  ○ Never    ● 1 year    ○ 90 days    ○ 30 days                │
│                                                                │
│                                    [Generate Token]            │
│                                                                │
│  ───────────────────────────────────────────────────────────   │
│                                                                │
│  2. Run the Runner (same image as platform-hosted!)            │
│  ───────────────────────────────────────────────────────────   │
│                                                                │
│  Ansible Runner:                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ docker run -d --restart unless-stopped \               │   │
│  │   -e RUNNER_MODE=agent \                              │   │
│  │   -e STACKWEAVER_TOKEN=swt_abc123... \                │   │
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
│  │   -e STACKWEAVER_TOKEN=swt_abc123... \                │   │
│  │   -e STACKWEAVER_SERVER=https://stackweaver.io \      │   │
│  │   -e RUNNER_NAME=my-terraform-runner \                │   │
│  │   stackweaver/runner-terraform:latest                 │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                          [📋] │
│                                                                │
│  Kubernetes (Helm):                                            │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ helm install stackweaver-runner stackweaver/runner \  │   │
│  │   --set token=swt_abc123... \                         │   │
│  │   --set server=https://stackweaver.io                 │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                          [📋] │
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
  --token swt_abc123... \
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
   ├── POST /api/v1/runner/register
   └── Receive runner_id and poll_interval

2. MAIN LOOP
   ├── POST /api/v1/runner/heartbeat (every 10s)
   │   └── Response contains pending_jobs[]
   │
   ├── If pending job assigned:
   │   ├── Download job artifacts (playbook, inventory, vars)
   │   ├── Execute using SAME code as platform-hosted
   │   ├── Stream output via POST /runner/jobs/:id/output
   │   └── POST /runner/jobs/:id/complete with results
   │
   └── Handle SIGTERM (graceful shutdown, drain jobs)

3. SHUTDOWN
   ├── Stop accepting new jobs
   ├── Wait for current job to complete
   └── POST /runner/deregister
```

### Environment Variables (Agent Mode)

```bash
# Required
RUNNER_MODE=agent
STACKWEAVER_TOKEN=swt_abc123...
STACKWEAVER_SERVER=https://stackweaver.io

# Optional
RUNNER_NAME=my-runner-01           # Default: hostname
RUNNER_LABELS=production,gpu       # Comma-separated
MAX_CONCURRENT_JOBS=4              # Default: 1
POLL_INTERVAL=10s                  # Default: 10s
```

---

## Implementation Phases

### Phase 1: Backend API & Database (Week 1)

**Backend:**
- [ ] Create database migrations for `runner_tokens`, `runners`, `runner_job_executions`
- [ ] Implement runner token CRUD repository and handlers
- [ ] Implement `/api/v1/runner/register` endpoint
- [ ] Implement `/api/v1/runner/heartbeat` endpoint (returns pending jobs)
- [ ] Add background job to mark runners offline after 30s without heartbeat

**Frontend:**
- [ ] Add Settings > Runners page route
- [ ] Create runner list component with status indicators
- [ ] Create token generation dialog with copy-to-clipboard
- [ ] Show setup instructions in dialog

### Phase 2: Agent Mode in Runner Images (Week 2)

**Runner Images (`runner-images/`):**
- [ ] Add agent mode detection to `runner-images/ansible/main.go`
- [ ] Implement registration on startup
- [ ] Implement heartbeat loop (poll for jobs)
- [ ] Implement job download and execution
- [ ] Stream output back to API during execution
- [ ] Same changes for `runner-images/terraform/`

**Backend:**
- [ ] Implement `/api/v1/runner/jobs/:id/start` endpoint
- [ ] Implement `/api/v1/runner/jobs/:id/output` endpoint (streaming)
- [ ] Implement `/api/v1/runner/jobs/:id/complete` endpoint
- [ ] Add job artifact download endpoint for runners

### Phase 3: Job Routing & UI (Week 3)

**Backend:**
- [ ] Modify orchestrator to check for available self-hosted runners first
- [ ] Implement job assignment logic (online runners, matching labels)
- [ ] Add `runner_id` field to `ansible_jobs` and `runs` tables
- [ ] Route jobs to self-hosted runners if available, else platform-hosted

**Frontend:**
- [ ] Runner detail page with system info and capabilities
- [ ] Show "Runner" field on job detail pages
- [ ] Add job history to runner detail
- [ ] Real-time status updates via polling

### Phase 4: Polish & Advanced Features (Week 4)

**Backend:**
- [ ] Label-based job routing (e.g., job needs `gpu` label)
- [ ] Runner token rotation
- [ ] Runner groups/pools for multi-tenant setups

**Frontend:**
- [ ] Label management UI on runner detail
- [ ] Runner metrics (jobs completed, avg duration)
- [ ] Bulk runner operations (delete, update labels)

---

## Security Considerations

1. **Token Security**
   - Registration tokens are hashed (bcrypt) before storage
   - Tokens only shown once on creation
   - Tokens can be revoked immediately
   - Support for token expiration

2. **Runner Authentication**
   - After registration, runners receive a unique runner token
   - Runner tokens are scoped to specific runner ID
   - Tokens rotated periodically

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

1. **Runner Groups**: Organize runners into groups for different environments
2. **Auto-scaling**: Integration with cloud providers to auto-scale runner capacity
3. **Runner Logs**: Central collection of runner agent logs
4. **Custom Runner Images**: Support for custom Docker images with pre-installed tools
5. **Workspace Affinity**: Pin workspaces to specific runners for caching benefits
