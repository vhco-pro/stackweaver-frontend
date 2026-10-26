---
description: "Understand the Cognito scope compatibility limit before attempting generic OIDC sign-in."
covers:
  - "scripts/zitadel-init/**"
  - "deploy/sso.env.example"
  - "deploy/helm/**"
---

# AWS Cognito SSO

> [!IMPORTANT]
> The generic initializer requests `openid`, `profile`, `email` and `groups`. Cognito's
> standard scopes do not include the bare `groups` name; custom scopes use a resource-server
> prefix. Check your app client's actual authorization response for `invalid_scope` before
> relying on this configuration. A token's `cognito:groups` claim is not an OAuth scope.

Keep the user-pool, confidential-client and deployment configuration below together. If you
already have a working deployment, preserve its settings and validate any change against
that deployment. The scope distinction alone does not establish the result of a live login.

## Prepare a user-pool client

1. In [Amazon Cognito](https://console.aws.amazon.com/cognito/), select or create a user pool.
2. Configure a managed-login domain, either Cognito-provided or custom.
3. Create a confidential app client with a generated secret and Authorization Code grant.
4. Register the public Zitadel callback:

   ```text
   https://auth.example.com/idps/callback
   ```

   For a local HTTP installation, use `http://localhost:8080/idps/callback`.
5. Allow the standard `openid`, `profile` and `email` scopes. Also verify how the client handles the
   initializer's requested `groups` scope.
6. Record the client ID, secret value, region and user-pool ID. The issuer is the user-pool
   URL, not the managed-login domain:

   ```text
   https://cognito-idp.us-east-1.amazonaws.com/us-east-1_AbCdEfGhI
   ```

## Group claims and scopes are different

Cognito user-pool groups can appear as `cognito:groups` in tokens. That is a token claim,
not an OAuth scope named `groups`. Stackweaver recognizes the claim name when it reaches
the group-capture path, but that does not prove that this client can complete the whole
sign-in flow. Do not add a fictional scope or assume group delivery through userinfo.

## Optional Cognito groups

1. In the user pool, open **Groups** and create the group identifiers you want to map.
2. Add a test user to the intended groups.
3. Inspect the upstream token's `cognito:groups` claim, then the Stackweaver token's
   `sso_groups` and actual team membership. Claim presence is not the whole access check.

The webhook can read supported groups from raw provider information or upstream ID/access
tokens. Do not require the same group claim to be duplicated in userinfo.

## Provider behavior

| Setting | Behavior |
|---|---|
| New accounts. | SSO can create accounts with provider email treated as verified, including when public sign-up is disabled. |
| Profile. | The integration enables provider profile updates. |
| Existing email. | The application refuses a first SSO registration whose email already belongs to an account and asks for password sign-in first. |
| Organization access. | Requires invitation or a verified team mapping; account creation alone does not grant it. |
| Generic provider slot. | One environment/Helm-configured generic provider, alongside Entra's separate dedicated integration. |
| Identity/profile mapping. | Uses userinfo. Group extraction separately checks raw information and upstream tokens. |

## Deployment inputs

Use these Compose or Helm inputs after checking the client's scopes and callback.
Keep a working administrator sign-in available while testing the identity flow.

## Configure the deployment

Use one deployment path. These settings configure the installed identity service; there is
no Stackweaver provider resource or management YAML for registering this external IdP.
Never put persistent settings in generated `.env`.

### Docker Compose

Save this in `sso.env`, beside `docker-compose.yml`. Replace the example credentials and
keep the file out of version control.

```dotenv
OIDC_IDP_NAME="AWS Cognito"
OIDC_IDP_ISSUER=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_AbCdEfGhI
OIDC_IDP_CLIENT_ID=replace-with-client-id
OIDC_IDP_CLIENT_SECRET=replace-with-client-secret
```

Apply the initializer input, then recreate consumers of its generated credentials:

```bash
docker compose run --rm zitadel-init
docker compose up -d
```

Inspect the one-off initializer command's output before continuing. Its `--rm` container
is removed on exit; `docker compose logs zitadel-init` does not retain that output.

### Kubernetes / Helm

Create the client-secret Secret in the release namespace. This command is for a new Secret;
update an existing Secret through your usual secret-management process. Replace the sample
secret locally and avoid exposing it in shell history.

```bash
kubectl create secret generic stackweaver-sso \
  --namespace stackweaver \
  --from-literal=oidc-idp-client-secret="your-client-secret-value"
```

Merge this into `my-values.yaml`, preserving your other release settings:

```yaml
sso:
  secretName: stackweaver-sso
  oidcProvider:
    name: "AWS Cognito"
    issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_AbCdEfGhI"
    clientId: "1a2b3c4d5e6f7g8h9i0j"
```

Apply it to the existing release:

Set `STACKWEAVER_CHART_VERSION` locally to the installed chart version shown by
`helm list --namespace stackweaver`. Preserve your release values; changing identity or VCS
settings is not an instruction to upgrade the platform.

```bash
helm upgrade stackweaver oci://ghcr.io/vhco-pro/charts/stackweaver \
  --version "${STACKWEAVER_CHART_VERSION:?Set the installed chart version}" \
  --namespace stackweaver \
  --values my-values.yaml
kubectl logs deployment/stackweaver-zitadel -c zitadel-init --namespace stackweaver
```

These recipes require the bundled Stackweaver initializer. An externally managed Zitadel
installation needs its own IdP and Actions configuration; this guide does not supply that
manual procedure. See [Zitadel setup](../authentication/zitadel-setup.md) for deployment boundaries.

## Verify before enabling users

Inspect the actual authorization request, requested scopes and provider response. Stop on
an unsupported-scope error. A created provider or visible sign-in button is not a successful
end-to-end test. After compatibility is resolved, verify sign-in, user profile/email and
organization membership separately, following the [generic guide](./generic-oidc.md).

For a redirect mismatch, compare the browser request with the registered Zitadel callback
and use the [custom-domain guide](../authentication/zitadel-custom-domain.md). For group
mapping, test a nonprivileged account and read [team mapping](./team-mapping.md), including
its empty-group and cross-provider limits.

See AWS's [app-client settings](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-client-apps.html)
and [scope definitions](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-define-resource-servers.html).
