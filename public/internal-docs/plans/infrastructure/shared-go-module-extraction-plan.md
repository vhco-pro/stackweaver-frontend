<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Shared Go Module Extraction Plan

**Status:** Draft — saved for future reference, no implementation yet.

This plan outlines how to extract the shared Go packages from `backend/internal/` into a standalone, versioned Go module so that satellite repos (API, orchestrator, runner, ansible-runner) can import only what they need and become truly independent Go projects.

## Motivation

Today all four backend binaries live in one Go module (`github.com/iac-platform/backend`). The satellite repos receive the entire `backend/` directory via rsync because Go's `internal/` visibility rules and module system require the full source tree to compile any single binary. Extracting shared packages into a standalone module would:

1. **Enable selective imports** — each satellite repo declares only the dependencies it actually uses
2. **Reduce satellite repo size** — no more shipping four binaries' worth of code to each satellite
3. **Enable independent CI** — satellite repos can lint/test themselves without the full monorepo
4. **Improve versioning** — shared code gets semver tags; consumers pin to known-good versions
5. **Simplify sync workflows** — each satellite only needs its own `cmd/` directory synced

## Current Dependency Graph

The architecture is cleanly layered with no circular dependencies:

```
pkg/id, pkg/crypto, pkg/logger          ← leaf (no internal deps)
internal/queue, internal/storage         ← leaf (no internal deps)
internal/plugins, internal/vcs           ← leaf interfaces
    │
    ▼
internal/models                          ← depends on: pkg/id
    │
    ▼
internal/repository                      ← depends on: models
    │
    ▼
internal/services/*                      ← depends on: models, repository,
    │                                       queue, storage, pkg/crypto
    │                                       (one cross-service: ansible→oidc)
    ▼
internal/api/*                           ← depends on: everything above
    │
    ▼
cmd/*                                    ← wires everything together
```

This layering means extraction is straightforward — no circular dependency breaking required.

## What Gets Extracted

The new module (e.g., `github.com/stackweaver/backend-core`) would contain the packages shared across two or more binaries:

| Current Path | New Module Path | Used By |
|---|---|---|
| `internal/models` | `models` | all 4 binaries |
| `internal/repository` | `repository` | all 4 binaries |
| `internal/queue` | `queue` | all 4 binaries |
| `internal/storage` | `storage` | API, runner, ansible-runner |
| `internal/vcs` | `vcs` | API, orchestrator, ansible-runner |
| `internal/vcs/github` | `vcs/github` | ansible-runner |
| `internal/vcs/gitlab` | `vcs/gitlab` | API |
| `internal/plugins` | `plugins` | runner |
| `internal/plugins/terraform` | `plugins/terraform` | runner |
| `internal/services/oidc` | `services/oidc` | API, runner, ansible-runner |
| `internal/services/vcs` | `services/vcs` | API, orchestrator, ansible-runner |
| `internal/services/logbuffer` | `services/logbuffer` | runner |
| `internal/services/logparser` | `services/logparser` | runner |
| `internal/services/state` | `services/state` | runner |
| `internal/services/variable` | `services/variable` | API, runner |
| `internal/services/ansible` | `services/ansible` | API, ansible-runner |
| `pkg/crypto` | `crypto` | API, ansible-runner |
| `pkg/id` | `id` | (via models) |
| `pkg/logger` | — | Already extracted to `github.com/michielvha/logger` |

### What Stays in Each Binary's Repo

| Satellite Repo | Keeps |
|---|---|
| `stackweaver-api` | `cmd/api/`, `internal/api/` (handlers, routes, middleware), `services/{auth,apikey,audit,activity,rbac,registry,runner,sessions,terraform,totp,profile,team_sync}`, `config/` |
| `stackweaver-orchestrator` | `cmd/orchestrator/` only (everything else comes from the shared module) |
| `stackweaver-runner` | `cmd/runner/` only |
| `stackweaver-ansible-runner` | `cmd/ansible-runner/`, `scripts/oidc-ansible-inventory` |

## New Module Structure

```
backend-core/
├── go.mod                    # module github.com/stackweaver/backend-core
├── go.sum
├── LICENSE
├── README.md
├── crypto/
│   └── *.go
├── id/
│   └── *.go
├── models/
│   └── *.go                  # 40+ model files
├── repository/
│   └── *.go
├── queue/
│   └── *.go
├── storage/
│   └── *.go
├── vcs/
│   ├── interface.go
│   ├── github/
│   └── gitlab/
├── plugins/
│   ├── interface.go
│   └── terraform/
└── services/
    ├── ansible/
    ├── logbuffer/
    ├── logparser/
    ├── oidc/
    ├── state/
    ├── variable/
    └── vcs/
```

Note: packages move from `internal/` to top-level exported paths. The `internal/` directory is a Go visibility mechanism that restricts imports to the parent module — in a shared module, these packages must be public.

## Migration Steps

### Phase 1: Prepare the shared module

1. Create the `backend-core` repository
2. Copy the shared packages, converting `internal/` paths to exported paths
3. Update all import paths from `github.com/iac-platform/backend/internal/...` to `github.com/stackweaver/backend-core/...`
4. Update `pkg/` paths from `github.com/iac-platform/backend/pkg/...` to `github.com/stackweaver/backend-core/...`
5. Ensure all tests pass in the new module
6. Tag `v0.1.0`

### Phase 2: Update the monorepo

7. Add `require github.com/stackweaver/backend-core v0.1.0` to `backend/go.mod`
8. Update all import paths in `backend/` to use the new module
9. Delete the extracted packages from `backend/internal/` and `backend/pkg/`
10. Verify all four binaries build and tests pass

### Phase 3: Simplify satellite syncs

11. Update each satellite repo's `go.mod` to import the shared module
12. Simplify sync workflows to only copy binary-specific code (`cmd/`, API handlers, etc.)
13. Each satellite can now have its own independent CI

### Phase 4: API-specific services

14. Decide whether API-only services (`auth`, `rbac`, `registry`, etc.) stay in the monorepo's `backend/internal/services/` or move into a second shared module
15. For now, keep them in the API satellite since no other binary uses them

## Risks & Considerations

| Risk | Mitigation |
|---|---|
| **Versioning overhead** — shared module needs releases when models change | Use a bot or CI to auto-tag on merge to main; consumers use `go get -u` |
| **Breaking changes** — model schema changes affect all consumers | Already the case today; semver makes it explicit |
| **GORM auto-migration coupling** — API runs migrations, others just read | No change needed; only API calls `AutoMigrate()` |
| **Development friction** — local development requires `replace` directives | Use `go.work` (Go workspaces) for local development across modules |
| **`internal/` visibility lost** — extracted packages become public API | Accept this; document that these are internal-use packages not covered by semver stability guarantees (use a `v0.x` major version) |
| **Import path churn** — every Go file with an internal import needs updating | One-time `sed`/`goimports` pass; mechanical and safe |

## Effort Estimate

| Phase | Effort | Risk |
|---|---|---|
| Phase 1: Create shared module | 2-3 hours | Low — mechanical extraction |
| Phase 2: Update monorepo imports | 1-2 hours | Low — find-and-replace + test |
| Phase 3: Simplify sync workflows | 1 hour | Low |
| Phase 4: API service decision | 30 min | None — just a decision |
| **Total** | **~5-7 hours** | |

## Decision Needed Before Starting

1. **Module path**: `github.com/stackweaver/backend-core` or `github.com/vhco-pro/stackweaver-core`?
2. **Repository**: New repo in the same org, or a subdirectory of the monorepo with a separate `go.mod` (Go multi-module)?
3. **Versioning**: Start at `v0.1.0` (no stability guarantee) or `v1.0.0`?
4. **Timing**: Do this before or after the runner extraction described in `runners-ci-implementation.md`?
