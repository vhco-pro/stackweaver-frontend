<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# tfe_azure_oidc_configuration

**TFE Registry**: https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/azure_oidc_configuration

**Status**: Implemented

## Overview

Manages Azure OIDC configurations for keyless authentication from Terraform runs to Azure. This enables workspaces to authenticate with Azure using OpenID Connect (OIDC) instead of storing static credentials.

## Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `client_id` | string | `client_id` | Implemented | Azure Entra ID application/client ID |
| `subscription_id` | string | `subscription_id` | Implemented | Azure subscription ID |
| `tenant_id` | string | `tenant_id` | Implemented | Azure Entra ID tenant/directory ID |
| `organization` | string | via org lookup | Implemented | RequiresReplace in TFE provider |

## Computed Attributes

| Attribute | TFE Type | StackWeaver | Status | Notes |
|-----------|----------|-------------|--------|-------|
| `id` | string | `id` (`azoidc-` prefix) | Implemented | Format: `azoidc-{16-char-alphanumeric}` |

## API Endpoints

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/v2/organizations/:org/oidc-configurations` | POST | Implemented | Create config |
| `/api/v2/organizations/:org/oidc-configurations` | GET | Implemented | List configs for org |
| `/api/v2/oidc-configurations/:id` | GET | Implemented | Read config |
| `/api/v2/oidc-configurations/:id` | PATCH | Implemented | Partial update |
| `/api/v2/oidc-configurations/:id` | DELETE | Implemented | Delete config |
| `/.well-known/openid-configuration` | GET | Implemented | OIDC Discovery (unauthenticated) |
| `/.well-known/jwks` | GET | Implemented | JWKS public key (unauthenticated) |

## JSON:API Details

- **Type**: `azure-oidc-configurations`
- **Attribute names**: kebab-case (`client-id`, `subscription-id`, `tenant-id`)
- **Relationships**: `organization` (back-reference with org name as ID)
- **Links**: `self` pointing to `/api/v2/oidc-configurations/:id`

## Shared Route Pattern

Read/Update/Delete use the shared `oidc-configurations/:id` path. The same pattern is used across all OIDC providers (Azure, AWS, GCP, Vault) — the handler differentiates by the ID prefix:
- `azoidc-` — Azure
- `awsoidc-` — AWS (not yet implemented)
- `gcpoidc-` — GCP (not yet implemented)
- `vaultoidc-` — Vault (not yet implemented)

## RBAC

- **Create/Update/Delete**: Requires `manage-vcs-settings` org-level permission (owners always have this)
- **Read**: Requires `manage-vcs-settings` org-level permission

## Example TFE Usage

```hcl
resource "tfe_azure_oidc_configuration" "example" {
  organization    = "my-org"
  client_id       = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  subscription_id = "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
  tenant_id       = "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz"
}
```

## go-tfe Reference

Source: `go-tfe/azure_oidc_configuration.go`

The go-tfe client implements the `AzureOIDCConfigurations` interface with Create, Read, Update, and Delete methods. Create is org-scoped, while Read/Update/Delete use the shared `OIDCConfigPathFormat = "oidc-configurations/%s"`.

## Implementation Files

| File | Description |
|------|-------------|
| `backend/pkg/id/generator.go` | `GenerateAzureOIDCConfigID()` |
| `backend/internal/models/azure_oidc_configuration.go` | GORM model |
| `backend/internal/repository/azure_oidc_configuration.go` | CRUD repository |
| `backend/internal/api/v2/handlers/azure_oidc_configuration.go` | JSON:API handler (CRUD + List) |
| `backend/internal/api/v2/handlers/oidc_well_known.go` | OIDC discovery endpoints |
| `backend/internal/services/oidc/signing_key.go` | RSA key pair management |
| `backend/internal/services/oidc/token.go` | JWT token generation |
| `backend/cmd/runner/main.go` | OIDC token injection into terraform runs |
| `frontend/src/api/client.ts` | `azureOIDCConfigApi` |
| `frontend/src/pages/Settings/OIDCConfigurations.tsx` | Settings UI page |
| `backend/internal/api/v2/handlers/azure_oidc_configuration.go` | HTTP handler |
| `backend/internal/api/v2/routes/routes.go` | Route registration |
| `backend/internal/api/v2/handlers/azure_oidc_configuration_test.go` | Tests |
