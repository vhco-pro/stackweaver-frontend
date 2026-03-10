<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Teams Implementation Plan

https://developer.hashicorp.com/terraform/cloud-docs/users-teams-organizations/permissions/project 
https://developer.hashicorp.com/terraform/cloud-docs/users-teams-organizations/permissions/workspace 
https://developer.hashicorp.com/terraform/cloud-docs/users-teams-organizations/permissions/organization 

https://developer.hashicorp.com/terraform/cloud-docs/api-docs/projects
https://developer.hashicorp.com/terraform/cloud-docs/api-docs/project-team-access
https://developer.hashicorp.com/terraform/cloud-docs/api-docs/team-members
https://developer.hashicorp.com/terraform/cloud-docs/api-docs/teams
https://developer.hashicorp.com/terraform/cloud-docs/api-docs/team-access
https://developer.hashicorp.com/terraform/cloud-docs/api-docs/team-tokens

https://developer.hashicorp.com/terraform/enterprise/api-docs/admin/organizations
https://developer.hashicorp.com/terraform/enterprise/api-docs/organization-memberships
https://developer.hashicorp.com/terraform/enterprise/api-docs/organization-tokens

## Executive Summary

This document outlines the implementation plan for adding teams functionality to StackWeaver, maintaining full compatibility with Terraform Enterprise (TFE) API and the `terraform-provider-tfe` provider. This will enable users to manage teams, team members, and organization memberships using Terraform.

## Design Goals

1. **TFE Provider Compatibility**: Full compatibility with `terraform-provider-tfe` for teams and organization memberships (models must match TFE structure exactly)
2. **Maintain Current Architecture**: Keep existing OrganizationMember model alongside teams (flexibility)
3. **Project-Level Access**: Teams can have access to projects (StackWeaver extension, not in TFE)
4. **Workspace-Level Access**: Teams can have direct access to workspaces (TFE-compatible)
5. **UI/Visual Implementation**: Organization Settings card for managing users and teams
6. **Future-Proof**: Design for our own `terraform-provider-stackweaver` which will support both Terraform and Ansible resources
7. **Backward Compatible**: No breaking changes to existing organization membership model
8. **OIDC Provider Integration**: Support linking external OIDC providers (handled by Zitadel)

---

## Current State

### What Exists

✅ **Organization Membership** (Direct)
- Model: `OrganizationMember` in `backend/internal/models/organization_member.go`
- Repository: `AddMember()`, `RemoveMember()`, `GetMember()` in `backend/internal/repository/organization.go`
- Roles: `admin`, `member`, `viewer` (organization-scoped)
- Storage: `organization_members` table in PostgreSQL

✅ **RBAC Service**
- Service: `backend/internal/services/rbac/service.go`
- Permissions: Organization-scoped permissions (org:read, org:write, org:admin, etc.)
- Role mapping: admin/member/viewer → permissions

❌ **Missing**
- Teams model and API
- Team members API
- Organization members API (public endpoints)
- Project-level team permissions
- Workspace-level team permissions
- Frontend/UI for user and team management
- OIDC provider integration UI

---

## TFE Provider Compatibility Requirements

### Required Endpoints (from TFE API spec)

Based on Terraform Enterprise API documentation, we need to support:

1. **Teams API**
   - `GET /api/v2/organizations/:name/teams` - List teams
   - `POST /api/v2/organizations/:name/teams` - Create team
   - `GET /api/v2/teams/:id` - Get team
   - `PATCH /api/v2/teams/:id` - Update team
   - `DELETE /api/v2/teams/:id` - Delete team

2. **Team Members API** (Team-User Relationships)
   - `GET /api/v2/teams/:id/relationships/users` - List team members
   - `POST /api/v2/teams/:id/relationships/users` - Add team member
   - `DELETE /api/v2/teams/:id/relationships/users/:user_id` - Remove team member

3. **Organization Memberships API**
   - `GET /api/v2/organization-memberships` - List organization memberships
   - `POST /api/v2/organization-memberships` - Create organization membership
   - `GET /api/v2/organization-memberships/:id` - Get organization membership
   - `PATCH /api/v2/organization-memberships/:id` - Update organization membership (role)
   - `DELETE /api/v2/organization-memberships/:id` - Remove organization membership

4. **Team Access API** (Workspace Permissions)
   - `GET /api/v2/workspaces/:id/relationships/team-access` - List team permissions on workspace
   - `POST /api/v2/workspaces/:id/relationships/team-access` - Add team permission
   - `PATCH /api/v2/workspaces/:id/relationships/team-access/:id` - Update team permission
   - `DELETE /api/v2/workspaces/:id/relationships/team-access/:id` - Remove team permission

**Format**: JSON:API format (TFE standard)

---

## Database Schema

### Teams Table

```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  visibility VARCHAR(50) DEFAULT 'organization', -- 'organization' or 'secret'
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

CREATE INDEX idx_teams_organization_id ON teams(organization_id);
```

### Team Members Table (Many-to-Many)

```sql
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
```

### Team Project Access Table (Permissions)

```sql
CREATE TABLE team_project_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  access VARCHAR(50) NOT NULL, -- 'read', 'write', 'admin'
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, project_id)
);

CREATE INDEX idx_team_project_access_team_id ON team_project_access(team_id);
CREATE INDEX idx_team_project_access_project_id ON team_project_access(project_id);
```

### Team Workspace Access Table (Permissions)

```sql
CREATE TABLE team_workspace_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  access VARCHAR(50) NOT NULL, -- 'read', 'write', 'admin'
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, workspace_id)
);

CREATE INDEX idx_team_workspace_access_team_id ON team_workspace_access(team_id);
CREATE INDEX idx_team_workspace_access_workspace_id ON team_workspace_access(workspace_id);
```

**Note**: Projects are cosmetic groupings in the UI (not backend-enforced). Teams can have access to:
- **Projects**: Access to all resources within a project (workspaces, playbooks, etc.)
- **Workspaces**: Direct access to specific workspaces (overrides project access if more restrictive)

### Organization Memberships (Enhanced)

The existing `organization_members` table is sufficient, but we need to expose it via API endpoints. No schema changes needed.

---

## Models

**Implementation**: All team-related models are implemented. See code files for actual implementation.

### Team Model

**Implementation**: See `Team` struct in `backend/internal/models/team.go:12-32`

**Key Fields**:
- `ID` - UUID primary key
- `OrganizationID` - Reference to organization
- `Name` - Team name (unique within organization)
- `Visibility` - "organization" or "secret" (default: "secret", TFE-compatible)
- `AllowMemberTokenManagement` - Controls team token management (TFE-compatible)
- `SSOTeamID` - Optional SSO team ID, nullable (TFE-compatible)
- `OrganizationAccess` - One-to-one relationship with `TeamOrganizationAccess` (TFE-compatible)

**Relationships**:
- `Organization` - Belongs to organization
- `Members` - Has many team members
- `ProjectAccess` - Has many project access entries (StackWeaver extension)
- `WorkspaceAccess` - Has many workspace access entries (TFE-compatible)
- `OrganizationAccess` - Has one organization access (TFE-compatible)

**Note**: Team model matches TFE structure exactly. Reference: https://developer.hashicorp.com/terraform/cloud-docs/api-docs/teams

### Team Member Model

**Implementation**: See `TeamMember` struct in `backend/internal/models/team_member.go`

**Key Fields**:
- `ID` - UUID primary key
- `TeamID` - Reference to team
- `UserID` - Reference to user
- `CreatedAt` - Timestamp

**Relationships**:
- `Team` - Belongs to team
- `User` - Belongs to user

### Team Organization Access Model

**Implementation**: See `TeamOrganizationAccess` struct in `backend/internal/models/team_organization_access.go`

**Key Fields**:
- `ID` - UUID primary key
- `TeamID` - Reference to team (unique)
- 16 boolean permission fields (TFE-compatible):
  - `ManagePolicies`, `ManagePolicyOverrides`, `ManageWorkspaces`, `ManageVCSSettings`
  - `ManageProviders`, `ManageModules`, `ManageRunTasks`, `ManageProjects`
  - `ReadWorkspaces`, `ReadProjects`, `ManageMembership`, `ManageTeams`
  - `ManageOrganizationAccess`, `AccessSecretTeams`, `ManageAgentPools`

**Note**: TFE-compatible organization-level permissions for teams.

### Team Project Access Model

**Implementation**: See `TeamProjectAccess` struct in `backend/internal/models/team_project_access.go`

**Note**: StackWeaver extension (not in TFE). Teams can have access to projects.

### Team Workspace Access Model

**Implementation**: See `TeamWorkspaceAccess` struct in `backend/internal/models/team_workspace_access.go`

**Key Fields**:
- `ID` - UUID primary key
- `TeamID` - Reference to team
- `WorkspaceID` - Reference to workspace (string ID for TFE compatibility)
- `Access` - Permission level: "read", "write", or "admin"
- `CreatedAt` - Timestamp

**Note**: TFE-compatible workspace-level team permissions.

---

## Repository Layer

**Implementation**: See `TeamRepository` in `backend/internal/repository/team.go`

### Team Repository Methods

**Core CRUD**:
- `Create()` - Create a new team
- `GetByID()` - Retrieve team by ID (with preloaded relationships)
- `GetByName()` - Retrieve team by name within organization
- `List()` - List teams for organization (with pagination)
- `Update()` - Update team
- `Delete()` - Delete team (cascades to related tables)

**Team Members**:
- `AddMember()` - Add user to team
- `RemoveMember()` - Remove user from team
- `GetMembers()` - Get all team members

**Project Access** (StackWeaver extension):
- `AddProjectAccess()` - Add team access to project
- `RemoveProjectAccess()` - Remove team access from project
- `GetProjectAccess()` - Get team access for project

**Workspace Access** (TFE-compatible):
- `AddWorkspaceAccess()` - Add team access to workspace
- `RemoveWorkspaceAccess()` - Remove team access from workspace
- `GetWorkspaceAccess()` - Get team access for workspace

**Organization Access** (TFE-compatible):
- `GetOrCreateOrganizationAccess()` - Get or create organization access record
- `UpdateOrganizationAccess()` - Update organization access permissions

**Reference**: See implementation in `backend/internal/repository/team.go`

---

## API Handlers

**Implementation**: See `TeamHandlerV2` in `backend/internal/api/v2/handlers/teams.go`

### Teams Handler

**Handler**: `TeamHandlerV2` - `backend/internal/api/v2/handlers/teams.go:14-26`

**TFE-compatible JSON:API format endpoints** (all implemented):

- `GET /api/v2/organizations/:name/teams` - List teams (`List()` method)
- `POST /api/v2/organizations/:name/teams` - Create team (`Create()` method)
- `GET /api/v2/organizations/:name/teams/:teamName` - Get team by name (`Get()` method)
- `PATCH /api/v2/organizations/:name/teams/:teamName` - Update team by name (`Update()` method)
- `DELETE /api/v2/organizations/:name/teams/:teamName` - Delete team by name (`Delete()` method)
- `GET /api/v2/teams/:id` - Get team by ID (`GetByID()` method) - **Provider uses this**
- `PATCH /api/v2/teams/:id` - Update team by ID (`UpdateByID()` method) - **Provider uses this**
- `DELETE /api/v2/teams/:id` - Delete team by ID (`DeleteByID()` method) - **Provider uses this**

**Route Registration**: See `backend/internal/api/v2/routes/routes.go:73-89`

**Response Format**: TFE-compatible JSON:API format with permissions calculated dynamically based on user's organization role.

### Organization Memberships Handler

**File**: `backend/internal/api/v2/handlers/organization_memberships.go`

TFE-compatible JSON:API format endpoints:

- `GET /api/v2/organization-memberships` - List organization memberships
- `POST /api/v2/organization-memberships` - Create organization membership
- `GET /api/v2/organization-memberships/:id` - Get organization membership
- `PATCH /api/v2/organization-memberships/:id` - Update organization membership
- `DELETE /api/v2/organization-memberships/:id` - Delete organization membership

**Note**: These endpoints expose the existing `OrganizationMember` model via TFE-compatible API.

### Team Project Access Handler

**File**: `backend/internal/api/v2/handlers/team_project_access.go`

**Note**: Project-level access is a StackWeaver extension (not in TFE). Teams can have access to projects (which grants access to all resources within the project).

- `GET /api/v2/projects/:id/relationships/team-access` - List team permissions on project
- `POST /api/v2/projects/:id/relationships/team-access` - Add team permission to project
- `PATCH /api/v2/projects/:id/relationships/team-access/:id` - Update team permission on project
- `DELETE /api/v2/projects/:id/relationships/team-access/:id` - Remove team permission from project

### Team Workspace Access Handler

**File**: `backend/internal/api/v2/handlers/team_workspace_access.go`

TFE-compatible JSON:API format endpoints (must match TFE exactly):

- `GET /api/v2/workspaces/:id/relationships/team-access` - List team permissions on workspace
- `POST /api/v2/workspaces/:id/relationships/team-access` - Add team permission to workspace
- `PATCH /api/v2/workspaces/:id/relationships/team-access/:id` - Update team permission on workspace
- `DELETE /api/v2/workspaces/:id/relationships/team-access/:id` - Remove team permission from workspace

**Reference**: https://developer.hashicorp.com/terraform/cloud-docs/api-docs/team-access

---

## Permission Resolution

### Current RBAC Service Implementation

**File**: `backend/internal/services/rbac/service.go`

**Implementation Status**: ✅ **COMPLETE** - Fully team-based permission resolution

**Key Methods**:

1. **`checkOrgPermission`** (line 1076-1126): Checks organization-level permissions
   - First checks if user is in "owners" team (always grants full permissions)
   - Then collects ALL permissions from ALL team memberships (additive/union model)
   - Returns true if permission is in the union

2. **`getPermissionsFromOrganizationAccess`** (line 310-380): Maps team organization access to permissions
   - **ManageProjects**: Grants `PermissionOrgManageProjects`, `PermissionOrgReadProjects`, `PermissionProjectRead` (implies read access)
   - **ManageWorkspaces**: Grants ALL workspace-level permissions (TFE-compatible: "Manage all workspaces" grants full access)
     - Includes: `PermissionOrgReadWorkspaces`, `PermissionWorkspaceRead`, `PermissionWorkspaceWrite`, `PermissionRunRead`, `PermissionRunWrite`, `PermissionRuns`, `PermissionVariables`, `PermissionStateVersions`, `PermissionSentinelMocks`, `PermissionWorkspaceLocking`, `PermissionRunTasks`
   - **ReadProjects**: Grants `PermissionOrgReadProjects`, `PermissionProjectRead`
   - **ReadWorkspaces**: Grants `PermissionOrgReadWorkspaces`, `PermissionWorkspaceRead`

3. **`CheckResourcePermission`**: Checks resource-level permissions (workspaces, projects, etc.)
   - Checks organization membership first (tenant isolation)
   - Collects permissions from all team memberships (additive)
   - Checks organization access, project access, and workspace access
   - Returns true if permission is granted by any team

**Permission Resolution Flow** (Additive/Union Model):

```
1. Check Organization Membership (Tenant Isolation)
   └─ User must be member of organization

2. Check if user is in "owners" team
   └─ If yes, grant all permissions immediately

3. Collect ALL Permissions from ALL Team Memberships:
   ├─ Get all teams user is member of
   ├─ For each team, get organization access permissions
   ├─ For each team, get project access permissions (if accessing project/workspace)
   ├─ For each team, get workspace access permissions (if accessing workspace)
   └─ Take UNION of all permissions

4. Grant if permission is in union
```

**TFE Compatibility**:
- ✅ Matches TFE behavior: "Each permission is additive, granting a user the highest level of permissions possible"
- ✅ "Manage all workspaces" grants full workspace access (most permissive level)
- ✅ "Manage all projects" implies read access (if you can manage, you can read)
- ✅ Permission resolution uses additive team-based model (same as TFE)

---

## Implementation Phases

### Phase 1: Core Teams Model & API ✅ COMPLETE

**Status**: ✅ Phase 1 implementation complete and tested

**Completed Tasks**:

1. Create database migrations (teams, team_members, team_project_access, team_workspace_access)
2. Create models (Team, TeamMember, TeamProjectAccess, TeamWorkspaceAccess) - must match TFE structure exactly
3. Create repositories (TeamRepository with all CRUD operations)
4. Create API handlers (basic CRUD for teams)
5. Register routes (TFE-compatible endpoints)
6. Test with `terraform-provider-tfe` to verify compatibility

**Deliverables**:
- Teams can be created, read, updated, deleted via API
- Team members can be added/removed via API
- Basic TFE provider compatibility verified
- Successfully tested with `terraform-provider-tfe` ✅

### Phase 1.5: Team Workspace Access API (NEW - Required for `tfe_team_access`)

**Status**: ✅ **COMPLETE**

**Why This Phase?**
- The `tfe_team_access` resource requires workspace access endpoints
- Needed before Phase 2 to test workspace permissions with provider
- Current implementation only supports simple access levels, missing custom permissions block

**Implementation**: See research document `docs/architecture/auth/teams/research/TEAM_WORKSPACE_ACCESS_RESEARCH.md`

**Completed Tasks**:
1. ✅ Updated `TeamWorkspaceAccess` model to support custom permissions block
2. ✅ Added "plan" access level support
3. ✅ Created team workspace access API handler (`TeamWorkspaceAccessHandlerV2`)
4. ✅ Registered TFE-compatible endpoints:
   - `GET /api/v2/team-workspaces` (with `filter[workspace][id]` query param)
   - `POST /api/v2/team-workspaces` (team and workspace in relationships)
   - `GET /api/v2/team-workspaces/:id`
   - `PATCH /api/v2/team-workspaces/:id`
   - `DELETE /api/v2/team-workspaces/:id`
5. ✅ Implemented validation:
   - Accepts `access="custom"` when using permissions block (provider sets this automatically)
   - Validates all permission fields are required when using custom permissions
   - Validates access OR permissions (not both, unless access is "custom")
6. ✅ Database migration for new fields (custom permission fields in `team_workspace_access` table)
7. ✅ Test with `terraform-provider-tfe` - **WORKING** ✅

**Key Implementation Details**:
- When using custom permissions, provider sends `access="custom"` AND permissions block (this is valid)
- Handler accepts `access="custom"` and processes the permissions block
- In database, `Access` field is set to `NULL` when using custom permissions (permissions fields are used instead)
- In API responses, when custom permissions are present, `access="custom"` is returned along with the permissions block
- All 6 permission fields are required when using custom permissions: `runs`, `variables`, `state-versions`, `sentinel-mocks`, `workspace-locking`, `run-tasks`

**Deliverables**:
- ✅ `tfe_team_access` resource fully supported
- ✅ Both fixed access levels (read, plan, write, admin) and custom permissions work
- ✅ Provider can create, update, delete team workspace access
- ✅ All TFE API endpoints implemented

**Reference**: 
- TFE API: https://developer.hashicorp.com/terraform/cloud-docs/api-docs/team-access
- Provider Docs: https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/team_access
- Implementation: `backend/internal/api/v2/handlers/team_workspace_access.go`

### Phase 2: Organization Memberships API

**Status**: ✅ **COMPLETE**

- https://developer.hashicorp.com/terraform/cloud-docs/api-docs/organization-memberships

**Implementation**: See handler in `backend/internal/api/v2/handlers/organization_memberships.go`

**Completed Tasks**:
1. ✅ Created organization memberships handler (`OrganizationMembershipHandlerV2`)
2. ✅ Added repository methods for listing members by organization (`ListMembers`, `GetMemberByID`, `DeleteMemberByID`)
3. ✅ Implemented JSON:API format responses matching TFE exactly
4. ✅ Registered TFE-compatible endpoints:
   - `GET /api/v2/organizations/:organization/organization-memberships` (List)
   - `POST /api/v2/organizations/:organization/organization-memberships` (Create)
   - `GET /api/v2/organization-memberships/:id` (Read)
   - `DELETE /api/v2/organization-memberships/:id` (Delete)
5. ⏳ Test with `terraform-provider-tfe` - **PENDING USER TESTING**

**Key Implementation Details**:
- TFE uses `/api/v2/organizations/:organization/organization-memberships` for List/Create
- TFE uses `/api/v2/organization-memberships/:id` for Read/Delete
- OrganizationMembership struct matches TFE format: id, type, attributes (email, status), relationships (organization, user, teams)
- Status is "active" or "invited" (invited for placeholder users created when email not found)
- Organization relationship uses organization **name** (not UUID) to match TFE behavior
- Supports include options: `?include=user,teams` for related resources
- Supports filtering: `?filter[email]=user@example.com`, `?filter[status]=active`
- Supports search: `?q=searchterm` (searches user name and email)

**Recent Updates (Latest Changes)**:
- ✅ **JSON:API Format Standardization**: Removed `format=simple` query parameter - now always returns JSON:API format
- ✅ **User Data in Included Array**: Backend always includes user data in `included` array for organization memberships list/get endpoints
- ✅ **Frontend JSON:API Parsing**: Updated frontend to parse JSON:API format consistently, extracting user data from `included` array
- ✅ **Added Role and Created-At Attributes**: `formatOrganizationMembershipResponse` now includes `role` and `created-at` attributes
- ✅ **Team Members Endpoint**: Added `GET /api/v2/teams/:id/relationships/organization-memberships` endpoint for frontend to list team members

**Known Issues / Future Work**:
- ⚠️ **Email Lookup**: The initial email lookup failure may not have been a case sensitivity issue. The implementation includes case-insensitive fallback and placeholder user creation, but the root cause needs proper investigation and testing to ensure existing users are found correctly.
- ⚠️ **Admin User "N/A" Issue**: Admin user shows "N/A" in UI - needs investigation (may not have proper organization membership or user data)
- ⚠️ **Individual Resource Delete**: Still broken (separate issue, not related to teams branch - documented in Phase 5)

**Deliverables**:
- ✅ Organization memberships can be managed via API
- ✅ TFE provider can manage organization memberships
- ✅ API responses match TFE format exactly

### Phase 1.6: Team Project Access API (NEW - Required for `tfe_team_project_access`)

**Status**: ✅ **COMPLETE**

**Why This Phase?**
- The `tfe_team_project_access` resource requires project access endpoints
- Different structure from workspace access (uses "maintain" not "plan", has "custom" option)
- Needed for complete team access support
- Can be implemented alongside Phase 1.5

**Implementation**: See handler in `backend/internal/api/v2/handlers/team_project_access.go`

**Completed Tasks**:
1. ✅ `TeamProjectAccess` model supports custom access with two permission blocks (`TeamProjectAccess` in `backend/internal/models/team_project_access.go`)
2. ✅ Added "maintain" and "custom" access level support (admin, maintain, write, read, custom)
3. ✅ Added `project-access` block fields (settings, teams, variable-sets) - nested in JSON:API format
4. ✅ Added `workspace-access` block fields (runs, variables, state-versions, etc.) - nested in JSON:API format
5. ✅ Created team project access API handler (`TeamProjectAccessHandlerV2` in `backend/internal/api/v2/handlers/team_project_access.go`)
6. ✅ Registered TFE-compatible endpoints (`/api/v2/team-projects`) - TFE uses "team-projects" as the resource type
7. ✅ Implemented validation (custom access requires both project-access and workspace-access blocks)
8. ✅ Database migration for new fields already exists (`team_project_access` table)
9. ⏳ Test with `terraform-provider-tfe` - **PENDING USER TESTING**

**Key Implementation Details**:
- TFE uses `/api/v2/team-projects` endpoint (not project-scoped)
- When using custom permissions, provider sends `access="custom"` AND nested `project-access` and `workspace-access` blocks
- Handler accepts nested blocks in JSON:API format (not top-level attributes)
- All fields in both blocks are required when using custom permissions
- Fixed access levels: admin, maintain, write, read
- Custom access: requires both `project-access` block (settings, teams, variable-sets) and `workspace-access` block (runs, variables, state-versions, etc.)

**Deliverables**:
- ✅ `tfe_team_project_access` resource fully supported
- ✅ Both fixed access levels (admin, maintain, write, read) and custom access work
- ✅ Custom access supports both `project-access` and `workspace-access` blocks (nested in JSON:API format)
- ✅ Provider can create, update, delete team project access
- ✅ All TFE API endpoints implemented (`/api/v2/team-projects`)

**Reference**: 
- TFE API: https://developer.hashicorp.com/terraform/cloud-docs/api-docs/project-team-access
- Provider Docs: https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/team_project_access
- Permissions: https://developer.hashicorp.com/terraform/cloud-docs/users-teams-organizations/permissions/project

### Phase 3: Permission Resolution & RBAC Integration

**Status**: ✅ **COMPLETE** (Fine-grained permissions added in Phase 5)

**Why This Phase?**
- After Phase 1.5 and 1.6, we need to integrate team permissions into RBAC service
- Permission resolution: Direct membership → Project access → Resource-specific access
- Resource-specific access overrides project-level access
- **Design Decision**: Make permission system resource-agnostic to support both Terraform and Ansible resources

**Completed Tasks**:
1. ✅ Extended RBAC service to be resource-agnostic:
   - Added `ResourceType` enum: `ResourceTypeTerraformWorkspace`, `ResourceTypeAnsiblePlaybook`, `ResourceTypeAnsibleInventory`, etc.
   - Added generic `CheckResourcePermission()` method that works for any resource type
   - Added `NewServiceWithTeams()` constructor to initialize RBAC with team repositories
   - Added methods to check team project access permissions
   - Added methods to check team workspace access permissions (Terraform)
   - Added methods to check team resource access (generic, for Ansible resources)
2. ✅ Implemented unified permission resolution logic:
   - Check direct organization membership (existing RBAC)
   - Check team project access (applies to all resources in project)
   - Check team resource-specific access (workspace for Terraform, resource-level for Ansible)
   - Use highest permission when multiple apply (additive permissions)
   - Resource-specific access overrides project access
3. ✅ Defined Ansible Permissions (StackWeaver-Specific):
   - Playbooks: `ansible:playbook:read`, `ansible:playbook:write`
   - Inventories: `ansible:inventory:read`, `ansible:inventory:write`
   - Credentials: `ansible:credential:read`, `ansible:credential:write`
   - Job Templates: `ansible:job-template:read`, `ansible:job-template:write`
   - Jobs: `ansible:job:read`, `ansible:job:execute`
   - Schedules: `ansible:schedule:read`, `ansible:schedule:write`
4. ✅ Implemented granular permission checks for Terraform resources:
   - State Versions: `CheckStateVersionPermission()` - checks `state_versions` permission (none, read, read-outputs, write)
   - Variables: `CheckVariablePermission()` - checks `variables` permission (none, read, write)
   - Runs: `CheckRunPermission()` - checks `runs` permission (read, plan, apply)
   - Workspace Locking: `CheckWorkspaceLockingPermission()` - checks `workspace_locking` permission (boolean)
   - Run Tasks: `CheckRunTasksPermission()` - checks `run_tasks` permission (boolean)
5. ✅ Updated Terraform handlers to use new permission checking:
   - State version handlers (List, Get, GetOutputs, Create, RemoveResource, Delete)
   - Variable handlers (List, Create, Update, Delete)
   - Workspace handlers (Lock, Unlock)
6. ✅ Mapped fixed access levels to granular permissions (Terraform):
   - `read`: state_versions=read, variables=read, runs=read, sentinel_mocks=none, workspace_locking=false, run_tasks=false
   - `plan`: state_versions=read, variables=read, runs=plan, sentinel_mocks=none, workspace_locking=false, run_tasks=false
   - `write`: state_versions=write, variables=write, runs=apply, sentinel_mocks=none, workspace_locking=true, run_tasks=true
   - `admin`: All permissions enabled (full access)

**Implementation**: See `backend/internal/services/rbac/service.go` - Extended RBAC service with team support and resource-agnostic permission checking.

**Deliverables**:
- ✅ RBAC service is resource-agnostic and checks team permissions
- ✅ Permission resolution works correctly (direct → project → resource-specific)
- ✅ Resource-specific access overrides project access appropriately
- ✅ Ansible permissions defined and integrated
- ✅ All Terraform handlers use new permission checking
- ✅ Granular permission checks implemented for state versions, variables, runs, workspace locking, run tasks

**Design Principles**:
1. **Resource-Agnostic**: Permission resolution logic works for any resource type (Terraform workspaces, Ansible playbooks, etc.)
2. **Unified Model**: Same permission resolution flow for both Terraform and Ansible resources
3. **Extensible**: Easy to add new resource types and permissions in the future
4. **TFE-Compatible**: Terraform resources follow TFE permission model exactly
5. **StackWeaver Extensions**: Ansible permissions are StackWeaver-specific (TFE doesn't have Ansible)

**Tasks**:

#### 3.1: Update RBAC Service Architecture
1. Extend RBAC service to be resource-agnostic:
   - Add `ResourceType` enum: `ResourceTypeTerraformWorkspace`, `ResourceTypeAnsiblePlaybook`, `ResourceTypeAnsibleInventory`, etc.
   - Add generic `CheckResourcePermission()` method that works for any resource type
   - Add methods to check team project access permissions
   - Add methods to check team workspace access permissions (Terraform)
   - Add methods to check team resource access (generic, for Ansible resources)
2. Implement unified permission resolution logic:
   - Check direct organization membership (existing RBAC)
   - Check team project access (applies to all resources in project)
   - Check team resource-specific access (workspace for Terraform, resource-level for Ansible)
   - Use highest permission when multiple apply (additive permissions)
   - Resource-specific access overrides project access

#### 3.2: Define Ansible Permissions (StackWeaver-Specific)
Since TFE doesn't have Ansible, we design our own permission model:

**Ansible Resource Permissions**:
- **Playbooks**: `ansible:playbook:read`, `ansible:playbook:write`
- **Inventories**: `ansible:inventory:read`, `ansible:inventory:write`
- **Credentials**: `ansible:credential:read`, `ansible:credential:write` (sensitive - requires careful handling)
- **Job Templates**: `ansible:job-template:read`, `ansible:job-template:write`
- **Jobs**: `ansible:job:read`, `ansible:job:execute`
- **Schedules**: `ansible:schedule:read`, `ansible:schedule:write`

**Permission Mapping** (for organization roles):
- `admin`: All Ansible permissions
- `member`: All Ansible permissions (read + write + execute)
- `viewer`: Read-only Ansible permissions

#### 3.3: Implement Granular Permission Checks (Terraform Resources)
TFE-compatible granular permissions for Terraform resources:
- **State Versions**: Check `state_versions` permission (none, read, read-outputs, write)
- **Variables**: Check `variables` permission (none, read, write)
- **Runs**: Check `runs` permission (read, plan, apply)
- **Sentinel Mocks**: Check `sentinel_mocks` permission (none, read)
- **Workspace Locking**: Check `workspace_locking` permission (boolean)
- **Run Tasks**: Check `run_tasks` permission (boolean)

#### 3.4: Update Handlers to Use New Permission Checking

**Terraform Handlers**:
- State version handlers (List, Get, GetOutputs, Create)
- Variable handlers (List, Get, Create, Update, Delete)
- Run handlers (List, Get, Create, Apply, Cancel)
- Workspace handlers (Lock, Unlock)

**Ansible Handlers** (NEW):
- Playbook handlers (List, Get, Create, Update, Delete, Sync)
- Inventory handlers (List, Get, Create, Update, Delete, Sync)
- Credential handlers (List, Get, Create, Update, Delete) - sensitive!
- Job template handlers (List, Get, Create, Update, Delete)
- Job handlers (List, Get, Launch, Cancel)
- Schedule handlers (List, Get, Create, Update, Delete)

#### 3.5: Map Fixed Access Levels to Granular Permissions (Terraform)
TFE-compatible mapping for fixed access levels:
- `read`: state_versions=read, variables=read, runs=read, sentinel_mocks=none, workspace_locking=false, run_tasks=false
- `plan`: state_versions=read, variables=read, runs=plan, sentinel_mocks=none, workspace_locking=false, run_tasks=false
- `write`: state_versions=write, variables=write, runs=apply, sentinel_mocks=none, workspace_locking=true, run_tasks=true
- `admin`: All permissions enabled (full access)

#### 3.6: Test Access Controls End-to-End
- Test Terraform resource access (workspaces, runs, state versions, variables)
- Test Ansible resource access (playbooks, inventories, credentials, job templates, jobs)
- Test permission resolution (direct → project → resource-specific)
- Test that resource-specific access overrides project access
- Test additive permissions when multiple teams grant access

**Deliverables**:
- RBAC service is resource-agnostic and checks team permissions
- Permission resolution works correctly (direct → project → resource-specific)
- Resource-specific access overrides project access appropriately
- Ansible permissions defined and integrated
- All Terraform handlers use new permission checking
- All Ansible handlers use new permission checking
- All access controls tested and working for both resource types

### Phase 4: Frontend/UI Implementation

**Status**: ✅ **COMPLETE** (Organization Access UI), ⏳ **DEFERRED** (Project/Workspace Access UI to Project Settings)

**Architecture Decision (2024-12-XX)**: 
- Organization-level team access: Implemented in Edit Team dialog (TFE-style structure) ✅
- Project/Workspace-level team access: Will be implemented in Project Settings page (future work) ⏳
- Projects are logical groupings with their own settings interface (similar to TFE)

**Completed Tasks**:
1. ✅ Added "Users & Teams" card to Organization Settings page (`/app/:orgName/settings`)
2. ✅ Created Users & Teams management page (`/app/:orgName/settings/users`)
   - ✅ Tabs for "Users" and "Teams"
   - ✅ Users tab: List all organization members
   - ✅ Users tab: Add members by email
   - ✅ Users tab: Edit member roles (admin, member, viewer)
   - ✅ Users tab: Remove members
   - ✅ Teams tab: List all teams
   - ✅ Teams tab: Create teams (basic - name and visibility only)
   - ✅ Teams tab: Edit teams (basic - name and visibility only)
   - ✅ Teams tab: Delete teams
   - ✅ Teams tab: Manage team members (add/remove organization memberships)
   - ✅ Loading states and error handling
3. ✅ Standardized on JSON:API format everywhere:
   - ✅ Removed `format=simple` query parameter from all frontend API calls
   - ✅ Updated frontend to parse JSON:API format consistently
   - ✅ Fixed user data extraction from `included` array in JSON:API responses
   - ✅ Backend always includes user data in `included` array for organization memberships
   - ✅ Added `role` and `created-at` attributes to `formatOrganizationMembershipResponse`
4. ✅ Fixed API endpoints:
   - ✅ Added `GET /api/v2/teams/:id/relationships/organization-memberships` endpoint for listing team members
   - ✅ Updated `ListOrganizationMemberships` handler to always return JSON:API format with user data in `included` array
   - ✅ Fixed `organizationMembershipsApi.list` to parse JSON:API with included array
   - ✅ Fixed `teamsApi.list` and `teamsApi.get` to use JSON:API format without `format=simple`
   - ✅ Updated Team interface to include `organization-access`, `users-count`, and `permissions` fields

**Completed**:
1. ✅ Complete team creation/edit UI with all Terraform provider options:
   - ✅ Team visibility dropdown (organization/secret)
   - ✅ SSO Team ID input field
   - ✅ "Allow Member Token Management" checkbox
   - ✅ Organization Access Permissions section with all 15 checkboxes:
     - ✅ Manage Policies
     - ✅ Manage Policy Overrides
     - ✅ Manage Workspaces
     - ✅ Manage VCS Settings
     - ✅ Manage Providers
     - ✅ Manage Modules
     - ✅ Manage Run Tasks
     - ✅ Manage Projects
     - ✅ Read Workspaces
     - ✅ Read Projects
     - ✅ Manage Membership
     - ✅ Manage Teams
     - ✅ Manage Organization Access
     - ✅ Access Secret Teams
     - ✅ Manage Agent Pools
2. ✅ Teams table improvements:
   - ✅ Added member count display (`{count} members`)
   - ✅ Improved visibility badge display
   - ✅ Changed "Manage Members" button to an icon in the actions column
3. ✅ Fixed team member count display - preload Members in repository List method
4. ✅ Fixed organization membership role update - added PATCH endpoint
5. ✅ Added pending invitation status display in UI - shows "Pending Invitation" badge for users with `status="invited"`
6. ✅ Added case-insensitive duplicate email check before creating placeholder users
7. ✅ **FIXED: Added permission checks to organization membership handlers** - Only admins can now create/update/delete memberships

**Known Issues**:
- ⚠️ **Individual resource delete from state**: Still broken (separate issue, not related to teams branch - documented in Phase 5, will be fixed separately)
- ⚠️ **Permission Enforcement Gaps**: See Phase 5 for detailed status of permission enforcement issues

**Recent Additions**:
- ✅ **Pending Invitation Status Display**: Added "Pending Invitation" badge for users with `status="invited"` in the UI
- ✅ **Duplicate Email Check**: Added case-insensitive duplicate email check before creating placeholder users (prevents duplicate memberships)
- ✅ **Security Fix**: Added admin-only permission checks to organization membership Create/Update/Delete handlers (2024-12-XX)

**Remaining Tasks**:
1. ⏳ Test all UI workflows end-to-end (with member count fix and pending invitation display)
2. [ ] Add team project access management UI in Project Settings page (future - per architecture decision, projects will have their own settings interface for team access management)
3. [ ] Add team workspace access management UI in Project Settings page (future - per architecture decision, projects will have their own settings interface for team access management)

**Architecture Decision (2024-12-XX)**:
- ✅ Organization-level team access UI: COMPLETE (in Edit Team dialog, TFE-style structure with radio buttons and checkboxes)
- ❌ Project/Workspace-level team access UI: Deferred to Project Settings page (not yet implemented - projects will have their own settings interface similar to TFE)
- ✅ Backend APIs: Complete and working (can be managed via Terraform provider)

**Deliverables**:
- ✅ Organization Settings card for "Users & Teams"
- ✅ Users management UI (list, add, remove, edit roles)
- ✅ Complete Teams management UI (list, create, edit, delete, manage members)
- ✅ Complete Teams management UI (with all Terraform provider options) - **COMPLETE**
- ✅ Teams table with member count and improved UI
- ✅ **Organization-level team access UI** - Complete (TFE-style in Edit Team dialog)
- ✅ Access control based on user permissions - Backend complete, frontend admin-only checks working
- ⏳ Team project access management UI - **DEFERRED** to Project Settings page (per architecture decision)
- ⏳ Team workspace access management UI - **DEFERRED** to Project Settings page (per architecture decision)
- ✅ Backend APIs for project/workspace access - Complete (usable via Terraform provider)

**Note on Issues #62 and #63**:
- **Issue #62 (Team Project Access UI)**: Partially complete - Backend API ready, organization access UI complete, project-level access UI deferred to Project Settings
- **Issue #63 (Team Workspace Access UI)**: Partially complete - Backend API ready, organization access UI complete, workspace-level access UI deferred to Project Settings
- **Architecture Decision**: Per user feedback, project/workspace access management will be in Project Settings page (separate interface), not in team management. Organization access is correctly implemented in Edit Team dialog with TFE-style structure.

**Implementation**: 
- Frontend: `frontend/src/pages/Settings/Users.tsx` - Users & Teams management page
- Frontend API: `frontend/src/api/client.ts` - Organization memberships and teams API clients
- Backend: `backend/internal/api/v2/handlers/organization_memberships.go` - Always includes user data in JSON:API responses, now with admin-only permission checks
- Backend: `backend/internal/api/v2/handlers/team_members.go` - ListOrganizationMemberships handler
- Backend: `backend/internal/api/v2/handlers/teams.go` - Team CRUD handlers


### Phase 5: Integration & Testing

**Status**: 🚧 **IN PROGRESS** - Critical Security Issues Found and Fixed, Fine-Grained Permissions Added

**Completed Tasks**:
1. ✅ End-to-end testing with `terraform-provider-tfe`:
   - ✅ Teams can be created, read, updated, deleted via Terraform
   - ✅ Organization memberships can be managed via Terraform
   - ✅ Team organization members can be added/removed via Terraform
   - ✅ Team project access can be managed via Terraform
   - ✅ Team workspace access can be managed via Terraform
2. ✅ Verified all models match TFE structure exactly
3. ✅ Tested permission resolution (direct membership, project access, workspace access)
4. ✅ Standardized on JSON:API format everywhere (removed format=simple)
5. ✅ Fixed drift issues with team organization members (consistent ordering by ID)
6. ✅ **FIXED: Critical Security Issue** - Added admin-only permission checks to organization membership handlers (members could previously change admin roles)
7. ✅ **ADDED: Fine-Grained Organization Permissions** - Added TFE-compatible fine-grained organization permissions to RBAC service:
   - ✅ `org:manage-membership` - Manage organization memberships (admin-only)
   - ✅ `org:manage-teams` - Manage teams (admin-only)
   - ✅ `org:manage-organization-access` - Manage team organization access (admin-only)
   - ✅ `org:manage-projects` - Manage projects (admin-only, members use project-level permissions)
   - ✅ `org:manage-workspaces` - Manage workspaces (admin-only, members use workspace-level permissions)
   - ✅ `org:read-workspaces` - Read workspaces (admin, member, viewer)
   - ✅ `org:read-projects` - Read projects (admin, member, viewer)
   - ✅ Plus 8 more fine-grained permissions (VCS, providers, modules, policies, etc.)
8. ✅ **FIXED: Viewer Role** - Made viewer role truly read-only (removed granular write permissions like state_versions, variables, runs)
9. ✅ **UPDATED: Member Role** - Member role keeps day-to-day operator tasks but does NOT have admin tasks (manage-membership, manage-teams, etc.)

**In Progress**:
1. 🚧 Complete UI testing:
   - [ ] Test user management workflows
   - [ ] Test team management workflows with all options
   - [ ] Test team member management
   - [ ] Verify admin user data loads correctly
   - [ ] Verify permission enforcement works correctly (members cannot change admin roles)
2. 🚧 **Permission Enforcement Refactoring** (IMPORTANT - Partially Complete):
   - [x] Fixed: Organization membership role updates - now admin-only
   - [x] Added: Fine-grained organization permissions to RBAC service
   - [x] Fixed: Viewer role - now truly read-only (removed granular write permissions)
   - [x] Updated: Member role - keeps day-to-day tasks, no admin tasks
   - [x] **COMPLETED**: Refactored organization membership handlers to use RBAC service (`PermissionOrgManageMembership`)
   - [x] **COMPLETED**: Refactored teams handlers to use RBAC service (`PermissionOrgManageTeams`)
   - [x] **COMPLETED**: Fixed team project access handler - added missing admin checks (was security issue)
   - [x] **COMPLETED**: Refactored team workspace/project access handlers to use RBAC service:
     - [x] Team workspace access handlers: Create/Update/Delete now use RBAC service (`PermissionOrgManageTeams`)
     - [x] Team project access handlers: Create/Update/Delete/List now use RBAC service (`PermissionOrgManageTeams`)
     - [x] Team workspace/project access List/Get methods: Check membership only (read operations - appropriate for day-to-day tasks)
   - [ ] **TODO**: Update remaining handlers to use fine-grained permissions:
     - [ ] Workspace handlers: Use `PermissionOrgManageWorkspaces` (org-level) or workspace-level permissions
     - [ ] Projects handlers: Use `PermissionOrgManageProjects` (org-level) or `PermissionProjectWrite` (project-level)
     - [ ] VCS handlers: Use `PermissionOrgManageVCSSettings`
     - [ ] Provider/Module handlers: Use `PermissionOrgManageProviders` / `PermissionOrgManageModules`
   - [x] **COMPLETED**: Added helper methods to RBAC service for common permission checks (`CheckOrgManageMembership`, `CheckOrgManageTeams`, etc.)
   - [ ] **TODO**: Test fine-grained permissions end-to-end
   - [ ] **TODO**: Review List methods - should listing team access require admin, or is read permission sufficient?
3. 🚧 Performance testing:
   - [ ] Test with large numbers of teams/members
   - [ ] Test permission resolution performance
4. 🚧 Documentation updates:
   - [ ] Update API reference documentation
   - [ ] Update architecture documentation
   - [ ] Document JSON:API format usage everywhere
   - [ ] Document permission model and enforcement

**Known Issues**:
- ⚠️ **Individual resource delete from state**: Broken (separate issue, not related to teams branch - will be fixed in separate branch/PR)
- ⚠️ **Drift on team organization members**: Fixed by consistent ordering (using `UserID` for team members and `ID` for organization memberships), but should monitor for regressions
- ⚠️ **Permission Enforcement Refactoring Partially Complete**:
  - ✅ **FIXED**: Organization membership role updates - was missing admin check (now fixed)
  - ✅ **FIXED**: Fine-grained organization permissions - added to RBAC service (TFE-compatible)
  - ✅ **FIXED**: Viewer role - now truly read-only (removed granular write permissions)
  - ✅ **FIXED**: Member role - keeps day-to-day operator tasks, no admin tasks (manage-membership, manage-teams, etc.)
  - ✅ **COMPLETED**: Organization membership handlers - refactored to use RBAC service (`PermissionOrgManageMembership`)
  - ✅ **COMPLETED**: Teams handlers - refactored to use RBAC service (`PermissionOrgManageTeams`)
  - ✅ **FIXED**: Team project access handler - was missing admin checks (critical security fix applied)
  - ⚠️ **Remaining handlers using direct role checks** (Not Critical - Work Correctly):
    - Workspace handlers - use direct role checks (`member.Role != "admin" && member.Role != "member"`) - allows members to create/update workspaces (day-to-day tasks, appropriate)
    - Project handlers - use direct role checks (`member.Role != "admin" && member.Role != "member"`) - allows members to create/update projects (day-to-day tasks, appropriate)
    - **Note**: These handlers work correctly for member role (allowing day-to-day tasks), but should be refactored to use fine-grained permissions for consistency:
      - Workspace Create/Update: Should check `PermissionOrgManageWorkspaces` OR workspace-level permissions (members have workspace write permission)
      - Project Create/Update: Should check `PermissionOrgManageProjects` OR project-level permissions (members have project write permission)
  - ✅ **List methods**: Team workspace/project access List methods check membership only (read operations) - appropriate for day-to-day tasks. Members can view who has access.

**Remaining Tasks**:
1. ✅ **FIXED**: Organization membership handlers - added admin-only checks and refactored to use RBAC service
2. ✅ **COMPLETED**: Added fine-grained organization permissions to RBAC service (TFE-compatible)
3. ✅ **FIXED**: Viewer role - now truly read-only (removed granular write permissions)
4. ✅ **UPDATED**: Member role - keeps day-to-day operator tasks, no admin tasks
5. ✅ **COMPLETED**: Teams handlers - refactored to use RBAC service with `PermissionOrgManageTeams`
6. ✅ **FIXED**: Team project access handler - added missing admin checks (was security issue)
7. [ ] **IMPORTANT**: Refactor team workspace/project access handlers to use RBAC service (currently use direct role checks)
8. [ ] **IMPORTANT**: Update remaining handlers (workspaces, projects, VCS, providers) to use fine-grained permissions
9. [ ] **IMPORTANT**: Review List methods - should listing team access be admin-only or allow members/viewers?
10. [ ] **IMPORTANT**: Test fine-grained permissions end-to-end
11. Fix admin user "N/A" issue (if still exists)
12. Complete UI testing with all team configuration options
13. Performance testing
14. Update documentation with accurate permission enforcement status

**Deliverables**:
- ✅ Fully functional teams system (backend)
- ✅ TFE provider compatibility verified
- ✅ Models match TFE structure exactly
- ✅ **FIXED**: Critical security issues - organization membership role updates and team project access now admin-only
- ✅ **COMPLETED**: Fine-grained organization permissions added (TFE-compatible)
- ✅ **COMPLETED**: Viewer role made truly read-only
- ✅ **COMPLETED**: Member role configured for day-to-day operator tasks (no admin tasks)
- ✅ **COMPLETED**: Major handlers refactored to use RBAC service (organization memberships, teams, team access)
- 🚧 Complete UI implementation - **IN PROGRESS**
- 🚧 **Permission enforcement** - **CRITICAL HANDLERS COMPLETE**, remaining handlers work correctly but need refactoring for consistency
- 🚧 Documentation updated - **IN PROGRESS**

### Phase 6: OIDC Provider Integration (Future)

1. Verify Zitadel supports external OIDC providers
2. Add UI in Organization Settings for OIDC provider configuration
3. Configure external identity providers via Zitadel
4. Test authentication flow with external providers
5. Document OIDC provider setup

**Deliverables**:
- Ability to link external OIDC providers (configured via Zitadel)
- UI for managing OIDC provider connections
- Documentation for OIDC provider setup

**Note**: OIDC provider integration is handled by Zitadel, not our backend. This phase is for UI/documentation only.

---

## TFE Provider Compatibility Checklist

### Teams Resource

- [x] `GET /api/v2/organizations/:name/teams` - List teams (with pagination)
- [x] `POST /api/v2/organizations/:name/teams` - Create team
- [x] `GET /api/v2/teams/:id` - Get team (JSON:API format)
- [x] `PATCH /api/v2/teams/:id` - Update team
- [x] `DELETE /api/v2/teams/:id` - Delete team

### Team Members

- [x] `GET /api/v2/teams/:id/relationships/users` - List team members
- [x] `POST /api/v2/teams/:id/relationships/users` - Add team member
- [x] `DELETE /api/v2/teams/:id/relationships/users/:user_id` - Remove team member

### Organization Memberships

- [x] `GET /api/v2/organization-memberships` - List memberships (with filters)
- [x] `POST /api/v2/organization-memberships` - Create membership
- [x] `GET /api/v2/organization-memberships/:id` - Get membership
- [x] `PATCH /api/v2/organization-memberships/:id` - Update membership (role)
- [x] `DELETE /api/v2/organization-memberships/:id` - Delete membership

### Team Access (Project Permissions) - StackWeaver Extension

- [x] `GET /api/v2/projects/:id/relationships/team-access` - List team permissions on project
- [x] `POST /api/v2/projects/:id/relationships/team-access` - Add team permission to project
- [x] `PATCH /api/v2/projects/:id/relationships/team-access/:id` - Update team permission on project
- [x] `DELETE /api/v2/projects/:id/relationships/team-access/:id` - Remove team permission from project

**Note**: Project-level access is a StackWeaver extension (not in TFE). Teams can have access to projects, which grants access to all resources within the project.

### Team Access (Workspace Permissions) - TFE Compatible

- [x] `GET /api/v2/workspaces/:id/relationships/team-access` - List team permissions on workspace
- [x] `POST /api/v2/workspaces/:id/relationships/team-access` - Add team permission to workspace
- [x] `PATCH /api/v2/workspaces/:id/relationships/team-access/:id` - Update team permission on workspace
- [x] `DELETE /api/v2/workspaces/:id/relationships/team-access/:id` - Remove team permission from workspace

**Reference**: https://developer.hashicorp.com/terraform/cloud-docs/api-docs/team-access

### Response Format

- [x] JSON:API format for all endpoints (standardized, removed format=simple)
- [x] Proper error responses (JSON:API error format)
- [x] Pagination support (page, per_page)
- [x] Filtering support (where applicable)
- [x] User data always included in `included` array for organization memberships (JSON:API pattern)

---

## Documentation Updates

**Status**: 🚧 **IN PROGRESS**

**Completed**:
- ✅ Updated implementation plan with current status

**Remaining**:
- [ ] **API Reference**: Update `docs/api-reference/backend-api-reference.md` with teams endpoints
- [ ] **Architecture Docs**: Update `docs/architecture/USER_TEAM_GROUP_ANALYSIS.md` with implementation status
- [ ] **Migration Guide**: Create guide for migrating from TFE to StackWeaver
- [ ] **JSON:API Format**: Document JSON:API format usage everywhere (removed format=simple)
- [ ] **Terraform Provider Docs**: Document StackWeaver provider (future)

## Current Status Summary

### ✅ Completed Phases
- **Phase 1**: Core Teams Model & API - ✅ COMPLETE
- **Phase 1.5**: Team Workspace Access API - ✅ COMPLETE
- **Phase 1.6**: Team Project Access API - ✅ COMPLETE
- **Phase 2**: Organization Memberships API - ✅ COMPLETE
- **Phase 3**: Permission Resolution & RBAC Integration - ✅ COMPLETE

### 🚧 In Progress / Partially Complete
- **Phase 4**: Frontend/UI Implementation - ✅ **ORGANIZATION ACCESS UI COMPLETE**, ⏳ **PROJECT/WORKSPACE ACCESS UI DEFERRED**
  - ✅ Basic UI complete (users and teams management)
  - ✅ Full team configuration options (SSO Team ID, organization access permissions)
  - ✅ Organization-level team access UI (TFE-style in Edit Team dialog)
  - ⏳ Project/Workspace access UI deferred to Project Settings page (per architecture decision - see ISSUES_62_63_STATUS.md)
- **Phase 5**: Integration & Testing - 🚧 **IN PROGRESS** (Critical Permission Work Complete)
  - ✅ Backend permission enforcement - Critical handlers complete
  - ✅ Fine-grained permissions implemented
  - ✅ Security issues fixed
  - [ ] End-to-end permission testing needed
  - [ ] UI testing pending (verify permission enforcement in UI)

### 📋 Known Issues & Architecture Decisions
2. ⚠️ **Individual resource delete from state**: Broken (separate issue, not related to teams branch - will be fixed in separate branch/PR, not blocking teams work)
3. ✅ **Architecture Decision (2024-12-XX)**: Project/Workspace access management UI deferred to Project Settings page (similar to TFE). Organization access UI is complete in Edit Team dialog. Backend APIs work via Terraform provider. See `ISSUES_62_63_STATUS.md` for details.
4. ✅ **FIXED: Permission Enforcement** (Major Progress):
   - ✅ **FIXED**: Organization membership role updates - was missing admin-only check (fixed 2024-12-XX)
   - ✅ **FIXED**: Member role permissions - now correctly configured for day-to-day tasks without admin privileges
   - ✅ **FIXED**: Fine-grained org permissions added - `manage-membership`, `manage-teams`, `manage-workspaces`, etc. (TFE-compatible)
   - ✅ **FIXED**: Viewer role - now strictly read-only
   - ✅ **FIXED**: Frontend "Users & Teams" settings hidden from non-admins
   - ✅ **FIXED**: Workspace handlers refactored to use RBAC service (Create, Update, Delete)
   - ✅ **FIXED**: Organization membership, Teams, Team access handlers refactored to use RBAC service
   - ⚠️ **REMAINING**: Project handlers need RBAC refactoring (similar to workspaces)
   - ⚠️ **REMAINING**: VCS handlers need PermissionOrgManageVCSSettings checks
   - ⚠️ **REMAINING**: Provider/Module handlers need fine-grained permission checks

### 🎯 Next Steps (Priority Order)

**Phase 4 Completion Status**:
- ✅ Organization access UI: COMPLETE (TFE-style in Edit Team dialog)
- ⏳ Project/Workspace access UI: Deferred to Project Settings page (future work)
- ✅ Backend APIs: Complete and working via Terraform provider

**Team Implementation - Ready for Commit**:
1. ✅ **COMPLETED**: Organization membership handlers - added admin-only permission checks (CRITICAL SECURITY FIX)
2. ✅ **COMPLETED**: RBAC role permissions - member/viewer permissions correctly configured
3. ✅ **COMPLETED**: Fine-grained organization permissions added (manage-membership, manage-teams, etc.)
4. ✅ **COMPLETED**: Critical handlers refactored (organization memberships, teams, team access, workspaces)
5. ✅ **COMPLETED**: Frontend "Users & Teams" settings hidden from non-admins
6. ✅ **COMPLETED**: Organization-level team access UI (TFE-style structure in Edit Team dialog)
7. ✅ **COMPLETED**: Backend APIs for project/workspace access (working via Terraform provider)
8. ⏳ Project/Workspace access UI: Deferred to Project Settings page (per architecture decision - see ISSUES_62_63_STATUS.md)
9. 🔄 **NEXT**: Team-based permissions refactor (new feature branch - see TEAM_BASED_PERMISSIONS_REFACTOR.md)

**Issues #62 and #63 Status**:
- ✅ Backend APIs: Complete and working
- ✅ Organization access UI: Complete (TFE-style)
- ⏳ Project/Workspace access UI: Deferred to Project Settings (see ISSUES_62_63_STATUS.md)
- **Recommendation**: Mark as "Partially Complete" - core functionality available via Terraform/API, UI deferred per architecture decision

---

## References

### Documentation
- **Permissions Model (Current)**: `docs/architecture/PERMISSIONS_MODEL.md` - Current org-role based model
- **Permissions Model v2.0 (Planned)**: `docs/architecture/PERMISSIONS_MODEL_V2.md` - New team-based model  
- **Implementation Plan**: `docs/architecture/TEAM_BASED_PERMISSIONS_REFACTOR.md` - Refactoring plan for team-based permissions
- **Multi-Tenancy Analysis**: `docs/architecture/MULTI_TENANCY_PERMISSIONS_ANALYSIS.md` - Permission model analysis
- **Permissions Sitrep**: `docs/architecture/PERMISSIONS_SITREP.md` - Current status and issues
- **Issues #62/#63 Status**: `docs/architecture/status/ISSUES_62_63_STATUS.md` - Status of team access UI issues
- **Team Access UI**: `docs/architecture/auth/teams/ui/TEAM_ACCESS_UI_IMPLEMENTATION.md` - UI implementation details
- **Commit Summary**: `docs/architecture/status/COMMIT_SUMMARY.md` - Summary of teams implementation commit

### External References
- TFE Teams API: https://developer.hashicorp.com/terraform/cloud-docs/api-docs/teams
- TFE Organization Memberships: https://developer.hashicorp.com/terraform/cloud-docs/api-docs/organization-memberships
- TFE Team Access: https://developer.hashicorp.com/terraform/cloud-docs/api-docs/team-access
- TFE Permissions: https://developer.hashicorp.com/terraform/enterprise/users-teams-organizations/permissions/organization
- JSON:API Spec: https://jsonapi.org/

