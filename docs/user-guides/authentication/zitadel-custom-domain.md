---
description: "Guide for running Zitadel on a custom domain while keeping internal service communication on the private Docker network"
covers:
  - "scripts/zitadel-init/**"
  - "deploy/docker-compose.yml"
---

# Configure a Zitadel domain

Use a public auth hostname such as `auth.example.com` for Zitadel and a separate application hostname such as `app.example.com`. Browsers use those public URLs; Compose services reach Zitadel as `zitadel:8080` on the private network.

These steps are for [Docker Compose](../../get-started/self-hosting/docker-compose/README.md). On Kubernetes, configure `zitadel.config.ExternalDomain` and the ingress hosts through the [Helm deployment guide](../../get-started/self-hosting/kubernetes/README.md).

## Before changing the domain

Arrange DNS and HTTPS routing for the auth and app hosts. Preserve the Host header when proxying to Zitadel, and use a reverse proxy configuration that supports Zitadel's required protocols. Keep a working administrator session and a backup of your identity database and configuration while changing login URLs.

| URL | Purpose |
|---|---|
| `https://auth.example.com` | Public Zitadel issuer, console and identity-provider callback origin. |
| `https://app.example.com/login` | Login UI served by the Stackweaver application. |
| `http://zitadel:8080` | Internal Compose connection to Zitadel. |
| `https://auth.example.com/idps/callback` | Redirect registered at an external SSO provider. |

Changing only the auth issuer does not configure the application's own hostname, OIDC callback or logout URL. Set those using your deployment's public-URL configuration too.

## 1. Set the external identity

In `zitadel-defaults.yaml` in your Compose directory, set:

```yaml
ExternalDomain: auth.example.com
ExternalPort: 443
ExternalSecure: true
TLS:
  Enabled: false
```

This example terminates TLS at the reverse proxy. `ExternalSecure` describes the public connection even though the internal service uses HTTP.

In `zitadel-init.yaml`, register the trusted hostname:

```yaml
custom_domains:
  - auth.example.com
frontend_redirect_uris:
  - https://app.example.com/auth/callback
frontend_post_logout_redirect_uris:
  - https://app.example.com
```

The initializer adds `localhost` when the primary external domain is not localhost. `ZITADEL_CUSTOM_DOMAINS` can supply a comma-separated override instead of the YAML list.

## 2. Align TLS mode and the app login URL

For TLS at a reverse proxy, Zitadel must start with `--tlsMode external`. The Compose bundle reads `ZITADEL_TLS_MODE`, which the initializer derives from the external settings. Check any explicit command or environment override in your installed Compose configuration.

| Mode | Use it when... |
|---|---|
| `disabled` | The whole connection is plain HTTP for local development. It forces external security off. |
| `external` | A reverse proxy terminates HTTPS. |
| `enabled` | Zitadel itself terminates TLS with certificates you supply. |

Merge these explicit public settings into the installed Compose configuration. Pin the TLS
mode for the first restart, because generated `.env` may still say `disabled`:

```yaml
services:
  zitadel:
    command: >
      start-from-init
      --config /etc/zitadel/defaults.yaml
      --steps /etc/zitadel/init-steps.yaml
      --masterkey "${ZITADEL_MASTERKEY}"
      --tlsMode external
  zitadel-init:
    environment:
      ZITADEL_DOMAIN: auth.example.com
      LOGIN_UI_BASE_URL: https://app.example.com/login
      FRONTEND_REDIRECT_URI: https://app.example.com/auth/callback
      FRONTEND_POST_LOGOUT_URI: https://app.example.com
  api:
    environment:
      STACKWEAVER_APP_URL: https://app.example.com
      STACKWEAVER_DEFAULT_REDIRECT_URI: https://app.example.com/auth/callback
  frontend-config:
    environment:
      VITE_API_URL: https://app.example.com/api/v2
```

`ZITADEL_DOMAIN` makes the initializer select the intended instance on its internal gRPC connection. Set it explicitly for the first domain reconciliation; the generated external host may still contain localhost. It must match `ExternalDomain`.

Set the API callback with `STACKWEAVER_DEFAULT_REDIRECT_URI`; when unset it falls back to
`STACKWEAVER_APP_URL` plus `/auth/callback`. the initializer inputs register
that URI on the confidential client. A frontend redirect override does not configure sign-in.

The `VITE_API_URL` example assumes the app host routes `/api/v2` to the API. A separate API
host also requires compatible frontend CSP and API CORS configuration and is outside this
same-origin example. Do not change only `VITE_API_URL` and expect that topology to work.
The `frontend-config` service name applies to the standalone Compose bundle: it writes
`env.js`, while the frontend container serves that file. Re-run the writer after changing
these inputs. On another deployment, use that installation's runtime-config mechanism.

Check native `ZITADEL_EXTERNALDOMAIN`, `ZITADEL_EXTERNALPORT` and
`ZITADEL_EXTERNALSECURE` overrides on both Zitadel and the initializer: they take precedence
over the defaults YAML.

Merge this fragment into the installed configuration; it is not a complete Compose file. Preserve the installation's **existing master key** and its secret source. Do not replace it with a newly generated key during a domain change.

## 3. Reconcile and recreate services

For an existing installation, first recreate **Zitadel itself** with the changed settings.
Its `start-from-init` command runs Zitadel's own setup phase; the Stackweaver initializer
is a separate application reconciliation and cannot replace that phase.

```bash
docker compose up -d --force-recreate zitadel
docker compose logs zitadel
curl --fail-with-body --silent --show-error \
  https://auth.example.com/.well-known/openid-configuration | jq .issuer
```

Stop if discovery does not report `https://auth.example.com`. Once it does, reconcile the
application and recreate the consumers of generated credentials:

```bash
docker compose run --rm zitadel-init
docker compose up -d
```

For a new installation, start the stack with `docker compose up -d`, wait for the initializer, then run `docker compose up -d` again so services receive its generated values. Check the logs before proceeding if initialization reports a domain or BaseURI error.

The initializer writes `ZITADEL_ISSUER`, `ZITADEL_EXTERNAL_HOST` and `ZITADEL_TLS_MODE` to generated `.env`. Do not maintain these values by editing that output file. It also reconciles the public Login V2 BaseURI.

## 4. Register the SSO callback

At your external identity provider, register this redirect URI with your actual auth hostname:

```text
https://auth.example.com/idps/callback
```

Follow the [Entra ID](../sso/azure-ad.md), [Okta](../sso/okta.md) or [generic OIDC](../sso/generic-oidc.md) instructions for the provider's fields.

The API auth proxy sends `x-zitadel-instance-host` using the generated external host, so Zitadel can select its instance and construct the public callback while receiving the request internally. An external issuer alone does not prove that this callback is correct.

## Verify the change

Run these read-only checks from the Compose host. Replace the sample hostname:

```bash
docker compose logs zitadel zitadel-init
curl --fail-with-body --silent --show-error \
  https://auth.example.com/.well-known/openid-configuration | jq .issuer
curl --fail-with-body --silent --show-error \
  -H 'Host: auth.example.com' \
  http://localhost:8080/.well-known/openid-configuration | jq .issuer
grep -E '^ZITADEL_(ISSUER|EXTERNAL_HOST|TLS_MODE)=' .env
docker compose exec api printenv CUSTOM_REQUEST_HEADERS
curl --fail-with-body --silent --show-error http://localhost:8022/health
```

Both discovery requests should report `https://auth.example.com`. The header should be `x-zitadel-instance-host:auth.example.com`, and the API health request should succeed. Use the API port from your installed deployment if it differs.

Then complete sign-in from the public application URL, including the external provider if enabled. Check the actual browser redirect and return path. A healthy API alone does not validate SSO.

## Troubleshooting

| Symptom | Next check |
|---|---|
| `Instance not found`. | Check the incoming Host header and trusted-domain registration in initializer logs. Rerun initialization after correcting its input. |
| Discovery reports HTTP instead of HTTPS. | Check the running TLS mode and overrides of the external scheme/port. `disabled` overrides an HTTPS intention. |
| Issuer mismatch. | Compare public discovery with generated `ZITADEL_ISSUER`, then rerun initialization and recreate services. |
| `AADSTS50011` or another SSO redirect mismatch. | Compare the provider's registered redirect with the actual `/idps/callback` URL and inspect `CUSTOM_REQUEST_HEADERS`. |
| Browser reaches an internal service hostname. | Correct the app's public Login BaseURI and frontend redirect/logout configuration, then reconcile. |
| Sign-in token verification fails. | Check internal Zitadel readiness/addressing and the public issuer. JWKS fetching and issuer validation use different addresses. |

To return to local development, use the following defaults, remove the custom-domain list, restore the local app login/callback/logout URLs, set the initializer's `ZITADEL_DOMAIN` back to `localhost`, and remove conflicting TLS overrides. Rerun initialization and recreate services as above.

```yaml
ExternalDomain: localhost
ExternalPort: 8080
ExternalSecure: false
```

Removing a hostname from the YAML does **not** revoke it in Zitadel. Trusted-domain and
BFF redirect reconciliation is additive. After the replacement login works, inspect
Zitadel's registered trusted domains, BFF redirect URIs and post-logout URIs, and
remove obsolete public entries deliberately. Review any retained localhost registrations as part of that cleanup. Reverting input files alone is not a domain-revocation procedure.

The public issuer changes when you do this. Recheck sign-in and any external SSO redirect configuration rather than assuming existing browser sessions remain valid.

## Why internal calls still work

The API can fetch signing keys from the internal Zitadel service while validating the token's issuer against the public URL. Trusted domains let Zitadel recognize additional request hosts, and the auth proxy explicitly supplies the external instance host. Internal HTTP transport does not change the HTTPS issuer a public client must trust.

For public routing with Cloudflare, use the [tunnel guide](../../get-started/self-hosting/docker-compose/cloud-flare-tunnel.md). The DNS command below associates an existing named tunnel with the auth hostname; configure its service route separately:

```bash
cloudflared tunnel route dns my-tunnel auth.example.com
```

See [Zitadel external access](https://zitadel.com/docs/self-hosting/manage/custom-domain) for protocol, host and reverse-proxy requirements.
