<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Zitadel Setup Guide

This guide covers how Zitadel is configured and initialized in StackWeaver, for both the Kubernetes (Helm) and Docker Compose deployment paths.

> **References:**
> - [Zitadel defaults.yaml](https://github.com/zitadel/zitadel/blob/main/cmd/defaults.yaml)
> - [Zitadel setup steps.yaml](https://github.com/zitadel/zitadel/blob/main/cmd/setup/steps.yaml)
> - [Zitadel production guide](https://zitadel.com/docs/self-hosting/manage/production)

## Overview

Zitadel provides OIDC/OAuth 2.0 authentication for StackWeaver, including:

- OpenID Connect and OAuth 2.0 flows (PKCE for the frontend, client credentials for the API)
- Multi-factor and passwordless authentication
- User management and roles
- Login V2: an external Next.js login UI served by `login-ui`

StackWeaver ships a `zitadel-init` bootstrap container that automatically provisions all required OIDC apps, service users, and webhooks after Zitadel starts.
No manual Zitadel console steps are required.

## Kubernetes / Helm Deployment

### What the Chart Does Automatically

When you install the Helm chart, the following happens without any manual intervention:

1. **Secrets init (PreSync Job)**: a `secrets-init` Job runs before the rest of the chart.
   It creates the Zitadel Kubernetes Secret (containing a randomly generated 32-character `masterkey` and a `adminPassword`) only if the secret does not already exist.
   This is idempotent — re-syncing never overwrites existing credentials.

2. **Zitadel starts**: the Zitadel pod waits for PostgreSQL to be ready (via an initContainer), then runs `start-from-init`.
   It reads `masterkey` and `adminPassword` from the Kubernetes Secret via environment variables.

3. **zitadel-init Job (PostSync)**: after Zitadel is up, the `zitadel-init` post-install/post-upgrade Job runs.
   It provisions the OIDC apps (frontend, API), the login service user, and webhook keys, then writes the results directly into the Zitadel Kubernetes Secret.
   It also triggers rolling restarts of the API, frontend, and login-ui pods.

### Finding the Admin Password (Kubernetes)

The Zitadel admin password is auto-generated during install.
The admin user is `{{ zitadel.init.adminUsername }}` (default: `admin@ZITADEL.localhost`).

To retrieve the password:

```bash
kubectl get secret stackweaver-zitadel -n stackweaver \
  -o jsonpath='{.data.admin-password}' | base64 -d
```

### Monitoring Initialization Progress

```bash
# Watch the zitadel-init job logs
kubectl logs -f job/stackweaver-zitadel-init -n stackweaver

# Check Zitadel pod status
kubectl get pod -n stackweaver -l app.kubernetes.io/component=zitadel
```

### Troubleshooting: Stuck Migration Lock

If Zitadel fails with `migration already started` or `migration failed err.id=MIGR-*`, a previous run left a partially completed migration lock in the database.
This typically happens after a crash during first initialization.

To clear it, drop and recreate the `zitadel` database:

```bash
PG_POD=$(kubectl get pod -n stackweaver \
  -l app.kubernetes.io/component=postgresql \
  -o jsonpath='{.items[0].metadata.name}')

kubectl exec -n stackweaver "$PG_POD" -- \
  psql -U iac -c "DROP DATABASE IF EXISTS zitadel;"

kubectl exec -n stackweaver "$PG_POD" -- \
  psql -U iac -c "CREATE DATABASE zitadel OWNER iac;"
```

Then restart the Zitadel pod:

```bash
kubectl rollout restart deployment/stackweaver-zitadel -n stackweaver
```

### Troubleshooting: Zitadel Panics with "no private ip address"

If Zitadel panics with:

```
none of the enabled methods for identifying the machine succeeded
failed to get Private IP address no private ip address
```

This means Zitadel's Sonyflake ID generator cannot identify the machine.
In Kubernetes each pod runs in its own network namespace, so the private IP scan returns nothing.
The fix is already applied in the Helm chart (`Machine.Identification.Hostname.Enabled: true`).
If you see this on an older install, upgrade the chart and resync.

### Troubleshooting: Zitadel Not Starting

```bash
# Check Zitadel pod logs
kubectl logs -n stackweaver \
  $(kubectl get pod -n stackweaver -l app.kubernetes.io/component=zitadel -o jsonpath='{.items[0].metadata.name}')

# Check if PostgreSQL is ready
kubectl get pod -n stackweaver -l app.kubernetes.io/component=postgresql
```

### Troubleshooting: Login UI — "Instance not found / public domain not trusted"

If the login-ui logs show:

```
unable to set instance using origin {auth.example.com <pod-ip>:3000 https}: public domain "<pod-ip>" not trusted
```

The login-ui is forwarding the pod's IP address as `x-forwarded-host` to Zitadel.
This happens because Kubernetes readiness/liveness probes hit the pod directly at its IP, so the `Host` header is the pod IP, which is not a trusted domain.

This is already fixed in the Helm chart: both probes include an `httpHeaders` entry setting `Host: <auth-hostname>`, so the login-ui always sees the correct domain on probe requests and forwards that to Zitadel rather than the pod IP.
If you see this on an older install, upgrade the chart and resync.

> **Docker Compose note:** This issue does not occur in Docker Compose because `network_mode: host` means probes use `localhost` as the Host header, and `localhost` is automatically added as a trusted domain by `zitadel-init`.

### Troubleshooting: OAuth Still Redirects to Zitadel's Built-In Login

Verify `ZITADEL_LOGIN_UI_BASE_URL` is set correctly in the Zitadel pod environment — it is derived from `ingress.hosts.auth` in the chart values.

```bash
kubectl describe deployment stackweaver-zitadel -n stackweaver | grep LOGIN_UI
```

If the value is wrong, update your `values.yaml` with the correct `ingress.hosts.auth` and run `helm upgrade`.

---

## Docker Compose Deployment

### Quick Start (Automated Bootstrap)

The Docker Compose stack ships with a Go bootstrap (`scripts/zitadel-init/main.go`) that provisions all required OIDC apps automatically.

```bash
# 1. Start the stack (Zitadel will initialize automatically)
cd deploy
docker compose up -d --build

# 2. Run the initializer once (after Zitadel is up)
docker compose run --rm zitadel-init

# 3. Restart so services pick up the generated env files
docker compose up -d
```

> **Linux tip:** use `network_mode: host` so every container dials `localhost` directly.
> This is already the default in `deploy/docker-compose.yml`.

### Admin Credentials (Docker Compose)

The Docker Compose stack uses static credentials defined in `deploy/zitadel-init-steps.yaml`:

| Field | Value |
|---|---|
| Username | `admin@ZITADEL.localhost` |
| Password | `Password1!` |
| Console URL | `http://localhost:8080/ui/console` |

### What `zitadel-init` Does

1. Waits for `/pat/admin.pat` (written by Zitadel during `start-from-init`).
2. Uses the PAT to connect to Zitadel via gRPC (`localhost:8080`).
3. Creates or updates:
   - Organization `IAC Platform`
   - Project `IAC Platform Project`
   - Frontend OIDC app (PKCE)
   - API app (client secret)
   - Login UI service machine user + PAT (`IAM_LOGIN_CLIENT` role)
   - Webhook signing keys
4. Writes the generated values to `deploy/.env`.

The bootstrap is idempotent — re-running it reuses existing apps and orgs.

### Environment Variables Written to `deploy/.env`

```env
ZITADEL_FRONTEND_CLIENT_ID=<frontend-client-id>
ZITADEL_API_CLIENT_ID=<api-client-id>
ZITADEL_API_CLIENT_SECRET=<api-client-secret>
ZITADEL_LOGIN_SERVICE_USER_TOKEN=<login-service-user-pat>
ZITADEL_LOGIN_SERVICE_USER_ID=<login-service-user-id>
ZITADEL_WEBHOOK_IDP_SYNC_KEY=<webhook-key>
ZITADEL_WEBHOOK_COMPLEMENT_TOKEN_KEY=<webhook-key>
```

> **Important:** `deploy/.env` is auto-generated and will be overwritten on each `zitadel-init` run.
> Persistent configuration lives in `deploy/sso.env`, `deploy/vcs.env`, and `deploy/oidc.env`.
> Never put values directly in `deploy/.env`.

### Environment Variable Reference for `zitadel-init`

| Variable | Description | Default |
|---|---|---|
| `ZITADEL_ISSUER` | Public issuer written to `.env` | `http://localhost:8080` |
| `ZITADEL_INTERNAL_ADDR` | Host:port the initializer dials | `localhost:8080` |
| `ZITADEL_ADMIN_USERNAME` | Admin username (matches init-steps.yaml) | `admin@ZITADEL.localhost` |
| `ZITADEL_ADMIN_PASSWORD` | Admin password (matches init-steps.yaml) | `Password1!` |
| `PROJECT_ROOT` | Where env/config files are written | `/config` inside container |
| `ZITADEL_PAT` | Optional PAT override instead of `/pat/admin.pat` | empty |

### Troubleshooting: Zitadel Not Starting (Docker Compose)

```bash
# Check logs
docker logs zitadel

# Verify PostgreSQL is accessible
docker exec postgres psql -U iac -d iac_platform -c "SELECT 1;"
```

### Troubleshooting: `App.NotFound` Error

The OAuth client ID doesn't exist or isn't accessible.

- Run `docker compose run --rm zitadel-init` to create/update applications.
- Verify the `ClientId` in `deploy/.env` matches what's in Zitadel.
- Ensure the frontend container has the correct `VITE_ZITADEL_CLIENT_ID`.

---

## Login V2 (External Login UI)

Both deployment paths use Zitadel's Login V2 feature, which redirects authentication flows to a separate Next.js `login-ui` service rather than Zitadel's built-in login.

This is configured in the Zitadel `defaults.yaml` (ConfigMap in Kubernetes, mounted file in Docker Compose) under `DefaultInstance.Features.LoginV2`:

```yaml
DefaultInstance:
  Features:
    LoginV2:
      Required: true
      BaseURI: <login-ui-url>/ui/v2/login
```

In Kubernetes, `BaseURI` is automatically set to `http://<fullname>-login-ui:3000/ui/v2/login`.
In Docker Compose, it is set to `http://localhost:3000/ui/v2/login`.

> **Note:** `DefaultInstance` settings only apply during first initialization.
> If Zitadel has already run and created the database, changing these settings requires resetting the database or using the Zitadel console/API to update the instance.

---

## Production Considerations

- Use HTTPS in production (set `ingress.tls.enabled: true` in Helm values).
- Store secrets in a secrets manager or use the `secrets.<component>.secretName` values to bring your own pre-created Kubernetes Secrets.
- Configure appropriate token lifetimes in chart values (`zitadel.config.accessTokenLifetime`, etc.).
- Back up the Zitadel PostgreSQL database regularly.

## Additional Resources

- [Zitadel Documentation](https://zitadel.com/docs)
- [OIDC Specification](https://openid.net/specs/openid-connect-core-1_0.html)
- [Zitadel Go SDK](https://pkg.go.dev/github.com/zitadel/oidc/v3/pkg/oidc)
- [Login UI integration guide](https://zitadel.com/docs/guides/integrate/login-ui)
