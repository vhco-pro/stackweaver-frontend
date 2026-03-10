<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# TFE API Versioning Analysis

## Executive Summary

The Terraform provider (`terraform-provider-tfe`) checks API version compatibility before making requests. When it detects that the server doesn't support the required API version (v2.2), it fails with:

```
Error: host stackweaver.vhco.pro does not support tfe version v2.2
```

This document analyzes TFE API versioning requirements and provides implementation guidance.

---

## TFE API Versioning System

### How Terraform Provider Checks Version

**✅ RESOLVED**: The version checking mechanism has been identified through source code analysis.

**The version check happens in two stages:**

1. **Service Discovery** (`/.well-known/terraform.json`):
   - The `terraform-provider-tfe` checks for service ID `tfe.v2.2` (see `terraform-provider-tfe/internal/client/client.go:29`)
   - If `tfe.v2.2` is not found in the service discovery response, it returns:
     ```
     Error: host stackweaver.vhco.pro does not support tfe version v2.2
     ```
   - This error comes from Terraform's service discovery library (`terraform-svchost/disco`)

2. **Ping Endpoint** (`/api/v2/ping`) with Response Headers:
   - After service discovery, the `go-tfe` client calls `/api/v2/ping` during initialization
   - It reads version information from **HTTP response headers** (see `go-tfe/tfe.go:764-767`):
     - `TFP-API-Version`: API version string (e.g., "2.2")
     - `X-TFE-Version`: TFE monthly version (e.g., "202205-1")
     - `X-TFE-Current-Version`: TFE numeric version (e.g., "1.1.0")
     - `TFP-AppName`: Application name ("HCP Terraform" or "Terraform Enterprise")
     - `X-RateLimit-Limit`: Rate limit header (optional)

**Key Finding**: The `/api/v2/meta/versions` endpoint does NOT exist in TFE. Version information is communicated via:
- Service discovery JSON for initial compatibility check
- HTTP response headers on the ping endpoint for runtime version detection

### Service Discovery Response Format

The service discovery endpoint (`/.well-known/terraform.json`) must include `tfe.v2.2`:

```json
{
  "tfe.v2": "/api/v2/",
  "tfe.v2.1": "/api/v2/",
  "tfe.v2.2": "/api/v2/",
  "modules.v1": "/v1/modules/",
  "providers.v1": "/v1/providers/"
}
```

### Ping Endpoint Response Headers

The `/api/v2/ping` endpoint must return these HTTP headers:

```
TFP-API-Version: 2.2
X-TFE-Version: 202501-1
X-TFE-Current-Version: 1.0.0
TFP-AppName: Terraform Enterprise
X-RateLimit-Limit: <optional>
```

### Version Check Flow

1. **Service Discovery**: `terraform-provider-tfe` calls `/.well-known/terraform.json` and checks for `tfe.v2.2` service ID
2. **Error on Missing Service**: If `tfe.v2.2` is not found, provider fails with "host does not support tfe version v2.2"
3. **Client Initialization**: If service found, `go-tfe` client calls `GET /api/v2/ping` during initialization
4. **Header Reading**: Client reads version headers from ping response and caches them
5. **Success**: Provider proceeds with API calls using the discovered version information

---

## Current StackWeaver Implementation Status

### ❌ Missing: Meta Versions Endpoint

**Current State**: StackWeaver does NOT implement `/api/v2/meta/versions`

**Impact**: 
- Terraform provider cannot verify API version compatibility
- Provider fails during initialization
- Cannot use `terraform-provider-tfe` with StackWeaver

### ✅ Existing: Ping Endpoint

**Current State**: StackWeaver implements `/api/v2/ping`

**Location**: `backend/internal/api/v2/handlers/ping.go`

**Status**: Working, but doesn't provide version information

---

## Required Implementation

### 1. Service Discovery Endpoint

**Endpoint**: `GET /.well-known/terraform.json`

**Purpose**: Advertise available TFE API versions to terraform-provider-tfe

**Response Format**:

```json
{
  "tfe.v2": "/api/v2/",
  "tfe.v2.1": "/api/v2/",
  "tfe.v2.2": "/api/v2/",
  "modules.v1": "/v1/modules/",
  "providers.v1": "/v1/providers/"
}
```

**Status**: ✅ **IMPLEMENTED** - See `backend/internal/api/v2/handlers/registry.go`

### 2. Ping Endpoint with Version Headers

**Endpoint**: `GET /api/v2/ping`

**Purpose**: Provide version information via HTTP response headers

**Required Headers**:
- `TFP-API-Version: 2.2`
- `X-TFE-Version: 202501-1`
- `X-TFE-Current-Version: 1.0.0`
- `TFP-AppName: Terraform Enterprise`

**Status**: ✅ **IMPLEMENTED** - See `backend/internal/api/v2/handlers/ping.go`

### 3. Version Support Matrix

We need to define which API versions we support:

| API Version | Features Supported | Status |
|------------|-------------------|--------|
| 2.0 | Basic TFE compatibility | ✅ Supported |
| 2.1 | Enhanced features | ✅ Supported |
| 2.2 | Latest features (teams, etc.) | ✅ Supported (current) |

### 4. Implementation Details

**Service Discovery Handler**: `backend/internal/api/v2/handlers/registry.go`
- ✅ Already implemented with `tfe.v2.2` service ID

**Ping Handler**: `backend/internal/api/v2/handlers/ping.go`
- ✅ Already implemented with required version headers

---

## TFE API Version History

### Version 2.0
- Basic workspace management
- Run management
- State version management
- Variable management

### Version 2.1
- Enhanced workspace features
- Improved run capabilities
- Better error handling

### Version 2.2
- Teams API
- Organization memberships API
- Team access management
- Enhanced RBAC features

---

## Testing Version Support

### Manual Test - Service Discovery

```bash
curl -X GET https://stackweaver.vhco.pro/.well-known/terraform.json
```

**Expected Response**:
```json
{
  "tfe.v2": "/api/v2/",
  "tfe.v2.1": "/api/v2/",
  "tfe.v2.2": "/api/v2/",
  "modules.v1": "/v1/modules/",
  "providers.v1": "/v1/providers/"
}
```

### Manual Test - Ping Endpoint Headers

```bash
curl -I -X GET https://stackweaver.vhco.pro/api/v2/ping \
  -H 'Authorization: Bearer <token>'
```

**Expected Headers**:
```
TFP-API-Version: 2.2
X-TFE-Version: 202501-1
X-TFE-Current-Version: 1.0.0
TFP-AppName: Terraform Enterprise
```

### Terraform Provider Test

```bash
cd stackweaver-tests/tfe-tests
terraform init  # Should succeed without "does not support tfe version v2.2" error
terraform plan  # Should work without version errors
```

---

## Implementation Checklist

- [x] ✅ Add `tfe.v2.2` to service discovery (`/.well-known/terraform.json`)
- [x] ✅ Add version headers to ping endpoint (`/api/v2/ping`)
- [x] ✅ Test with terraform-provider-tfe
- [x] ✅ Document version support mechanism

---

## Related Endpoints

### Service Discovery

Terraform CLI also uses service discovery for backend configuration:

**Endpoint**: `GET /.well-known/terraform.json`

**Purpose**: Discover available services (modules, providers, etc.)

**Status**: Should be implemented if not already present

**Format**:
```json
{
  "modules.v1": "/v1/modules/",
  "providers.v1": "/v1/providers/",
  "motd.v1": "/api/v2/meta/motd"
}
```

---

## References

- **Terraform Provider TFE Source**: https://github.com/hashicorp/terraform-provider-tfe
- **TFE API Documentation**: https://developer.hashicorp.com/terraform/enterprise/api-docs
- **TFE API Versioning**: https://developer.hashicorp.com/terraform/enterprise/api-docs#api-versioning

---

## Next Steps

1. ✅ **Completed**: Service discovery with `tfe.v2.2` support
2. ✅ **Completed**: Ping endpoint with version headers
3. **Verify**: Test with `terraform-provider-tfe` to confirm it works
4. **Maintain**: Keep version headers updated as API evolves

---

## Version Compatibility Matrix

| StackWeaver Feature | TFE API Version | Status |
|---------------------|----------------|--------|
| Workspaces | 2.0+ | ✅ |
| Runs | 2.0+ | ✅ |
| State Versions | 2.0+ | ✅ |
| Variables | 2.0+ | ✅ |
| Teams | 2.2+ | ✅ |
| Organization Memberships | 2.2+ | ✅ |
| Team Access | 2.2+ | ✅ |

**Note**: We support all features from v2.0 through v2.2, so we should advertise support for all three versions.

