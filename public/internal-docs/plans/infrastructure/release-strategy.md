<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Stackweaver Release Strategy

This document defines the end-to-end strategy for packaging, distributing, and releasing all Stackweaver components as Docker containers with independent versioning.

## Principles

1. **Monorepo is the single source of truth.** All development happens in the private `stackweaver` repository. No code is ever written directly in satellite repos.
2. **Independent versioning per component.** Each component has its own semantic version. A frontend bugfix does not bump the API version. GitVersion is repository-scoped, so each component needs its own satellite repo.
3. **Hub-and-spoke sync model.** The monorepo syncs source code to satellite repositories via GitHub Actions. Each satellite repo owns its own GitVersion config, CI/CD, and release cycle. Code is synced, not binaries — because version is embedded at build time.
4. **Docker containers are the only distribution format.** No standalone binaries, NPM packages, or Go module releases (except the `logger` utility).
5. **GitHub-native tooling.** GitHub Actions for CI/CD, GitHub Container Registry (GHCR) for images, GitVersion for versioning, `docker-release-action` for Docker builds.
6. **Open-source components are public.** Runner repos are public with Apache 2.0 license. Platform components are private with BSL 1.1 license and GHCR access control.

## Component Inventory

| Component | License | Satellite Repo | GHCR Image | Visibility |
|-----------|---------|----------------|------------|------------|
| API | BSL 1.1 | `stackweaver-api` (private) | `ghcr.io/vhco-pro/stackweaver-api` | Private |
| Frontend | BSL 1.1 | `stackweaver-frontend` (private) | `ghcr.io/vhco-pro/stackweaver-frontend` | Private |
| Orchestrator | BSL 1.1 | `stackweaver-orchestrator` (private) | `ghcr.io/vhco-pro/stackweaver-orchestrator` | Private |
| Terraform Runner | Apache 2.0 | `stackweaver-runner` (public) | `ghcr.io/vhco-pro/stackweaver-runner` | Public |
| Ansible Runner | Apache 2.0 | `stackweaver-ansible-runner` (public) | `ghcr.io/vhco-pro/stackweaver-ansible-runner` | Public |
| Zitadel Init | BSL 1.1 | `stackweaver-zitadel-init` (private) | `ghcr.io/vhco-pro/stackweaver-zitadel-init` | Private |
| Helm Chart | BSL 1.1 | `stackweaver-helm` (public) | `ghcr.io/vhco-pro/charts/stackweaver` (OCI) | Public |

**Third-party services** (PostgreSQL, Redis, MinIO, Zitadel, Login UI) use upstream images and are not packaged by us.

**Total satellite repos: 7** (4 private, 3 public)

## Registry Strategy: GitHub Container Registry (GHCR)

All images are hosted on GHCR (`ghcr.io`). This keeps everything in the GitHub ecosystem and provides native access control.

### Why GHCR over self-hosted or Docker Hub?

- **Access control built-in**: private packages require authentication, support granular user/team permissions.
- **No self-hosting burden**: no registry server to maintain, secure, or back up.
- **GitHub Actions integration**: workflows authenticate with `GITHUB_TOKEN` automatically — no extra secrets needed.
- **OCI compliant**: works with `docker pull`, Helm OCI, and any OCI-aware tooling.
- **Cost**: public packages are free. Private packages use GitHub plan storage/bandwidth (included in Pro/Team/Enterprise plans).
- **Helm OCI support**: GHCR natively supports OCI artifacts, so the Helm chart can be pushed as `oci://ghcr.io/vhco-pro/charts/stackweaver` without a separate chart repository.

### Access control for private images

Users who need to pull private platform images must:

1. Have a GitHub account.
2. Be granted access to the package (via org team membership or direct invitation).
3. Authenticate: `echo $GHCR_TOKEN | docker login ghcr.io -u USERNAME --password-stdin` using a PAT with `read:packages` scope.

This gives full control over who can download the platform images without running your own registry.

## Versioning

### Why independent versions require separate repos

GitVersion operates at the repository level — it uses the full commit history and tags of a repo to compute the next version. There is no built-in support for path-scoped versioning within a monorepo. By giving each component its own satellite repo, GitVersion works naturally: each repo has its own `gitversion.yml`, its own tags, and its own version history.

### How version is embedded

Go binaries embed version information at build time via `-ldflags`:

```bash
go build -ldflags "-X main.version=${GITVERSION_SEMVER}" ./cmd/...
```

This means the **build must happen in the repo where GitVersion computes the version**. The monorepo cannot compute independent per-component versions, so source code must be synced to satellite repos where builds happen.

The frontend embeds version via `VITE_APP_VERSION` environment variable at build time.

### Version tagging scheme

Each satellite repo computes its own version independently:

| Satellite Repo | Version | Example |
|----------------|---------|---------|
| `stackweaver-api` | `{major}.{minor}.{patch}` | `1.3.7` |
| `stackweaver-frontend` | `{major}.{minor}.{patch}` | `2.1.0` |
| `stackweaver-orchestrator` | `{major}.{minor}.{patch}` | `1.3.5` |
| `stackweaver-runner` | `{major}.{minor}.{patch}` | `0.8.2` |
| `stackweaver-ansible-runner` | `{major}.{minor}.{patch}` | `0.5.1` |
| `stackweaver-zitadel-init` | `{major}.{minor}.{patch}` | `0.2.0` |
| `stackweaver-helm` | `{major}.{minor}.{patch}` | `1.0.0` |

### Docker image tags

Every release produces three tags per image (via `docker-release-action`):

- `{version}` — e.g., `1.3.7`
- `latest`
- `{git-sha}`

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       stackweaver (private monorepo)                        │
│                       ══════════════════════════════                         │
│                       All development happens here.                         │
│                       No code is written in satellite repos.                │
│                                                                              │
│  Monorepo Source                    Sync Workflows            Satellite Repos │
│  ──────────────                    ──────────────           ───────────────── │
│                                                                              │
│  backend/cmd/api/          ──► sync-api.yml          ──► stackweaver-api     │
│  backend/cmd/orchestrator/ ──► sync-orchestrator.yml ──► stackweaver-        │
│                                                          orchestrator        │
│  frontend/                 ──► sync-frontend.yml     ──► stackweaver-        │
│                                                          frontend            │
│  scripts/zitadel-init/     ──► sync-zitadel-init.yml ──► stackweaver-        │
│                                                          zitadel-init        │
│  backend/cmd/runner/       ──► sync-runner.yml       ──► stackweaver-runner  │
│  runner-images/terraform/                                                    │
│  backend/cmd/ansible-      ──► sync-ansible-         ──► stackweaver-        │
│    runner/                     runner.yml                 ansible-runner      │
│  runner-images/ansible/                                                      │
│  deploy/helm/              ──► sync-helm.yml         ──► stackweaver-helm    │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          Satellite Repos (7 total)                           │
│                                                                              │
│  Each satellite repo has:                                                    │
│    • gitversion.yml          (independent version computation)               │
│    • .github/workflows/                                                      │
│        ├── tag.yml           (GitVersion → git tag on push to main)          │
│        └── release.yml       (on tag → docker-release-action → GHCR)        │
│    • Source code             (synced from monorepo, never edited directly)   │
│    • Dockerfile              (synced from monorepo)                          │
│                                                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐            │
│  │ stackweaver-api │ │ stackweaver-    │ │ stackweaver-runner  │            │
│  │ (private)       │ │ frontend        │ │ (public)            │            │
│  │                 │ │ (private)       │ │                     │            │
│  │ → GHCR private  │ │ → GHCR private  │ │ → GHCR public      │            │
│  └─────────────────┘ └─────────────────┘ └─────────────────────┘            │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐            │
│  │ stackweaver-    │ │ stackweaver-    │ │ stackweaver-ansible │            │
│  │ orchestrator    │ │ zitadel-init    │ │ -runner (public)    │            │
│  │ (private)       │ │ (private)       │ │                     │            │
│  │ → GHCR private  │ │ → GHCR private  │ │ → GHCR public      │            │
│  └─────────────────┘ └─────────────────┘ └─────────────────────┘            │
│  ┌─────────────────┐                                                         │
│  │ stackweaver-    │                                                         │
│  │ helm (public)   │                                                         │
│  │ → GHCR OCI      │                                                         │
│  └─────────────────┘                                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Part 1: Sync Workflows (Monorepo → Satellite Repos)

The monorepo contains one sync workflow per component. Each triggers only when the relevant source files change on `main`.

### Sync workflow pattern

Every sync workflow follows the same structure:

1. Checkout monorepo
2. Checkout satellite repo (using `SATELLITE_REPO_TOKEN` PAT)
3. Copy source files from monorepo to satellite repo
4. Apply any necessary transformations (e.g., `sed` for package names)
5. Commit with original commit message preserved (for GitVersion to parse)
6. Push to satellite repo

### Commit message forwarding

The sync workflow **preserves the original conventional commit message** so that GitVersion in the satellite repo can compute the correct version bump:

```bash
ORIGINAL_MSG=$(cd ../monorepo && git log -1 --pretty=format:"%s")
git commit -m "${ORIGINAL_MSG}"
```

This way if the monorepo commit is `feat(runner): add retry logic`, the satellite repo receives that same message and GitVersion bumps the minor version.

### Workflow: `.github/workflows/sync-api.yml`

```yaml
name: Sync API

on:
  push:
    branches: [main]
    paths:
      - 'backend/cmd/api/**'
      - 'backend/internal/**'
      - 'backend/pkg/**'
      - 'backend/config/**'
      - 'backend/go.mod'
      - 'backend/go.sum'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout monorepo
        uses: actions/checkout@v6
        with:
          path: monorepo

      - name: Checkout satellite repo
        uses: actions/checkout@v6
        with:
          repository: vhco-pro/stackweaver-api
          token: ${{ secrets.SATELLITE_REPO_TOKEN }}
          path: satellite

      - name: Sync source code
        run: |
          # Sync entire backend (API shares internal/ with orchestrator/runners)
          rsync -av --delete \
            --exclude='.git' \
            --exclude='.github' \
            --exclude='gitversion.yml' \
            --exclude='LICENSE' \
            --exclude='README.md' \
            monorepo/backend/ satellite/backend/
          
          # Sync backend config
          rsync -av monorepo/backend/config/ satellite/backend/config/

      - name: Commit and push
        working-directory: satellite
        run: |
          git config user.name "stackweaver-bot"
          git config user.email "bot@stackweaver.io"
          git add -A
          if git diff --staged --quiet; then
            echo "No changes to commit"
          else
            ORIGINAL_MSG=$(cd ../monorepo && git log -1 --pretty=format:"%s")
            git commit -m "${ORIGINAL_MSG}"
            git push
          fi
```

### Workflow: `.github/workflows/sync-frontend.yml`

```yaml
name: Sync Frontend

on:
  push:
    branches: [main]
    paths:
      - 'frontend/**'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout monorepo
        uses: actions/checkout@v6
        with:
          path: monorepo

      - name: Checkout satellite repo
        uses: actions/checkout@v6
        with:
          repository: vhco-pro/stackweaver-frontend
          token: ${{ secrets.SATELLITE_REPO_TOKEN }}
          path: satellite

      - name: Sync source code
        run: |
          rsync -av --delete \
            --exclude='.git' \
            --exclude='.github' \
            --exclude='gitversion.yml' \
            --exclude='LICENSE' \
            --exclude='README.md' \
            --exclude='node_modules' \
            monorepo/frontend/ satellite/

      - name: Commit and push
        working-directory: satellite
        run: |
          git config user.name "stackweaver-bot"
          git config user.email "bot@stackweaver.io"
          git add -A
          if git diff --staged --quiet; then
            echo "No changes to commit"
          else
            ORIGINAL_MSG=$(cd ../monorepo && git log -1 --pretty=format:"%s")
            git commit -m "${ORIGINAL_MSG}"
            git push
          fi
```

### Workflow: `.github/workflows/sync-orchestrator.yml`

Same pattern as API — syncs `backend/` since orchestrator shares the same Go module. The satellite repo's `Dockerfile` determines which binary to build (`cmd/orchestrator`).

### Workflow: `.github/workflows/sync-runner.yml`

```yaml
name: Sync Terraform Runner

on:
  push:
    branches: [main]
    paths:
      - 'backend/cmd/runner/**'
      - 'backend/internal/**'
      - 'backend/pkg/**'
      - 'backend/go.mod'
      - 'backend/go.sum'
      - 'runner-images/terraform/**'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout monorepo
        uses: actions/checkout@v6
        with:
          path: monorepo

      - name: Checkout satellite repo
        uses: actions/checkout@v6
        with:
          repository: vhco-pro/stackweaver-runner
          token: ${{ secrets.SATELLITE_REPO_TOKEN }}
          path: satellite

      - name: Sync source code
        run: |
          # Sync backend source
          rsync -av --delete \
            --exclude='.git' \
            --exclude='.github' \
            --exclude='gitversion.yml' \
            --exclude='LICENSE' \
            --exclude='README.md' \
            monorepo/backend/ satellite/backend/

          # Sync Dockerfile
          cp monorepo/runner-images/terraform/Dockerfile satellite/Dockerfile

      - name: Commit and push
        working-directory: satellite
        run: |
          git config user.name "stackweaver-bot"
          git config user.email "bot@stackweaver.io"
          git add -A
          if git diff --staged --quiet; then
            echo "No changes to commit"
          else
            ORIGINAL_MSG=$(cd ../monorepo && git log -1 --pretty=format:"%s")
            git commit -m "${ORIGINAL_MSG}"
            git push
          fi
```

### Workflow: `.github/workflows/sync-ansible-runner.yml`

Same pattern as Terraform runner, but syncs `runner-images/ansible/Dockerfile` and includes the `scripts/oidc-ansible-inventory` wrapper.

### Workflow: `.github/workflows/sync-zitadel-init.yml`

Syncs `scripts/zitadel-init/` directory to the satellite repo.

### Workflow: `.github/workflows/sync-helm.yml`

```yaml
name: Sync Helm Chart

on:
  push:
    branches: [main]
    paths:
      - 'deploy/helm/**'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout monorepo
        uses: actions/checkout@v6
        with:
          path: monorepo

      - name: Checkout satellite repo
        uses: actions/checkout@v6
        with:
          repository: vhco-pro/stackweaver-helm
          token: ${{ secrets.SATELLITE_REPO_TOKEN }}
          path: satellite

      - name: Sync chart
        run: |
          rsync -av --delete \
            --exclude='.git' \
            --exclude='.github' \
            --exclude='gitversion.yml' \
            --exclude='LICENSE' \
            --exclude='README.md' \
            monorepo/deploy/helm/stackweaver/ satellite/chart/

      - name: Commit and push
        working-directory: satellite
        run: |
          git config user.name "stackweaver-bot"
          git config user.email "bot@stackweaver.io"
          git add -A
          if git diff --staged --quiet; then
            echo "No changes to commit"
          else
            ORIGINAL_MSG=$(cd ../monorepo && git log -1 --pretty=format:"%s")
            git commit -m "${ORIGINAL_MSG}"
            git push
          fi
```

### Shared path concern: API / Orchestrator / Runners share `backend/internal/`

The Go components all live in the same Go module (`backend/`). Changes to `backend/internal/` could affect any of them. The sync workflows handle this by syncing the **entire `backend/` directory** to satellite repos that build Go binaries. Each satellite repo's Dockerfile controls which `cmd/` entry point is built.

This means a change to `backend/internal/models/user.go` will trigger syncs to all Go satellite repos (API, orchestrator, runner, ansible-runner). GitVersion in each satellite will compute a version bump based on the commit message. This is correct behavior — a shared dependency change _should_ produce new builds of all consumers.

## Part 2: Satellite Repo Structure

### Common CI/CD (same in every satellite repo)

Each satellite repo contains these files that are **not synced** (maintained directly in the satellite repo during initial setup):

```
.github/
  workflows/
    tag.yml             # GitVersion → git tag on push to main
    release.yml         # On tag → docker-release-action → GHCR
gitversion.yml          # Independent version config
LICENSE                 # BSL 1.1 or Apache 2.0
README.md               # Component-specific docs
```

### `tag.yml` (shared across all satellite repos)

```yaml
name: GitVersion Tag

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  tag:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - uses: vhco-pro/gitversion-tag-action@main
        with:
          configFilePath: 'gitversion.yml'
```

### `release.yml` for Docker components

```yaml
name: Release

on:
  push:
    tags:
      - '*.*.*'

permissions:
  contents: read
  packages: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Build and push
        uses: michielvha/docker-release-action@main
        with:
          version: ${{ github.ref_name }}
          registry: ghcr.io
          username: vhco-pro
          password: ${{ secrets.GITHUB_TOKEN }}
          project: stackweaver-api  # varies per repo
          platforms: linux/amd64,linux/arm64
          context: .

  bump-helm:
    needs: release
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          repository: vhco-pro/stackweaver
          token: ${{ secrets.RELEASE_TOKEN }}

      - name: Update image tag in values.yaml
        run: yq -i '.api.image.tag = "${{ github.ref_name }}"' deploy/helm/stackweaver/values.yaml

      - name: Commit and push
        run: |
          git config user.name "stackweaver-bot"
          git config user.email "bot@stackweaver.io"
          git add -A
          if git diff --staged --quiet; then
            echo "No changes to commit"
          else
            git commit -m "fix(api): bump api image to ${{ github.ref_name }}"
            git pull --rebase origin main
            git push
          fi
```

### `release.yml` for Helm chart repo

```yaml
name: Release Helm Chart

on:
  push:
    tags:
      - '*.*.*'

permissions:
  contents: read
  packages: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Install Helm
        uses: azure/setup-helm@v4

      - name: Login to GHCR
        run: echo "${{ secrets.GITHUB_TOKEN }}" | helm registry login ghcr.io -u ${{ github.actor }} --password-stdin

      - name: Package chart
        run: |
          # Set chart version from tag
          sed -i "s/^version:.*/version: ${{ github.ref_name }}/" chart/Chart.yaml
          sed -i "s/^appVersion:.*/appVersion: \"${{ github.ref_name }}\"/" chart/Chart.yaml
          helm package chart/

      - name: Push to GHCR
        run: helm push stackweaver-${{ github.ref_name }}.tgz oci://ghcr.io/vhco-pro/charts
```

Users install with: `helm install stackweaver oci://ghcr.io/vhco-pro/charts/stackweaver --version 1.0.0`

### `gitversion.yml` (shared across all satellite repos)

```yaml
workflow: GitHubFlow/v1
next-version: 0.0.0
tag-prefix: ''
semantic-version-format: Loose

major-version-bump-message: '(BREAKING CHANGE|^.+!:)'
minor-version-bump-message: '^feat(\([^)]+\))?:\s'
patch-version-bump-message: '^(fix|enhancement|perf|refactor|revert)(\([^)]+\))?:\s'
no-bump-message: '^(chore|docs|style|test|ci)(\([^)]+\))?:\s'
commit-message-incrementing: Enabled

strategies:
  - Fallback
  - MergeMessage
  - TaggedCommit
  - TrackReleaseBranches
  - VersionInBranchName

branches:
  main:
    regex: ^master$|^main$
    increment: Patch
    prevent-increment:
      of-merged-branch: true
    is-main-branch: true
    mode: ContinuousDeployment
```

### Satellite repo structures

#### `stackweaver-api` (private)

```
stackweaver-api/
├── .github/workflows/{tag.yml, release.yml}
├── gitversion.yml
├── LICENSE                     # BSL 1.1
├── README.md
├── Dockerfile                  # Production multi-stage build for cmd/api
└── backend/                    # Synced from monorepo
    ├── go.mod
    ├── go.sum
    ├── cmd/api/
    ├── internal/
    ├── pkg/
    └── config/
```

#### `stackweaver-frontend` (private)

```
stackweaver-frontend/
├── .github/workflows/{tag.yml, release.yml}
├── gitversion.yml
├── LICENSE                     # BSL 1.1
├── README.md
├── Dockerfile                  # Multi-stage: npm build → nginx:alpine
├── package.json                # Synced from monorepo frontend/
├── src/                        # Synced
├── public/                     # Synced
└── ...                         # All frontend/ contents synced
```

#### `stackweaver-orchestrator` (private)

```
stackweaver-orchestrator/
├── .github/workflows/{tag.yml, release.yml}
├── gitversion.yml
├── LICENSE                     # BSL 1.1
├── README.md
├── Dockerfile                  # Production multi-stage build for cmd/orchestrator
└── backend/                    # Synced from monorepo
    ├── go.mod
    ├── go.sum
    ├── cmd/orchestrator/
    ├── internal/
    └── pkg/
```

#### `stackweaver-runner` (public)

```
stackweaver-runner/
├── .github/workflows/{tag.yml, release.yml}
├── gitversion.yml
├── LICENSE                     # Apache 2.0
├── README.md
├── Dockerfile                  # Synced from runner-images/terraform/Dockerfile
└── backend/                    # Synced from monorepo
    ├── go.mod
    ├── go.sum
    ├── cmd/runner/
    ├── internal/
    └── pkg/
```

#### `stackweaver-ansible-runner` (public)

```
stackweaver-ansible-runner/
├── .github/workflows/{tag.yml, release.yml}
├── gitversion.yml
├── LICENSE                     # Apache 2.0
├── README.md
├── Dockerfile                  # Synced from runner-images/ansible/Dockerfile
├── scripts/
│   └── oidc-ansible-inventory  # Synced from backend/scripts/
└── backend/                    # Synced from monorepo
    ├── go.mod
    ├── go.sum
    ├── cmd/ansible-runner/
    ├── internal/
    └── pkg/
```

#### `stackweaver-zitadel-init` (private)

```
stackweaver-zitadel-init/
├── .github/workflows/{tag.yml, release.yml}
├── gitversion.yml
├── LICENSE                     # BSL 1.1
├── README.md
├── Dockerfile                  # Synced from scripts/zitadel-init/Dockerfile
└── ...                         # Contents of scripts/zitadel-init/
```

#### `stackweaver-helm` (public)

```
stackweaver-helm/
├── .github/workflows/{tag.yml, release.yml}
├── gitversion.yml
├── LICENSE                     # BSL 1.1
├── README.md
└── chart/                      # Synced from deploy/helm/stackweaver/
    ├── Chart.yaml
    ├── values.yaml
    └── templates/
```

## Part 3: Production Dockerfiles

Each satellite repo needs a production Dockerfile. The current `Dockerfile.dev` files are for local development only.

### Go backend components (API, Orchestrator)

Production Dockerfile pattern for Go services. Each repo has its own copy with the correct `CMD_PATH`:

```dockerfile
FROM golang:1.25-alpine AS builder

ARG IMAGE_NAME
ARG TARGETARCH
ARG TARGETOS=linux
ARG CMD_PATH=./cmd/api  # or ./cmd/orchestrator

WORKDIR /build
COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ .
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -o ${IMAGE_NAME} ${CMD_PATH}

FROM alpine:3.23

ARG IMAGE_NAME
ENV IMAGE_NAME=${IMAGE_NAME}

RUN apk add --no-cache ca-certificates wget git
RUN addgroup -g 1001 ${IMAGE_NAME} && \
    adduser -D -u 1001 -G ${IMAGE_NAME} ${IMAGE_NAME}

COPY --from=builder /build/${IMAGE_NAME} /usr/local/bin/${IMAGE_NAME}
RUN chmod +x /usr/local/bin/${IMAGE_NAME}

USER ${IMAGE_NAME}
WORKDIR /home/${IMAGE_NAME}

LABEL org.opencontainers.image.source="https://github.com/vhco-pro/${IMAGE_NAME}"
LABEL org.opencontainers.image.licenses="BUSL-1.1"

ENTRYPOINT ["/bin/sh", "-c", "/usr/local/bin/${IMAGE_NAME}"]
```

### Frontend

```dockerfile
FROM node:24-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

LABEL org.opencontainers.image.source="https://github.com/vhco-pro/stackweaver-frontend"
LABEL org.opencontainers.image.licenses="BUSL-1.1"

EXPOSE 80
```

### Runner Dockerfiles

The existing `runner-images/terraform/Dockerfile` and `runner-images/ansible/Dockerfile` are already production-grade multi-stage builds. They are synced directly to the satellite repos.

## Part 4: Production Compose File

For end-users deploying Stackweaver, create `deploy/docker-compose.prod.yml` that pulls pre-built images from GHCR:

```yaml
# deploy/docker-compose.prod.yml
services:
  api:
    image: ghcr.io/vhco-pro/stackweaver-api:latest
    # ... same env/volumes/depends_on as current docker-compose.yml
    # but no build: section

  frontend:
    image: ghcr.io/vhco-pro/stackweaver-frontend:latest

  orchestrator:
    image: ghcr.io/vhco-pro/stackweaver-orchestrator:latest

  runner:
    image: ghcr.io/vhco-pro/stackweaver-runner:latest

  ansible-runner:
    image: ghcr.io/vhco-pro/stackweaver-ansible-runner:latest

  zitadel-init:
    image: ghcr.io/vhco-pro/stackweaver-zitadel-init:latest

  # Third-party services unchanged
  postgres:
    image: postgres:17
  redis:
    image: redis:7-alpine
  minio:
    image: minio/minio:latest
  zitadel:
    image: ghcr.io/zitadel/zitadel:latest
  login-ui:
    image: ghcr.io/zitadel/zitadel-login:v4.11.1
```

Users authenticate to GHCR once for private images:

```bash
echo $GHCR_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
docker compose -f deploy/docker-compose.prod.yml up -d
```

## Part 5: Required Secrets

### Monorepo secrets (GitHub Actions)

| Secret | Purpose | Used by |
|--------|---------|---------|
| `SATELLITE_REPO_TOKEN` | PAT with push access to all satellite repos | All `sync-*.yml` workflows |

A single fine-grained PAT with `contents: write` permission scoped to all 7 satellite repos is sufficient.

### Satellite repo secrets (GitHub Actions)

| Secret | Purpose |
|--------|---------|
| `GITHUB_TOKEN` | Built-in, pushes to GHCR |
| `RELEASE_TOKEN` | PAT that pushes tags (triggers release.yml) and pushes helm chart bumps to monorepo |

The `RELEASE_TOKEN` is needed because the default `GITHUB_TOKEN` does not trigger downstream workflows when pushing tags or commits. A PAT scoped with `contents: write` on all satellite repos and the monorepo is sufficient. Set this as an org-level secret for convenience.

## Part 6: `docker-release-action` Compatibility

### Current state

- `registry` input accepts any OCI-compliant registry — `ghcr.io` works.
- `username`/`password` map to `github.actor`/`GITHUB_TOKEN` for GHCR.
- The action passes `IMAGE_NAME` as a build arg to the Dockerfile.

### Items to verify or update

1. **GHCR namespacing**: GHCR images are scoped to the user/org, e.g., `ghcr.io/vhco-pro/stackweaver-api`. Verify how the action constructs the full image reference from `registry` + `project`. If it prepends `username/`, then `project` should be just `stackweaver-api`. If not, `project` needs to be `vhco-pro/stackweaver-api`.
2. **OCI labels**: The action should pass `org.opencontainers.image.source` label so GHCR can link the package to the repository automatically.
3. **End-to-end test**: Push a test build to GHCR from a satellite repo to validate the full flow.

## Part 7: Version Flow (End-to-End Example)

```
Developer pushes to monorepo:
  commit: "feat(api): add webhook retry logic"
      │
      ▼
Monorepo CI runs (lint, test)
      │
      ▼
sync-api.yml triggers (path match: backend/cmd/api/**)
      │
      ├──► stackweaver-api satellite repo receives commit:
      │    "feat(api): add webhook retry logic"
      │         │
      │         ▼
      │    tag.yml: GitVersion computes 1.3.7 → 1.4.0 (minor bump for feat:)
      │         │
      │         ▼
      │    release.yml: docker-release-action builds & pushes
      │    ghcr.io/vhco-pro/stackweaver-api:1.4.0
      │    ghcr.io/vhco-pro/stackweaver-api:latest
      │         │
      │         ▼
      │    bump-helm job: pushes to monorepo (deploy/helm/stackweaver/values.yaml)
      │    commit: "fix(api): bump api image to 1.4.0"
      │         │
      │         ▼
      │    monorepo sync-helm.yml triggers (path match: deploy/helm/**)
      │    syncs updated values.yaml to stackweaver-helm satellite
      │         │
      │         ▼
      │    stackweaver-helm tag.yml: GitVersion → 0.3.1 (patch bump for fix:)
      │         │
      │         ▼
      │    stackweaver-helm release.yml: helm push
      │    oci://ghcr.io/vhco-pro/charts/stackweaver:0.3.1
      │
      ├──► sync-orchestrator.yml also triggers (backend/internal/** changed)
      │    Same commit message → orchestrator also gets 1.4.0 bump
      │    → bump-helm → another helm chart patch release
      │
      └──► sync-runner.yml also triggers (backend/internal/** changed)
           Same commit message → runner also gets version bump
           → bump-helm → another helm chart patch release
```

Note: because Go components share `backend/internal/`, a change there triggers all Go satellites. This is intentional — shared code changes should rebuild all consumers. Each helm bump produces a separate chart release, which is fine — users pin to a specific chart version.

## Implementation Order

### Phase 1: Prerequisites
1. Publish `logger` to `github.com/vhco-pro/logger`, tag release, remove `replace` directive from `backend/go.mod`.
2. Verify `docker-release-action` works with `ghcr.io` registry and GHCR namespacing.
3. Create production Dockerfiles for API, orchestrator, and frontend.

### Phase 2: Create satellite repos (skeleton setup)
4. Create all 7 satellite repos on GitHub with:
   - `gitversion.yml`
   - `.github/workflows/tag.yml`
   - `.github/workflows/release.yml`
   - `LICENSE` (BSL 1.1 or Apache 2.0)
   - `README.md`
5. Create a fine-grained PAT (`SATELLITE_REPO_TOKEN`) with push access to all satellite repos.
6. Add `SATELLITE_REPO_TOKEN` as a secret in the monorepo.

### Phase 3: Sync workflows
7. Create all `sync-*.yml` workflows in the monorepo (7 total).
8. Run `workflow_dispatch` on each to do an initial sync.
9. Verify each satellite repo receives the code and `tag.yml` produces a version tag.

### Phase 4: Release pipeline validation  
10. Verify `release.yml` in each satellite repo builds and pushes to GHCR.
11. Set package visibility (private for platform components, public for runners + helm).
12. Configure access for private packages.

### Phase 5: Distribution
13. Create `deploy/docker-compose.prod.yml` referencing GHCR images.
14. Write user-facing documentation for GHCR authentication and deployment.
15. Write Helm chart installation guide.

## Part 8: Automated Helm Chart Bumping

When a satellite repo releases a new container image, it must automatically update the corresponding image tag in the Helm chart's `values.yaml` and push the change, triggering a new Helm chart release. This creates a fully automated release chain.

### How it works

Each satellite's `release.yml` includes a `bump-helm` job that runs after the Docker image build succeeds:

1. Checks out the **monorepo** (`vhco-pro/stackweaver`) using `RELEASE_TOKEN` PAT.
2. Uses `yq` to update the image tag in `deploy/helm/stackweaver/values.yaml` for the corresponding component.
3. Commits with `fix(<component>): bump <component> image to <version>`.
4. Pushes to the monorepo main branch.
5. The push changes `deploy/helm/**`, which triggers `sync-helm.yml` in the monorepo.
6. `sync-helm.yml` syncs the updated `values.yaml` to `stackweaver-helm` satellite repo.
7. The sync commit triggers `tag.yml` in `stackweaver-helm` → GitVersion computes new chart version → new tag → `release.yml` packages and pushes the OCI chart to GHCR.

This ensures the monorepo remains the single source of truth for the Helm chart. Direct pushes to the satellite helm repo would be overwritten by the next sync.

### yq update paths per component

| Satellite | yq path | Commit message |
|-----------|---------|----------------|
| `stackweaver-api` | `.api.image.tag` | `fix(api): bump api image to X.Y.Z` |
| `stackweaver-frontend` | `.frontend.image.tag` | `fix(frontend): bump frontend image to X.Y.Z` |
| `stackweaver-orchestrator` | `.orchestrator.image.tag` | `fix(orchestrator): bump orchestrator image to X.Y.Z` |
| `stackweaver-runner` | `.runner.image.tag` | `fix(runner): bump runner image to X.Y.Z` |
| `stackweaver-ansible-runner` | `.ansibleRunner.image.tag` | `fix(ansible-runner): bump ansible-runner image to X.Y.Z` |
| `stackweaver-zitadel-init` | `.zitadel.init.image.tag` | `fix(zitadel-init): bump zitadel-init image to X.Y.Z` |

### Concurrent bump protection

When Go backend changes trigger multiple satellite builds simultaneously (API, orchestrator, runner, ansible-runner), each will try to push to the monorepo at roughly the same time. Git's push semantics provide natural serialization — only the first push succeeds, subsequent pushes fail due to non-fast-forward. The `bump-helm` job handles this by pulling before pushing:

```yaml
git pull --rebase origin main
git push
```

### Required secret

Each satellite repo needs a `RELEASE_TOKEN` secret — a PAT with `contents: write` scope on the monorepo (`vhco-pro/stackweaver`). This can be the same PAT used for the tag workflow (set at org level).

## Part 9: Helm Chart Template Organization

Helm recursively scans all `.yaml`, `.yml`, and `.tpl` files in the `templates/` directory, including subdirectories. The chart uses subdirectories to group templates by service for maintainability:

```
chart/templates/
├── _helpers.tpl              # Shared template helpers
├── NOTES.txt                 # Post-install notes
├── api/                      # API service
│   ├── api-deployment.yaml
│   └── api-service.yaml
├── frontend/                 # Frontend SPA
│   ├── configmap-frontend.yaml
│   ├── frontend-deployment.yaml
│   └── frontend-service.yaml
├── orchestrator/             # Job scheduler
│   └── orchestrator-deployment.yaml
├── runner/                   # Terraform runner
│   ├── pvc-runner-workspaces.yaml
│   └── runner-deployment.yaml
├── ansible-runner/           # Ansible runner
│   └── ansible-runner-deployment.yaml
├── zitadel/                  # Zitadel OIDC + Login UI
│   ├── configmap-zitadel.yaml
│   ├── login-ui-deployment.yaml
│   ├── login-ui-service.yaml
│   ├── pvc-zitadel-pat.yaml
│   ├── zitadel-deployment.yaml
│   ├── zitadel-init-job.yaml
│   └── zitadel-service.yaml
├── minio/                    # Object storage
│   ├── minio-init-job.yaml
│   ├── minio-service.yaml
│   └── minio-statefulset.yaml
├── postgresql/               # Database
│   ├── postgresql-service.yaml
│   └── postgresql-statefulset.yaml
├── redis/                    # Cache / queue
│   ├── redis-deployment.yaml
│   └── redis-service.yaml
└── shared/                   # Cross-cutting resources
    ├── ingress.yaml
    ├── secrets-autogenerated.yaml
    └── serviceaccount.yaml
```

## Considerations

### Trade-offs of this approach

**Pros:**
- Clean independent versioning per component — no phantom version bumps.
- GitVersion works naturally without hacks or path-scoped workarounds.
- Open-source repos contain full source — users can audit, build, and contribute.
- Each component can have different release cadences.
- GHCR handles all distribution — no self-hosted infrastructure.

**Cons:**
- 7 satellite repos to create and maintain (one-time setup, then automated).
- Shared `backend/internal/` changes trigger syncs to all Go satellites (correct but noisy).
- PAT management — one token needs access to all satellite repos.
- Sync workflows add a few minutes of latency between monorepo commit and satellite build.

### Reducing sync noise for shared code

If `backend/internal/` changes too frequently and creates too many satellite builds, consider:
1. Accepting it (builds are cheap and fast on GitHub Actions).
2. Adding a `[skip-sync]` commit message convention that sync workflows check for.
3. Splitting `backend/internal/` into sub-packages and fine-tuning path filters (complex, not recommended initially).

### Future: organization namespace

Currently using `vhco-pro/` as the GHCR namespace. If Stackweaver moves to a GitHub organization (e.g., `stackweaver/`), all image references and PATs would need to be updated. The Helm chart already references `ghcr.io/stackweaver/` in `values.yaml` — decide on the final namespace before first release.
