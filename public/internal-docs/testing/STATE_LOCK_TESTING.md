<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# State and Lock Management Testing Guide

This document provides comprehensive testing procedures for the TFE-compliant state and lock management implementation.

## Prerequisites

1. **API Server Running**: Ensure the backend API is running and accessible
2. **Runner Service Running**: Ensure the runner service is running to process jobs
3. **Database Access**: Access to PostgreSQL database to verify lock state
4. **Authentication Token**: Valid JWT or TFE token for API requests

## Test Environment Setup

```bash
# Set environment variables
export API_BASE="http://localhost:8022/api/v2"
export AUTH_TOKEN="your-jwt-token-here"
export TEST_WORKSPACE_ID="your-workspace-uuid"
export TEST_STATE_VERSION_ID="your-state-version-uuid"
```

## Automated Tests

### Quick Test Script

Run the automated test script:

```bash
./scripts/test-state-locking.sh
```

This script tests:
- Manual workspace lock prevents state version creation
- State version outputs endpoint functionality
- Provides guides for manual verification

## Manual Testing Procedures

### Test 1: Manual Workspace Lock Prevents State Operations

**Objective**: Verify that manually locking a workspace prevents all state modification operations.

**Steps**:

1. **Lock the workspace via API**:
```bash
curl -X POST \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Testing lock"}' \
  "$API_BASE/workspaces/$TEST_WORKSPACE_ID/actions/lock"
```

Expected: `200 OK` with workspace data showing `"locked": true`

2. **Verify workspace is locked**:
```bash
curl -X GET \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  "$API_BASE/workspaces/$TEST_WORKSPACE_ID"
```

Expected: Response includes `"locked": true`, `"locked_by"`, `"locked_at"`

3. **Try to create state version (should fail)**:
```bash
curl -X POST \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "state_data": {
      "version": 4,
      "terraform_version": "1.0.0",
      "outputs": {}
    }
  }' \
  "$API_BASE/workspaces/$TEST_WORKSPACE_ID/state-versions"
```

Expected: `409 Conflict` with error message: "Workspace is locked..."

4. **Try to create a run (should fail)**:
```bash
curl -X POST \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "type": "runs",
      "attributes": {
        "is-destroy": false,
        "message": "Test run"
      },
      "relationships": {
        "workspace": {
          "data": {
            "type": "workspaces",
            "id": "'$TEST_WORKSPACE_ID'"
          }
        }
      }
    }
  }' \
  "$API_BASE/runs"
```

Expected: Run creation should be rejected (check run handler for exact behavior)

5. **Unlock the workspace**:
```bash
curl -X POST \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  "$API_BASE/workspaces/$TEST_WORKSPACE_ID/actions/unlock"
```

Expected: `200 OK` or `204 No Content`

6. **Verify state operations work again**:
```bash
# Try creating state version again - should succeed
curl -X POST \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "state_data": {
      "version": 4,
      "terraform_version": "1.0.0",
      "outputs": {}
    }
  }' \
  "$API_BASE/workspaces/$TEST_WORKSPACE_ID/state-versions"
```

Expected: `201 Created` with state version data

**Success Criteria**:
- ✅ Workspace lock prevents state version creation
- ✅ Workspace lock prevents run creation
- ✅ Unlocking allows operations to proceed

---

### Test 2: Automatic State Locking During Runs

**Objective**: Verify that runners automatically acquire and release state locks during apply/destroy operations.

**Steps**:

1. **Check initial state** (no active locks):
```sql
SELECT * FROM state_locks WHERE workspace_id = '<workspace-uuid>' AND expires_at > NOW();
```

Expected: No rows (or expired locks only)

2. **Create an apply run**:
```bash
curl -X POST \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "type": "runs",
      "attributes": {
        "is-destroy": false,
        "message": "Test apply run"
      },
      "relationships": {
        "workspace": {
          "data": {
            "type": "workspaces",
            "id": "'$TEST_WORKSPACE_ID'"
          }
        }
      }
    }
  }' \
  "$API_BASE/runs"
```

Note the `run_id` from the response.

3. **Verify state lock is acquired** (while run is executing):
```sql
SELECT * FROM state_locks 
WHERE workspace_id = '<workspace-uuid>' 
  AND expires_at > NOW()
  AND locked_by = '<run-uuid>';
```

Expected: One row with:
- `lock_id` like `run-<run-uuid>`
- `operation` = `plan-and-apply` or `destroy`
- `locked_by` = run UUID
- `expires_at` in the future

4. **Try to create state version manually (should fail)**:
```bash
curl -X POST \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "state_data": {
      "version": 4,
      "terraform_version": "1.0.0",
      "outputs": {}
    }
  }' \
  "$API_BASE/workspaces/$TEST_WORKSPACE_ID/state-versions"
```

Expected: `409 Conflict` with error: "State is locked by run..."

5. **Wait for run to complete** (check run status):
```bash
curl -X GET \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  "$API_BASE/runs/<run-id>"
```

Wait until status is `applied`, `failed`, or `canceled`.

6. **Verify lock is released**:
```sql
SELECT * FROM state_locks 
WHERE workspace_id = '<workspace-uuid>' 
  AND lock_id = 'run-<run-uuid>'
  AND expires_at > NOW();
```

Expected: No rows (lock should be deleted)

7. **Verify state operations work again**:
```bash
# Try creating state version again - should succeed
curl -X POST \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "state_data": {
      "version": 4,
      "terraform_version": "1.0.0",
      "outputs": {}
    }
  }' \
  "$API_BASE/workspaces/$TEST_WORKSPACE_ID/state-versions"
```

Expected: `201 Created`

**Success Criteria**:
- ✅ State lock acquired when apply/destroy run starts
- ✅ State lock prevents manual state version creation
- ✅ State lock released when run completes
- ✅ State operations work after lock release

---

### Test 3: Concurrent Run Prevention

**Objective**: Verify that state locks prevent concurrent apply operations on the same workspace.

**Steps**:

1. **Start first apply run**:
```bash
RUN1=$(curl -s -X POST \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "type": "runs",
      "attributes": {
        "is-destroy": false,
        "message": "First apply run"
      },
      "relationships": {
        "workspace": {
          "data": {
            "type": "workspaces",
            "id": "'$TEST_WORKSPACE_ID'"
          }
        }
      }
    }
  }' \
  "$API_BASE/runs" | jq -r '.data.id')
```

2. **Verify first run has lock**:
```sql
SELECT * FROM state_locks 
WHERE workspace_id = '<workspace-uuid>' 
  AND expires_at > NOW();
```

Expected: One lock for the first run

3. **Try to start second apply run immediately**:
```bash
RUN2=$(curl -s -X POST \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "type": "runs",
      "attributes": {
        "is-destroy": false,
        "message": "Second apply run"
      },
      "relationships": {
        "workspace": {
          "data": {
            "type": "workspaces",
            "id": "'$TEST_WORKSPACE_ID'"
          }
        }
      }
    }
  }' \
  "$API_BASE/runs" | jq -r '.data.id')
```

4. **Check second run status**:
```bash
curl -X GET \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  "$API_BASE/runs/$RUN2"
```

Expected behavior (one of):
- Run status is `failed` with error about state being locked
- Run is queued and waits for first run to complete

5. **Verify only one active lock exists**:
```sql
SELECT COUNT(*) FROM state_locks 
WHERE workspace_id = '<workspace-uuid>' 
  AND expires_at > NOW();
```

Expected: `1` (only one active lock)

6. **Wait for first run to complete**, then check second run:
```bash
# Wait for first run
while true; do
  STATUS=$(curl -s -X GET \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    "$API_BASE/runs/$RUN1" | jq -r '.data.attributes.status')
  if [[ "$STATUS" == "applied" || "$STATUS" == "failed" || "$STATUS" == "canceled" ]]; then
    break
  fi
  sleep 2
done

# Check second run
curl -X GET \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  "$API_BASE/runs/$RUN2"
```

Expected: Second run should now proceed (if it was queued) or have failed with lock error

**Success Criteria**:
- ✅ Only one apply run can hold state lock at a time
- ✅ Concurrent runs are either rejected or queued
- ✅ Second run proceeds after first completes

---

### Test 4: State Version Outputs Endpoint

**Objective**: Verify the state version outputs endpoint returns outputs in TFE-compatible format.

**Steps**:

1. **Create a state version with outputs**:
```bash
STATE_VERSION=$(curl -s -X POST \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "state_data": {
      "version": 4,
      "terraform_version": "1.0.0",
      "outputs": {
        "instance_ip": {
          "value": "192.168.1.100",
          "type": "string"
        },
        "instance_id": {
          "value": "i-1234567890abcdef0",
          "type": "string",
          "sensitive": false
        }
      }
    }
  }' \
  "$API_BASE/workspaces/$TEST_WORKSPACE_ID/state-versions" | jq -r '.data.id')
```

2. **Fetch outputs**:
```bash
curl -X GET \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  "$API_BASE/state-versions/$STATE_VERSION/outputs"
```

Expected: `200 OK` with JSON response:
```json
{
  "data": [
    {
      "id": "<state-version-id>-instance_ip",
      "type": "state-version-outputs",
      "attributes": {
        "name": "instance_ip",
        "value": "192.168.1.100",
        "type": "string"
      }
    },
    {
      "id": "<state-version-id>-instance_id",
      "type": "state-version-outputs",
      "attributes": {
        "name": "instance_id",
        "value": "i-1234567890abcdef0",
        "type": "string",
        "sensitive": false
      }
    }
  ]
}
```

3. **Test with state version without outputs**:
```bash
# Create state version without outputs
STATE_VERSION_NO_OUTPUTS=$(curl -s -X POST \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "state_data": {
      "version": 4,
      "terraform_version": "1.0.0"
    }
  }' \
  "$API_BASE/workspaces/$TEST_WORKSPACE_ID/state-versions" | jq -r '.data.id')

# Fetch outputs
curl -X GET \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  "$API_BASE/state-versions/$STATE_VERSION_NO_OUTPUTS/outputs"
```

Expected: `200 OK` with empty array:
```json
{
  "data": []
}
```

4. **Test with invalid state version ID**:
```bash
curl -X GET \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  "$API_BASE/state-versions/00000000-0000-0000-0000-000000000000/outputs"
```

Expected: `404 Not Found`

**Success Criteria**:
- ✅ Outputs endpoint returns correct format
- ✅ Handles state versions with outputs
- ✅ Handles state versions without outputs
- ✅ Returns 404 for invalid state version IDs

---

### Test 5: Lock Expiration

**Objective**: Verify that expired locks don't block operations and cleanup works.

**Steps**:

1. **Manually create an expired lock** (via database):
```sql
INSERT INTO state_locks (id, workspace_id, lock_id, operation, locked_by, expires_at, created_at)
VALUES (
  gen_random_uuid(),
  '<workspace-uuid>',
  'test-expired-lock',
  'apply',
  '<some-run-uuid>',
  NOW() - INTERVAL '1 hour',  -- Expired 1 hour ago
  NOW() - INTERVAL '2 hours'
);
```

2. **Verify lock is expired**:
```sql
SELECT * FROM state_locks 
WHERE workspace_id = '<workspace-uuid>' 
  AND lock_id = 'test-expired-lock';
```

Check `expires_at < NOW()` - should be true

3. **Try to create state version** (should succeed despite expired lock):
```bash
curl -X POST \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "state_data": {
      "version": 4,
      "terraform_version": "1.0.0",
      "outputs": {}
    }
  }' \
  "$API_BASE/workspaces/$TEST_WORKSPACE_ID/state-versions"
```

Expected: `201 Created` (expired lock should not block)

4. **Run cleanup** (if cleanup job exists):
```sql
-- Cleanup expired locks
DELETE FROM state_locks WHERE expires_at < NOW();
```

Or call cleanup method if exposed via API.

5. **Verify expired lock is removed**:
```sql
SELECT * FROM state_locks 
WHERE workspace_id = '<workspace-uuid>' 
  AND lock_id = 'test-expired-lock';
```

Expected: No rows

**Success Criteria**:
- ✅ Expired locks don't block state operations
- ✅ Cleanup removes expired locks
- ✅ Lock expiration check works correctly

---

## Database Verification Queries

### Check Active Locks
```sql
SELECT 
  sl.id,
  sl.workspace_id,
  sl.lock_id,
  sl.operation,
  sl.locked_by,
  sl.expires_at,
  sl.created_at,
  w.name as workspace_name
FROM state_locks sl
JOIN workspaces w ON w.id = sl.workspace_id
WHERE sl.expires_at > NOW()
ORDER BY sl.created_at DESC;
```

### Check Workspace Lock Status
```sql
SELECT 
  id,
  name,
  locked,
  locked_by,
  locked_at,
  locked_reason
FROM workspaces
WHERE id = '<workspace-uuid>';
```

### Check State Versions
```sql
SELECT 
  id,
  workspace_id,
  version,
  run_id,
  created_at
FROM state_versions
WHERE workspace_id = '<workspace-uuid>'
ORDER BY version DESC
LIMIT 10;
```

---

## Troubleshooting

### Lock Not Released After Run Completes

**Symptoms**: State lock remains after run completes successfully.

**Check**:
1. Verify run status is terminal (`applied`, `failed`, `canceled`)
2. Check runner logs for lock release errors
3. Manually verify lock exists in database

**Fix**: Lock should be released via defer in runner. Check for errors in runner logs.

### State Version Creation Fails with Lock Error

**Symptoms**: `409 Conflict` when creating state version even though no run is active.

**Check**:
1. Query database for active locks on workspace
2. Check if locks are expired but not cleaned up
3. Verify workspace is not manually locked

**Fix**: Run cleanup job or manually delete expired locks.

### Runner Fails to Acquire Lock

**Symptoms**: Run fails immediately with "failed to acquire state lock" error.

**Check**:
1. Verify workspace is not manually locked
2. Check for existing active locks on workspace
3. Verify lock TTL is reasonable (not too short)

**Fix**: Unlock workspace or wait for existing lock to expire/release.

---

## Success Checklist

After running all tests, verify:

- [ ] Manual workspace lock prevents state version creation
- [ ] Manual workspace lock prevents run creation
- [ ] State lock acquired when apply/destroy run starts
- [ ] State lock prevents manual state version creation during run
- [ ] State lock released when run completes
- [ ] Only one active state lock per workspace at a time
- [ ] Concurrent runs are handled correctly
- [ ] State version outputs endpoint works
- [ ] Expired locks don't block operations
- [ ] Lock cleanup works correctly

---

## Notes

- **Plan-only runs** do NOT acquire state locks (they don't modify state)
- **Apply and destroy runs** DO acquire state locks
- **Manual workspace locks** take precedence over all operations
- **Lock TTL** is based on workspace `run_timeout` setting (default: 2 hours)


