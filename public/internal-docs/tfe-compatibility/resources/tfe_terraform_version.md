<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# tfe_terraform_version

**Status**: Implemented

## Overview

Manages the set of Terraform versions available for use in the platform. This is the TFE Admin API for Terraform version management — site administrators use it to control which versions workspaces can use.

Access is restricted to users in an "owners" team (site admins). Non-admin users receive a 404 response, matching TFE behavior.

## Version Resolution

When running Terraform, the version is resolved in this order:

1. **Workspace `terraform-version`** — if set on the workspace, always used
2. **Organization `default-terraform-version`** — org-wide fallback
3. **Error** — if neither is set, the run fails with a clear error

There is no hardcoded default version. The platform is designed to support switching to OpenTofu in the future.

## Attributes

| TFE Attribute | StackWeaver | Notes |
|--------------|-------------|-------|
| `version` | Implemented | Semantic version string (e.g. `"1.13.0"`) |
| `url` | Implemented | Download URL for the Linux amd64 binary |
| `sha` | Implemented | SHA-256 checksum |
| `deprecated` | Implemented | Boolean |
| `deprecated-reason` | Implemented | String pointer. Omitted from response when nil OR empty string (go-tfe uses `*string` with `omitempty`; provider sends `""` even when unset, so backend treats `""` as nil to prevent "inconsistent result" errors) |
| `official` | Implemented | Boolean, set for auto-seeded versions |
| `enabled` | Implemented | Boolean, controls availability for workspaces |
| `beta` | Implemented | Boolean |
| `usage` | Implemented | Count of workspaces using this version |
| `created-at` | Implemented | ISO 8601 timestamp |
| `archs` | Implemented | Array with `url`, `sha`, `os`, `arch` per architecture |

## API Compatibility

### Endpoints

| Method | Endpoint | Status | Auth |
|--------|----------|--------|------|
| `GET` | `/api/v2/admin/terraform-versions` | Implemented | Admin only (owners team) |
| `POST` | `/api/v2/admin/terraform-versions` | Implemented | Admin only |
| `GET` | `/api/v2/admin/terraform-versions/:id` | Implemented | Admin only |
| `PATCH` | `/api/v2/admin/terraform-versions/:id` | Implemented | Admin only |
| `DELETE` | `/api/v2/admin/terraform-versions/:id` | Implemented | Admin only |

### Query Parameters (List)

| Parameter | Status | Notes |
|-----------|--------|-------|
| `filter[version]` | Implemented | Exact version match |
| `search[version]` | Implemented | Partial version search |
| `page[number]` | Implemented | Pagination |
| `page[size]` | Implemented | Pagination (default 20, max 100) |

### JSON:API Format

- **Type**: `terraform-versions`
- **ID Prefix**: `tool-` (e.g. `tool-abc123def456ghij`)
- **Response**: Standard JSON:API envelope with `data`, `meta.pagination`

## StackWeaver Implementation

**Model**: See `TerraformVersion` struct in `backend/internal/models/terraform_version.go`
**Handler**: See `AdminTerraformVersionsHandler` in `backend/internal/api/v2/handlers/admin_terraform_versions.go`
**Routes**: See `backend/internal/api/v2/routes/routes.go` — admin routes group
**Frontend**: See `frontend/src/pages/Settings/TerraformVersions.tsx`

### Access Control

The `requireAdmin()` method checks that the authenticated user is in an "owners" team of any organization. Non-admin users receive a 404 (matching TFE behavior of hiding admin endpoints).

### Organization Default Version

Organizations have a `default_terraform_version` field (see `backend/internal/models/organization.go`). This can be set via the organization update API (`PATCH /api/v2/organizations/:name`) using the `default-terraform-version` attribute, or via the frontend Terraform Versions settings page.

### Auto-Seeding

On platform startup, StackWeaver automatically seeds the database with official Terraform versions (1.5.x through 1.13.x). See `OfficialTerraformVersions` in `backend/internal/models/terraform_version.go` and `SeedOfficialVersions()` in the handler.

### Workspace Integration

When a workspace is created or updated with a `terraform-version`, the handler validates that the version exists in the `terraform_versions` table and is enabled. If no version is specified, the organization's `default_terraform_version` is used. If neither is set, the workspace is created without a version (runs will fail until one is configured).

The runner (both platform-hosted and self-hosted) uses the exact version resolved for the workspace. If the binary isn't installed locally, it is downloaded automatically from `releases.hashicorp.com`. There is no fallback to a different version.

### Frontend UI

Available at **Organization Settings > Terraform Versions** (`/app/:orgName/settings/terraform-versions`). Features:

- Table of all available versions with enable/disable toggles
- "Org Default" badge on the organization's default version
- Dropdown to set the organization default version
- Add new custom versions
- Delete non-official versions (official versions and versions in use are protected)
- Search/filter and pagination
- Admin-only visibility (settings card hidden for non-admin users)

## go-tfe Client

**Interface**: `AdminTerraformVersions` in `go-tfe/admin_terraform_version.go`
**Methods**: `List`, `Read`, `Create`, `Update`, `Delete`

## Example HCL

```hcl
resource "tfe_terraform_version" "custom" {
  version  = "1.13.0"
  url      = "https://releases.hashicorp.com/terraform/1.13.0/terraform_1.13.0_linux_amd64.zip"
  sha      = "abc123..."
  official = false
  enabled  = true
  beta     = false
}
```

## Testing

Add to `stackweaver-tests/tfe-tests/` to verify:

```hcl
# List existing versions
data "tfe_terraform_version" "latest" {
  version = "1.13.0"
}

# Create a custom version
resource "tfe_terraform_version" "custom" {
  version  = "1.14.0-beta1"
  url      = "https://releases.hashicorp.com/terraform/1.14.0-beta1/terraform_1.14.0-beta1_linux_amd64.zip"
  sha      = "..."
  official = false
  enabled  = true
  beta     = true
}
```

## Delete Constraints

- Official versions cannot be deleted (matches TFE behavior)
- Versions in use by workspaces cannot be deleted
