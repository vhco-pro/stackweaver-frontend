<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Kubernetes Runner Operator — Plan

**Status:** Draft
**Date:** 2026-03-10
**Last Updated:** 2026-03-10

## Summary

Design and implement a Kubernetes operator/controller that automatically manages Stackweaver runner pods — scaling them up when jobs are pending and down when idle. This is analogous to the [GitHub Actions Runner Controller (ARC)](https://github.com/actions/actions-runner-controller) but for Stackweaver's self-hosted runner infrastructure.

## Motivation

Today, self-hosted runners are deployed manually (e.g. `docker run` or a static Kubernetes Deployment). Users must pre-provision a fixed number of runners, leading to either:

- **Over-provisioning**: Idle runners consuming cluster resources when no jobs exist.
- **Under-provisioning**: Pending jobs waiting because all runners are busy.

A Kubernetes operator solves this by dynamically spawning runner pods in response to pending jobs and terminating them when idle, providing elastic, cost-efficient runner infrastructure.

## Current Runner Architecture

Understanding the existing self-hosted runner flow is critical (see [SELF_HOSTED_RUNNERS_DESIGN.md](./SELF_HOSTED_RUNNERS_DESIGN.md)):

1. Runner starts in agent mode (`RUNNER_MODE=agent`)
2. Runner registers with the API (`POST /api/v2/runner/register`)
3. Runner enters heartbeat loop (polls `POST /api/v2/runner/heartbeat` every 10s)
4. API returns pending jobs matching the runner's agent pool and capabilities
5. Runner downloads artifacts, executes the job, streams output, uploads state
6. Runner marks job complete and returns to polling

The operator builds on top of this — it doesn't replace the runner agent protocol, it orchestrates the lifecycle of runner pods that use it.

## Design

### Custom Resource Definitions (CRDs)

#### `RunnerPool` (cluster-scoped or namespace-scoped)

```yaml
apiVersion: stackweaver.io/v1alpha1
kind: RunnerPool
metadata:
  name: terraform-runners
  namespace: stackweaver
spec:
  # Connection to Stackweaver API
  serverUrl: https://stackweaver.example.com
  tokenSecretRef:
    name: stackweaver-runner-token
    key: token
  agentPoolId: "ap-xxxxxxxx"

  # Runner configuration
  runnerType: terraform          # terraform | ansible | combined
  runnerImage: ghcr.io/michielvha/stackweaver/runner:latest
  labels:
    - aws
    - us-east-1

  # Scaling
  minReplicas: 0                 # Scale to zero when idle
  maxReplicas: 10
  scaleDownDelaySeconds: 300     # Wait 5 min before scaling down idle runner
  jobsPerRunner: 1               # How many concurrent jobs per runner pod

  # Pod template overrides
  template:
    metadata:
      annotations:
        iam.amazonaws.com/role: runner-role
    spec:
      nodeSelector:
        workload: runners
      tolerations:
        - key: dedicated
          value: runners
          effect: NoSchedule
      resources:
        requests:
          cpu: "500m"
          memory: "512Mi"
        limits:
          cpu: "2"
          memory: "2Gi"
      volumes:
        - name: workspaces
          emptyDir:
            sizeLimit: 10Gi
      serviceAccountName: stackweaver-runner
```

#### `Runner` (namespace-scoped, managed by controller)

```yaml
apiVersion: stackweaver.io/v1alpha1
kind: Runner
metadata:
  name: terraform-runners-abc123
  namespace: stackweaver
  ownerReferences:
    - apiVersion: stackweaver.io/v1alpha1
      kind: RunnerPool
      name: terraform-runners
spec:
  poolRef: terraform-runners
status:
  phase: Running          # Pending | Running | Busy | Terminating
  runnerId: "runner-uuid" # Stackweaver runner ID after registration
  currentJobs: 0
  lastJobFinished: "2026-03-10T12:00:00Z"
  podName: terraform-runners-abc123-pod
```

### Controller Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                          │
│                                                               │
│  ┌────────────────────────────────────────────┐               │
│  │       Stackweaver Runner Operator          │               │
│  │                                            │               │
│  │  ┌─────────────────┐  ┌─────────────────┐  │               │
│  │  │  RunnerPool     │  │  KEDA External   │  │               │
│  │  │  Controller     │  │  Scaler (gRPC)   │──────┐          │
│  │  └────────┬────────┘  └─────────────────┘  │    │          │
│  │           │                                 │    │          │
│  └───────────│─────────────────────────────────┘    │          │
│              │                                      │          │
│              ▼              ┌──────────┐            │          │
│  ┌──────────────────┐       │  KEDA    │◀───────────┘          │
│  │  Runner Pods     │◀──────│  Scaler  │    poll queue depth   │
│  │  ┌────┐ ┌────┐   │ scale │          │            │          │
│  │  │ R1 │ │ R2 │   │       └──────────┘            ▼          │
│  │  └────┘ └────┘   │               ┌─────────────────┐       │
│  └──────────────────┘               │ Stackweaver API │       │
│                                     │ (external)      │       │
│                                     └─────────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

### Scaling Logic (KEDA-Based)

Scaling is delegated to [KEDA](https://keda.sh/) via a custom **external scaler**. The operator ships a gRPC server that KEDA calls to get queue depth metrics.

#### KEDA External Scaler

The operator runs a gRPC server implementing the KEDA external scaler interface:

- `IsActive()` → returns true if pending jobs > 0 (triggers scale from zero).
- `GetMetricSpec()` → returns metric name and target value (e.g. 1 job per runner).
- `GetMetrics()` → polls `GET /api/v2/agent-pools/:id/queue-depth` and returns pending job count.

#### ScaledObject (auto-generated per RunnerPool)

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: terraform-runners-scaler
spec:
  scaleTargetRef:
    name: terraform-runners  # Deployment managed by RunnerPool controller
  minReplicaCount: 0         # From RunnerPool spec.minReplicas
  maxReplicaCount: 10        # From RunnerPool spec.maxReplicas
  cooldownPeriod: 300        # From RunnerPool spec.scaleDownDelaySeconds
  triggers:
    - type: external
      metadata:
        scalerAddress: stackweaver-operator-scaler:9090
        agentPoolId: "ap-xxxxxxxx"
```

KEDA handles all scaling decisions (stabilisation windows, cooldown, scale-from-zero). The operator focuses on pod lifecycle and runner registration.

#### Graceful Shutdown

- Runners must **never** be killed mid-job.
- Use Kubernetes `preStop` hook + `terminationGracePeriodSeconds` to allow in-progress jobs to complete.
- Controller sets a "draining" annotation → runner agent checks this and stops accepting new jobs → completes current work → deregisters → exits.

### Reconcile Flow

```
RunnerPool Controller (continuous):

1. Read RunnerPool spec
2. Ensure KEDA ScaledObject exists and matches spec
3. Ensure runner Deployment exists with correct pod template
4. Monitor Runner CRs for lifecycle events

KEDA (every 10-15 seconds):

1. Calls external scaler → scaler polls Stackweaver API
2. Gets pending job count
3. Calculates desired replicas (pending jobs / jobs-per-runner)
4. Scales Deployment up or down

Pod Lifecycle (per runner pod):

1. Pod starts → runner registers with API in agent mode
2. Runner polls for jobs via heartbeat
3. On scale-down: preStop hook → drain annotation → finish current job → deregister → exit
```

## Implementation Phases

### Phase 1: Foundation

- Set up operator project scaffolding using [kubebuilder](https://kubebuilder.io/) or [operator-sdk](https://sdk.operatorframework.io/).
- Define CRDs (`RunnerPool`, `Runner`).
- Implement basic `RunnerPool` controller that creates/deletes runner pods.
- Static scaling only (fixed replica count, no auto-scaling).
- Helm chart for deploying the operator.

### Phase 2: KEDA Auto-Scaling

- Add new API endpoint for queue depth (`GET /api/v2/agent-pools/:id/queue-depth`).
- Implement KEDA external scaler (gRPC server) that exposes queue depth as a metric.
- Configure `ScaledObject` per `RunnerPool` with KEDA handling scale-up/down decisions.
- Scale-to-zero support via KEDA's `minReplicaCount: 0`.
- Configurable cooldown and stabilisation windows.
- Optional built-in fallback scaler for clusters without KEDA.

### Phase 3: Ephemeral Runners & Graceful Lifecycle

- **Ephemeral mode**: Runner pod executes exactly one job then terminates (fresh environment per job, stronger isolation). Configured via `spec.ephemeral: true` on `RunnerPool`.
- **Long-lived mode** (default): Runner persists across jobs, benefits from workspace/provider caching.
- Implement graceful shutdown via draining annotation.
- `preStop` hook integration in runner pods.
- Runner deregistration on shutdown.
- Handle pod eviction and node drain scenarios.
- Liveness and readiness probes for runner pods.

### Phase 4: Observability and Hardening

- Prometheus metrics from the operator (queue depth, active runners, scale events).
- Kubernetes events for scale-up/down decisions.
- `RunnerPool` status conditions (e.g. `ScalingLimited`, `APIUnreachable`).
- Leader election for HA operator deployment.
- Rate limiting on scale-up to prevent thundering herd.
- Comprehensive integration tests.

### Phase 5: Advanced Features

- **Runner groups**: Multiple `RunnerPool` resources with different configs (GPU nodes, high-memory, ARM, etc.).
- **Webhook-driven scaling** (optional): Instead of polling, Stackweaver API sends webhooks on job creation for faster scale-up via KEDA HTTP scaler.
- **Pod identity**: Integrate with cloud provider pod identity (AWS IRSA, GCP Workload Identity, Azure Workload Identity) for runners that need cloud credentials.

## API Changes Required

### New Endpoint: Queue Depth

```
GET /api/v2/agent-pools/:id/queue-depth
Authorization: Bearer <runner-api-key>

Response:
{
  "data": {
    "type": "queue-depths",
    "id": "<agent-pool-id>",
    "attributes": {
      "pending-terraform-jobs": 3,
      "pending-ansible-jobs": 1,
      "busy-runners": 2,
      "total-runners": 5,
      "idle-runners": 3
    }
  }
}
```

This endpoint is lightweight and safe for frequent polling (every 10-15s). It requires an API key with `runner:register` scope (reuse existing auth).

## Technology Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | kubebuilder | Industry standard, generates boilerplate, strong community |
| Language | Go | Matches backend, kubebuilder native, team expertise |
| CRD API version | `v1alpha1` | Start unstable, promote to `v1beta1` → `v1` as design stabilises |
| Scaling | KEDA with custom external scaler | Mature, widely adopted, avoids reinventing scaling logic |
| Distribution | Helm chart + OLM bundle | Helm for direct install, OLM for marketplace/OpenShift |

## Comparison with GitHub Actions Runner Controller (ARC)

| Aspect | ARC | Stackweaver Operator |
|--------|-----|---------------------|
| Scaling signal | GitHub webhook (workflow_job) | KEDA external scaler polling queue depth |
| Runner lifecycle | Ephemeral by default | Long-lived default, ephemeral first-class |
| Job assignment | GitHub assigns to runner | Runner polls for jobs (pull-based) |
| Scale-to-zero | Supported | Supported |
| Runner image | GitHub-provided or custom | Stackweaver runner images (same as platform-hosted) |
| Multi-tenant | Runner groups per repo/org | Agent pools per org, scoped to workspaces/projects |

## Repository Structure

The operator lives in the main Stackweaver monorepo under `operator/`, following the same pattern as other components. Code is synced to the `vhco-pro` org repo for independent distribution.

```
operator/
├── api/
│   └── v1alpha1/
│       ├── runnerpool_types.go
│       ├── runner_types.go
│       └── groupversion_info.go
├── cmd/
│   └── main.go
├── config/
│   ├── crd/
│   ├── rbac/
│   ├── manager/
│   └── samples/
├── internal/
│   ├── controller/
│   │   ├── runnerpool_controller.go
│   │   └── runner_controller.go
│   └── scaler/
│       ├── external_scaler.go       # KEDA gRPC external scaler
│       └── stackweaver_client.go    # API client for queue depth
├── deploy/
│   └── helm/
│       └── stackweaver-operator/
├── Dockerfile
├── Makefile
└── go.mod
```

## Decisions

1. **Monorepo with sync** — The operator lives in this repository under an `operator/` folder, following the same pattern as other components. Code is synced to the `vhco-pro` org repo for independent distribution, keeping development simple while allowing separate release cycles.
2. **Polling interval** — 10-15s default, configurable per `RunnerPool`. Too fast wastes API resources; too slow delays scale-up.
3. **Both ephemeral and long-lived runners are first-class** — Ephemeral mode (one job per pod, fresh environment, stronger isolation) and long-lived mode (workspace caching, faster startup for repeat jobs) are both supported. Long-lived is the default since IaC workloads benefit from cached state and providers.
4. **KEDA-first for scaling** — Use KEDA with a custom external scaler rather than building a proprietary scaling engine. KEDA is mature, widely adopted, and handles the hard parts (cooldown, stabilisation windows, metrics-driven scaling). The operator exposes queue depth as a KEDA external metric. This avoids reinventing the wheel and gives users a familiar scaling model. A built-in fallback scaler can be added later if KEDA is not available in the cluster. -> could be good indeed to have a fallback but should be easy, bare minimum stuff don't wan
5. **Minimum Kubernetes version** — Target 1.34+.
