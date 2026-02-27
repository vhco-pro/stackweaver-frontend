<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Single Sign-On (SSO) Integration

StackWeaver supports federated authentication through external identity providers (IdPs). Users can sign in with their corporate credentials from Azure AD/Entra ID, Okta, AWS Cognito, or any OIDC-compliant provider, without creating a separate StackWeaver account.

## How It Works

StackWeaver uses [Zitadel](https://zitadel.com) as its identity broker. When you configure an external IdP, the authentication flow works as follows:

1. The user clicks the external login button on the StackWeaver login page.
2. Zitadel redirects the user to the external IdP (e.g., Azure AD) for authentication.
3. The IdP authenticates the user and returns an ID token with claims (email, name, groups).
4. Zitadel receives the token, auto-provisions or links the user, and issues a StackWeaver JWT.
5. The StackWeaver API verifies the JWT and provisions the user in its local database.

Users are automatically provisioned in StackWeaver on their first login. However, they do not have access to any organization until an administrator invites them or SSO group-to-team mapping is configured.

## Supported Providers

| Provider | Type | Guide |
|----------|------|-------|
| Azure AD / Entra ID | Dedicated template | [Azure AD Setup](./azure-ad.md) |
| Okta | Generic OIDC | [Okta Setup](./okta.md) |
| AWS Cognito | Generic OIDC | [AWS Cognito Setup](./aws-cognito.md) |
| Any OIDC provider | Generic OIDC | [Generic OIDC Setup](./generic-oidc.md) |

## Group-Based Team Mapping

StackWeaver can automatically assign users to teams based on their IdP group memberships. When a user logs in, the groups from their IdP token are forwarded through the JWT, and StackWeaver maps them to teams that have a matching `sso_team_id` configured.

See the [Team Mapping Guide](./team-mapping.md) for details on configuring automatic team assignment.

## Prerequisites

Before configuring SSO, ensure you have:

1. A running StackWeaver deployment with Zitadel initialized (see the [Zitadel Setup Guide](../../get-started/self-hosting/ZITADEL_SETUP.md)).
2. Administrator access to your external identity provider.
3. Access to the `deploy/sso.env` file to set SSO/OIDC environment variables (this file is not overwritten by the auto-generated `deploy/.env`).

## Architecture Overview

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Browser    │────▸│   Zitadel    │────▸│  External IdP    │
│   (React)    │◂────│   (Broker)   │◂────│  (Azure/Okta/…)  │
└──────────────┘     └──────────────┘     └──────────────────┘
                           │
                           ▼
                     ┌──────────────┐
                     │ StackWeaver  │
                     │   API        │
                     └──────────────┘
```

Zitadel acts as an OIDC identity broker. It handles all the protocol-level complexity of communicating with external IdPs, including token exchange, user linking, and claim mapping. StackWeaver only needs to verify Zitadel-issued JWTs, which it already does.

## Multi-Tenant Isolation

StackWeaver is a multi-tenant platform. SSO-authenticated users are provisioned in the user table but do not automatically gain access to any organization. Organization access is granted through one of two mechanisms:

1. An organization administrator invites the user to join their organization.
2. The user's SSO group claims are mapped to StackWeaver teams via the `sso_team_id` field, which automatically grants organization membership for those specific organizations only.

This design ensures strong tenant isolation. A user from one company cannot see or access another company's organizations, even if both companies use the same StackWeaver instance.
