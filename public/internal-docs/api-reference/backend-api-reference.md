<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Backend API Reference

This document describes the REST API endpoints provided by the backend Go service.
The API has moved to **v2** (`/api/v2`) which introduces TFE-compatibility for Terraform-related resources while maintaining simple REST patterns for organizational management.

## Base URL

```
http://localhost:8022
```

All v2 API endpoints are prefixed with `/api/v2`.

## Authentication

All API endpoints (except `/health`, `/ping`, and `.well-known/terraform.json`) require authentication via Bearer token:

```
Authorization: Bearer <zitadel_access_token>
```

The token is verified using Zitadel's JWKS (JSON Web Key Set) endpoint.

## General Endpoints

### `GET /health`
Check if the API service is healthy.
- **Auth**: Not required
- **Response**: `{"status": "ok"}` (200 OK)

### `GET /api/v2/ping`
TFE-compatible ping endpoint.
- **Auth**: Required
- **Response**: `204 No Content` (if authenticated)

### `GET /.well-known/terraform.json`
Terraform Service Discovery.
- **Auth**: Not required
- **Response**: JSON document describing available services (modules.v1, providers.v1, etc.)

---

## Organizations

**Route Registration**: See `backend/internal/api/v2/routes/routes.go:57-66`  
**Handler Implementation**: See `backend/internal/api/v2/handlers/organizations.go`

### `GET /api/v2/organizations`
List all organizations the user has access to.
- **Query**: `page` (default 1), `per_page` (default 20)
- **Response**: Simple JSON with pagination metadata
- **Handler**: `OrganizationHandlerV2.List()` - `backend/internal/api/v2/handlers/organizations.go:41-73`

### `POST /api/v2/organizations`
Create a new organization.
- **Body**: `{"name": "required", "description": "optional"}` (see `CreateOrganizationRequestV2` struct at line 29)
- **Response**: Simple JSON Organization object
- **Handler**: `OrganizationHandlerV2.Create()` - `backend/internal/api/v2/handlers/organizations.go:75+`

### `GET /api/v2/organizations/:name`
Get a specific organization by name.
- **Response**: TFE-compatible JSON:API format
- **Handler**: `OrganizationHandlerV2.Get()` - `backend/internal/api/v2/handlers/organizations.go:77+`

### `PATCH /api/v2/organizations/:name`
Update an organization.
- **Body**: `{"name": "optional", "description": "optional"}` (see `UpdateOrganizationRequestV2` struct at line 34)
- **Response**: Simple JSON Updated organization object
- **Handler**: `OrganizationHandlerV2.Update()` - `backend/internal/api/v2/handlers/organizations.go`

### `DELETE /api/v2/organizations/:name`
Delete an organization and all associated resources.
- **Response**: `204 No Content`
- **Handler**: `OrganizationHandlerV2.Delete()` - `backend/internal/api/v2/handlers/organizations.go:309+`
- **Repository**: `OrganizationRepository.Delete()` - `backend/internal/repository/organization.go:55+`
- **Cascade Deletion**: This endpoint permanently deletes the organization and all related resources:
  - Organization members
  - All projects (which cascade to workspaces, runs, state versions, configuration versions, variables, state locks)
  - VCS connections
  - Variable sets and their variables/assignments
  - Registry modules
  - Registry providers
  - GPG keys
  - Ansible workflows, inventories, credentials, and schedules
  - API keys (where organization_id is set)
  - Note: Audit logs are preserved for compliance purposes

### `GET /api/v2/organizations/:name/entitlement-set`
Get organization entitlements (TFE-compatible).
- **Response**: JSON:API `entitlement-sets` resource
- **Handler**: `OrganizationHandlerV2.GetEntitlementSet()` - `backend/internal/api/v2/handlers/organizations.go`

---

## Projects

**Route Registration**: See `backend/internal/api/v2/routes/routes.go:68-76`  
**Handler Implementation**: See `backend/internal/api/v2/handlers/projects.go`

### `GET /api/v2/organizations/:name/projects`
List all projects in an organization.
- **Query**: `page` (default 1), `per_page` (default 20)
- **Response**: TFE-compatible JSON:API format (list of `projects` resources)
- **Handler**: `ProjectHandlerV2.List()` - `backend/internal/api/v2/handlers/projects.go:41+`

### `POST /api/v2/organizations/:name/projects`
Create a new project in an organization.
- **Body**: JSON:API format with `projects` resource type (see handler for full structure)
- **Response**: JSON:API `projects` resource
- **Handler**: `ProjectHandlerV2.Create()` - `backend/internal/api/v2/handlers/projects.go:73+`

### `GET /api/v2/projects/:id`
Get a specific project by ID.
- **Response**: TFE-compatible JSON:API format (`projects` resource)
- **Handler**: `ProjectHandlerV2.Get()` - `backend/internal/api/v2/handlers/projects.go:111+`

### `PATCH /api/v2/projects/:id`
Update a project.
- **Body**: JSON:API format with `projects` resource type (see handler for full structure)
- **Response**: JSON:API `projects` resource
- **Handler**: `ProjectHandlerV2.Update()` - `backend/internal/api/v2/handlers/projects.go:133+`

### `DELETE /api/v2/projects/:id`
Delete a project and all associated resources.
- **Response**: `204 No Content`
- **Handler**: `ProjectHandlerV2.Delete()` - `backend/internal/api/v2/handlers/projects.go:155+`
- **Repository**: `ProjectRepository.Delete()` - `backend/internal/repository/project.go:79+`
- **Cascade Deletion**: This endpoint permanently deletes the project and all related resources:
  - All workspaces (which cascade to runs, state versions, configuration versions, variables, state locks)
  - Variable set assignments (variables and variable sets themselves are preserved)

---

## Workspaces

**Route Registration**: See `backend/internal/api/v2/routes/routes.go:85-110`  
**Handler Implementation**: See `backend/internal/api/v2/handlers/terraform/workspaces.go`

### `GET /api/v2/organizations/:name/workspaces`
List all workspaces in an organization.
- **Query**: `page` (default 1), `per_page` (default 20), `search[name]` (optional filter)
- **Response**: TFE-compatible JSON:API format (list of `workspaces` resources)
- **Handler**: `WorkspaceHandlerV2.List()` - `backend/internal/api/v2/handlers/terraform/workspaces.go:41+`

### `POST /api/v2/organizations/:name/workspaces`
Create a new workspace in an organization.
- **Body**: JSON:API format with `workspaces` resource type (see handler for full structure)
- **Response**: JSON:API `workspaces` resource
- **Handler**: `WorkspaceHandlerV2.Create()` - `backend/internal/api/v2/handlers/terraform/workspaces.go:73+`

### `GET /api/v2/organizations/:name/workspaces/:name`
Get a workspace by organization and workspace name.
- **Response**: TFE-compatible JSON:API format (`workspaces` resource)
- **Handler**: `WorkspaceHandlerV2.GetByName()` - `backend/internal/api/v2/handlers/terraform/workspaces.go:111+`

### `GET /api/v2/workspaces/:id`
Get a workspace by ID.
- **Response**: TFE-compatible JSON:API format (`workspaces` resource)
- **Handler**: `WorkspaceHandlerV2.Get()` - `backend/internal/api/v2/handlers/terraform/workspaces.go:133+`

### `PATCH /api/v2/organizations/:name/workspaces/:name`
Update a workspace by organization and workspace name.
- **Body**: JSON:API format with `workspaces` resource type
- **Request Attributes** (all optional):
  - `name`: Workspace name (must be unique within project)
  - `description`: Workspace description
  - `vcs-connection-id`: UUID of VCS connection (can be set to null to remove VCS)
  - `vcs-repository`: Repository identifier (e.g., "owner/repo")
  - `vcs-branch`: Git branch name (default: "main")
  - `working-directory`: Path within repository (e.g., "/terraform")
  - `terraform-version`: Terraform version string
  - `auto-queue-runs`: Boolean - Automatically queue runs on VCS push
  - `auto-apply`: Boolean - Automatically apply successful plans
  - `execution-mode`: String - "remote", "local", or "agent"
  - `run-timeout`: Integer - Custom extension: timeout in seconds (default: 7200)
- **Response**: JSON:API `workspaces` resource (supports `?format=simple` for frontend)
- **Handler**: `WorkspaceHandlerV2.Update()` - `backend/internal/api/v2/handlers/terraform/workspaces.go:645-771`
- **Validation**:
  - Requires authentication and organization membership
  - Validates VCS connection belongs to organization
  - Checks workspace name uniqueness within project
  - Warns about state-invalidating changes (VCS connection, repository, or branch changes)

### `DELETE /api/v2/workspaces/:id`
Delete a workspace and all associated resources.
- **Response**: `204 No Content`
- **Handler**: `WorkspaceHandlerV2.Delete()` - `backend/internal/api/v2/handlers/terraform/workspaces.go:177+`
- **Repository**: `WorkspaceRepository.Delete()` - `backend/internal/repository/workspace.go:111+`
- **Cascade Deletion**: This endpoint permanently deletes the workspace and all related resources:
  - All runs (which cascade to plan outputs, apply outputs, logs)
  - State versions
  - Configuration versions
  - Variables
  - State locks

---

## Runs

**Route Registration**: See `backend/internal/api/v2/routes/routes.go:113-154`  
**Handler Implementation**: See `backend/internal/api/v2/handlers/terraform/runs.go`

### `POST /api/v2/runs`
Create a new run.
- **Body**: JSON:API format with `runs` resource type (see handler for full structure)
- **Response**: JSON:API Run resource
- **Handler**: `RunHandlerV2.Create()` - `backend/internal/api/v2/handlers/terraform/runs.go:552+`

### `GET /api/v2/runs/:id`
Get a run by ID.
- **Response**: JSON:API Run resource
- **Handler**: `RunHandlerV2.Get()` - `backend/internal/api/v2/handlers/terraform/runs.go:720+`

#### Run Resource Attributes

The Run resource includes the following attributes in JSON:API format:

- `status`: Run status (pending, planning, planned, applying, applied, failed, canceled, running, completed)
- `operation`: Run operation type (`plan-only`, `plan-and-apply`, `destroy`)
- `plan-output`: Plan output JSON (when available)
- `error-message`: Error message if run failed
- `started-at`: ISO 8601 timestamp when the run started
- `completed-at`: ISO 8601 timestamp when the run completed
- `created-at`: ISO 8601 timestamp when the run was created
- `updated-at`: ISO 8601 timestamp when the run was last updated
- `status-timestamps`: Object containing phase-specific timestamps (TFE-compatible)

#### Status Timestamps

The `status-timestamps` attribute provides phase-specific timestamps for each run type, following TFE-compatible format. This enables accurate tracking of when each phase starts and completes.

**Implementation**: See `formatRunResponse()` in `backend/internal/api/v2/handlers/terraform/runs.go:93+`

##### Plan-and-Apply Runs

For `plan-and-apply` operations, the following timestamps are provided:

- `planning-at`: When the plan phase started (uses `started_at` field)
- `planned-at`: When the plan phase completed (uses `plan_completed_at` field)
- `applying-at`: When the apply phase started (uses `apply_started_at` field) - set when user clicks "Apply Plan"
- `applied-at`: When the apply phase completed (uses `completed_at` field)

**Database Fields**: See `backend/internal/models/run.go:68-71` for `StartedAt`, `PlanCompletedAt`, `ApplyStartedAt`, and `CompletedAt` fields.

##### Plan-Only Runs

For `plan-only` operations, the following timestamps are provided:

- `planning-at`: When the plan phase started (uses `started_at` field)
- `planned-at`: When the plan phase completed (uses `plan_completed_at` field, with fallback to `completed_at`)

**Database Fields**: See `backend/internal/models/run.go:68-71` for `StartedAt` and `PlanCompletedAt` fields.

##### Destroy Runs

For `destroy` operations, the following timestamps are provided:

- `planning-at`: When the destroy operation started (uses `started_at` field)
- `planned-at`: When the destroy operation completed (uses `plan_completed_at` field, with fallback to `completed_at`)

**Database Fields**: See `backend/internal/models/run.go:68-71` for `StartedAt` and `PlanCompletedAt` fields.

**Note**: Destroy runs reuse the `plan_completed_at` database field to track when destruction completes, following the same pattern as plan completion tracking.

### `GET /api/v2/runs/:id/plan`
Get the plan for a run.
- **Response**: JSON:API Plan resource
- **Handler**: `RunHandlerV2.GetPlan()` - `backend/internal/api/v2/handlers/terraform/runs.go:757+`

### `GET /api/v2/runs/:id/logs`
Get logs for a run.
- **Response**: Raw text stream of logs
- **Handler**: `RunHandlerV2.GetLogs()` - `backend/internal/api/v2/handlers/terraform/runs.go:942+`

### `POST /api/v2/runs/:id/actions/apply`
Apply a run (if paused/pending confirmation).
- **Response**: `204 No Content`
- **Handler**: `RunHandlerV2.Apply()` - `backend/internal/api/v2/handlers/terraform/runs.go:1178+`

**Implementation Details**: When called for a plan-and-apply run in `planned` status, this endpoint:
1. Sets the run status to `applying`
2. Sets `apply_started_at` to the current timestamp (see `backend/internal/api/v2/handlers/terraform/runs.go:1286-1288`)
3. Updates the run in the database
4. The orchestrator automatically picks up runs in `applying` status and executes the apply phase

### `POST /api/v2/runs/:id/actions/cancel`
Cancel a pending run.
- **Response**: `204 No Content`
- **Handler**: `RunHandlerV2.Cancel()` - `backend/internal/api/v2/handlers/terraform/runs.go:1410+`

### `POST /api/v2/runs/:id/actions/discard`
Discard a run.
- **Response**: `204 No Content`
- **Handler**: See `backend/internal/api/v2/handlers/terraform/runs.go` for discard implementation

### `POST /api/v2/runs/:id/actions/force-cancel`
Force cancel a running run.
- **Response**: `204 No Content`
- **Handler**: See `backend/internal/api/v2/handlers/terraform/runs.go` for force-cancel implementation

### `POST /api/v2/runs/:id/actions/force-execute`
Force execute a run (bypass checks).
- **Response**: `204 No Content`
- **Handler**: See `backend/internal/api/v2/handlers/terraform/runs.go` for force-execute implementation

### `GET /api/v2/workspaces/:id/runs`
List runs for a workspace.
- **Response**: List of JSON:API Run resources
- **Handler**: `RunHandlerV2.ListByWorkspace()` - `backend/internal/api/v2/handlers/terraform/runs.go:1354+`

### `GET /api/v2/organizations/:name/runs`
List runs for an organization (TFE-compatible).
- **Response**: List of JSON:API Run resources
- **Handler**: `RunHandlerV2.ListByOrganization()` - `backend/internal/api/v2/handlers/terraform/runs.go:1726+`

---

## Configuration Versions (TFE-Compatible)

**Route Registration**: See `backend/internal/api/v2/routes/routes.go:174-193`  
**Handler Implementation**: See `backend/internal/api/v2/handlers/terraform/configuration_versions.go`

### `POST /api/v2/workspaces/:id/configuration-versions`
Create a configuration version (placeholder for upload).
- **Body**: JSON:API format (see handler for full structure)
- **Response**: JSON:API Configuration Version resource (includes `upload-url`)
- **Handler**: `ConfigurationVersionHandlerV2.Create()` - `backend/internal/api/v2/handlers/terraform/configuration_versions.go:53+`

### `PUT /api/v2/configuration-versions/:id/upload`
Upload configuration content (zip/tar.gz).
- **Auth**: Token in query parameter (returned from Create)
- **Body**: Binary content
- **Handler**: `ConfigurationVersionHandlerV2.Upload()` - `backend/internal/api/v2/handlers/terraform/configuration_versions.go:261+`

### `GET /api/v2/configuration-versions/:id`
Get configuration version details.
- **Response**: JSON:API Configuration Version resource
- **Handler**: `ConfigurationVersionHandlerV2.Get()` - `backend/internal/api/v2/handlers/terraform/configuration_versions.go:189+`

### `GET /api/v2/workspaces/:id/configuration-versions`
List configuration versions for a workspace.
- **Response**: List of JSON:API Configuration Version resources
- **Handler**: `ConfigurationVersionHandlerV2.List()` - `backend/internal/api/v2/handlers/terraform/configuration_versions.go:215+`

---

## State Versions

**Route Registration**: See `backend/internal/api/v2/routes/routes.go:195-210`  
**Handler Implementation**: See `backend/internal/api/v2/handlers/terraform/state_versions.go`

### `POST /api/v2/workspaces/:id/state-versions`
Create a new state version (upload state).
- **Body**: JSON:API format with `state-versions` resource type (see handler for full structure)
- **Response**: JSON:API State Version resource
- **Handler**: `StateVersionHandlerV2.Create()` - `backend/internal/api/v2/handlers/terraform/state_versions.go:164+`
- **Lock Enforcement**: 
  - Returns `409 Conflict` if workspace is manually locked
  - Returns `409 Conflict` if state is locked by an active run
  - See `backend/internal/api/v2/handlers/terraform/state_versions.go:179-220` for lock checks

### `GET /api/v2/state-versions/:id`
Get a state version by ID.
- **Response**: JSON:API State Version resource
- **Handler**: `StateVersionHandlerV2.Get()` - `backend/internal/api/v2/handlers/terraform/state_versions.go:93+`

### `GET /api/v2/state-versions/:id/outputs`
Get outputs for a state version (TFE-compatible).
- **Response**: List of JSON:API State Version Output resources
- **Handler**: `StateVersionHandlerV2.GetOutputs()` - `backend/internal/api/v2/handlers/terraform/state_versions.go:295+`
- **Response Format**: 
  ```json
  {
    "data": [
      {
        "id": "<state-version-id>-<output-name>",
        "type": "state-version-outputs",
        "attributes": {
          "name": "output_name",
          "value": "output_value",
          "type": "string",
          "sensitive": false
        }
      }
    ]
  }
  ```
- **Behavior**: Extracts outputs from state data's `outputs` section. Returns empty array if no outputs exist.

### `GET /api/v2/workspaces/:id/state-versions`
List state versions for a workspace.
- **Response**: List of JSON:API State Version resources
- **Handler**: `StateVersionHandlerV2.List()` - `backend/internal/api/v2/handlers/terraform/state_versions.go:173+`

### `GET /api/v2/workspaces/:id/state-versions/current`
Get the current state version for a workspace.
- **Response**: JSON:API State Version resource
- **Handler**: `StateVersionHandlerV2.GetCurrent()` - `backend/internal/api/v2/handlers/terraform/state_versions.go:213+`

---

## Variables

**Route Registration**: See `backend/internal/api/v2/routes/routes.go:212-228`  
**Handler Implementation**: See `backend/internal/api/v2/handlers/terraform/variables.go`

### `GET /api/v2/workspaces/:id/vars`
List variables for a workspace.
- **Response**: List of JSON:API Variable resources
- **Handler**: `VariableHandlerV2.List()` - `backend/internal/api/v2/handlers/terraform/variables.go:41+`

### `POST /api/v2/workspaces/:id/vars`
Create a variable for a workspace.
- **Body**: JSON:API format with `vars` resource type (see handler for full structure)
- **Response**: JSON:API Variable resource
- **Handler**: `VariableHandlerV2.Create()` - `backend/internal/api/v2/handlers/terraform/variables.go:73+`

### `GET /api/v2/vars/:id`
Get a variable by ID.
- **Response**: JSON:API Variable resource
- **Handler**: `VariableHandlerV2.Get()` - `backend/internal/api/v2/handlers/terraform/variables.go:105+`

### `PATCH /api/v2/vars/:id`
Update a variable.
- **Body**: JSON:API format with `vars` resource type (see handler for full structure)
- **Response**: JSON:API Variable resource
- **Handler**: `VariableHandlerV2.Update()` - `backend/internal/api/v2/handlers/terraform/variables.go:137+`

### `DELETE /api/v2/vars/:id`
Delete a variable.
- **Response**: `204 No Content`
- **Handler**: `VariableHandlerV2.Delete()` - `backend/internal/api/v2/handlers/terraform/variables.go:169+`

---

## Variable Sets

**Route Registration**: See `backend/internal/api/v2/routes/routes.go:230-254`  
**Handler Implementation**: See `backend/internal/api/v2/handlers/terraform/variable_sets.go`

### `GET /api/v2/organizations/:name/variable-sets`
List variable sets for an organization.
- **Response**: List of JSON:API Variable Set resources
- **Handler**: `VariableSetHandlerV2.List()` - `backend/internal/api/v2/handlers/terraform/variable_sets.go:41+`

### `POST /api/v2/organizations/:name/variable-sets`
Create a variable set.
- **Body**: JSON:API format with `variable-sets` resource type (see handler for full structure)
- **Response**: JSON:API Variable Set resource
- **Handler**: `VariableSetHandlerV2.Create()` - `backend/internal/api/v2/handlers/terraform/variable_sets.go:73+`

### `GET /api/v2/variable-sets/:id`
Get a variable set by ID.
- **Response**: JSON:API Variable Set resource
- **Handler**: `VariableSetHandlerV2.Get()` - `backend/internal/api/v2/handlers/terraform/variable_sets.go:105+`

### `PATCH /api/v2/variable-sets/:id`
Update a variable set.
- **Body**: JSON:API format with `variable-sets` resource type (see handler for full structure)
- **Response**: JSON:API Variable Set resource
- **Handler**: `VariableSetHandlerV2.Update()` - `backend/internal/api/v2/handlers/terraform/variable_sets.go:137+`

### `DELETE /api/v2/variable-sets/:id`
Delete a variable set.
- **Response**: `204 No Content`
- **Handler**: `VariableSetHandlerV2.Delete()` - `backend/internal/api/v2/handlers/terraform/variable_sets.go:169+`

### `POST /api/v2/variable-sets/:id/relationships/workspaces`
Assign a variable set to workspaces.
- **Body**: JSON:API format with workspace relationships
- **Response**: `204 No Content`
- **Handler**: `VariableSetHandlerV2.AssignWorkspaces()` - `backend/internal/api/v2/handlers/terraform/variable_sets.go:201+`

### `DELETE /api/v2/variable-sets/:id/relationships/workspaces`
Unassign a variable set from workspaces.
- **Body**: JSON:API format with workspace relationships
- **Response**: `204 No Content`
- **Handler**: `VariableSetHandlerV2.UnassignWorkspaces()` - `backend/internal/api/v2/handlers/terraform/variable_sets.go:233+`

---

## State Locks

**Route Registration**: See `backend/internal/api/v2/routes/routes.go:256-265`  
**Handler Implementation**: See `backend/internal/api/v2/handlers/terraform/state_locks.go`

### `GET /api/v2/workspaces/:id/state-lock`
Get the current state lock for a workspace (if locked).
- **Response**: JSON:API State Lock resource (404 if not locked)
- **Handler**: `StateLockHandlerV2.Get()` - `backend/internal/api/v2/handlers/terraform/state_locks.go:41+`

### `DELETE /api/v2/workspaces/:id/state-lock`
Force unlock a workspace (if locked).
- **Response**: `204 No Content`
- **Handler**: `StateLockHandlerV2.ForceUnlock()` - `backend/internal/api/v2/handlers/terraform/state_locks.go:73+`

---

## Registry

### Modules

**Route Registration**: See `backend/internal/api/v2/routes/routes.go:267-280`  
**Handler Implementation**: See `backend/internal/api/v2/handlers/registry/modules.go`

### `GET /api/v2/organizations/:name/registry-modules`
List registry modules for an organization.
- **Response**: List of JSON:API Registry Module resources
- **Handler**: `ModuleHandlerV2.List()` - `backend/internal/api/v2/handlers/registry/modules.go:41+`

### `POST /api/v2/organizations/:name/registry-modules`
Create a registry module.
- **Body**: JSON:API format with `registry-modules` resource type (see handler for full structure)
- **Response**: JSON:API Registry Module resource
- **Handler**: `ModuleHandlerV2.Create()` - `backend/internal/api/v2/handlers/registry/modules.go:73+`

### `GET /api/v2/registry-modules/:organization/:name/:provider/:version`
Get a registry module by organization, name, provider, and version.
- **Response**: JSON:API Registry Module resource
- **Handler**: `ModuleHandlerV2.Get()` - `backend/internal/api/v2/handlers/registry/modules.go:105+`

### `DELETE /api/v2/registry-modules/:organization/:name/:provider/:version`
Delete a registry module version.
- **Response**: `204 No Content`
- **Handler**: `ModuleHandlerV2.Delete()` - `backend/internal/api/v2/handlers/registry/modules.go:137+`

### Providers

**Route Registration**: See `backend/internal/api/v2/routes/routes.go:282-295`  
**Handler Implementation**: See `backend/internal/api/v2/handlers/registry/providers.go`

### `GET /api/v2/organizations/:name/registry-providers`
List registry providers for an organization.
- **Response**: List of JSON:API Registry Provider resources
- **Handler**: `ProviderHandlerV2.List()` - `backend/internal/api/v2/handlers/registry/providers.go:41+`

### `POST /api/v2/organizations/:name/registry-providers`
Create a registry provider.
- **Body**: JSON:API format with `registry-providers` resource type (see handler for full structure)
- **Response**: JSON:API Registry Provider resource
- **Handler**: `ProviderHandlerV2.Create()` - `backend/internal/api/v2/handlers/registry/providers.go:73+`

### `GET /api/v2/registry-providers/:organization/:name/:version`
Get a registry provider by organization, name, and version.
- **Response**: JSON:API Registry Provider resource
- **Handler**: `ProviderHandlerV2.Get()` - `backend/internal/api/v2/handlers/registry/providers.go:105+`

### `DELETE /api/v2/registry-providers/:organization/:name/:version`
Delete a registry provider version.
- **Response**: `204 No Content`
- **Handler**: `ProviderHandlerV2.Delete()` - `backend/internal/api/v2/handlers/registry/providers.go:137+`

---

## Ansible

### Workflows

**Route Registration**: See `backend/internal/api/v2/routes/routes.go:297-310`  
**Handler Implementation**: See `backend/internal/api/v2/handlers/ansible/workflows.go`

### `GET /api/v2/organizations/:name/ansible-workflows`
List Ansible workflows for an organization.
- **Response**: List of JSON:API Ansible Workflow resources
- **Handler**: `AnsibleWorkflowHandlerV2.List()` - `backend/internal/api/v2/handlers/ansible/workflows.go:41+`

### `POST /api/v2/organizations/:name/ansible-workflows`
Create an Ansible workflow.
- **Body**: JSON:API format with `ansible-workflows` resource type (see handler for full structure)
- **Response**: JSON:API Ansible Workflow resource
- **Handler**: `AnsibleWorkflowHandlerV2.Create()` - `backend/internal/api/v2/handlers/ansible/workflows.go:73+`

### `GET /api/v2/ansible-workflows/:id`
Get an Ansible workflow by ID.
- **Response**: JSON:API Ansible Workflow resource
- **Handler**: `AnsibleWorkflowHandlerV2.Get()` - `backend/internal/api/v2/handlers/ansible/workflows.go:105+`

### `PATCH /api/v2/ansible-workflows/:id`
Update an Ansible workflow.
- **Body**: JSON:API format with `ansible-workflows` resource type (see handler for full structure)
- **Response**: JSON:API Ansible Workflow resource
- **Handler**: `AnsibleWorkflowHandlerV2.Update()` - `backend/internal/api/v2/handlers/ansible/workflows.go:137+`

### `DELETE /api/v2/ansible-workflows/:id`
Delete an Ansible workflow.
- **Response**: `204 No Content`
- **Handler**: `AnsibleWorkflowHandlerV2.Delete()` - `backend/internal/api/v2/handlers/ansible/workflows.go:169+`

### Inventories

**Route Registration**: See `backend/internal/api/v2/routes/routes.go:312-325`  
**Handler Implementation**: See `backend/internal/api/v2/handlers/ansible/inventories.go`

### `GET /api/v2/organizations/:name/ansible-inventories`
List Ansible inventories for an organization.
- **Response**: List of JSON:API Ansible Inventory resources
- **Handler**: `AnsibleInventoryHandlerV2.List()` - `backend/internal/api/v2/handlers/ansible/inventories.go:41+`

### `POST /api/v2/organizations/:name/ansible-inventories`
Create an Ansible inventory.
- **Body**: JSON:API format with `ansible-inventories` resource type (see handler for full structure)
- **Response**: JSON:API Ansible Inventory resource
- **Handler**: `AnsibleInventoryHandlerV2.Create()` - `backend/internal/api/v2/handlers/ansible/inventories.go:73+`

### `GET /api/v2/ansible-inventories/:id`
Get an Ansible inventory by ID.
- **Response**: JSON:API Ansible Inventory resource
- **Handler**: `AnsibleInventoryHandlerV2.Get()` - `backend/internal/api/v2/handlers/ansible/inventories.go:105+`

### `PATCH /api/v2/ansible-inventories/:id`
Update an Ansible inventory.
- **Body**: JSON:API format with `ansible-inventories` resource type (see handler for full structure)
- **Response**: JSON:API Ansible Inventory resource
- **Handler**: `AnsibleInventoryHandlerV2.Update()` - `backend/internal/api/v2/handlers/ansible/inventories.go:137+`

### `DELETE /api/v2/ansible-inventories/:id`
Delete an Ansible inventory.
- **Response**: `204 No Content`
- **Handler**: `AnsibleInventoryHandlerV2.Delete()` - `backend/internal/api/v2/handlers/ansible/inventories.go:169+`

### Credentials

**Route Registration**: See `backend/internal/api/v2/routes/routes.go:327-340`  
**Handler Implementation**: See `backend/internal/api/v2/handlers/ansible/credentials.go`

### `GET /api/v2/organizations/:name/ansible-credentials`
List Ansible credentials for an organization.
- **Response**: List of JSON:API Ansible Credential resources
- **Handler**: `AnsibleCredentialHandlerV2.List()` - `backend/internal/api/v2/handlers/ansible/credentials.go:41+`

### `POST /api/v2/organizations/:name/ansible-credentials`
Create an Ansible credential.
- **Body**: JSON:API format with `ansible-credentials` resource type (see handler for full structure)
- **Response**: JSON:API Ansible Credential resource
- **Handler**: `AnsibleCredentialHandlerV2.Create()` - `backend/internal/api/v2/handlers/ansible/credentials.go:73+`

### `GET /api/v2/ansible-credentials/:id`
Get an Ansible credential by ID.
- **Response**: JSON:API Ansible Credential resource
- **Handler**: `AnsibleCredentialHandlerV2.Get()` - `backend/internal/api/v2/handlers/ansible/credentials.go:105+`

### `PATCH /api/v2/ansible-credentials/:id`
Update an Ansible credential.
- **Body**: JSON:API format with `ansible-credentials` resource type (see handler for full structure)
- **Response**: JSON:API Ansible Credential resource
- **Handler**: `AnsibleCredentialHandlerV2.Update()` - `backend/internal/api/v2/handlers/ansible/credentials.go:137+`

### `DELETE /api/v2/ansible-credentials/:id`
Delete an Ansible credential.
- **Response**: `204 No Content`
- **Handler**: `AnsibleCredentialHandlerV2.Delete()` - `backend/internal/api/v2/handlers/ansible/credentials.go:169+`

---

## API Keys

**Route Registration**: See `backend/internal/api/v2/routes/routes.go:342-349`  
**Handler Implementation**: See `backend/internal/api/v2/handlers/api_keys.go`

### `GET /api/v2/api-keys`
List API keys for the authenticated user.
- **Response**: List of API key objects
- **Handler**: `APIKeyHandlerV2.List()` - `backend/internal/api/v2/handlers/api_keys.go:41+`

### `POST /api/v2/api-keys`
Create a new API key.
- **Body**: `{"name": "required", "organization_id": "optional uuid"}` (see `CreateAPIKeyRequestV2` struct)
- **Response**: API key object (includes `key` field only on creation)
- **Handler**: `APIKeyHandlerV2.Create()` - `backend/internal/api/v2/handlers/api_keys.go:73+`

### `DELETE /api/v2/api-keys/:id`
Delete an API key.
- **Response**: `204 No Content`
- **Handler**: `APIKeyHandlerV2.Delete()` - `backend/internal/api/v2/handlers/api_keys.go:105+`

---

## Error Responses

All endpoints return standard HTTP status codes:

- `200 OK`: Request successful (GET, PATCH)
- `201 Created`: Resource created (POST)
- `204 No Content`: Request successful, no response body (DELETE, some POST)
- `400 Bad Request`: Invalid request body or parameters
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Authenticated but not authorized for the resource
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict (e.g., duplicate name)
- `422 Unprocessable Entity`: Validation error
- `500 Internal Server Error`: Server error

Error responses follow JSON:API error format:

```json
{
  "errors": [
    {
      "status": "400",
      "title": "Bad Request",
      "detail": "Error message here"
    }
  ]
}
```
