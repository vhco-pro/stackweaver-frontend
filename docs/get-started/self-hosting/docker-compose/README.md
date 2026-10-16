---
description: "Docker Compose deployment guide covering services, configuration, and management"
covers:
  - "deploy/docker-compose.yml"
  - "deploy/sso.env.example"
  - "deploy/vcs.env.example"
  - "deploy/oidc.env.example"
  - "scripts/zitadel-init/**"
---

# Docker Compose Deployment

This guide walks through deploying StackWeaver using Docker Compose on a single machine.
This is the quickest way to get started for evaluation or small-scale production use.
No source code is required; all services use pre-built container images from GHCR.

## Prerequisites

You need the following installed on your host machine.

- Docker Engine 24+ with Docker Compose v2
- At least 4 GB of free RAM (8 GB recommended)
- Ports 5173 (frontend), 8022 (API), and 8080 (Zitadel) available
- Pull access to the private StackWeaver images on GHCR (API, frontend, orchestrator, OpenTofu runner, and Zitadel init). Request access and create a `read:packages` token as described in Steps 1 and 2 of [Creating a Kubernetes Pull Secret for GHCR](../kubernetes/kubernetes-pull-secret-ghcr.md), then run `docker login ghcr.io -u <your-github-username>` and paste the token as the password.

## Example Files

The complete Docker Compose setup is shown below. Download or copy these files into a directory on your host.

::: code-explorer ./example
:::

## Quick Start

Copy the example files into a directory, generate an encryption key and a workload identity signing key, and start all services.

```bash
cp .env.example .env

# The api, zitadel-init and runner services read these three files directly, so
# they must exist before Compose starts even when you configure nothing in them.
# Leave sso.env and vcs.env as-is for a plain installation; fill them in when you
# add SSO, email (SMTP) or a VCS provider.
cp sso.env.example sso.env
cp vcs.env.example vcs.env
cp oidc.env.example oidc.env

# Generate the workload identity signing key. This is required: the API refuses
# to start without OIDC_SIGNING_KEY, even when you do not use workload identity.
sed -i.bak "s|^OIDC_SIGNING_KEY=.*|OIDC_SIGNING_KEY=$(openssl genrsa 2048 | openssl base64 -A)|" oidc.env

# Generate a unique 32-byte encryption key. This is required: the Ansible runner
# refuses to start with a missing or all-zero key, and Compose will not bring the
# stack up until it is set. The key encrypts stored credentials at rest.
sed -i.bak "s/^ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$(openssl rand -hex 32)/" .env
rm -f oidc.env.bak .env.bak

docker compose up -d
```

This starts all services (PostgreSQL, Redis, Garage, Zitadel, the API, frontend, orchestrator, runners) on a single user-defined bridge network.
The first run takes a few minutes while Zitadel initialises and the `zitadel-init` container generates credentials and writes them to `.env`. That one command is all the first run needs: the API waits for `zitadel-init` and reads `.env` itself when it starts, and a small `frontend-config` container then writes `env.js`, the frontend's runtime configuration, into the same directory.

You can follow the init progress with the following command.

```bash
docker compose logs -f zitadel-init
```

When all services are running, open `http://localhost:5173` in your browser.
The default Zitadel admin credentials are `admin@ZITADEL.localhost` / `Password1!`.

## Architecture

All services share one user-defined bridge network and reach each other by Docker DNS service name (`postgres`, `redis`, `garage`, `zitadel`, `api`). Only the three host-facing ports are published to your machine, so PostgreSQL, Redis and Garage are reachable from the other containers but not exposed on the host interface. This also means the stack behaves identically on Linux, macOS and Windows.

Published to your machine:

| Service | Port | Description |
|---|---|---|
| Frontend | 5173 | React SPA (nginx), includes the login UI under `/login/*`, and serves the API under the same address |
| API | 8022 | Go REST API, published for CLI clients and webhooks |
| Zitadel | 8080 | OIDC identity provider |

Internal to the Docker network, reachable by service name but not from your host:

| Service | Port | Description |
|---|---|---|
| `postgres` | 5432 | Database |
| `redis` | 6379 | Job queue and pubsub |
| `garage` | 3900 | S3-compatible object storage (state, configs, registry) |

To reach an internal service for debugging, either publish its port yourself or tunnel to it, for example `docker compose exec postgres psql -U iac -d iac_platform`.

The orchestrator, OpenTofu runner, and Ansible runner expose no ports at all. They communicate via the Redis queue and PostgreSQL.
Stackweaver serves its own login experience: the frontend SPA renders the login pages under `/login/*`, and the API's auth proxy under `/auth/*` forwards Zitadel session and OIDC calls. No separate login UI container runs.

The browser talks to one address only. The frontend's security policy allows calls to its own origin and nothing else, so the frontend's nginx forwards the API's paths (`/api/v2`, `/auth`, the `/.well-known` documents and `/v1/modules`) to the `api` service. The forwarding rules are in `frontend-proxy.conf` in the example directory, which the frontend container mounts, and `VITE_API_URL` in `.env` therefore points at the frontend's address (`http://localhost:5173/api/v2`). Port 8022 stays published for clients that call the API directly, such as the `tofu` CLI and VCS webhooks.

## Service Management

```bash
docker compose up -d                # Start all services
docker compose down                 # Stop all services (preserves data)
docker compose down -v              # Stop and remove volumes (destroys data)
docker compose pull                 # Pull latest images
docker compose up -d --pull always  # Update to latest and restart
```

View logs for a specific service.

```bash
docker compose logs api           # API logs
docker compose logs orchestrator  # Orchestrator logs
docker compose logs runner        # Runner logs
docker compose logs zitadel       # Zitadel logs
docker compose logs zitadel-init  # Init logs (credentials)
```

## Configuration

### Environment Files

StackWeaver uses several environment files. Most credentials are auto-generated by the `zitadel-init` container on first startup.

| File | Purpose | How to edit |
|---|---|---|
| `.env` | Main config + auto-generated Zitadel credentials | Copy from `.env.example`, edit the top section; bottom section is auto-generated by `zitadel-init` |
| `sso.env` | SSO / external IdP and identity mail (SMTP) credentials | Copy from `sso.env.example`; edit with your SSO provider and SMTP values, or leave empty |
| `vcs.env` | VCS provider OAuth credentials | Copy from `vcs.env.example`; edit with your VCS provider values, or leave empty |
| `oidc.env` | OIDC workload identity signing key | Copy from `oidc.env.example` and set `OIDC_SIGNING_KEY`, which is required; the issuer URL may stay empty |

The contents of `sso.env` and `vcs.env` are optional, but the files themselves are not: Compose reads them as `env_file` entries and refuses to start the stack if any is missing. Copy all three files from their `.example` counterparts even for a plain installation. In `oidc.env`, `OIDC_SIGNING_KEY` must be set, because the API refuses to start without it; the Quick Start generates one.

Sign-up verification, password reset and email login codes need an SMTP provider, configured in `sso.env`. Without one, StackWeaver switches those flows off and people get in through single sign-on or an administrator-created account. See [Email (SMTP) and sign-up](../email.md).

The API reads `.env` when it starts and gives it precedence over the environment its container was created with, which is how it receives the credentials `zitadel-init` generates. Change a setting in `.env` and apply it with `docker compose up -d`; a variable exported in your shell for a single command does not override `.env` for the API.

For a full list of every environment variable, see the [Environment Variables Reference](../environment-variables.md).

### Variables That Reach Runs

The `runner` and `ansible-runner` services receive the database, Redis and storage credentials, the encryption key, the signing key and the VCS secrets from these files, and none of that is passed to the runs they execute. OpenTofu, `ansible-playbook`, `ansible-inventory` and `ansible-galaxy` start with the run's own variables plus a fixed allowlist of the runner's environment (path, locale, proxy and CA settings, cloud identity variables and a few OpenTofu and Ansible settings), listed in [Runner variables that reach runs](../environment-variables.md#runner-variables-that-reach-runs). A variable you add to a runner service's `environment:` for your runs, such as a proxy credential, reaches them only when you also name it in `STACKWEAVER_RUN_ENV_PASSTHROUGH` on the same service, for example `STACKWEAVER_RUN_ENV_PASSTHROUGH=PROXY_USER,PROXY_PASSWORD`.

### GitHub App Integration

The GitHub App integration is optional and disabled by default. To enable it, uncomment the GitHub App ID, name, and private key path entries and the key volume mount in `docker-compose.yml` for the `api` and `orchestrator` services, and place your GitHub App private key file in the same directory as `docker-compose.yml`. The webhook secret and the app's OAuth client ID and secret (`GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, which connecting an installation needs) belong in `vcs.env`, not in `docker-compose.yml`; the [GitHub App guide](../../../user-guides/vcs/github-app.md) walks through every step.

See the [VCS guides](../../../user-guides/vcs/) for detailed setup instructions.

### Custom Domain (Production)

By default StackWeaver runs on `localhost`. To use a custom domain, update the following.

1. Edit `zitadel-defaults.yaml` and set the `ExternalDomain`, `ExternalPort`, and `ExternalSecure` fields.
2. Set `ZITADEL_EXTERNAL_HOST` in `.env` to the same domain and `ZITADEL_ISSUER` to its full URL. The API names the Zitadel instance with `ZITADEL_EXTERNAL_HOST`, so both must be correct before the services start. When TLS terminates at your reverse proxy, also set `ZITADEL_TLS_MODE=external` in `.env`, so that Zitadel issues tokens with the `https` issuer the API expects.
3. Set the `ZITADEL_CUSTOM_DOMAINS` environment variable in `.env`.
4. Update the frontend settings (`VITE_API_URL`, `VITE_ZITADEL_REDIRECT_URI`) in `.env`.
5. Update `zitadel-init.yaml` with custom domain and redirect URIs.
6. Recreate all services: `docker compose down && docker compose up -d`.

See the [Zitadel Setup guide](../../../user-guides/authentication/zitadel-setup.md) for detailed instructions.

### Reverse Proxy

For production deployments behind a reverse proxy (nginx, Caddy, Cloudflare Tunnel), you need to route two domains.

```mermaid
flowchart LR
    Client([Browser / Terraform CLI])

    Client --> AppDomain["app.example.com"]
    Client --> AuthDomain["auth.example.com"]

    AppDomain -->|"/api/v2/*\n/auth/*\n/.well-known/*\n/v1/modules/*\n/health"| API["API :8022"]
    AppDomain -->|"/auth/callback, /auth/login\nEverything else (incl. /login/*)"| Frontend["Frontend :5173"]

    AuthDomain --> Zitadel["Zitadel :8080"]
```

**App domain** (e.g. `app.example.com`):
- `/auth/callback` and `/auth/login` → `localhost:5173`. These two are pages of the SPA, so match them before the `/auth/*` rule below.
- `/api/v2/*`, `/auth/*`, `/.well-known/terraform.json`, `/.well-known/openid-configuration`, `/.well-known/jwks`, `/v1/modules/*`, `/health` → `localhost:8022`
- Everything else (including the SPA's `/login/*` login pages) → `localhost:5173`

The frontend already forwards the API's paths to the API, so sending the whole app domain to `localhost:5173` also works. Routing the API's paths straight to port 8022, as listed above, saves that extra hop.

**Auth domain** (e.g. `auth.example.com`):
- All traffic → `localhost:8080`. Stackweaver serves login through its own SPA pages under the app domain's `/login/*`, with `/auth/*` on the app domain proxying Zitadel's session + OIDC APIs.

## Data Persistence

Docker Compose uses named volumes for persistent data.

| Volume | Data | Critical? |
|---|---|---|
| `postgres_data` | Database (all application state) | Yes; back up regularly |
| `garage_data` | Object storage (OpenTofu state, configs, registry) | Yes; back up regularly |
| `garage_meta` | Garage metadata (the index of the objects in `garage_data`) | Yes; back up together with `garage_data` |
| `runner-workspaces` | Temporary workspace files of the OpenTofu runner | No; recreated on runs |
| `ansible-workspaces` | Temporary per-job files and the Galaxy cache of the Ansible runner | No; recreated on jobs |
| `zitadel-pat` | Zitadel admin PAT (shared with init job) | No; regenerated on init |

To back up PostgreSQL, use `pg_dump`.

```bash
docker exec postgres pg_dump -U iac iac_platform > backup.sql
```

## Upgrading

Pull the latest images and restart.

```bash
docker compose pull
docker compose up -d
```

The API auto-migrates the database schema on startup via GORM, so no manual migration step is needed.
If a release includes breaking changes, the release notes will contain specific upgrade instructions.

## Troubleshooting

**Services fail to start**: Check that the three published ports are free. `ss -tlnp | grep -E '5173|8022|8080'` shows any conflicts.

**Zitadel init fails**: The `zitadel-init` container needs Zitadel to be fully ready. Check `docker compose logs zitadel-init` and run it again with `docker compose run --rm --no-deps zitadel-init`, which reads the env files afresh and leaves the other services running.

**API can't connect to database**: Ensure PostgreSQL is healthy. `docker compose ps postgres` should show `healthy`. Check that the database credentials in `.env` match the PostgreSQL container environment.

**Frontend shows blank page**: Check browser console for CORS errors. Ensure `VITE_API_URL` is set correctly in `.env`. The `frontend-config` container writes `env.js` from `.env` each time the stack is brought up, so `docker compose up -d` applies a change; reload the page afterwards.

## Development Setup

If you want to build StackWeaver from source for development or contribution, you need to contact us directly, due to the current nature of open source we have opted for a source available approach. If you are a talented developer and your interested in contributing to stackweaver feel free to reach us at `contact@vhco.pro`.
