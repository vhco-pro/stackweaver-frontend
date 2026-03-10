<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# User Creation Flow

**Last Updated**: 2026-01-12  
**Status**: ✅ **Current Implementation**

## Overview

StackWeaver uses an IDP-centric authentication model where **Zitadel is the source of truth for user identity**. Users are synced from Zitadel to StackWeaver's database on first authentication.

## User Model

**File**: `backend/internal/models/user.go`

```go
type User struct {
    ID             uuid.UUID `gorm:"type:uuid;primary_key"`
    ZitadelSubject string    `gorm:"type:varchar(255);uniqueIndex;not null"`
    Email          string    `gorm:"type:varchar(255);uniqueIndex"`
    Name           string    `gorm:"type:varchar(255)"`
    // ... other profile fields
}
```

**Key Constraint**: `ZitadelSubject` is `NOT NULL` and has a `UNIQUE INDEX`.

## User Creation Flows

### Flow 1: User Login via Zitadel (Primary Flow)

**File**: `backend/internal/services/auth/service.go` → `AuthenticateMiddleware()`

**Process**:
1. User authenticates via Zitadel (JWT token)
2. Middleware verifies JWT token and extracts claims
3. Calls `userRepo.GetOrCreateByZitadelSubject(subject, email, name)`
4. User is created/updated with real Zitadel subject, email, and name
5. User ID stored in context for subsequent requests

**Status**: ✅ **CORRECT** - Users are created/updated from Zitadel identity

**Implementation**:
- `backend/internal/services/auth/service.go:310` - `AuthenticateMiddleware()`
- `backend/internal/repository/user.go:64` - `GetOrCreateByZitadelSubject()`
- `backend/internal/services/auth/zitadel.go:256` - `ExtractUserInfo()` with UserInfo endpoint fallback

### Flow 2: Adding Organization Membership by Email

**File**: `backend/internal/api/v2/handlers/organization_memberships.go` → `Create()`

**Process**:
1. Admin adds user to organization by email (UI: `/app/:orgName/settings/users`)
2. Handler looks up user by email (case-insensitive)
3. **If user not found**: Creates placeholder user with temporary `zitadel_subject` like `invited-{uuid}`
4. Creates organization membership linking to this placeholder user
5. **When user logs in later**: `GetOrCreateByZitadelSubject()` finds by email and updates with real subject

**Status**: ✅ **WORKING** - Placeholder users are acceptable for TFE compatibility

**Implementation**: `backend/internal/api/v2/handlers/organization_memberships.go:273-300`

**Note**: Placeholder users with `invited-*` subjects are linked to real Zitadel users on first login. The `GetOrCreateByZitadelSubject()` method handles duplicate user cleanup automatically.

**Future Enhancement**: Automated user invitation via Zitadel Management API - See `docs/architecture/auth/users/USER_INVITATION_FLOW_IMPLEMENTATION.md` for planned implementation of automatic invitation emails when users are added to organizations.

## User Storage Model

### Zitadel (Source of Truth)
- User identity (subject, email, name, etc.)
- Authentication credentials
- User profile data

### StackWeaver Database (Sync/Cache)
- User record synced from Zitadel on login
- Organization memberships
- Team memberships
- Resource access permissions

**Key Point**: Zitadel owns identity, StackWeaver owns access control and memberships.

## Email Extraction

When email is missing from JWT token claims, the system uses the OIDC UserInfo endpoint as a fallback (standard OIDC practice).

**Implementation**: `backend/internal/services/auth/zitadel.go:256-306`

**Flow**:
1. Extract email from JWT token claims
2. If email missing, call OIDC UserInfo endpoint (`/oidc/v1/userinfo`)
3. Extract email from UserInfo response
4. Use email for user sync

## User Sync Logic

**Method**: `GetOrCreateByZitadelSubject(subject, email, name)`

**Priority Order**:
1. **Check by email first** (if provided) - handles placeholder users with `invited-*` subjects
2. **Check by ZitadelSubject** - finds existing users
3. **Check for placeholder users with empty email** - handles edge cases
4. **Create new user** - if not found

**Key Features**:
- Case-insensitive email lookup
- Automatic placeholder user linking (updates `invited-*` subjects to real subjects)
- Duplicate user cleanup (removes duplicate users with empty email)
- Profile data sync (updates email/name if changed)

**Implementation**: `backend/internal/repository/user.go:64-228`

## Related Documentation

- Authentication & RBAC State: `docs/architecture/auth/AUTH_RBAC_STATE.md`
- Teams Implementation: `docs/architecture/auth/teams/TEAM_BASED_PERMISSIONS_REFACTOR.md`
- User & Team Analysis: `docs/architecture/auth/users/USER_TEAM_GROUP_ANALYSIS.md`
- User Invitation Flow Implementation: `docs/architecture/auth/users/USER_INVITATION_FLOW_IMPLEMENTATION.md`
