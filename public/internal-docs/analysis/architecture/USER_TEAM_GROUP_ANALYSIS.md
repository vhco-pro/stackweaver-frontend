<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# User, Team, and Group System Analysis

**Last Updated**: 2026-01-12  
**Status**: ✅ **Implemented** - Teams system fully implemented

## Current Implementation

### Authentication (Zitadel OIDC)

**Status**: ✅ Implemented and Working

- **Provider**: Zitadel OIDC v3
- **Flow**: Authorization Code Flow with PKCE
- **User ID Mapping**: Zitadel `subject` (string) → Local UUID
- **Auto-Creation**: Users are automatically created/updated on first authentication via `GetOrCreateByZitadelSubject()`

**Implementation**: See `backend/internal/services/auth/service.go` and `backend/internal/services/auth/zitadel.go`

### Authorization (Team-Based RBAC)

**Status**: ✅ Implemented - Team-based permissions (TFE-compatible)

- **System**: Team-based access control (NOT role-based)
- **Storage**: Teams, team members, team organization access, team project access, team workspace access
- **Model**: Pure team-based - all permissions come from team memberships
- **Resolution**: Additive/union model - user gets all permissions from all team memberships

**Structure**:
```
Organization
  ├── Users (direct members via OrganizationMember - no roles)
  └── Teams
      ├── Team Members (users)
      ├── Team Organization Access (organization-level permissions)
      ├── Team Project Access (project-level permissions)
      └── Team Workspace Access (workspace-level permissions)
```

**Implementation**: 
- Models: `backend/internal/models/team*.go`
- Repository: `backend/internal/repository/team.go`
- Service: `backend/internal/services/rbac/service.go`
- Handlers: `backend/internal/api/v2/handlers/teams.go`, `team_members.go`, `team_project_access.go`, `team_workspace_access.go`

### Key Features

✅ **Teams API** - Full TFE-compatible teams CRUD operations  
✅ **Team Members API** - Add/remove users from teams  
✅ **Team Organization Access** - Organization-level permissions for teams  
✅ **Team Project Access** - Project-level permissions for teams (StackWeaver extension)  
✅ **Team Workspace Access** - Workspace-level permissions for teams (TFE-compatible)  
✅ **Organization Memberships API** - TFE-compatible organization membership management  
✅ **Default Teams** - "owners" and "viewers" teams created automatically  

## Zitadel Capabilities

### Groups Support

**Status**: ❌ **Zitadel does NOT natively support groups**

- Zitadel uses **roles and authorizations** instead of groups
- No native group support available

### Recommended Approach

**Use Zitadel for Authentication only, manage Authorization in Backend**

This is the current approach and is the recommended pattern:
- Zitadel excels at authentication but doesn't have groups
- Backend authorization gives full control over team/group structures
- Allows flexibility to support TFE model
- Easier to maintain compatibility with Terraform provider

## Terraform Enterprise (TFE) Compatibility

**Status**: ✅ **TFE-Compatible**

The implementation matches TFE's team-based model:
- Teams API endpoints match TFE specification
- Team members API matches TFE specification
- Team workspace access matches TFE specification
- Organization memberships API matches TFE specification
- Permission resolution uses additive/union model (same as TFE)

**TFE Provider Compatibility**: ✅ Full compatibility with `terraform-provider-tfe`

## Ansible AWX/Automation Controller

**Status**: ⚠️ **Not Required - Using Extended TFE Model**

We don't need strict AWX/Tower API compatibility. StackWeaver extends the TFE model to include Ansible resources:
- **Architectural Decision**: Extend the current TFE provider model to include Ansible resources (projects, workspaces, etc.)
- **Provider Extension**: Extend the existing `terraform-provider-tfe` (or fork) with Ansible-specific resources
- **Ansible Collection**: Future consideration - Build our own `stackweaver.stackweaver` Ansible collection to manage StackWeaver resources from Ansible playbooks (similar to `awx.awx` collection)
- This approach makes architectural sense as we can leverage the existing TFE model and extend it with Ansible-specific resources

## Comparison

| Feature | StackWeaver | Terraform Enterprise | Zitadel |
|---------|-------------|---------------------|---------|
| **Authentication** | ✅ Zitadel OIDC | ✅ Built-in/OIDC | ✅ OIDC provider |
| **Users** | ✅ Local DB (synced from Zitadel) | ✅ Users | ✅ Users |
| **Organizations** | ✅ Organizations | ✅ Organizations | ❌ N/A |
| **Teams** | ✅ Teams (implemented) | ✅ Teams | ❌ Not available |
| **Team Permissions** | ✅ Organization/Project/Workspace | ✅ Workspace | ❌ N/A |
| **TFE Compatibility** | ✅ Full compatibility | ✅ Reference | ❌ N/A |

## References

- Team-Based Permissions Refactor: `docs/architecture/auth/teams/TEAM_BASED_PERMISSIONS_REFACTOR.md`
- Teams Implementation Plan: `docs/architecture/auth/teams/TEAMS_IMPLEMENTATION_PLAN.md`
- Handler RBAC Status: `docs/architecture/auth/teams/implementation/HANDLER_RBAC_SITREP.md`
- TFE API Docs: https://developer.hashicorp.com/terraform/cloud-docs/api-docs/teams
