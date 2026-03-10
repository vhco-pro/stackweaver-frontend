<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Multi-Tenancy Permission Model Analysis

**Date**: 2024-12-XX  
**Last Updated**: 2026-01-12  
**Status**: ✅ **DECISION MADE & IMPLEMENTED** - Pure team-based additive model selected and implemented

## Executive Summary

This document analyzes different permission resolution models for multi-tenant SaaS applications. The analysis evaluated:
1. **Hierarchical Permission Model** (Previous Implementation - Deprecated) - Org → Team → Resource
2. **Additive Permission Model** (TFE Model) - Union of all permissions ✅ **SELECTED & IMPLEMENTED**
3. **Most-Restrictive Model** - Intersection of all permissions
4. **Most-Specific Wins Model** - Most granular scope wins

**Decision**: Pure Team-Based Additive Model was selected and fully implemented.

## Historical Context: Previous Hierarchical Model (Deprecated)

**Note**: This section describes the previous hierarchical model that has been replaced by the team-based additive model. It is kept for historical context and understanding the decision-making process.

### Previous Model: Hierarchical with Fallback (Deprecated)

**How It Worked**:

**Permission Resolution Order**:
```
1. Check Direct Organization Membership (Highest Priority)
   └─ If user has permission at org level → GRANT (stop checking)

2. Check Team Project Access (If org-level returned false)
   └─ If user is in team with project access → GRANT (stop checking)

3. Check Team Resource-Specific Access (If project access returned false)
   └─ If user is in team with resource access → GRANT

4. Deny (No permission found)
```

### Example Scenario

**User Setup**:
- Organization role: `viewer` (read-only)
- Team membership: "DevOps Team" with `write` access to Project A

**Permission Check**: Can user create runs in Project A workspace?

**Current Flow**:
1. Check org-level `PermissionRuns`: Viewer doesn't have it → `false`
2. Continue to team check ✅
3. Check team project access: "DevOps Team" has `write` → Grants `PermissionRuns` → `true`
4. **Result**: ✅ User CAN create runs (team access works)

**Note**: This model has been replaced. The issues described below have been resolved by moving to a pure team-based additive model.

### Problems with Hierarchical Model for Multi-Tenancy (Now Resolved)

#### Problem 1: Org-Level Override

**Issue**: If org-level grants permission, team restrictions are ignored.

**Scenario**:
- User is `admin` at org level (has all permissions)
- User is in team with `read` access to specific workspace
- **Question**: Should admin's org-level permissions override team's `read` restriction?

**Current Behavior**: Admin CAN write to workspace (org-level wins)
**Desired Behavior**: ??? (Unclear - depends on security model)

#### Problem 2: No Permission Union

**Issue**: Permissions from multiple teams are not combined.

**Scenario**:
- User is `viewer` at org level
- User is in Team A with `read` access to Workspace X
- User is in Team B with `write` access to Workspace X
- **Current Behavior**: First team check wins (could be either read or write, depending on iteration order)
- **Desired Behavior**: User should get `write` (union of permissions)

#### Problem 3: Tenant Isolation Concerns

**Issue**: If org-level permissions are too broad, they might leak across tenant boundaries (if we implement multi-org/tenant isolation).

**Scenario**:
- Organization A: User is `admin` (all permissions)
- Organization B: User is `viewer` (read-only)
- **Question**: Are these properly isolated? (Yes, if we check org membership first)

**But what if**:
- Organization A: User is `admin`
- Team in Organization A: Has `read` access to sensitive workspace
- **Current Behavior**: Admin can still write (org-level wins)
- **Security Concern**: Team-level restrictions are ignored for admins

**Status**: ✅ **RESOLVED** - Org-level roles eliminated, pure team-based model implemented

---

## Alternative Model #1: Additive/Union Model (TFE-Style)

### How It Would Work

**Permission Resolution**:
```
1. Collect all permissions from:
   - Direct organization membership
   - All team project access memberships
   - All team resource-specific access memberships

2. Take UNION of all permissions (user gets ALL permissions from ALL sources)

3. Grant if permission is in union
```

### Example Scenario

**User Setup**:
- Organization role: `viewer` (has: `PermissionRunRead`, `PermissionWorkspaceRead`)
- Team A: `read` access to Project X (grants: `PermissionRunRead`, `PermissionWorkspaceRead`)
- Team B: `write` access to Workspace Y in Project X (grants: `PermissionRunWrite`, `PermissionRuns`)

**Permission Check**: Can user create runs in Workspace Y?

**Additive Flow**:
1. Collect permissions:
   - From org: `PermissionRunRead`, `PermissionWorkspaceRead`
   - From Team A: `PermissionRunRead`, `PermissionWorkspaceRead`
   - From Team B: `PermissionRunWrite`, `PermissionRuns`
2. Union: `{PermissionRunRead, PermissionWorkspaceRead, PermissionRunWrite, PermissionRuns}`
3. Check `PermissionRuns`: ✅ In union → **GRANT**

**Result**: ✅ User CAN create runs (team B grants it)

### Advantages for Multi-Tenancy

✅ **No Permission Loss**: User never loses permissions they should have  
✅ **Multiple Team Support**: Permissions from multiple teams are combined  
✅ **Predictable**: User always gets maximum permissions they're granted anywhere  
✅ **Team-Level Granularity**: Teams can grant specific permissions without org-level restrictions blocking them  

### Disadvantages

❌ **Permission Escalation Risk**: If user is in multiple teams with different access, they get all permissions (might be too permissive)  
❌ **Debugging Complexity**: Harder to debug why a user has a permission (need to check all sources)  
❌ **Performance**: Need to check all teams (could be slow with many teams)  

---

## Alternative Model #2: Most-Restrictive/Intersection Model

### How It Would Work

**Permission Resolution**:
```
1. Collect all permissions from all sources (org + all teams)

2. Take INTERSECTION of all permissions (user gets ONLY permissions present in ALL sources)

3. Grant if permission is in intersection
```

### Example Scenario

**User Setup**:
- Organization role: `viewer` (has: `PermissionRunRead`, `PermissionWorkspaceRead`)
- Team A: `read` access (grants: `PermissionRunRead`, `PermissionWorkspaceRead`)
- Team B: `write` access (grants: `PermissionRunWrite`, `PermissionRuns`)

**Permission Check**: Can user create runs?

**Intersection Flow**:
1. Collect permissions:
   - From org: `{PermissionRunRead, PermissionWorkspaceRead}`
   - From Team A: `{PermissionRunRead, PermissionWorkspaceRead}`
   - From Team B: `{PermissionRunWrite, PermissionRuns}`
2. Intersection: `{PermissionRunRead}` (only permission in ALL sources)
3. Check `PermissionRuns`: ❌ Not in intersection → **DENY**

**Result**: ❌ User CANNOT create runs (org-level restricts it)

### Advantages for Multi-Tenancy

✅ **Security-First**: Most restrictive access wins (best for security-sensitive environments)  
✅ **Prevents Permission Escalation**: User can't gain permissions by being in multiple teams  
✅ **Explicit Granting Required**: All sources must grant permission (defense in depth)  

### Disadvantages

❌ **Too Restrictive**: User loses permissions they should have (team B grants write, but org-level blocks it)  
❌ **Not Practical**: Would require all org-level roles to have all possible permissions (defeats purpose of roles)  
❌ **Poor UX**: Confusing behavior - team grants write, but user can't write  

---

## Alternative Model #3: Most-Specific Wins Model

### How It Would Work

**Permission Resolution**:
```
1. Check permissions at each scope level:
   - Resource-specific (most specific - workspace access)
   - Project-level (medium specificity - project access)
   - Organization-level (least specific - org role)

2. Most specific scope that grants/denies permission wins

3. If no specific permission found, deny
```

### Example Scenario

**User Setup**:
- Organization role: `admin` (has all permissions)
- Team: `read` access to specific Workspace X

**Permission Check**: Can user write to Workspace X?

**Most-Specific Flow**:
1. Check resource-specific (workspace access): `read` → Denies write
2. Check project-level: (not checked - resource-specific found)
3. Check org-level: (not checked - resource-specific found)
4. **Result**: Resource-specific `read` wins → ❌ User CANNOT write (team restriction overrides admin)

### Advantages for Multi-Tenancy

✅ **Granular Control**: Most specific permissions always win (better for fine-grained access)  
✅ **Team Restrictions Work**: Team-level restrictions can override org-level permissions  
✅ **Principle of Least Privilege**: Users get minimum permissions they need (most restrictive wins at specific level)  

### Disadvantages

❌ **Admin Confusion**: Admins might expect org-level permissions to always work  
❌ **Complex Logic**: Need to determine "specificity" ordering (resource > project > org)  
❌ **Permission Inconsistency**: Same permission might be granted at org level but denied at resource level  

---

## Recommended Model for Multi-Tenancy: Pure Team-Based Additive Model ✅ **SELECTED**

### Final Architecture Decision

After analysis, we have selected a **Pure Team-Based Additive Model** that eliminates organization-level roles entirely.

**Permission Resolution with Tenant Isolation**:
```
1. Check Tenant/Organization Isolation (CRITICAL - must be first)
   └─ User must be member of organization (cannot access other orgs)
   └─ Organization membership is binary (yes/no) - no roles

2. Collect ALL permissions from ALL team memberships:
   - Team organization access permissions (org-level permissions)
   - All team project access memberships (project-level permissions)
   - All team resource-specific access memberships (resource-level permissions)

3. Take UNION of all permissions (additive)

4. Grant if permission is in union

5. Default Teams:
   - "owners" team: Full permissions (auto-created, org creator added)
   - "viewers" team: Read-only permissions (auto-created)
```

### Why This Model Solves All Issues

✅ **Eliminates Permission Conflicts**: No org-level roles to conflict with teams  
✅ **Pure Additive**: All permissions from teams are combined (no blocking)  
✅ **Clear Tenant Boundary**: Org membership is simple binary check  
✅ **TFE-Compatible**: Matches TFE's team-based model  
✅ **Simpler**: One permission system (teams) instead of two (org roles + teams)  
✅ **Flexible**: Fine-grained control via team organization access  
✅ **Predictable**: Permissions come from explicit team memberships  

### Implementation Plan

See `docs/architecture/TEAM_BASED_PERMISSIONS_REFACTOR.md` for detailed implementation plan.

### Why This Model?

**✅ Best for Multi-Tenancy**:
- **Tenant Isolation First**: Organization membership check ensures users can't access other tenants
- **Additive Permissions**: Users get maximum permissions they're granted (no permission loss)
- **Multiple Team Support**: Permissions from multiple teams are combined correctly
- **Granular Override**: Resource-specific access can override project-level access (most specific wins for that resource)

**✅ Security**:
- Tenant boundary is enforced first (critical for multi-tenancy)
- Permissions are additive (more permissive) but bounded by tenant
- Resource-specific restrictions can still override (team can restrict specific workspace)

**✅ User Experience**:
- Predictable: Users get permissions they're granted (no confusion about why access is denied)
- Flexible: Teams can grant specific permissions without org-level blocking them
- Intuitive: Multiple teams = combined permissions

### Example: Viewer User with Team Write Access

**User Setup**:
- Organization: `viewer` role (has: `PermissionRunRead`, `PermissionWorkspaceRead`)
- Team: "DevOps" with `write` access to Project A

**Permission Check**: Can user create runs in Project A workspace?

**Hybrid Additive Flow**:
1. ✅ Tenant isolation: User is member of organization
2. Collect permissions:
   - From org role: `{PermissionRunRead, PermissionWorkspaceRead}`
   - From Team DevOps project access: `{PermissionProjectWrite, PermissionWorkspaceWrite, PermissionRuns, ...}`
3. Union: `{PermissionRunRead, PermissionWorkspaceRead, PermissionProjectWrite, PermissionWorkspaceWrite, PermissionRuns, ...}`
4. Check `PermissionRuns`: ✅ In union → **GRANT**

**Result**: ✅ User CAN create runs (team grants it, org-level doesn't block it)

### Implementation Changes Needed

**Current Implementation** (`CheckResourcePermission`):
```go
// Current: Hierarchical with early return
if hasDirectPermission {
    return true  // Org-level wins - stops checking teams
}
// Check teams...
```

**Recommended Implementation**:
```go
// Recommended: Additive with tenant isolation
// 1. Tenant isolation check (already done via org membership)
// 2. Collect all permissions
orgPermissions := getOrgRolePermissions(member.Role)
teamProjectPermissions := getAllTeamProjectPermissions(userID, projectID)
teamResourcePermissions := getAllTeamResourcePermissions(userID, resourceID)

// 3. Take union
allPermissions := union(orgPermissions, teamProjectPermissions, teamResourcePermissions)

// 4. But resource-specific overrides project for this resource
// If user has resource-specific access, use that instead of project access
effectivePermissions := teamResourcePermissions
if len(effectivePermissions) == 0 {
    effectivePermissions = teamProjectPermissions
}
if len(effectivePermissions) == 0 {
    effectivePermissions = orgPermissions
}

// 5. Check permission
return contains(effectivePermissions, permission)
```

**OR** (Simpler additive model):
```go
// Simple additive: Just take union of all permissions
allPermissions := union(orgPermissions, teamProjectPermissions, teamResourcePermissions)
return contains(allPermissions, permission)
```

---

## Comparison Matrix

| Model | Tenant Isolation | Multiple Teams | Team Restrictions | Permission Escalation Risk | Performance | Complexity |
|-------|-----------------|----------------|-------------------|---------------------------|-------------|------------|
| **Hierarchical (Current)** | ✅ Good | ❌ First wins | ❌ Org overrides | ⚠️ Medium (org-level too broad) | ✅ Fast (early return) | ✅ Simple |
| **Additive/Union** | ✅ Good | ✅ Combined | ❌ Cannot restrict | ⚠️ High (union too permissive) | ⚠️ Slower (check all) | ⚠️ Medium |
| **Intersection** | ✅ Good | ✅ Combined | ✅ Can restrict | ✅ Low (most restrictive) | ⚠️ Slower | ⚠️ Medium |
| **Most-Specific** | ✅ Good | ⚠️ Most specific wins | ✅ Can restrict | ✅ Low | ✅ Fast | ❌ Complex |
| **Hybrid Additive** | ✅ Excellent | ✅ Combined | ⚠️ Resource-specific can override | ⚠️ Medium | ⚠️ Slower | ⚠️ Medium |

---

## Recommendation for StackWeaver ✅ **DECISION MADE & IMPLEMENTED**

### Final Decision: Pure Team-Based Model

After thorough analysis, we decided to **refactor to a pure team-based permission model** that eliminates organization-level roles entirely. This decision has been **fully implemented**.

### Implementation Status

**Status**: ✅ **COMPLETE** - All phases implemented and tested

See `docs/architecture/auth/teams/TEAM_BASED_PERMISSIONS_REFACTOR.md` for detailed implementation status.

**Implementation Summary**:
1. ✅ **Phase 1**: Database & Model Changes - Org roles removed, default teams auto-created
2. ✅ **Phase 2**: RBAC Service Refactoring - Pure team-based permission resolution implemented (additive/union model)
3. ✅ **Phase 3**: Handler Updates - All handlers updated to use team-based checks
4. ✅ **Phase 4**: Frontend Updates - Role selectors removed, default teams shown
5. ✅ **Phase 5**: Migration Script - Migration script created for existing organizations
6. ✅ **Phase 6**: Testing & Validation - Comprehensive testing completed

### Why This Solves Multi-Tenancy Issues

✅ **No Permission Conflicts**: Removing org roles eliminates all conflicts  
✅ **Additive Model**: Pure union of team permissions (no blocking)  
✅ **Clear Isolation**: Org membership = tenant boundary (simple, binary)  
✅ **TFE-Compatible**: Matches TFE's architecture  
✅ **Simpler Codebase**: One permission system instead of two  
✅ **Better UX**: Clearer team-based permission management  

### Migration Strategy

- **New Organizations**: Use team-based model from start
- **Existing Organizations**: Migration script creates default teams and moves users
- **Backward Compatibility**: Support both during transition, then remove old code  

---

## TFE Compatibility Considerations

**Question**: How does TFE actually resolve permissions?

**According to TFE Documentation**:
- Permissions are **additive** (union) - user gets all permissions from org role + all teams
- Resource-specific access (workspace) overrides project-level access for that resource
- Organization-level permissions apply to all resources unless overridden by team restrictions

**Our Current Model vs TFE**:
- ✅ **Compatible**: Our hierarchical model with team fallback should produce same results as TFE's additive model (if org-level is restrictive, teams add permissions)
- ❌ **Difference**: Our model has early return (org-level wins), TFE's is fully additive
- ⚠️ **Edge Case**: If TFE allows team restrictions to override org-level permissions, our model doesn't support that

**Recommendation**: Test with actual TFE to verify behavior, then align our model to match TFE exactly.

---

## Implementation Decisions Made

1. **Q**: Should org-level `admin` permissions be restricted by team `read` access?
   - **A**: ✅ **RESOLVED** - Org-level roles eliminated entirely (no admin role)

2. **Q**: Should permissions from multiple teams be combined (union) or most-restrictive (intersection)?
   - **A**: ✅ **RESOLVED** - UNION model implemented (additive permissions)

3. **Q**: How does TFE actually behave in these edge cases?
   - **A**: ✅ **RESOLVED** - Model matches TFE behavior (additive/union model)

4. **Q**: What's the performance impact of checking all teams vs. early return?
   - **A**: ✅ **RESOLVED** - Team-based resolution implemented and tested

---

## Conclusion

**Decision Made**: Pure Team-Based Additive Model was selected and implemented.

**Implemented Model**:
- ✅ Tenant isolation first (organization membership check)
- ✅ Additive permissions (union of all team memberships)
- ✅ Multiple team support (permissions combined from all teams)
- ✅ Default teams ("owners" and "viewers") auto-created
- ✅ TFE-compatible permission resolution

**Status**: ✅ **FULLY IMPLEMENTED** - System ready for production use

**References**:
- Implementation Details: `docs/architecture/auth/teams/TEAM_BASED_PERMISSIONS_REFACTOR.md`
- Permissions Model: `docs/architecture/auth/permissions/PERMISSIONS_MODEL_V2.md`
