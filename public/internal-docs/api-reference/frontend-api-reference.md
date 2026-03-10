<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Frontend API Reference

This document describes the API client used by the frontend application (`frontend/src/api/client.ts`) to interact with the backend API (v2).

## API Client

The frontend uses a centralized `ApiClient` class that handles:
- **Base URL**: Defaults to `/api/v2` (or `VITE_API_URL` env var).
- **Authentication**: Automatically injects the Zitadel Bearer token.
- **Error Handling**: Standardized error parsing for v2 error formats.
- **Type Safety**: Generic methods for strongly-typed responses.

**Implementation**: See `ApiClient` class in `frontend/src/api/client.ts` (lines 11-120)

### Base Configuration

**Reference**: `frontend/src/api/client.ts:3` - Base URL configuration using `VITE_API_URL` environment variable or defaulting to `http://localhost:8022/api/v2`.

### Authentication

**Reference**: `frontend/src/api/client.ts:39-51` - Token retrieval and Authorization header injection. The client automatically gets the Zitadel access token and includes it in the `Authorization: Bearer <token>` header for all requests.

---

## Organizations API

**Implementation**: See `organizationsApi` in `frontend/src/api/client.ts` (lines 247-255)

### `organizationsApi.list()`
List all organizations.
- **Endpoint**: `GET /api/v2/organizations`
- **Returns**: `{ data: Organization[], meta: { pagination: ... } }`
- **Reference**: `frontend/src/api/client.ts:248`

### `organizationsApi.get(name: string)`
Get organization by name.
- **Endpoint**: `GET /api/v2/organizations/:name`
- **Returns**: `Organization`
- **Reference**: `frontend/src/api/client.ts:249`

### `organizationsApi.create(data)`
Create a new organization.
- **Endpoint**: `POST /api/v2/organizations`
- **Data**: `{ name: string; description?: string }`
- **Returns**: `Organization`
- **Reference**: `frontend/src/api/client.ts:250-251`

### `organizationsApi.update(name: string, data)`
Update an organization.
- **Endpoint**: `PATCH /api/v2/organizations/:name`
- **Data**: `{ name?: string; description?: string }`
- **Returns**: `Organization`
- **Reference**: `frontend/src/api/client.ts:252-253`

### `organizationsApi.delete(name: string)`
Delete an organization and all associated resources.
- **Endpoint**: `DELETE /api/v2/organizations/:name`
- **Reference**: `frontend/src/api/client.ts:258`
- **UI Implementation**: `frontend/src/pages/Organizations.tsx:346+`
- **Confirmation**: The frontend requires typing the organization name to confirm deletion
- **Cascade Deletion**: Deletes all related resources including projects, workspaces, runs, VCS connections, variable sets, registry modules/providers, Ansible resources, GPG keys, and API keys

---

## Projects API

**Implementation**: See `projectsApi` in `frontend/src/api/client.ts` (lines 257-268)

### `projectsApi.list(organizationName: string)`
List projects in an organization.
- **Endpoint**: `GET /api/v2/organizations/:org_name/projects`
- **Returns**: `{ data: Project[], meta: { pagination: ... } }`
- **Reference**: `frontend/src/api/client.ts:258-259`

### `projectsApi.get(organizationName: string, projectName: string)`
Get project by name.
- **Endpoint**: `GET /api/v2/organizations/:org_name/projects/:project_name`
- **Returns**: `Project`
- **Reference**: `frontend/src/api/client.ts:260-261`

### `projectsApi.create(organizationName: string, data)`
Create a project.
- **Endpoint**: `POST /api/v2/organizations/:org_name/projects`
- **Data**: `{ name: string; description?: string }`
- **Returns**: `Project`
- **Reference**: `frontend/src/api/client.ts:262-263`

### `projectsApi.update(organizationName: string, projectName: string, data)`
Update a project.
- **Endpoint**: `PATCH /api/v2/organizations/:org_name/projects/:project_name`
- **Data**: `{ name?: string; description?: string }`
- **Returns**: `Project`
- **Reference**: `frontend/src/api/client.ts:264-265`

### `projectsApi.delete(organizationName: string, projectName: string)`
Delete a project.
- **Endpoint**: `DELETE /api/v2/organizations/:org_name/projects/:project_name`
- **Reference**: `frontend/src/api/client.ts:266-267`

---

## Workspaces API

**Implementation**: See `workspacesApi` in `frontend/src/api/client.ts` (lines 270-298)

### `workspacesApi.list(organizationName: string)`
List workspaces in an organization.
- **Endpoint**: `GET /api/v2/organizations/:org_name/workspaces?format=simple`
- **Returns**: `{ data: Workspace[], meta: { pagination: ... } }`
- **Reference**: `frontend/src/api/client.ts:273-274`

### `workspacesApi.get(organizationName: string, workspaceName: string)`
Get workspace by name.
- **Endpoint**: `GET /api/v2/organizations/:org_name/workspaces/:workspace_name?format=simple`
- **Returns**: `Workspace`
- **Reference**: `frontend/src/api/client.ts:275-276`

### `workspacesApi.create(organizationName: string, data)`
Create a workspace.
- **Endpoint**: `POST /api/v2/organizations/:org_name/workspaces`
- **Data**: See `frontend/src/api/client.ts:277-289` for full type definition
  - **run_timeout** (optional): Custom extension - Maximum duration for apply operations in seconds. Default: 7200 (2 hours). TFE-compatible clients will ignore this attribute.
- **Returns**: `Workspace`
- **Reference**: `frontend/src/api/client.ts:277-290`

### `workspacesApi.update(organizationName: string, workspaceName: string, data)`
Update a workspace.
- **Endpoint**: `PATCH /api/v2/organizations/:org_name/workspaces/:workspace_name?format=simple`
- **Data**: Object with optional fields:
  - `name`: Workspace name
  - `description`: Workspace description
  - `vcs_connection_id`: VCS connection ID (string or null to remove)
  - `vcs_repository`: Repository identifier
  - `vcs_branch`: Git branch name
  - `working_directory`: Path within repository
  - `terraform_version`: Terraform version
  - `auto_queue_runs`: Boolean - Auto-queue runs on VCS push
  - `auto_apply`: Boolean - Auto-apply successful plans
  - `execution_mode`: "remote" | "local" | "agent"
  - `run-timeout`: Integer - Custom extension: timeout in seconds
- **Returns**: `Workspace`
- **UI Component**: `EditWorkspaceDialog` - `frontend/src/components/workspace/EditWorkspaceDialog.tsx`
- **Reference**: `frontend/src/api/client.ts:331-346`
- **Note**: Changing VCS connection, repository, or branch may invalidate existing state. The UI displays a warning for these changes.

### `workspacesApi.delete(organizationName: string, workspaceName: string)`
Delete a workspace.
- **Endpoint**: `DELETE /api/v2/organizations/:org_name/workspaces/:workspace_name`
- **Reference**: `frontend/src/api/client.ts:293-294`

### `workspacesApi.getById(id: string)`
Get workspace by UUID (Internal).
- **Endpoint**: `GET /api/v2/terraform/workspaces/:id`
- **Returns**: `Workspace`
- **Reference**: `frontend/src/api/client.ts:296-297`

---

## Runs API (TFE-Compatible)

**Implementation**: See `runsApi` in `frontend/src/api/client.ts` (lines 391-532)

### `runsApi.list(workspaceId: string)`
List runs for a workspace.
- **Endpoint**: `GET /api/v2/workspaces/:workspace_id/runs`
- **Returns**: `JsonApiResponse<JsonApiResource[]>`
- **Reference**: `frontend/src/api/client.ts:394-395`

### `runsApi.get(id: string)`
Get run by ID.
- **Endpoint**: `GET /api/v2/runs/:id`
- **Returns**: `JsonApiResponse<JsonApiResource>`
- **Reference**: `frontend/src/api/client.ts:399-400`

### `runsApi.create(data)`
Create a run.
- **Endpoint**: `POST /api/v2/runs`
- **Data**: See `frontend/src/api/client.ts:402-436` for full type definition and JSON:API structure
- **Returns**: `JsonApiResponse<JsonApiResource>`
- **Reference**: `frontend/src/api/client.ts:402-436`

### `runsApi.apply(id: string)`
Apply a run.
- **Endpoint**: `POST /api/v2/runs/:id/actions/apply`
- **Reference**: `frontend/src/api/client.ts:439-441`

### `runsApi.cancel(id: string)`
Cancel a run.
- **Endpoint**: `POST /api/v2/runs/:id/actions/cancel`
- **Reference**: `frontend/src/api/client.ts:443-445`

### `runsApi.discard(id: string)`
Discard a run.
- **Endpoint**: `POST /api/v2/runs/:id/actions/discard`
- **Reference**: `frontend/src/api/client.ts:447-449`

### `runsApi.getPlan(id: string)`
Get plan output JSON.
- **Endpoint**: `GET /api/v2/runs/:id/plan`
- **Returns**: Plan JSON object
- **Reference**: `frontend/src/api/client.ts:451-453`

### `runsApi.getLogs(id: string)`
Get run logs as text.
- **Endpoint**: `GET /api/v2/runs/:id/logs`
- **Returns**: `string` (raw text)
- **Reference**: `frontend/src/api/client.ts:455-457`

---

## Variables API (TFE-Compatible)

**Implementation**: See `variablesApi` in `frontend/src/api/client.ts` (lines 584-605)

**TFE Specification Reference**: [Workspace Variables API](https://developer.hashicorp.com/terraform/enterprise/api-docs/workspace-variables)

**Note**: All variable operations use JSON:API format. The frontend API client handles conversion between JSON:API and simple Variable objects for UI compatibility.

### `variablesApi.list(workspaceId: string)`
List variables for a workspace.
- **Endpoint**: `GET /api/v2/workspaces/:workspace_id/variables`
- **Returns**: `Variable[]` (converted from JSON:API format)
- **TFE Spec**: `GET /api/v2/workspaces/:workspace_id/vars`
- **Reference**: `frontend/src/api/client.ts:585-600`

### `variablesApi.create(workspaceId: string, data)`
Create a variable using JSON:API format.
- **Endpoint**: `POST /api/v2/workspaces/:workspace_id/variables`
- **Data**: `{ key: string; value: string; description?: string; category?: 'terraform' | 'env'; hcl?: boolean; sensitive?: boolean }`
  - Internally sends JSON:API format: `{ data: { type: 'vars', attributes: {...} } }`
- **Returns**: `Variable` (converted from JSON:API response)
- **TFE Spec**: `POST /api/v2/workspaces/:workspace_id/vars`
- **Reference**: `frontend/src/api/client.ts:601-625`

### `variablesApi.update(workspaceId: string, variableId: string, data)`
Update a variable using JSON:API format.
- **Endpoint**: `PATCH /api/v2/workspaces/:workspace_id/variables/:variable_id`
- **Data**: `{ key?: string; value?: string; description?: string; category?: 'terraform' | 'env'; hcl?: boolean; sensitive?: boolean }`
  - Internally sends JSON:API format: `{ data: { id: '...', type: 'vars', attributes: {...} } }`
- **Returns**: `Variable` (converted from JSON:API response)
- **TFE Spec**: `PATCH /api/v2/workspaces/:workspace_id/vars/:variable_id`
- **Reference**: `frontend/src/api/client.ts:626-650`

### `variablesApi.delete(workspaceId: string, variableId: string)`
Delete a variable.
- **Endpoint**: `DELETE /api/v2/workspaces/:workspace_id/vars/:variable_id`
- **TFE Spec**: `DELETE /api/v2/workspaces/:workspace_id/vars/:variable_id`
- **Reference**: `frontend/src/api/client.ts:651-652`

---

## Variable Sets API (TFE-Compatible)

**Implementation**: See `variableSetsApi` in `frontend/src/api/client.ts` (lines 607-822)

**TFE Specification Reference**: [Variable Sets API](https://developer.hashicorp.com/terraform/enterprise/api-docs/variable-sets)

**Note**: All variable set operations use JSON:API format and TFE-compliant endpoints (`/varsets`).

### `variableSetsApi.list(organizationName: string)`
List variable sets for an organization.
- **Endpoint**: `GET /api/v2/organizations/:organization_name/varsets`
- **Returns**: `VariableSet[]` (converted from JSON:API format)
- **TFE Spec**: `GET /api/v2/organizations/:organization_name/varsets`
- **Reference**: `frontend/src/api/client.ts:608-656`

### `variableSetsApi.get(organizationName: string, id: string)`
Get a variable set by ID.
- **Endpoint**: `GET /api/v2/varsets/:id`
- **Returns**: `VariableSet` (converted from JSON:API format)
- **TFE Spec**: `GET /api/v2/varsets/:varset_id`
- **Reference**: `frontend/src/api/client.ts:683-756`

### `variableSetsApi.create(organizationName: string, data)`
Create a variable set using JSON:API format.
- **Endpoint**: `POST /api/v2/organizations/:organization_name/varsets`
- **Data**: `{ name: string; description?: string; scope?: 'organization' | 'workspace' }`
  - Internally sends JSON:API format: `{ data: { type: 'variable-sets', attributes: {...} } }`
- **Returns**: `VariableSet` (converted from JSON:API response)
- **TFE Spec**: `POST /api/v2/organizations/:organization_name/varsets`
- **Reference**: `frontend/src/api/client.ts:757-767`

### `variableSetsApi.update(organizationName: string, id: string, data)`
Update a variable set using JSON:API format.
- **Endpoint**: `PATCH /api/v2/varsets/:id`
- **Data**: `{ name?: string; description?: string; scope?: 'organization' | 'workspace' }`
  - Internally sends JSON:API format: `{ data: { type: 'variable-sets', attributes: {...} } }`
- **Returns**: `VariableSet` (converted from JSON:API response)
- **TFE Spec**: `PUT/PATCH /api/v2/varsets/:varset_id`
- **Reference**: `frontend/src/api/client.ts:768-778`

### `variableSetsApi.delete(organizationName: string, id: string)`
Delete a variable set.
- **Endpoint**: `DELETE /api/v2/varsets/:id`
- **TFE Spec**: `DELETE /api/v2/varsets/:varset_id`
- **Reference**: `frontend/src/api/client.ts:779-780`

### Variable Set Variables

#### `variableSetsApi.listVariables(organizationName: string, variableSetId: string)`
List variables in a variable set.
- **Endpoint**: `GET /api/v2/varsets/:varset_id/relationships/vars`
- **Returns**: `VariableSetVariable[]` (converted from JSON:API format)
- **TFE Spec**: `GET /api/v2/varsets/:varset_id/relationships/vars`
- **Reference**: `frontend/src/api/client.ts:790-791`

#### `variableSetsApi.createVariable(organizationName: string, variableSetId: string, data)`
Add a variable to a variable set using JSON:API format.
- **Endpoint**: `POST /api/v2/varsets/:varset_id/relationships/vars`
- **Data**: `{ key: string; value: string; description?: string; category?: 'terraform' | 'env'; hcl?: boolean; sensitive?: boolean }`
  - Internally sends JSON:API format: `{ data: { type: 'vars', attributes: {...} } }`
- **Returns**: `VariableSetVariable` (converted from JSON:API response)
- **TFE Spec**: `POST /api/v2/varsets/:varset_id/relationships/vars`
- **Reference**: `frontend/src/api/client.ts:792-805`

#### `variableSetsApi.updateVariable(organizationName: string, variableSetId: string, variableId: string, data)`
Update a variable in a variable set using JSON:API format.
- **Endpoint**: `PATCH /api/v2/varsets/:varset_id/relationships/vars/:variable_id`
- **Data**: `{ key?: string; value?: string; description?: string; category?: 'terraform' | 'env'; hcl?: boolean; sensitive?: boolean }`
  - Internally sends JSON:API format: `{ data: { type: 'vars', attributes: {...} } }`
- **Returns**: `VariableSetVariable` (converted from JSON:API response)
- **TFE Spec**: `PATCH /api/v2/varsets/:varset_id/relationships/vars/:var_id`
- **Reference**: `frontend/src/api/client.ts:806-819`

#### `variableSetsApi.deleteVariable(organizationName: string, variableSetId: string, variableId: string)`
Delete a variable from a variable set.
- **Endpoint**: `DELETE /api/v2/varsets/:varset_id/relationships/vars/:variable_id`
- **TFE Spec**: `DELETE /api/v2/varsets/:varset_id/relationships/vars/:var_id`
- **Reference**: `frontend/src/api/client.ts:820-821`

---

## Variable Sets API

**Implementation**: See `variableSetsApi` in `frontend/src/api/client.ts` (lines 556-771)

### `variableSetsApi.list(organizationName: string)`
List variable sets.
- **Endpoint**: `GET /api/v2/organizations/:org_name/variable-sets`
- **Returns**: `VariableSet[]` (parsed from JSON:API format)
- **Reference**: `frontend/src/api/client.ts:557-631`

### `variableSetsApi.get(organizationName: string, id: string)`
Get variable set.
- **Endpoint**: `GET /api/v2/organizations/:org_name/variable-sets/:id`
- **Returns**: `VariableSet` (parsed from JSON:API format)
- **Reference**: `frontend/src/api/client.ts:632-704`

### `variableSetsApi.create(organizationName: string, data)`
Create variable set.
- **Endpoint**: `POST /api/v2/organizations/:org_name/variable-sets`
- **Data**: See `frontend/src/api/client.ts:706-710` for type definition
- **Returns**: `VariableSet`
- **Reference**: `frontend/src/api/client.ts:706-716`

### `variableSetsApi.update(organizationName: string, id: string, data)`
Update variable set.
- **Endpoint**: `PATCH /api/v2/organizations/:org_name/variable-sets/:id`
- **Data**: See `frontend/src/api/client.ts:717-721` for type definition
- **Returns**: `VariableSet`
- **Reference**: `frontend/src/api/client.ts:717-727`

### `variableSetsApi.delete(organizationName: string, id: string)`
Delete variable set.
- **Endpoint**: `DELETE /api/v2/organizations/:org_name/variable-sets/:id`
- **Reference**: `frontend/src/api/client.ts:728-729`

### `variableSetsApi.assignWorkspace(...)` / `unassignWorkspace(...)`
Assign/Unassign workspace to variable set.
- **Reference**: `frontend/src/api/client.ts:730-733`

### `variableSetsApi.assignProject(...)` / `unassignProject(...)`
Assign/Unassign project to variable set.
- **Reference**: `frontend/src/api/client.ts:734-737`

### Variable Set Variables Management
- `listVariables`: `frontend/src/api/client.ts:739-740`
- `createVariable`: `frontend/src/api/client.ts:741-754`
- `updateVariable`: `frontend/src/api/client.ts:755-768`
- `deleteVariable`: `frontend/src/api/client.ts:769-770`

---

## VCS Connections API

**Implementation**: See `vcsConnectionsApi` in `frontend/src/api/client.ts` (lines 321-376)

### `vcsConnectionsApi.list(organizationName: string)`
List VCS connections.
- **Endpoint**: `GET /api/v2/organizations/:org_name/vcs-connections`
- **Returns**: `VCSConnection[]` (parsed from JSON:API format)
- **Reference**: `frontend/src/api/client.ts:322-330`

### `vcsConnectionsApi.initiateInstallation(organizationName: string)`
Initiate GitHub App installation flow.
- **Endpoint**: `GET /api/v2/organizations/:org_name/vcs-connections/github/install`
- **Returns**: `{ install_url: string }`
- **Reference**: `frontend/src/api/client.ts:331-332`

### `vcsConnectionsApi.createConnectionFromInstallation(organizationName: string, installationId: string)`
Create VCS connection from GitHub installation.
- **Endpoint**: `POST /api/v2/organizations/:org_name/vcs-connections/github/installations/:installation_id`
- **Reference**: `frontend/src/api/client.ts:337-341`

### `vcsConnectionsApi.create(organizationName: string, data)`
Create VCS connection manually.
- **Endpoint**: `POST /api/v2/organizations/:org_name/vcs-connections`
- **Data**: See `frontend/src/api/client.ts:344-352` for type definition
- **Returns**: `VCSConnection`
- **Reference**: `frontend/src/api/client.ts:344-353`

### `vcsConnectionsApi.listRepositories(id: string, page?, perPage?)`
List repositories for a connection.
- **Endpoint**: `GET /api/v2/vcs-connections/:id/repositories`
- **Returns**: `{ data: Repository[], meta: { pagination: ... } }`
- **Reference**: `frontend/src/api/client.ts:356-361`

### `vcsConnectionsApi.listBranches(id: string, owner: string, repo: string, page?, perPage?)`
List branches for a repository.
- **Endpoint**: `GET /api/v2/vcs-connections/:id/repositories/:owner/:repo/branches`
- **Returns**: `{ data: Branch[], meta: { pagination: ... } }`
- **Reference**: `frontend/src/api/client.ts:363-368`

### `vcsConnectionsApi.getFileContent(id: string, owner: string, repo: string, path: string, ref?: string)`
Get file content from repository.
- **Endpoint**: `GET /api/v2/vcs-connections/:id/repositories/:owner/:repo/contents/:path`
- **Returns**: `{ data: { content: string; path: string; ref: string } }`
- **Reference**: `frontend/src/api/client.ts:370-374`

---

## Registry API

**Implementation**: See `registryApi` in `frontend/src/api/client.ts` (lines 979+)

For complete Registry API methods, refer to `frontend/src/api/client.ts` starting at line 979. The registry API includes:
- Module management (list, get, create, delete, versions)
- Provider management
- Version publishing and deletion

All methods follow the same pattern as other APIs and are documented in the source file.

---

## Settings API

**Implementation**: See `settingsApi` and `twoFactorApi` in `frontend/src/api/client.ts` (lines 773-853)

### `settingsApi.getProfile()`
Get user profile.
- **Endpoint**: `GET /api/v2/settings/profile`
- **Returns**: `UserProfile`
- **Reference**: `frontend/src/api/client.ts:841`

### `settingsApi.updateProfile(data)`
Update user profile.
- **Endpoint**: `PATCH /api/v2/settings/profile`
- **Data**: `Partial<UserProfile>`
- **Reference**: `frontend/src/api/client.ts:842-843`

### `settingsApi.listApiKeys()`
List API keys.
- **Endpoint**: `GET /api/v2/settings/api-keys`
- **Returns**: `{ api_keys: ApiKey[] }`
- **Reference**: `frontend/src/api/client.ts:848`

### `settingsApi.createApiKey(data)`
Create API key.
- **Endpoint**: `POST /api/v2/settings/api-keys`
- **Data**: See `frontend/src/api/client.ts:849` for type definition
- **Returns**: `CreateApiKeyResponse` (includes token - only shown once)
- **Reference**: `frontend/src/api/client.ts:849-850`

### `settingsApi.deleteApiKey(id: string)`
Delete API key.
- **Endpoint**: `DELETE /api/v2/settings/api-keys/:id`
- **Reference**: `frontend/src/api/client.ts:851-852`

### `twoFactorApi`
Methods for managing 2FA.
- **Implementation**: `frontend/src/api/client.ts:773-779`
- **Methods**: `getStatus()`, `start()`, `verify(code)`, `remove()`, `listDevices()`

---

## Type Definitions

All TypeScript interfaces and types are defined in `frontend/src/api/client.ts`. Key types:

- **Organization**: See `frontend/src/api/client.ts:195-201`
- **Project**: See `frontend/src/api/client.ts:203-210`
- **Workspace**: See `frontend/src/api/client.ts:212-230`
- **Run**: See `frontend/src/api/client.ts:232-244` (note: runs use JSON:API format, see `JsonApiResource` type)
- **Variable**: See `frontend/src/api/client.ts:235-244`
- **VCSConnection**: See `frontend/src/api/client.ts:312-320`
- **Repository**: See `frontend/src/api/client.ts:300-310`
- **Branch**: See `frontend/src/api/client.ts:312-319`
- **StateVersion**: See `frontend/src/api/client.ts:378-389`

For complete type definitions, refer to the source file directly.
