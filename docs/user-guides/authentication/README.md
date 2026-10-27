---
title: "Authentication"
layout: overview
description: "Configure browser sign-in with Zitadel, connect an identity provider or choose credentials for automation."
covers:
  - "scripts/zitadel-init/**"
  - "frontend/src/contexts/AuthContext*"
  - "frontend/src/pages/Login/**"
---

# Authentication

## Choose the right identity

Browser sign-in uses a server-side Stackweaver session held in an `HttpOnly` cookie. Self-hosting operators configure Zitadel; organization administrators can [connect an external identity provider](../sso/README.md) and [map groups to teams](../sso/team-mapping.md).

Automation uses separate credentials. Use the [Stackweaver Terraform provider](../terraform-provider.md) or [API guidance](../../architecture/using-the-api.md) with a `tfe-` API token. A Zitadel access token is not an API credential. [Workload identity](../oidc-configuration.md) gives a run access to a cloud service or Vault; it does not configure browser sign-in.

## Verify browser sign-in

Open the Stackweaver application URL and sign in. The browser should stay on reachable public URLs through login and callback, then return to the application. For an external identity provider, verify that its callback URL uses the public auth hostname.

If sign-in fails, check the deployment-specific login name and initialization logs in [Zitadel setup](./zitadel-setup.md). For an issuer mismatch or an internal hostname in a redirect, use the [domain troubleshooting checks](./zitadel-custom-domain.md#troubleshooting). Recreating identity data is not a normal sign-in recovery step.
