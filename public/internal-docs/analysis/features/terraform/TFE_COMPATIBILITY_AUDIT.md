<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# TFE Compatibility Audit

## Summary

This document tracks the compatibility of our backend with the official Terraform Enterprise (TFE) API specification. The goal is 100% compatibility to allow "plug and play" migration from TFE to our solution.

## Endpoints Status

### ✅ Implemented Endpoints

#### 1. `/api/v2/organizations/:name/entitlement-set` ✅ IMPLEMENTED
- **Status**: Implemented
- **Method**: GET
- **Purpose**: Returns organization entitlements/features
- **Response Format**: JSON:API format
- **Location**: `backend/internal/api/v2/handlers/organizations.go:GetEntitlementSet`
- **Note**: Fixed duplicate `id` field in attributes (removed, kept only at top level)
- **Verification Needed**: Verify exact attribute names match TFE spec exactly

#### 2. `/api/v2/ping` ✅ IMPLEMENTED
- **Status**: Just implemented
- **Method**: GET
- **Purpose**: Health check endpoint
- **Response**: Plain text "pong" (matches TFE System API behavior)
- **Location**: `backend/internal/api/v2/handlers/ping.go`
- **Note**: TFE System API uses `/api/v1/ping`, but Terraform remote backend may call `/api/v2/ping`

## Critical Verification Needed

### 1. Entitlement-Set Response Format
**Current Implementation**: See `backend/internal/api/v2/handlers/organizations.go:GetEntitlementSet()`

**Response Structure**: JSON:API format with entitlement attributes. See handler implementation for current attribute list.

**Need to verify:**
- Are all attribute names correct? (kebab-case vs snake_case)
- Are all required attributes present?
- Are the data types correct? (boolean vs string, etc.)
- Are there any missing attributes that TFE returns?

**Reference**: `backend/internal/api/v2/handlers/organizations.go` - `GetEntitlementSet()` method

### 2. Ping Endpoint
**Current Implementation**: See `backend/internal/api/v2/handlers/ping.go`

**Current Behavior**:
- Returns plain text "pong" (200 OK)
- Requires authentication (via middleware)

**Need to verify:**
- Does Terraform remote backend actually call `/api/v2/ping` or `/api/v1/ping`?
- Should it require authentication or be public?
- Is plain text response correct, or should it be JSON?

**Reference**: `backend/internal/api/v2/handlers/ping.go` and route registration in `backend/internal/api/v2/routes/routes.go:54`

## Other Endpoints to Check

Based on Terraform remote backend initialization, we should verify:

1. **Service Discovery**: `/.well-known/terraform.json` ✅ Already implemented
2. **Organizations**: `/api/v2/organizations/:name` ✅ Already implemented
3. **Workspaces**: `/api/v2/organizations/:name/workspaces/:name` ✅ Already implemented
4. **State Versions**: `/api/v2/workspaces/:id/state-versions` ✅ Already implemented

## Next Steps

1. ✅ Find official TFE API documentation for entitlement-set endpoint
2. ⏳ Verify entitlement-set response format matches TFE spec exactly
3. ✅ Implement ping endpoint
4. ⏳ Test with actual `terraform init` to verify compatibility
5. ⏳ Check for any other missing endpoints by monitoring Terraform CLI logs
6. ⏳ Verify all response formats match JSON:API specification exactly

## Resources

- Official TFE API Documentation: https://developer.hashicorp.com/terraform/enterprise/api-docs
- terraform-provider-tfe Source: https://github.com/hashicorp/terraform-provider-tfe
- JSON:API Specification: https://jsonapi.org/format/

## Testing Checklist

- [ ] Test `terraform init` with remote backend configuration
- [ ] Verify all API calls succeed
- [ ] Check response formats match TFE exactly
- [ ] Verify authentication works correctly
- [ ] Test error responses match TFE format
- [ ] Verify pagination works if applicable

