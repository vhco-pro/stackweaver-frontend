<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Organization, Project, and Workspace Settings – Implementation Plan

**Status:** ❌ Not implemented — no `organization_settings`, `project_settings`, or `workspace_settings` models, repositories, or API handlers exist yet.

## Overview

Add **organization-, project-, and workspace-level settings** as JSONB-backed resources with GET/PUT APIs. Each level has its own table and is linked by FK. Inheritance (merging user → org → project → workspace) is optional in the first version.

**GitHub issue:** [#96](https://github.com/michielvha/stackweaver/issues/96)

## Scope

| Level | Table | Parent | API prefix |
|-------|-------|--------|------------|
| Organization | `organization_settings` | `organizations.id` | `GET/PUT /api/v2/organizations/:name/settings` |
| Project | `project_settings` | `projects.id` | `GET/PUT /api/v2/organizations/:name/projects/:project_name/settings` |
| Workspace | `workspace_settings` | `workspaces.id` | `GET/PUT /api/v2/organizations/:name/workspaces/:workspace_name/settings` |

**Out of scope for v1:** `users.settings` JSONB, settings inheritance/merging, and a dedicated settings UI (can be follow-ups).

---

## 1. Data Model

### 1.1 Tables

**`organization_settings`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, default `uuid_generate_v4()` |
| `organization_id` | UUID | UNIQUE, NOT NULL, FK → `organizations(id)` ON DELETE CASCADE |
| `settings` | JSONB | NOT NULL, default `'{}'` |
| `created_at` | TIMESTAMP | NOT NULL |
| `updated_at` | TIMESTAMP | NOT NULL |

**`project_settings`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, default `uuid_generate_v4()` |
| `project_id` | UUID | UNIQUE, NOT NULL, FK → `projects(id)` ON DELETE CASCADE |
| `settings` | JSONB | NOT NULL, default `'{}'` |
| `created_at` | TIMESTAMP | NOT NULL |
| `updated_at` | TIMESTAMP | NOT NULL |

**`workspace_settings`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, default `uuid_generate_v4()` |
| `workspace_id` | VARCHAR(20) | UNIQUE, NOT NULL, FK → `workspaces(id)` ON DELETE CASCADE |
| `settings` | JSONB | NOT NULL, default `'{}'` |
| `created_at` | TIMESTAMP | NOT NULL |
| `updated_at` | TIMESTAMP | NOT NULL |

Note: `workspaces.id` is a string (e.g. `ws-xxx`), so `workspace_settings.workspace_id` must match.

### 1.2 Example `settings` shapes (non-normative)

- **Organization:** `notifications` (on_run_failure, on_run_success, on_cost_threshold), `cost_management`, `runner_pool`, `security`, `integrations` (slack_webhook, pagerduty_key).
- **Project:** `terraform` (default_version, auto_apply, plan_timeout), `vcs_integration`, `workspace_defaults`.
- **Workspace:** `terraform_backend`, `variables` (auto_load, encryption, sensitive_keys), `execution` (parallelism, refresh, target).

We do **not** enforce a JSON schema in v1; consumers can validate. The API accepts and returns `settings` as arbitrary JSON.

---

## 2. Models and Repositories

### 2.1 Models

- **File:** `backend/internal/models/organization_settings.go`
  - `OrganizationSettings` with `OrganizationID`, `Settings` (e.g. `datatypes.JSON` or `pq.GenericArray`/JSONB mapping), `CreatedAt`, `UpdatedAt`, and `Organization` FK for preload if needed.
- **File:** `backend/internal/models/project_settings.go`
  - `ProjectSettings` with `ProjectID`, `Settings`, timestamps, `Project` FK.
- **File:** `backend/internal/models/workspace_settings.go`
  - `WorkspaceSettings` with `WorkspaceID` (string), `Settings`, timestamps, `Workspace` FK.

### 2.2 Repositories

- **`OrganizationSettingsRepository`**
  - `GetByOrganizationID(ctx, orgID uuid.UUID) (*OrganizationSettings, error)`  
    - If not found, return `nil, nil` or a struct with `Settings: {}`; handlers treat “no row” as `{}`.
  - `Upsert(ctx, s *OrganizationSettings) error`  
    - `ON CONFLICT (organization_id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = NOW()` or GORM equivalent (e.g. `Clauses(clause.OnConflict{...}).Create` or `Save`).
- **`ProjectSettingsRepository`**
  - `GetByProjectID(ctx, projectID uuid.UUID) (*ProjectSettings, error)`
  - `Upsert(ctx, s *ProjectSettings) error`
- **`WorkspaceSettingsRepository`**
  - `GetByWorkspaceID(ctx, workspaceID string) (*WorkspaceSettings, error)`
  - `Upsert(ctx, s *WorkspaceSettings) error`

Implementation: `backend/internal/repository/` (e.g. `organization_settings.go`, `project_settings.go`, `workspace_settings.go`).

---

## 3. Handlers and Routes

### 3.1 API Contract

- **GET** returns `{ "data": { "attributes": { "settings": { ... } } } }` or a simple `{ "settings": { ... } }` as decided for v2 style. Prefer a structure consistent with other v2 endpoints (e.g. JSON:API or a small wrapper).
- **PUT** body: `{ "settings": { ... } }`. Replaces the entire `settings` object (full replace, not deep merge) for v1. Respond with the same shape as GET.
- **404** if the parent (org, project, workspace) does not exist or the user has no access. **403** if the user lacks the required permission.

### 3.2 Permission (team-based RBAC)

- **Organization settings**
  - **Read:** `org:read` or equivalent (e.g. `checkOrgPermission(..., PermissionOrgRead)` or the team-based org read).
  - **Write:** `org:admin` or equivalent (e.g. `PermissionOrgAdmin` or team-based org admin). See `backend/internal/services/rbac/service.go` for `checkOrgPermission` and `PermissionOrgManage*`.
- **Project settings**
  - **Read:** `project:read` (or team-based project read).
  - **Write:** `project:write` (or team-based project write).
- **Workspace settings**
  - **Read:** `workspace:read`.
  - **Write:** `workspace:write`.

Resolve org by `:name`, project by `:project_name` under that org, workspace by `:workspace_name` under that org (workspace names are unique per project; the route may require project or we resolve workspace from `organizations/:name/workspaces/:workspace_name` if such a path exists). Check existing v2 patterns: `organizations/:name/workspaces/:workspace_name` is used in `tfWorkspaces`; project is implied by the workspace. For a cleaner hierarchy we can use:

- `GET/PUT /api/v2/organizations/:name/settings`
- `GET/PUT /api/v2/organizations/:name/projects/:project_name/settings`
- `GET/PUT /api/v2/organizations/:name/workspaces/:workspace_name/settings`

Workspace names are unique within org (workspace belongs to a single project). We can resolve workspace from `:name` and `:workspace_name` by looking up the workspace in that org (e.g. via project → workspace or by a unique constraint on (org, workspace_name) if it exists). Confirm in `backend/internal/repository` how workspace is fetched by org+name; if it’s via project, we may need `:project_name` in the path or we accept that the backend resolves project from the workspace. For the plan, assume a route like `organizations/:name/workspaces/:workspace_name/settings` and resolve the workspace using existing helpers (e.g. `GetByOrganizationAndName`-style).

### 3.3 Handlers

- **`OrganizationSettingsHandler`** (or methods on a `SettingsHandler`)
  - `GetOrganizationSettings(c *gin.Context)`  
    - Resolve org from `c.Param("name")`, check read permission, `repo.GetByOrganizationID(org.ID)`, return `{}` when not found, else `settings`.
  - `UpdateOrganizationSettings(c *gin.Context)`  
    - Resolve org, check write (admin) permission, bind `{ "settings": ... }`, validate non-nil (and optionally shallow structure), `repo.Upsert(orgID, settings)`, return same as GET.
- **`ProjectSettingsHandler`**
  - `GetProjectSettings`, `UpdateProjectSettings`  
    - Resolve project from `:name` and `:project_name` (org already from `:name`), check project read/write, then Get/Upsert.
- **`WorkspaceSettingsHandler`**
  - `GetWorkspaceSettings`, `UpdateWorkspaceSettings`  
    - Resolve workspace from `:name` and `:workspace_name`, check workspace read/write, then Get/Upsert. Use `workspace.ID` (string) for `WorkspaceSettingsRepository`.

Reuse existing patterns for `GetOrganization`, `GetProject`, `GetWorkspace` (by name) and for `rbacService.CheckResourcePermission` / `checkOrgPermission` from `organizations.go`, `projects.go`, `terraform/workspaces.go`.

### 3.4 Routes

- In `backend/internal/api/v2/routes/routes.go`:
  - `GET /api/v2/organizations/:name/settings` → `GetOrganizationSettings`
  - `PUT /api/v2/organizations/:name/settings` → `UpdateOrganizationSettings`
  - `GET /api/v2/organizations/:name/projects/:project_name/settings` → `GetProjectSettings`
  - `PUT /api/v2/organizations/:name/projects/:project_name/settings` → `UpdateProjectSettings`
  - `GET /api/v2/organizations/:name/workspaces/:workspace_name/settings` → `GetWorkspaceSettings`
  - `PUT /api/v2/organizations/:name/workspaces/:workspace_name/settings` → `UpdateWorkspaceSettings`

All under the existing v2 auth middleware. If `project_name` in the routes is actually `:name` in the projects group, align with `projects` definition (e.g. `:project_name` or `:name` consistently; in `projects` it’s `:project_name` in the URL segments we use). Use the same param names as existing project/workspace routes for consistency.

---

## 4. Migrations and Wiring

### 4.1 AutoMigrate

- In `backend/cmd/api/main.go`, add to `db.AutoMigrate(...)`:
  - `&models.OrganizationSettings{}`
  - `&models.ProjectSettings{}`
  - `&models.WorkspaceSettings{}`

### 4.2 Wiring in `routes.go`

- Create `OrganizationSettingsRepository`, `ProjectSettingsRepository`, `WorkspaceSettingsRepository`.
- Create the settings handler(s) with repos and `rbacService` (and any `authService` or `orgRepo`/`projectRepo`/`workspaceRepo` needed to resolve parents).
- Register the six routes in the appropriate `v2` groups (under `organizations/:name` and `organizations/:name/projects/:project_name` and `organizations/:name/workspaces/:workspace_name`). Ensure the `:workspace_name` route lives under the same group that defines `:workspace_name` (e.g. `tfWorkspaces` or a sibling) so param names match.

---

## 5. Validation and Security

- **JSON size:** Consider a limit on `settings` byte size (e.g. 64KB–256KB) to avoid abuse.
- **Keys:** We do not enforce an allowlist of keys in v1. Optional: block obviously dangerous keys (e.g. if used as interpolation targets) or reserve `_`-prefixed keys for future use.
- **Injection:** Rely on JSON serialization; do not interpolate `settings` into raw SQL. Use parameterized/ORM writes.

---

## 6. Inheritance (Deferred)

- The legacy design describes merging: user → org → project → workspace. For v1 we do **not** implement merging; each level is independent. A later plan can add a “resolved settings” endpoint that merges levels for a given workspace context.

---

## 7. Frontend (Deferred)

- No dedicated settings UI in this plan. Frontend can call the new endpoints when we add org/project/workspace settings screens.

---

## 8. Code References

- **Routes:** `backend/internal/api/v2/routes/routes.go` (e.g. `projects := v2.Group("/organizations/:name/projects")`, `tfWorkspaces := v2.Group("/organizations/:name/workspaces")`)
- **Organizations:** `backend/internal/api/v2/handlers/organizations.go`
- **Projects:** `backend/internal/api/v2/handlers/projects.go` (param `:project_name` or `:name` in project routes)
- **Workspaces:** `backend/internal/api/v2/handlers/terraform/workspaces.go` (param `:workspace_name`)
- **RBAC:** `backend/internal/services/rbac/service.go` (`checkOrgPermission`, `CheckResourcePermission`, `CheckWorkspacePermission`, permission constants)
- **Variable sets (similar JSONB resource):** `backend/internal/api/v2/handlers/variable_sets.go`, `backend/internal/models/variable_set.go`, `backend/internal/repository/` for patterns on Get/Upsert and JSON handling.

---

## 9. Success Criteria

- [ ] `organization_settings`, `project_settings`, `workspace_settings` tables exist (AutoMigrate or equivalent).
- [ ] Repositories: GetByOrganizationID, GetByProjectID, GetByWorkspaceID; Upsert for each.
- [ ] Six endpoints implemented and registered: GET/PUT for org, project, workspace settings.
- [ ] Permissions: org read/admin for org settings; project read/write for project settings; workspace read/write for workspace settings, using the current team-based RBAC.
- [ ] GET returns `{}` when no row exists; PUT does full replace of `settings`.
- [ ] Parent resolution by `:name`, `:project_name`, `:workspace_name` matches existing v2 patterns and returns 404 when the parent is missing or not accessible.
