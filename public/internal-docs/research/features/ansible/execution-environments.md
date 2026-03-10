<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Ansible Execution Environments: StackWeaver vs AWX

## Implementation Status

| Phase | Description | Status |
|-------|-------------|--------|
| Agent pool infrastructure | Runner registration, heartbeat, job assignment, frontend UI | ✅ Complete |
| Phase 1: Container-based execution | EE container spawning per job | ❌ Not started |
| Phase 2: Multiple EE support | EE selection in job templates | ❌ Not started |
| Phase 3: EE registry integration | Build/manage EEs, UI | ❌ Not started |

The self-hosted runner infrastructure (agent pools, runner registration, heartbeat, label matching, TFE-compatible agent pool API) was implemented independently and is complete. The EE model described in this document remains a future improvement to the Ansible execution layer.

## Overview

This document compares StackWeaver's current Ansible execution approach with AWX/Automation Controller's Execution Environment (EE) model, and provides recommendations for improvement.

## Current StackWeaver Approach

### Architecture

StackWeaver uses a **self-hosted runner** model with agent pools. Runners register with the API using an API key, poll for jobs via heartbeat, and execute `ansible-playbook` directly within the runner container:

```
┌─────────────────────────────────────────┐
│  StackWeaver API                        │
│  Agent Pool ← Runner registers here    │
└──────────────┬──────────────────────────┘
               │ heartbeat / job polling
               ▼
┌─────────────────────────────────────────┐
│  Ansible Runner container               │
│  Python 3.13 + Ansible (latest)        │
│  + All collections pre-installed        │
│  + Go ansible-runner binary             │
│         │                               │
│         ▼                               │
│  Executes ansible-playbook directly     │
│  in the same container environment      │
└─────────────────────────────────────────┘
```

### Current Implementation

**Runner Infrastructure** (implemented):

- **Agent pools** (`backend/internal/models/agent_pool.go`): Logical groupings of runners with workspace/project scoping. TFE-compatible API.
- **Runner model** (`backend/internal/models/runner.go`): Tracks `runner_type` (terraform/ansible/combined), `status`, `labels`, `available_collections`, `ansible_version`, heartbeat timestamps.
- **Registration** (`POST /api/v2/runner/register`): Runner authenticates with an org-scoped API key, reports metadata (hostname, versions, collections, labels, max concurrent jobs). Receives runner-specific API key.
- **Heartbeat** (`POST /api/v2/runner/heartbeat`): Runners poll every 10s; API returns pending jobs matched by pool, runner type, and labels.
- **Job lifecycle**: `start` → stream `output` → `complete`. Ansible runner also has Terraform runner support (combined type).
- **Agent mode** (`backend/cmd/ansible-runner/agent_mode.go`): Self-contained polling loop with graceful shutdown and re-registration support.
- **Frontend**: Agent Pools and Runners pages in Settings with real-time status polling.

**Dockerfile** (`runner-images/ansible/Dockerfile`):
- Base: `python:3.13-slim`
- Installs: Ansible, ansible-lint, cloud SDKs (boto3, azure, gcp, vmware)
- Pre-installs: Common collections (amazon.aws, azure.azcollection, google.cloud, community.*, ansible.posix)
- Single binary: Go-based `ansible-runner` executed within container

**Execution Flow**:
1. Runner registers with API, joins an agent pool
2. Heartbeat loop receives pending jobs matched to this runner
3. Downloads playbook from VCS/storage (MinIO)
4. Generates inventory file
5. Executes `ansible-playbook` as subprocess
6. Streams output logs to API
7. Stores events in database; signals completion

### Limitations

1. **Single Ansible Version**: All jobs use the same Ansible version installed in the container
2. **All Collections Included**: Large image with collections that may not be needed
3. **Deprecated Warnings**: Cannot easily update Ansible-core without rebuilding entire image
4. **Limited Isolation**: All jobs on a runner share the same Python environment
5. **No Version Flexibility**: Cannot run playbooks requiring different Ansible versions

## AWX/Automation Controller Execution Environment Model

### Architecture

AWX uses **dedicated Execution Environment containers** that run Ansible:

```
┌─────────────────────────────────────────┐
│  AWX Controller (Kubernetes/Podman)    │
│  ┌───────────────────────────────────┐ │
│  │ Job Queue                         │ │
│  └───────────────────────────────────┘ │
│         │                               │
│         ▼                               │
│  ┌───────────────────────────────────┐ │
│  │ Execution Environment (EE)        │ │
│  │ - Ansible Core (specific version) │ │
│  │ - Python dependencies             │ │
│  │ - Collections (as needed)         │ │
│  │ - System packages                 │ │
│  └───────────────────────────────────┘ │
│         │                               │
│         ▼                               │
│  ansible-runner (Python)                │
│  executes ansible-playbook              │
└─────────────────────────────────────────┘
```

### Key Features

1. **Containerized Execution**: Each job can use a different EE container
2. **Version Flexibility**: Different EE images for different Ansible versions
3. **Isolated Dependencies**: Each EE has its own Python packages and collections
4. **Customizable**: Users can build custom EEs with specific requirements
5. **Registry-based**: EEs stored in container registries (Quay.io, Docker Hub, etc.)

### AWX Execution Environment Structure

**Base EE Image** (quay.io/ansible/ansible-runner:latest):
```dockerfile
FROM quay.io/ansible/ansible-navigator:latest

# Install ansible-runner
RUN pip3 install ansible-runner

# Install collections and requirements
COPY requirements.yml /build/
RUN ansible-galaxy collection install -r /build/requirements.yml

# Install Python dependencies
COPY requirements.txt /build/
RUN pip3 install -r /build/requirements.txt

# Install system packages
COPY bindep.txt /build/
RUN dnf install -y $(cat /build/bindep.txt) 2>/dev/null || \
    apt-get install -y $(cat /build/bindep.txt) 2>/dev/null || true
```

**Execution Process**:
1. AWX Controller queues job
2. Selects appropriate EE image based on job template configuration
3. Spawns pod/container with selected EE
4. Mounts playbook directory, inventory, credentials
5. Runs `ansible-runner` inside EE container
6. `ansible-runner` executes `ansible-playbook`
7. Collects output and artifacts
8. Returns results to controller

### Benefits

1. **Latest Ansible**: EEs can use latest ansible-core with latest Python
2. **No Deprecations**: Regular EE updates fix deprecated code
3. **Isolation**: Each job runs in fresh container
4. **Flexibility**: Custom EEs for specialized requirements
5. **Security**: Jobs isolated from each other
6. **Scalability**: Can run multiple EEs in parallel

## Recommended StackWeaver Improvement: Hybrid Approach

### Proposed Architecture

Combine the best of both worlds:

```
┌─────────────────────────────────────────┐
│  StackWeaver Runner (Go binary)        │
│  - Queue listener                       │
│  - Job orchestrator                     │
│  - Artifact manager                     │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Execution Environment Container        │
│  (Docker/Podman)                        │
│  ┌───────────────────────────────────┐ │
│  │ Python + Ansible (latest/core)    │ │
│  │ + Collections (as needed)         │ │
│  │ + Python dependencies             │ │
│  │ └───────────────────────────────┘ │ │
│  │                                     │ │
│  │ Executes: ansible-playbook          │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Implementation Plan

#### Phase 1: Container-Based Execution

**1. Create Base EE Image** (`runner-images/ansible/ee-base/Dockerfile`):
```dockerfile
FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-client \
    git \
    sshpass \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install latest ansible-core (not ansible meta-package)
RUN pip install --no-cache-dir \
    ansible-core>=2.16.0 \
    ansible-runner \
    jmespath \
    netaddr

# Install common collections
RUN ansible-galaxy collection install \
    ansible.posix \
    ansible.netcommon \
    community.general \
    --force

# Create non-root user
RUN useradd -m -u 1001 iac
USER iac

WORKDIR /runner

ENTRYPOINT ["ansible-runner"]
```

**2. Update Runner to Use Container Runtime**

Modify `backend/cmd/ansible-runner/main.go`:

```go
func (r *AnsibleRunner) runAnsiblePlaybook(ctx context.Context, job *models.AnsibleJob, workDir string, args []string, envVars map[string]string) error {
    // Use containerized execution
    eeImage := r.config.ExecutionEnvironmentImage
    if eeImage == "" {
        eeImage = "quay.io/stackweaver/ansible-ee:latest" // Default EE
    }

    // Prepare volume mounts
    mounts := []string{
        fmt.Sprintf("%s:/runner/project:ro", workDir), // Playbook directory
        fmt.Sprintf("%s:/runner/inventory:ro", filepath.Dir(inventoryFile)), // Inventory
        "/home/iac/galaxy-cache:/runner/collections:ro", // Shared collections cache
    }

    // Build container command
    containerArgs := []string{
        "run", "--rm",
        "--network=host", // For SSH access to managed nodes
        "-v", strings.Join(mounts, " -v "),
        "-w", "/runner/project",
        eeImage,
        "run", "/runner/project",
        "--playbook", playbookPath,
        "--inventory", "/runner/inventory/" + filepath.Base(inventoryFile),
    }

    // Execute via podman/docker
    cmd := exec.CommandContext(ctx, "podman", containerArgs...)
    // ... rest of execution logic
}
```

#### Phase 2: Multiple EE Support

**1. EE Selection Based on Job Template**:

```go
type ExecutionEnvironment struct {
    ID          uuid.UUID
    Name        string
    Image       string  // Container image
    AnsibleVersion string
    Collections []string // Required collections
    PythonDeps  []string // Python requirements
}
```

**2. Build Custom EEs from Requirements**:

```dockerfile
# runner-images/ansible/ee-custom/Dockerfile
FROM quay.io/stackweaver/ansible-ee:base

# Install job-specific collections
COPY requirements.yml /tmp/
RUN ansible-galaxy collection install -r /tmp/requirements.yml

# Install Python dependencies
COPY requirements.txt /tmp/
RUN pip install -r /tmp/requirements.txt

# Install system packages
COPY bindep.txt /tmp/
RUN xargs -a /tmp/bindep.txt apt-get install -y 2>/dev/null || true
```

#### Phase 3: EE Registry Integration

**1. Store EEs in Container Registry**:
- Build EEs using `ansible-builder` or custom Dockerfiles
- Push to registry (Quay.io, GitHub Container Registry, or private registry)
- Tag with version and Ansible version

**2. EE Management in UI**:
- Allow users to select EE for job templates
- Build custom EEs from `requirements.yml` and `requirements.txt`
- Preview EE contents (collections, Python packages)

### Benefits of This Approach

1. **Latest Ansible**: EEs can be updated independently with latest ansible-core
2. **No Deprecations**: Regular EE rebuilds remove deprecated code
3. **Job Isolation**: Each job runs in isolated container
4. **Version Flexibility**: Support multiple Ansible versions via different EEs
5. **Custom Collections**: Users can build EEs with required collections
6. **Security**: Jobs isolated from runner and each other
7. **Compatibility**: Can reuse existing AWX EEs from quay.io/ansible

### Migration Strategy

1. **Phase 1** (Not started):
   - Create base EE image with latest ansible-core
   - Update runner (`backend/cmd/ansible-runner/`) to optionally spawn a container (podman/docker) per job instead of executing `ansible-playbook` directly
   - Test with existing playbooks

2. **Phase 2** (Not started):
   - Make container execution default
   - Add `execution_environment_image` field to job templates
   - Support custom EE building

3. **Phase 3** (Not started):
   - EE registry integration
   - Automatic EE building from requirements
   - EE versioning and management UI

## Comparison: StackWeaver vs AWX

| Feature | StackWeaver (Current) | AWX | StackWeaver (Proposed) |
|---------|----------------------|-----|----------------------|
| Runner model | Self-hosted agent pools, heartbeat registration | Kubernetes/Podman-native | Self-hosted agent pools (unchanged) |
| Execution Model | Direct `ansible-playbook` in runner container | Container per job (EE) | Container per job (EE) |
| Ansible Version | Fixed (single version per runner image) | Flexible (EE-based) | Flexible (EE-based) |
| Isolation | Shared environment within runner | Full per-job isolation | Full per-job isolation |
| Collections | Pre-installed all | Per-EE | Per-EE or custom |
| Updates | Rebuild runner image | Update EE independently | Update EE independently |
| Deprecation Handling | Manual rebuild | EE updates | EE updates |
| Custom Requirements | Limited | Full (custom EE) | Full (custom EE) |
| Security | Shared context within runner | Isolated | Isolated |
| Scalability | Multiple self-hosted runners in pools | Kubernetes-native | Multiple self-hosted runners + EE per job |

## References

- [Ansible Execution Environments](https://docs.ansible.com/ansible/latest/user_guide/execution_environments.html)
- [ansible-builder Documentation](https://ansible-builder.readthedocs.io/)
- [AWX Execution Environments](https://docs.ansible.com/automation-controller/latest/html/userguide/execution_environments.html)
- [Quay.io Ansible EE Images](https://quay.io/organization/ansible)

## Conclusion

Adopting an Execution Environment model similar to AWX will provide:
- ✅ Latest Ansible versions without deprecations
- ✅ Better isolation and security
- ✅ Flexibility for users with custom requirements
- ✅ Easier maintenance and updates
- ✅ Compatibility with AWX ecosystem

The recommended approach maintains StackWeaver's Go-based runner for orchestration while leveraging containerized execution environments for Ansible runs, providing the best of both worlds.

