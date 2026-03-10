<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Stackweaver Release Process

This document describes the end-to-end automated release process for Stackweaver.
It is intended for internal engineers who need to understand how code flows from a
commit in the monorepo to a published Docker image and Helm chart.

For the full design rationale and technical plan, see the
[release strategy](plans/infrastructure/release-strategy.md).

## Quick Reference

| What | Where |
|------|-------|
| All development | `stackweaver` private monorepo |
| Container registry | `ghcr.io/vhco-pro/` |
| Helm chart OCI | `oci://ghcr.io/vhco-pro/charts/stackweaver` |
| Versioning tool | GitVersion (repo-scoped, conventional commits) |
| Docker build action | `michielvha/docker-release-action@main` |
| GitVersion tag action | `michielvha/gitversion-tag-action@main` |

## Components

| Component | Satellite Repo | Image |
|-----------|----------------|-------|
| API | `vhco-pro/stackweaver-api` | `ghcr.io/vhco-pro/stackweaver-api` |
| Frontend | `vhco-pro/stackweaver-frontend` | `ghcr.io/vhco-pro/stackweaver-frontend` |
| Orchestrator | `vhco-pro/stackweaver-orchestrator` | `ghcr.io/vhco-pro/stackweaver-orchestrator` |
| Terraform Runner | `vhco-pro/stackweaver-runner` | `ghcr.io/vhco-pro/stackweaver-runner` |
| Ansible Runner | `vhco-pro/stackweaver-ansible-runner` | `ghcr.io/vhco-pro/stackweaver-ansible-runner` |
| Zitadel Init | `vhco-pro/stackweaver-zitadel-init` | `ghcr.io/vhco-pro/stackweaver-zitadel-init` |
| Helm Chart | `vhco-pro/stackweaver-helm` | `oci://ghcr.io/vhco-pro/charts/stackweaver` |

## End-to-End Flow

The release process is fully automated from commit to published artifact.
A developer only needs to push a conventional commit to the monorepo's `main` branch.

### Step 1: Developer Pushes to Monorepo

A developer merges a PR or pushes directly to `main` with a conventional commit message.
The commit message determines the version bump:

| Prefix | Version Bump | Example |
|--------|-------------|---------|
| `feat:` | Minor | `feat(api): add retry logic` → 1.3.0 → 1.4.0 |
| `fix:` | Patch | `fix(runner): handle timeout` → 1.3.0 → 1.3.1 |
| `BREAKING CHANGE` or `!:` | Major | `feat(api)!: remove v1 endpoints` → 1.3.0 → 2.0.0 |
| `chore:`, `docs:`, `ci:` | None | No version bump, no release |

### Step 2: Sync Workflow Triggers

The monorepo has path-filtered sync workflows (`.github/workflows/sync-*.yml`).
When files in a component's source paths change, the corresponding sync workflow runs.

The sync workflow does:

1. Checks out the monorepo and the target satellite repo.
2. Uses `rsync --delete` to copy source files to the satellite, excluding satellite-owned files
   (`.github/`, `gitversion.yml`, `LICENSE`, `README.md`, `Dockerfile`).
3. Commits with the original commit message preserved (critical for GitVersion to parse).
4. Pushes to the satellite's `main` branch.

The `SATELLITE_REPO_TOKEN` secret (a PAT with `contents: write` on all satellites) authenticates
the push. This must be a PAT (not `GITHUB_TOKEN`) because `GITHUB_TOKEN` pushes do not trigger
workflows in the receiving repository.

**Path mappings:**

| Monorepo Path | Sync Workflow | Satellite |
|---------------|---------------|-----------|
| `backend/cmd/api/**`, `backend/internal/**`, `backend/pkg/**` | `sync-api.yml` | `stackweaver-api` |
| `frontend/**` | `sync-frontend.yml` | `stackweaver-frontend` |
| `backend/cmd/orchestrator/**`, `backend/internal/**` | `sync-orchestrator.yml` | `stackweaver-orchestrator` |
| `backend/cmd/runner/**`, `runner-images/terraform/**` | `sync-runner.yml` | `stackweaver-runner` |
| `backend/cmd/ansible-runner/**`, `runner-images/ansible/**` | `sync-ansible-runner.yml` | `stackweaver-ansible-runner` |
| `scripts/zitadel-init/**` | `sync-zitadel-init.yml` | `stackweaver-zitadel-init` |
| `deploy/helm/**` | `sync-helm.yml` | `stackweaver-helm` |

Because Go components share `backend/internal/`, a change there triggers syncs to all Go
satellites (API, orchestrator, runner, ansible-runner). This is correct behavior — a shared
dependency change should produce new builds of all consumers.

### Step 3: Satellite Tag Workflow

When the satellite receives a push to `main`, its `tag.yml` workflow runs:

1. Checks out the satellite repo with `fetch-depth: 0` (full history for GitVersion).
2. Uses `michielvha/gitversion-tag-action@main` to compute the next semantic version.
3. GitVersion parses the commit message (forwarded from monorepo) to determine the bump type.
4. Creates and pushes a git tag (e.g., `1.4.0`).

The checkout uses `RELEASE_TOKEN` (a PAT) instead of `GITHUB_TOKEN` so that the tag push
triggers the release workflow. Tags pushed by `GITHUB_TOKEN` are silently ignored by GitHub
Actions to prevent infinite loops.

### Step 4: Satellite Release Workflow

A new tag triggers the `release.yml` workflow:

1. **Build job**: Uses `michielvha/docker-release-action@main` to build the Docker image
   for `linux/amd64` and `linux/arm64` and pushes to GHCR with three tags: `{version}`,
   `latest`, and `{git-sha}`.

2. **Bump-helm job** (runs after build succeeds): Checks out the **monorepo**, uses `yq`
   to update the image tag in `deploy/helm/stackweaver/values.yaml`, and pushes a commit like
   `fix(api): bump api image to 1.4.0`. This change to `deploy/helm/**` triggers the next step.

### Step 5: Helm Chart Auto-Release

The bump-helm commit modifies `deploy/helm/**` in the monorepo, which triggers `sync-helm.yml`.
The sync workflow copies the updated `values.yaml` to the `stackweaver-helm` satellite repo,
which then triggers its tag and release workflows:

1. `sync-helm.yml` syncs `deploy/helm/stackweaver/` to `stackweaver-helm/chart/`.
2. `tag.yml` computes a new chart version (patch bump because commit is `fix:`).
3. `release.yml` packages the chart with `helm package`, sets `version` and `appVersion`
   in `Chart.yaml` from the tag, and pushes to GHCR as an OCI artifact.

This ensures the monorepo remains the single source of truth for the Helm chart.

Users can then install or upgrade:

```bash
helm install stackweaver oci://ghcr.io/vhco-pro/charts/stackweaver --version 0.3.1
```

## Complete Chain Example

```
Developer: git commit -m "feat(api): add webhooks v2"  &&  git push
    │
    ▼  sync-api.yml
stackweaver-api:main  ←  "feat(api): add webhooks v2"
    │
    ▼  tag.yml
Tag: 1.4.0
    │
    ▼  release.yml → release job
ghcr.io/vhco-pro/stackweaver-api:1.4.0  ✓  (published)
    │
    ▼  release.yml → bump-helm job
monorepo:main  ←  "fix(api): bump api image to 1.4.0"  (deploy/helm/stackweaver/values.yaml)
    │
    ▼  sync-helm.yml (triggered by deploy/helm/** change)
stackweaver-helm:main  ←  synced values.yaml with api tag 1.4.0
    │
    ▼  tag.yml
Tag: 0.3.1
    │
    ▼  release.yml
oci://ghcr.io/vhco-pro/charts/stackweaver:0.3.1  ✓  (published)

Total time: ~5-10 minutes from monorepo push to published chart.
```

## Secrets

### Monorepo

| Secret | Purpose |
|--------|---------|
| `SATELLITE_REPO_TOKEN` | PAT with `contents: write` on all 7 satellite repos. Used by sync workflows. |

### Satellite Repos (all 7)

| Secret | Purpose |
|--------|---------|
| `GITHUB_TOKEN` | Built-in. Authenticates GHCR pushes (`packages: write`). |
| `RELEASE_TOKEN` | PAT with `contents: write` on the satellite itself + the monorepo. Used by `tag.yml` (to trigger release) and `bump-helm` job (to push helm values to monorepo). |

All PATs should be fine-grained and scoped only to the required repositories.
Set `RELEASE_TOKEN` as an org-level secret so all satellite repos inherit it automatically.

## Helm Chart Structure

The Helm chart templates are organized into subdirectories by service for readability:

```
chart/templates/
├── _helpers.tpl                          # shared template helpers
├── NOTES.txt                             # post-install notes
├── api/                                  # API service
├── frontend/                             # Frontend SPA
├── orchestrator/                         # Job scheduler
├── runner/                               # Terraform runner
├── ansible-runner/                       # Ansible runner
├── zitadel/                              # Zitadel OIDC + Login UI + init job
├── minio/                                # Object storage
├── postgresql/                           # Database
├── redis/                                # Cache / queue
└── shared/                               # Ingress, secrets, service account
```

Helm recursively scans all subdirectories for templates, so this is purely organizational.

## Troubleshooting

### Tag pushed but release workflow did not trigger

The `tag.yml` checkout must use `RELEASE_TOKEN` (PAT), not the default `GITHUB_TOKEN`.
Tags pushed by `GITHUB_TOKEN` do not trigger other workflows. Verify the secret exists
and the PAT has `contents: write` scope.

### Multiple satellites pushing to monorepo simultaneously

When `backend/internal/` changes, all Go satellites build and try to bump the helm chart
values in the monorepo concurrently. Git push will fail for all but the first. The workflow
handles this with `git pull --rebase origin main` before pushing. If a bump still fails,
the next satellite's push will include both changes.
If persistent, add retry logic or a small random delay.

### Sync workflow does not trigger

Verify the path filters in `sync-*.yml` match the changed files. Use `workflow_dispatch`
to manually trigger a sync for testing.

### Image not accessible

Private GHCR packages require authentication. Verify the user has `read:packages` scope on
their PAT and has been granted access to the package (via org team or direct invitation).

### Version not bumping

GitVersion parses the commit message. Ensure the original monorepo commit uses conventional
commit format (`feat:`, `fix:`, etc.). Messages like `update code` or `WIP` produce no bump
(`chore:` prefix or unrecognized format defaults to no bump).

## Manual Operations

These steps are not automated and require manual intervention:

1. **Creating a new satellite repo** — create on GitHub, push initial skeleton (workflows,
   gitversion.yml, LICENSE, README, Dockerfile), add secrets.
2. **Major version bumps** — consider if breaking changes warrant a manual review before
   release. Use `BREAKING CHANGE` in commit footer or `!:` in commit subject.
3. **Changing GHCR visibility** — set package visibility (public/private) in GitHub package
   settings after first publish.
4. **Rotating PATs** — update `SATELLITE_REPO_TOKEN` in monorepo and `RELEASE_TOKEN` in all
   satellite repos when tokens expire or need rotation.
