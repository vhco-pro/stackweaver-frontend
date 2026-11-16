---
icon: vault
title: "Vault"
nav_order: 4
description: "Let OpenTofu runs log in to HashiCorp Vault without a stored token: a JWT auth role bound to the run's subject."
covers:
  - "backend/internal/executor/identity/vault_oidc.go"
  - "backend/internal/api/v2/handlers/vault_oidc_configuration.go"
  - "backend/internal/api/v2/handlers/oidc_configuration_dispatch.go"
---

# Configure workload identity for Vault

HashiCorp Vault differs from the cloud providers: instead of the provider exchanging a token, the
**job's process logs in to Vault** via the JWT auth method and exports a `VAULT_TOKEN` for the run. Point the
Vault JWT auth method at Stackweaver as an OIDC issuer, then register the config. The token audience is
`vault.workload.identity`. Check [the prerequisites](./README.md#before-you-start) first.

## Step 1: Enable and Configure the JWT Auth Method

```bash
vault auth enable jwt

# Trust Stackweaver's JWKS (or use oidc_discovery_url with the issuer for full discovery).
vault write auth/jwt/config \
  jwks_url="https://stackweaver.example.com/.well-known/jwks"
```

## Step 2: Create a Role Bound to the Run

Save this role definition as `stackweaver-vault-role.json`. Replace the organization/project/workspace names and policy. Both [subjects](./token-subjects.md) are listed because the registration below selects one role for both phases:

```json
{
  "role_type": "jwt",
  "bound_audiences": ["vault.workload.identity"],
  "user_claim": "sub",
  "bound_claims": {
    "sub": [
      "organization:main:project:infra:workspace:production:run_phase:plan",
      "organization:main:project:infra:workspace:production:run_phase:apply"
    ]
  },
  "token_policies": ["my-policy"],
  "token_ttl": "20m"
}
```

```bash
vault write auth/jwt/role/stackweaver @stackweaver-vault-role.json
```

The [Vault JWT role schema](https://developer.hashicorp.com/vault/api-docs/auth/jwt#bound_claims) accepts a list of allowed values for a bound claim. This example grants the same policy to both phases; do not assume separate phase-specific roles are selected automatically. Review the policy so plan has only the access you intend to grant.

## Step 3: Register Vault in Stackweaver

```hcl
resource "stackweaver_vault_oidc_configuration" "main" {
  organization = "your-org-name"
  address      = "https://vault.example.com:8200"
  role_name    = "stackweaver"
  namespace    = "admin" # required by the provider; any value for Vault OSS (sent as X-Vault-Namespace)
  auth_path    = "jwt"   # optional, defaults to "jwt"
  # encoded_cacert = filebase64("vault-ca.pem")  # optional, for a private Vault CA
}
```

After apply, confirm the registration exists and its returned identifiers match the intended target before starting a run. To register through the API instead, send a `vault-oidc-configurations` body to the endpoint shown in the [Azure API example](./azure.md#register-through-the-api); [the API explorer](/docs/api-reference/explorer) has the schema.

## Step 4: Use the vault Provider in Your Workspaces

No provider block credentials are required - the job's process logs in to Vault before the run and exports the
token. The `vault` provider (and any provider reading `VAULT_*`) picks it up automatically:

| Variable | Description |
|----------|-------------|
| `VAULT_ADDR` | The `address` you registered |
| `VAULT_TOKEN` | The client token from the JWT-auth login |
| `VAULT_NAMESPACE` | The `namespace` you registered (when set) |
| `VAULT_CACERT` | Path to the CA cert file (when `encoded_cacert` is set) |

## Verify a workload

Use a test workspace and review a plan with the intended identity. Check that Vault accepts the issuer, exact subject and audience and that the role's policy permits the required read operations. A saved registration alone does not prove the login or the policy work.

If the login fails, see [Troubleshooting](./troubleshooting.md).
