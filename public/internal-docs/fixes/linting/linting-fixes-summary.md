<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Linting Fixes Summary

This document categorizes all linting issues found and tracks their resolution status.

## Issue Categories

### ✅ Safe to Fix (No Testing Required)

#### 1. errchkjson (3 issues)
- **Location**: `backend/internal/services/ansible/inventory_source.go`
- **Issue**: Error return value of `json.Marshal` not checked
- **Risk**: Low - Just need to check error returns
- **Files**: Lines 307, 421, 491
- **Status**: ✅ Fixed

#### 2. unconvert (3 issues)
- **Location**: `backend/internal/api/v2/handlers/terraform/runs.go`
- **Issue**: Unnecessary type conversions
- **Risk**: None - Just removing redundant conversions
- **Files**: Lines 677, 714, 721
- **Status**: ✅ Fixed

#### 3. File Permissions - G301/G306 (6 issues)
- **Locations**: 
  - `backend/cmd/ansible-runner/main.go` (2x G301, 1x G306)
  - `backend/cmd/runner/main.go` (1x G306)
  - `backend/internal/api/v2/handlers/registry_modules_test.go` (1x G306)
  - `backend/internal/services/registry/module_publisher.go` (1x G301)
- **Issue**: File/directory permissions too permissive
- **Risk**: Low - Making permissions more restrictive is safer
- **Action**: Change `0o755` → `0o750` for dirs, `0o644` → `0o600` for files
- **Status**: ✅ Fixed

### ⚠️ Needs Review (Likely Safe, But Verify Logic)

#### 4. exhaustive switches (17 issues)
- **Issue**: Missing cases in switch statements
- **Risk**: Medium - Need to ensure missing cases are handled correctly
- **Action**: Add missing cases or default cases where appropriate

**Breakdown:**
- `models.RunStatus` switches (8 issues):
  - `cmd/orchestrator/status_check.go:98` - Missing: Applying, Applied, Running, Completed
  - `cmd/runner/main.go:601` - Missing: Planned, Applied, Failed, Cancelled, Running, Completed
  - `cmd/runner/main.go:1034` - Missing: Pending, Planning, Applying, Running
  - `internal/api/v2/handlers/terraform/runs.go:893` - Missing: Pending, Planning, Planned, Applying, Applied
  - `internal/api/v2/handlers/terraform/runs.go:1106` - Missing: Pending, Planning, Planned, Running, Completed
  - `internal/api/v2/handlers/terraform/runs.go:1352` - Missing: Pending, Failed, Cancelled, Running, Completed

- `models.RunOperation` switches (3 issues):
  - `cmd/runner/main.go:741` - Missing: Destroy
  - `cmd/runner/main.go:789` - Missing: Destroy
  - `internal/api/v2/handlers/terraform/runs.go:2811` - Missing: Destroy

- `models.VCSProvider` (1 issue):
  - `cmd/ansible-runner/main.go:703` - Missing: Bitbucket

- `models.CredentialType` (1 issue):
  - `cmd/ansible-runner/main.go:920` - Missing: SCM

- `models.AnsibleJobType` (1 issue):
  - `cmd/ansible-runner/main.go:1026` - Missing: Run

- `models.InventorySourceType` (3 issues):
  - `internal/services/ansible/inventory_source.go:272` - Missing: Custom
  - `internal/services/ansible/inventory_source.go:288` - Missing: Custom
  - `internal/services/ansible/inventory_source.go:695` - Missing: Custom

- `rbac.Permission` (2 issues):
  - `internal/services/rbac/service.go:774` - Missing many permissions (likely needs default case)
  - `internal/services/rbac/service.go:814` - Missing many permissions (likely needs default case)

- **Status**: ✅ Fixed - See `docs/phase2-verification-checklist.md` for manual verification steps

### 🔒 Security Issues (Needs Testing)

#### 5. gosec Security Warnings (24 issues)

**G304 - Potential file inclusion via variable (3 issues):**
- `backend/internal/plugins/terraform/plugin.go:568`
- `backend/internal/services/registry/module_publisher.go:156`
- `backend/internal/services/registry/module_publisher.go:245`
- **Risk**: High - Path traversal if not validated
- **Action**: Validate file paths before opening
- **Status**: ✅ Fixed - See `docs/phase3-verification-checklist.md` for manual verification steps
- **Testing Required**: ✅ Yes - Verify file access restrictions work

**G305 - File traversal when extracting archive (4 issues):**
- `backend/cmd/ansible-runner/main.go:1570`
- `backend/cmd/runner/main.go:1079`
- `backend/internal/services/registry/module_publisher.go:397`
- **Risk**: High - Zip/tar path traversal vulnerability
- **Action**: Validate and sanitize archive entry paths
- **Status**: ✅ Fixed - See `docs/phase3-verification-checklist.md` for manual verification steps
- **Testing Required**: ✅ Yes - Test with malicious archives

**G110 - Potential DoS via decompression bomb (3 issues):**
- `backend/cmd/ansible-runner/main.go:1593`
- `backend/cmd/runner/main.go:1099`
- `backend/internal/services/registry/module_publisher.go:412`
- **Risk**: Medium - Resource exhaustion
- **Action**: Add size limits to decompression
- **Status**: ✅ Fixed - See `docs/phase3-verification-checklist.md` for manual verification steps
- **Testing Required**: ✅ Yes - Test with large archives

**G115 - Integer overflow conversion (3 issues):**
- `backend/cmd/ansible-runner/main.go:1588`
- `backend/cmd/runner/main.go:1088`
- `backend/internal/services/registry/module_publisher.go:401`
- **Risk**: Medium - Potential overflow
- **Action**: Validate file mode values
- **Status**: ✅ Fixed - See `docs/phase3-verification-checklist.md` for manual verification steps
- **Testing Required**: ✅ Yes - Test with edge cases

**G602 - Slice index out of range (1 issue):**
- `backend/pkg/id/generator.go:35`
- **Risk**: Medium - Potential panic
- **Action**: Add bounds checking
- **Status**: ✅ Fixed - See `docs/phase3-verification-checklist.md` for manual verification steps
- **Testing Required**: ✅ Yes - Test ID generation

### 📝 False Positives (Add nolint comments)

#### 6. gosec False Positives (10 issues)

**G101 - Potential hardcoded credentials (3 issues):**
- `backend/internal/services/rbac/service.go:41, 69, 95`
- **Issue**: String constants with "credential" in name
- **Action**: Add `//nolint:gosec // false positive: string constant, not actual credential`
- **Status**: ✅ Fixed

**G204 - Subprocess launched with variable (7 issues):**
- `backend/internal/plugins/terraform/plugin.go:92, 141, 275` - Terraform commands (intentional)
- `backend/internal/services/registry/gpg.go:56, 147, 211` - GPG commands (intentional)
- **Action**: Add `//nolint:gosec // intentional: executing terraform/gpg commands`
- **Status**: ✅ Fixed

## Summary

- **Total Issues**: 51
- **Safe to Fix**: 10 (errchkjson: 3, unconvert: 3, permissions: 4)
- **Needs Review**: 17 (exhaustive switches)
- **Security (Needs Testing)**: 14 (G304: 3, G305: 4, G110: 3, G115: 3, G602: 1)
- **False Positives**: 10 (G101: 3, G204: 7)

## Fix Order

1. ✅ **Phase 1**: Safe fixes (errchkjson, unconvert, permissions) - No testing needed
2. ⚠️ **Phase 2**: Exhaustive switches - Review logic, add cases/defaults
3. 🔒 **Phase 3**: Security fixes - Implement fixes, then test thoroughly
4. 📝 **Phase 4**: False positives - Add nolint comments

## Testing Checklist

After Phase 3 (Security fixes), test:
- [ ] File path validation prevents directory traversal
- [ ] Archive extraction handles malicious paths correctly
- [ ] Decompression has size limits and doesn't exhaust resources
- [ ] File mode conversions handle edge cases
- [ ] ID generation doesn't panic on edge cases
- [ ] All affected features still work correctly
