<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Workspace Loading Performance Plan

**Issue:** [#103](https://github.com/michielvha/stackweaver/issues/103)
**Created:** 2026-02-28
**Status:** Draft

## Problem Summary

Workspace pages feel sluggish due to excessive data fetching, N+1 query patterns, large payloads being transferred unnecessarily, aggressive polling, and zero frontend caching. This plan addresses each bottleneck with specific, incremental fixes that preserve all existing functionality.

---

## Root Cause Analysis

### 1. N+1 Runs Queries on Workspace List Page (High Impact)

**File:** `frontend/src/pages/Workspaces.tsx` (lines ~169-237)

The workspace list page fetches all workspaces, then fires **one `runsApi.list()` call per workspace** to get the latest run status. With 50 workspaces, this generates 50 additional HTTP requests.

The 3-second polling interval repeats this N+1 pattern for any workspace with active runs.

### 2. `plan_output` JSONB Loaded from DB but Discarded (High Impact)

**Files:**
- `backend/internal/repository/run.go` (lines ~34-48)
- `backend/internal/models/run.go` (line ~65)

The `RunRepository.ListByWorkspace()` does `db.Find(&runs)` with no `.Omit()` or `.Select()`, which loads the full `plan_output` JSONB column from PostgreSQL for every run. This column contains the entire Terraform plan JSON (resource changes, output changes, etc.) and can be several hundred KB per run. The run list handler explicitly excludes `plan_output` from JSON:API responses, so this data is loaded from disk, deserialized into Go memory, and then thrown away.

### 3. `state_data` JSONB Returned in State Version List (High Impact)

**Files:**
- `backend/internal/repository/state_version.go` (lines ~55-67)
- `backend/internal/api/v2/handlers/terraform/state_versions.go` (line ~170)
- `backend/internal/models/state_version.go` (line ~40)

The state version list endpoint returns the full `state_data` field — this contains the **entire Terraform state JSON**, which for production infrastructure can be megabytes. This data is:
- Loaded from PostgreSQL (full table scan of JSONB column)
- Serialized to JSON in the API response
- Transferred over the network to the browser
- Parsed by the frontend

The state version list is fetched on every WorkspaceDetail mount regardless of which tab is active.

### 4. No Frontend Caching (Medium Impact)

**File:** `frontend/src/api/client.ts`

The API client is a thin `fetch` wrapper with retry logic. There is:
- No request deduplication
- No response caching
- No stale-while-revalidate pattern
- No client-side data store

Every component mount or navigation triggers full re-fetches of all data.

### 5. Aggressive Polling (Medium Impact)

**File:** `frontend/src/pages/WorkspaceDetail.tsx` (line ~584)

- WorkspaceDetail polls `runsApi.list()` every **2 seconds** unconditionally when a workspace is loaded. It only stops after discovering no active runs — but it starts polling even when there are no runs at all.
- Workspaces list page polls every **3 seconds** using the N+1 pattern described above.

### 6. Everything Fetched Upfront (Medium Impact)

**File:** `frontend/src/pages/WorkspaceDetail.tsx` (lines ~398-560)

On mount, WorkspaceDetail fires 6+ parallel API calls regardless of which tab is active:
- Workspace details (always needed)
- Runs list (needed for overview + runs tab)
- State versions (only needed for states tab)
- Variables (only needed for variables tab)
- Variable sets (only needed for variables tab)
- Platform variable keys (only needed for variables tab)
- Then N additional calls for variable set details

---

## Implementation Plan

### Phase 1: Backend — Stop Sending Large Payloads (Quick Wins)

These changes have the highest impact-to-effort ratio and don't require frontend changes.

#### 1.1 Omit `plan_output` from Run List Queries

**File:** `backend/internal/repository/run.go`

Add `.Omit("PlanOutput")` to the `ListByWorkspace` query. The plan output is already excluded from the JSON:API list response so this has zero functional impact.

```go
// Before
func (r *RunRepository) ListByWorkspace(workspaceID string) ([]models.Run, error) {
    var runs []models.Run
    result := r.db.Where("workspace_id = ?", workspaceID).
        Order("created_at DESC").
        Find(&runs)
    return runs, result.Error
}

// After
func (r *RunRepository) ListByWorkspace(workspaceID string) ([]models.Run, error) {
    var runs []models.Run
    result := r.db.Where("workspace_id = ?", workspaceID).
        Omit("PlanOutput").
        Order("created_at DESC").
        Find(&runs)
    return runs, result.Error
}
```

#### 1.2 Omit `state_data` from State Version List Responses

**File:** `backend/internal/repository/state_version.go`

Add `.Omit("StateData")` to the `ListByWorkspace` query. Create a separate `GetWithStateData` method for when full state is actually needed (e.g., the overview tab's resource list or state download).

```go
// List: exclude large state_data column
func (r *StateVersionRepository) ListByWorkspace(workspaceID string) ([]models.StateVersion, error) {
    var versions []models.StateVersion
    result := r.db.Where("workspace_id = ?", workspaceID).
        Omit("StateData").
        Order("serial DESC").
        Find(&versions)
    return versions, result.Error
}
```

The handler that returns state version details (single get) should continue to include `state_data` for backward compatibility. Only the **list** endpoint should omit it.

#### 1.3 Add Backend Endpoint for Workspace-Level Latest Run Info

Add a lightweight endpoint that returns just the latest run's status and metadata for multiple workspaces in a single request, eliminating the N+1 pattern:

```
GET /api/v2/organizations/:org/workspaces?include=latest-run
```

This follows the TFE API pattern where workspace list responses can include the latest run as a relationship. The backend should join/preload the latest run per workspace in a single query.

**Alternative:** A batch endpoint like `POST /api/v2/runs/batch-latest` accepting workspace IDs and returning a map of workspace_id → latest run summary.

### Phase 2: Frontend — Lazy Loading & Tab-Based Fetching

#### 2.1 Defer Tab-Specific Data Fetching

**File:** `frontend/src/pages/WorkspaceDetail.tsx`

Only fetch data for the active tab. On initial mount, fetch only what's needed for the overview:

| Tab | Data Required | Fetch Timing |
|-----|---------------|-------------|
| Overview | Workspace + latest run + latest state version resources | On mount |
| Runs | Runs list | When tab activated |
| States | State versions list (metadata only) | When tab activated |
| Variables | Variables + variable sets + platform keys | When tab activated |

```typescript
// On mount: only workspace + overview data
const workspaceRes = await workspacesApi.get(orgName, workspaceName);
const [runsRes] = await Promise.all([
  runsApi.list(workspaceRes.id),
]);

// On tab change:
useEffect(() => {
  if (activeTab === 'states' && stateVersions.length === 0 && !statesLoaded) {
    fetchStateVersions();
  }
  if (activeTab === 'variables' && variables.length === 0 && !variablesLoaded) {
    fetchVariables();
  }
}, [activeTab]);
```

#### 2.2 Eliminate N+1 on Workspace List Page

**File:** `frontend/src/pages/Workspaces.tsx`

Use the new backend endpoint from 1.3 to get workspace list with latest run included, instead of fetching runs per workspace.

If the backend supports `?include=latest-run`, the workspace list response will contain the latest run as an included relationship — a single HTTP request replaces N+1 requests.

#### 2.3 Smart Polling

**File:** `frontend/src/pages/WorkspaceDetail.tsx`

- Only start polling when there are active runs (status `pending`, `planning`, `applying`, `plan_queued`, `apply_queued`)
- Use exponential backoff: start at 2s, increase to 5s after 30s, 10s after 2min
- Stop polling immediately when no active runs are found
- Use `document.visibilityState` to pause polling when the tab is not visible

```typescript
useEffect(() => {
  if (!workspace || !hasActiveRuns(runs)) return;
  
  const poll = () => {
    if (document.hidden) return;
    fetchRuns();
  };
  
  const interval = setInterval(poll, getPollingInterval());
  return () => clearInterval(interval);
}, [workspace, hasActiveRuns]);
```

### Phase 3: Frontend — Client-Side Caching (Optional)

#### 3.1 Add React Query or SWR

Replace raw `fetch` calls with a data-fetching library that provides:
- **Stale-while-revalidate**: Show cached data instantly, refresh in background
- **Request deduplication**: Multiple components requesting the same data share one request
- **Cache invalidation**: Automatically refetch after mutations
- **Window focus refetching**: Refetch when user returns to the tab

Recommended: **TanStack Query (React Query)** — it integrates cleanly with the existing API client pattern.

This is a larger refactor and should be done incrementally, starting with the most-visited pages (workspace list → workspace detail).

#### 3.2 Skeleton Loading States

Replace the current full-page loading spinner with skeleton UI for each tab section. This gives perceived performance improvement even before data loads.

---

## Priority & Sequencing

| Priority | Task | Estimated Effort | Impact |
|----------|------|-----------------|--------|
| **P0** | 1.1 Omit `plan_output` from run list queries | 15 min | High — eliminates unnecessary DB I/O |
| **P0** | 1.2 Omit `state_data` from state version list | 30 min | High — removes MB-scale payloads |
| **P1** | 2.1 Tab-based lazy loading | 2-3 hours | High — eliminates 4+ unnecessary API calls |
| **P1** | 2.3 Smart polling | 1-2 hours | Medium — reduces background request volume |
| **P2** | 1.3 Backend latest-run include endpoint | 2-3 hours | High — eliminates N+1 pattern |
| **P2** | 2.2 Eliminate N+1 on workspace list | 1 hour (after 1.3) | High — depends on backend endpoint |
| **P3** | 3.1 React Query integration | 1-2 days | Medium — improves perceived speed across the app |
| **P3** | 3.2 Skeleton loading states | 1 day | Low — perceived performance only |

### Recommended Approach

Start with **Phase 1** (backend-only changes, zero risk to frontend). These can be shipped immediately and will have the most noticeable impact — especially omitting `state_data` which can reduce response sizes by orders of magnitude.

Then tackle **Phase 2** for lazy loading and smarter polling. Phase 3 is optional and can be deferred.

---

## Validation

- Compare network waterfall (browser DevTools) before/after
- Measure API response sizes for `/workspaces/:id/state-versions` and `/workspaces/:id/runs`
- Check PostgreSQL query times via `EXPLAIN ANALYZE` on run and state version list queries
- Verify no functional regressions: all tabs still load data, run polling still works, state download still works

## Notes

- All changes must maintain TFE API compatibility. The `plan_output` omission is safe because the TFE API already excludes it from run list responses. The `state_data` omission is safe because the TFE API serves state downloads via a separate signed URL mechanism.
- The backend `Omit()` calls only affect the Go struct deserialization — they don't change the JSON:API response format, just prevent loading unnecessary data from PostgreSQL.
