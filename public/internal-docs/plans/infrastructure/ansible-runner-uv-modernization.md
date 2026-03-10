<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Ansible Runner Image: UV Modernization Plan

**Issue:** [michielvha/stackweaver#74](https://github.com/michielvha/stackweaver/issues/74)
**Status:** Phase 1 & 2 Complete — Tested ✅
**Date:** 2026-03-01
**Last Updated:** 2026-03-09

## Summary

Replace `pip` with [uv](https://github.com/astral-sh/uv) in the Ansible runner image for faster builds, reproducible installs, and a modern Python toolchain. Also introduce a lockfile (`uv.lock`) and a `pyproject.toml` to manage Python dependencies declaratively.

## Current State

The Ansible runner Dockerfile (`runner-images/ansible/Dockerfile`) uses `python:3.14-slim` as the runtime base and installs all Python packages with `pip install --no-cache-dir` in a single `RUN` layer:

```dockerfile
RUN pip install --no-cache-dir \
    ansible \
    ansible-lint \
    jmespath netaddr boto3 \
    azure-identity azure-mgmt-resource azure-mgmt-compute \
    azure-mgmt-network azure-mgmt-subscription azure-cli-core \
    google-auth pyvmomi
```

### Problems with the Current Approach

1. **No version pinning** — every build can pull different transitive dependency versions, leading to non-reproducible images.
2. **Slow builds** — `pip` resolves dependencies from scratch; no caching across builds.
3. **No lockfile** — there is no `requirements.txt` or equivalent lockfile, so dependency resolution is implicit.
4. **Large image** — all packages are installed system-wide with no virtual-environment isolation.
5. **No dependency groups** — cloud-provider SDKs (AWS, Azure, GCP, VMware) are always installed even when a user only needs one.

## Proposed Changes

### Phase 1: Replace pip with uv and add pyproject.toml (Core)

#### 1.1 Create `runner-images/ansible/pyproject.toml`

Define all Python dependencies declaratively using PEP 621 metadata. Use uv's dependency groups for optional cloud-provider packages:

```toml
[project]
name = "stackweaver-ansible-runner"
version = "0.1.0"
requires-python = ">=3.12"
description = "Python dependencies for the Stackweaver Ansible runner image"

dependencies = [
    "ansible>=11.0,<13",
    "ansible-lint>=25.0",
    "jmespath>=1.0",
    "netaddr>=1.0",
]

[dependency-groups]
aws = [
    "boto3>=1.35",
    "botocore>=1.35",
]

azure = [
    "azure-identity>=1.19",
    "azure-mgmt-resource>=23.0",
    "azure-mgmt-compute>=33.0",
    "azure-mgmt-network>=27.0",
    "azure-mgmt-subscription>=3.0",
    "azure-cli-core>=2.60",
]

gcp = [
    "google-auth>=2.30",
]

vmware = [
    "pyvmomi>=8.0",
]

# Convenience group: install everything (default for official image)
all = [
    { include-group = "aws" },
    { include-group = "azure" },
    { include-group = "gcp" },
    { include-group = "vmware" },
]
```

#### 1.2 Generate `runner-images/ansible/uv.lock`

Run `uv lock` to produce a cross-platform lockfile pinning every transitive dependency. This file is committed to the repo and ensures reproducible builds.

```bash
cd runner-images/ansible
uv lock
```

#### 1.3 Rewrite the Dockerfile to use uv

```dockerfile
# Ansible Runner Dockerfile
# This builds the Ansible runner that executes Ansible playbooks
# NOTE: This Dockerfile must be built with context set to the repository root
# Example: docker build -f runner-images/ansible/Dockerfile -t ansible-runner .

# ── Build stage: compile the Go binary ──────────────────────────────
FROM golang:1.25.7-alpine AS builder

WORKDIR /app
RUN apk add --no-cache git

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o ansible-runner ./cmd/ansible-runner

# ── Runtime stage: Python + Ansible via uv ──────────────────────────
FROM python:3.13-slim

# Install uv (standalone installer — no pip required at runtime)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# System packages required by Ansible modules / connections
RUN apt-get update && apt-get install -y --no-install-recommends \
        openssh-client git sshpass ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifest and lockfile
WORKDIR /opt/ansible-deps
COPY runner-images/ansible/pyproject.toml runner-images/ansible/uv.lock ./

# Install Python dependencies from the lockfile
# --group all installs every cloud-provider SDK;
# users building custom images can replace with --group aws, --group azure, etc.
RUN uv sync --frozen --group all --no-dev --no-install-project

# Install Ansible Galaxy collections
RUN uv run ansible-galaxy collection install \
        amazon.aws \
        azure.azcollection \
        google.cloud \
        community.vmware \
        community.general \
        ansible.posix \
        ansible.netcommon

# Copy the Go binary from the builder stage
COPY --from=builder /app/ansible-runner /usr/local/bin/ansible-runner

# Copy the OIDC-aware ansible-inventory wrapper
COPY backend/scripts/oidc-ansible-inventory /usr/local/bin/oidc-ansible-inventory
RUN chmod +x /usr/local/bin/oidc-ansible-inventory

# Create non-root user with UID 1001 to match terraform runner (shared volume)
RUN useradd -m -u 1001 iac
USER iac

# Working directories
RUN mkdir -p /home/iac/workspaces/ansible-sync \
             /home/iac/workspaces/ansible-jobs \
             /home/iac/galaxy-cache/collections \
             /home/iac/galaxy-cache/roles

WORKDIR /home/iac

# Environment
ENV WORKSPACES_DIR=/home/iac/workspaces
ENV ANSIBLE_HOST_KEY_CHECKING=false
ENV ANSIBLE_RETRY_FILES_ENABLED=false
# Make the uv-managed venv available to ansible commands invoked by the Go binary
ENV VIRTUAL_ENV=/opt/ansible-deps/.venv
ENV PATH="/opt/ansible-deps/.venv/bin:$PATH"

CMD ["/usr/local/bin/ansible-runner"]
```

**Key changes:**
- `uv` is copied from its official OCI image (`ghcr.io/astral-sh/uv:latest`) — no pip required.
- `uv sync --frozen` installs from the lockfile deterministically.
- Dependency groups let users build leaner images (e.g., `--group aws` only).
- `python:3.13-slim` chosen as current stable; `3.14` is still pre-release.
- Build context changes to repo root so we can `COPY` both `backend/` and `runner-images/`.

#### 1.4 Update docker-compose build context

In `deploy/docker-compose.yml`, the ansible-runner service currently has:

```yaml
ansible-runner:
  build:
    context: ../backend
    dockerfile: ../runner-images/ansible/Dockerfile
```

Update to:

```yaml
ansible-runner:
  build:
    context: ..
    dockerfile: runner-images/ansible/Dockerfile
```

Since the Dockerfile now copies from both `backend/` and `runner-images/`, the build context must be the repo root.

### Phase 2: Ansible Galaxy Collection Pinning

#### 2.1 Create `runner-images/ansible/requirements.yml`

Pin Ansible Galaxy collections for reproducibility:

```yaml
---
collections:
  - name: amazon.aws
    version: ">=9.0.0"
  - name: azure.azcollection
    version: ">=3.0.0"
  - name: google.cloud
    version: ">=1.4.0"
  - name: community.vmware
    version: ">=5.0.0"
  - name: community.general
    version: ">=10.0.0"
  - name: ansible.posix
    version: ">=2.0.0"
  - name: ansible.netcommon
    version: ">=7.0.0"
```

Update the Dockerfile to use this file:

```dockerfile
COPY runner-images/ansible/requirements.yml ./
RUN uv run ansible-galaxy collection install -r requirements.yml
```

### Phase 3: Image Size Optimization

#### 3.1 Multi-stage Python install

Consider a multi-stage approach where `uv sync` runs in a builder stage and only the resulting `.venv` is copied to the final image, avoiding uv and build caches in the runtime layer:

```dockerfile
FROM python:3.13-slim AS python-deps
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/
WORKDIR /opt/ansible-deps
COPY runner-images/ansible/pyproject.toml runner-images/ansible/uv.lock ./
RUN uv sync --frozen --group all --no-dev --no-install-project

FROM python:3.13-slim
COPY --from=python-deps /opt/ansible-deps/.venv /opt/ansible-deps/.venv
ENV PATH="/opt/ansible-deps/.venv/bin:$PATH"
# ... rest of runtime setup
```

#### 3.2 .dockerignore

Add a `runner-images/ansible/.dockerignore` or update the root `.dockerignore` to exclude unnecessary files from the build context (docs, frontend, tests, etc.).

### Phase 4: CI Integration

#### 4.1 Lockfile freshness check

Add a CI step that runs `uv lock --check` to ensure the lockfile stays in sync with `pyproject.toml`. This fails if someone adds a dependency but forgets to regenerate the lockfile.

#### 4.2 Image build test

Add a CI job that builds the ansible runner image on every PR that touches `runner-images/ansible/**` or `backend/cmd/ansible-runner/**`.

## Implementation Checklist

- [x] Create `runner-images/ansible/pyproject.toml` with dependency groups
- [x] Generate `runner-images/ansible/uv.lock` with `uv lock`
- [x] Create `runner-images/ansible/requirements.yml` for Galaxy collection pinning
- [x] Rewrite `runner-images/ansible/Dockerfile` to use uv
- [x] Update `deploy/docker-compose.yml` build context for ansible-runner
- [ ] Update `Makefile` if there are any ansible-runner build targets
- [x] Test the image builds and runs correctly locally
- [ ] Verify OIDC azure inventory wrapper still works with uv-managed venv
- [x] Verify agent mode works with the new image
- [ ] Add `.dockerignore` rules to minimize build context
- [ ] Add CI step for `uv lock --check`
- [ ] Add CI step for image build test
- [ ] Update `docs/internal/overviews/ansible-runner-overview.md` to reflect the new setup

## Test Results (2026-03-09)

Image built and tested locally against `https://stackweaver.vhco.pro`:

```
{"level":"INFO","msg":"Starting in agent mode (self-hosted runner)"}
{"level":"INFO","msg":"Runner registered successfully with ID: 51b62914-8ff1-4df7-9f9b-309106096041"}
{"level":"INFO","msg":"Starting heartbeat loop (poll interval: 10s)"}
```

Agent mode works. Runner registers and polls successfully.

**Package audit notes:**
- `python:3.14-slim` used as runtime base (updated from 3.13 per plan; 3.14 is now stable)
- `azure-cli-core>=2.84` requires `msal==1.35.0b1` (pre-release); `[tool.uv] prerelease = "allow"` added to `pyproject.toml` to permit this
- All other packages resolved to latest stable versions (78 packages total)
- Galaxy collections: all already at latest — `ansible-galaxy collection install` reported "Nothing to do"

## Migration Notes

- **Breaking change for custom images:** Users who extend the runner image and rely on pip must switch to uv. The `pyproject.toml` dependency groups make customization simpler, though.
- **PATH setup:** The Go binary launches ansible via `exec.Command`. The `PATH` and `VIRTUAL_ENV` environment variables in the Dockerfile ensure the uv-managed venv is found automatically. No changes to Go code should be needed.
- **oidc-ansible-inventory script:** Runs as `#!/usr/bin/env python3` — the venv's Python will be found first on `PATH`, so the script will inherit the uv-installed packages. No changes needed.
- **Build context change:** The Dockerfile build context moves from `backend/` to the repo root. CI pipelines and `docker-compose.yml` must be updated accordingly.

## References

- [uv documentation](https://docs.astral.sh/uv/)
- [uv Docker guide](https://docs.astral.sh/uv/guides/integration/docker/)
- [PEP 621 — Project metadata](https://peps.python.org/pep-0621/)
- [uv dependency groups](https://docs.astral.sh/uv/concepts/dependency-groups/)
