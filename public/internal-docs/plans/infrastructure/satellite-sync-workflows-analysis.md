<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Satellite Sync Workflows: Analysis

**Note:** Reference/analysis document with no implementation phases. Documents the intentional decision to sync the full `backend/` directory to all satellite repos due to Go `internal/` package constraints.

This document analyzes the current monorepo-to-satellite sync workflows and addresses whether backend services should sync the full `backend/` directory or only the files each component touches.

## Current Behavior

All four backend satellite repos (API, orchestrator, runner, ansible-runner) sync the **entire** `backend/` directory via rsync:

```bash
rsync -av --delete \
  --exclude='.git' --exclude='.github' --exclude='gitversion.yml' \
  --exclude='LICENSE' --exclude='README.md' --exclude='Dockerfile' \
  monorepo/backend/ satellite/backend/
```

This means every satellite gets all four `cmd/` binaries, all `internal/` packages, all tests, scripts, config, etc.

## Why This Is Intentional (and Unavoidable)

Go's `internal/` package visibility rules mean all four binaries share the same dependency graph. Looking at the actual imports:

| Binary | Imports from `internal/` |
|--------|--------------------------|
| `cmd/api` | `api/`, `models/`, `repository/`, `services/`, `storage/`, `queue/`, `vcs/`, `plugins/` |
| `cmd/orchestrator` | `models/`, `queue/`, `repository/`, `services/vcs` |
| `cmd/runner` | `models/`, `queue/`, `repository/`, `storage/`, `plugins/terraform`, `services/{logbuffer,logparser,oidc,state,variable}` |
| `cmd/ansible-runner` | `models/`, `queue/`, `repository/`, `storage/`, `services/{ansible,oidc,vcs}`, `vcs/github`, `pkg/crypto` |

Every binary imports `models/`, `repository/`, and `queue/`. The `models/` package alone has 40+ files and GORM auto-migration for every model. Because Go resolves imports at the **package** level (not file level), even if the orchestrator only uses 3 models at runtime, the compiler needs all files in `internal/models/` to build.

**Selective syncing would break compilation.** You cannot sync only `cmd/orchestrator/` + `internal/queue/` + `internal/models/` because:

1. `internal/models/` may import `internal/repository/` or other internal packages
2. `internal/repository/` imports `internal/models/`
3. The Go compiler needs the full transitive import graph to build any binary
4. `go.mod` and `go.sum` are module-level, not binary-level

## What Could Be Improved

While the full `backend/` sync is necessary for compilation, there are minor cleanup opportunities:

### Already Handled Well
- Path triggers are correctly scoped (e.g., orchestrator triggers on `backend/cmd/orchestrator/**` + `backend/internal/**`)
- Frontend sync excludes `node_modules`, internal docs
- Helm sync is clean and minimal

### Potential Improvements (Low Priority)

1. **Exclude other binaries' `cmd/` dirs**: Each satellite doesn't need the other binaries' entry points. The orchestrator satellite doesn't need `cmd/api/`, `cmd/runner/`, or `cmd/ansible-runner/`. This would reduce noise in the satellite repos but has zero impact on build (Dockerfiles already target a specific `cmd/`).

   ```bash
   # Example for orchestrator satellite
   rsync -av --delete \
     --exclude='.git' --exclude='.github' \
     --exclude='cmd/api' --exclude='cmd/runner' --exclude='cmd/ansible-runner' \
     monorepo/backend/ satellite/backend/
   ```

2. **Exclude test artifacts**: `test_registry.sh`, `TESTING.md`, `tests/` are not needed in satellites.

3. **Consolidate into a reusable composite action**: The sync logic is nearly identical across all four backend workflows. A `.github/actions/sync-satellite/action.yml` could DRY this up.

## Recommendation

**Keep the current full-backend sync approach.** It is correct by necessity because Go's module system requires it. The only change worth making is excluding other binaries' `cmd/` directories and test files, which is cosmetic and low-priority. This should not block other work.

If the project eventually extracts shared packages into a standalone Go module (e.g., `github.com/stackweaver/backend-common`), the satellite repos could become truly independent. But that is a significant architectural change and not currently warranted.
