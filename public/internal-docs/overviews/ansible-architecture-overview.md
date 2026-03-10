<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Ansible Integration Architecture Overview

## Data Model Overview

All Ansible models are in `backend/internal/models/ansible_*.go`:

| Model | File | Description |
|-------|------|-------------|
| `AnsibleInventory` | `ansible_inventory.go` | Host collections with type (static/dynamic/vcs) |
| `AnsibleInventoryHost` | `ansible_inventory.go` | Individual managed hosts |
| `AnsibleInventoryGroup` | `ansible_inventory.go` | Host groups with hierarchy |
| `AnsibleInventorySource` | `ansible_inventory.go` | Dynamic inventory sources (AWS, Azure, etc.) |
| `AnsiblePlaybook` | `ansible_playbook.go` | Playbooks linked to VCS repositories |
| `AnsibleJobTemplate` | `ansible_playbook.go` | Reusable job configurations |
| `AnsibleJob` | `ansible_job.go` | Job executions with status/stats |
| `AnsibleJobEvent` | `ansible_job.go` | Per-task execution events |
| `AnsibleCredential` | `ansible_credential.go` | Encrypted credentials |
| `AnsibleSchedule` | `ansible_schedule.go` | Cron-based scheduling |

## Entity Relationships

```
Organization
    ├── Inventories
    │   ├── Hosts
    │   ├── Groups (with hierarchy)
    │   └── Sources (for dynamic)
    ├── Credentials
    ├── Playbooks (VCS-linked)
    ├── Job Templates
    │   ├── → Playbook
    │   ├── → Inventory
    │   └── → Credential
    ├── Jobs
    │   ├── → Job Template (optional)
    │   ├── → Playbook
    │   ├── → Inventory
    │   └── Events
    └── Schedules
        └── → Job Template
```

## Credential Types

Defined in `AnsibleCredential.Type`:

| Type | Fields | Use Case |
|------|--------|----------|
| `ssh` | Username, SSHPrivateKey, SSHPassphrase | SSH authentication |
| `machine-ssh` | Username, Password, SSHKey | Machine credentials |
| `vault` | VaultPassword | Ansible Vault decryption |
| `aws` | AWSAccessKeyID, AWSSecretAccessKey | AWS dynamic inventory |
| `azure` | TenantID, ClientID, ClientSecret, SubscriptionID | Azure resources |
| `gcp` | Project, ServiceAccountJSON | GCP resources |
| `vmware` | Host, Username, Password | VMware vSphere |

All sensitive fields are encrypted with AES-256-GCM. See `backend/internal/services/ansible/credential.go`.

## Database Schema

Tables are auto-migrated via GORM in `backend/cmd/api/main.go`:

```sql
-- Core tables
ansible_inventories
ansible_inventory_hosts
ansible_inventory_groups
ansible_inventory_group_hosts  -- junction table
ansible_inventory_sources
ansible_credentials
ansible_playbooks
ansible_job_templates
ansible_jobs
ansible_job_events
ansible_schedules
```

Key indexes (defined in model tags):
- `ansible_jobs`: `organization_id`, `status`, `job_template_id`
- `ansible_job_events`: `job_id`
- `ansible_schedules`: `enabled`, `next_run_at`

## Service Layer

Located in `backend/internal/services/ansible/`:

| Service | File | Responsibilities |
|---------|------|------------------|
| `CredentialService` | `credential.go` | Encrypt/decrypt credentials, validation |
| `InventoryService` | `inventory.go` | Generate INI/JSON/YAML inventory formats |
| `InventorySourceService` | `inventory_source.go` | Dynamic inventory sync via ansible-inventory |
| VCS Inventory Sync | `ansible-runner/main.go` | VCS inventory sync (via ansible-inventory in runner) |
| `JobService` | `job.go` | Queue jobs, track status, manage events |
| `SchedulerService` | `scheduler.go` | Background cron evaluation, job triggering |

## API Layer

### Handlers

Located in `backend/internal/api/v2/handlers/ansible/`:

| Handler | Endpoints |
|---------|-----------|
| `inventories.go` | Inventory CRUD, INI/JSON export |
| `hosts.go` | Host CRUD |
| `groups.go` | Group CRUD with hierarchy |
| `inventory_sources.go` | Dynamic source CRUD, sync trigger |
| `credentials.go` | Credential CRUD (encrypted) |
| `playbooks.go` | Playbook CRUD, VCS sync |
| `jobs.go` | Job launch/cancel/relaunch, events/output |
| `schedules.go` | Schedule CRUD, enable/disable, run-now |

### Routes

Defined in `backend/internal/api/v2/routes/ansible_routes.go`:

**Organization-scoped (list/create):**
- `GET/POST /api/v2/organizations/:name/ansible/inventories`
- `GET/POST /api/v2/organizations/:name/ansible/credentials`
- `GET/POST /api/v2/organizations/:name/ansible/playbooks`
- `GET/POST /api/v2/organizations/:name/ansible/job-templates`
- `GET/POST /api/v2/organizations/:name/ansible/jobs`
- `GET/POST /api/v2/organizations/:name/ansible/schedules`

**Resource-scoped (get/update/delete):**
- `GET/PATCH/DELETE /api/v2/ansible/{resource}/:id`

See [API Reference](../../features/ansible/api-reference.md) for complete endpoint documentation.

## Runner Architecture

The Ansible runner (`backend/cmd/ansible-runner/main.go`) handles job execution:

```
┌─────────────────────────────────────────────────────┐
│                 Ansible Runner                       │
│                                                      │
│  ┌─────────────┐         ┌─────────────┐           │
│  │ Job Worker  │         │ Sync Worker │           │
│  │ansible_jobs │         │ansible_sync │           │
│  │   queue     │         │   queue     │           │
│  └──────┬──────┘         └──────┬──────┘           │
│         │                       │                   │
│         ▼                       ▼                   │
│  ┌─────────────────────────────────────────────┐   │
│  │      Job Execution / Sync Execution          │   │
│  │  1. Clone repo from VCS                     │   │
│  │  2. Generate inventory JSON (job)           │   │
│  │     OR Parse inventory file (sync)          │   │
│  │  3. Write credentials to temp files         │   │
│  │  4. Execute ansible-playbook (job)          │   │
│  │     OR ansible-inventory (sync)             │   │
│  │  5. Parse JSON output → events/stats        │   │
│  │  6. Update status/stats                     │   │
│  │  7. Cleanup temp files                      │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

Key functions in runner:
- `processJobs()` - Main job worker loop
- `processSyncJobs()` - VCS sync worker loop (playbooks and inventories)
- `executeJob()` - Full job lifecycle
- `syncPlaybook()` - Sync playbook from VCS repository
- `syncInventory()` - Sync VCS inventory file, parse hosts/groups
- `runAnsiblePlaybook()` - ansible-playbook invocation
- `parseAndStoreJSONOutput()` - Event extraction
- `processInventoryOutput()` - Parse ansible-inventory JSON for VCS inventories

## Integration Points

### Shared with Terraform

| Component | Location | Usage |
|-----------|----------|-------|
| VCS Connections | `vcs_connections` table | Repository access |
| Organizations | `organizations` table | Resource scoping |
| Users | `users` table | Job creator tracking |
| Redis | `queue/redis.go` | Job distribution |
| MinIO | `storage/minio.go` | Artifact storage |
| Encryption | `pkg/crypto/` | Credential encryption |

### Environment Variables

Runner configuration (see `backend/cmd/ansible-runner/main.go`):

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | localhost | Redis for job queue |
| `DATABASE_*` | - | PostgreSQL connection |
| `STORAGE_*` | - | MinIO/S3 for artifacts |
| `ANSIBLE_ENCRYPTION_KEY` | - | Credential decryption key |
| `WORKSPACES_DIR` | /home/iac/workspaces | Job workspace root |
