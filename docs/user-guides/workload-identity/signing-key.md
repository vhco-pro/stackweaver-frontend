---
title: "Signing key and issuer"
nav_order: 6
description: "Operator setup for workload identity: the shared RSA signing key and the public issuer URL every cloud trust verifies against, on Docker Compose and Kubernetes."
covers:
  - "deploy/oidc.env.example"
  - "deploy/helm/stackweaver/values.yaml"
  - "core/services/oidc/**"
  - "backend/internal/api/v2/handlers/oidc_well_known.go"
---

# Configure the signing key and issuer

Workload identity has its own issuer; it is separate from the Zitadel issuer used for user sign-in. Two variables control token signing and discovery for every target. On Docker Compose they live in `oidc.env` in your Compose directory (copied from `oidc.env.example` during installation). On Kubernetes, set the issuer with the `oidc.issuerUrl` Helm value; the chart generates the signing key into a Secret the API reads, or uses your own Secret when you set `secrets.oidc.secretName`.

| Variable | Required | Description |
|----------|----------|-------------|
| `OIDC_SIGNING_KEY` | **Yes** | Base64-encoded RSA-2048 private key used to sign workload identity tokens. |
| `OIDC_ISSUER_URL` | Set explicitly | The public URL embedded in tokens and the OIDC discovery document. Must match the **Issuer** you configured on the cloud side exactly (no trailing slash). |

The cloud fetches the issuer's keys to verify a token, so the issuer must be publicly reachable with a publicly trusted certificate.

## Share a persistent signing key

The API both signs every workload identity token and serves the JWKS public key endpoint the cloud fetches, and a deployment can run more than one API replica. Every replica must read the same `OIDC_SIGNING_KEY`, so a token one replica signed verifies against the keys any replica publishes. Without a valid configured key, secure API startup fails. Launchers and jobs never hold the key. An ephemeral key is generated only when `DEV_INSECURE_KEY=1` is set, which is meant for local development: each replica then mints its own key, a token can carry a `kid` the JWKS another replica serves does not advertise, and the cloud rejects it (for example Azure's `AADSTS700211`).

On Docker Compose, set `OIDC_SIGNING_KEY` in `oidc.env`; the self-hosting bundle reads that file into the API. On Kubernetes the chart generates the key into a Secret and passes it to the API Deployment, or uses the Secret you name in `secrets.oidc.secretName`.

## Store the key on one line

Docker Compose `env_file` does not support multi-line values. A raw PEM key spans multiple lines; base64 collapses it to a single line `env_file` can read.

## Generate and apply the signing key

On Docker Compose, generate a 2048-bit RSA key and base64-encode it onto a single line:

```bash
openssl genrsa 2048 | base64 -w 0
# Copy the single-line output and set it as OIDC_SIGNING_KEY in oidc.env
```

After editing `oidc.env`, recreate the services that read it so they pick up the new configuration:

```bash
# Run in your Compose directory
docker compose up -d api
```

Keep the key private and shared by every API replica. Do not regenerate it as routine troubleshooting; changing it affects existing trust and active tokens.

When the app is internal, the chart can serve only the discovery document and JWKS on a
public host and default the issuer to that host's origin; see
[Public host for webhooks and discovery](../../get-started/self-hosting/public-endpoints.md).

On Kubernetes the chart generates the key for you. After changing `oidc.issuerUrl` in `my-values.yaml`, set `STACKWEAVER_CHART_VERSION` to the installed version from `helm list` and apply it, so the settings change does not also upgrade the chart:

```bash
helm upgrade stackweaver oci://ghcr.io/vhco-pro/charts/stackweaver \
  --version "${STACKWEAVER_CHART_VERSION:?Set the installed chart version}" \
  --namespace stackweaver --values my-values.yaml
```
