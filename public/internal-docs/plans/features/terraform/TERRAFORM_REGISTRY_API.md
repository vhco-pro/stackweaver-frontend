<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Terraform Registry API Implementation Plan

## Overview

This document outlines the implementation plan for a **Terraform Enterprise-compliant Private Module and Provider Registry API**. The registry allows organizations to publish, version, and share both Terraform modules and custom providers internally, following the same protocol that Terraform CLI uses to interact with the public Terraform Registry.

**Key Features:**
- **Module Registry**: Publish and version Terraform modules (like TFE) ✅
- **Provider Registry**: Publish and version custom Terraform providers (like TFE) ✅
- **TFE-Compatible Versioning**: Registry-managed versions with webhook-driven auto-publishing ✅
- **Flexible Storage**: MinIO-based storage with abstraction layer for easy self-hosted deployments ✅
- **Full HCL Parsing**: Automatic metadata extraction (inputs, outputs, dependencies, resources) ✅
- **Frontend UI**: Complete module and provider management interface ✅

**Status**: ✅ **Implementation Complete** - All 9 phases completed. The registry is fully functional and TFE-compliant.

**Reference**: [HashiCorp Registry API Documentation](https://developer.hashicorp.com/terraform/registry/api-docs)

---

## What is the Terraform Registry API?

The Terraform Registry API is the protocol that Terraform CLI uses to:
1. **Discover modules and providers** from a registry hostname
2. **List available versions** of modules/providers
3. **Download module/provider binaries** (tarballs for modules, binaries for providers)
4. **Retrieve metadata** (inputs, outputs, dependencies, documentation for modules; platform support for providers)

### Key Concepts

**For Modules:**
- **Namespace**: The owner/organization that publishes the module (e.g., `myorg`)
- **Name**: The module name (e.g., `vpc`)
- **Provider**: The provider the module targets (e.g., `aws`, `azurerm`, `gcp`)
- **Version**: Semantic version (e.g., `1.0.0`, `2.1.3`) - **Registry-managed** (not tied to Git tags)
- **Module Source**: Uploaded tarball or direct S3/MinIO upload
- **Submodules**: Modules within modules (e.g., `modules/consul-cluster`)

**For Providers:**
- **Namespace**: The owner/organization that publishes the provider (e.g., `myorg`)
- **Name**: The provider name (e.g., `custom-cloud`)
- **Version**: Semantic version (e.g., `1.0.0`, `2.1.3`) - **Registry-managed**
- **Platform**: OS/Architecture (e.g., `linux_amd64`, `darwin_arm64`, `windows_amd64`)
- **Binary**: Provider binary for specific platform

### Service Discovery

Terraform CLI uses the **Terraform Service Discovery Protocol** to find registry endpoints:

1. Terraform CLI queries: `https://<hostname>/.well-known/terraform.json`
2. Registry responds with service endpoints:
   ```json
   {
     "modules.v1": "/v1/modules/",
     "providers.v1": "/v1/providers/"
   }
   ```
3. Terraform CLI appends paths to the base URL:
   - Modules: `/v1/modules/:namespace/:name/:provider/versions`
   - Providers: `/v1/providers/:namespace/:name/versions`

---

## API Endpoints (Terraform Enterprise Compliant)

### Base URL Structure

- **Service Discovery**: `/.well-known/terraform.json`
- **Module Registry Base**: `/v1/modules/` (after service discovery)
- **Full Example**: `https://registry.example.com/v1/modules/myorg/vpc/aws/versions`

### 1. Service Discovery

| Method | Path | Produces | Description |
|--------|------|----------|-------------|
| GET | `/.well-known/terraform.json` | application/json | Returns service discovery document |

**Response:**
```json
{
  "modules.v1": "/v1/modules/",
  "providers.v1": "/v1/providers/"
}
```

---

### 2. List Modules

| Method | Path | Produces | Description |
|--------|------|----------|-------------|
| GET | `/v1/modules` | application/json | List all modules (paginated) |
| GET | `/v1/modules/:namespace` | application/json | List modules by namespace |

**Query Parameters:**
- `offset` (int, optional) - Pagination offset
- `limit` (int, optional) - Results per page (default: 15, max: 100)
- `provider` (string, optional) - Filter by provider
- `verified` (bool, optional) - Only verified/partner modules

**Response:**
```json
{
  "meta": {
    "limit": 15,
    "current_offset": 0,
    "next_offset": 15,
    "next_url": "/v1/modules?limit=15&offset=15"
  },
  "modules": [
    {
      "id": "myorg/vpc/aws/1.0.0",
      "owner": "",
      "namespace": "myorg",
      "name": "vpc",
      "version": "1.0.0",
      "provider": "aws",
      "description": "Terraform module for creating VPC resources",
      "source": "https://github.com/myorg/terraform-aws-vpc",
      "published_at": "2024-01-15T10:30:00Z",
      "downloads": 42,
      "verified": false
    }
  ]
}
```

---

### 3. Search Modules

| Method | Path | Produces | Description |
|--------|------|----------|-------------|
| GET | `/v1/modules/search` | application/json | Search modules by keyword |

**Query Parameters:**
- `q` (string, required) - Search query
- `offset`, `limit` (int, optional) - Pagination
- `provider` (string, optional) - Filter by provider
- `namespace` (string, optional) - Filter by namespace
- `verified` (bool, optional) - Only verified modules

**Response:** Same format as List Modules

---

### 4. List Available Versions for a Module

| Method | Path | Produces | Description |
|--------|------|----------|-------------|
| GET | `/v1/modules/:namespace/:name/:provider/versions` | application/json | List all versions of a module |

**Response:**
```json
{
  "modules": [
    {
      "source": "https://github.com/myorg/terraform-aws-vpc",
      "versions": [
        {
          "version": "2.0.0",
          "submodules": []
        },
        {
          "version": "1.5.0",
          "submodules": ["modules/consul-cluster"]
        },
        {
          "version": "1.0.0",
          "submodules": []
        }
      ]
    }
  ]
}
```

---

### 5. Get Latest Version for a Module

| Method | Path | Produces | Description |
|--------|------|----------|-------------|
| GET | `/v1/modules/:namespace/:name/:provider` | application/json | Get latest version metadata |

**Response:**
```json
{
  "id": "myorg/vpc/aws/2.0.0",
  "owner": "",
  "namespace": "myorg",
  "name": "vpc",
  "version": "2.0.0",
  "provider": "aws",
  "description": "Terraform module for creating VPC resources",
  "source": "https://github.com/myorg/terraform-aws-vpc",
  "published_at": "2024-01-15T10:30:00Z",
  "downloads": 42,
  "verified": false,
  "root": {
    "path": "",
    "readme": "# VPC Module\n\n...",
    "empty": false,
    "inputs": [
      {
        "name": "cidr_block",
        "description": "CIDR block for VPC",
        "default": "\"10.0.0.0/16\"",
        "type": "string"
      }
    ],
    "outputs": [
      {
        "name": "vpc_id",
        "description": "VPC ID"
      }
    ],
    "dependencies": [],
    "resources": [
      {
        "name": "aws_vpc",
        "type": "aws_vpc"
      }
    ]
  },
  "submodules": [],
  "providers": ["aws"],
  "versions": ["2.0.0", "1.5.0", "1.0.0"]
}
```

---

### 6. Get Specific Module Version

| Method | Path | Produces | Description |
|--------|------|----------|-------------|
| GET | `/v1/modules/:namespace/:name/:provider/:version` | application/json | Get specific version metadata |

**Response:** Same format as Latest Version, but for the specific version

---

### 7. Download Module Version (Tarball)

| Method | Path | Produces | Description |
|--------|------|----------|-------------|
| GET | `/v1/modules/:namespace/:name/:provider/:version/download` | application/octet-stream | Download module tarball (302 redirect to storage) |
| GET | `/v1/modules/:namespace/:name/:provider/download` | application/octet-stream | Download latest version (302 redirect) |

**Response:**
- **302 Redirect** to signed S3/MinIO URL (expires in 15 minutes)
- **Location Header**: `https://storage.example.com/modules/myorg/vpc/aws/2.0.0.tar.gz?signature=...`

---

### 8. Module Downloads Metrics (v2 API)

| Method | Path | Produces | Description |
|--------|------|----------|-------------|
| GET | `/v2/modules/:namespace/:name/:provider/downloads/summary` | application/json | Get download statistics |

**Response:**
```json
{
  "data": {
    "type": "module-downloads-summary",
    "id": "123",
    "attributes": {
      "week": 15,
      "month": 64,
      "year": 234,
      "total": 1234
    }
  }
}
```

---

## Provider Registry API Endpoints

### Base URL Structure

- **Service Discovery**: `/.well-known/terraform.json` (includes `providers.v1`)
- **Provider Registry Base**: `/v1/providers/` (after service discovery)
- **Full Example**: `https://registry.example.com/v1/providers/myorg/custom-cloud/versions`

### 1. List Providers

| Method | Path | Produces | Description |
|--------|------|----------|-------------|
| GET | `/v1/providers` | application/json | List all providers (paginated) |
| GET | `/v1/providers/:namespace` | application/json | List providers by namespace |

**Query Parameters:**
- `offset`, `limit` (int, optional) - Pagination
- `verified` (bool, optional) - Only verified providers

**Response:**
```json
{
  "meta": {
    "limit": 15,
    "current_offset": 0,
    "next_offset": 15
  },
  "providers": [
    {
      "id": "myorg/custom-cloud/1.0.0",
      "namespace": "myorg",
      "name": "custom-cloud",
      "version": "1.0.0",
      "published_at": "2024-01-15T10:30:00Z",
      "downloads": 42,
      "verified": false
    }
  ]
}
```

### 2. List Available Versions for a Provider

| Method | Path | Produces | Description |
|--------|------|----------|-------------|
| GET | `/v1/providers/:namespace/:name/versions` | application/json | List all versions of a provider |

**Response:**
```json
{
  "versions": [
    {
      "version": "2.0.0",
      "platforms": [
        {
          "os": "linux",
          "arch": "amd64"
        },
        {
          "os": "darwin",
          "arch": "arm64"
        }
      ]
    },
    {
      "version": "1.0.0",
      "platforms": [
        {
          "os": "linux",
          "arch": "amd64"
        }
      ]
    }
  ]
}
```

### 3. Get Latest Version for a Provider

| Method | Path | Produces | Description |
|--------|------|----------|-------------|
| GET | `/v1/providers/:namespace/:name` | application/json | Get latest version metadata |

**Response:**
```json
{
  "id": "myorg/custom-cloud/2.0.0",
  "namespace": "myorg",
  "name": "custom-cloud",
  "version": "2.0.0",
  "published_at": "2024-01-15T10:30:00Z",
  "downloads": 42,
  "verified": false,
  "platforms": [
    {
      "os": "linux",
      "arch": "amd64",
      "shasum": "abc123...",
      "filename": "terraform-provider-custom-cloud_2.0.0_linux_amd64.zip"
    },
    {
      "os": "darwin",
      "arch": "arm64",
      "shasum": "def456...",
      "filename": "terraform-provider-custom-cloud_2.0.0_darwin_arm64.zip"
    }
  ],
  "versions": ["2.0.0", "1.0.0"]
}
```

### 4. Get Specific Provider Version

| Method | Path | Produces | Description |
|--------|------|----------|-------------|
| GET | `/v1/providers/:namespace/:name/:version` | application/json | Get specific version metadata |

**Response:** Same format as Latest Version, but for the specific version

### 5. Download Provider Binary

| Method | Path | Produces | Description |
|--------|------|----------|-------------|
| GET | `/v1/providers/:namespace/:name/:version/download/:os/:arch` | application/octet-stream | Download provider binary (302 redirect) |
| GET | `/v1/providers/:namespace/:name/download/:os/:arch` | application/octet-stream | Download latest version (302 redirect) |

**Response:**
- **302 Redirect** to signed MinIO URL (expires in 15 minutes)
- **Location Header**: `https://storage.example.com/providers/myorg/custom-cloud/2.0.0/linux_amd64/terraform-provider-custom-cloud_2.0.0_linux_amd64.zip?signature=...`

### 6. Provider Downloads Metrics (v2 API)

| Method | Path | Produces | Description |
|--------|------|----------|-------------|
| GET | `/v2/providers/:namespace/:name/downloads/summary` | application/json | Get download statistics |

**Response:**
```json
{
  "data": {
    "type": "provider-downloads-summary",
    "id": "123",
    "attributes": {
      "week": 15,
      "month": 64,
      "year": 234,
      "total": 1234
    }
  }
}
```

---

## Database Schema

### Module Model

```go
type Module struct {
    ID          uuid.UUID `gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
    OrganizationID uuid.UUID `gorm:"type:uuid;not null;index"` // Namespace = org name
    Name        string    `gorm:"type:varchar(255);not null"`
    Provider    string    `gorm:"type:varchar(50);not null"`
    Description string    `gorm:"type:text"`
    Source      string    `gorm:"type:varchar(500)"` // Git URL (for VCS-connected modules)
    Verified    bool      `gorm:"default:false"` // Partner/verified modules
    PublishedBy uuid.UUID `gorm:"type:uuid;index"` // User who published
    
    // VCS Integration (like Workspace)
    VCSConnectionID   *uuid.UUID `gorm:"type:uuid;index"` // Link to VCSConnection
    VCSConnection     *VCSConnection `gorm:"foreignKey:VCSConnectionID"`
    VCSRepository     string    `gorm:"type:varchar(500)"` // Full repo path (owner/repo)
    VCSWebhookSecret  string    `gorm:"type:varchar(255)"` // Webhook secret for tag push events
    AutoPublishTags   bool      `gorm:"default:true"` // Auto-publish versions from Git tags
    
    CreatedAt   time.Time
    UpdatedAt   time.Time
    
    // Relationships
    Organization Organization `gorm:"foreignKey:OrganizationID"`
    Versions     []ModuleVersion `gorm:"foreignKey:ModuleID"`
    
    // Indexes
    // Unique: (organization_id, name, provider)
}
```

### Module Version Model

```go
type ModuleVersion struct {
    ID          uuid.UUID `gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
    ModuleID    uuid.UUID `gorm:"type:uuid;not null;index"`
    Version     string    `gorm:"type:varchar(50);not null"` // Semantic version
    Source      string    `gorm:"type:varchar(500)"` // Git tag/commit or tarball path
    Readme      string    `gorm:"type:text"` // README content
    PublishedAt time.Time
    Downloads   int       `gorm:"default:0"`
    
    // Module metadata (parsed from Terraform files)
    Inputs      JSONB     `gorm:"type:jsonb"` // Array of input definitions
    Outputs     JSONB     `gorm:"type:jsonb"` // Array of output definitions
    Dependencies JSONB    `gorm:"type:jsonb"` // Array of required providers
    Resources   JSONB     `gorm:"type:jsonb"` // Array of resource types used
    Submodules  JSONB     `gorm:"type:jsonb"` // Array of submodule paths
    
    // Storage
    TarballPath string    `gorm:"type:varchar(500)"` // S3/MinIO path
    TarballSize int64     // Size in bytes
    
    // Relationships
    Module      Module    `gorm:"foreignKey:ModuleID"`
    
    // Indexes
    // Unique: (module_id, version)
}
```

### Module Download Metrics Model

```go
type ModuleDownload struct {
    ID            uuid.UUID `gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
    ModuleVersionID uuid.UUID `gorm:"type:uuid;not null;index"`
    DownloadedAt  time.Time `gorm:"index"`
    IPAddress     string    `gorm:"type:varchar(45)"` // IPv4 or IPv6
    UserAgent     string    `gorm:"type:text"`
    
    // Relationships
    ModuleVersion ModuleVersion `gorm:"foreignKey:ModuleVersionID"`
    
    // Indexes for analytics
    // Index: (module_version_id, downloaded_at)
}
```

### Provider Model

```go
type Provider struct {
    ID          uuid.UUID `gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
    OrganizationID uuid.UUID `gorm:"type:uuid;not null;index"` // Namespace = org name
    Name        string    `gorm:"type:varchar(255);not null"`
    Description string    `gorm:"type:text"`
    Verified    bool      `gorm:"default:false"` // Verified providers (like TFE)
    PublishedBy uuid.UUID `gorm:"type:uuid;index"` // User who published
    CreatedAt   time.Time
    UpdatedAt   time.Time
    
    // Relationships
    Organization Organization `gorm:"foreignKey:OrganizationID"`
    Versions     []ProviderVersion `gorm:"foreignKey:ProviderID"`
    
    // Indexes
    // Unique: (organization_id, name)
}
```

### Provider Version Model

```go
type ProviderVersion struct {
    ID          uuid.UUID `gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
    ProviderID  uuid.UUID `gorm:"type:uuid;not null;index"`
    Version     string    `gorm:"type:varchar(50);not null"` // Semantic version (strict, no pre-release)
    PublishedAt time.Time
    Downloads   int       `gorm:"default:0"`
    
    // Relationships
    Provider    Provider  `gorm:"foreignKey:ProviderID"`
    Platforms   []ProviderPlatform `gorm:"foreignKey:ProviderVersionID"`
    
    // Indexes
    // Unique: (provider_id, version)
}
```

### Provider Platform Model

```go
type ProviderPlatform struct {
    ID              uuid.UUID `gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
    ProviderVersionID uuid.UUID `gorm:"type:uuid;not null;index"`
    OS              string    `gorm:"type:varchar(50);not null"` // linux, darwin, windows
    Arch            string    `gorm:"type:varchar(50);not null"` // amd64, arm64, 386
    Filename        string    `gorm:"type:varchar(255);not null"`
    Shasum          string    `gorm:"type:varchar(64);not null"` // SHA256 checksum
    BinaryPath      string    `gorm:"type:varchar(500)"` // MinIO path
    BinarySize      int64     // Size in bytes
    
    // Relationships
    ProviderVersion ProviderVersion `gorm:"foreignKey:ProviderVersionID"`
    
    // Indexes
    // Unique: (provider_version_id, os, arch)
}
```

### Provider Download Metrics Model

```go
type ProviderDownload struct {
    ID            uuid.UUID `gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
    ProviderPlatformID uuid.UUID `gorm:"type:uuid;not null;index"`
    DownloadedAt  time.Time `gorm:"index"`
    IPAddress     string    `gorm:"type:varchar(45)"` // IPv4 or IPv6
    UserAgent     string    `gorm:"type:text"`
    
    // Relationships
    ProviderPlatform ProviderPlatform `gorm:"foreignKey:ProviderPlatformID"`
    
    // Indexes for analytics
    // Index: (provider_platform_id, downloaded_at)
}
```

---

## Storage Architecture

### Storage Abstraction Layer

We use **MinIO** (S3-compatible) as the default storage backend with an **abstraction layer** to allow easy swapping of storage backends for self-hosted deployments.

**Storage Interface:**
```go
type StorageBackend interface {
    PutObject(bucket, key string, data io.Reader, size int64) error
    GetObject(bucket, key string) (io.Reader, error)
    PresignGetObject(bucket, key string, expiry time.Duration) (string, error)
    DeleteObject(bucket, key string) error
    ListObjects(bucket, prefix string) ([]ObjectInfo, error)
}
```

**Supported Backends:**
- **MinIO** (default, portable, self-hosted)
- **AWS S3** (via MinIO client compatibility)
- **Azure Blob Storage** (future)
- **Google Cloud Storage** (future)

### Module Tarball Storage

Modules are stored as **gzipped tarballs** in object storage:

**Path Structure:**
```
modules/
  {namespace}/
    {name}/
      {provider}/
        {version}.tar.gz
```

**Example:**
```
modules/myorg/vpc/aws/2.0.0.tar.gz
modules/myorg/vpc/aws/1.5.0.tar.gz
```

**Tarball Contents:**
- Root module files (`.tf`, `.tfvars`, `README.md`)
- Submodules (in `modules/` subdirectory)
- **Excludes**: `.git/`, `.terraform/`, `*.tfstate`, `.terraform.lock.hcl`

### Provider Binary Storage

Providers are stored as **zipped binaries** per platform:

**Path Structure:**
```
providers/
  {namespace}/
    {name}/
      {version}/
        {os}_{arch}/
          terraform-provider-{name}_{version}_{os}_{arch}.zip
```

**Example:**
```
providers/myorg/custom-cloud/2.0.0/linux_amd64/terraform-provider-custom-cloud_2.0.0_linux_amd64.zip
providers/myorg/custom-cloud/2.0.0/darwin_arm64/terraform-provider-custom-cloud_2.0.0_darwin_arm64.zip
```

### Storage Configuration

**MinIO Configuration (Default):**
- **Bucket**: `terraform-registry` (or configurable)
- **Presigned URLs**: Generate 15-minute expiring URLs for downloads
- **Access Control**: Organization-scoped (users can only download from their org)
- **Portable**: MinIO container can run anywhere (Docker, Kubernetes, bare metal)

**Environment Variables:**
```yaml
# Storage Backend
STORAGE_BACKEND=minio  # minio, s3, azure, gcs
STORAGE_BUCKET=terraform-registry
STORAGE_PREFIX=  # Optional prefix for all objects

# MinIO Configuration
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false

# AWS S3 (if using S3 backend)
AWS_S3_REGION=us-east-1
AWS_S3_BUCKET=terraform-registry
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

---

## Publishing Workflow

### TFE-Compatible Versioning (Registry-Managed with VCS Integration)

**Key Principle**: Versions are **managed in the registry** and can be automatically published from Git tags via webhooks (like Terraform Enterprise), or manually uploaded. Terraform CLI automatically discovers the latest version.

**Dual Publishing Model** (like TFE):
- **VCS-Connected Modules**: Automatically publish versions when Git tags are pushed (webhook-driven)
- **Manual Upload**: Users can also upload versions directly (tarball or S3/MinIO)
- Registry tracks versions independently
- Latest version is determined by semantic versioning in the registry

### Module Publishing Options

#### Option 1: VCS-Connected Module (Recommended - Like TFE)

**Initial Setup:**
1. **User clicks "Add New Module" in UI:**
   - Selects VCS Connection (from organization's connected VCS providers)
   - Selects Repository (from VCS connection)
   - Enters module name and provider
   - Optionally enables "Auto-publish from Git tags"

2. **Backend creates module:**
   ```
   POST /api/v2/organizations/:name/registry/modules
   {
     "name": "vpc",
     "provider": "aws",
     "vcs_connection_id": "uuid-of-vcs-connection",
     "vcs_repository": "myorg/terraform-aws-vpc",
     "auto_publish_tags": true
   }
   ```

3. **Backend:**
   - Creates `Module` record with `VCSConnectionID`
   - Creates webhook in GitHub/GitLab for tag push events
   - Stores webhook secret
   - Optionally publishes initial version from current state

**Initial Version Publishing (On Module Creation):**
1. **When a module is first created with VCS connection:**
   - Backend automatically fetches the latest Git tag from the repository
   - If a valid semantic version tag is found, it is automatically published
   - This ensures the module has at least one version available immediately

2. **Latest Tag Detection:**
   - Uses GitHub API to list tags (sorted by creation date, newest first)
   - Extracts version from tag name (supports both `v1.0.0` and `1.0.0` formats)
   - Validates semantic versioning
   - Publishes in background (non-blocking)

**Automatic Version Publishing (Webhook-Driven):**
1. **User pushes Git tag:**
   ```bash
   git tag v2.0.0
   git push origin v2.0.0
   ```

2. **VCS sends webhook to registry:**
   ```
   POST /api/v2/vcs-connections/github/webhook
   {
     "ref": "refs/tags/v2.0.0",
     "repository": {
       "full_name": "myorg/terraform-aws-vpc"
     },
     "action": "created" // or "push" for tag events
   }
   ```

3. **Backend webhook handler:**
   - Validates webhook signature
   - Finds module(s) connected to this repository
   - Extracts tag name and validates semantic version (strict, no pre-release)
   - Clones repository at tag commit
   - Creates tarball (excludes `.git/`, `.terraform/`, etc.)
   - Parses Terraform files for metadata
   - Uploads to MinIO
   - Creates `ModuleVersion` record
   - Version is immediately available to Terraform CLI

**Benefits:**
- ✅ Automatic version publishing (no manual uploads)
- ✅ Version numbers match Git tags
- ✅ CI/CD friendly (just push a tag)
- ✅ Same workflow as Terraform Enterprise
- ✅ Latest version auto-fetched on module creation

#### Option 2: Direct Tarball Upload (Manual)

1. **User uploads tarball:**
   ```
   POST /api/v2/organizations/:name/registry/modules/:name/:provider/versions
   Content-Type: multipart/form-data
   file: <tarball>
   version: "2.0.0"
   ```

2. **Backend:**
   - Validates semantic version (strict, no pre-release)
   - Validates tarball format
   - Extracts and parses Terraform files
   - Stores in MinIO
   - Creates `ModuleVersion` record
   - Version is immediately available to Terraform CLI

**Use Cases:**
- Modules not connected to VCS
- One-off version uploads
- Testing/development

#### Option 3: Direct S3/MinIO Upload (For Automation)

1. **User uploads to MinIO directly, then registers:**
   ```
   POST /api/v2/organizations/:name/registry/modules/:name/:provider/versions
   {
     "version": "2.0.0",
     "storage_path": "s3://terraform-registry/modules/myorg/vpc/aws/2.0.0.tar.gz"
   }
   ```

2. **Backend:**
   - Validates file exists in storage
   - Extracts and parses metadata
   - Creates `ModuleVersion` record

**Use Cases:**
- CI/CD pipelines that upload directly to storage
- Bulk imports
- Migration from other systems

### Provider Publishing

#### Option 1: Direct Binary Upload (Per Platform)

1. **User uploads provider binary:**
   ```
   POST /api/v2/organizations/:name/registry/providers/:name/versions/:version/platforms
   Content-Type: multipart/form-data
   file: <provider-binary.zip>
   os: "linux"
   arch: "amd64"
   ```

2. **Backend:**
   - Validates semantic version (strict)
   - Validates binary format (must be Terraform provider binary)
   - Calculates SHA256 checksum
   - Stores in MinIO
   - Creates `ProviderPlatform` record

#### Option 2: Direct S3/MinIO Upload

1. **User uploads to MinIO directly, then registers:**
   ```
   POST /api/v2/organizations/:name/registry/providers/:name/versions/:version/platforms
   {
     "os": "linux",
     "arch": "amd64",
     "storage_path": "s3://terraform-registry/providers/myorg/custom-cloud/2.0.0/linux_amd64/terraform-provider-custom-cloud_2.0.0_linux_amd64.zip"
   }
   ```

#### Option 3: API-Based Upload with GPG Signing (Terraform Enterprise Compatible)

**Current Status**: ✅ **Full API Support with GPG Signing**

The following endpoints are implemented:
- `POST /api/v2/organizations/:name/registry/providers` - Create provider
- `POST /api/v2/organizations/:name/registry/providers/:name/versions/:version/platforms` - Upload provider binary (multipart/form-data)
  - Optional parameter: `gpg_key_id` - If provided, the binary will be signed with the specified GPG key

**GPG Key Management Endpoints** (✅ Implemented):
```
POST   /api/v2/organizations/:name/registry/gpg-keys          # Upload GPG public key
GET    /api/v2/organizations/:name/registry/gpg-keys           # List GPG keys
DELETE /api/v2/organizations/:name/registry/gpg-keys/:key_id   # Delete GPG key
```

**GPG Key Upload Example:**
```bash
POST /api/v2/organizations/myorg/registry/gpg-keys
Content-Type: application/json

{
  "ascii_armor": "-----BEGIN PGP PUBLIC KEY BLOCK-----\n..."
}
```

**Provider Publishing with GPG Signing:**
```bash
POST /api/v2/organizations/myorg/registry/providers/custom-cloud/versions/2.0.0/platforms
Content-Type: multipart/form-data

file: <provider-binary.zip>
os: "linux"
arch: "amd64"
gpg_key_id: "ABC12345"  # Optional - if provided, binary will be signed
```

**Provider Platform Response** (Includes GPG Key Info):
```json
{
  "os": "linux",
  "arch": "amd64",
  "filename": "terraform-provider-custom-cloud_2.0.0_linux_amd64.zip",
  "shasum": "abc123...",
  "signing_keys": {
    "gpg_public_keys": [
      {
        "key_id": "ABC12345",
        "ascii_armor": "-----BEGIN PGP PUBLIC KEY BLOCK-----..."
      }
    ]
  }
}
```

**GPG Signature Storage:**
- When a provider binary is signed, a `.sig` file is created and stored alongside the binary in MinIO
- Signature path: `providers/{org}/{provider}/{version}/{os}_{arch}/{filename}.sig`
- The signature path and key ID are stored in the `ProviderPlatform` model

**Note**: GPG signing is optional but recommended for production use. The system uses the system `gpg` binary for signing and verification, so GPG must be installed in the API container.

---

## VCS Integration for Modules

### Module Creation Flow (Frontend)

**UI Flow (Similar to Workspace Creation):**

1. **User clicks "Add New Module" button**
2. **Module Creation Dialog:**
   - **Name** (required): Module name (e.g., `vpc`) - **Auto-detected from repository name if following Terraform naming convention**
   - **Provider** (required): Target provider (e.g., `aws`, `azurerm`) - **Auto-detected from repository name if following Terraform naming convention**
   - **Description** (optional): Module description
   - **VCS Connection** (optional): Select from organization's VCS connections (card-based UI, similar to Terraform Cloud)
   - **Repository** (conditional): Select repository (populated from VCS connection)
   - **Auto-publish from Git tags** (checkbox): Enable automatic version publishing
   - **Manual Upload** (alternative): Upload tarball directly

**Auto-Detection of Module Name and Provider:**

When a repository is selected, the system automatically parses the repository name following Terraform's naming convention:
- **Format**: `terraform-<PROVIDER>-<NAME>`
- **Example**: `terraform-azurerm-aks` → Provider: `azurerm`, Name: `aks`
- **Example**: `terraform-aws-vpc` → Provider: `aws`, Name: `vpc`

The auto-detection:
- Only fills fields if they are empty (allows manual override)
- Works with full repository paths (e.g., `owner/terraform-azurerm-aks`)
- Extracts the repository name portion and parses it
- If the repository name doesn't follow the convention, fields remain empty for manual entry

3. **If VCS Selected:**
   - Repository selector (same component as workspace creation)
   - Toggle: "Automatically publish versions when Git tags are pushed"
   - Backend creates webhook for tag push events

4. **If Manual Upload:**
   - File upload field for tarball
   - Version input field
   - Upload button

### Webhook Handling for Module Versions

**Webhook Endpoint:**
```
POST /api/v2/vcs-connections/github/webhook
POST /api/v2/vcs-connections/gitlab/webhook
```

**Tag Push Event Processing:**

1. **Webhook Payload (GitHub):**
   ```json
   {
     "ref": "refs/tags/v2.0.0",
     "ref_type": "tag",
     "repository": {
       "full_name": "myorg/terraform-aws-vpc",
       "clone_url": "https://github.com/myorg/terraform-aws-vpc.git"
     },
     "action": "created"
   }
   ```

2. **Backend Processing:**
   ```go
   // Find modules connected to this repository
   modules := moduleRepo.FindByVCSRepository(repositoryFullName)
   
   for _, module := range modules {
       if !module.AutoPublishTags {
           continue // Skip if auto-publish disabled
       }
       
       // Extract version from tag (remove 'v' prefix if present)
       version := extractVersionFromTag(tagName) // "v2.0.0" -> "2.0.0"
       
       // Validate semantic version (strict)
       if !isValidSemver(version) {
           log.Warn("Invalid semantic version in tag: %s", tagName)
           continue
       }
       
       // Check if version already exists
       if moduleVersionRepo.Exists(module.ID, version) {
           log.Info("Version %s already exists for module %s", version, module.Name)
           continue
       }
       
       // Clone repository at tag
       tempDir := cloneRepositoryAtTag(module.VCSConnection, repositoryFullName, tagName)
       defer os.RemoveAll(tempDir)
       
       // Create tarball
       tarballPath := createModuleTarball(tempDir, module.Name, version)
       
       // Parse metadata
       metadata := parser.ParseModule(tempDir)
       
       // Upload to MinIO
       storagePath := uploadToStorage(tarballPath, module, version)
       
       // Create ModuleVersion record
       moduleVersion := &ModuleVersion{
           ModuleID: module.ID,
           Version: version,
           TarballPath: storagePath,
           Inputs: metadata.Inputs,
           Outputs: metadata.Outputs,
           Dependencies: metadata.Dependencies,
           Resources: metadata.Resources,
           Submodules: metadata.Submodules,
           Readme: metadata.Readme,
           PublishedAt: time.Now(),
       }
       moduleVersionRepo.Create(moduleVersion)
       
       log.Info("Published module version %s/%s/%s@%s from Git tag %s", 
           module.Organization.Name, module.Name, module.Provider, version, tagName)
   }
   ```

### Webhook Configuration

**GitHub App Webhook Setup:**
- **Events**: `push` (for tag push events), `installation` (for installation events)
- **URL**: `https://registry.example.com/api/v2/vcs-connections/github/webhook`
- **Content Type**: `application/json`
- **Secret**: Configured via `GITHUB_WEBHOOK_SECRET` environment variable

**Important Notes:**
1. **GitHub App Webhooks**: The webhook is automatically configured when the GitHub App is installed. No manual webhook setup is required.
2. **Webhook URL Configuration**: 
   - **Development**: Use ngrok to expose your local API: `ngrok http 8022`
   - Update GitHub App webhook URL to: `https://your-ngrok-url.ngrok.io/api/v2/vcs-connections/github/webhook`
   - **Production**: Use your production domain: `https://your-domain.com/api/v2/vcs-connections/github/webhook`
3. **Webhook Events**: Ensure "Push" events are enabled in GitHub App settings (required for tag-based module publishing)
4. **Tag Push Events**: When a Git tag is pushed, GitHub sends a `push` event with `ref` starting with `refs/tags/`
5. **Webhook Handler**: The handler automatically:
   - Detects tag push events (`refs/tags/v1.0.0`)
   - Finds modules connected to the repository with `AutoPublishTags` enabled
   - Uses installation token to clone private repositories
   - Publishes the module version automatically
6. **MinIO Configuration**: Ensure MinIO is properly configured (see "MinIO Storage Configuration" section) for module tarballs to be uploaded successfully

**Troubleshooting Webhook Issues:**
- Check GitHub App webhook delivery logs: `https://github.com/settings/apps/<your-app>/advanced`
- Verify webhook URL is accessible (use ngrok for development)
- Check API logs for webhook processing errors
- Ensure module has `auto_publish_tags = true` and `vcs_repository` matches exactly (e.g., `owner/repo-name`)
- Verify MinIO is configured and accessible
- Check that the tag name follows semantic versioning (e.g., `v1.0.0` or `1.0.0` - both formats are supported)
- Ensure `git` is installed in the API container (required for cloning repositories)

**GitLab Webhook Setup:**
- **Events**: `Tag push events`
- **URL**: `https://registry.example.com/api/v2/vcs-connections/gitlab/webhook`
- **Secret Token**: Generated per module

**Webhook Creation:**
- Automatically created when module is connected to VCS
- Uses existing `GitHubAppService.CreateWebhook()` method
- Webhook secret stored in `Module.VCSWebhookSecret`

---

## Module Parsing & Metadata Extraction

### Terraform File Parsing

We need to parse Terraform files to extract:

1. **Inputs** (`variables.tf`):
   ```hcl
   variable "cidr_block" {
     description = "CIDR block for VPC"
     type        = string
     default     = "10.0.0.0/16"
   }
   ```
   → Extract: `name`, `description`, `type`, `default`

2. **Outputs** (`outputs.tf`):
   ```hcl
   output "vpc_id" {
     description = "VPC ID"
     value       = aws_vpc.main.id
   }
   ```
   → Extract: `name`, `description`

3. **Dependencies** (`versions.tf` or `terraform.tf`):
   ```hcl
   terraform {
     required_providers {
       aws = {
         source  = "hashicorp/aws"
         version = "~> 4.0"
       }
     }
   }
   ```
   → Extract: provider requirements

4. **Resources** (all `.tf` files):
   → Extract: resource types (e.g., `aws_vpc`, `aws_subnet`)

5. **Submodules** (`modules/` directory):
   → List submodule paths (e.g., `modules/consul-cluster`)

### Parsing Library

Use **HashiCorp's `hcl` library** for parsing:
```go
import "github.com/hashicorp/hcl/v2"
import "github.com/hashicorp/hcl/v2/hclparse"
```

Or use **Terraform's internal parsing** (more complex but accurate):
- `github.com/hashicorp/terraform/configs` (Terraform 0.12+)

---

## API Routes Structure

### Registry Routes (Public - No Auth for Downloads)

```go
// Service Discovery
GET /.well-known/terraform.json

// Module Registry (v1)
GET  /v1/modules
GET  /v1/modules/:namespace
GET  /v1/modules/search
GET  /v1/modules/:namespace/:name/:provider/versions
GET  /v1/modules/:namespace/:name/:provider
GET  /v1/modules/:namespace/:name/:provider/:version
GET  /v1/modules/:namespace/:name/:provider/:version/download
GET  /v1/modules/:namespace/:name/:provider/download

// Module Registry (v2 - Metrics)
GET  /v2/modules/:namespace/:name/:provider/downloads/summary

// Provider Registry (v1)
GET  /v1/providers
GET  /v1/providers/:namespace
GET  /v1/providers/:namespace/:name/versions
GET  /v1/providers/:namespace/:name
GET  /v1/providers/:namespace/:name/:version
GET  /v1/providers/:namespace/:name/:version/download/:os/:arch
GET  /v1/providers/:namespace/:name/download/:os/:arch

// Provider Registry (v2 - Metrics)
GET  /v2/providers/:namespace/:name/downloads/summary
```

### Publishing Routes (Authenticated - TFE API v2)

```go
// Module Management
POST   /api/v2/organizations/:name/registry/modules
GET    /api/v2/organizations/:name/registry/modules
DELETE /api/v2/organizations/:name/registry/modules  // Delete all modules in organization
GET    /api/v2/organizations/:name/registry/modules/:name/:provider
PATCH  /api/v2/organizations/:name/registry/modules/:name/:provider
DELETE /api/v2/organizations/:name/registry/modules/:name/:provider  // Delete specific module

// Module Version Management (Registry-Managed)
POST   /api/v2/organizations/:name/registry/modules/:name/:provider/versions
GET    /api/v2/organizations/:name/registry/modules/:name/:provider/versions
GET    /api/v2/organizations/:name/registry/modules/:name/:provider/versions/:version
DELETE /api/v2/organizations/:name/registry/modules/:name/:provider/versions/:version

// VCS Webhooks (for automatic version publishing)
POST   /api/v2/vcs-connections/github/webhook
POST   /api/v2/vcs-connections/gitlab/webhook

// Provider Management
POST   /api/v2/organizations/:name/registry/providers
GET    /api/v2/organizations/:name/registry/providers
GET    /api/v2/organizations/:name/registry/providers/:name
PATCH  /api/v2/organizations/:name/registry/providers/:name
DELETE /api/v2/organizations/:name/registry/providers/:name

// Provider Version Management (Registry-Managed)
POST   /api/v2/organizations/:name/registry/providers/:name/versions
GET    /api/v2/organizations/:name/registry/providers/:name/versions
GET    /api/v2/organizations/:name/registry/providers/:name/versions/:version
DELETE /api/v2/organizations/:name/registry/providers/:name/versions/:version

// Provider Platform Management
POST   /api/v2/organizations/:name/registry/providers/:name/versions/:version/platforms
GET    /api/v2/organizations/:name/registry/providers/:name/versions/:version/platforms
DELETE /api/v2/organizations/:name/registry/providers/:name/versions/:version/platforms/:os/:arch
```

---

## Implementation Phases

### Phase 1: Foundation & Service Discovery ✅

**Goals:**
- [x] Service discovery endpoint (`/.well-known/terraform.json`) - includes modules.v1 and providers.v1
- [x] Database models (`Module`, `ModuleVersion`, `ModuleDownload`, `Provider`, `ProviderVersion`, `ProviderPlatform`, `ProviderDownload`)
- [x] Database migrations
- [x] Storage abstraction layer (MinIO interface)
- [x] Basic route structure

**Files to Create:**
- `backend/internal/models/module.go`
- `backend/internal/models/module_version.go`
- `backend/internal/models/module_download.go`
- `backend/internal/models/provider.go`
- `backend/internal/models/provider_version.go`
- `backend/internal/models/provider_platform.go`
- `backend/internal/models/provider_download.go`
- `backend/internal/services/storage/interface.go` (storage abstraction)
- `backend/internal/services/storage/minio.go` (MinIO implementation)
- `backend/internal/api/v2/handlers/registry.go` (service discovery)

---

### Phase 2: Module Listing & Search ✅

**Goals:**
- [x] List modules endpoint (`GET /v1/modules`)
- [x] List by namespace (`GET /v1/modules/:namespace`)
- [x] Search modules (`GET /v1/modules/search`)
- [x] Pagination support
- [x] Provider/namespace filtering

**Files to Create:**
- `backend/internal/services/registry/module_service.go`
- `backend/internal/repository/module_repository.go`
- `backend/internal/api/v2/handlers/registry_modules.go`

---

### Phase 3: Module Version Management ✅

**Goals:**
- [x] List versions (`GET /v1/modules/:namespace/:name/:provider/versions`)
- [x] Get latest version (`GET /v1/modules/:namespace/:name/:provider`)
- [x] Get specific version (`GET /v1/modules/:namespace/:name/:provider/:version`)
- [x] Download endpoint with presigned URLs (`GET /v1/modules/.../download`)
- [x] Download tracking and metrics
- [x] Version metadata extraction (inputs, outputs, dependencies) - Full HCL parsing implemented

**Files to Create:**
- `backend/internal/services/registry/version_service.go`
- `backend/internal/services/registry/parser.go` (Terraform file parsing)

---

### Phase 4: Module Publishing API (VCS-Connected + Manual) ✅

**Goals:**
- [x] Module creation with VCS connection (`POST /api/v2/organizations/:name/registry/modules`)
- [x] VCS repository selection (reuse existing VCS connection infrastructure)
- [x] Webhook handler for tag push events (extended `HandleInstallationWebhook`)
- [x] Manual tarball upload (`POST /api/v2/.../versions`)
- [x] Tarball validation and extraction
- [x] MinIO upload via storage abstraction
- [x] Metadata extraction with full HCL parsing (variables, outputs, dependencies, resources)
- [x] Strict semantic versioning validation (no pre-release)
- [ ] Direct S3/MinIO upload registration (TODO)
- [ ] Webhook creation for tag push events (TODO - currently processes existing webhooks)

**Files to Create:**
- `backend/internal/services/registry/module_publisher.go`
- `backend/internal/services/registry/version_validator.go` (strict semver)
- `backend/internal/services/registry/webhook_handler.go` (tag push event processing)

---

### Phase 5: Module & Provider Download ✅

**Goals:**
- [x] Module download endpoint (`GET /v1/modules/.../download`)
- [x] Provider download endpoint (`GET /v1/providers/.../download/:os/:arch`)
- [x] Presigned MinIO URL generation (via storage abstraction)
- [x] Download tracking (metrics)
- [x] 302 redirect handling

**Files to Update:**
- `backend/internal/api/v2/handlers/registry_modules.go`
- `backend/internal/api/v2/handlers/registry_providers.go`
- `backend/internal/services/storage/minio.go`

---

### Phase 4.5: VCS Webhook Integration for Auto-Publishing ✅

**Goals:**
- [x] Extend existing VCS webhook handler to process tag push events
- [x] Module lookup by VCS repository
- [x] Git tag to version extraction and validation
- [x] Automatic tarball creation from Git tag
- [x] Automatic metadata extraction and publishing
- [ ] Webhook signature validation (TODO - currently disabled)

**Files to Update:**
- `backend/internal/api/v2/handlers/vcs_app_installation.go` (extend webhook handler)
- `backend/internal/services/registry/module_publisher.go` (add `PublishFromGitTag` method)

### Phase 6: Module Parsing & Metadata ✅

**Goals:**
- [x] Parse `variables.tf` → extract inputs (name, description, type, default, required)
- [x] Parse `outputs.tf` → extract outputs (name, description)
- [x] Parse `versions.tf` → extract dependencies (required_providers with source and version)
- [x] Parse all `.tf` files → extract resources (resource type and name)
- [x] Detect submodules (`modules/` directory)
- [x] Extract README content

**Files to Create:**
- `backend/internal/services/registry/parser.go`
- `backend/internal/services/registry/metadata_extractor.go`

**Dependencies:**
- `github.com/hashicorp/hcl/v2` (HCL parsing)
- Or `github.com/hashicorp/terraform/configs` (full Terraform parsing)

---

### Phase 7: Provider Registry Implementation ✅

**Goals:**
- [x] Provider listing endpoints (`GET /v1/providers`, `GET /v1/providers/:namespace`)
- [x] Provider search endpoint (`GET /v1/providers/search`)
- [x] Provider version management (`GET /v1/providers/:namespace/:name/versions`)
- [x] Provider platform management (OS/Arch)
- [x] Provider binary upload and validation (`POST /api/v2/.../providers/:name/versions/:version/platforms`)
- [x] Provider download endpoints (`GET /v1/providers/.../download/:os/:arch`)
- [x] Provider download metrics (`GET /v2/providers/.../downloads/summary`)

**Files to Create:**
- `backend/internal/services/registry/provider_service.go`
- `backend/internal/services/registry/provider_publisher.go`
- `backend/internal/api/v2/handlers/registry_providers.go`

### Phase 8: Download Metrics (v2 API) ✅

**Goals:**
- [x] Track downloads (`ModuleDownload`, `ProviderDownload` models)
- [x] Downloads summary endpoints (`GET /v2/modules/.../downloads/summary`, `GET /v2/providers/.../downloads/summary`)
- [x] Analytics (week, month, year, total)

**Files to Update:**
- `backend/internal/api/v2/handlers/registry_modules.go`
- `backend/internal/api/v2/handlers/registry_providers.go`
- `backend/internal/services/registry/metrics_service.go`

---

### Phase 9: Frontend Integration ✅

**Goals:**
- [x] Module browser UI (`/organizations/:name/registry`)
- [x] **"Add New Module" dialog** (similar to workspace creation):
  - VCS connection selector (card-based UI, similar to Terraform Cloud)
  - Repository selector (populated from VCS connection)
  - Module name and provider inputs (with auto-detection from repository name)
  - "Auto-publish from Git tags" toggle
  - Auto-detection: Parses `terraform-<PROVIDER>-<NAME>` format from repository name
  - Alternative: Manual tarball upload option
- [x] Module detail page (shows versions, VCS connection status, manual upload)
- [x] Provider browser UI (`/organizations/:name/registry/providers`)
- [x] Provider publishing form (binary upload per platform)
- [x] Version management UI (registry-managed)
- [ ] Download statistics dashboard (TODO - can be added later)

**Files Created:**
- `frontend/src/pages/Registry.tsx` (Module list page)
- `frontend/src/pages/Registry/ModuleDetail.tsx` (Module detail with version upload)
- `frontend/src/components/registry/CreateModuleDialog.tsx` (VCS + manual module creation)
- `frontend/src/pages/Registry/ProviderList.tsx` (Provider list page)
- `frontend/src/pages/Registry/ProviderPublish.tsx` (Provider binary publishing form)
- `frontend/src/api/client.ts` (Added `registryApi` with module and provider methods)
- `frontend/src/components/ui/table.tsx` (Table component)
- `frontend/src/components/ui/badge.tsx` (Badge component)
- `frontend/src/components/ui/checkbox.tsx` (Checkbox component)

**Routes Added:**
- `/organizations/:organizationName/registry` - Module list
- `/organizations/:organizationName/registry/modules/:moduleName/:provider` - Module detail
- `/organizations/:organizationName/registry/providers` - Provider list
- `/organizations/:organizationName/registry/providers/:providerName` - Provider publish

---

## Technical Implementation Details

### Service Discovery Handler

```go
// backend/internal/api/v2/handlers/registry.go
func HandleServiceDiscovery(c *gin.Context) {
    c.JSON(200, gin.H{
        "modules.v1": "/v1/modules/",
        "providers.v1": "/v1/providers/",
    })
}
```

### Module Listing Handler

```go
// backend/internal/api/v2/handlers/registry_modules.go
func ListModules(c *gin.Context) {
    namespace := c.Param("namespace")
    provider := c.Query("provider")
    verified := c.Query("verified") == "true"
    offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
    limit, _ := strconv.Atoi(c.DefaultQuery("limit", "15"))
    
    modules, total, err := moduleService.List(namespace, provider, verified, offset, limit)
    // ... format response
}
```

### Module Download Handler

```go
func DownloadModule(c *gin.Context) {
    namespace := c.Param("namespace")
    name := c.Param("name")
    provider := c.Param("provider")
    version := c.Param("version")
    
    // Get module version
    moduleVersion, err := versionService.Get(namespace, name, provider, version)
    
    // Generate presigned URL (15 min expiry)
    downloadURL, err := storageService.PresignGetObject(
        moduleVersion.TarballPath,
        15*time.Minute,
    )
    
    // Track download
    go metricsService.TrackDownload(moduleVersion.ID, c.ClientIP(), c.GetHeader("User-Agent"))
    
    // Redirect
    c.Redirect(302, downloadURL)
}
```

### Module Parser

```go
// backend/internal/services/registry/parser.go
type ModuleParser struct {
    // HCL parser
}

func (p *ModuleParser) ParseModule(dir string) (*ModuleMetadata, error) {
    // Parse variables.tf
    inputs := p.ParseVariables(dir)
    
    // Parse outputs.tf
    outputs := p.ParseOutputs(dir)
    
    // Parse versions.tf
    dependencies := p.ParseDependencies(dir)
    
    // Parse all .tf files for resources
    resources := p.ParseResources(dir)
    
    // Detect submodules
    submodules := p.DetectSubmodules(dir)
    
    // Read README
    readme := p.ReadREADME(dir)
    
    return &ModuleMetadata{
        Inputs: inputs,
        Outputs: outputs,
        Dependencies: dependencies,
        Resources: resources,
        Submodules: submodules,
        Readme: readme,
    }, nil
}
```

---

## Security & Access Control

### Organization Scoping

- **Module Namespace = Organization Name**
- Users can only:
  - **Publish** modules to their organization
  - **View** modules from their organization (and public modules if we add that)
  - **Download** modules from their organization

### Authentication

- **Registry Endpoints** (`/v1/modules/*`): **Public** (no auth required for downloads)
  - Downloads are tracked by IP/User-Agent
  - Organization-scoped (users can only access their org's modules)
  
- **Publishing Endpoints** (`/api/v2/organizations/:name/registry/*`): **Authenticated**
  - Requires JWT or TFE token
  - RBAC: Only org members with `write` permission can publish

### Rate Limiting

- **Downloads**: 100 requests/minute per IP
- **Publishing**: 10 publishes/hour per user
- **Search**: 60 requests/minute per IP

---

## Testing Strategy

### Unit Tests

- [x] Module parsing (extract inputs, outputs, dependencies) - Implemented in `parser.go`
- [x] Tarball creation (exclude `.git/`, `.terraform/`) - Implemented in `module_publisher.go`
- [x] Version validation (semantic versioning) - Implemented in `version_validator.go`
- [x] Storage service (presigned URL generation) - Implemented in `storage.go`

### Integration Tests

**Current Status**: ✅ **Integration Tests Available**

Integration tests are located in:
- `backend/internal/api/v2/handlers/registry_modules_test.go` - Module registry tests
- `backend/internal/api/v2/handlers/registry_provider_publishing_test.go` - Provider publishing tests

**Running Tests Against Live Database:**

Tests can be run against a live database by setting the `TEST_DATABASE_URL` environment variable:

```bash
# Use live database
export TEST_DATABASE_URL="postgres://user:password@localhost:5432/iac_platform?sslmode=disable"

# Run all registry tests
go test -v ./internal/api/v2/handlers -run TestListModules
go test -v ./internal/api/v2/handlers -run TestGetModuleVersions
go test -v ./internal/api/v2/handlers -run TestPublishModuleVersion
go test -v ./internal/api/v2/handlers -run TestCreateProvider
go test -v ./internal/api/v2/handlers -run TestPublishProviderPlatform
go test -v ./internal/api/v2/handlers -run TestPublishProviderPlatformWithGPG

# Or use the test script
./backend/test_registry.sh
```

**Test Coverage:**
- [x] Service discovery endpoint
- [x] Module listing with pagination
- [x] Module search
- [x] Version listing
- [x] Module publishing from upload
- [x] Provider creation
- [x] Provider platform publishing
- [x] Provider platform publishing with GPG signing
- [ ] Module download (302 redirect) - Can be added
- [ ] Module publishing from Git - Tested via webhook handler

**Test Database Setup:**
- Tests use `gorm.io/driver/postgres` for compatibility
- Tests automatically migrate required models
- Tests clean up after themselves (drop test data)
- If `TEST_DATABASE_URL` is not set, tests will skip (for CI/CD)

### E2E Tests

- [ ] Full workflow: Publish → List → Download
- [ ] Terraform CLI integration test:
  ```bash
  terraform init -backend-config="..." \
    -backend-config="key=test" \
    -get-modules=true
  ```

---

## Terraform CLI Integration

### Usage in Terraform Configuration

Once implemented, users can reference modules like:

```hcl
module "vpc" {
  source  = "registry.example.com/myorg/vpc/aws"
  version = "~> 2.0"
  
  cidr_block = "10.0.0.0/16"
}
```

### Terraform CLI Configuration

Users configure the registry hostname:

```hcl
# terraform.tf or .terraformrc
terraform {
  required_version = ">= 1.0"
  
  # Optional: Configure custom registry
  # Terraform CLI will query: https://registry.example.com/.well-known/terraform.json
}
```

Or via environment variable:
```bash
export TF_REGISTRY_HOST=registry.example.com
```

---

## Environment Variables

Add to `deploy/docker-compose.yml`:

```yaml
environment:
  # Registry Configuration
  - REGISTRY_ENABLED=true
  - REGISTRY_HOST=registry.example.com
  
  # Storage Backend (MinIO by default)
  - STORAGE_BACKEND=minio
  - STORAGE_BUCKET=terraform-registry
  - STORAGE_PREFIX=
  
  # MinIO Configuration (Default - Portable)
  - MINIO_ENDPOINT=minio:9000
  - MINIO_ACCESS_KEY=minioadmin
  - MINIO_SECRET_KEY=minioadmin
  - MINIO_USE_SSL=false
  
  # AWS S3 (Alternative - if using S3 backend)
  # - STORAGE_BACKEND=s3
  # - AWS_S3_REGION=us-east-1
  # - AWS_S3_BUCKET=terraform-registry
  # - AWS_ACCESS_KEY_ID=...
  # - AWS_SECRET_ACCESS_KEY=...
  
  # Version Validation
  - REGISTRY_STRICT_SEMVER=true  # No pre-release versions (like TFE)
  - REGISTRY_ALLOW_PRERELEASE=false
```

---

## Dependencies

### Go Packages

```go
// HCL Parsing
github.com/hashicorp/hcl/v2
github.com/hashicorp/hcl/v2/hclparse

// Storage (MinIO - S3-compatible)
github.com/minio/minio-go/v7

// Git Operations (optional - for one-time Git import)
github.com/go-git/go-git/v5

// Semantic Versioning
github.com/Masterminds/semver/v3

// Archive/Tarball
archive/tar
compress/gzip
```

---

## Decisions Made

1. **Module Source Types:**
   - ✅ Direct tarball uploads (primary method)
   - ✅ S3/MinIO direct uploads (for automation)
   - ✅ Optional one-time Git import (for initial setup only)

2. **Submodule Support:**
   - ✅ Detect submodules in `modules/` directory
   - ❌ No separate submodule publishing (submodules are part of parent module)

3. **Module Verification:**
   - ✅ Same as Terraform Enterprise (admin-verified modules)
   - ❌ No partner modules program

4. **Public vs Private Modules:**
   - ✅ Start with organization-scoped (private)
   - ⏭️ Public module support (future enhancement)

5. **Version Constraints:**
   - ✅ Strict semantic versioning (required)
   - ❌ No pre-release versions (like TFE - only `MAJOR.MINOR.PATCH`)

6. **Module Dependencies:**
   - ✅ Track required providers
   - ⏭️ Module-to-module dependencies (future enhancement)

7. **Provider Support:**
   - ✅ Full provider registry support (like TFE)
   - ✅ Multi-platform support (OS/Arch)
   - ✅ SHA256 checksum validation

8. **Storage:**
   - ✅ MinIO as default (portable, self-hosted)
   - ✅ Storage abstraction layer (easy backend swapping)
   - ✅ S3-compatible API (works with AWS S3, MinIO, etc.)

9. **Versioning Model:**
   - ✅ Registry-managed versions
   - ✅ **VCS webhook-driven auto-publishing** (push Git tag → auto-publish version)
   - ✅ Direct version publishing (manual upload → version available immediately)
   - ✅ TFE-compatible (Terraform CLI automatically discovers latest)

10. **VCS Integration:**
   - ✅ Module creation with VCS connection (like workspace creation)
   - ✅ Repository selection from connected VCS providers
   - ✅ Automatic webhook creation for tag push events
   - ✅ Webhook-driven version publishing (like TFE)
   - ✅ Reuses existing `VCSConnection` infrastructure

---

## UI/UX Design

### Registry Main Page
The registry main page follows Terraform Cloud's design patterns:

- **Breadcrumb Navigation**: Shows organization path (e.g., `mikevh / Registry / Modules`)
- **Search Bar**: Filter providers and modules with real-time search
- **Tabs**: Switch between "Modules" and "Providers"
- **Publish Button**: Dropdown to publish new modules or providers
- **Left Sidebar Filters**:
  - Publishing Type: All, Git Tag based, Manual upload
  - Tags filter checkbox
- **Module Cards**: Display modules in card format with:
  - Module name and description
  - Badges: Private, Provider, Version, Git Tag based, Published time
  - Download count
  - Click to navigate to module detail

### Module Detail Page
The module detail page provides comprehensive information:

- **Breadcrumb Navigation**: Full path including version
- **Module Header**:
  - Module name with badges (Private, Tag-Based)
  - Description
  - Metadata: Published by, Provider, Version selector, Published date, Source repository
- **Content Tabs**:
  - **Readme**: Rendered README content
  - **Inputs**: Required and optional inputs with descriptions and types
  - **Outputs**: Module outputs with descriptions
  - **Dependencies**: Required providers and versions
  - **Resources**: Resource types used in the module
- **Right Sidebar**:
  - Action button: "Manage Module for Organization" (opens dialog with delete options)
  - Usage Instructions: Terraform configuration example with copy button
  - CLI credentials configuration
- **Module Management Dialog**:
  - Delete Current Module: Permanently delete the current module and all its versions
  - Delete All Modules: Permanently delete all modules in the organization
  - Both actions include confirmation dialogs and cannot be undone

### Color Scheme
The UI uses a blue/purple gradient color scheme:
- Primary: Blue to Indigo to Purple gradients
- Badges: Blue, Indigo, Purple, Green (for status)
- Empty states: Blue/Indigo/Purple gradient backgrounds with matching icons

### Empty States
Empty states follow a consistent design pattern:
- Centered card with gradient background
- Large icon in a rounded container with gradient border
- Title and description text
- Call-to-action button with gradient background

## Next Steps

1. ✅ **Review this document** - Complete
2. ✅ **Create database models** - Complete (`Module`, `ModuleVersion`, `ModuleDownload`, `Provider`, `ProviderVersion`, `ProviderPlatform`, `ProviderDownload`)
3. ✅ **Implement storage abstraction layer** - Complete (MinIO interface)
4. ✅ **Implement service discovery** - Complete (modules.v1 + providers.v1)
5. ✅ **Implement module listing** - Complete (listing, search, versions)
6. ✅ **Build module parser** - Complete (full HCL parsing for metadata extraction)
7. ✅ **Implement module publishing** - Complete:
   - ✅ VCS-connected module creation (with webhook setup)
   - ✅ Webhook handler for tag push events (auto-publish)
   - ✅ Manual tarball upload
   - ✅ Auto-detection of module name and provider from repository name (Terraform naming convention)
   - ✅ Card-based VCS connection selector (similar to Terraform Cloud)
   - ✅ Deduplication of VCS connections to prevent duplicates in UI
8. ✅ **Implement provider registry** - Complete (listing, publishing, download)
9. ✅ **Implement download endpoints** - Complete (MinIO presigned URLs)
10. ✅ **Add frontend UI** - Complete:
    - ✅ "Add New Module" dialog (VCS connection + repository selection)
      - Card-based VCS connection selector (similar to Terraform Cloud)
      - Auto-detection of module name and provider from repository name
      - Manual override capability for name and provider
      - Deduplication of VCS connections
    - ✅ Module browser and detail pages
    - ✅ Provider browser and publishing forms

**Remaining Optional Enhancements:**
- Download statistics dashboard (UI for viewing analytics)
- Webhook signature validation (enhanced security)
- Direct S3/MinIO upload registration (for CI/CD pipelines)
- Module-to-module dependencies tracking
- Public module support (cross-organization sharing)

---

## Refinements & Fixes

### Module Management & UI Improvements ✅

**Changes Made:**
1. **Removed "Open in Designer" Button**: The "Open in Designer" button has been removed from the module detail page sidebar.
2. **Removed File Paths from Inputs**: File paths (e.g., `/tmp/module-clone-4228390942/variables.tf:2,17-23`) are no longer displayed in the inputs section. The parser now extracts the actual type name instead of the file range.
3. **Module Management Dialog**: Added a "Manage Module for Organization" dialog with two options:
   - **Delete Current Module**: Permanently deletes the current module and all its versions (with confirmation)
   - **Delete All Modules**: Permanently deletes all modules in the organization (with confirmation)
4. **Backend Delete Endpoints**: Added two new DELETE endpoints:
   - `DELETE /api/v2/organizations/:name/registry/modules/:module_name/:provider` - Delete specific module
   - `DELETE /api/v2/organizations/:name/registry/modules` - Delete all modules in organization

**Files Changed:**
- `frontend/src/pages/Registry/ModuleDetail.tsx` - Removed "Open in Designer" button, added manage dialog
- `frontend/src/api/client.ts` - Added `delete` and `deleteAll` methods to `registryApi.modules`
- `backend/internal/api/v2/handlers/registry_publishing.go` - Added `DeleteModule` and `DeleteAllModules` handlers
- `backend/internal/api/v2/routes/routes.go` - Added DELETE routes for modules
- `backend/internal/services/registry/parser.go` - Fixed type extraction to remove file paths

### Frontend Fixes ✅

**Issue**: Registry page showed "Please select an organization" when accessed from `/registry` route.

**Fix**: 
- Updated `Registry.tsx` to automatically redirect to first organization's registry if no `organizationName` is in URL
- Added organization selector dropdown when multiple organizations exist
- Improved loading states and error handling

**Files Changed**:
- `frontend/src/pages/Registry.tsx` - Added organization loading and auto-redirect logic

### VCS Connection UI Refinements ✅

**Issue**: Duplicate VCS connections appearing in UI, and need for better UX matching Terraform Cloud.

**Fixes**:
1. **Deduplication**: Added deduplication logic when loading VCS connections using `Map` with connection ID as key
   - Applied in API client (`frontend/src/api/client.ts`) to deduplicate at the source
   - Also applied in components as a safety measure
2. **Card-Based UI**: Replaced dropdown with card-based selection interface (similar to Terraform Cloud)
3. **Auto-Detection**: Added automatic detection of module name and provider from repository name following Terraform naming convention
4. **Searchable Repository Selector**: Added search/filter functionality to repository dropdown for easier selection in large lists

**Auto-Detection Details**:
- Parses repository names matching pattern: `terraform-<PROVIDER>-<NAME>`
- Examples:
  - `terraform-azurerm-aks` → Provider: `azurerm`, Name: `aks`
  - `terraform-aws-vpc` → Provider: `aws`, Name: `vpc`
- Works with full repository paths (e.g., `owner/terraform-azurerm-aks`)
- Only auto-fills if fields are empty (allows manual override)
- If repository name doesn't follow convention, fields remain empty for manual entry

**Repository Search**:
- Added search input field in repository selector dropdown
- Filters repositories in real-time as user types
- Case-insensitive search matching repository full names
- Shows "No repositories found" message when search yields no results

**Files Changed**:
- `frontend/src/components/registry/CreateModuleDialog.tsx` - Added deduplication, card-based UI, auto-detection, and searchable repository selector
- `frontend/src/components/workspace/CreateWorkspaceDialog.tsx` - Added deduplication and card-based UI
- `frontend/src/pages/Settings/VCSConnections.tsx` - Added deduplication
- `frontend/src/api/client.ts` - Added deduplication in API client layer

### MinIO Storage Configuration ✅

**Issue**: MinIO container was running but not configured in API environment variables, preventing module version publishing.

**Fix**: Added MinIO environment variables to `deploy/docker-compose.yml`:
```yaml
# MinIO/Storage Configuration for Registry
- STORAGE_BACKEND=minio
- STORAGE_BUCKET=terraform-registry
- MINIO_ENDPOINT=localhost:9000
- MINIO_ACCESS_KEY=minioadmin
- MINIO_SECRET_KEY=minioadmin
- MINIO_USE_SSL=false
```

**Configuration Details**:
- Uses existing MinIO container (`iac-minio`) running on `localhost:9000`
- Default credentials: `minioadmin`/`minioadmin`
- Bucket: `terraform-registry` (auto-created if it doesn't exist)
- Storage backend abstraction allows easy switching to S3 or other backends

**Note**: After adding these environment variables, the API service must be restarted for changes to take effect:
```bash
docker compose restart api
```

**Files Changed**:
- `deploy/docker-compose.yml` - Added MinIO environment variables to API service

### Testing Infrastructure ✅

**Backend Integration Tests**:
- Created `backend/internal/api/v2/handlers/registry_modules_test.go` with comprehensive tests:
  - `TestListModules` - Verifies module listing endpoint
  - `TestGetModuleVersions` - Verifies version listing and sorting
  - `TestPublishModuleVersion` - Verifies module version publishing
- Created `backend/internal/services/registry/mock_storage.go` - In-memory storage for testing
- Tests use Postgres test database (via `TEST_DATABASE_URL` environment variable)
- Tests are designed to be accurate and avoid false positives

**Test Execution**:
```bash
# Set test database URL
export TEST_DATABASE_URL="postgres://user:pass@localhost/test_db?sslmode=disable"

# Run tests
go test -v ./internal/api/v2/handlers -run TestListModules
go test -v ./internal/api/v2/handlers -run TestGetModuleVersions
go test -v ./internal/api/v2/handlers -run TestPublishModuleVersion
```

**CI Integration**:
- Tests can be run in CI/CD pipelines with a test database container
- Tests skip automatically if `TEST_DATABASE_URL` is not set (for local development)
- All tests include proper cleanup to avoid test pollution

---

## References

- [HashiCorp Registry API Documentation](https://developer.hashicorp.com/terraform/registry/api-docs)
- [Terraform Module Registry Protocol](https://developer.hashicorp.com/terraform/internals/module-registry-protocol)
- [Terraform Service Discovery](https://developer.hashicorp.com/terraform/internals/remote-service-discovery)
- [Terraform Enterprise Private Module Registry](https://www.terraform.io/docs/cloud/registry/index.html)

