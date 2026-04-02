---
description: "Index page for authentication guides covering Zitadel setup, custom domain, and SSO"
covers: []
---

# Authentication

StackWeaver uses Zitadel as its OIDC identity provider. These guides cover setting up Zitadel, configuring a custom domain for production, and federating with an external identity provider via SSO.

## Guides

- **[Zitadel Setup](./zitadel-setup.md)**: how Zitadel is initialised in both Docker Compose and Kubernetes deployments, including OIDC app configuration and automated bootstrap.
- **[Custom Domain](./zitadel-custom-domain.md)**: run StackWeaver on a custom domain while keeping all internal service communication on localhost, including the SSO callback URL fix required for external identity providers.
- **[Single Sign-On (SSO)](../sso/README.md)**: federate with an external identity provider (Azure AD, Okta, AWS Cognito, or any OIDC provider).
