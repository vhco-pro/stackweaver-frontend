<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Ansible Integration Overview

## Executive Summary

StackWeaver's Ansible integration extends the existing orchestration platform to support Ansible management alongside Terraform workspace functionality. This creates a unified platform for both infrastructure provisioning (Terraform) and configuration management (Ansible).

## Background & Motivation

The platform provides an interface for managing infrastructure. This integration adds Ansible automation, creating a comprehensive IaC and configuration management solution.

## Key Design Principles

### 1. Reuse Existing Infrastructure
- Leverage current organization/user management
- Use existing project grouping structures
- Share authentication and RBAC systems

### 2. Shared Core Components
- **VCS Integration**: Uses GitHub App (same as Terraform workspaces)
- **Authentication**: Zitadel OIDC (shared)
- **Storage**: MinIO object storage (shared)
- **Queue**: Redis job queue (shared pattern)

### 3. Modern VCS Integration Only
We use GitHub App authentication exclusively - no legacy SCM credentials:
- Automatic token management
- Secure credential handling (platform-managed)
- Self-service repository connections
- Same experience across Terraform and Ansible

### 4. Native Ansible Features
- Execute `ansible-playbook` binary directly
- Use native inventory plugins for dynamic sources
- Leverage Ansible Galaxy collections
- JSON callback for structured output

### 5. Go Backend Implementation
- REST API built with Go/Gin (matches Terraform patterns)
- CLI output parsing via JSON callback
- Job lifecycle management in Go
- Credential encryption with AES-256-GCM

## VCS Integration Philosophy

**Why Platform-Managed VCS?**

| Approach | StackWeaver | Legacy (AWX) |
|----------|-------------|--------------|
| Credential Storage | Platform-managed tokens | User-provided credentials |
| Token Rotation | Automatic | Manual |
| Repository Selection | Dropdown picker | Copy-paste URLs |
| Security | Short-lived tokens | Static credentials |
| User Experience | Self-service via OAuth | Manual credential entry |

**Supported VCS Providers:**
- ✅ **GitHub** (via GitHub App) - Fully implemented
- 📋 **GitLab** (planned) - GitLab App integration
- 📋 **Bitbucket** (planned) - Bitbucket App integration

See [GITHUB_APP_VS_OAUTH-sitrep.md](../status/GITHUB_APP_VS_OAUTH-sitrep.md) for technical details.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend (React)                    │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐            │
│  │Terraform │  │ Ansible  │  │   Org      │            │
│  │Workspaces│  │   Jobs   │  │ Management │            │
│  └──────────┘  └──────────┘  └────────────┘            │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Go Backend (REST API)                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │  /api/v2/ansible/*                               │   │
│  │  - inventories, playbooks, jobs, credentials     │   │
│  └─────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  Runner Pool                             │
│  ┌──────────────┐         ┌──────────────┐             │
│  │  Terraform   │         │   Ansible    │             │
│  │   Runners    │         │   Runners    │             │
│  └──────────────┘         └──────────────┘             │
└──────────────────────────────────────────────────────────┘
```

## UI Organization

**Organization-Level Sections:**
- **Inventories** - Manage hosts and groups
- **Credentials** - SSH keys, vault passwords, cloud credentials
- **Jobs** - Execution history and status
- **Schedules** - Cron-based job automation

**Project-Level Sections:**
- **Workspaces** tab - Terraform workspaces (existing)
- **Playbooks** tab - Ansible playbooks (new)

## Comparison with AWX

| AWX Component | StackWeaver Equivalent |
|---------------|------------------------|
| Projects | Playbooks (with VCS sync) |
| Inventories | Inventories (static + dynamic) |
| Credentials | Credentials |
| Job Templates | Job Templates |
| Jobs | Jobs |
| Schedules | Schedules |
| Workflow Templates | 📋 Planned |
| Notifications | 📋 Planned |
| Surveys | 📋 Planned |

## Key Differences from AWX

1. **VCS Integration**: GitHub App only, no legacy SCM
2. **Backend**: Go instead of Python/Django
3. **No Instance Groups**: Single runner pool (for now)
4. **Unified Platform**: Ansible + Terraform in one UI
5. **Simplified Model**: Focus on essential features first
## Code Structure

### Backend

| Component | Location | Description |
|-----------|----------|-------------|
| Models | `backend/internal/models/ansible_*.go` | Data models for all Ansible resources |
| Repositories | `backend/internal/repository/ansible_*.go` | Database access layer |
| Services | `backend/internal/services/ansible/*.go` | Business logic |
| API Handlers | `backend/internal/api/v2/handlers/ansible/*.go` | REST endpoints |
| Routes | `backend/internal/api/v2/routes/ansible_routes.go` | Route definitions |
| Runner | `backend/cmd/ansible-runner/main.go` | Job execution service (~1000 lines) |

### Frontend

| Component | Location | Description |
|-----------|----------|-------------|
| Pages | `frontend/src/pages/Ansible/*.tsx` | All Ansible UI pages |
| API Client | `frontend/src/api/ansible.ts` | TypeScript API client |
| YAML Viewer | `frontend/src/components/code/YamlViewer.tsx` | Syntax highlighting |

### Infrastructure

| Component | Location | Description |
|-----------|----------|-------------|
| Runner Image | `runner-images/ansible/Dockerfile` | Ansible runner container |
| Docker Compose | `deploy/docker-compose.yml` | `ansible-runner` service |