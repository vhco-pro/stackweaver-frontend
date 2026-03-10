<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Database Relations, Permissions Flow, and Security Implementation

This document provides a comprehensive overview of the database schema, relationships, permission system, data storage strategy, and secure implementation plan for the IaC Orchestration Platform.

## Table of Contents

1. [Implementation Status (Situation Report)](#implementation-status-situation-report)
2. [Database Schema Overview](#database-schema-overview)
3. [Entity Relationship Diagram](#entity-relationship-diagram)
4. [Database Relations and Foreign Keys](#database-relations-and-foreign-keys)
5. [Permission System Architecture](#permission-system-architecture)
6. [Permission Flow](#permission-flow)
7. [Data Storage Strategy](#data-storage-strategy)
8. [Identity Mapping (Zitadel ↔ Local Database)](#identity-mapping-zitadel--local-database)
9. [Settings Storage Architecture](#settings-storage-architecture)
10. [Security Implementation Plan](#security-implementation-plan)
11. [Migration Strategy](#migration-strategy)

---

## Implementation Status (Situation Report)

This section reflects the **current implementation** as of the last audit. The rest of the document describes the original design; where reality differs, it is noted here and in callouts.

### ✅ Implemented and Aligned

| Area | Status |
|------|--------|
| **Core hierarchy** | Organization → Project → Workspace → Run, with FKs and cascades. |
| **Identity mapping** | `users.zitadel_subject`, `GetOrCreateByZitadelSubject`, auto-create on login. Local `user_id` (UUID) in context and all FKs. |
| **Auth** | JWT (Zitadel) + TFE token; middleware sets `user_id` in context. |
| **Audit logging** | `audit_logs` table; `activity.Service.LogActivity` used from handlers (no global AuditMiddleware). |
| **Rate limiting** | `IPRateLimiter` per-IP in main router. |
| **Variable encryption** | Workspace and variable-set variables: AES-256 via `variable.Service` and `ENCRYPTION_KEY`. |

### ⚠️ Implemented Differently

| Design | Implementation |
|--------|----------------|
| **Permission model** | **Team-based RBAC.** `OrganizationMember.role` is deprecated. Permissions come from `Team`, `TeamOrganizationAccess`, `TeamProjectAccess`, `TeamWorkspaceAccess`. `CheckPermission` always returns false; handlers use `CheckResourcePermission`, `CheckWorkspacePermission`, `checkOrgPermission`. |
| **RBAC middleware** | `RBACMiddleware` exists but is **not registered** on v2 routes. v2 uses `:name` for orgs; handlers resolve org and perform permission checks. |
| **IDs** | Workspace, Run, StateVersion, Variable use **prefixed string IDs** (`ws-`, `run-`, `sv-`, `var-`), not UUIDs. |
| **API** | v2 under `/api/v2/``. Orgs by **name**: `/organizations/:name`, `/organizations/:name/projects/:project_name`, etc. |
| **OrganizationMember** | **No** `zitadel_role` or `role_synced_at`. Only `id`, `organization_id`, `user_id`, `role` (deprecated), `created_at`. |
| **User** | **No** `settings` JSONB. Profile: `username`, `bio`, `company`, `location`. `GET/PATCH /api/v2/settings/profile` exist. |
| **Run logs (MinIO)** | Path: `runs/{run_id}/logs/{operation}.log` (e.g. `plan.log`, `apply.log`, `destroy.log`). Redis used for streaming during execution. |

### 🔴 Security Gaps (Not Implemented)

| Item | Design | Current | Priority |
|------|--------|---------|----------|
| **State file encryption** | State in MinIO encrypted with AES-256. | **State stored as plain JSON** in MinIO at `workspaces/{workspace_id}/state/{version}.json`. **No encryption** in the state service. | **High** — state may contain secrets. |
| **VCS connection tokens** | Access/refresh tokens encrypted at rest. | `VCSConnection.AccessToken` and `RefreshToken` stored **unencrypted**. Code has `// TODO: Encrypt`. | **High** — tokens grant repository and API access. |
| **Org / project / workspace settings** | `organization_settings`, `project_settings`, `workspace_settings` tables and CRUD APIs. | **Not implemented.** No such models, migrations, or endpoints. | Medium |
| **Zitadel role sync** | `zitadel_role`, `role_synced_at` on `OrganizationMember`; background sync. | **Not implemented.** Roles deprecated in favor of teams. | Low (by design) |
| **User `settings` JSONB** | Theme, notifications, `default_org`, etc. | **Not implemented.** | Low |
| **`users.settings`** | JSONB for theme, notifications, preferences. | **Not implemented.** | Low |

### State and Logs Paths (Actual)

- **State (MinIO):** `workspaces/{workspace_id}/state/{version}.json` — **not encrypted.**
- **Run logs (MinIO):** `runs/{run_id}/logs/{operation}.log` (e.g. `plan.log`, `apply.log`). During runs, logs also streamed via Redis.

---

## Database Schema Overview

### Core Entities

The platform uses a hierarchical resource model:

```
Organization (1) ──→ (N) Project (1) ──→ (N) Workspace (1) ──→ (N) Run
     │                      │                    │
     │                      │                    │
     └── (N) Member         │                    └── (N) Variable
                            │                    └── (N) StateVersion
                            │                    └── (N) StateLock
```

### Entity Hierarchy

1. **Organization**: Top-level organizational unit
   - Contains multiple Projects
   - Has multiple Members (Users with Roles)
   - Owns Organization-level Settings

2. **Project**: Project within an Organization
   - Belongs to one Organization
   - Contains multiple Workspaces
   - Has Project-level Settings

3. **Workspace**: IaC workspace (Terraform, Ansible, etc.)
   - Belongs to one Project
   - Contains multiple Runs
   - Has Workspace-level Variables
   - Has State Versions
   - Has State Locks

4. **User**: Local user account
   - Mapped from Zitadel Subject
   - Has User-level Settings
   - Can be a Member of multiple Organizations

5. **OrganizationMember**: Junction table linking Users to Organizations
   - Defines Role (admin, member, viewer)
   - Links Zitadel roles to local roles

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           DATABASE SCHEMA                              │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│    User      │
├──────────────┤
│ id (PK)      │◄─────┐
│ zitadel_subj │      │
│ email        │      │
│ name         │      │
│ settings     │      │
│ created_at   │      │
│ updated_at   │      │
└──────────────┘      │
                      │
                      │ (N)
┌─────────────────────┴──────────────────────┐
│      OrganizationMember                     │
├─────────────────────────────────────────────┤
│ id (PK)                                     │
│ organization_id (FK) ────────┐              │
│ user_id (FK) ────────────────┘              │
│ role (admin/member/viewer)                  │
│ zitadel_role                                │
│ role_synced_at                              │
│ created_at                                  │
│ updated_at                                  │
└─────────────────────────────────────────────┘
                      │
                      │ (1)
┌─────────────────────▼──────────────────────┐
│         Organization                        │
├─────────────────────────────────────────────┤
│ id (PK)                                     │
│ name (UNIQUE)                               │
│ description                                 │
│ created_at                                  │
│ updated_at                                  │
└─────────────────────────────────────────────┘
         │
         │ (1)
         │
         │ (N)
┌────────▼──────────┐
│      Project      │
├───────────────────┤
│ id (PK)           │
│ organization_id ──┘
│ name              │
│ description       │
│ created_at        │
│ updated_at        │
└───────────────────┘
         │
         │ (1)
         │
         │ (N)
┌────────▼──────────┐
│     Workspace     │
├───────────────────┤
│ id (PK)           │
│ project_id ───────┘
│ name              │
│ description       │
│ vcs_provider      │
│ vcs_repository    │
│ vcs_branch        │
│ terraform_version │
│ working_directory │
│ created_at        │
│ updated_at        │
└───────────────────┘
         │
         ├─── (N) ──► Run
         ├─── (N) ──► Variable
         ├─── (N) ──► StateVersion
         └─── (N) ──► StateLock

┌──────────────┐
│     Run      │
├──────────────┤
│ id (PK)      │
│ workspace_id │
│ created_by   │
│ status       │
│ operation    │
│ plan_output  │
│ error_msg    │
│ started_at   │
│ completed_at │
│ created_at   │
│ updated_at   │
└──────────────┘

┌──────────────┐
│   Variable   │
├──────────────┤
│ id (PK)      │
│ workspace_id │
│ key          │
│ value        │
│ encrypted    │
│ sensitive    │
│ created_at   │
│ updated_at   │
└──────────────┘

┌──────────────┐
│ StateVersion │
├──────────────┤
│ id (PK)      │
│ workspace_id │
│ version      │
│ state_data   │
│ serial       │
│ lineage      │
│ created_at   │
└──────────────┘

┌──────────────┐
│  StateLock   │
├──────────────┤
│ id (PK)      │
│ workspace_id │
│ lock_id      │
│ operation    │
│ locked_by    │
│ created_at   │
│ expires_at   │
└──────────────┘

┌──────────────┐
│  AuditLog    │
├──────────────┤
│ id (PK)      │
│ user_id      │
│ org_id       │
│ project_id   │
│ workspace_id │
│ action       │
│ resource_type│
│ resource_id  │
│ details      │
│ ip_address   │
│ user_agent   │
│ created_at   │
└──────────────┘
```

---

## Database Relations and Foreign Keys

### Primary Relationships

#### 1. User ↔ Organization (Many-to-Many via OrganizationMember)

```sql
-- Users can belong to multiple organizations
-- Organizations can have multiple users
-- Junction table: OrganizationMember

User (1) ──→ (N) OrganizationMember (N) ──→ (1) Organization
```

**Foreign Keys:**
- `OrganizationMember.user_id` → `User.id`
- `OrganizationMember.organization_id` → `Organization.id`
- **Unique Constraint**: `(organization_id, user_id)` - one role per user per org

**Cascade Behavior:**
- On User delete: CASCADE (remove all memberships)
- On Organization delete: CASCADE (remove all memberships)

#### 2. Organization → Project (One-to-Many)

```sql
-- One organization has many projects
-- Each project belongs to one organization

Organization (1) ──→ (N) Project
```

**Foreign Key:**
- `Project.organization_id` → `Organization.id`
- **Index**: `idx_org_project` on `(organization_id, name)` - unique project name per org

**Cascade Behavior:**
- On Organization delete: CASCADE (delete all projects)

#### 3. Project → Workspace (One-to-Many)

```sql
-- One project has many workspaces
-- Each workspace belongs to one project

Project (1) ──→ (N) Workspace
```

**Foreign Key:**
- `Workspace.project_id` → `Project.id`
- **Index**: `idx_project_workspace` on `(project_id, name)` - unique workspace name per project

**Cascade Behavior:**
- On Project delete: CASCADE (delete all workspaces)

#### 4. Workspace → Run (One-to-Many)

```sql
-- One workspace has many runs
-- Each run belongs to one workspace

Workspace (1) ──→ (N) Run
```

**Foreign Key:**
- `Run.workspace_id` → `Workspace.id`
- `Run.created_by` → `User.id` (nullable, for audit)

**Cascade Behavior:**
- On Workspace delete: CASCADE (delete all runs)

#### 5. Workspace → Variable (One-to-Many)

```sql
-- One workspace has many variables
-- Each variable belongs to one workspace

Workspace (1) ──→ (N) Variable
```

**Foreign Key:**
- `Variable.workspace_id` → `Workspace.id`
- **Unique Constraint**: `idx_workspace_key` on `(workspace_id, key)` - unique key per workspace

**Cascade Behavior:**
- On Workspace delete: CASCADE (delete all variables)

#### 6. Workspace → StateVersion (One-to-Many)

```sql
-- One workspace has many state versions
-- Each state version belongs to one workspace

Workspace (1) ──→ (N) StateVersion
```

**Foreign Key:**
- `StateVersion.workspace_id` → `Workspace.id`
- **Unique Constraint**: `idx_workspace_version` on `(workspace_id, version)` - sequential versions

**Cascade Behavior:**
- On Workspace delete: CASCADE (delete all state versions)

#### 7. Workspace → StateLock (One-to-Many)

```sql
-- One workspace can have multiple locks (different operations)
-- Each lock belongs to one workspace

Workspace (1) ──→ (N) StateLock
```

**Foreign Key:**
- `StateLock.workspace_id` → `Workspace.id`

**Cascade Behavior:**
- On Workspace delete: CASCADE (delete all locks)

#### 8. AuditLog (Polymorphic Relations)

```sql
-- AuditLog can reference any resource
-- Uses nullable foreign keys for flexibility

AuditLog.user_id → User.id (nullable)
AuditLog.organization_id → Organization.id (nullable)
AuditLog.project_id → Project.id (nullable)
AuditLog.workspace_id → Workspace.id (nullable)
```

**Cascade Behavior:**
- No cascades (audit logs are immutable, kept for compliance)

---

## Permission System Architecture

> **⚠️ Actual model is team-based**  
> The **implemented** permission model is **team-based**, not org-role-based.  
> Permissions come from `Team`, `TeamOrganizationAccess`, `TeamProjectAccess`, and `TeamWorkspaceAccess`.  
> `OrganizationMember.role` is deprecated and nullable. `CheckPermission` always returns false; handlers use `CheckResourcePermission`, `CheckWorkspacePermission`, and `checkOrgPermission`.  
> The role-based description below is **design / legacy**; for implementation see `backend/internal/services/rbac/service.go`.

### Permission Model

The platform uses **Role-Based Access Control (RBAC)** with hierarchical permissions:

```
Permission Hierarchy:
├── Organization Level
│   ├── org:read      (View organization)
│   ├── org:write     (Modify organization)
│   └── org:admin     (Full organization control)
│
├── Project Level
│   ├── project:read  (View project)
│   └── project:write (Modify project)
│
├── Workspace Level
│   ├── workspace:read  (View workspace)
│   └── workspace:write (Modify workspace)
│
└── Run Level
    ├── run:read   (View runs)
    └── run:write  (Create/modify runs)
```

### Role Definitions

```go
// Roles defined in backend/internal/services/rbac/service.go

const (
    RoleAdmin  Role = "admin"   // Full access
    RoleMember Role = "member"  // Read + Write (no admin)
    RoleViewer Role = "viewer"   // Read-only
)

// Permission mapping
var rolePermissions = map[Role][]Permission{
    RoleAdmin: {
        PermissionOrgRead, PermissionOrgWrite, PermissionOrgAdmin,
        PermissionProjectRead, PermissionProjectWrite,
        PermissionWorkspaceRead, PermissionWorkspaceWrite,
        PermissionRunRead, PermissionRunWrite,
    },
    RoleMember: {
        PermissionOrgRead,
        PermissionProjectRead, PermissionProjectWrite,
        PermissionWorkspaceRead, PermissionWorkspaceWrite,
        PermissionRunRead, PermissionRunWrite,
    },
    RoleViewer: {
        PermissionOrgRead,
        PermissionProjectRead,
        PermissionWorkspaceRead,
        PermissionRunRead,
    },
}
```

### Permission Inheritance

**Hierarchical Permission Model:**

1. **Organization-level permissions** apply to all resources within the organization
   - If user has `org:admin`, they have all permissions for all projects/workspaces in that org
   - If user has `org:read`, they can read all projects/workspaces

2. **Project-level permissions** are checked when accessing project-specific resources
   - Inherited from organization role, but can be overridden (future: project-specific roles)

3. **Workspace-level permissions** are checked when accessing workspace-specific resources
   - Inherited from project/organization role

**Current Implementation:**
- Permissions are checked at the **organization level only**
- All resources inherit permissions from the organization
- Future: Project-level and workspace-level role assignments

---

## Permission Flow

### Request Flow with Permission Checking

```
┌─────────────────────────────────────────────────────────────┐
│                    API Request Flow                            │
└─────────────────────────────────────────────────────────────┘

1. Client Request
   │
   │ GET /api/v1/organizations/:org_id/projects/:project_id/workspaces
   │ Authorization: Bearer <jwt_token>
   │
   ▼
2. CORS Middleware
   │
   │ - Check Origin header
   │ - Set CORS headers
   │ - Handle preflight (OPTIONS)
   │
   ▼
3. Authentication Middleware (auth/service.go)
   │
   │ - Extract Bearer token from Authorization header
   │ - Verify JWT signature with Zitadel JWKS
   │ - Validate token claims (iss, aud, exp)
   │ - Fetch user info from Zitadel userinfo endpoint
   │ - Map Zitadel subject to local User (auto-create if needed)
   │ - Store in context:
   │   • user_id (local UUID)
   │   • user_subject (Zitadel subject)
   │   • user_email
   │   • user_name
   │   • token_claims
   │
   ▼
4. RBAC Middleware (middleware/rbac.go)
   │
   │ - Extract organization_id from:
   │   • Path parameter: /organizations/:org_id/...
   │   • Query parameter: ?organization_id=...
   │   • Project/Workspace lookup (if org_id not in path)
   │
   │ - Get user_id from context
   │
   │ - Check permission:
   │   • Query OrganizationMember table
   │   • Get user's role in organization
   │   • Check if role has required permission
   │
   │ - If permission denied:
   │   • Return 403 Forbidden
   │   • Abort request
   │
   │ - If permission granted:
   │   • Store organization_id in context
   │   • Continue to handler
   │
   ▼
5. Request Handler (handlers/*.go)
   │
   │ - Get user_id from context
   │ - Get organization_id from context (if needed)
   │ - Execute business logic
   │ - Query database with proper scoping
   │ - Return response
   │
   ▼
6. Response
   │
   │ - JSON response
   │ - Status code
   │ - CORS headers (already set)
   │
   └──► Client
```

### Permission Check Implementation

```go
// backend/internal/services/rbac/service.go

func (s *Service) CheckPermission(
    ctx context.Context,
    userID uuid.UUID,
    organizationID uuid.UUID,
    permission Permission,
) (bool, error) {
    // 1. Query OrganizationMember table
    member, err := s.orgRepo.GetMember(organizationID, userID)
    if err != nil {
        // User is not a member of this organization
        return false, nil
    }
    
    // 2. Get role permissions
    role := Role(member.Role)
    permissions, ok := rolePermissions[role]
    if !ok {
        // Unknown role
        return false, nil
    }
    
    // 3. Check if role has required permission
    for _, p := range permissions {
        if p == permission {
            return true, nil
        }
    }
    
    return false, nil
}
```

### Permission Check Examples

#### Example 1: List Projects in Organization

```
Request: GET /api/v1/organizations/123/projects
Permission Required: org:read

Flow:
1. Auth middleware: Extract user_id from token → user_id = "abc-123"
2. RBAC middleware: Extract org_id from path → org_id = "123"
3. CheckPermission(user_id="abc-123", org_id="123", permission="org:read")
   → Query: SELECT * FROM organization_members 
            WHERE organization_id = '123' AND user_id = 'abc-123'
   → Result: { role: "member" }
   → Check: Does "member" role have "org:read"? → YES
4. Handler: Query projects WHERE organization_id = '123'
5. Return: List of projects
```

#### Example 2: Create Workspace (Denied)

```
Request: POST /api/v1/organizations/123/projects/456/workspaces
Permission Required: workspace:write

Flow:
1. Auth middleware: Extract user_id → user_id = "abc-123"
2. RBAC middleware: Extract org_id from path → org_id = "123"
3. CheckPermission(user_id="abc-123", org_id="123", permission="workspace:write")
   → Query: SELECT * FROM organization_members 
            WHERE organization_id = '123' AND user_id = 'abc-123'
   → Result: { role: "viewer" }
   → Check: Does "viewer" role have "workspace:write"? → NO
4. Return: 403 Forbidden
```

#### Example 3: Update Organization Settings (Admin Only)

```
Request: PUT /api/v1/organizations/123/settings
Permission Required: org:admin

Flow:
1. Auth middleware: Extract user_id → user_id = "abc-123"
2. RBAC middleware: Extract org_id from path → org_id = "123"
3. CheckPermission(user_id="abc-123", org_id="123", permission="org:admin")
   → Query: SELECT * FROM organization_members 
            WHERE organization_id = '123' AND user_id = 'abc-123'
   → Result: { role: "admin" }
   → Check: Does "admin" role have "org:admin"? → YES
4. Handler: Update organization settings
5. Return: Updated settings
```

---

## Data Storage Strategy

### Where Data is Stored

#### 1. User Data

**Location**: `users` table in PostgreSQL

**Stored:**
- `id`: Local UUID (primary key for all relationships)
- `zitadel_subject`: Zitadel user ID (unique, for identity mapping)
- `email`: User email (from Zitadel)
- `name`: User name (from Zitadel)
- `settings`: JSONB field for user preferences — *not in current schema; design only. Profile uses `username`, `bio`, `company`, `location` and `/api/v2/settings/profile`.*
  ```json
  {
    "theme": "dark",
    "notifications": {
      "email": true,
      "slack": false
    },
    "preferences": {
      "default_org": "org-uuid"
    }
  }
  ```

**Not Stored:**
- Passwords (handled by Zitadel)
- OAuth tokens (stored in browser sessionStorage)
- Zitadel roles (fetched on-demand or synced periodically)

#### 2. Organization Data

**Location**: `organizations` table in PostgreSQL

**Stored:**
- `id`: UUID
- `name`: Unique organization name
- `description`: Organization description
- `created_at`, `updated_at`: Timestamps

**Settings Location**: `organization_settings` table (to be created)
```json
{
  "notifications": {
    "on_run_failure": true,
    "on_run_success": false
  },
  "cost_limits": {
    "monthly_budget": 1000,
    "alert_threshold": 0.8
  },
  "runner_pool": {
    "default_pool": "shared",
    "auto_scale": true
  }
}
```

#### 3. Organization Membership

**Location**: `organization_members` table in PostgreSQL

**Stored:**
- `id`: UUID
- `organization_id`: FK to organizations
- `user_id`: FK to users
- `role`: Local role (admin, member, viewer) — *deprecated; nullable. Permissions are team-based in the current implementation.*
- `zitadel_role`: Zitadel role (for sync reference, optional) — *not in current schema*
- `role_synced_at`: Timestamp of last Zitadel sync — *not in current schema*

**Unique Constraint**: `(organization_id, user_id)` - one role per user per org

#### 4. Project Data

**Location**: `projects` table in PostgreSQL

**Stored:**
- `id`: UUID
- `organization_id`: FK to organizations
- `name`: Unique within organization
- `description`: Project description

**Settings Location**: `project_settings` table (to be created)
```json
{
  "terraform_version": "1.5.0",
  "auto_apply": false,
  "vcs_integration": {
    "provider": "github",
    "auto_plan_on_push": true
  }
}
```

#### 5. Workspace Data

**Location**: `workspaces` table in PostgreSQL

**Stored:**
- `id`: UUID
- `project_id`: FK to projects
- `name`: Unique within project
- `description`: Workspace description
- `vcs_provider`: VCS provider (github, gitlab, etc.)
- `vcs_repository`: Repository URL
- `vcs_branch`: Git branch
- `terraform_version`: Terraform version
- `working_directory`: Terraform working directory

**Settings Location**: `workspace_settings` table (to be created)
```json
{
  "terraform_backend": {
    "type": "s3",
    "bucket": "terraform-state",
    "key": "workspace/state"
  },
  "variables": {
    "auto_load": true,
    "encryption": "aes256"
  }
}
```

#### 6. Run Data

**Location**: `runs` table in PostgreSQL

**Stored:**
- `id`: UUID
- `workspace_id`: FK to workspaces
- `created_by`: FK to users (nullable, for audit)
- `status`: pending, running, completed, failed, cancelled
- `operation`: plan, apply, destroy
- `plan_output`: JSONB (Terraform plan output)
- `error_message`: Error message if failed
- `started_at`, `completed_at`: Timestamps

**Logs Location**: MinIO (object storage)
- Path: `runs/{run_id}/logs/{operation}.log` (e.g. `plan.log`, `apply.log`, `destroy.log`) — *implementation uses operation name, not timestamp*
- Streamed during execution via Redis; persisted to MinIO when complete

#### 7. Variable Data

**Location**: `variables` table in PostgreSQL

**Stored:**
- `id`: UUID
- `workspace_id`: FK to workspaces
- `key`: Variable key (unique within workspace)
- `value`: Variable value (encrypted if `encrypted=true`)
- `encrypted`: Boolean flag
- `sensitive`: Boolean flag (hide in UI)

**Encryption:**
- Sensitive variables encrypted at rest using AES-256
- Encryption key stored in environment variable or key management service

#### 8. State Data

**Location**: 
- **Metadata**: `state_versions` table in PostgreSQL
- **State Files**: MinIO (object storage)

**Stored in Database:**
- `id`: UUID
- `workspace_id`: FK to workspaces
- `version`: Sequential version number
- `serial`: Terraform state serial
- `lineage`: Terraform state lineage
- `created_at`: Timestamp

**Stored in MinIO:**
- Path: `workspaces/{workspace_id}/state/{version}.json` — *implementation path*
- Format: JSON (Terraform state format)

> **⚠️ State encryption not implemented**  
> The design called for state files in MinIO to be encrypted with AES-256.  
> **Current implementation:** state is stored as **plain JSON**; there is no encryption in the state service.  
> Terraform state can contain secrets and sensitive resource attributes. Treat MinIO (or equivalent) access as privileged and secure the bucket accordingly until encryption at rest is added.

#### 9. Audit Logs

**Location**: `audit_logs` table in PostgreSQL

**Stored:**
- `id`: UUID
- `user_id`: FK to users (nullable)
- `organization_id`: FK to organizations (nullable)
- `project_id`: FK to projects (nullable)
- `workspace_id`: FK to workspaces (nullable)
- `action`: Action performed (create, update, delete, etc.)
- `resource_type`: Type of resource (organization, project, workspace, etc.)
- `resource_id`: ID of affected resource
- `details`: JSONB (additional context)
- `ip_address`: Client IP address
- `user_agent`: Client user agent
- `created_at`: Timestamp

**Retention:**
- Immutable (never deleted)
- Indexed for fast queries
- Can be archived to cold storage after 1 year

---

## Identity Mapping (Zitadel ↔ Local Database)

### The Identity Mapping Problem

**Challenge**: Zitadel manages authentication and user identity, but the local database needs to:
1. Store user-specific data (settings, preferences)
2. Link users to organizations, projects, workspaces
3. Maintain referential integrity with foreign keys

**Solution**: Dual-identity system with mapping table

### Identity Mapping Flow

```
┌─────────────────────────────────────────────────────────────┐
│              Identity Mapping Architecture                    │
└─────────────────────────────────────────────────────────────┘

Zitadel Identity              Local Database Identity
─────────────────            ────────────────────────

Zitadel Subject              User Table
(sub: "zitadel-user-123")    ┌──────────────┐
     │                       │ id: uuid     │ ← Primary Key
     │                       │ zitadel_subj │ ← Mapping Key
     │                       │ email        │
     │                       │ name         │
     │                       │ settings     │
     └───────────────────────►└──────────────┘
          (1:1 mapping)           │
                                   │
                                   │ (N)
                          ┌────────▼──────────┐
                          │ OrganizationMember│
                          │ user_id (FK)      │
                          │ organization_id   │
                          │ role              │
                          └───────────────────┘
```

### Mapping Strategy

#### 1. User Creation on First Login

```go
// backend/internal/services/auth/service.go

func (s *Service) AuthenticateMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        // 1. Verify JWT token
        claims, err := s.verifier.VerifyToken(ctx, tokenString)
        
        // 2. Fetch user info from Zitadel
        userInfo, err := s.verifier.FetchUserInfo(ctx, tokenString)
        // Returns: { Subject: "zitadel-user-123", Email: "user@example.com", ... }
        
        // 3. Find or create local user
        user, err := s.userRepo.GetByZitadelSubject(userInfo.Subject)
        if err != nil {
            // User doesn't exist - auto-create
            user = &models.User{
                ZitadelSubject: userInfo.Subject,  // Mapping key
                Email:          userInfo.Email,
                Name:           userInfo.Name,
                Settings:      datatypes.JSON(`{}`),
            }
            s.userRepo.Create(user)
        } else {
            // User exists - update if changed
            if user.Email != userInfo.Email || user.Name != userInfo.Name {
                user.Email = userInfo.Email
                user.Name = userInfo.Name
                s.userRepo.Update(user)
            }
        }
        
        // 4. Store LOCAL user ID in context (not Zitadel subject)
        c.Set("user_id", user.ID)  // ← This is the UUID used in all FK relationships
        c.Set("user_subject", userInfo.Subject)  // ← Keep for reference
    }
}
```

#### 2. Database Relationships Use Local User ID

**All foreign keys use the local `User.id` (UUID), not Zitadel subject:**

```sql
-- OrganizationMember table
CREATE TABLE organization_members (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    user_id UUID REFERENCES users(id),  -- ← Local UUID, not Zitadel subject
    role VARCHAR(50),
    ...
);

-- Run table
CREATE TABLE runs (
    id UUID PRIMARY KEY,
    workspace_id UUID REFERENCES workspaces(id),
    created_by UUID REFERENCES users(id),  -- ← Local UUID
    ...
);
```

#### 3. Zitadel Subject is Only for Identity Mapping

**Zitadel subject (`zitadel_subject`) is:**
- Used ONLY for finding the local user on login
- Stored in `users` table for lookup
- NOT used in any foreign key relationships
- NOT exposed in API responses (use local UUID instead)

**Local UUID (`id`) is:**
- Used in ALL foreign key relationships
- Used in all API responses
- The source of truth for database integrity

### Benefits of This Approach

1. **Referential Integrity**: Foreign keys work correctly
2. **Performance**: UUID lookups are fast (indexed)
3. **Abstraction**: Database doesn't depend on Zitadel's internal IDs
4. **Flexibility**: Can switch identity providers without changing schema
5. **Audit Trail**: All actions reference local user ID (consistent)

---

## Settings Storage Architecture

> **⚠️ Org / project / workspace settings not implemented**  
> The `organization_settings`, `project_settings`, and `workspace_settings` tables and their CRUD APIs are **not implemented**.  
> User-level settings exist under `/api/v2/settings` (profile, 2fa, sessions, api-keys). The hierarchy and inheritance below are **design only**.

### Settings Hierarchy

Settings are stored at multiple levels with inheritance:

```
User Settings (Personal Preferences)
    │
    ├── Organization Settings (Org-wide Configuration)
    │       │
    │       ├── Project Settings (Project-specific Config)
    │       │       │
    │       │       └── Workspace Settings (Workspace-specific Config)
```

### Settings Tables

#### 1. User Settings

**Table**: `users.settings` (JSONB column)

**Scope**: Personal user preferences

**Examples:**
```json
{
  "theme": "dark",
  "language": "en",
  "notifications": {
    "email": true,
    "slack": false,
    "webhook": true
  },
  "preferences": {
    "default_organization": "org-uuid",
    "default_project": "project-uuid"
  },
  "ui": {
    "sidebar_collapsed": false,
    "dashboard_layout": "grid"
  }
}
```

**Access Control**: User can always read/write their own settings

#### 2. Organization Settings

**Table**: `organization_settings` (new table)

**Schema:**
```sql
CREATE TABLE organization_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Scope**: Organization-wide configuration

**Examples:**
```json
{
  "notifications": {
    "on_run_failure": true,
    "on_run_success": false,
    "on_cost_threshold": true
  },
  "cost_management": {
    "monthly_budget": 1000,
    "alert_threshold": 0.8,
    "currency": "USD"
  },
  "runner_pool": {
    "default_pool": "shared",
    "auto_scale": true,
    "max_concurrent_runs": 10
  },
  "security": {
    "require_mfa": false,
    "session_timeout": 3600,
    "ip_whitelist": []
  },
  "integrations": {
    "slack_webhook": "https://hooks.slack.com/...",
    "pagerduty_key": "..."
  }
}
```

**Access Control**: 
- Read: `org:read` permission
- Write: `org:admin` permission only

#### 3. Project Settings

**Table**: `project_settings` (new table)

**Schema:**
```sql
CREATE TABLE project_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Scope**: Project-specific configuration

**Examples:**
```json
{
  "terraform": {
    "default_version": "1.5.0",
    "auto_apply": false,
    "plan_timeout": 300
  },
  "vcs_integration": {
    "provider": "github",
    "auto_plan_on_push": true,
    "required_approvals": 1
  },
  "workspace_defaults": {
    "terraform_version": "1.5.0",
    "working_directory": "."
  }
}
```

**Access Control**:
- Read: `project:read` permission (inherited from org)
- Write: `project:write` permission (inherited from org)

#### 4. Workspace Settings

**Table**: `workspace_settings` (new table)

**Schema:**
```sql
CREATE TABLE workspace_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID UNIQUE NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Scope**: Workspace-specific configuration

**Examples:**
```json
{
  "terraform_backend": {
    "type": "s3",
    "bucket": "terraform-state",
    "key": "workspace/state",
    "region": "us-east-1"
  },
  "variables": {
    "auto_load": true,
    "encryption": "aes256",
    "sensitive_keys": ["api_key", "secret"]
  },
  "execution": {
    "parallelism": 10,
    "refresh": true,
    "target": []
  }
}
```

**Access Control**:
- Read: `workspace:read` permission (inherited from org/project)
- Write: `workspace:write` permission (inherited from org/project)

### Settings Inheritance

**Settings are merged with inheritance:**

1. **User Settings**: Base layer (always applied)
2. **Organization Settings**: Override user settings for org context
3. **Project Settings**: Override org settings for project context
4. **Workspace Settings**: Override project settings for workspace context

**Example:**
```json
// User Settings
{ "theme": "dark", "notifications": { "email": true } }

// Organization Settings
{ "notifications": { "email": false, "slack": true } }

// Merged Result (for org context)
{ 
  "theme": "dark",  // From user
  "notifications": { 
    "email": false,  // Overridden by org
    "slack": true    // From org
  }
}
```

### Settings API Endpoints

```
GET    /api/v1/users/me/settings
PUT    /api/v1/users/me/settings

GET    /api/v1/organizations/:id/settings
PUT    /api/v1/organizations/:id/settings

GET    /api/v1/organizations/:id/projects/:id/settings
PUT    /api/v1/organizations/:id/projects/:id/settings

GET    /api/v1/organizations/:id/projects/:id/workspaces/:id/settings
PUT    /api/v1/organizations/:id/projects/:id/workspaces/:id/settings
```

---

## Security Implementation Plan

> **Status vs this plan**  
> Phase 1 (user model, auth, RBAC) is largely done; the **RBAC model in use is team-based**, not the `CheckPermission` + org-role flow above. Expected the old one is deprecated.  
> Phase 2 (settings) is **not done**: no org/project/workspace settings tables or APIs.  
> Phase 3 (Zitadel role sync) is **not done** and is superseded by team-based permissions.  
> Phase 4: rate limiting and variable encryption are done; **state and VCS token encryption are not** (see Phase 4.4 and the [Situation Report](#implementation-status-situation-report)).

### Phase 1: Core Security Foundation (Week 1-2)

#### 1.1 User Model Enhancement

**Task**: Add `zitadel_subject` field to User model

**Files to Modify:**
- `backend/internal/models/user.go`
- `backend/internal/repository/user.go`

**Implementation:**
```go
// models/user.go
type User struct {
    ID             uuid.UUID `gorm:"type:uuid;primary_key" json:"id"`
    ZitadelSubject string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"zitadel_subject"`
    Email          string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
    Name           string    `gorm:"type:varchar(255)" json:"name"`
    Settings       datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"settings"`
    CreatedAt      time.Time `json:"created_at"`
    UpdatedAt      time.Time `json:"updated_at"`
}

// repository/user.go
func (r *UserRepository) GetByZitadelSubject(subject string) (*models.User, error) {
    var user models.User
    err := r.db.First(&user, "zitadel_subject = ?", subject).Error
    if err != nil {
        return nil, err
    }
    return &user, nil
}
```

**Migration:**
```sql
ALTER TABLE users 
ADD COLUMN zitadel_subject VARCHAR(255);

CREATE UNIQUE INDEX idx_users_zitadel_subject ON users(zitadel_subject);

-- Backfill existing users (if any)
-- Note: This requires fetching Zitadel subjects for existing users
```

#### 1.2 Enhanced Authentication Middleware

**Task**: Update authentication to auto-create users and fetch user info

**Files to Modify:**
- `backend/internal/services/auth/service.go`
- `backend/internal/services/auth/zitadel.go`

**Implementation:**
```go
// zitadel.go - Add FetchUserInfo method
func (v *ZitadelVerifier) FetchUserInfo(ctx context.Context, accessToken string) (*UserInfo, error) {
    userinfoURL := v.issuer + "/oidc/v1/userinfo"
    req, err := http.NewRequestWithContext(ctx, "GET", userinfoURL, nil)
    req.Header.Set("Authorization", "Bearer "+accessToken)
    
    resp, err := v.httpClient.Do(req)
    // ... parse response
}

// service.go - Update AuthenticateMiddleware
func (s *Service) AuthenticateMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        // ... token verification ...
        
        // Fetch user info
        userInfo, err := s.verifier.FetchUserInfo(c.Request.Context(), tokenString)
        
        // Find or create user
        user, err := s.userRepo.GetByZitadelSubject(userInfo.Subject)
        if err != nil {
            // Auto-create
            user = &models.User{
                ZitadelSubject: userInfo.Subject,
                Email:          userInfo.Email,
                Name:           userInfo.Name,
                Settings:       datatypes.JSON(`{}`),
            }
            s.userRepo.Create(user)
        }
        
        // Store local user ID in context
        c.Set("user_id", user.ID)
        c.Set("user_subject", userInfo.Subject)
        c.Next()
    }
}
```

#### 1.3 RBAC Permission Checking

**Task**: Implement permission checking middleware

**Files to Modify:**
- `backend/internal/api/middleware/rbac.go`
- `backend/internal/services/rbac/service.go`

**Implementation:**
```go
// middleware/rbac.go
func RequirePermission(rbacService *rbac.Service, permission rbac.Permission) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID, _ := c.Get("user_id").(uuid.UUID)
        orgID := extractOrganizationID(c)
        
        hasPermission, err := rbacService.CheckPermission(c.Request.Context(), userID, orgID, permission)
        if err != nil || !hasPermission {
            c.JSON(403, gin.H{"error": "insufficient permissions"})
            c.Abort()
            return
        }
        
        c.Set("organization_id", orgID)
        c.Next()
    }
}
```

**Security Checklist:**
- [ ] All endpoints protected by authentication middleware
- [ ] Permission checks on all write operations
- [ ] Organization ID extracted correctly from all request types
- [ ] Error messages don't leak sensitive information

### Phase 2: Settings Storage (Week 3-4)

#### 2.1 Settings Models

**Task**: Create settings models and tables

**Files to Create:**
- `backend/internal/models/organization_settings.go`
- `backend/internal/models/project_settings.go`
- `backend/internal/models/workspace_settings.go`

**Implementation:**
```go
// models/organization_settings.go
type OrganizationSettings struct {
    ID             uuid.UUID      `gorm:"type:uuid;primary_key" json:"id"`
    OrganizationID uuid.UUID      `gorm:"type:uuid;uniqueIndex;not null" json:"organization_id"`
    Settings       datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"settings"`
    CreatedAt      time.Time      `json:"created_at"`
    UpdatedAt      time.Time      `json:"updated_at"`
    Organization   Organization   `gorm:"foreignKey:OrganizationID" json:"organization,omitempty"`
}
```

#### 2.2 Settings Repositories

**Task**: Create repositories for settings

**Files to Create:**
- `backend/internal/repository/organization_settings.go`
- `backend/internal/repository/project_settings.go`
- `backend/internal/repository/workspace_settings.go`

**Implementation:**
```go
// repository/organization_settings.go
type OrganizationSettingsRepository struct {
    db *gorm.DB
}

func (r *OrganizationSettingsRepository) GetByOrganizationID(orgID uuid.UUID) (*models.OrganizationSettings, error) {
    var settings models.OrganizationSettings
    err := r.db.First(&settings, "organization_id = ?", orgID).Error
    if err == gorm.ErrRecordNotFound {
        // Return default empty settings
        return &models.OrganizationSettings{
            OrganizationID: orgID,
            Settings:       datatypes.JSON(`{}`),
        }, nil
    }
    return &settings, err
}

func (r *OrganizationSettingsRepository) Upsert(settings *models.OrganizationSettings) error {
    return r.db.Where("organization_id = ?", settings.OrganizationID).
        Assign(settings).
        FirstOrCreate(settings).Error
}
```

#### 2.3 Settings Service

**Task**: Create settings service with permission checks

**Files to Create:**
- `backend/internal/services/settings/service.go`

**Implementation:**
```go
// services/settings/service.go
type Service struct {
    userSettingsRepo        *repository.UserRepository
    orgSettingsRepo         *repository.OrganizationSettingsRepository
    projectSettingsRepo     *repository.ProjectSettingsRepository
    workspaceSettingsRepo   *repository.WorkspaceSettingsRepository
    rbacService            *rbac.Service
}

func (s *Service) GetOrganizationSettings(ctx context.Context, userID, orgID uuid.UUID) (map[string]interface{}, error) {
    // Check permission
    hasPermission, err := s.rbacService.CheckPermission(ctx, userID, orgID, rbac.PermissionOrgRead)
    if err != nil || !hasPermission {
        return nil, errors.New("insufficient permissions")
    }
    
    // Fetch settings
    settings, err := s.orgSettingsRepo.GetByOrganizationID(orgID)
    if err != nil {
        return nil, err
    }
    
    var result map[string]interface{}
    json.Unmarshal(settings.Settings, &result)
    return result, nil
}

func (s *Service) UpdateOrganizationSettings(ctx context.Context, userID, orgID uuid.UUID, newSettings map[string]interface{}) error {
    // Check permission - only admins can update
    hasPermission, err := s.rbacService.CheckPermission(ctx, userID, orgID, rbac.PermissionOrgAdmin)
    if err != nil || !hasPermission {
        return errors.New("insufficient permissions: organization admin required")
    }
    
    // Update settings
    settingsJSON, _ := json.Marshal(newSettings)
    settings := &models.OrganizationSettings{
        OrganizationID: orgID,
        Settings:       datatypes.JSON(settingsJSON),
    }
    return s.orgSettingsRepo.Upsert(settings)
}
```

#### 2.4 Settings Handlers

**Task**: Create API handlers for settings

**Files to Create:**
- `backend/internal/api/handlers/settings.go`

**Implementation:**
```go
// handlers/settings.go
type SettingsHandler struct {
    settingsService *settings.Service
    authService    *auth.Service
}

func (h *SettingsHandler) GetOrganizationSettings(c *gin.Context) {
    user, _ := h.authService.GetUserFromContext(c)
    orgID, _ := uuid.Parse(c.Param("organization_id"))
    
    settings, err := h.settingsService.GetOrganizationSettings(c.Request.Context(), user.ID, orgID)
    if err != nil {
        c.JSON(403, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, settings)
}

func (h *SettingsHandler) UpdateOrganizationSettings(c *gin.Context) {
    user, _ := h.authService.GetUserFromContext(c)
    orgID, _ := uuid.Parse(c.Param("organization_id"))
    
    var newSettings map[string]interface{}
    if err := c.ShouldBindJSON(&newSettings); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    if err := h.settingsService.UpdateOrganizationSettings(c.Request.Context(), user.ID, orgID, newSettings); err != nil {
        c.JSON(403, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{"message": "settings updated"})
}
```

**Security Checklist:**
- [ ] All settings endpoints require authentication
- [ ] Read operations require appropriate read permissions
- [ ] Write operations require admin permissions
- [ ] Settings validated before storage
- [ ] JSONB injection prevented (validate structure)

### Phase 3: Zitadel Role Synchronization (Week 5-6)

#### 3.1 Zitadel API Client

**Task**: Create client to fetch roles from Zitadel

**Files to Create:**
- `backend/internal/services/zitadel/client.go`

**Implementation:**
```go
// services/zitadel/client.go
type Client struct {
    issuer       string
    clientID     string
    clientSecret string
    httpClient   *http.Client
}

func (c *Client) GetUserOrganizationRole(ctx context.Context, userSubject string, orgID uuid.UUID) (string, error) {
    // Call Zitadel Management API to get user's role in organization
    // This requires service account authentication
    // Returns Zitadel role (e.g., "IAM_ORG_OWNER", "IAM_ORG_PROJECT_CREATOR")
}
```

#### 3.2 Role Mapping

**Task**: Map Zitadel roles to local roles

**Files to Modify:**
- `backend/internal/services/rbac/service.go`

**Implementation:**
```go
// rbac/service.go
func mapZitadelRoleToLocal(zitadelRole string) Role {
    switch zitadelRole {
    case "IAM_OWNER", "IAM_ORG_OWNER":
        return RoleAdmin
    case "IAM_ORG_PROJECT_CREATOR", "IAM_ORG_PROJECT_OWNER":
        return RoleMember
    case "IAM_ORG_PROJECT_VIEWER":
        return RoleViewer
    default:
        return RoleViewer // Default to most restrictive
    }
}

func (s *Service) SyncRoleFromZitadel(ctx context.Context, userID, organizationID uuid.UUID) error {
    user, err := s.userRepo.GetByID(userID)
    if err != nil {
        return err
    }
    
    // Fetch role from Zitadel
    zitadelRole, err := s.zitadelClient.GetUserOrganizationRole(ctx, user.ZitadelSubject, organizationID)
    if err != nil {
        return err
    }
    
    // Map to local role
    localRole := mapZitadelRoleToLocal(zitadelRole)
    
    // Update local member
    member, err := s.orgRepo.GetMember(organizationID, userID)
    if err != nil {
        return err
    }
    
    member.Role = string(localRole)
    member.ZitadelRole = zitadelRole
    now := time.Now()
    member.RoleSyncedAt = &now
    
    return s.orgRepo.UpdateMember(member)
}
```

#### 3.3 Background Sync Job

**Task**: Periodic role synchronization

**Files to Create:**
- `backend/internal/services/sync/role_sync.go`

**Implementation:**
```go
// sync/role_sync.go
type RoleSyncService struct {
    rbacService *rbac.Service
    orgRepo     *repository.OrganizationRepository
}

func (s *RoleSyncService) StartPeriodicSync(ctx context.Context, interval time.Duration) {
    ticker := time.NewTicker(interval)
    go func() {
        for {
            select {
            case <-ticker.C:
                s.SyncAllRoles(ctx)
            case <-ctx.Done():
                return
            }
        }
    }()
}

func (s *RoleSyncService) SyncAllRoles(ctx context.Context) {
    // Get all organization members
    // For each member, sync role from Zitadel
    // Update local database
}
```

**Security Checklist:**
- [ ] Zitadel API credentials stored securely (env vars, not in code)
- [ ] Rate limiting on Zitadel API calls
- [ ] Error handling for Zitadel API failures
- [ ] Fallback to local roles if sync fails
- [ ] Audit logging for role changes

### Phase 4: Enhanced Security (Week 7-8)

#### 4.1 Input Validation

**Task**: Validate all inputs

**Files to Modify:**
- All handlers

**Implementation:**
```go
// Use struct tags for validation
type UpdateOrganizationSettingsRequest struct {
    Settings map[string]interface{} `json:"settings" binding:"required"`
}

// Validate JSON structure
func validateSettings(s map[string]interface{}) error {
    // Check for allowed keys
    // Validate value types
    // Prevent injection
}
```

#### 4.2 Audit Logging

**Task**: Log all sensitive operations

**Files to Modify:**
- All handlers

**Implementation:**
```go
// middleware/audit.go
func AuditMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        // Log request
        // Extract user, resource, action
        // Store in audit_logs table
        c.Next()
    }
}
```

#### 4.3 Rate Limiting

**Task**: Implement rate limiting

**Files to Modify:**
- `backend/internal/api/middleware/rate_limit.go`

**Implementation:**
```go
// middleware/rate_limit.go
func RateLimitMiddleware() gin.HandlerFunc {
    limiter := rate.NewLimiter(rate.Every(time.Second), 10) // 10 req/sec
    return func(c *gin.Context) {
        if !limiter.Allow() {
            c.JSON(429, gin.H{"error": "rate limit exceeded"})
            c.Abort()
            return
        }
        c.Next()
    }
}
```

#### 4.4 Encryption for Sensitive Data

**Task**: Encrypt sensitive variables

**Files to Modify:**
- `backend/internal/services/encryption/service.go`

**Implementation:**
```go
// services/encryption/service.go
type Service struct {
    key []byte // From environment variable
}

func (s *Service) Encrypt(plaintext string) (string, error) {
    // AES-256-GCM encryption
}

func (s *Service) Decrypt(ciphertext string) (string, error) {
    // AES-256-GCM decryption
}
```

> **Gaps in implementation**  
> - **Workspace and variable-set variables:** ✅ Encrypted via `variable.Service` and `ENCRYPTION_KEY` when `sensitive`/`encrypted` is set.  
> - **State files in MinIO:** ❌ **Not encrypted.** Stored as plain JSON at `workspaces/{workspace_id}/state/{version}.json`. State can contain secrets; treat object storage as sensitive.  
> - **VCS connection tokens:** ❌ **Not encrypted.** `VCSConnection.AccessToken` and `RefreshToken` are stored in plain form; code has `// TODO: Encrypt`.  
> - **Ansible credentials:** ✅ Sensitive fields encrypted via `CredentialService` and `ANSIBLE_ENCRYPTION_KEY` / `ENCRYPTION_KEY`.

**Security Checklist:**
- [ ] All user inputs validated
- [ ] SQL injection prevented (using GORM parameterized queries)
- [ ] XSS prevented (JSON responses, no HTML)
- [ ] CSRF protection (if using cookies)
- [ ] Sensitive data encrypted at rest
- [ ] Audit logs for all sensitive operations
- [ ] Rate limiting on all endpoints
- [ ] Error messages don't leak information

---

## Migration Strategy

### Database Migrations

#### Migration 1: Add Zitadel Subject to Users

```sql
-- Migration: 001_add_zitadel_subject.sql
ALTER TABLE users 
ADD COLUMN zitadel_subject VARCHAR(255);

CREATE UNIQUE INDEX idx_users_zitadel_subject ON users(zitadel_subject);

-- For existing users, you'll need to backfill from Zitadel
-- This should be done via a script that:
-- 1. Fetches all users from Zitadel
-- 2. Matches by email
-- 3. Updates zitadel_subject
```

#### Migration 2: Create Settings Tables

```sql
-- Migration: 002_create_settings_tables.sql

-- Organization Settings
CREATE TABLE organization_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_org_settings_org_id ON organization_settings(organization_id);

-- Project Settings
CREATE TABLE project_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_settings_project_id ON project_settings(project_id);

-- Workspace Settings
CREATE TABLE workspace_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID UNIQUE NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workspace_settings_workspace_id ON workspace_settings(workspace_id);
```

#### Migration 3: Enhance OrganizationMember

```sql
-- Migration: 003_enhance_organization_member.sql
ALTER TABLE organization_members
ADD COLUMN zitadel_role VARCHAR(255),
ADD COLUMN role_synced_at TIMESTAMP;

CREATE INDEX idx_org_member_sync ON organization_members(role_synced_at);
```

### Code Migration Steps

1. **Week 1**: Implement user model changes and authentication updates
2. **Week 2**: Test authentication flow, ensure user auto-creation works
3. **Week 3**: Implement settings models and repositories
4. **Week 4**: Implement settings service and handlers, add API endpoints
5. **Week 5**: Implement Zitadel role sync (optional, can be deferred)
6. **Week 6**: Add audit logging and rate limiting
7. **Week 7**: Security hardening and testing
8. **Week 8**: Documentation and deployment

### Testing Strategy

1. **Unit Tests**: Test each service method in isolation
2. **Integration Tests**: Test API endpoints with test database
3. **Security Tests**: Test permission checks, input validation
4. **Load Tests**: Test rate limiting, concurrent requests
5. **End-to-End Tests**: Test full authentication and permission flow

---

## Summary

This document provides a comprehensive overview of:

1. **Database Relations**: Complete ER diagram and foreign key relationships
2. **Permission Flow**: How permissions are checked at each request
3. **Data Storage**: Where each type of data is stored and why
4. **Identity Mapping**: How Zitadel users map to local database users
5. **Settings Architecture**: Multi-level settings with inheritance
6. **Security Implementation**: Phased plan for secure implementation
7. **Migration Strategy**: Step-by-step migration plan

**See [Implementation Status (Situation Report)](#implementation-status-situation-report)** for what is implemented, what differs, and **outstanding security gaps** (in particular: **state files in MinIO are not encrypted**; **VCS connection tokens are not encrypted**).

The architecture ensures:
- **Security**: All operations require proper authentication and authorization
- **Scalability**: Efficient database queries with proper indexing
- **Maintainability**: Clear separation of concerns
- **Flexibility**: JSONB settings allow schema evolution without migrations
- **Auditability**: Complete audit trail of all operations

