<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# TFE-Compliant State and Lock Management

**Status**: ✅ **FULLY IMPLEMENTED**  
**TFE Compatibility**: **COMPLETE**

## Overview

This document describes the fully implemented Terraform Enterprise (TFE)-compliant state and lock management system. The implementation provides unified locking that prevents state corruption and ensures full compatibility with Terraform Enterprise behavior.

## Architecture

### Lock Types

1. **Workspace-Level Locking (Manual)**
   - Users can manually lock/unlock workspaces via UI or API
   - When locked, prevents all run creation and state modifications
   - Persists until manually unlocked

2. **State-Level Locking (Automatic)**
   - Automatically acquired when apply/destroy runs start
   - Prevents concurrent state modifications during runs
   - Automatically released when runs complete (success, failure, or cancellation)
   - Uses TTL-based expiration for safety

### Integration

- Manual workspace locks prevent all state operations (API and runner)
- Automatic state locks prevent concurrent operations during runs
- Both lock types are checked before any state modification
- Lock enforcement is consistent across all entry points

## Implementation

### State Management

**State Storage:**
- State files stored in MinIO at `workspaces/{workspace_id}/state/{version}.json` (TFE-compatible path)
- State metadata stored in PostgreSQL (`state_versions` table)
- Automatic state versioning with sequential version numbers
- State automatically saved after successful apply runs

**Implementation Files:**
- State Service: `backend/internal/services/state/service.go`
- State Version Handler: `backend/internal/api/v2/handlers/terraform/state_versions.go`
- State Version Model: `backend/internal/models/state_version.go`
- Runner State Saving: `backend/cmd/runner/main.go`

### Lock Management

**Workspace Locking:**
- Workspace model includes `Locked`, `LockedBy`, `LockedAt`, `LockedReason` fields
- API endpoints: `POST /api/v2/workspaces/:id/actions/lock` and `unlock`
- Prevents new run creation when workspace is locked
- Checked in run creation handler and state save operations

**State Locking:**
- StateLock model with expiration support
- Automatic lock acquisition at run start (apply/destroy operations)
- Automatic lock release at run completion (all exit paths)
- Lock validation before state save operations
- TTL-based expiration with cleanup support

**Implementation Files:**
- State Lock Service: `backend/internal/services/state/service.go`
- State Lock Model: `backend/internal/models/state_lock.go`
- State Lock Repository: `backend/internal/repository/state_lock.go`
- Workspace Lock Handler: `backend/internal/api/v2/handlers/terraform/workspaces.go`
- Workspace Model: `backend/internal/models/workspace.go`

### Runner Integration

**Lock Lifecycle:**
- Runner checks workspace lock before starting run execution
- Runner acquires state lock when apply/destroy operations start
- Lock ID generated from run ID: `run-{run_id}`
- TTL set based on workspace `RunTimeout` or default 2 hours
- Lock released via defer on all completion paths (success, failure, cancellation)

**State Save Protection:**
- `SaveState()` checks both workspace and state locks before creating state versions
- Validates lock belongs to current run (if runID provided)
- Rejects state save if workspace is manually locked
- Rejects state save if state is locked by different run

**Implementation Files:**
- Runner Lock Acquisition/Release: `backend/cmd/runner/main.go`
- State Service Lock Checking: `backend/internal/services/state/service.go`

### API Endpoints

**State Version Endpoints:**
- `GET /api/v2/workspaces/:id/state-versions` - List state versions
- `GET /api/v2/state-versions/:id` - Get state version by ID
- `POST /api/v2/workspaces/:id/state-versions` - Create state version (manual)
- `GET /api/v2/state-versions/:id/outputs` - Get state version outputs (TFE-compatible)

**Lock Enforcement:**
- State version creation endpoint checks workspace and state locks
- Returns 409 Conflict if workspace is locked
- Returns 409 Conflict if state is locked by another operation
- Manual state saves blocked when workspace or state is locked

**Implementation Files:**
- State Version Handler: `backend/internal/api/v2/handlers/terraform/state_versions.go`
- Route Registration: `backend/internal/api/v2/routes/routes.go`
- Run Handler (workspace lock check): `backend/internal/api/v2/handlers/terraform/runs.go`

## TFE Compatibility

### ✅ Fully Compatible

- State storage path matches TFE format
- All state version API endpoints implemented
- JSON:API response format
- State metadata (version, serial, lineage)
- State version outputs endpoint
- Automatic state locking during runs
- Manual workspace locking
- Lock enforcement in all state operations

### Behavior Alignment

The implementation matches Terraform Enterprise behavior:
- Manual workspace locks prevent all state operations
- Automatic state locks prevent concurrent modifications
- Lock validation occurs at all entry points
- Lock lifecycle properly managed (acquisition, validation, release)
- TTL-based expiration prevents deadlocks

## Testing

Comprehensive testing procedures are documented in:
- `docs/testing/STATE_LOCK_TESTING.md`

Test coverage includes:
- Manual workspace lock enforcement
- Automatic state locking during runs
- Concurrent run prevention
- Lock expiration handling
- State version outputs endpoint
- Lock release on run completion/cancellation

## Risk Mitigation

**State Corruption Prevention:**
- ✅ Lock enforcement prevents concurrent state modifications
- ✅ Workspace locks prevent all state operations
- ✅ State locks prevent concurrent applies
- ✅ Lock validation at all entry points

**Lock Management:**
- ✅ TTL-based expiration prevents deadlocks
- ✅ Automatic cleanup of expired locks
- ✅ Defer-based lock release ensures cleanup
- ✅ Lock acquisition failures handled gracefully

## Related Documentation

- **Architecture**: `docs/architecture/TFE_WORKSPACE_DESIGN.md`
- **API Reference**: `docs/api-reference/backend-api-reference.md`
- **Testing Guide**: `docs/testing/STATE_LOCK_TESTING.md`

## Summary

**Status**: ✅ **FULLY IMPLEMENTED**

All critical components are complete:
- ✅ State storage and versioning
- ✅ Manual workspace locking
- ✅ Automatic state locking
- ✅ Lock enforcement in all operations
- ✅ State version outputs endpoint
- ✅ Runner lock integration
- ✅ TFE-compatible behavior

**Risk Level**: **LOW** - State corruption prevented by comprehensive locking  
**TFE Compatibility**: **FULL** - All endpoints and lock behavior match Terraform Enterprise

