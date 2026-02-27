<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Zitadel Custom Domain Setup

The main goal of this setup is to run the stack with a custom domain while ensuring that internal components never use external domain resolution to communicate with each other. All inter-service communication stays fully on the local stack using either `localhost` (Docker Compose) or Kubernetes internal services. External users reach Zitadel through the public domain (e.g. `zitadel.example.com`), but internally everything goes through `localhost:8080` with zero DNS lookups or TLS overhead between services.

This guide covers running Zitadel on both a custom domain and `localhost` simultaneously, including the SSO callback URL fix required for external identity providers like Azure AD.

## How It Works

Zitadel uses three mechanisms that work together to support a custom domain while keeping internal traffic local.

### 1. ExternalDomain (primary identity)

The `ExternalDomain` setting in `deploy/zitadel-defaults.yaml` tells Zitadel what its public-facing domain is. Zitadel uses this to construct OIDC issuer URLs, console URLs, and JWKS endpoint URLs embedded in tokens. This is the single most important setting for custom domain support.

When `ExternalDomain` is set to `zitadel.example.com` with `ExternalSecure: true` and `ExternalPort: 443`, Zitadel constructs URLs like `https://zitadel.example.com/oauth/v2/authorize` instead of `http://localhost:8080/oauth/v2/authorize`. This means token issuers and all OIDC metadata point at your public domain.

### 2. Trusted Domains (multi-domain routing)

Zitadel routes requests to the correct instance based on the HTTP `Host` header. By default, only the `ExternalDomain` is trusted. If you set `ExternalDomain` to `zitadel.example.com` but internal services send requests to `localhost:8080`, those requests would fail with "Instance not found" because `localhost` is not a recognized host.

Trusted domains solve this. When you add `localhost` as a trusted domain, Zitadel accepts requests with `Host: localhost:8080` and routes them to the same instance. The OIDC discovery endpoint (`/.well-known/openid-configuration`) returns the correct issuer for whichever host you query.

Trusted domains are registered via Zitadel's **Instance API v2** (`AddTrustedDomain`), which only requires the `iam.write` permission. The admin PAT (IAM_OWNER role) has this permission, so no special system user or API key is needed.

> **Note about the System API:** Older versions of Zitadel (v2/v3) had a separate System API for managing custom domains with instance-level routing. Zitadel v4.x removed the System API entirely. Trusted domains through the Instance API v2 are the correct and only way to register additional domains in v4.x. The init script uses this approach exclusively.

### 3. IdP Callback URL (x-zitadel-instance-host header)

When an external identity provider (Azure AD, Okta, etc.) completes authentication, it redirects the user back to Zitadel's IdP callback URL. This URL is **not** constructed from the `ExternalDomain` config. Instead, Zitadel builds it dynamically from the HTTP request's domain context.

The callback URL is constructed in Zitadel's source code as `DomainContext(ctx).Origin() + "/idps/callback"`, where `Origin()` = `Protocol + "://" + RequestedHost()`. The `RequestedHost()` returns the first matching header from Zitadel's `InstanceHostHeaders` list, checked in this order:

1. `x-zitadel-instance-host` (custom header, checked first)
2. `host` (standard HTTP Host header)
3. `:authority` (HTTP/2 authority)
4. Forwarded headers (`forwarded`, `x-forwarded-host`, etc.)

The Login UI communicates with Zitadel internally at `http://localhost:8080`, so the standard `Host` header is `localhost:8080`. Without intervention, Zitadel would construct the callback as `https://localhost:8080/idps/callback`, which external identity providers reject because it does not match the registered redirect URI.

The fix is the `x-zitadel-instance-host` header. Because it is checked first in the `InstanceHostHeaders` list, it overrides the `Host` header. The Login UI supports a `CUSTOM_REQUEST_HEADERS` environment variable that injects custom headers into every gRPC call to Zitadel. Setting `CUSTOM_REQUEST_HEADERS=x-zitadel-instance-host:zitadel.example.com` causes the Login UI to send this header on every request, so Zitadel constructs the callback as `https://zitadel.example.com/idps/callback`.

This approach preserves the design goal: the Login UI still talks to Zitadel on `localhost:8080` (no external DNS resolution), but the IdP callback URL correctly points to the public domain.

The init script automates this by writing `ZITADEL_EXTERNAL_HOST` to `deploy/.env` when `ExternalDomain` is not `localhost`. Docker Compose substitutes it into `CUSTOM_REQUEST_HEADERS=x-zitadel-instance-host:${ZITADEL_EXTERNAL_HOST:-}`. When `ZITADEL_EXTERNAL_HOST` is empty (localhost-only setup), the header value is empty and the Login UI deletes the header, falling back to normal `Host` header behavior.

### What happens at each domain

When both domains are registered as trusted, Zitadel responds correctly on each:

| Request Host | OIDC Issuer | Used By |
|---|---|---|
| `zitadel.example.com` | `https://zitadel.example.com` | Browsers, SSO callbacks, external clients |
| `localhost:8080` | `https://localhost:8080` | Internal services (API, login-ui, runners) |

The issuer always uses the scheme configured by `ExternalSecure` (https when true), regardless of whether TLS is actually terminated at Zitadel or by a reverse proxy.

## Configuration

The setup involves three files. All paths are relative to the repository root.

### Step 1: Set ExternalDomain in zitadel-defaults.yaml

Edit `deploy/zitadel-defaults.yaml` and set the three external access fields at the top of the file:

```yaml
ExternalDomain: zitadel.example.com  # Your public domain
ExternalPort: 443                     # Port users access (443 for HTTPS)
ExternalSecure: true                  # true if accessed via HTTPS
TLS:
  Enabled: false                      # Keep false when TLS is terminated by a reverse proxy (Cloudflare, nginx, etc.)
```

The commented-out defaults show the localhost values for reference:

```yaml
ExternalDomain: localhost  # Default: localhost
ExternalPort: 8080         # Default: 8080
ExternalSecure: false      # Default: false (no TLS)
```

These three fields are the single source of truth for Zitadel's external identity. The init script reads this file to derive the `ZITADEL_ISSUER` URL that all other services use.

### Step 2: Set custom_domains in zitadel-init.yaml

Edit `deploy/zitadel-init.yaml` and list your custom domains:

```yaml
custom_domains:
  - zitadel.example.com
```

The init script reads this list and registers each domain as a trusted domain in Zitadel. You do not need to add `localhost` here; the init script automatically adds it when `ExternalDomain` is not `localhost`.

Alternatively, you can set the `ZITADEL_CUSTOM_DOMAINS` environment variable (comma-separated) instead of or in addition to the file. The environment variable takes precedence when both are set.

### Step 3: Set --tlsMode in docker-compose.yml

The `--tlsMode` flag in the Zitadel container's command must match your TLS setup. This is critical because `--tlsMode disabled` overrides `ExternalSecure` to `false`, breaking HTTPS URLs.

| TLS Mode | When to Use | Effect on ExternalSecure |
|---|---|---|
| `disabled` | Development on localhost only, no HTTPS anywhere | Forces `ExternalSecure: false` |
| `external` | TLS terminated by a reverse proxy (Cloudflare, nginx, Caddy) | Respects `ExternalSecure` from config |
| `enabled` | Zitadel terminates TLS itself (you provide cert/key) | Forces `ExternalSecure: true` |

For most production deployments behind Cloudflare or a reverse proxy, use `--tlsMode external`:

```yaml
zitadel:
  command: >
    start-from-init
    --config /etc/zitadel/defaults.yaml
    --steps /etc/zitadel/init-steps.yaml
    --masterkey "your-masterkey"
    --tlsMode external
```

> **Common mistake:** Using `--tlsMode disabled` with `ExternalSecure: true`. The flag overrides the YAML, so Zitadel reports `External Secure: false` and generates `http://` URLs even though your config says `true`. Always check the Zitadel startup banner in the logs (`docker logs zitadel`) to confirm `External Secure` matches your intent.

## How the Init Script Ties It Together

When `zitadel-init` runs, it performs the following domain-related steps:

1. **Reads `deploy/zitadel-defaults.yaml`** and extracts `ExternalDomain`, `ExternalPort`, and `ExternalSecure`.

2. **Computes the issuer URL** from those values. For example, `ExternalDomain: zitadel.example.com`, `ExternalPort: 443`, `ExternalSecure: true` produces `https://zitadel.example.com` (port 443 is omitted because it is the default for HTTPS).

3. **Reads `deploy/zitadel-init.yaml`** (or `ZITADEL_CUSTOM_DOMAINS` env var) and collects the list of custom domains.

4. **Auto-adds localhost:** If `ExternalDomain` is not `localhost`, the init script automatically appends `localhost` to the trusted domains list. This ensures internal services can always reach Zitadel on `localhost:8080` without going through the public domain.

5. **Registers trusted domains** via Zitadel's Instance API v2 (`AddTrustedDomain`). This is idempotent. Domains that already exist are skipped.

6. **Derives `ZITADEL_EXTERNAL_HOST`** from `ExternalDomain`. When `ExternalDomain` is not `localhost`, this is set to the domain name (e.g. `zitadel.example.com`). When `ExternalDomain` is `localhost`, it is left empty. This variable drives the Login UI's `CUSTOM_REQUEST_HEADERS` for correct IdP callback URLs (see "IdP Callback URL" section above).

7. **Writes `deploy/.env`** with the derived values. The key variables are:
   ```
   ZITADEL_ISSUER=https://zitadel.example.com
   VITE_ZITADEL_ISSUER=https://zitadel.example.com
   ZITADEL_EXTERNAL_HOST=zitadel.example.com
   ```
   Docker Compose reads these via `env_file: ./.env` and substitutes them into service environment variables using `${ZITADEL_ISSUER:-http://localhost:8080}` syntax (with a localhost fallback for first-run before init has written the file).

## How Services Use the Issuer

After init writes `.env`, Docker Compose injects the issuer into each service:

| Service | Environment Variable | Value | Purpose |
|---|---|---|---|
| API | `ZITADEL_ISSUER` | `https://zitadel.example.com` | Validates the `iss` claim in JWTs |
| API | `ZITADEL_INTERNAL_ADDR` | `localhost:8080` | Fetches JWKS keys internally (no external DNS) |
| Frontend | `VITE_ZITADEL_ISSUER` | `https://zitadel.example.com` | OIDC discovery and token requests from the browser |
| Login UI | `ZITADEL_API_URL` | `http://localhost:8080` | Internal gRPC/REST calls to Zitadel |
| Login UI | `CUSTOM_REQUEST_HEADERS` | `x-zitadel-instance-host:zitadel.example.com` | Tells Zitadel to build IdP callbacks with the external domain |
| Login UI | `ZITADEL_EXTERNAL_HOST` | `zitadel.example.com` | Source value for `CUSTOM_REQUEST_HEADERS` (from `.env`) |
| zitadel-init | `ZITADEL_ISSUER` | `https://zitadel.example.com/ui/v2/login` | Login redirect URL (appends login path) |

The API uses a split verification approach: it fetches the JWKS signing keys from `http://localhost:8080/oauth/v2/keys` (fast, internal, no DNS/TLS overhead) but validates the `iss` claim in tokens against the external issuer URL (`https://zitadel.example.com`). This ensures tokens are valid for the public domain while keeping key fetching fast and reliable.

Notice that every service talks to Zitadel on `localhost:8080`. No service resolves the external domain to reach Zitadel. The external domain is only used for browser-facing URLs and IdP callback construction via the `x-zitadel-instance-host` header.

## Running the Setup

### New installation

```bash
# 1. Edit deploy/zitadel-defaults.yaml with your domain settings
# 2. Edit deploy/zitadel-init.yaml with your custom_domains
# 3. Start the stack
make up
```

The init container runs automatically after Zitadel starts, registers trusted domains, and writes `.env`. A `make fresh` afterward ensures all services pick up the new values.

### Existing installation

If you are changing from localhost to a custom domain on an existing stack:

```bash
# 1. Edit deploy/zitadel-defaults.yaml
# 2. Edit deploy/zitadel-init.yaml
# 3. Rebuild and run init
cd deploy
docker compose build zitadel-init
docker compose run --rm zitadel-init

# 4. Restart all services to pick up the new .env values
cd ..
make fresh
```

> **Note:** `make fresh` rebuilds and restarts the code containers (API, frontend, runners, orchestrator) but does not rebuild the init image. Always run `docker compose build zitadel-init` before `docker compose run --rm zitadel-init` if you have changed the init code.

## DNS and Reverse Proxy

Your custom domain must resolve to the machine running Zitadel on port 8080. Common approaches:

### Cloudflare Tunnel (recommended for self-hosted)

Point a Cloudflare tunnel at `http://localhost:8080`. See the [Cloudflare tunnel guide](cloud-flare-tunnel.md) for detailed setup. The tunnel must route your domain's hostname to `http://localhost:8080`.

```bash
cloudflared tunnel route dns my-tunnel zitadel.example.com
```

### Reverse proxy (nginx, Caddy)

If you use a reverse proxy, configure it to forward traffic from your domain to `localhost:8080`. Ensure it passes the `Host` header through so Zitadel can route by domain.

### Direct DNS

If your server has a public IP, point an A record at it and configure `ExternalPort` to match how users access it.

No Zitadel restart is required after adding domains. Trusted domains take effect immediately when registered.

## SSO Callback URL

When you configure an external identity provider (Azure AD, Okta, etc.), the IdP callback URL must use your external domain. With the custom domain setup above, the callback URL is:

```
https://zitadel.example.com/idps/callback
```

You must register this exact URL as a redirect URI in your identity provider's app registration. See the [Azure AD](sso/azure-ad.md), [Okta](sso/okta.md), or [Generic OIDC](sso/generic-oidc.md) guides for provider-specific instructions.

> **Important:** The callback URL is **not** derived from the `ExternalDomain` config value. Zitadel constructs it from the request's domain context headers at runtime. The `CUSTOM_REQUEST_HEADERS` / `ZITADEL_EXTERNAL_HOST` mechanism described above is what makes this work correctly. Without it, the callback URL would be `https://localhost:8080/idps/callback`, which external identity providers reject.
>
> If you see `AADSTS50011` (Azure AD redirect URI mismatch) or similar errors, verify that `ZITADEL_EXTERNAL_HOST` is set in `deploy/.env` and that the Login UI container has `CUSTOM_REQUEST_HEADERS` in its environment. You can check with:
> ```bash
> docker exec login-ui sh -c 'printenv CUSTOM_REQUEST_HEADERS'
> # Should output: x-zitadel-instance-host:zitadel.example.com
> ```

## Verification

After running the setup, verify everything works:

```bash
# 1. Check Zitadel startup banner
docker logs zitadel 2>&1 | grep -E "External Secure|Console URL|Health Check"
# Should show:
#  External Secure        : true
#  Console URL            : https://zitadel.example.com:443/ui/console
#  Health Check URL       : https://zitadel.example.com:443/debug/healthz

# 2. Check OIDC discovery on both domains
curl -s http://localhost:8080/.well-known/openid-configuration | jq .issuer
# "https://localhost:8080"

curl -s -H "Host: zitadel.example.com" http://localhost:8080/.well-known/openid-configuration | jq .issuer
# "https://zitadel.example.com"

# 3. Check .env was written with the correct issuer
grep ZITADEL_ISSUER deploy/.env
# ZITADEL_ISSUER=https://zitadel.example.com
# VITE_ZITADEL_ISSUER=https://zitadel.example.com

# 4. Check Login UI has the correct custom header (custom domain only)
docker exec login-ui sh -c 'printenv CUSTOM_REQUEST_HEADERS'
# x-zitadel-instance-host:zitadel.example.com

# 5. Check API health
curl -s http://localhost:8022/health
# {"status":"ok"}
```

## Switching Back to localhost-Only

To revert to a localhost-only setup:

1. In `deploy/zitadel-defaults.yaml`, set `ExternalDomain: localhost`, `ExternalPort: 8080`, `ExternalSecure: false`.
2. In `deploy/docker-compose.yml`, change `--tlsMode external` to `--tlsMode disabled`.
3. Remove or empty `custom_domains` in `deploy/zitadel-init.yaml`.
4. Rebuild and run init, then restart services:
   ```bash
   cd deploy
   docker compose build zitadel-init
   docker compose run --rm zitadel-init
   cd ..
   make fresh
   ```

## Troubleshooting

### "Instance not found" on custom domain

Zitadel does not recognize the Host header. Check that the domain is registered as a trusted domain:

```bash
docker compose -f deploy/docker-compose.yml logs zitadel-init 2>&1 | grep -i "trusted\|domain"
```

If the domain is missing, re-run `docker compose run --rm zitadel-init`.

### External Secure shows false despite config

The `--tlsMode disabled` flag overrides `ExternalSecure` to `false`. Change it to `--tlsMode external` in `deploy/docker-compose.yml` and restart Zitadel.

### OIDC issuer mismatch errors

The `ZITADEL_ISSUER` in `.env` must match exactly what Zitadel returns in `/.well-known/openid-configuration`. If you changed `ExternalDomain` after the first init run, re-run the init to regenerate `.env`, then restart services with `make fresh`.

### SSO redirect URI mismatch (AADSTS50011)

The IdP callback URL is constructed from request headers, not from `ExternalDomain`. If the callback URL is `https://localhost:8080/idps/callback` instead of your external domain:

1. Check that `ZITADEL_EXTERNAL_HOST` is set in `deploy/.env`:
   ```bash
   grep ZITADEL_EXTERNAL_HOST deploy/.env
   ```
2. Verify the Login UI has the header configured:
   ```bash
   docker exec login-ui sh -c 'printenv CUSTOM_REQUEST_HEADERS'
   # Expected: x-zitadel-instance-host:zitadel.example.com
   ```
3. If missing, re-run `docker compose build zitadel-init && docker compose run --rm zitadel-init` to regenerate `.env`, then `make fresh`.

Also ensure the redirect URI `https://your-domain/idps/callback` is registered in your identity provider's app registration.

### API cannot verify tokens

The API fetches JWKS from `http://localhost:8080/oauth/v2/keys` (via `ZITADEL_INTERNAL_ADDR`). If Zitadel is not reachable on localhost, the API cannot verify tokens. Check that Zitadel is running and healthy: `curl http://localhost:8080/debug/healthz`.

## Configuration Reference

| File | Setting | Purpose |
|---|---|---|
| `deploy/zitadel-defaults.yaml` | `ExternalDomain` | Primary public domain |
| `deploy/zitadel-defaults.yaml` | `ExternalPort` | Public-facing port (443 for HTTPS) |
| `deploy/zitadel-defaults.yaml` | `ExternalSecure` | Whether external access uses HTTPS |
| `deploy/zitadel-defaults.yaml` | `TLS.Enabled` | Whether Zitadel terminates TLS itself (usually false behind a proxy) |
| `deploy/zitadel-init.yaml` | `custom_domains` | List of additional domains to register as trusted |
| `deploy/docker-compose.yml` | `--tlsMode` | Must match TLS setup (`external` for reverse proxy) |
| `deploy/.env` | `ZITADEL_ISSUER` | Auto-generated by init; used by API and frontend |
| `deploy/.env` | `VITE_ZITADEL_ISSUER` | Auto-generated by init; used by frontend |
| `deploy/.env` | `ZITADEL_EXTERNAL_HOST` | Auto-generated by init; drives Login UI's `CUSTOM_REQUEST_HEADERS` |
| `deploy/docker-compose.yml` | `CUSTOM_REQUEST_HEADERS` | Injects `x-zitadel-instance-host` header into Login UI → Zitadel calls |

## References

- [Zitadel Custom Domain docs](https://zitadel.com/docs/self-hosting/manage/custom-domain)
- [Zitadel Configuration reference](https://github.com/zitadel/zitadel/blob/main/cmd/defaults.yaml)
- [Cloudflare Tunnel guide](cloud-flare-tunnel.md)
- [Azure AD SSO setup](sso/azure-ad.md)