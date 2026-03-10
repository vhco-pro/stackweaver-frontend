<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Storage Client Initialization - Root Cause Analysis

## Overview
This document analyzes how storage clients are initialized for different parts of the system and identifies inconsistencies.

## Three Separate Storage Client Implementations

### 1. Configuration Versions (Workspace Runs)
**Location**: `backend/internal/api/v2/routes/routes.go` lines 101-128

**Initialization**:
- Environment variable: `STORAGE_BUCKET`
- Default bucket: `"terraform-registry"`
- Client variable: `configStorageClient` (type: `storage.Client`)
- Storage key path: `configuration-versions/{config_version_id}/config.tar.gz`

**Used by**:
- `ConfigurationVersionHandlerV2` (UI-triggered plan/apply runs)
- `StateVersionHandlerV2` (state file uploads)
- `RunHandlerV2` (for logs endpoint)

**Code**:
```go
configStorageBucket = os.Getenv("STORAGE_BUCKET")
if configStorageBucket == "" {
    configStorageBucket = "terraform-registry"
}
configStorageClient, err = storage.NewMinIOClient(minioEndpoint, minioAccessKey, minioSecretKey, configStorageBucket, useSSL)
```

---

### 2. Registry Module Versions
**Location**: `backend/internal/api/v2/routes/routes.go` lines 273-301

**Initialization**:
- Environment variable: `STORAGE_BUCKET`
- Default bucket: `"terraform-registry"`
- Client variable: `registryStorage` (type: `registry.StorageBackend` - different interface!)
- Storage key path: `modules/{namespace}/{name}/{provider}/{version}/module.tar.gz` (inferred)

**Used by**:
- `ModulePublisher` (publishes module versions from VCS tags)
- `RegistryModuleHandler` (serves modules to Terraform CLI)
- `RegistryProviderHandler` (providers)

**Code**:
```go
storageBucket = os.Getenv("STORAGE_BUCKET")
if storageBucket == "" {
    storageBucket = "terraform-registry"
}
registryStorage, err = registry.NewMinIOStorage(minioEndpoint, minioAccessKey, minioSecretKey, storageBucket, useSSL)
```

---

### 3. Webhook Handler (VCS-triggered Runs)
**Location**: `backend/internal/api/v2/routes/routes.go` lines 362-406

**Initialization**: **TWO PATHS**

#### Path A: Primary (Reuses Configuration Versions Client)
- **Lines 369-372**: Uses `configStorageClient` directly
- Bucket: `configStorageBucket` → `STORAGE_BUCKET` → `terraform-registry`
- Storage key path: `configuration-versions/{id}/config.tar.gz`
- ✅ **Consistent with UI-triggered runs**

#### Path B: Fallback (Separate Initialization)
- **Lines 374-405**: Creates new storage client if `configStorageClient` is nil
- Environment variable: `MINIO_BUCKET` ⚠️ **DIFFERENT VARIABLE NAME!**
- Default bucket: `"iac-platform"` ⚠️ **DIFFERENT DEFAULT!**
- Storage key path: `configuration-versions/{id}/config.tar.gz` (same)
- ❌ **Inconsistent with UI-triggered runs if fallback is used**

**Fallback Code**:
```go
storageBucket = os.Getenv("MINIO_BUCKET")  // Different variable name!
if storageBucket == "" {
    storageBucket = "iac-platform"  // Different default!
}
storageClient, err = storage.NewMinIOClient(minioEndpoint, minioAccessKey, minioSecretKey, storageBucket, useSSL)
```

---

## Current docker-compose.yml Configuration

```yaml
environment:
  - STORAGE_BACKEND=minio
  - STORAGE_BUCKET=terraform-registry  # ✅ Set for config versions and registry
  - MINIO_ENDPOINT=localhost:9000
  - MINIO_ACCESS_KEY=minioadmin
  - MINIO_SECRET_KEY=minioadmin
  - MINIO_USE_SSL=false
  # ❌ MINIO_BUCKET is NOT set!
```

---

## Issues Identified

### Issue 1: Inconsistent Environment Variable Names
- Configuration versions and Registry use: `STORAGE_BUCKET`
- Webhook fallback uses: `MINIO_BUCKET`
- **Impact**: If webhook falls back, it uses a different bucket (`iac-platform`) than expected

### Issue 2: Different Default Buckets
- Configuration versions default: `terraform-registry`
- Registry default: `terraform-registry`
- Webhook fallback default: `iac-platform`
- **Impact**: Potential bucket mismatch

### Issue 3: Fallback Path May Never Be Used
- Primary path (Path A) reuses `configStorageClient`, which should always be initialized
- Fallback path (Path B) only triggers if `configStorageClient` is nil
- **Question**: Can `configStorageClient` ever be nil if initialized earlier in the code?

### Issue 4: Different Storage Client Types
- Configuration versions: `storage.Client` (generic interface)
- Registry: `registry.StorageBackend` (registry-specific interface)
- **Note**: This is intentional - registry may have different requirements

---

## Storage Key Paths Comparison

| Component | Storage Key Path | Bucket |
|-----------|-----------------|--------|
| Configuration Versions (UI) | `configuration-versions/{id}/config.tar.gz` | `STORAGE_BUCKET` → `terraform-registry` |
| Configuration Versions (Webhook - Primary) | `configuration-versions/{id}/config.tar.gz` | `configStorageBucket` → `STORAGE_BUCKET` → `terraform-registry` |
| Configuration Versions (Webhook - Fallback) | `configuration-versions/{id}/config.tar.gz` | `MINIO_BUCKET` → `iac-platform` |
| Registry Modules | `modules/{namespace}/{name}/{provider}/{version}/module.tar.gz` | `STORAGE_BUCKET` → `terraform-registry` |

---

## Recommendations

### Option 1: Unify Environment Variables (Recommended)
- **Remove** `MINIO_BUCKET` references in webhook fallback
- **Use** `STORAGE_BUCKET` everywhere
- **Update** fallback default to `terraform-registry` to match others
- **Remove** fallback path if `configStorageClient` is always initialized

### Option 2: Keep Separate Buckets (If Intentional)
- **Document** why registry and workspace runs use different buckets
- **Set** `MINIO_BUCKET=iac-platform` in docker-compose.yml
- **Ensure** both buckets exist in MinIO

### Option 3: Remove Fallback Path
- If `configStorageClient` is always initialized before webhook handler setup
- Remove the fallback initialization code (lines 374-405)
- Simplify webhook handler to always use `configStorageClient`

---

## Current Behavior

### Normal Flow (Primary Path)
1. Configuration versions initialized with `STORAGE_BUCKET=terraform-registry`
2. Webhook handler reuses `configStorageClient`
3. Both UI and webhook use same bucket ✅

### Edge Case (Fallback Path)
1. Configuration versions initialized with `STORAGE_BUCKET=terraform-registry`
2. `configStorageClient` is somehow nil (shouldn't happen)
3. Webhook fallback uses `MINIO_BUCKET` (not set) → defaults to `iac-platform`
4. Files uploaded to different bucket ❌
5. Runner tries to download from wrong bucket → **"key does not exist" error**

---

## Questions to Resolve

1. **Should configuration versions and registry modules share the same bucket?**
   - Current: Both use `terraform-registry` (shared)
   - Impact: Namespace separation via storage key paths (different prefixes)

2. **Can `configStorageClient` ever be nil when webhook handler is initialized?**
   - If initialized earlier in code, fallback path may be dead code

3. **Is the fallback path intentional or legacy code?**
   - If intentional, needs better error handling and documentation
   - If legacy, should be removed

4. **Should we support separate buckets for different purposes?**
   - Example: `terraform-registry` for modules, `iac-workspaces` for configuration versions
   - Would require separate `STORAGE_BUCKET` configs

---

## Conclusion

The primary issue is the **inconsistent environment variable name** (`STORAGE_BUCKET` vs `MINIO_BUCKET`) in the webhook fallback path. Since the webhook handler **primarily reuses `configStorageClient`**, this is likely only an issue if:
1. `configStorageClient` fails to initialize (should log warning)
2. Fallback path is triggered unexpectedly

**Recommended action**: Standardize on `STORAGE_BUCKET` everywhere and remove/update the fallback path to use the same variable name and default.

---

## Implementation Status

✅ **FIXED**: Webhook handler fallback path now uses `STORAGE_BUCKET` with default `"terraform-registry"` (same as configuration versions)
- Changed from `MINIO_BUCKET` (default: `"iac-platform"`) to `STORAGE_BUCKET` (default: `"terraform-registry"`)
- Ensures webhook-triggered runs use the same bucket as UI-triggered runs
- Both paths now consistent and will resolve "key does not exist" errors

