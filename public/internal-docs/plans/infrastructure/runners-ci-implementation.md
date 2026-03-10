<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Runner CI/CD Implementation Plan

**Status:** ⚠️ Partially complete — verify current state of `stackweaver-runner` and `stackweaver-ansible-runner` satellite repos. Logger package dependency (`github.com/michielvha/logger`) must be resolved before runner satellite CI/CD is fully operational.

This document contains the remaining steps for setting up the open-source runner repository and sync workflow. These steps should be executed after the logger package has been published.

## Prerequisites

- [ ] Logger package published to `github.com/michielvha/logger`
- [ ] Remove the `replace` directive from `backend/go.mod` and run `go get github.com/michielvha/logger@v0.x.x`

## Part 1: Create Open-Source Runner Repository

### Repository Structure

Create a new repository (e.g., `github.com/michielvha/stackweaver-runner`) with:

```
stackweaver-runner/
├── go.mod                          # module github.com/michielvha/stackweaver-runner
├── go.sum
├── gitversion.yml                  # Independent versioning with conventional commits
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Lint/test
│       ├── tag.yml                 # GitVersion tagging
│       └── release.yml             # Docker builds with docker-release-action
├── cmd/
│   ├── stackweaver-runner/
│   │   └── main.go                 # Terraform runner entry point
│   └── stackweaver-ansible-runner/
│       └── main.go                 # Ansible runner entry point
├── internal/
│   ├── terraform/
│   │   └── agent.go                # From backend/cmd/runner/agent_mode.go
│   └── ansible/
│       └── agent.go                # From backend/cmd/ansible-runner/agent_mode.go
├── Dockerfile
├── Dockerfile.ansible
├── LICENSE                         # Apache 2.0
└── README.md
```

### Files to Sync from Monorepo

| Monorepo Source | Runner Repo Target | Lines |
|-----------------|-------------------|-------|
| `backend/cmd/runner/agent_mode.go` | `internal/terraform/agent.go` | ~560 |
| `backend/cmd/ansible-runner/agent_mode.go` | `internal/ansible/agent.go` | ~736 |

**Total**: ~1,300 lines of self-contained code

### Import Path Transformation

The sync process needs to transform:
- `package main` → `package terraform` or `package ansible`
- `github.com/michielvha/logger` stays the same (already correct)
- Export `RunAgentMode` function for use from `cmd/` entry points

## Part 2: GitHub Actions Sync Workflow

Create `.github/workflows/sync-runner.yml` in the stackweaver monorepo:

```yaml
name: Sync Runner to Open Source

on:
  push:
    branches: [main]
    paths:
      - 'backend/cmd/runner/agent_mode.go'
      - 'backend/cmd/ansible-runner/agent_mode.go'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout monorepo
        uses: actions/checkout@v6
        with:
          path: monorepo

      - name: Checkout runner repo
        uses: actions/checkout@v6
        with:
          repository: michielvha/stackweaver-runner
          token: ${{ secrets.RUNNER_REPO_TOKEN }}
          path: runner

      - name: Sync files
        run: |
          # Copy and transform Terraform agent
          cp monorepo/backend/cmd/runner/agent_mode.go runner/internal/terraform/agent.go
          sed -i 's/^package main$/package terraform/' runner/internal/terraform/agent.go
          
          # Copy and transform Ansible agent
          cp monorepo/backend/cmd/ansible-runner/agent_mode.go runner/internal/ansible/agent.go
          sed -i 's/^package main$/package ansible/' runner/internal/ansible/agent.go

      - name: Commit and push
        working-directory: runner
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add -A
          if git diff --staged --quiet; then
            echo "No changes to commit"
          else
            git commit -m "chore: sync from monorepo"
            git push
          fi
```

### Required Secrets

- `RUNNER_REPO_TOKEN`: PAT or fine-grained token with push access to the runner repo

## Part 3: Runner Repository CI/CD

### gitversion.yml (same as logger)

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

### Release Workflow (using docker-release-action)

```yaml
name: Release

on:
  push:
    tags:
      - '*.*.*'

jobs:
  release-terraform-runner:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      
      - name: Build and push Terraform runner
        uses: michielvha/docker-release-action@v1
        with:
          version: ${{ github.ref_name }}
          registry: docker.io
          username: ${{ vars.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
          project: stackweaver-runner
          platforms: linux/amd64,linux/arm64
          context: .

  release-ansible-runner:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      
      - name: Build and push Ansible runner
        uses: michielvha/docker-release-action@v1
        with:
          version: ${{ github.ref_name }}
          registry: docker.io
          username: ${{ vars.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
          project: stackweaver-ansible-runner
          platforms: linux/amd64,linux/arm64
          context: .
          # Use Dockerfile.ansible if you have a separate one
```

## Version Flow

```
Monorepo commit: "feat(runner): add retry logic"
    ↓
Sync workflow triggers
    ↓
Runner repo receives commit: "chore: sync from monorepo"
    ↓
Runner repo GitVersion increments (based on conventional commits in runner repo)
    ↓
Runner repo release workflow builds Docker images
```

Note: The synced commits use `chore:` prefix which won't bump versions. To trigger version bumps in the runner repo, you'll need to either:
1. Make manual commits with `feat:` or `fix:` prefixes in the runner repo
2. Or modify the sync workflow to preserve the original commit message type
