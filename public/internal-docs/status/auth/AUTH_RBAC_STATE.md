<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Authentication & RBAC State

**Last Updated**: 2026-01-12  
**Status**: ✅ **Current Implementation**

## Authentication (Zitadel)

- **Provider**: Zitadel OIDC v3
- **Flow**: Authorization Code Flow with PKCE
- **Tokens**: JWT access tokens (not opaque)
- **Verification**: JWKS-based signature verification
- **User ID Mapping**: Zitadel `subject` (string) → Local UUID

TODO: We need to implement auto user invitation via zitadel detailed in [the user invitation implementation](../../summaries/features/teams/USER_INVITATION_FLOW_IMPLEMENTATION.md)

### User Auto-Creation

Users are automatically created/updated in the database on first authentication:

1. User authenticates via Zitadel (JWT token)
2. Backend verifies token and extracts claims
3. Calls `GetOrCreateByZitadelSubject()` to sync user data
4. User record created/updated with Zitadel subject, email, and name
5. User ID stored in context for subsequent requests

**Implementation**: 
- `backend/internal/services/auth/service.go` - `AuthenticateMiddleware()` and `GetUserFromToken()`
- `backend/internal/repository/user.go` - `GetOrCreateByZitadelSubject()`
- `backend/internal/services/auth/zitadel.go` - `ExtractUserInfo()` with UserInfo endpoint fallback

### Email Extraction

When email is missing from JWT token claims, the system uses the OIDC UserInfo endpoint as a fallback (standard OIDC practice).

**Implementation**: `backend/internal/services/auth/zitadel.go:256-306`

## Authorization (Team-Based RBAC)

- **System**: Team-based access control (TFE-compatible)
- **Storage**: Teams, team members, team organization access, team project access, team workspace access
- **Model**: Pure team-based - all permissions come from team memberships
- **Resolution**: Additive/union model - user gets all permissions from all team memberships

### Default Teams

Every organization automatically gets two teams:
- **"owners" team**: Full permissions (manage everything)
- **"viewers" team**: Read-only permissions (view everything)

### Permission Structure

- **Organization Access**: Teams have organization-level permissions (manage-projects, manage-workspaces, etc.)
- **Project Access**: Teams can have project-level access (admin, maintain, write, read, custom)
- **Workspace Access**: Teams can have workspace-level access (admin, write, plan, read, custom)

### Permission Implications

- **ManageProjects** implies ReadProjects (if you can manage projects, you can read them)
- **ManageWorkspaces** grants ALL workspace-level permissions (TFE-compatible: "Manage all workspaces" grants full access)

**Implementation**: `backend/internal/services/rbac/service.go`

## Related Documentation

- Team-Based Permissions Refactor: [TEAM_BASED_PERMISSIONS_REFACTOR.md](../../summaries/features/teams/TEAM_BASED_PERMISSIONS_REFACTOR.md)
- Teams Implementation Plan: [TEAMS_IMPLEMENTATION_PLAN.md](../../plans/features/teams/TEAMS_IMPLEMENTATION_PLAN.md)
- User Creation Flow: [USER_CREATION_FLOW_SITREP.md](./USER_CREATION_FLOW_SITREP.md)
