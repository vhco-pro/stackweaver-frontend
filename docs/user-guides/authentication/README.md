---
description: "Index page for authentication guides covering Zitadel setup, custom domain, and SSO"
covers:
  - "scripts/zitadel-init/**"
  - "frontend/src/contexts/AuthContext*"
  - "frontend/src/pages/Login/**"
---

# Authentication

Stackweaver uses Zitadel for browser sign-in. Self-hosting operators configure the identity service; organization administrators can connect an external identity provider. API automation and cloud workload identity use separate credentials.

## Choose the right setup

| What are you connecting? | Start here |
|---|---|
| A new self-hosted installation. | [Initialize Zitadel](./zitadel-setup.md) with Docker Compose or Helm. |
| A public sign-in domain or a changed hostname. | [Configure the Zitadel domain](./zitadel-custom-domain.md). Keep the auth issuer and application login URL distinct. |
| Your team's existing identity provider. | [Configure SSO](../sso/README.md), then [map identity-provider groups to teams](../sso/team-mapping.md). |
| Terraform/OpenTofu or direct API automation. | [Configure the Stackweaver provider](../terraform-provider.md) or [authenticate an API request](../../architecture/using-the-api.md). |
| A run that needs cloud or Vault access. | [Configure workload identity](../oidc-configuration.md). This is separate from the Zitadel issuer used for sign-in. |

## Verify browser sign-in

Open the Stackweaver application URL and sign in. The browser should stay on reachable public URLs through the login and callback, then return to the application. For an external identity provider, verify that its callback URL uses the public auth hostname.

If sign-in fails, check the deployment-specific login name and initialization logs in [Zitadel setup](./zitadel-setup.md). For an issuer mismatch or an internal hostname in a redirect, use the [domain troubleshooting checks](./zitadel-custom-domain.md#troubleshooting). Recreating identity data is not a normal sign-in recovery step.
