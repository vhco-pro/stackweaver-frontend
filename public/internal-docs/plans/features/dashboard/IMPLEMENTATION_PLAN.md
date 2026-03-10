<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Dashboard Enhancement Implementation Plan

This document outlines the plan to transform the StackWeaver dashboard into a comprehensive, user-centric experience that supports both Terraform and Ansible operations.

## Executive Summary

**Primary Approach**: Create a new dashboard stats endpoint (`GET /api/v2/dashboard/stats`) that aggregates all dashboard data in a single request with server-side user filtering.

**TFE Compatibility**: ✅ **FULLY COMPATIBLE**
- New endpoint is NOT part of TFE spec (safe to implement any features)
- No breaking changes to existing TFE-compatible endpoints
- Terraform Enterprise provider will continue to work unchanged

**Key Benefits**:
- Single API call instead of multiple parallel requests
- Server-side user filtering (more secure, better performance)
- Better performance (database joins vs multiple queries)
- Simpler frontend code
- TFE provider compatibility maintained

## Implementation Status

✅ **COMPLETED**:
- Repository methods for user-filtered queries (RunRepository, AnsibleJobRepository)
- Dashboard stats endpoint handler (`GET /api/v2/dashboard/stats`)
- Dashboard route registration
- Frontend dashboard API client
- Dashboard component updated to use stats endpoint
- Dynamic Getting Started section
- Summary cards updated with Ansible data
- Organization cards updated with combined Terraform/Ansible metrics

**Implementation References**:
- Dashboard Handler: `backend/internal/api/v2/handlers/dashboard.go`
- Route Registration: `backend/internal/api/v2/routes/routes.go:575-583`
- Frontend API: `frontend/src/api/client.ts` (dashboardApi)
- Dashboard Component: `frontend/src/pages/Dashboard.tsx`

## Goals

1. **Multi-Platform Support**: Integrate Ansible operations alongside Terraform
2. **User-Specific Metrics**: Show only runs/jobs started by the current user
3. **Dynamic Getting Started**: Hide suggestions when resources already exist
4. **Comprehensive Organization View**: Display data for all user organizations
5. **Real-Time Updates**: Ensure active/completed metrics update correctly

## Current Issues Analysis

### Issue 1: Active/Completed Runs Not User-Specific

**Problem**: Dashboard shows all runs across all organizations, not filtered by the current user.

**Root Cause**: 
- Dashboard fetches runs from all workspaces without filtering by `created_by`
- No backend endpoint to filter runs by user ID
- Frontend doesn't have access to current user's database UUID

**Location**: 
- Frontend: `frontend/src/pages/Dashboard.tsx:71-165`
- Backend: `backend/internal/repository/run.go:32-80` (no user filtering)

### Issue 2: Missing Ansible Integration

**Problem**: Dashboard only shows Terraform workspaces and runs, completely missing Ansible jobs.

**Root Cause**:
- Dashboard only queries Terraform workspaces via `workspacesApi.list()`
- No queries to Ansible job APIs
- Summary cards only count Terraform runs

**Location**:
- Frontend: `frontend/src/pages/Dashboard.tsx:79-109` (only Terraform queries)

### Issue 3: Static Getting Started Section

**Problem**: Getting Started suggestions don't hide when resources are created.

**Root Cause**:
- Suggestions are hardcoded and always displayed
- No conditional logic to check if org/project/workspace exists

**Location**:
- Frontend: `frontend/src/pages/Dashboard.tsx:455-512`

### Issue 4: Organization Data Display

**Problem**: May not properly aggregate data for all user organizations.

**Current Implementation**: Already fetches all organizations, but may need verification.

**Location**:
- Frontend: `frontend/src/pages/Dashboard.tsx:65-146`

## TFE Compatibility Considerations

**Important**: All changes must maintain compatibility with Terraform Enterprise API specification.

### Findings from TFE API Documentation

1. **No `created_by` Filtering in TFE Spec**: The Terraform Enterprise API does not provide a `created_by` query parameter for filtering runs. The standard runs endpoints (`GET /api/v2/workspaces/:id/runs`, `GET /api/v2/organizations/:name/runs`) do not support user-based filtering.

2. **Safe Approach**: 
   - Creating **new endpoints** (like dashboard stats) is completely safe (not part of TFE spec)
   - The `created_by` field already exists in run responses (JSON:API format), so we're not adding new fields

3. **Recommended Strategy**:
   - Use a new dashboard stats endpoint (not in TFE spec, full control, production-grade architecture)

## Implementation Steps

### Phase 1: Backend Enhancements

#### Step 1.1: Create Dashboard Stats Endpoint

**New Endpoint**: `GET /api/v2/dashboard/stats`

**TFE Compatibility**: ✅ **SAFE** - This endpoint is NOT part of the Terraform Enterprise API specification, so we have full control and can implement any features we need without breaking compatibility.

**Purpose**: Provide aggregated dashboard statistics in a single request, reducing frontend complexity and enabling user-specific filtering.

**Authentication**: Requires authenticated user (JWT or TFE token). User ID is extracted from context (not a query parameter for security).

**Response Format** (JSON:API compatible):
```json
{
  "data": {
    "type": "dashboard-stats",
    "attributes": {
      "projects": 5,
      "terraform_workspaces": 12,
      "ansible_playbooks": 8,
      "active_terraform_runs": 2,
      "active_ansible_jobs": 1,
      "completed_terraform_runs_this_month": 45,
      "completed_ansible_jobs_this_month": 23,
      "organizations": [
        {
          "id": "...",
          "name": "main",
          "projects": 3,
          "terraform_workspaces": 5,
          "ansible_playbooks": 2,
          "active_terraform_runs": 1,
          "active_ansible_jobs": 0,
          "completed_terraform_runs_this_month": 10,
          "completed_ansible_jobs_this_month": 2
        }
      ]
    }
  }
}
```

**Implementation Details**:
- **Handler Location**: `backend/internal/api/v2/handlers/dashboard.go` (new file)
- **Route Registration**: `backend/internal/api/v2/routes/routes.go`
- **User Filtering**: Automatically filters runs/jobs by `created_by` matching the authenticated user's database UUID
- **Repository Methods Needed**:
  - `RunRepository.ListByUser(userID, limit, offset)` - for user-specific Terraform runs
  - `AnsibleJobRepository.ListByUser(userID, limit, offset)` - for user-specific Ansible jobs
  - `RunRepository.ListByOrganizationAndUser(orgID, userID, limit, offset)` - for org-scoped user runs
  - `AnsibleJobRepository.ListByOrganizationAndUser(orgID, userID, limit, offset)` - for org-scoped user jobs

**Benefits**:
- ✅ Single request instead of multiple parallel requests
- ✅ Server-side filtering by user ID (more secure, better performance)
- ✅ Consistent data aggregation logic
- ✅ Better performance (single database query with joins)
- ✅ TFE-compatible (new endpoint, doesn't affect existing TFE endpoints)
- ✅ No breaking changes to existing API

**Reference**: 
- Auth context: `backend/internal/services/auth/service.go:55-72` (GetUserFromContext)
- Run model: `backend/internal/models/run.go:62` (CreatedBy field)
- Ansible job model: `backend/internal/models/ansible_job.go:95` (CreatedBy field)

#### Step 1.2: Add User-Specific Repository Methods

**Purpose**: These repository methods are required by the dashboard stats endpoint to filter data by user.

**Files to Modify**:
- `backend/internal/repository/run.go`
- `backend/internal/repository/ansible_job.go` (check if exists, or create)

**Changes for RunRepository**:
1. Add `ListByUser` method:
   ```go
   // ListByUser lists runs created by a specific user across all organizations
   func (r *RunRepository) ListByUser(userID uuid.UUID, limit, offset int) ([]models.Run, int64, error)
   ```

2. Add `ListByOrganizationAndUser` method:
   ```go
   // ListByOrganizationAndUser lists runs for an organization filtered by user
   func (r *RunRepository) ListByOrganizationAndUser(organizationID, userID uuid.UUID, limit, offset int) ([]models.Run, int64, error)
   ```

**Changes for AnsibleJobRepository**:
1. Add `ListByUser` method:
   ```go
   // ListByUser lists Ansible jobs created by a specific user across all organizations
   func (r *AnsibleJobRepository) ListByUser(userID uuid.UUID, limit, offset int) ([]models.AnsibleJob, int64, error)
   ```

2. Add `ListByOrganizationAndUser` method:
   ```go
   // ListByOrganizationAndUser lists Ansible jobs for an organization filtered by user
   func (r *AnsibleJobRepository) ListByOrganizationAndUser(organizationID, userID uuid.UUID, limit, offset int) ([]models.AnsibleJob, int64, error)
   ```

**Reference**: 
- Run repository: `backend/internal/repository/run.go:58-81` (existing organization filtering pattern)
- Ansible job model: `backend/internal/models/ansible_job.go:95` (CreatedBy field)
- Ansible job handler: `backend/internal/api/v2/handlers/ansible/jobs.go`

**TFE Compatibility**: ✅ **SAFE** - Ansible endpoints are not part of TFE spec, so we have full control.

**Files to Modify**:
- `backend/internal/repository/ansible_job.go` (check if exists, or create)
- Used by dashboard stats endpoint (Step 1.1)

**Changes**:
1. Add `ListByUser` method to Ansible job repository:
   ```go
   // ListByUser lists Ansible jobs created by a specific user across all organizations
   func (r *AnsibleJobRepository) ListByUser(userID uuid.UUID, limit, offset int) ([]models.AnsibleJob, int64, error)
   ```

2. Add `ListByOrganizationAndUser` method:
   ```go
   // ListByOrganizationAndUser lists Ansible jobs for an organization filtered by user
   func (r *AnsibleJobRepository) ListByOrganizationAndUser(organizationID, userID uuid.UUID, limit, offset int) ([]models.AnsibleJob, int64, error)
   ```

**Note**: These methods are used by the dashboard stats endpoint to provide user-filtered data.

**Reference**: 
- Ansible job model: `backend/internal/models/ansible_job.go:95` (CreatedBy field)
- Ansible job handler: `backend/internal/api/v2/handlers/ansible/jobs.go`

### Phase 2: Frontend Enhancements

#### Step 2.1: Add Dashboard API Client

**Files to Modify**:
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/api/client.ts` (add dashboard API)

**Changes**:
1. Add dashboard API to client:
   ```typescript
   // In frontend/src/api/client.ts
   export const dashboardApi = {
     getStats: () =>
       apiClient.get<JsonApiResponse<JsonApiResource>>('/dashboard/stats'),
   };
   ```

2. Replace multiple API calls with single stats endpoint:
   ```typescript
   // In Dashboard.tsx
   const statsRes = await dashboardApi.getStats();
   const stats = statsRes.data.attributes;
   // Use stats.projects, stats.active_terraform_runs, etc.
   ```

**Benefits**:
- ✅ Single API call instead of multiple parallel requests
- ✅ User filtering handled server-side (more secure)
- ✅ Better performance
- ✅ Simpler frontend code

**Reference**: 
- Dashboard component: `frontend/src/pages/Dashboard.tsx:60-165`
- Client API: `frontend/src/api/client.ts`

#### Step 2.2: Update Dashboard Component to Use Stats Endpoint

**Files to Modify**:
- `frontend/src/pages/Dashboard.tsx`

**Changes**:
1. Replace existing data fetching logic with stats endpoint call
2. Update state interfaces to match stats endpoint response
3. Remove individual API calls for runs, workspaces, projects (handled by stats endpoint)
4. Update summary cards to use stats data:
   - `stats.active_terraform_runs` + `stats.active_ansible_jobs` = total active operations
   - `stats.completed_terraform_runs_this_month` + `stats.completed_ansible_jobs_this_month` = total completed
   - `stats.terraform_workspaces` for workspaces count
   - `stats.projects` for projects count

5. Update organization cards to use `stats.organizations` array

**Reference**: 
- Dashboard component: `frontend/src/pages/Dashboard.tsx:45-225`
- Current stats interface: `frontend/src/pages/Dashboard.tsx:21-36`

#### Step 2.3: Make Getting Started Dynamic

**Files to Modify**:
- `frontend/src/pages/Dashboard.tsx`

**Changes**:
1. Track what resources exist:
   ```typescript
   const hasOrganization = organizations.length > 0;
   const hasProject = totalProjects > 0;
   const hasWorkspace = totalWorkspaces > 0;
   ```

2. Conditionally render Getting Started items:
   ```typescript
   {!hasOrganization && (
     <div className="p-4 rounded-lg...">
       {/* Create Organization suggestion */}
     </div>
   )}
   {hasOrganization && !hasProject && (
     <div className="p-4 rounded-lg...">
       {/* Create Project suggestion */}
     </div>
   )}
   {hasProject && !hasWorkspace && (
     <div className="p-4 rounded-lg...">
       {/* Create Workspace suggestion */}
     </div>
   )}
   ```

3. Hide entire Getting Started section if all resources exist:
   ```typescript
   {(!hasOrganization || !hasProject || !hasWorkspace) && (
     <div className="p-6 rounded-xl...">
       {/* Getting Started section */}
     </div>
   )}
   ```

#### Step 2.4: Update Summary Cards

**Files to Modify**:
- `frontend/src/pages/Dashboard.tsx`

**Changes**:
1. Update "Workspaces" card description:
   - Change from "Terraform workspaces" to "Terraform workspaces" (keep but add Ansible)
   - Or create separate cards for Terraform and Ansible

2. Add new summary cards (optional):
   - "Ansible Playbooks" card
   - "Active Ansible Jobs" card
   - Or combine into unified "Active Operations" card

3. Update card descriptions to be more generic:
   - "Active Runs" → "Active Operations" (includes both Terraform and Ansible)
   - "Completed" → "Completed This Month" (includes both)

#### Step 2.5: Update Organization Cards

**Files to Modify**:
- `frontend/src/pages/Dashboard.tsx`

**Changes**:
1. Include Ansible stats in organization cards:
   ```typescript
   interface OrganizationStats {
     // ... existing fields
     ansiblePlaybooks: number;
     activeAnsibleJobs: number;
     completedAnsibleJobs: number;
   }
   ```

2. Display Ansible metrics in organization card grid

3. Ensure all organizations are displayed (verify current implementation)

### Phase 3: UI/UX Improvements

#### Step 3.1: Update Card Descriptions

**Current**: "Terraform workspaces"  
**Updated**: "Terraform workspaces" (keep specific) or "Workspaces" (if unified)

**Considerations**:
- Keep Terraform-specific language for clarity
- Add tooltips explaining what's included
- Consider separate sections for Terraform vs Ansible

#### Step 3.2: Add Operation Type Indicators

**Enhancement**: Show icons or badges indicating operation type (Terraform vs Ansible) in:
- Active runs/jobs list
- Recent activity
- Organization cards

#### Step 3.3: Improve Loading States

**Current**: Basic loading spinner  
**Enhancement**: 
- Skeleton loaders for cards
- Progressive loading (show data as it arrives)
- Better error states

### Phase 4: Testing & Validation

#### Step 4.1: Test User-Specific Filtering

**Test Cases**:
1. User A creates runs, User B should not see them
2. User A's active runs show correctly
3. User A's completed runs (this month) show correctly
4. Organization-level filtering works correctly

#### Step 4.2: Test Ansible Integration

**Test Cases**:
1. Ansible jobs appear in dashboard
2. Ansible job counts are accurate
3. Active Ansible jobs show correctly
4. Completed Ansible jobs (this month) show correctly

#### Step 4.3: Test Dynamic Getting Started

**Test Cases**:
1. New user sees all suggestions
2. After creating org, "Create Organization" disappears
3. After creating project, "Create Project" disappears
4. After creating workspace, "Create Workspace" disappears
5. When all exist, entire section disappears

#### Step 4.4: Test Multi-Organization

**Test Cases**:
1. User with multiple orgs sees all orgs
2. Stats aggregate correctly across orgs
3. Organization cards show correct per-org stats

## Implementation Order

### Recommended Sequence (Using Dashboard Stats Endpoint)

**This is the recommended approach for best performance and TFE compatibility.**

1. **Phase 1.1**: Create dashboard stats endpoint (single source of truth)
   - Create dashboard handler with user context extraction
   - Register route in `routes.go`

2. **Phase 1.2**: Add repository methods for user-filtered queries
   - Add `ListByUser` and `ListByOrganizationAndUser` to RunRepository
   - Add `ListByUser` and `ListByOrganizationAndUser` to AnsibleJobRepository

3. **Phase 2.1**: Frontend - Add dashboard API client method

4. **Phase 2.2**: Frontend - Replace all individual queries with stats endpoint call
   - Update Dashboard component to use single API call
   - Update state management
   - Update summary cards

5. **Phase 2.3**: Dynamic Getting Started (improves UX)

6. **Phase 2.4-2.5**: Update cards and organization display (polish)

7. **Phase 3**: UI/UX improvements (enhancements)

8. **Phase 4**: Testing (validation)

**Benefits**: 
- ✅ Cleaner code (single API call)
- ✅ Better performance (server-side aggregation)
- ✅ Easier to maintain
- ✅ TFE-compatible (new endpoint, doesn't affect existing endpoints)
- ✅ More secure (user filtering on server)
- ✅ Production-grade architecture (single optimized endpoint)
- ✅ Scalable design (efficient database queries with joins)

## File Reference Summary

### Backend Files

- **Run Repository**: `backend/internal/repository/run.go`
- **Run Handler**: `backend/internal/api/v2/handlers/terraform/runs.go`
- **Ansible Job Model**: `backend/internal/models/ansible_job.go:95` (has `CreatedBy` field)
- **Profile Handler**: `backend/internal/api/handlers/profile.go:28-69` (returns user ID)
- **Auth Service**: `backend/internal/services/auth/service.go:55-72` (GetUserFromContext)

### Frontend Files

- **Dashboard Component**: `frontend/src/pages/Dashboard.tsx`
- **Ansible API**: `frontend/src/api/ansible.ts:626-708`
- **Client API**: `frontend/src/api/client.ts` (for profile API)
- **Auth Context**: `frontend/src/contexts/AuthContext.tsx` (session info, but not DB UUID)

## TFE Compatibility Notes

1. **New Endpoint Safety**: The dashboard stats endpoint (`GET /api/v2/dashboard/stats`) is NOT part of the Terraform Enterprise API specification, so we can implement it with any features we need without breaking TFE provider compatibility.

2. **No Changes to Existing Endpoints**: We will NOT modify any existing TFE-compatible endpoints. All existing endpoints continue to work exactly as before, maintaining full TFE provider compatibility.

3. **Response Format**: The dashboard stats endpoint uses JSON:API format for consistency with the rest of the API, but is not required to match TFE spec exactly since it's a new endpoint.

4. **User Context**: User ID is extracted from authentication context (JWT or TFE token) on the server side. This is more secure than passing user ID as a query parameter and maintains compatibility with both authentication methods.

## Implementation Notes

1. **User ID Extraction**: Backend extracts user ID from authentication context (JWT or TFE token) using `authService.GetUserFromContext()`. No need for frontend to send user ID - this is more secure and prevents user ID spoofing.

2. **Run Status Mapping**: Dashboard stats endpoint should count runs with status `'running'`, `'planning'`, or `'applying'` as active. See `frontend/src/pages/Workspaces.tsx:197-201` for reference.

3. **Ansible Job Status**: Ansible jobs use different status values (`pending`, `running`, `successful`, `failed`, `canceled`). Map `'running'` and `'pending'` as active, `'successful'` as completed.

4. **Performance**: Dashboard stats endpoint performs server-side aggregation with optimized database queries using joins and indexes. This is significantly more efficient than multiple frontend requests and scales better for enterprise use.

5. **Real-Time Updates**: Current implementation uses polling via `useActivityNotifications`. Consider WebSocket updates for real-time metrics in the future.

6. **Error Handling**: Dashboard stats endpoint should handle edge cases gracefully:
   - User with no organizations: return empty arrays, not errors
   - User with no runs/jobs: return zero counts, not errors
   - Database connection issues: return appropriate HTTP error codes
   - Invalid authentication: return 401 Unauthorized

7. **Caching Considerations**: For production use, consider adding response caching with appropriate cache invalidation strategies. Cache keys should include user ID to ensure user-specific data isolation.

## Future Enhancements

1. **WebSocket Updates**: Real-time dashboard updates without polling
2. **Customizable Dashboard**: Let users choose which metrics to display
3. **Time Range Selection**: Allow users to change "this month" to other time ranges
4. **Charts & Graphs**: Visual representation of run/job trends
5. **Quick Filters**: Filter dashboard by organization, project, or operation type
6. **Export Dashboard**: Export dashboard data as PDF or CSV
