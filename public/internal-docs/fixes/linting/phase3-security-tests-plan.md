<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Phase 3 Security Fixes - Unit Test Plan

This document outlines a comprehensive test plan for the security fixes implemented in Phase 3. All tests should be **trustworthy unit tests** that can catch edge cases and verify security protections work correctly.

## Testability Analysis

### ✅ Highly Testable (Pure Functions / Isolated Logic)

1. **ID Generator (`pkg/id/generator.go`)**
   - Pure function with no external dependencies
   - Easy to test with various inputs
   - Can test edge cases and bounds checking

2. **File Path Validation Logic**
   - Path validation checks are deterministic
   - Can test with various path inputs without file system
   - Can test traversal detection logic

3. **File Mode Validation**
   - Simple bitwise operations
   - Can test with various mode values
   - Can test overflow scenarios

### ⚠️ Moderately Testable (Requires File System / Archives)

4. **Archive Extraction Functions**
   - Requires creating test archives (tar/tar.gz)
   - Can use temporary directories for isolation
   - Can create malicious archives for testing

5. **Decompression Size Limits**
   - Requires creating test archives with known sizes
   - Can verify limits are enforced
   - Can test with various archive sizes

### ❌ Integration Tests Needed (Full System)

6. **End-to-End Archive Processing**
   - Full workflow tests (upload → extract → verify)
   - Requires database and storage setup
   - Better suited for integration tests

## Test Structure

### Test File Organization

```
backend/
├── pkg/id/
│   └── generator_test.go          # ID generation tests
├── internal/plugins/terraform/
│   └── plugin_test.go             # Path validation tests
├── cmd/runner/
│   └── extract_test.go            # Archive extraction tests (extract function)
├── cmd/ansible-runner/
│   └── extract_test.go            # Archive extraction tests
└── internal/services/registry/
    └── module_publisher_test.go   # Module extraction tests
```

## Detailed Test Plans

### 1. ID Generator Tests (`pkg/id/generator_test.go`)

**Function**: `Generate(prefix string) (string, error)`

**Test Cases**:

#### Normal Operation
- ✅ Generate IDs with various prefixes ("ws", "run", "sv", etc.)
- ✅ Verify format: `{prefix}-{16-char-random}`
- ✅ Verify all characters are alphanumeric
- ✅ Generate many IDs and verify uniqueness (statistical test)
- ✅ Verify IDs are different on each call

#### Edge Cases
- ✅ Empty prefix (should work, just returns "-{16-chars}")
- ✅ Very long prefix (should work)
- ✅ Special characters in prefix (should work, prefix is not validated)

#### Bounds Checking (G602 fix)
- ✅ Verify no panics occur (test with many iterations)
- ✅ Verify byteIndex bounds check works (should never trigger in normal operation)
- ✅ Verify charIndex bounds check works (should never trigger in normal operation)
- ✅ Test with mocked rand.Read to force edge cases if possible

**Test Pattern**:
```go
func TestGenerate_NormalOperation(t *testing.T) {
    // Test normal ID generation
}

func TestGenerate_Format(t *testing.T) {
    // Verify format matches expected pattern
}

func TestGenerate_Uniqueness(t *testing.T) {
    // Generate 1000 IDs and check for collisions
}

func TestGenerate_BoundsChecking(t *testing.T) {
    // Test that bounds checks prevent panics
}
```

**Feasibility**: ✅ **Highly feasible** - Pure function, easy to test

---

### 2. File Path Validation Tests

#### 2a. Terraform Plugin Path Validation (`internal/plugins/terraform/plugin_test.go`)

**Function**: `hasRemoteBackend(workspaceDir string) bool`

**Test Cases**:

#### Normal Operation
- ✅ Valid config files in workspace directory
- ✅ Multiple valid config files
- ✅ Missing config files (should return false)

#### Security (G304 fix)
- ✅ Path traversal attempts: `../etc/passwd`
- ✅ Absolute paths outside workspace
- ✅ Symlink traversal attempts
- ✅ Paths with `..` in middle: `subdir/../other/file.tf`
- ✅ Paths that resolve outside workspace after cleaning

**Test Pattern**:
```go
func TestHasRemoteBackend_ValidPaths(t *testing.T) {
    // Test with valid paths
}

func TestHasRemoteBackend_PathTraversal(t *testing.T) {
    // Test path traversal protection
    testCases := []struct {
        name     string
        filename string
        shouldReject bool
    }{
        {"normal file", "main.tf", false},
        {"traversal", "../etc/passwd", true},
        {"absolute path", "/etc/passwd", true},
        // ... more cases
    }
}
```

**Feasibility**: ✅ **Feasible** - Can use temp directories, test path validation logic

#### 2b. Module Publisher Path Validation (`internal/services/registry/module_publisher_test.go`)

**Function**: Path validation in `PublishModuleVersion` and `PublishModuleVersionFromGit`

**Test Cases**:
- ✅ Valid tarball paths in temp directory
- ✅ Path traversal attempts outside temp directory
- ✅ Absolute paths
- ✅ Relative paths that resolve outside temp

**Feasibility**: ✅ **Feasible** - Similar to terraform plugin tests

---

### 3. Archive Path Traversal Protection (G305)

#### 3a. Terraform Runner (`cmd/runner/extract_test.go`)

**Function**: `extractTarGz(data []byte, destDir string) error`

**Test Cases**:

#### Normal Operation
- ✅ Extract valid tar.gz archive
- ✅ Extract archive with nested directories
- ✅ Extract archive with multiple files
- ✅ Verify files are extracted correctly

#### Security (G305 fix)
- ✅ Archive with `../` in file names (should reject)
- ✅ Archive with `../../etc/passwd` (should reject)
- ✅ Archive with absolute paths (should reject)
- ✅ Archive with paths that resolve outside destDir after cleaning
- ✅ Archive with mixed valid and malicious paths (should reject on first malicious)
- ✅ Archive with `..` in middle of path: `subdir/../other/file.tf` (should reject if outside)

**Test Helpers Needed**:
```go
// Helper to create test tar.gz archive
func createTestTarGz(t *testing.T, files map[string]string) []byte {
    // Create tar.gz with specified files
}

// Helper to create malicious archive
func createMaliciousTarGz(t *testing.T, maliciousPath string) []byte {
    // Create archive with path traversal attempt
}
```

**Test Pattern**:
```go
func TestExtractTarGz_NormalArchive(t *testing.T) {
    // Test normal extraction
}

func TestExtractTarGz_PathTraversal(t *testing.T) {
    testCases := []struct {
        name string
        maliciousPath string
    }{
        {"parent directory", "../file.txt"},
        {"deep traversal", "../../etc/passwd"},
        {"absolute path", "/etc/passwd"},
        // ... more cases
    }
    // Verify all are rejected
}
```

**Feasibility**: ✅ **Feasible** - Can create test archives programmatically

#### 3b. Ansible Runner (`cmd/ansible-runner/extract_test.go`)

**Function**: Similar extraction logic (need to find exact function name)

**Test Cases**: Same as terraform runner

**Feasibility**: ✅ **Feasible**

#### 3c. Module Publisher (`internal/services/registry/module_publisher_test.go`)

**Function**: Extraction logic in module publisher

**Test Cases**: Same pattern as above

**Feasibility**: ✅ **Feasible**

---

### 4. Decompression Bomb Protection (G110)

**Functions**: All archive extraction functions

**Test Cases**:

#### Normal Operation
- ✅ Extract normal-sized archives (< 100MB)
- ✅ Extract archives near limit (99MB)
- ✅ Verify content is correct after extraction

#### Security (G110 fix)
- ✅ Archive with single large file (> 100MB) - should be limited
- ✅ Archive with many small files totaling > 100MB - should be limited
- ✅ Archive exactly at limit (100MB) - should work
- ✅ Archive slightly over limit (100MB + 1 byte) - should be limited
- ✅ Verify error message when limit exceeded
- ✅ Verify partial extraction doesn't corrupt filesystem

**Test Helpers**:
```go
// Create archive with specific uncompressed size
func createLargeTarGz(t *testing.T, sizeBytes int64) []byte {
    // Create archive that decompresses to specified size
}
```

**Test Pattern**:
```go
func TestExtractTarGz_SizeLimit(t *testing.T) {
    testCases := []struct {
        name string
        sizeBytes int64
        shouldSucceed bool
    }{
        {"small archive", 1024, true},
        {"at limit", 100 * 1024 * 1024, true},
        {"over limit", 100 * 1024 * 1024 + 1, false},
        {"very large", 500 * 1024 * 1024, false},
    }
}
```

**Feasibility**: ⚠️ **Moderately feasible** - Need to create archives with known decompressed sizes. Can use sparse files or compression tricks.

---

### 5. Integer Overflow Protection (G115)

**Functions**: All archive extraction functions (file mode handling)

**Test Cases**:

#### Normal Operation
- ✅ Valid file modes (0o644, 0o755, 0o600, etc.)
- ✅ Various permission combinations
- ✅ Verify files created with correct permissions

#### Security (G115 fix)
- ✅ File mode > 0o777 (should be masked/clamped)
- ✅ File mode with high bits set (0o7777, 0o17777, etc.)
- ✅ File mode = 0 (should work, creates file with no permissions)
- ✅ File mode = 0o777 (max valid, should work)
- ✅ File mode = 0o1000 (should be clamped to 0o000)
- ✅ Very large mode values (test overflow scenarios)
- ✅ Negative mode values (if possible in tar format)

**Test Pattern**:
```go
func TestExtractTarGz_FileModeValidation(t *testing.T) {
    testCases := []struct {
        name string
        mode int64
        expectedMode os.FileMode
    }{
        {"normal", 0o644, 0o644},
        {"max valid", 0o777, 0o777},
        {"overflow", 0o7777, 0o777}, // Should be masked
        {"very large", 0o17777, 0o777}, // Should be masked
    }
}
```

**Feasibility**: ✅ **Highly feasible** - Can create test archives with specific mode values

---

## Test Implementation Strategy

### Phase 1: Pure Function Tests (Easiest, Most Trustworthy)
1. **ID Generator** - Start here, pure function, easy to test
2. **Path Validation Logic** - Extract validation logic into testable functions if needed

### Phase 2: Archive Tests (Moderate Complexity)
3. **Path Traversal Tests** - Create test archives with malicious paths
4. **File Mode Tests** - Create test archives with various modes
5. **Size Limit Tests** - Create test archives with known sizes

### Phase 3: Integration Tests (If Needed)
6. **End-to-End Tests** - Full workflow tests (optional, for confidence)

## Test Helpers Needed

### Archive Creation Helpers
```go
// Create a tar.gz archive programmatically
func createTestTarGz(t *testing.T, entries []TarEntry) []byte

type TarEntry struct {
    Name string
    Content []byte
    Mode int64
    Typeflag byte // tar.TypeReg, tar.TypeDir
}

// Create malicious archive for testing
func createMaliciousTarGz(t *testing.T, maliciousPath string) []byte

// Create large archive for decompression bomb testing
func createLargeTarGz(t *testing.T, uncompressedSize int64) []byte
```

### Path Testing Helpers
```go
// Create temp directory structure for testing
func setupTestDir(t *testing.T) string

// Verify file exists and has correct permissions
func verifyFile(t *testing.T, path string, expectedMode os.FileMode)
```

## Edge Cases to Test

### Path Traversal Edge Cases
- `../file.txt` - Simple parent directory
- `../../etc/passwd` - Deep traversal
- `/etc/passwd` - Absolute path
- `subdir/../other/file.txt` - Mixed traversal (valid if within bounds)
- `subdir/../../etc/passwd` - Mixed traversal (invalid)
- `file.txt/../etc/passwd` - Traversal after filename
- Windows paths: `..\\file.txt` (if cross-platform)
- Unicode paths: `../тест.txt` (if applicable)
- Very long paths (path length limits)

### File Mode Edge Cases
- Mode 0 (no permissions)
- Mode 0o777 (max valid)
- Mode 0o1000+ (overflow cases)
- Mode 0o17777 (with setuid/setgid bits)
- Mode 0o7777 (all bits set)
- Very large mode values (test int64 overflow)

### Size Limit Edge Cases
- Exactly at limit (100MB)
- One byte over limit
- Multiple files totaling over limit
- Single huge file
- Compressed size small but decompressed huge (decompression bomb)

### ID Generation Edge Cases
- Many rapid generations (test uniqueness)
- Statistical uniqueness test (1000+ IDs)
- Verify no panics under stress
- Test with various prefixes

## Test Quality Criteria

### Must Have
- ✅ **Deterministic** - Same input always produces same result
- ✅ **Isolated** - Tests don't depend on each other
- ✅ **Fast** - Unit tests should run in milliseconds
- ✅ **No external dependencies** - Don't require database, network, etc.
- ✅ **Clear failures** - Error messages explain what went wrong

### Should Have
- ✅ **Table-driven tests** - Easy to add new test cases
- ✅ **Test helpers** - Reusable test utilities
- ✅ **Edge case coverage** - Test boundary conditions
- ✅ **Negative tests** - Verify security protections work

### Nice to Have
- ✅ **Fuzzing** - Use Go's fuzzing for path inputs
- ✅ **Property-based testing** - Use libraries like `gopter` for complex scenarios
- ✅ **Benchmark tests** - Ensure performance is acceptable

## Go Testing Capabilities

### Standard Library
- ✅ `testing` package - Core testing framework
- ✅ `testing/fstest` - In-memory file system for testing
- ✅ Table-driven tests - Standard Go pattern
- ✅ Subtests - Organize related tests

### Third-Party Libraries (If Needed)
- `github.com/stretchr/testify` - Assertions and test helpers
- `github.com/leanovate/gopter` - Property-based testing
- Built-in fuzzing (Go 1.18+) - For fuzz testing

## Recommended Test Structure

```go
package id

import (
    "regexp"
    "strings"
    "testing"
)

func TestGenerate(t *testing.T) {
    t.Run("normal operation", func(t *testing.T) {
        // Test normal cases
    })
    
    t.Run("format validation", func(t *testing.T) {
        // Test format
    })
    
    t.Run("uniqueness", func(t *testing.T) {
        // Test uniqueness
    })
    
    t.Run("bounds checking", func(t *testing.T) {
        // Test bounds checks
    })
}

func TestGenerate_EdgeCases(t *testing.T) {
    testCases := []struct {
        name   string
        prefix string
        // ... expected results
    }{
        // Table-driven tests
    }
    
    for _, tc := range testCases {
        t.Run(tc.name, func(t *testing.T) {
            // Test case
        })
    }
}
```

## Estimated Test Coverage

### High Priority (Must Test)
- ✅ ID generator bounds checking (G602)
- ✅ Path traversal protection (G305) - All 3 functions
- ✅ File mode validation (G115) - All 3 functions
- ✅ Path validation (G304) - All 3 functions

### Medium Priority (Should Test)
- ⚠️ Decompression size limits (G110) - Can be tricky to create test archives
- ⚠️ ID generation uniqueness (statistical test)

### Low Priority (Nice to Have)
- ⚪ Fuzzing for path inputs
- ⚪ Property-based testing for edge cases
- ⚪ Performance benchmarks

## Conclusion

**Feasibility**: ✅ **Highly feasible in Go**

Most of these security fixes can be thoroughly tested with unit tests:
- **Pure functions** (ID generator) - Easy to test
- **Path validation** - Can test with various path strings
- **Archive extraction** - Can create test archives programmatically
- **File mode validation** - Can test with various mode values
- **Size limits** - Moderately complex but doable

**Recommendation**: Start with ID generator tests (easiest, most trustworthy), then move to path validation and archive tests. These will give high confidence that the security fixes work correctly.
