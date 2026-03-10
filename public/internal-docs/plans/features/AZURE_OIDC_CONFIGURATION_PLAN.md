<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Plan: TFE-Compatible Azure OIDC Workload Identity

**Status:** Implemented and tested end-to-end (Settings UI, TFE API, runner token injection, Azure federated credential flow with Terraform AzureRM provider).

TODO: we need to figure out a better way to auto generate the OIDC RSA key and put it in oidc.env in a hands off way because the components need it or they will generate double keys and not work

## Goal

Implement full Azure OIDC workload identity support so Terraform runs can authenticate to Azure without static credentials. This includes:
1. TFE-compatible CRUD API for Azure OIDC configuration (done)
2. OIDC Identity Provider — signing key, discovery endpoints, JWT token issuance
3. Token injection into Terraform runs via environment variables
4. Frontend settings UI to manage OIDC configurations

## Architecture Overview

```
User configures Azure OIDC via TFE provider or Settings UI
    ↓
API stores config (client_id, subscription_id, tenant_id) per org
    ↓
During a run, runner looks up org's OIDC config
    ↓
Runner generates short-lived JWT (workload identity token)
    - Signed with platform's RSA private key
    - Claims: sub, aud, iss, org, workspace, project, run_id, run_phase
    ↓
Runner injects env vars into terraform process:
    - TFC_WORKLOAD_IDENTITY_TOKEN (the JWT)
    - ARM_CLIENT_ID, ARM_SUBSCRIPTION_ID, ARM_TENANT_ID
    - ARM_USE_OIDC=true
    ↓
Azure AD validates JWT via /.well-known/openid-configuration + JWKS
    ↓
Terraform AzureRM provider authenticates via OIDC federation
```

## Phase 1: CRUD API (DONE)

### API Contract (from go-tfe)

**Source of truth:** `go-tfe/azure_oidc_configuration.go`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v2/organizations/{organization}/oidc-configurations` | Create Azure OIDC config |
| GET | `/api/v2/organizations/{organization}/oidc-configurations` | List configs (for UI) |
| GET | `/api/v2/oidc-configurations/{id}` | Read configuration |
| PATCH | `/api/v2/oidc-configurations/{id}` | Update configuration |
| DELETE | `/api/v2/oidc-configurations/{id}` | Delete configuration |

**JSON:API type:** `azure-oidc-configurations`
**ID format:** `azoidc-{16-char-alphanumeric}`

### Files (implemented)

| File | Status |
|------|--------|
| `backend/pkg/id/generator.go` | Done — `GenerateAzureOIDCConfigID()` |
| `backend/internal/models/azure_oidc_configuration.go` | Done |
| `backend/internal/repository/azure_oidc_configuration.go` | Done |
| `backend/internal/api/v2/handlers/azure_oidc_configuration.go` | Done |
| `backend/internal/api/v2/routes/routes.go` | Done — 5 routes (CRUD + List) |
| `backend/internal/api/v2/handlers/azure_oidc_configuration_test.go` | Done |

## Phase 2: OIDC Identity Provider (DONE)

Stackweaver must act as an OIDC Identity Provider (IdP) so Azure AD can validate the workload identity tokens.

### Step 2.1: RSA Signing Key Management

**File:** `backend/internal/services/oidc/signing_key.go` (new)

- Generate an RSA-2048 key pair on first startup
- Store in env var `OIDC_SIGNING_KEY` (PEM-encoded private key) — simplest approach
- If not set, auto-generate and log a warning (dev mode)
- Expose the public key for JWKS endpoint
- Key ID (kid) derived from public key thumbprint

### Step 2.2: OIDC Discovery Endpoints (unauthenticated)

**File:** `backend/internal/api/v2/handlers/oidc_well_known.go` (new)

Two endpoints that Azure AD calls to validate tokens:

1. `GET /.well-known/openid-configuration` — OIDC discovery document
2. `GET /.well-known/jwks` — JSON Web Key Set

These go on the root router (not under `/api/v2/`) and require NO authentication.

### Step 2.3: Workload Identity Token Service

**File:** `backend/internal/services/oidc/token.go` (new)

Generate short-lived JWTs for Terraform runs with TFC-compatible claims:
- `sub`: `organization:{org}:project:{proj}:workspace:{ws}:run_phase:{phase}`
- `aud`: Azure client ID from OIDC config
- Custom claims: terraform_organization_name, terraform_project_name, etc.

## Phase 3: Runner Integration (DONE)

### Step 3.1: Inject OIDC token into Terraform runs

**File:** `backend/cmd/runner/main.go` — modify `processJob()`

After environment variables are resolved, look up org's OIDC config and inject:
- `TFC_WORKLOAD_IDENTITY_TOKEN` — the signed JWT
- `ARM_OIDC_TOKEN` — same JWT (AzureRM provider reads this)
- `ARM_CLIENT_ID`, `ARM_SUBSCRIPTION_ID`, `ARM_TENANT_ID`
- `ARM_USE_OIDC=true`

## Phase 4: Frontend Settings UI (DONE)

### Step 4.1: API Client (`frontend/src/api/client.ts`)

Add `azureOIDCApi` with list, create, get, update, delete methods.

### Step 4.2: Settings Page (`frontend/src/pages/Settings/OIDCConfigurations.tsx`)

Organization settings page at `/app/:orgName/settings/oidc`:
- List existing Azure OIDC configurations
- Create/edit/delete configurations
- Status indicator showing active connections

### Step 4.3: Route Registration (`Settings.tsx` + `App.tsx`)

## Azure Setup Requirements (User Documentation)

For the OIDC flow to work, the user must configure in Azure:
1. **App Registration** in Azure Entra ID
2. **Federated Identity Credential** — Issuer = Stackweaver URL, Subject = JWT sub claim
3. **Role Assignment** on subscription (e.g., Contributor)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OIDC_SIGNING_KEY` | No (auto-gen dev) | PEM-encoded RSA private key for signing JWTs |
| `OIDC_ISSUER_URL` | No (defaults to API URL) | Issuer URL for OIDC tokens (must match Azure federated credential) |

## Files Summary (Full Feature)

| File | Action | Phase |
|------|--------|-------|
| `backend/pkg/id/generator.go` | `GenerateAzureOIDCConfigID()` | 1 (done) |
| `backend/internal/models/azure_oidc_configuration.go` | GORM model | 1 (done) |
| `backend/internal/repository/azure_oidc_configuration.go` | CRUD repository | 1 (done) |
| `backend/internal/api/v2/handlers/azure_oidc_configuration.go` | CRUD + List handler | 1 (done) |
| `backend/internal/api/v2/routes/routes.go` | Routes | 1 (done) |
| `backend/internal/services/oidc/signing_key.go` | RSA key management | 2 (done) |
| `backend/internal/services/oidc/token.go` | JWT token generation | 2 (done) |
| `backend/internal/services/oidc/token_test.go` | Token service tests | 2 (done) |
| `backend/internal/api/v2/handlers/oidc_well_known.go` | Discovery endpoints | 2 (done) |
| `backend/cmd/runner/main.go` | Token injection | 3 (done) |
| `frontend/src/api/client.ts` | API client | 4 (done) |
| `frontend/src/pages/Settings/OIDCConfigurations.tsx` | Settings page | 4 (done) |
| `frontend/src/pages/Settings.tsx` | Nav entry | 4 (done) |
| `frontend/src/App.tsx` | Route registration | 4 (done) |

## Notes

- The go-tfe client uses a shared `OIDCConfigPathFormat = "oidc-configurations/%s"` for Read/Update/Delete across Azure, AWS, GCP, and Vault OIDC configs. All share the same URL pattern but use different JSON:API types.
- The OIDC signing key is shared across all OIDC configurations (Azure, AWS, GCP, Vault). It's a platform-level RSA key pair, not per-org.