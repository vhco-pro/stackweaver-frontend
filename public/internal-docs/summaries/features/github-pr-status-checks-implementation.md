<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# GitHub Pull Request Status Checks Implementation Plan

## Executive Summary

This document outlines the implementation plan for adding GitHub pull request status checks that display speculative plan results. When a pull request is created or updated targeting the main branch, StackWeaver will automatically trigger speculative plan-only runs and update GitHub status checks with the results.

## Design Goals

1. **TFE-Compatible Behavior**: Follow Terraform Enterprise patterns for PR status checks
2. **Automatic Triggering**: Speculative plans should trigger automatically on PR creation/update
3. **Status Check Integration**: Use GitHub Status Checks API to report plan status
4. **Workspace Filtering**: Only trigger for workspaces connected to the repository and affected by changes
5. **Speculative Plans Only**: PR-triggered runs should be plan-only (speculative), never apply
6. **Status Updates**: Status checks should update as plans progress through their lifecycle

---

## Current State

TODO: Should we not allow checking for which path triggered the run ? this way we can prevent running the workspaces when not needed.

### What Exists

✅ **Pull Request Webhook Events**
- Webhooks are configured to receive `pull_request` events (see `backend/internal/services/vcs/github_app.go:274`)
- Webhook handler receives all event types but only processes `push` events

✅ **Speculative Plan Support**
- `ConfigurationVersion` model has `Speculative` field (see `backend/internal/models/configuration_version.go:28`)
- `Workspace` model has `SpeculativeEnabled` field (see `backend/internal/models/workspace.go:43`)
- API supports creating speculative configuration versions

✅ **GitHub App Integration**
- GitHub App service exists (`backend/internal/services/vcs/github_app.go`)
- Installation token generation works
- GitHub client (`github.com/google/go-github/v73/github`) is available

✅ **Webhook Handler**
- `VCSAppInstallationHandlerV2.HandleInstallationWebhook` processes webhooks (see `backend/internal/api/v2/handlers/vcs_app_installation.go:138`)
- `handleBranchPushEvent` shows the pattern for processing VCS events

❌ **Missing**
- Pull request event handling in webhook handler
- GitHub Status Checks API integration
- Speculative plan triggering from PR events
- Status check updates during run lifecycle

---

## TFE-Compatible Requirements

### GitHub Status Checks

Terraform Enterprise uses GitHub status checks (via the Commit Statuses API) to report plan status. Each workspace gets its own status check with the format:
- **Context**: `terraform-plan/<workspace-name>`
- **States**: `pending`, `success`, `failure`, `error`
- **Description**: Brief status message
- **Target URL**: Link to the run in StackWeaver UI

**Required GitHub App Permission**: The app needs **"Commit statuses: Read and write"** permission under Repository permissions to create and update status checks.

### Speculative Plans

Speculative plans are plan-only runs that:
- Are marked with `Speculative: true` on the configuration version
- Never apply changes
- Use the PR branch's code merged with the target branch
- Are triggered automatically on PR events

---

## Database Schema

### No Schema Changes Required

The existing schema supports this feature:
- `ConfigurationVersion.Speculative` - Marks speculative plans
- `ConfigurationVersion.CommitHash` - Stores commit SHA for status checks
- `Run.Status` - Tracks plan status for status check updates

### Optional: Store PR Information (Future Enhancement)

For future enhancements (e.g., PR comments with plan summaries), consider adding:
- `ConfigurationVersion.PullRequestNumber` (int, nullable)
- `ConfigurationVersion.PullRequestHeadSHA` (string, nullable)

**Decision**: Not required for initial implementation. We can use `CommitHash` to link status checks.

---

## Implementation Phases

### Phase 1: Pull Request Webhook Handler (Foundation)

**Goal**: Handle pull request events and trigger speculative plans

#### 1.1 Add Pull Request Event Handler

**File**: `backend/internal/api/v2/handlers/vcs_app_installation.go`

**Changes**:
1. Add `handlePullRequestEvent` method (similar to `handleBranchPushEvent`)
2. Update `HandleInstallationWebhook` to route `pull_request` events
3. Extract PR information:
   - PR number
   - Base branch (target branch, typically `main`)
   - Head branch (source branch)
   - Head SHA (commit to create status check on)
   - Repository full name
4. Filter workspaces by repository and base branch
5. Create speculative configuration versions with `Speculative: true`
6. Trigger plan-only runs

**Key Differences from Push Handler**:
- Use PR head SHA (not base SHA)
- Use PR head branch code directly (no merge needed for speculative plans)
- Mark configuration version as speculative
- Only create plan-only runs (never apply)
- **Path-Based Filtering**: Filter workspaces based on changed files in PR (using `git diff`)

**Reference**: See `handleBranchPushEvent` in `backend/internal/api/v2/handlers/vcs_app_installation.go:538-841`

#### 1.2 GitHub Status Check Service

**New File**: `backend/internal/services/vcs/github_status.go`

**Purpose**: Encapsulate GitHub Status Checks API interactions

**Methods**:
- `CreateStatusCheck(ctx, installationID, owner, repo, sha, context, state, description, targetURL)`
- `UpdateStatusCheck(ctx, installationID, owner, repo, sha, context, state, description, targetURL)`

**Implementation**:
- Use GitHub App installation token for authentication
- Call GitHub Status Checks API: `POST /repos/:owner/:repo/statuses/:sha`
- Status states: `pending`, `success`, `failure`, `error`
- Include target URL pointing to run in StackWeaver UI

**Reference**: [GitHub Status Checks API](https://docs.github.com/en/rest/commits/statuses)

#### 1.3 Integrate Status Checks with Run Lifecycle

**File**: `backend/cmd/orchestrator/main.go`

**Changes**:
1. Added polling service to check for PR runs that need status check updates
2. Polls every 10 seconds for runs with speculative configuration versions
3. Updates status checks via GitHub Status Checks API
4. Maps run status to GitHub status check state:
   - `pending`/`planning` → `pending`
   - `planned` → `success` (with plan impact: `planned: +1/~0/-1`)
   - `failed` → `failure`
   - `cancelled` → `error`
5. **Path-Based Filtering**: Only triggers plans for workspaces whose `WorkingDirectory` path contains changed files
   - Uses `git diff` to determine files changed between PR base and head branches
   - Filters workspaces using `isWorkspaceAffectedByFiles()` helper
   - If path filtering fails (e.g., repo access issues), falls back to triggering all workspaces (safe default)

**Architecture Decision**: **Option A: Event-Driven (Orchestrator Polling)** ✅ **IMPLEMENTED**
- Status check updates are handled by the orchestrator service (not the runner)
- Runner remains VCS-agnostic and focused on Terraform execution
- Orchestrator polls for PR runs and updates status checks accordingly
- Maintains proper separation of concerns:
  - Runner: Executes Terraform, updates run status in DB (VCS-agnostic)
  - Orchestrator: Monitors runs and handles VCS integrations (status checks)
  - API: Handles webhooks and creates runs

**Implementation Details**:
- Repository method `ListPRRunsForStatusChecks()` finds speculative runs needing updates
- Helper function `updatePRStatusCheck()` in orchestrator handles status check updates
- Retrieves workspace, configuration version, and VCS connection
- Uses GitHub App installation token for authentication

**File**: `backend/internal/api/v2/handlers/vcs_app_installation.go`

Creates initial status check when PR webhook is received and run is created.

---

### Phase 2: Status Check Updates (Integration)

**Goal**: Update GitHub status checks as runs progress

#### 2.1 Run Status Update Hook

**File**: `backend/cmd/orchestrator/main.go`

**Purpose**: Poll for PR runs and update their GitHub status checks

**Implementation**: **Option A: Event-Driven (Orchestrator Polling)** ✅ **IMPLEMENTED**
- Orchestrator polls for PR runs every 10 seconds
- Uses repository method `ListPRRunsForStatusChecks()` to find runs needing updates
- Updates status checks via `updatePRStatusCheck()` helper function
- Status checks are updated based on current run status:
  - `pending`/`planning` → `pending`
  - `planned` → `success`
  - `failed` → `failure`
  - `cancelled` → `error`

**Why Option A was chosen**:
- Maintains proper separation of concerns (runner is VCS-agnostic)
- Follows event-driven architecture pattern used elsewhere in the system
- Orchestrator is the appropriate place for cross-cutting concerns like VCS integrations
- Runner remains plug-and-play without VCS dependencies

**Implementation Details**:
- Polling interval: 10 seconds (configurable)
- Queries for runs with speculative configuration versions and active statuses
- Helper function `updatePRStatusCheck()` checks if run is from PR (speculative with commit hash)
- Retrieves workspace, configuration version, and VCS connection
- Maps run status to GitHub status check state
- **Plan Impact Display**: When plan completes successfully, status check description includes plan impact in OTF-style format: `planned: +1/~0/-1` (add/change/destroy counts)
  - Extracts `AddCount`, `ChangeCount`, `DestroyCount` from `run.PlanOutput`
  - Example descriptions:
    - `planned: +2/~1/-0` (2 to add, 1 to change, 0 to destroy)
    - `planned: no changes` (if all counts are 0)
- Status check failures are logged but don't affect run execution

#### 2.2 Status Check Context Naming

**Format**: `terraform-plan/<workspace-name>`

**Example**: `terraform-plan/production-web`

**Rationale**: Matches TFE pattern, allows multiple workspaces per repository

#### 2.3 Target URL Generation

**Format**: `https://<stackweaver-url>/workspaces/<workspace-id>/runs/<run-id>`

**Implementation**: 
- Use base URL from configuration
- Generate link when creating/updating status check

---

### Phase 3: Edge Cases and Polish

**Goal**: Handle edge cases and improve robustness

#### 3.1 Error Handling

- **Webhook signature verification**: Verify GitHub webhook signatures (TODO already exists in handler)
- **Status check failures**: Log errors but don't fail run creation
- **Missing workspace VCS info**: Skip status checks if workspace not connected to VCS
- **Invalid PR data**: Validate PR payload before processing

#### 3.2 Status Check States

- **pending**: Run is queued, planning, or in progress
- **success**: Plan completed successfully (even if changes detected)
- **failure**: Plan failed (errors, validation failures)
- **error**: Run was cancelled or encountered unexpected error

#### 3.3 Multiple Workspaces per Repository

- Create one status check per workspace
- Filter workspaces by repository and base branch
- Each status check is independent

#### 3.4 PR Updates

- Handle PR update events (new commits pushed to PR branch)
- Update status checks for new commit SHA
- Cancel or mark old runs as superseded (optional enhancement)

#### 3.5 Path-Based Workspace Filtering

**Behavior**: Only trigger speculative plans for workspaces whose `WorkingDirectory` contains files changed in the PR.

**Implementation Differences**:

**Push Events** (Highly Reliable):
- Changed files are extracted directly from the webhook payload (`pushEvent.Commits`)
- Each commit in the payload includes `added`, `modified`, and `removed` file arrays
- Path filtering works reliably because no external operations are needed
- See `handleBranchPushEvent` in `backend/internal/api/v2/handlers/vcs_app_installation.go:555-912`

**PR Events** (Fixed - Now Reliable):
- GitHub PR webhook payloads do **not** include changed files
- Changed files are determined using `git diff --name-only origin/baseBranch...origin/headBranch`
- Process:
  1. Clones repository with `--depth 50` for faster cloning
  2. Attempts to unshallow repository (`git fetch --unshallow`)
  3. Fetches both base and head branches using refspec format (`git fetch origin refs/heads/baseBranch:refs/remotes/origin/baseBranch refs/heads/headBranch:refs/remotes/origin/headBranch`)
     - **Root Cause Fix**: Using refspec format ensures remote tracking refs are properly set up after shallow clone, allowing `git diff` to work correctly
  4. Runs `git diff --name-only origin/baseBranch origin/headBranch`
- **Fallback Behavior**: If git diff fails (e.g., branches don't exist, network issues, permission problems), the system falls back to triggering **all workspaces** (safe default to ensure plans still run)
- See `getPRChangedFiles` in `backend/internal/api/v2/handlers/vcs_app_installation.go:1495-1554`

**Path Matching Logic**:
- For each workspace, checks if any changed file is within the workspace's `WorkingDirectory` path using `isWorkspaceAffectedByFiles()`
- **Empty `WorkingDirectory`**: Only matches files at repository root (no directory separator). Does NOT match files in subdirectories.
- **Set `WorkingDirectory`**: Only matches files within that directory path (e.g., `WorkingDirectory="tfe-tests"` matches `tfe-tests/main.tf` but not `proxmox/api/main.tf`)
- See `isWorkspaceAffectedByFiles` in `backend/internal/api/v2/handlers/vcs_app_installation.go:1464-1500`

**Example**:
- Repository structure: `proxmox/`, `api/`, `tests/`
- PR changes only files in `proxmox/`
- Only workspaces with `WorkingDirectory="proxmox"` or `WorkingDirectory="proxmox/..."` are triggered
- Workspaces with `WorkingDirectory="api"` are skipped (no changes in their path)

**Configuration**: Path filtering is enabled by default. Workspaces with empty `WorkingDirectory` only match root-level files (files with no directory separator), not files in subdirectories.

**Current Status**:
- ✅ **Push Events**: Path filtering works reliably (uses webhook payload)
- ✅ **PR Events**: Path filtering now works reliably
  - Fixed git fetch refspec format to properly set up remote tracking refs
  - Fixed empty `WorkingDirectory` logic to only match root-level files (not subdirectories)

---

## API Changes

### No New Public API Endpoints Required

All functionality is internal (webhook handler, status check service).

---

## File Structure

### New Files

```
backend/internal/services/vcs/github_status.go  # Status check service
```

### Modified Files

```
backend/internal/api/v2/handlers/vcs_app_installation.go  # Add PR handler
backend/cmd/orchestrator/main.go                          # Status check integration (or new service)
backend/internal/models/run.go                            # Optional: Add PR tracking fields (future)
backend/internal/models/configuration_version.go          # Optional: Add PR fields (future)
```

---

## Testing Strategy

### Unit Tests

1. **Pull Request Handler**
   - Parse PR event payload correctly
   - Filter workspaces correctly
   - Create speculative configuration versions
   - Trigger plan-only runs

2. **Status Check Service**
   - Create status checks with correct parameters
   - Update status checks correctly
   - Handle API errors gracefully

### Integration Tests

1. **End-to-End PR Flow**
   - Simulate PR webhook event
   - Verify speculative run is created
   - Verify status check is created
   - Verify status check updates as run progresses

2. **GitHub API Integration**
   - Test with real GitHub App (test installation)
   - Verify status checks appear on test PR
   - Verify status check states are correct

### Manual Testing

1. Create test repository with workspace
2. Create PR targeting main branch
3. Verify status check appears
4. Verify status check updates correctly
5. Verify clicking status check links to run

---

## Reference Implementation

The open-source project [OTF (Open Terraform Enterprise)](https://github.com/leg100/otf) has implemented this feature. Key files to reference:

- Pull request webhook handling
- GitHub status check creation/updates
- Speculative plan triggering

**Note**: Review OTF's implementation for patterns and edge cases, but adapt to StackWeaver's architecture and code style.

---

## Migration Notes

### No Migration Required

This is a new feature with no database changes. Existing functionality is unaffected.

---

## Future Enhancements

1. **PR Comments**: Post plan summaries as PR comments
2. **Multi-Workspace Status**: Combined status check for all workspaces
3. **Plan Output in PR**: Include plan output directly in status check details
4. **Branch Protection Integration**: Use status checks for branch protection rules
5. **Pull Request Metadata**: Store PR number and head SHA in database for better tracking

---

## Implementation Checklist

### Phase 1: Foundation
- [ ] Add `handlePullRequestEvent` method to webhook handler
- [ ] Route `pull_request` events to PR handler
- [ ] Create GitHub status check service
- [ ] Create status check when PR speculative run is created
- [ ] Test PR event handling with test repository

### Phase 2: Integration
- [ ] Integrate status check updates with run status changes
- [ ] Update status check when run status changes
- [ ] Test status check updates through run lifecycle
- [ ] Test with multiple workspaces

### Phase 3: Polish
- [ ] Add error handling and logging
- [ ] Handle edge cases (invalid PRs, missing data)
- [ ] Test PR updates (new commits)
- [ ] Documentation updates
- [ ] Manual testing with real GitHub repository

---

## Success Criteria

1. ✅ Pull requests automatically trigger speculative plans
2. ✅ Status checks appear on PR commits
3. ✅ Status checks update correctly as plans progress
4. ✅ Status checks link to runs in StackWeaver UI
5. ✅ Multiple workspaces per repository work correctly
6. ✅ Error handling is robust (status check failures don't break runs)