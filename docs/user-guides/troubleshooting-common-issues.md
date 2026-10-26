---
description: "Locate the failing execution stage, inspect read-only evidence and choose a safe recovery."
covers:
  - "backend/internal/api/v2/handlers/**"
  - "backend/cmd/orchestrator/**"
  - "backend/cmd/runner/**"
  - "backend/cmd/ansible-runner/**"
  - "core/services/ansible/**"
---

# Troubleshoot common issues

Start with the execution's first meaningful error and the stage that stopped. Record the
run/job ID and configuration version before changing settings. Repeated retries can hide
the cause or repeat real changes.

## OpenTofu

| Symptom | Check first | Next action |
|---|---|---|
| Run stays queued. | Workspace lock, execution mode, runner pool availability and orchestrator status. | Restore the intended runner path. See [self-hosted runners](./self-hosted-runners.md). |
| Run fails before planning. | Repository access, branch/commit, working directory and initialization output. | Correct the specific connection or path; preserve the existing connection while diagnosing. |
| Unexpected deletion or replacement. | Selected commit, variables, state version and provider lock file. | Stop before apply. Compare with a known successful run and investigate drift deliberately. |
| Provider authentication/permission error. | Credential expiry, workload-identity trust, target account/region and operation permission. | Correct the narrow failing permission or credential. See [workload identity](./oidc-configuration.md). |
| A required external check holds the run. | Stage, task finding and enforcement level. | Follow [run-task recovery](./run-tasks.md); an override bypasses a gate and needs appropriate access. |
| Run times out. | Last output and whether it is progressing or waiting on a remote operation. | Diagnose first, then review [run timeout](../features/opentofu/run-timeout.md). |

A failed apply can leave partial infrastructure changes. Inspect the actual result and state
before queuing another apply. Refresh/import/state changes are deliberate recovery actions,
not the first response to an unexpected plan.

### State lock errors

1. Identify the lock holder and check the workspace's active runs and CLI operations.
2. Wait for a healthy operation to complete. If it is stuck, investigate and cancel through
   the normal run controls, then confirm the worker has stopped.
3. If no operation owns the lock, have an authorized operator review recovery against the
   correct backend and lock ID.

> [!WARNING]
> Never force-unlock while another operation may still write state. Bypassing the lock can
> allow concurrent writers and corrupt state. A stale-looking UI alone is not proof that
> the worker has stopped.

### Imported state looks incomplete

Check the destination workspace, state version, resource addresses and import result.
Compare against the protected source backup. Do not force-push over a newer state version
or bypass lineage/serial checks. Follow the guarded
[migration procedure](./migrating-from-terraform-cloud.md).

## Ansible

| Symptom | Check first | Next action |
|---|---|---|
| Host unreachable. | Inventory hostname/IP, runner network path, SSH port and attached credential. | Test reachability from the runner's network; private targets may need a self-hosted runner. |
| Permission denied or become failure. | Remote user, key selection, sudo/become policy and file permissions. | Correct the target's required permission; do not broadly disable host security. |
| Playbook not found. | Registration, repository-relative path, branch and last sync. | Use [playbook management](./managing-ansible-playbooks.md) to inspect the snapshot and selected revision. |
| Job hangs or times out. | Last task output, network waits, target load and forks. | Diagnose the stalled task before increasing the timeout; split work or bound task runtime if appropriate. |
| Hosts missing or inventory warning. | Source sync status, plugin authentication/configuration and last successful sync. | Follow [dynamic inventories](./dynamic-inventories.md). A failed refresh does not always prevent a job from using older hosts. |

## Access, webhooks and dashboard figures

| Symptom | Check first |
|---|---|
| Organization/workspace denied or not found. | Correct organization, invitation, team membership, workspace permissions and API-token scope. Ask an owner to verify the intended grant. |
| Push/PR does not trigger a run. | Repository/branch linkage, speculative setting, path filters, provider hook events and delivery status. Follow the relevant [VCS guide](./vcs/README.md). |
| Hook delivery returns an error. | Public reachability, current secret and the provider's response body. Redact credentials before sharing delivery records. |
| Counts differ across pages. | Organization, visibility, selected time range and live versus historical figures. See [dashboard](./reading-the-dashboard.md) and [analytics](./usage-analytics.md). |

Do not delete and reconnect an OAuth connection as the first diagnostic step. It can affect
resources using it. Use the provider-specific recovery only after verifying the failure.

## Collect read-only evidence

In a Compose deployment, run from the directory containing `docker-compose.yml`:

```bash
docker compose ps
docker compose logs --tail=100 api orchestrator runner ansible-runner
```

For Kubernetes, replace these names and namespace with the installed release's actual
Deployments:

```bash
kubectl get pods --namespace stackweaver
kubectl logs deployment/stackweaver-runner --namespace stackweaver --tail=100
kubectl logs deployment/stackweaver-orchestrator --namespace stackweaver --tail=100
```

For an individual OpenTofu execution, an authorized API read works without the UI. Set the
public origin, token and run ID locally:

```bash
curl --fail-with-body --silent --show-error \
  "$STACKWEAVER_URL/api/v2/runs/$RUN_ID" \
  --header "Authorization: Bearer $STACKWEAVER_TOKEN"
```

The UI's raw output and the [API viewer](/docs/api-reference/explorer) help inspect an
execution; management HCL or YAML is not a general diagnostic replacement. Use the linked
task guide when a configuration change is needed.

## Ask for help with the evidence

Include the intended action, run/job ID, stage, redacted error text, selected version/commit,
reproduction steps and checks already performed. Remove bearer tokens, passwords, sensitive
state and private data. [Report a reproducible issue](https://github.com/michielvha/stackweaver/issues)
when the problem remains after those checks.
