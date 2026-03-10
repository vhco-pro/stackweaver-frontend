<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# CI Pipeline Improvement Plan

**Status:** ✅ Implemented. `dorny/paths-filter` for path-based triggering and `concurrency` for cancel-in-progress are in use in `.github/workflows/ci.yml`.

This plan redesigns the CI pipeline for path-based triggering, parallel jobs, and composite actions to reduce unnecessary runs and improve feedback time.

## Current Problems

1. **Over-triggering on PRs**: The `pull_request` trigger has no `paths` filter, so every PR runs both backend and frontend jobs regardless of what changed.
2. **Over-triggering on push**: Push filters on `backend/**` and `frontend/**` but not granularly; a docs-only change inside `backend/` still triggers the full backend lint.
3. **Missing coverage**: No TypeScript type-checking (`tsc --noEmit`), Go tests are commented out, no vulnerability scan on PRs (only push).
4. **Sequential bottleneck**: Backend lint and vuln scan run sequentially in one job instead of in parallel.
5. **No concurrency control**: Multiple CI runs can stack up on rapid pushes to a PR.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Single vs. multiple workflow files | **Single `ci.yml`** | One status check in PRs, shared change detection, easier to reason about |
| Change detection method | **`dorny/paths-filter@v3`** | Battle-tested, handles both push and PR events, declarative config |
| Composite actions | **Yes, for setup only** | DRY the Go and Node.js setup + caching boilerplate across jobs |
| Job granularity | **Split lint / vuln / test / type-check** | Parallel execution, clear failure signals per concern |
| Concurrency control | **Yes, cancel in-progress** | Save runner minutes on rapid PR updates |

## Architecture

```
ci.yml
├── changes               (dorny/paths-filter, ~5s)
├── backend-lint           (if backend changed) — golangci-lint
├── backend-vuln           (if backend changed) — govulncheck
├── backend-test           (if backend changed) — go test (when enabled)
├── frontend-lint          (if frontend changed) — eslint
├── frontend-types         (if frontend changed) — tsc --noEmit
└── frontend-build         (if frontend changed) — vite build
```

### Path Groups

| Group | Trigger paths |
|-------|---------------|
| `backend` | `backend/**` |
| `frontend` | `frontend/**` |

### Composite Actions

```
.github/actions/
  setup-go/action.yml       # checkout + setup-go + cache + go mod download
  setup-node/action.yml     # checkout + setup-node + npm ci
```

These encapsulate only the repeated setup boilerplate. The actual lint/test/build steps remain inline in the workflow for visibility and easy debugging.

## Status

**Completed.** All steps implemented on 2026-03-05.

## Implementation Steps

- [x] 1. Create `.github/actions/setup-go/action.yml` composite action
- [x] 2. Create `.github/actions/setup-node/action.yml` composite action
- [x] 3. Rewrite `ci.yml` with change-detection gatekeeper job
- [x] 4. Add concurrency control
- [x] 5. Add conditional backend jobs (lint, vuln, test)
- [x] 6. Add conditional frontend jobs (lint, type-check, build)

## Expected Performance Gains

| Scenario | Before | After |
|----------|--------|-------|
| Frontend-only PR | ~90s (runs both) | ~40s (skips backend) |
| Backend-only PR | ~90s (runs both) | ~50s (skips frontend) |
| Docs-only PR | ~90s (runs both) | ~5s (all jobs skipped) |
| Rapid PR pushes | All runs finish | Stale runs cancelled |

## Files Changed

- `.github/actions/setup-go/action.yml` (new)
- `.github/actions/setup-node/action.yml` (new)
- `.github/workflows/ci.yml` (rewritten)
