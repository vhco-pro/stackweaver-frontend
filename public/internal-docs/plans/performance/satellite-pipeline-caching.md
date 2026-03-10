# Plan: Add Caching to Satellite Repository Pipelines

**Issue:** [#126: Add caching to satellite repositories because builds are taking way too long](https://github.com/michielvha/stackweaver/issues/126)
**Status:** Phase 1 & 2 Complete, pending first build validation

---

## Problem

All satellite release pipelines (api, orchestrator, runner, ansible-runner, frontend, zitadel-init) use `michielvha/docker-release-action@main` to build and push multi-platform Docker images. Builds consistently take **15–30 minutes** per satellite.

### Root Causes

1. **No Docker layer caching**: every build re-downloads and recompiles from scratch:
   - `go mod download` (~hundreds of modules per Go image)
   - `uv sync` + `ansible-galaxy collection install` (ansible-runner)
   - `npm ci` (frontend)
   - Terraform binary download from releases.hashicorp.com (runner)

2. **Multi-platform QEMU emulation**: `platforms: linux/amd64,linux/arm64` runs arm64 via QEMU on amd64 runners, which is 5–10× slower than native compilation.

3. ~~**`docker-release-action` has no cache inputs**~~ (**resolved**: `cache-from` / `cache-to` inputs added to the action).

---

## Satellite Inventory

| Satellite | Base Images | Heavy Steps |
|-----------|-------------|-------------|
| `stackweaver-api` | golang:1.26-alpine → alpine:3.23 | `go mod download`, `go build` |
| `stackweaver-orchestrator` | golang:1.26-alpine → alpine:3.23 | `go mod download`, `go build` |
| `stackweaver-runner` | golang:1.25.7-alpine → alpine:3.23 | `go mod download`, `go build`, Terraform download |
| `stackweaver-ansible-runner` | golang:1.26-alpine + python:3.14-slim | `go mod download`, `uv sync`, `ansible-galaxy` |
| `stackweaver-frontend` | node:24-alpine → nginx:alpine | `npm ci`, `npm run build` |
| `stackweaver-zitadel-init` | golang:1.25.7-alpine → alpine:latest | `go mod download`, `go build` |

---

## Solution

### Option A: GHA Layer Cache (Recommended, lowest friction)

Add `cache-from` and `cache-to` inputs to `docker-release-action` so callers can pass GitHub Actions BuildKit cache. Each satellite passes:

```yaml
cache-from: type=gha,scope=${{ github.workflow }}
cache-to: type=gha,scope=${{ github.workflow }},mode=max
```

`mode=max` caches all intermediate layers (including the builder stage), so `go mod download` / `npm ci` / `uv sync` layers are reused across runs.

**Expected improvement:** Go services: 15 min → 3–5 min. Frontend: ~8 min → 2–3 min.

### Option B: Registry Cache (Complementary)

Cache to GHCR using `type=registry`. Survives cache eviction (GHA cache has 10 GB limit per repo). Can be used alongside Option A as fallback.

```yaml
cache-from: type=registry,ref=ghcr.io/vhco-pro/${{ project }}:buildcache
cache-to: type=registry,ref=ghcr.io/vhco-pro/${{ project }}:buildcache,mode=max
```

Requires `packages: write` permission (already present in all release workflows).

### Option C: Native arm64 Runners (Most Impactful for Cross-Platform)

Use GitHub-hosted arm64 runners (`ubuntu-24.04-arm`) in a matrix strategy: build amd64 and arm64 natively in parallel, then merge into a multi-arch manifest with `docker/metadata-action` + `docker buildx imagetools create`.

**Expected improvement:** arm64 build time: ~20 min (QEMU) → ~3 min (native). Total wall-clock time cut by ~60–70%.

This requires restructuring `docker-release-action` into a 3-job workflow: `build-amd64`, `build-arm64`, `merge-manifest`.

---

## Implementation Steps

### Phase 1: Add cache inputs to docker-release-action (Complete)

- [x] **1.1** Add `cache-from` and `cache-to` optional inputs to `michielvha/docker-release-action` and pass them to the underlying `docker/build-push-action`.

### Phase 2: Registry Cache on all satellites (Complete)

Chose registry cache (`type=registry,mode=max`) over GHA cache: persists across cache eviction (no 10 GB org limit concern), visible as `:buildcache` tags in GHCR, and works across different runner instances without any scope configuration.

- [x] **2.1** Add `cache-from`/`cache-to` registry inputs to each satellite's `release.yml`:
  - [x] `stackweaver-api`
  - [x] `stackweaver-orchestrator`
  - [x] `stackweaver-runner`
  - [x] `stackweaver-ansible-runner`
  - [x] `stackweaver-frontend`
  - [x] `stackweaver-zitadel-init`
- [ ] **2.2** Verify first post-cache build shows layer reuse in build logs (cache MISS on first run, HIT on subsequent).

### Phase 3: Native arm64 Runners (Optional, Major Speed Gain)

- [ ] **3.1** Investigate GitHub arm64 hosted runner availability for `vhco-pro` org.
- [ ] **3.2** Restructure `docker-release-action` to support a matrix build + manifest merge pattern.
- [ ] **3.3** Update satellite workflows to use the new matrix strategy.

---

## Files to Modify

### `michielvha/docker-release-action` (separate repo)
- `action.yml`: add `cache-from` and `cache-to` inputs; pass to `docker/build-push-action`

### Satellites (in `distribution/*/`)
- `stackweaver-api/.github/workflows/release.yml`
- `stackweaver-orchestrator/.github/workflows/release.yml`
- `stackweaver-runner/.github/workflows/release.yml`
- `stackweaver-ansible-runner/.github/workflows/release.yml`
- `stackweaver-frontend/.github/workflows/release.yml`
- `stackweaver-zitadel-init/.github/workflows/release.yml`

---

## Expected Outcome

| Satellite | Before | After (Phase 1+2) | After (Phase 3) |
|-----------|--------|-------------------|-----------------|
| api | ~18 min | ~4 min | ~3 min |
| orchestrator | ~18 min | ~4 min | ~3 min |
| runner | ~20 min | ~5 min | ~3 min |
| ansible-runner | ~25 min | ~8 min | ~4 min |
| frontend | ~12 min | ~3 min | ~2 min |
| zitadel-init | ~10 min | ~2 min | ~1 min |

---

## Progress Tracking

- [x] Phase 1 complete: `cache-from`/`cache-to` inputs added to `docker-release-action`
- [x] Phase 2 complete: registry cache (`type=registry,mode=max`) wired in all 6 satellites
- [ ] Phase 2 validation: confirm layer reuse in next build run
- [ ] Phase 3 complete (optional): native arm64 runners in use
- [ ] Issue #126 closed
