<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Platform Runner Rework Plan

**Status:** ❌ Not started. The platform runner still uses persistent workspace directories. The self-hosted runner (agent mode) uses ephemeral temp dirs as the reference pattern.

TODO: the platform runner for ansible needs to be reworked in the same way - extend the plan with this info

## Executive Summary

The platform runner (`backend/cmd/runner/main.go`) currently uses a persistent-directory architecture (`/home/iac/workspaces/{workspace_id}`) that is fundamentally unsuitable for multi-tenant SaaS. This plan outlines a phased rework to bring the platform runner in line with TFE's ephemeral execution model, improving security, isolation, and scalability.

**GitHub Issue:** [#109](https://github.com/michielvha/stackweaver/issues/109)

**Reference architecture:** Terraform Cloud/Enterprise uses ephemeral sandboxed containers per run with 512MB default memory limits, 10 concurrent runs default, and full cleanup after execution.

---

## Current State (Security Audit)

### Architecture

- **Platform runner** (`backend/cmd/runner/main.go`, ~1258 lines): Redis queue consumer with direct DB/MinIO/Redis access
- **Self-hosted runner** (`backend/cmd/runner/agent_mode.go`, ~1253 lines): API-based, ephemeral temp dirs per job, HTTPS-only communication
- Docker Compose deployment with `network_mode: host`
- Shared `runner-workspaces` Docker volume
- Single process handles all tenants' runs

### Issues Identified

| # | Issue | Severity | Description |
|---|---|---|---|
| 1 | **No workspace cleanup** | High | Persistent directories at `/home/iac/workspaces/{workspace_id}` accumulate across runs. Terraform state, provider binaries, and potentially sensitive outputs survive indefinitely. |
| 2 | **`network_mode: host`** | High | Runner container shares the host network namespace. Terraform processes can access any host-network service (PostgreSQL, Redis, MinIO, Zitadel) directly. |
| 3 | **Shared volumes** | Medium | The `runner-workspaces` volume is shared. All workspaces from all tenants are accessible within the same filesystem namespace. |
| 4 | **Decrypted secrets on disk** | High | Workspace variables (including secrets like cloud credentials) are written to `terraform.tfvars` on disk in the persistent workspace directory and never cleaned up. |
| 5 | **No resource limits** | Medium | No memory, CPU, or PID limits on the runner container or individual terraform processes. A single run could exhaust host resources. |
| 6 | **Hardcoded infrastructure credentials** | Medium | Runner has direct access to DB connection string, MinIO credentials, and Redis URL via environment variables. Compromise of the runner exposes all infrastructure. |
| 7 | **Default zero encryption key** | Low | The `ENCRYPTION_KEY` defaults to a zero-value key if not set, meaning workspace variable encryption is ineffective. |
| 8 | **Provider cache poisoning** | Medium | Shared provider cache across workspaces means a compromised provider binary could affect other workspaces. |
| 9 | **No security profiles** | Low | No seccomp, AppArmor, or capability restrictions on the runner container. |
| 10 | **Single process for all tenants** | Medium | One runner binary processes all organizations' runs; no process-level isolation between tenants. |

### Comparison: Platform Runner vs Self-Hosted Runner vs TFE

| Aspect | Platform Runner (current) | Self-Hosted Runner | TFE |
|---|---|---|---|
| Workspace dirs | Persistent `/home/iac/workspaces/{id}` | Ephemeral `os.MkdirTemp` + cleanup | Ephemeral container per run |
| State management | Local `terraform.tfstate` on disk | Downloads from API, uploads on complete | Remote state backend |
| Network | `network_mode: host` | External HTTPS only | Isolated network per run |
| Credentials | Direct DB/MinIO/Redis access | API token only | Isolated credential injection |
| Cleanup | Never | On job completion | Container destroyed |
| Resource limits | None | OS-level (if configured) | 512MB memory default |

---

## Rework Phases

### Phase 1: Ephemeral Execution (S effort, highest value)

**Goal:** Replace persistent workspace directories with ephemeral temp directories, matching TFE and self-hosted runner behavior.

**Changes:**

1. **`backend/cmd/runner/main.go` ~L354:** Replace persistent directory with temp directory:
   ```go
   // Before:
   workspaceDir := fmt.Sprintf("/home/iac/workspaces/%s", workspace.ID)
   os.MkdirAll(workspaceDir, 0o755)

   // After:
   workspaceDir, err := os.MkdirTemp("", fmt.Sprintf("sw-run-%s-*", run.ID))
   if err != nil {
       return fmt.Errorf("failed to create temp workspace directory: %w", err)
   }
   defer os.RemoveAll(workspaceDir)
   ```

2. **State restore before init:** Add state download from DB/MinIO before `terraform init`, same pattern already implemented in `agent_mode.go`:
   - Query latest `StateVersion` for the workspace
   - Download state JSON from MinIO
   - Write to `terraform.tfstate` in the temp directory

3. **Remove `runner-workspaces` volume** from `deploy/docker-compose.yml` (no longer needed).

4. **Provider cache:** Keep a shared provider cache (`/home/iac/.terraform.d/plugin-cache`) for performance, but ensure workspace-level `.terraform` directories are ephemeral.

**Impact:** Eliminates issues #1 (cleanup), #3 (shared volumes), #4 (secrets on disk), #8 (cache poisoning for workspace-level state).

**Risk:** Low. The self-hosted runner already works this way and has been tested.

---

### Phase 2: Network Isolation (L effort)

**Goal:** Remove `network_mode: host` and isolate runner network access.

**Options:**

**Option A: API-based communication (like self-hosted runner)**
- Refactor platform runner to communicate via API instead of direct DB/MinIO access
- Essentially merge platform runner with self-hosted runner code path
- Highest isolation, most effort

**Option B: Dedicated Docker network**
- Create a dedicated runner network in Docker Compose
- Only expose required services (API endpoint) to runner network
- Runner still has direct DB access but can't reach host services
- Medium isolation, medium effort

**Option C: Network namespaces for child processes**
- Runner keeps DB/MinIO access for its own operations
- Terraform child processes run in a restricted network namespace (`unshare --net`)
- Terraform can only access the internet (for provider downloads) via a controlled proxy
- Medium isolation, medium effort

**Recommended:** Option A long-term (converge on single runner architecture), Option B as interim step.

**Changes:**
- `deploy/docker-compose.yml`: Remove `network_mode: host`, create `runner-net` network
- Expose only the API service to the runner network
- If Option A: significant refactor of main.go to use API client instead of direct repo access

**Impact:** Eliminates issue #2 (host network), partially addresses #6 (infra credentials).

---

### Phase 3: Resource Limits (M effort)

**Goal:** Add memory, CPU, and PID limits to prevent resource exhaustion.

**Changes:**

1. **Container-level limits** in `deploy/docker-compose.yml`:
   ```yaml
   runner:
     deploy:
       resources:
         limits:
           memory: 2G
           cpus: '2.0'
         reservations:
           memory: 512M
           cpus: '0.5'
   ```

2. **Per-run limits** using `cmd.SysProcAttr` on the terraform child process:
   ```go
   cmd.SysProcAttr = &syscall.SysProcAttr{
       Setpgid: true,  // Already set for cancel handling
       // Add rlimit for memory if needed
   }
   ```

3. **Concurrency control:** Add configurable max concurrent runs (currently unlimited):
   ```go
   // Environment variable: RUNNER_MAX_CONCURRENT (default: 10, matching TFE)
   semaphore := make(chan struct{}, maxConcurrent)
   ```

**Impact:** Eliminates issue #5 (no resource limits).

---

### Phase 4: Credential Isolation (S effort)

**Goal:** Reduce blast radius if the runner is compromised.

**Changes:**

1. **Enforce non-zero encryption key:** Fail startup if `ENCRYPTION_KEY` is the zero value in production mode:
   ```go
   if isProduction() && encryptionKey == strings.Repeat("\x00", 32) {
       log.Fatal("ENCRYPTION_KEY must be set in production")
   }
   ```

2. **Dedicated MinIO credentials:** Create a separate MinIO user for the runner with access only to workspace-related buckets (not the entire MinIO instance).

3. **Read-only DB user:** If runner only needs to read certain tables (workspace config, variables), use a PostgreSQL role with minimal permissions.

4. **Credential cleanup:** Ensure `terraform.tfvars` (containing decrypted secrets) is cleaned up immediately after terraform execution, not left on disk. (Mostly solved by Phase 1 ephemeral dirs, but add explicit `defer os.Remove` as defense-in-depth.)

**Impact:** Eliminates issue #7 (zero encryption key), partially addresses #6 (hardcoded creds).

---

### Phase 5: Container Hardening (S effort)

**Goal:** Apply defense-in-depth container security.

**Changes in `deploy/docker-compose.yml`:**

```yaml
runner:
  read_only: true
  tmpfs:
    - /tmp:size=1G
    - /home/iac:size=2G
  security_opt:
    - no-new-privileges:true
    - seccomp:seccomp-profile.json  # Custom profile allowing terraform operations
  cap_drop:
    - ALL
  cap_add:
    - NET_RAW  # Required for some provider network operations
```

**Impact:** Eliminates issue #9 (no security profiles), adds defense-in-depth.

---

## Implementation Priority

```
Phase 1 (Ephemeral dirs)     ████████████  S effort, highest security value
Phase 4 (Credential isolation) ██████████  S effort, prevents credential exposure
Phase 5 (Container hardening)  ████████    S effort, defense-in-depth
Phase 3 (Resource limits)      ████████    M effort, prevents resource exhaustion
Phase 2 (Network isolation)    ██████████████  L effort, removes host network access
```

**Recommended order:** Phase 1 → Phase 4 → Phase 5 → Phase 3 → Phase 2

Phase 1 provides the highest security value for the lowest effort. Phases 4 and 5 are quick wins. Phase 3 adds operational safety. Phase 2 is the largest effort but provides the most complete isolation.

---

## Long-Term Vision

Converge platform and self-hosted runners into a single architecture where:

1. All runners use ephemeral execution environments
2. All runners communicate via API (no direct DB/MinIO access)
3. Platform runners are distinguished only by being deployed alongside the platform (not by code path)
4. Resource limits and network isolation are enforced at the container/namespace level
5. Each run gets its own isolated execution context (container, network namespace, or VM)

This aligns with TFE's architecture where "platform" and "self-hosted" agents differ only in deployment location, not in security model.

---

## References

- TFE Architecture: https://developer.hashicorp.com/terraform/enterprise/system-overview/capacity
- TFE Agents: https://developer.hashicorp.com/terraform/cloud-docs/agents
- GitHub Issue: https://github.com/michielvha/stackweaver/issues/109
- Self-hosted runner implementation: `backend/cmd/runner/agent_mode.go`
- Platform runner implementation: `backend/cmd/runner/main.go`
