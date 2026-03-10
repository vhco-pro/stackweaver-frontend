<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Phase 3 Security Fixes Verification Checklist

After implementing security fixes, please verify the following functionality:

## 1. File Path Validation (G304)

### Terraform Plugin (`internal/plugins/terraform/plugin.go:568`)
- **What changed**: Added path validation before reading files
- **Verification needed**:
  - ✅ Test reading valid Terraform config files (main.tf, terraform.tf, backend.tf, providers.tf)
  - ✅ Verify that attempts to read files outside workspace directory are rejected
  - ✅ Test with relative paths (should work if within workspace)
  - ✅ Test with absolute paths (should be rejected if outside workspace)

### Registry Module Publisher (`internal/services/registry/module_publisher.go:156, 245`)
- **What changed**: Added path validation before opening tarball files
- **Verification needed**:
  - ✅ Test publishing modules with valid tarball paths
  - ✅ Verify that attempts to access files outside expected directories are rejected
  - ✅ Test module upload and download functionality still works

## 2. Archive Path Traversal Protection (G305)

### Ansible Runner (`cmd/ansible-runner/main.go:1570`)
- **What changed**: Enhanced path validation for tar extraction (already had basic check, improved it)
- **Verification needed**:
  - ✅ Test extracting valid playbook/inventory archives
  - ✅ Test with malicious archive containing `../` paths (should be rejected)
  - ✅ Test with archive containing `../../etc/passwd` style paths (should be rejected)
  - ✅ Verify extracted files are only within the target directory
  - ✅ Test normal playbook execution after extraction

### Terraform Runner (`cmd/runner/main.go:1079`)
- **What changed**: Enhanced path validation for tar.gz extraction (already had basic check, improved it)
- **Verification needed**:
  - ✅ Test extracting valid Terraform configuration archives
  - ✅ Test with malicious archive containing `../` paths (should be rejected)
  - ✅ Test with archive containing `../../etc/passwd` style paths (should be rejected)
  - ✅ Verify extracted files are only within the workspace directory
  - ✅ Test Terraform plan/apply operations after extraction

### Registry Module Publisher (`internal/services/registry/module_publisher.go:397`)
- **What changed**: Enhanced path validation for module tarball extraction
- **Verification needed**:
  - ✅ Test extracting valid module archives
  - ✅ Test with malicious archive containing `../` paths (should be rejected)
  - ✅ Test module download and extraction functionality
  - ✅ Verify extracted module files are only within the expected directory

## 3. Decompression Bomb Protection (G110)

### Ansible Runner (`cmd/ansible-runner/main.go:1593`)
- **What changed**: Added size limits to prevent decompression bombs
- **Verification needed**:
  - ✅ Test extracting normal-sized archives (should work)
  - ✅ Test extracting large but reasonable archives (should work)
  - ✅ Test with extremely large archives (should be rejected or limited)
  - ✅ Verify memory/disk usage doesn't spike unexpectedly
  - ✅ Test normal playbook execution still works

### Terraform Runner (`cmd/runner/main.go:1099`)
- **What changed**: Added size limits to prevent decompression bombs
- **Verification needed**:
  - ✅ Test extracting normal-sized Terraform config archives (should work)
  - ✅ Test extracting large but reasonable archives (should work)
  - ✅ Test with extremely large archives (should be rejected or limited)
  - ✅ Verify memory/disk usage doesn't spike unexpectedly
  - ✅ Test Terraform plan/apply operations still work

### Registry Module Publisher (`internal/services/registry/module_publisher.go:412`)
- **What changed**: Added size limits to prevent decompression bombs
- **Verification needed**:
  - ✅ Test extracting normal-sized module archives (should work)
  - ✅ Test extracting large but reasonable archives (should work)
  - ✅ Test with extremely large archives (should be rejected or limited)
  - ✅ Verify memory/disk usage doesn't spike unexpectedly
  - ✅ Test module download/extraction functionality still works

## 4. Integer Overflow Protection (G115)

### Ansible Runner (`cmd/ansible-runner/main.go:1588`)
- **What changed**: Added validation for file mode values before conversion
- **Verification needed**:
  - ✅ Test extracting archives with normal file permissions (should work)
  - ✅ Test with archives containing edge case permission values
  - ✅ Verify files are created with correct permissions
  - ✅ Test normal playbook execution still works

### Terraform Runner (`cmd/runner/main.go:1088`)
- **What changed**: Added validation for file mode values before conversion
- **Verification needed**:
  - ✅ Test extracting archives with normal file permissions (should work)
  - ✅ Test with archives containing edge case permission values
  - ✅ Verify files are created with correct permissions
  - ✅ Test Terraform plan/apply operations still work

### Registry Module Publisher (`internal/services/registry/module_publisher.go:401`)
- **What changed**: Added validation for file mode values before conversion
- **Verification needed**:
  - ✅ Test extracting archives with normal file permissions (should work)
  - ✅ Test with archives containing edge case permission values
  - ✅ Verify files are created with correct permissions
  - ✅ Test module extraction functionality still works

## 5. Slice Bounds Checking (G602)

### ID Generator (`pkg/id/generator.go:35`)
- **What changed**: Added bounds checking for slice access
- **Verification needed**:
  - ✅ Test ID generation for all types (workspace, run, state version, variable, etc.)
  - ✅ Generate many IDs and verify they're all valid
  - ✅ Verify IDs follow the expected format: `{prefix}-{16-char-random}`
  - ✅ Test that no panics occur during ID generation
  - ✅ Verify IDs are unique (no collisions in reasonable sample size)

## Testing Strategy

### 1. Normal Operation Tests
- Test all affected features with normal, valid inputs
- Verify functionality hasn't regressed
- Check that performance is acceptable

### 2. Security Tests
- Test with malicious inputs (path traversal, large archives, etc.)
- Verify security protections work correctly
- Ensure error messages are appropriate (don't leak information)

### 3. Edge Case Tests
- Test with boundary values (max sizes, edge permissions, etc.)
- Verify graceful handling of edge cases
- Check error handling and logging

### 4. Integration Tests
- Test end-to-end workflows that use these functions
- Verify no regressions in real-world scenarios
- Check that error messages are user-friendly

## Quick Test Commands

```bash
# Test ID generation
# Generate many IDs and verify format
for i in {1..1000}; do
  # Call ID generation endpoints or functions
done

# Test archive extraction
# Create test archives with various path patterns
# - Normal paths
# - Paths with ../ 
# - Very large archives
# - Archives with unusual permissions

# Test file path validation
# Try accessing files with various path patterns
# - Valid relative paths
# - Invalid paths outside workspace
# - Absolute paths
```

## Critical Areas

**Most Critical:**
1. Archive extraction path traversal (G305) - High risk if exploited
2. File path validation (G304) - High risk if exploited
3. Decompression bomb protection (G110) - Medium risk, but could cause DoS

**Important but Lower Risk:**
4. Integer overflow (G115) - Medium risk, edge case
5. Slice bounds (G602) - Medium risk, edge case

## Success Criteria

- ✅ All normal operations work as before
- ✅ Security protections prevent malicious inputs
- ✅ Error messages are clear and don't leak information
- ✅ No performance regressions
- ✅ No panics or crashes
- ✅ Logging is appropriate for security events
