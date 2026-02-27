<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# API Reference

## Overview

All Ansible API endpoints follow the JSON:API specification for request and response formatting. Endpoints are organized by resource type and follow TFE-compatible patterns.

**Base URL**: `/api/v2`

**Authentication**: Bearer token in `Authorization` header

## Response Format

### Success Response

```json
{
  "data": {
    "id": "uuid",
    "type": "resource-type",
    "attributes": {
      "name": "value",
      "description": "value"
    },
    "relationships": {
      "related-resource": {
        "data": { "id": "uuid", "type": "type" }
      }
    }
  }
}
```

### List Response with Pagination

```json
{
  "data": [...],
  "meta": {
    "pagination": {
      "current-page": 1,
      "page-size": 20,
      "total-count": 100,
      "total-pages": 5
    }
  }
}
```

### Error Response

```json
{
  "errors": [
    {
      "status": "400",
      "title": "Bad Request",
      "detail": "Name is required"
    }
  ]
}
```

---

## Inventories

### List Inventories

```
GET /api/v2/organizations/:name/ansible/inventories
```

**Query Parameters**:
- `page[number]` - Page number (default: 1)
- `page[size]` - Items per page (default: 20)
- `filter[search]` - Search by name
- `filter[type]` - Filter by inventory type (static, dynamic, vcs)

### Create Inventory

```
POST /api/v2/organizations/:name/ansible/inventories
```

```json
{
  "data": {
    "type": "inventories",
    "attributes": {
      "name": "production-servers",
      "description": "Production infrastructure",
      "inventory-type": "static"
    }
  }
}
```

### Get Inventory

```
GET /api/v2/ansible/inventories/:id
```

### Update Inventory

```
PATCH /api/v2/ansible/inventories/:id
```

### Delete Inventory

```
DELETE /api/v2/ansible/inventories/:id
```

### Export as INI

```
GET /api/v2/ansible/inventories/:id/ini
```

Returns plain text Ansible inventory format.

### Export as JSON

```
GET /api/v2/ansible/inventories/:id/json
```

Returns Ansible-compatible JSON inventory format.

---

## Inventory Hosts

### List Hosts

```
GET /api/v2/ansible/inventories/:id/hosts
```

### Create Host

```
POST /api/v2/ansible/inventories/:id/hosts
```

```json
{
  "data": {
    "type": "inventory-hosts",
    "attributes": {
      "name": "webserver1",
      "hostname": "192.168.1.100",
      "port": 22,
      "variables": {
        "ansible_user": "ubuntu"
      }
    }
  }
}
```

### Get Host

```
GET /api/v2/ansible/hosts/:id
```

### Update Host

```
PATCH /api/v2/ansible/hosts/:id
```

### Delete Host

```
DELETE /api/v2/ansible/hosts/:id
```

---

## Inventory Groups

### List Groups

```
GET /api/v2/ansible/inventories/:id/groups
```

### Create Group

```
POST /api/v2/ansible/inventories/:id/groups
```

```json
{
  "data": {
    "type": "inventory-groups",
    "attributes": {
      "name": "webservers",
      "description": "Web server group",
      "variables": {
        "http_port": 80
      }
    }
  }
}
```

### Get Group

```
GET /api/v2/ansible/groups/:id
```

### Update Group

```
PATCH /api/v2/ansible/groups/:id
```

### Delete Group

```
DELETE /api/v2/ansible/groups/:id
```

---

## Inventory Sources (Dynamic Inventories)

### List Sources

```
GET /api/v2/ansible/inventories/:id/sources
```

### Create Source

```
POST /api/v2/ansible/inventories/:id/sources
```

```json
{
  "data": {
    "type": "inventory-sources",
    "attributes": {
      "name": "aws-production",
      "source-type": "aws",
      "hostname-var": "private_ip",
      "group-by": "region",
      "update-on-launch": true,
      "source-config": {
        "regions": ["us-east-1", "us-west-2"],
        "filters": {
          "tag:Environment": "production"
        }
      }
    },
    "relationships": {
      "credential": {
        "data": { "id": "credential-uuid", "type": "credentials" }
      }
    }
  }
}
```

**Source Types**: `aws`, `azure`, `gcp`, `vmware`, `custom`

#### Azure OIDC Workload Identity

For Azure sources, if the organization has an Azure OIDC Configuration, the system will automatically use OIDC workload identity federation for authentication instead of requiring a stored credential. The inventory source service generates a short-lived JWT token and sets the `AZURE_FEDERATED_TOKEN_FILE`, `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID` environment variables for the `azure.azcollection.azure_rm` inventory plugin. This provides keyless authentication with auto-rotating tokens.

If no OIDC configuration exists for the organization, the source falls back to credential-based authentication (client ID + client secret).

#### Dynamic Inventory via VCS

Dynamic inventory plugin configurations (e.g., `aws_ec2.yml`, `azure_rm.yml`) can be stored in a VCS repository using a VCS-backed inventory (type=vcs). When synced, the runner clones the repository, executes `ansible-inventory --list` against the plugin configuration, and caches the discovered hosts and groups in the database. This cached inventory avoids re-running the plugin on every job launch.

#### Sync Schedule

Inventory sources can be configured with a cron-based sync schedule for automatic periodic synchronization.

- `sync-schedule` - Cron expression (e.g., `0 * * * *` for hourly, `0 0 * * *` for daily)

### Sync Source

```
POST /api/v2/ansible/inventory-sources/:id/actions/sync
```

---

## Credentials

### List Credentials

```
GET /api/v2/organizations/:name/ansible/credentials
```

**Query Parameters**:
- `filter[type]` - Filter by credential type

### Create Credential

```
POST /api/v2/organizations/:name/ansible/credentials
```

**SSH Credential**:
```json
{
  "data": {
    "type": "credentials",
    "attributes": {
      "name": "ssh-production",
      "credential-type": "ssh",
      "username": "ubuntu",
      "ssh-private-key": "-----BEGIN RSA PRIVATE KEY-----\n...",
      "ssh-passphrase": "optional"
    }
  }
}
```

**AWS Credential**:
```json
{
  "data": {
    "type": "credentials",
    "attributes": {
      "name": "aws-production",
      "credential-type": "aws",
      "aws-access-key-id": "AKIA...",
      "aws-secret-access-key": "..."
    }
  }
}
```

**Credential Types**: `ssh`, `machine-ssh`, `vault`, `aws`, `azure`, `gcp`, `vmware`

### Get Credential

```
GET /api/v2/ansible/credentials/:id
```

Note: Sensitive fields are never returned in responses.

### Update Credential

```
PATCH /api/v2/ansible/credentials/:id
```

### Delete Credential

```
DELETE /api/v2/ansible/credentials/:id
```

Returns `409 Conflict` if credential is in use by job templates or inventory sources.

---

## Playbooks

### List Playbooks

```
GET /api/v2/organizations/:name/ansible/playbooks
```

### Create Playbook

```
POST /api/v2/organizations/:name/ansible/playbooks
```

```json
{
  "data": {
    "type": "playbooks",
    "attributes": {
      "name": "webserver-setup",
      "description": "Configure web servers",
      "vcs-branch": "main",
      "playbook-path": "ansible/site.yml"
    },
    "relationships": {
      "vcs-connection": {
        "data": { "id": "connection-uuid", "type": "vcs-connections" }
      }
    }
  }
}
```

### Get Playbook

```
GET /api/v2/ansible/playbooks/:id
```

### Update Playbook

```
PATCH /api/v2/ansible/playbooks/:id
```

### Delete Playbook

```
DELETE /api/v2/ansible/playbooks/:id
```

### Sync from VCS

```
POST /api/v2/ansible/playbooks/:id/actions/sync
```

Queues a sync job to refresh playbook from VCS.

---

## Job Templates

### List Job Templates

```
GET /api/v2/organizations/:name/ansible/job-templates
```

### Create Job Template

```
POST /api/v2/organizations/:name/ansible/job-templates
```

```json
{
  "data": {
    "type": "job-templates",
    "attributes": {
      "name": "deploy-webservers",
      "description": "Deploy web application",
      "verbosity": 1,
      "forks": 10,
      "become-enabled": true,
      "diff-mode": false,
      "limit": "webservers",
      "tags": "deploy",
      "skip-tags": "test",
      "extra-vars": {
        "app_version": "1.0.0"
      }
    },
    "relationships": {
      "playbook": {
        "data": { "id": "playbook-uuid", "type": "playbooks" }
      },
      "inventory": {
        "data": { "id": "inventory-uuid", "type": "inventories" }
      },
      "credential": {
        "data": { "id": "credential-uuid", "type": "credentials" }
      }
    }
  }
}
```

### Get Job Template

```
GET /api/v2/ansible/job-templates/:id
```

### Update Job Template

```
PATCH /api/v2/ansible/job-templates/:id
```

### Delete Job Template

```
DELETE /api/v2/ansible/job-templates/:id
```

Cascade deletes associated jobs and schedules.

### Launch from Template

```
POST /api/v2/ansible/job-templates/:id/launch
```

```json
{
  "extra-vars": {
    "app_version": "1.1.0"
  },
  "limit": "webservers:&production"
}
```

---

## Jobs

### List Jobs

```
GET /api/v2/organizations/:name/ansible/jobs
```

**Query Parameters**:
- `filter[status]` - Filter by status (pending, running, successful, failed, canceled)
- `filter[playbook]` - Filter by playbook ID
- `filter[inventory]` - Filter by inventory ID

### Get Job Queue

```
GET /api/v2/organizations/:name/ansible/jobs/queue
```

Returns jobs with status `pending` or `running`.

### Launch Job

```
POST /api/v2/organizations/:name/ansible/jobs
```

```json
{
  "data": {
    "type": "jobs",
    "attributes": {
      "name": "Ad-hoc deployment",
      "job-type": "run",
      "verbosity": 2,
      "extra-vars": {
        "app_version": "1.0.0"
      }
    },
    "relationships": {
      "playbook": {
        "data": { "id": "playbook-uuid", "type": "playbooks" }
      },
      "inventory": {
        "data": { "id": "inventory-uuid", "type": "inventories" }
      }
    }
  }
}
```

### Get Job

```
GET /api/v2/ansible/jobs/:id
```

### Cancel Job

```
POST /api/v2/ansible/jobs/:id/actions/cancel
```

### Relaunch Job

```
POST /api/v2/ansible/jobs/:id/actions/relaunch
```

Creates a new job with the same configuration.

### Get Job Events

```
GET /api/v2/ansible/jobs/:id/events
```

**Query Parameters**:
- `page[number]` - Page number
- `filter[host]` - Filter by host name
- `filter[status]` - Filter by event status (ok, failed, skipped, unreachable)

### Get Job Output

```
GET /api/v2/ansible/jobs/:id/output
```

Returns raw stdout/stderr output.

---

## Schedules

### List Schedules

```
GET /api/v2/organizations/:name/ansible/schedules
```

### Create Schedule

```
POST /api/v2/organizations/:name/ansible/schedules
```

```json
{
  "data": {
    "type": "schedules",
    "attributes": {
      "name": "nightly-deploy",
      "description": "Deploy every night at 2 AM",
      "schedule-type": "job_template",
      "cron-expression": "0 2 * * *",
      "timezone": "America/New_York",
      "enabled": true,
      "extra-vars": {
        "environment": "staging"
      }
    },
    "relationships": {
      "job-template": {
        "data": { "id": "template-uuid", "type": "job-templates" }
      }
    }
  }
}
```

**Schedule Types**: `job_template`, `inventory_source`, `playbook_sync`

### Get Schedule

```
GET /api/v2/ansible/schedules/:id
```

### Update Schedule

```
PATCH /api/v2/ansible/schedules/:id
```

### Delete Schedule

```
DELETE /api/v2/ansible/schedules/:id
```

### Enable Schedule

```
POST /api/v2/ansible/schedules/:id/actions/enable
```

### Disable Schedule

```
POST /api/v2/ansible/schedules/:id/actions/disable
```

### Run Now

```
POST /api/v2/ansible/schedules/:id/actions/run-now
```

Triggers immediate execution regardless of schedule.

### Validate Cron Expression

```
POST /api/v2/ansible/schedules/validate-cron
```

```json
{
  "cron-expression": "0 */6 * * *"
}
```

### Get Cron Presets

```
GET /api/v2/ansible/schedules/cron-presets
```

Returns common cron expression presets:
- `@hourly` → `0 * * * *`
- `@daily` → `0 0 * * *`
- `@weekly` → `0 0 * * 0`
- `@monthly` → `0 0 1 * *`

---

## GitHub Webhooks

### Webhook Endpoint

```
POST /api/v2/webhooks/github
```

**Headers**:
- `X-GitHub-Event` - Event type (push, etc.)
- `X-Hub-Signature-256` - HMAC signature for validation

**Supported Events**:
- `push` - Triggers playbook sync for affected repositories

---

## VCS File Content

### Get File Content

```
GET /api/v2/vcs-connections/:id/repositories/:owner/:repo/contents/*path
```

**Query Parameters**:
- `ref` - Branch or commit SHA (optional, defaults to default branch)

**Response**:
```json
{
  "data": {
    "content": "---\n- hosts: all\n  tasks: ...",
    "path": "ansible/site.yml",
    "ref": "main"
  }
}
```
