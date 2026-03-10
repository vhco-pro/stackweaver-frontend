<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Permissions Model Sitrep & Analysis

**Date**: 2024-12-XX  
**Status**: 🔄 **ARCHITECTURE DECISION** - Moving to team-based permissions model

## Executive Summary

After analysis of the current permission model and multi-tenancy requirements, we have decided to **refactor to a pure team-based permission model** that eliminates organization-level roles entirely.

### Architecture Decision: Team-Based Permissions

**Problem Identified**:
1. **Permission Resolution Conflicts** - Org-level roles conflict with team permissions
2. **Multi-Tenancy Issues** - Hierarchical model (org → team) means org restrictions block team permissions
3. **Complexity** - Two permission systems (org roles + teams) are confusing
4. **TFE Mismatch** - TFE uses teams as primary permission mechanism

**Solution**: **Pure Team-Based Model**
- Remove organization-level roles (admin/member/viewer)
- Organization membership is binary (yes/no) - just access boundary
- Default "owners" team auto-created with full permissions
- Default "viewers" team auto-created with read-only permissions
- All permissions come from team memberships (additive/union)
- Projects are logical groupings with their own team access settings

**Implementation Plan**: See `TEAM_BASED_PERMISSIONS_REFACTOR.md`

---

## Current Issues (To Be Resolved by Refactor)

Critical permission enforcement has been implemented, but there are concerns about:
1. **Permission Resolution Hierarchy** - Org-level overriding team permissions incorrectly ✅ **SOLVED by team-based model**
2. **TFE Compatibility** - Org roles conflict with TFE's team-based model ✅ **SOLVED by team-based model**
3. **Error Messages** - Should be more descriptive about permission issues
4. **Team Permissions Not Working** - Org-level viewer role blocking team permissions ✅ **SOLVED by removing org roles**

---

## Issue Analysis

### Issue #1: Error Messages

**Current State**:
- Run handler returns: "You do not have permission to create runs in this workspace. Viewers can only view runs, not create or plan them."
- Workspace handler returns: "Only organization admins and members can create workspaces"

**User Concern**: Error message should explicitly mention permissions like workspace errors do.

**Assessment**: The run error message is actually quite detailed, but could be improved to match workspace error style.

**Recommendation**: Make error messages consistent - mention specific permissions that are required.

---

### Issue #2: Permission Resolution Hierarchy - Critical Question

**Current Implementation** (`backend/internal/services/rbac/service.go:264-294`):

```go
// 1. Check direct organization membership (highest priority)
hasDirectPermission, err := s.CheckPermission(ctx, userID, organizationID, permission)
if err != nil {
    return false, err
}
if hasDirectPermission {
    return true, nil  // Org-level grants permission - return immediately
}

// 2. Check team project access (if org-level returned false)
if s.teamRepo != nil {
    hasTeamProjectPermission, err := s.checkTeamProjectPermission(...)
    if hasTeamProjectPermission {
        return true, nil  // Team grants permission
    }
    
    // 3. Check team resource-specific access
    hasResourcePermission, err := s.checkTeamResourcePermission(...)
    if hasResourcePermission {
        return true, nil  // Resource-specific team access grants permission
    }
}

return false, nil  // No permission found
```

**The Logic SHOULD Work**:
- If org-level returns `false` (viewer doesn't have permission), it continues to team checks
- If team has permission, it should return `true`

**But User Reports**: Team permissions assigned to `test1@vhco.pro` (viewer) are not working.

**Potential Issues**:

1. **Team Access Not Actually Assigned**: User might think they assigned permissions, but they weren't saved/assigned correctly.

2. **Wrong Permission Being Checked**: The permission being checked might not match what was assigned via team access. For example:
   - Team project access might grant `PermissionRuns` at "write" level
   - But the check is looking for `PermissionRuns` at granular level
   - Need to verify `projectAccessGrantsPermission()` correctly maps access levels to permissions

3. **Team Membership Not Found**: User might be in team, but `checkTeamProjectPermission()` isn't finding the membership correctly.

4. **Permission Mapping Bug**: The access level → permission mapping in `projectAccessGrantsPermission()` or `workspaceAccessGrantsPermission()` might not be working correctly for the specific permission being checked.

**Example Scenario**:
- User: `test1@vhco.pro`
- Org role: `viewer` (has `PermissionRunRead` only, NOT `PermissionRuns`)
- Team: Has project access with level "write" (should grant `PermissionRuns`)
- Workspace: In that project

**Expected Flow**:
1. Check org-level `PermissionRuns`: Returns `false` (viewer doesn't have it) ✅
2. Continue to team check ✅
3. Check team project access: Should grant `PermissionRuns` at "write" level ✅
4. Return `true` ✅

**But if it's not working, possible causes**:
- Team access not actually saved to database
- User not actually in the team
- Access level mapping not working (`projectAccessGrantsPermission()` returning false incorrectly)
- Wrong permission constant being checked vs. what's mapped

---

### Issue #3: TFE Permission Model - Additive vs. Hierarchical

**TFE's Actual Model** (per web search):
- **Permissions are ADDITIVE** - User gets the UNION of all permissions from:
  - Organization role
  - Team memberships
  - Any other access grants

**Our Current Model**:
- **Hierarchical with fallback** - Check org-level first, if false, check teams
- This should still work (if org=false, check teams), but might not be how TFE actually works

**Key Question**: In TFE, if you're a viewer at org level but have write access via team:
- **TFE Model**: Viewer permissions + Team write permissions = Write access (additive)
- **Our Model**: Check org (viewer = false) → Check team (write = true) → Result: Write access ✅

Our model SHOULD produce the same result, but the semantics are different.

**However**, there's a potential issue: What if org-level has a permission but team doesn't? Our model would grant it (org-level returns true immediately). But what if team access should OVERRIDE org-level restrictions?

**Example Edge Case**:
- User is "admin" at org level (has all permissions)
- User is in team with "read" access to specific workspace
- Should admin's org-level permissions override team's "read" restriction? Or should team's "read" restrict the admin?

**Current Implementation**: Org-level wins (if org returns true, don't check teams)
**TFE Model**: Unknown - need to verify

**Recommendation**: Test with TFE to understand the actual behavior.

---

### Issue #4: Organization Access Permissions Not Enforced

**User Observation**: Many org-level permissions (like `org:manage-organization-access`) are defined but not enforced in handlers.

**Current Status**:
- ✅ `org:manage-membership` - ENFORCED
- ✅ `org:manage-teams` - ENFORCED  
- ✅ `org:manage-workspaces` - ENFORCED
- ✅ `org:manage-projects` - ENFORCED
- ✅ `org:manage-vcs-settings` - ENFORCED
- ⚠️ `org:manage-organization-access` - NOT ENFORCED (this is used for team organization access, which is managed via team handlers that use `CheckOrgManageTeams`)
- ⚠️ `org:manage-providers` - NOT ENFORCED
- ⚠️ `org:manage-modules` - NOT ENFORCED
- ⚠️ `org:manage-policies` - NOT ENFORCED
- ⚠️ `org:manage-run-tasks` - NOT ENFORCED
- ⚠️ `org:access-secret-teams` - NOT ENFORCED
- ⚠️ `org:manage-agent-pools` - NOT ENFORCED

**Note on `org:manage-organization-access`**: This permission is meant to grant a user (via team) the ability to manage team organization access. Currently, only direct org admins can manage teams via `CheckOrgManageTeams()`. This permission would need to be checked separately if we want teams to be able to manage other teams' org access.

**Assessment**: Most permissions are defined but handlers don't exist yet or haven't been updated. This is expected for a work-in-progress system.

---

## Current Permission Resolution Logic Deep Dive

### How CheckResourcePermission() Works

**Reference**: `backend/internal/services/rbac/service.go:239-295`

```go
func CheckResourcePermission(ctx, userID, resourceType, resourceID, permission, projectID) {
    // Step 1: Check org-level permissions
    hasDirectPermission = CheckPermission(ctx, userID, orgID, permission)
    if hasDirectPermission {
        return true  // Org-level grants permission - STOP HERE
    }
    
    // Step 2: Check team project access (only if org-level returned false)
    hasTeamProjectPermission = checkTeamProjectPermission(...)
    if hasTeamProjectPermission {
        return true  // Team project access grants permission
    }
    
    // Step 3: Check team resource-specific access (only if project access returned false)
    hasResourcePermission = checkTeamResourcePermission(...)
    if hasResourcePermission {
        return true  // Team resource access grants permission
    }
    
    return false  // No permission found
}
```

### How CheckPermission() Works (Org-Level)

**Reference**: `backend/internal/services/rbac/service.go:196-215`

```go
func CheckPermission(ctx, userID, organizationID, permission) {
    // Get user's org membership
    member = orgRepo.GetMember(organizationID, userID)
    if member not found {
        return false  // Not a member
    }
    
    // Get role permissions from map
    rolePermissions = rolePermissions[member.Role]
    
    // Check if permission is in role's permission list
    for each perm in rolePermissions {
        if perm == permission {
            return true  // Permission granted
        }
    }
    
    return false  // Permission not in role's list
}
```

### How checkTeamProjectPermission() Works

**Reference**: `backend/internal/services/rbac/service.go:297-348`

```go
func checkTeamProjectPermission(ctx, userID, projectID, resourceType, permission) {
    // Get all teams in organization
    teams = teamRepo.List(organizationID)
    
    for each team {
        // Check if user is team member
        members = teamRepo.GetMembers(team.ID)
        if userID not in members {
            continue  // Not in this team
        }
        
        // Get team's project access
        projectAccess = teamRepo.GetProjectAccessByTeamAndProject(team.ID, projectID)
        if projectAccess not found {
            continue  // No project access
        }
        
        // Check if project access grants permission
        if projectAccessGrantsPermission(projectAccess, resourceType, permission) {
            return true  // Team grants permission
        }
    }
    
    return false  // No team grants permission
}
```

### Potential Bugs in Team Permission Checking

**Bug Candidate #1**: `checkTeamProjectPermission()` gets all teams in org, then checks membership. But what if:
- User is in a team, but team membership lookup fails?
- `GetMembers()` returns error and we continue (skipping team)?
- Team has project access but `GetProjectAccessByTeamAndProject()` returns error and we continue?

**Bug Candidate #2**: `projectAccessGrantsPermission()` permission mapping might not be correct:
- Access level "write" should grant `PermissionRuns`, but maybe it's not?
- Access level "plan" should grant `PermissionRuns` at plan level, but we're checking for full `PermissionRuns`?

**Bug Candidate #3**: We're checking `PermissionRuns` (granular permission), but team access might grant it at a specific level (read/plan/apply). The mapping function needs to handle levels correctly.

---

## TFE Permission Model Research Needed

**Questions to Answer**:

1. **Permission Resolution**: In TFE, if user is viewer at org but has write via team, do they get write access? (Should be yes - additive)

2. **Permission Override**: In TFE, if user is admin at org but has read-only via team, can they still write? Or is team restriction enforced? (Unknown)

3. **Team Organization Access**: In TFE, can a team be granted `org:manage-organization-access` to manage other teams? (Reference shows this permission exists)

4. **Granular Permissions**: In TFE, when checking if user can create a run, does it check:
   - Just `runs` permission?
   - `runs` permission + workspace write?
   - Or is `runs` permission sufficient?

---

## Test Case Analysis: test1@vhco.pro

**User Setup**:
- Organization role: `viewer`
- Team membership: Team with no access (per earlier message)
- Later: Team with access assigned (per current message)

**Expected Behavior** (if team has "write" access to project/workspace):
- Org-level check: Viewer doesn't have `PermissionRuns` → Returns `false`
- Continue to team check: Team has "write" → Should grant `PermissionRuns` → Returns `true`
- Result: ✅ User CAN create runs (via team access)

**Actual Behavior** (user reports):
- ❌ User CANNOT create runs (team permissions not working)

**Debugging Steps Needed**:

1. **Verify Team Membership**: Is user actually in the team?
   ```sql
   SELECT * FROM team_members WHERE user_id = 'test1-user-id';
   ```

2. **Verify Team Project Access**: Does the team have project access?
   ```sql
   SELECT * FROM team_project_access WHERE team_id = 'team-id' AND project_id = 'project-id';
   ```

3. **Verify Access Level**: What access level was granted? "read", "write", "maintain", "admin", or "custom"?

4. **Check Permission Mapping**: Does `projectAccessGrantsPermission()` correctly map the access level to `PermissionRuns`?

5. **Check Resource Type**: Is `ResourceTypeTerraformWorkspace` being passed correctly?

6. **Check Project ID**: Is the workspace's project ID being passed correctly to `CheckResourcePermission()`?

---

## Identified Issues & Recommendations

### Issue A: Error Messages Could Be More Specific

**Current**: Generic permission errors  
**Recommended**: Include which permission is missing

**Example**:
```go
// Current
"You do not have permission to create runs in this workspace."

// Recommended  
"You do not have permission to create runs. Required permissions: 'runs' (write level) and 'workspace:write'. Your current permissions: 'workspace:read', 'run:read'."
```

**Trade-off**: More helpful for debugging, but might expose permission model details to users.

---

### Issue B: Permission Resolution Might Have Bugs

**Symptoms**:
- Team permissions assigned but not working
- Viewer user cannot use team-granted permissions

**Potential Causes**:
1. Team membership not being found correctly
2. Team project/workspace access not being retrieved correctly
3. Permission mapping from access levels to permissions is incorrect
4. Wrong permission constants being checked vs. what's granted

**Recommended Investigation**:
1. Add detailed logging to `CheckResourcePermission()` to trace execution
2. Verify team membership and access in database
3. Test `projectAccessGrantsPermission()` with different access levels
4. Verify permission constants match between what's granted and what's checked

---

### Issue C: Permission Model Semantics Unclear

**Question**: Should org-level permissions override team restrictions, or should team restrictions override org-level permissions?

**Current Implementation**: Org-level permissions take precedence (if org grants permission, team restrictions are ignored)

**Alternative**: Team restrictions override org-level (if team restricts, org-level permissions are limited)

**TFE Behavior**: Unknown - needs verification

**Recommendation**: Test with actual TFE instance or consult TFE documentation to understand the intended behavior.

---

### Issue D: Many Permissions Defined But Not Enforced

**Assessment**: This is expected for a work-in-progress system. Permissions are defined in the model, but handlers for those resources don't exist yet or haven't been updated.

**Priority**:
- **High**: Ansible handlers (playbooks, inventories, jobs, etc.) - these are core StackWeaver features
- **Medium**: Provider/Module handlers - important for TFE compatibility
- **Low**: Policy, run tasks, agent pools - less commonly used features

---

## Next Steps (No Changes, Just Investigation)

### Immediate (Debugging)

1. **Add Debug Logging** to `CheckResourcePermission()`:
   - Log when org-level check is performed and result
   - Log when team project access check is performed and result
   - Log when team resource access check is performed and result
   - Log which teams are being checked
   - Log which permissions are being checked

2. **Verify Database State**:
   - Check if `test1@vhco.pro` is actually in the team
   - Check if team has project/workspace access assigned
   - Check what access level was granted
   - Verify the data matches what user expects

3. **Test Permission Mapping**:
   - Manually test `projectAccessGrantsPermission()` with different access levels
   - Verify it correctly maps "write" → `PermissionRuns`
   - Verify it correctly maps "plan" → `PermissionRuns` at plan level
   - Verify it correctly maps "read" → does NOT grant `PermissionRuns`

### Short Term (Analysis)

4. **Research TFE Behavior**:
   - Test actual TFE instance with viewer user + team write access
   - Document how TFE resolves permissions
   - Determine if our model matches TFE's additive model

5. **Review Permission Constants**:
   - Verify all permission constants are used consistently
   - Check if there are permission mismatches (checking for one permission but granting another)

6. **Add Permission Debugging Endpoint** (optional):
   - Create endpoint to check what permissions a user has for a resource
   - Helpful for debugging permission issues
   - Should be admin-only for security

### Long Term (Decisions Needed)

7. **Clarify Permission Model Semantics**:
   - Decide: Should org-level override team restrictions, or vice versa?
   - Decide: Should permissions be additive (union) or hierarchical (most specific wins)?
   - Align with TFE behavior or document differences

8. **Improve Error Messages**:
   - Add permission details to error messages (with option to hide for production)
   - Make error messages consistent across all handlers

---

## Current State Summary

### ✅ What's Working
- Organization membership management (admin-only) ✅
- Teams management (admin-only) ✅
- Run handler permission checks (viewers denied) ✅
- Workspace/project handlers using fine-grained permissions ✅
- Frontend "Users & Teams" hidden from non-admins ✅

### ⚠️ What Needs Investigation
- Team permissions not working for viewer user (critical bug to debug)
- Permission resolution logic might have bugs
- Error messages could be more descriptive
- Permission model semantics need clarification (org vs. team precedence)

### 📋 What's Defined But Not Enforced
- Most org-level fine-grained permissions (providers, modules, policies, etc.) - handlers don't exist yet
- Ansible resource permissions - handlers need permission checks added

### 🔍 Unknowns
- Does TFE use additive permissions (union) or hierarchical (most specific wins)?
- Should org-level permissions override team restrictions or vice versa?
- What's the correct permission resolution order in TFE?

---

## Recommendation: Investigation First, Then Fixes

**Before making changes, we need to**:

1. **Debug the team permission issue** - This is the critical blocker
   - Add logging to trace permission checks
   - Verify database state matches expectations
   - Test permission mapping functions

2. **Clarify TFE's actual behavior** - Need to understand the intended model
   - Test with actual TFE or consult documentation
   - Document expected vs. actual behavior

3. **Decide on permission model semantics** - Once we understand TFE, decide:
   - Additive (union) vs. Hierarchical (most specific)
   - Org-level override vs. Team restriction override

**Then we can**:
- Fix any bugs found in permission resolution
- Adjust model to match TFE (if needed)
- Improve error messages
- Continue with remaining handler implementations

---

## Files to Review for Debugging

1. **Permission Resolution Logic**:
   - `backend/internal/services/rbac/service.go:239-295` (CheckResourcePermission)
   - `backend/internal/services/rbac/service.go:297-348` (checkTeamProjectPermission)
   - `backend/internal/services/rbac/service.go:350-397` (checkTeamResourcePermission)
   - `backend/internal/services/rbac/service.go:399-450` (projectAccessGrantsPermission)
   - `backend/internal/services/rbac/service.go:452-491` (workspaceAccessGrantsPermission)

2. **Run Handler Permission Checks**:
   - `backend/internal/api/v2/handlers/terraform/runs.go:549-601` (Create method permissions)
   - `backend/internal/api/v2/handlers/terraform/runs.go:1964-2030` (Apply method permissions)

3. **Database Models**:
   - `backend/internal/models/team_project_access.go` (Team project access structure)
   - `backend/internal/models/team_workspace_access.go` (Team workspace access structure)

---

## Questions to Answer

1. **Q**: When you assigned team permissions to `test1@vhco.pro`, what exactly did you assign?
   - Team project access? (which project, what level?)
   - Team workspace access? (which workspace, what level?)
   - What access level? ("read", "write", "maintain", "admin", or "custom" with granular permissions?)

2. **Q**: When the user tries to create a run, what workspace are they trying to use?
   - Is it in the project where team access was granted?
   - Or a different project/workspace?

3. **Q**: Are team permissions actually saved in the database?
   - Can you verify via database query or API call?

4. **Q**: What does TFE actually do in this scenario?
   - Viewer at org + Write via team = Can they create runs?

These answers will help debug the issue and determine if there's a bug or a misunderstanding of the model.
