<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# TFE Compatible API

To make sure we can easily integrate terraform into our API we need to use all the official resources we can get.

## References

- [Main API Docs](https://developer.hashicorp.com/terraform/enterprise/api-docs#api-documentation-overview)
- [API Changelog](https://developer.hashicorp.com/terraform/enterprise/api-docs/changelog)

## Implementation

For our TFE-compatible API implementation, see:
- **Backend API Reference**: `docs/api-reference/backend-api-reference.md`
- **Route Registration**: `backend/internal/api/v2/routes/routes.go`
- **Handler Implementations**: `backend/internal/api/v2/handlers/terraform/`

For compatibility audit and status, see `docs/Terraform/TFE_COMPATIBILITY_AUDIT.md`.

## ID Format

StackWeaver uses TFE-compatible prefixed IDs for all Terraform Enterprise resources. For detailed information about ID formats, see:

- **ID Format Documentation**: `docs/terraform/ID_FORMAT.md`

### Quick Reference

- **TFE Resources** (Workspaces, Runs, State Versions, Configuration Versions, Variables, Variable Sets): Use prefixed 16-character IDs (e.g., `ws-abc123...`, `run-xyz789...`)
- **StackWeaver Resources** (Organizations, Projects, Users): Use standard UUIDs (36 characters)

This ensures full compatibility with Terraform Enterprise providers and tooling while maintaining standard UUIDs for StackWeaver-specific resources.