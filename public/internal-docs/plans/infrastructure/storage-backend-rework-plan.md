<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Storage Backend Rework Plan

**Issue:** [#117](https://github.com/michielvha/stackweaver/issues/117)
**Status:** Draft
**Created:** 2026-02-28

## Motivation

MinIO changed its license from Apache 2.0 to AGPLv3 (as of June 2023), making it incompatible with Stackweaver's BSL 1.1 licensing model for bundled distribution. Beyond the licensing concern, the current storage layer is tightly coupled to MinIO in several places, making it difficult to support alternative backends. This plan addresses both problems by:

1. Replacing MinIO with an open-source-friendly default for the bundled Docker Compose setup.
2. Refactoring the storage layer into a clean, provider-agnostic interface that supports S3-compatible backends, Azure Blob Storage, GCS, and local filesystem.

## Current State Analysis

### What exists today

The codebase has **two separate storage interfaces** and **duplicated initialization logic**:

| Interface | Location | Used by |
|-----------|----------|---------|
| `storage.Client` | `backend/internal/storage/interface.go` | State service, config versions, log buffer, terraform runner, ansible runner |
| `registry.StorageBackend` | `backend/internal/services/registry/storage.go` | Registry module/provider publishing and downloads |

Both interfaces are implemented exclusively by MinIO-backed structs (`MinIOClient` and `MinIOStorage`), each creating their own `minio.Client` internally.

### Storage initialization problems

Storage clients are initialized **inline in `routes.go`** up to 4 separate times with duplicated env-var reads (`MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `STORAGE_BUCKET`, `MINIO_USE_SSL`). The runner binaries (`cmd/runner/main.go`, `cmd/ansible-runner/main.go`) each do their own initialization as well. There are also inconsistencies:

- API uses `MINIO_ENDPOINT` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`
- Runners use `STORAGE_ENDPOINT` / `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY`
- A webhook fallback path uses `MINIO_BUCKET` (default `iac-platform`) instead of `STORAGE_BUCKET` (default `terraform-registry`)

### What is stored

| Data | Key pattern | Bucket | Services |
|------|------------|--------|----------|
| Configuration versions | `configuration-versions/{id}/config.tar.gz` | `terraform-registry` | API, runner |
| Terraform state files | `workspaces/{workspace_id}/state/{version}.json` | `iac-state` (runner) | Runner, state service |
| Run logs (persisted) | `runs/{run_id}/logs/{phase}.log` | `terraform-registry` | Runner (via `CopyToMinIO`) |
| Registry modules | `modules/{namespace}/{name}/{provider}/{version}/module.tar.gz` | `terraform-registry` | API (registry handlers) |
| Registry providers | Provider archives and SHA sums | `terraform-registry` | API (registry handlers) |
| Ansible playbook content | `playbooks/{id}/content.tar.gz` | `ansible-artifacts` | Ansible runner |

### MinIO-specific code

- `backend/internal/storage/minio.go` — `MinIOClient` implementing `storage.Client`
- `backend/internal/services/registry/storage.go` — `MinIOStorage` implementing `registry.StorageBackend`
- `backend/internal/services/logbuffer/redis.go` — method named `CopyToMinIO` (name only; uses `storage.Client` interface)
- Direct `minio-go/v7` imports only in the two files above

## Design

### Phase 1: Unify the Storage Interface

Consolidate `storage.Client` and `registry.StorageBackend` into a single interface. The registry interface passes `bucket` per-call, but all implementations use a fixed bucket anyway, so the unified interface should match the simpler `storage.Client` pattern (bucket configured at construction time).

**Unified interface** (extend existing `storage.Client`):

```go
package storage

type Client interface {
    // Object CRUD
    Put(ctx context.Context, key string, data []byte) error
    Get(ctx context.Context, key string) ([]byte, error)
    Delete(ctx context.Context, key string) error

    // Streaming
    PutStream(ctx context.Context, key string, reader io.Reader, size int64) error
    GetStream(ctx context.Context, key string) (io.ReadCloser, error)

    // Listing & presigning
    List(ctx context.Context, prefix string) ([]ObjectInfo, error)
    PresignGet(ctx context.Context, key string, expiry time.Duration) (string, error)

    // Lifecycle
    Ping(ctx context.Context) error
}

type ObjectInfo struct {
    Key          string
    Size         int64
    LastModified time.Time
}
```

Changes from current `storage.Client`:
- `PutStream` gains a `size` parameter (needed for S3 multipart; pass `-1` for unknown)
- `List` returns `[]ObjectInfo` instead of `[]string` (needed by registry)
- Add `Ping` for health checks
- Export `ObjectInfo` from storage package (currently only in registry)

The `registry.StorageBackend` interface will be removed. Registry services will accept `storage.Client` instead, with a thin adapter during migration if needed.

### Phase 2: Backend Implementations

#### 2a: S3-compatible backend (covers AWS S3, Garage, MinIO, Cloudflare R2, Backblaze B2)

Replace the MinIO Go SDK (`minio-go/v7`) with the AWS SDK for Go v2 (`aws-sdk-go-v2`). All S3-compatible services speak the same protocol. Using the AWS SDK is the standard approach and avoids any MinIO licensing concerns.

```go
// backend/internal/storage/s3.go
type S3Client struct {
    client *s3.Client
    bucket string
    presignClient *s3.PresignClient
}

func NewS3Client(cfg S3Config) (*S3Client, error) { ... }
```

**Configuration:**

```go
type S3Config struct {
    Endpoint        string // e.g. "localhost:3900" (Garage), "s3.amazonaws.com"
    Region          string // e.g. "us-east-1", "garage" (forced for Garage)
    AccessKeyID     string
    SecretAccessKey  string
    Bucket          string
    UseSSL          bool
    ForcePathStyle  bool   // true for Garage/MinIO, false for AWS S3
}
```

This single implementation covers:
- **Garage** (default self-hosted) — `ForcePathStyle: true`, custom endpoint
- **AWS S3** — standard endpoint, virtual-hosted style
- **Cloudflare R2** — S3-compatible, custom endpoint
- **Backblaze B2** — S3-compatible, custom endpoint
- **MinIO** (legacy) — `ForcePathStyle: true`, custom endpoint

#### 2b: Azure Blob Storage backend

```go
// backend/internal/storage/azure.go
type AzureBlobClient struct {
    client    *azblob.Client
    container string
}

func NewAzureBlobClient(cfg AzureConfig) (*AzureBlobClient, error) { ... }
```

**Configuration:**

```go
type AzureConfig struct {
    AccountName   string
    AccountKey    string // or use managed identity
    ContainerName string
    // Alternative: connection string
    ConnectionString string
    // For managed identity (no keys)
    UseManagedIdentity bool
}
```

**PresignGet consideration:** Azure Blob Storage supports SAS (Shared Access Signature) URLs, which serve the same purpose as S3 presigned URLs. The implementation will generate SAS tokens with the requested expiry.

#### 2c: Google Cloud Storage backend (future)

```go
// backend/internal/storage/gcs.go
type GCSClient struct {
    client *gcstorage.Client
    bucket string
}
```

GCS also supports signed URLs and has a well-documented Go SDK. This can be added in a later iteration since GCS also supports S3-compatible access via its XML API (can use the S3 backend with a GCS endpoint as a stopgap).

#### 2d: Local filesystem backend (development / testing)

```go
// backend/internal/storage/filesystem.go
type FilesystemClient struct {
    basePath string
}
```

Useful for development without any external dependencies. `PresignGet` would return a URL served by the API itself (e.g., `/api/v2/storage/download?key=...&token=...`).

### Phase 3: Factory and Configuration

Create a factory function that reads configuration and returns the appropriate `storage.Client`:

```go
// backend/internal/storage/factory.go
func NewClient(cfg Config) (Client, error) {
    switch cfg.Backend {
    case "s3", "garage", "minio", "r2", "b2":
        return NewS3Client(cfg.S3)
    case "azure", "azblob":
        return NewAzureBlobClient(cfg.Azure)
    case "gcs":
        return NewGCSClient(cfg.GCS)
    case "filesystem", "local":
        return NewFilesystemClient(cfg.Filesystem)
    default:
        return nil, fmt.Errorf("unsupported storage backend: %q", cfg.Backend)
    }
}

type Config struct {
    Backend    string       // "s3", "azure", "gcs", "filesystem"
    S3         S3Config
    Azure      AzureConfig
    GCS        GCSConfig
    Filesystem FilesystemConfig
}

func ConfigFromEnv() Config { ... } // Reads STORAGE_* env vars
```

**Environment variables** (unified, replacing the mixed `MINIO_*` / `STORAGE_*` naming):

| Variable | Description | Default |
|----------|-------------|---------|
| `STORAGE_BACKEND` | Backend type: `s3`, `azure`, `gcs`, `filesystem` | `s3` |
| `STORAGE_BUCKET` | Bucket / container name | `stackweaver` |
| `STORAGE_ENDPOINT` | S3-compatible endpoint (not used for Azure/GCS) | `localhost:3900` |
| `STORAGE_REGION` | S3 region | `garage` |
| `STORAGE_ACCESS_KEY` | Access key / account name | — |
| `STORAGE_SECRET_KEY` | Secret key / account key | — |
| `STORAGE_USE_SSL` | Enable HTTPS | `false` |
| `STORAGE_FORCE_PATH_STYLE` | S3 path-style access (for Garage/MinIO) | `true` |
| `STORAGE_AZURE_CONNECTION_STRING` | Azure Blob connection string (alternative to key-based) | — |
| `STORAGE_AZURE_USE_MANAGED_IDENTITY` | Use Azure managed identity | `false` |
| `STORAGE_FILESYSTEM_PATH` | Base path for filesystem backend | `/data/storage` |

The old `MINIO_*` variables will be supported as fallbacks during a deprecation period, with a startup warning.

### Phase 4: Centralize Initialization

Currently, storage clients are initialized 4+ times in `routes.go` and separately in each runner binary. This will be refactored to:

1. **Single `ConfigFromEnv()` call** at startup in each binary
2. **Single `storage.NewClient()` call** per bucket
3. **Inject via dependency** into handlers and services

For the API binary (`cmd/api/main.go` → `routes.go`):

```go
storageCfg := storage.ConfigFromEnv()

// One client per bucket (most use cases share a single bucket)
mainStorage, err := storage.NewClient(storageCfg)
// ... pass mainStorage to all handlers/services that need it
```

If multiple buckets are needed, use `storageCfg.WithBucket("other-bucket")` to create additional clients.

### Phase 5: Replace Default Docker Compose Service

Replace MinIO with **Garage** in `deploy/docker-compose.yml`.

**Why Garage:**
- AGPL v3 licensed (open source, no relicensing risk — and acceptable as an infrastructure dependency, not linked into Stackweaver code)
- S3-compatible API
- Lightweight, single-binary, designed for self-hosting
- Supports multi-node deployments for production
- Active development and community

```yaml
  garage:
    image: dxflrs/garage:v1.1.0
    container_name: garage
    restart: unless-stopped
    environment:
      GARAGE_RPC_SECRET: "$(openssl rand -hex 32)"  # auto-generated
    volumes:
      - garage_data:/var/lib/garage/data
      - garage_meta:/var/lib/garage/meta
      - ./garage.toml:/etc/garage.toml:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3900/health"]
      interval: 30s
      timeout: 10s
      retries: 5
    network_mode: host
```

A `deploy/garage.toml` config file will be generated or templated for single-node development setups.

### Phase 6: Rename `CopyToMinIO`

Rename `CopyToMinIO` → `CopyToStorage` in `backend/internal/services/logbuffer/redis.go` and all call sites. This is a trivial rename but important for consistency.

## Implementation Order

| Phase | Effort | Description | Depends on |
|-------|--------|-------------|------------|
| 1 | S | Unify `storage.Client` and `registry.StorageBackend` interfaces | — |
| 2a | M | S3-compatible backend using AWS SDK | Phase 1 |
| 3 | S | Factory function + `ConfigFromEnv` + unified env vars | Phase 2a |
| 4 | M | Centralize initialization in routes.go and runner binaries | Phase 3 |
| 5 | S | Replace MinIO with Garage in Docker Compose | Phase 2a |
| 6 | S | Rename `CopyToMinIO` → `CopyToStorage` | — |
| 2b | M | Azure Blob Storage backend | Phase 1 |
| 2c | S | GCS backend (or defer — S3 compat works) | Phase 1 |
| 2d | S | Local filesystem backend | Phase 1 |

**Recommended implementation sequence:** Phase 6 → 1 → 2a → 3 → 4 → 5 → 2b → 2c → 2d

Phase 6 is a trivial rename that can be done immediately. Phases 1 through 5 form the critical path to eliminate the MinIO dependency. Azure/GCS/filesystem backends can follow as separate PRs.

## Migration & Backward Compatibility

- The `MINIO_*` env vars will continue to work with a deprecation warning printed at startup (mapped internally to `STORAGE_*` equivalents). This ensures existing deployments won't break.
- The `minio-go/v7` dependency will be removed entirely after Phase 2a. The AWS S3 SDK handles MinIO connectivity just as well (MinIO is S3-compatible).
- No data migration is needed — the object keys and bucket structure remain the same. The only change is the underlying storage engine.
- For users running MinIO externally (not the bundled Docker Compose service), the S3 backend with `ForcePathStyle: true` continues to work seamlessly.

## Files to Modify

| File | Changes |
|------|---------|
| `backend/internal/storage/interface.go` | Extend interface (add `Ping`, `ObjectInfo`, update `PutStream` / `List` signatures) |
| `backend/internal/storage/minio.go` | Remove (replaced by `s3.go`) |
| `backend/internal/storage/s3.go` | New — S3-compatible backend using AWS SDK |
| `backend/internal/storage/azure.go` | New — Azure Blob Storage backend |
| `backend/internal/storage/filesystem.go` | New — Local filesystem backend |
| `backend/internal/storage/factory.go` | New — Factory + `ConfigFromEnv` |
| `backend/internal/services/registry/storage.go` | Remove `MinIOStorage`; use `storage.Client` |
| `backend/internal/services/registry/mock_storage.go` | Update to implement unified interface |
| `backend/internal/services/registry/module_publisher.go` | Accept `storage.Client` instead of `StorageBackend` |
| `backend/internal/services/registry/module_service.go` | Accept `storage.Client` instead of `StorageBackend` |
| `backend/internal/services/registry/provider_service.go` | Accept `storage.Client` instead of `StorageBackend` |
| `backend/internal/services/logbuffer/redis.go` | Rename `CopyToMinIO` → `CopyToStorage` |
| `backend/internal/api/v2/routes/routes.go` | Centralize storage init, remove 4x duplicated MinIO blocks |
| `backend/cmd/runner/main.go` | Use `storage.NewClient(storage.ConfigFromEnv())` |
| `backend/cmd/ansible-runner/main.go` | Use `storage.NewClient(storage.ConfigFromEnv())` |
| `deploy/docker-compose.yml` | Replace `minio` service with `garage`, update env vars |
| `deploy/garage.toml` | New — Garage configuration for single-node dev setup |
| `backend/go.mod` | Remove `minio-go/v7`, add `aws-sdk-go-v2` (and `azblob` for Phase 2b) |

## Testing Strategy

- Unit tests for each backend implementation against the `storage.Client` interface
- Integration test using a shared test suite that runs against all backends (table-driven)
- Docker Compose smoke test: `make up` should work out-of-the-box with Garage
- Backward compatibility test: verify `MINIO_*` env vars still work with deprecation warning

## Open Questions

1. **Single vs. multiple buckets:** Currently the codebase uses up to 3 buckets (`terraform-registry`, `iac-state`, `ansible-artifacts`). Should we consolidate into a single bucket with key prefixes, or keep separate buckets? Single bucket simplifies configuration; separate buckets allow different access policies.
2. **Garage init container:** Garage needs bucket creation at startup (similar to MinIO). Should this be a Garage CLI init container or handled by the application at startup (current approach with MinIO)?
3. **GCS priority:** Is a native GCS backend needed, or is S3-compatible access via GCS XML API sufficient for initial release?
