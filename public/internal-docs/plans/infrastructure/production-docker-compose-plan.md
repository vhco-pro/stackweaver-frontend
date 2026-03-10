# Production Docker Compose — Implementation Plan

> **Goal:** Create a user-facing Docker Compose example that uses pre-built container images from GHCR (no source code required). The example lives inside the docs directory and is rendered via the `::: code-explorer` directive. It does NOT replace the existing `deploy/docker-compose.yml` (which is the internal development compose file).

---

## Context

### Current state

- `deploy/docker-compose.yml` — development compose; uses `build: context: ../backend` directives to build everything from source. Requires the full repo checkout.
- `docs/get-started/self-hosting/docker-compose/README.md` — user-facing docs page that currently describes the development process (clone repo, `make up`). This will be updated to reference the new example.
- The Kustomize guide already uses this pattern: `docs/get-started/self-hosting/kubernetes/kustomize/example/` + `::: code-explorer ./example` directive.

### Pre-built images (from `deploy/helm/stackweaver/values.yaml` and `docs/internal/release-process.md`)

| Service | Image |
|---|---|
| API | `ghcr.io/vhco-pro/stackweaver-api:latest` |
| Frontend | `ghcr.io/vhco-pro/stackweaver-frontend:latest` |
| Orchestrator | `ghcr.io/vhco-pro/stackweaver-orchestrator:latest` |
| Terraform Runner | `ghcr.io/vhco-pro/stackweaver-runner:latest` |
| Ansible Runner | `ghcr.io/vhco-pro/stackweaver-ansible-runner:latest` |
| Zitadel Init | `ghcr.io/vhco-pro/stackweaver-zitadel-init:latest` |
| Zitadel | `ghcr.io/zitadel/zitadel:latest` |
| Login UI | `ghcr.io/zitadel/zitadel-login:v4.11.1` |
| PostgreSQL | `postgres:17` |
| Redis | `redis:7-alpine` |
| MinIO | `minio/minio:latest` |

### Frontend runtime configuration

The production frontend image serves static files via nginx. It does NOT use Vite build-time `VITE_*` env vars. Instead, it reads `window.__STACKWEAVER__` from an `env.js` file mounted at `/usr/share/nginx/html/env.js`. The compose file must generate or mount this file. This is the same mechanism used by the Helm chart (see `deploy/helm/stackweaver/templates/frontend/configmap-frontend.yaml`).

### Key differences from the dev compose

| Aspect | Dev (`deploy/docker-compose.yml`) | Production (new) |
|---|---|---|
| Images | Built from source (`build:`) | Pre-built from `ghcr.io/vhco-pro/*` (`image:`) |
| Source code | Required (full repo) | Not required |
| Frontend env | Vite dev server injects `VITE_*` | `env.js` mounted into nginx container |
| Config file | `../backend/config/config.yaml` volume mount | Embedded config via `configs:` top-level key or inline |
| GitHub App key | File mount from `deploy/` | File mount from local directory |
| Zitadel config | File mounts from `deploy/` directory | Inline via `configs:` or file mounts from example directory |
| Network | `network_mode: host` | `network_mode: host` (same — simplest for single-machine) |

---

## Files to Create

All files go under `docs/get-started/self-hosting/docker-compose/example/`.

### 1. `docker-compose.yml`

**Path:** `docs/get-started/self-hosting/docker-compose/example/docker-compose.yml`

This is the main file. Key requirements:

- **NO `build:` directives** — every service uses `image:`.
- Uses `network_mode: host` (same as dev, simplest for single-machine deployment).
- All services from the dev compose must be present: `postgres`, `redis`, `minio`, `zitadel`, `login-ui`, `zitadel-init`, `api`, `frontend`, `orchestrator`, `runner`, `ansible-runner`.
- Named volumes: `postgres_data`, `minio_data`, `runner-workspaces`, `zitadel-pat`.
- The `api` service needs a `config.yaml` — use Docker Compose `configs:` top-level key with an inline config block (avoids needing a separate file).
- The `frontend` service needs an `env.js` file mounted at `/usr/share/nginx/html/env.js` — use Docker Compose `configs:` or a volume mount to `./env.js`.
- `zitadel-init` uses the pre-built image `ghcr.io/vhco-pro/stackweaver-zitadel-init:latest` (NOT built from `scripts/zitadel-init/`).
- Zitadel needs `zitadel-defaults.yaml` and `zitadel-init-steps.yaml` — embed via Docker Compose `configs:` top-level key.
- All env vars reference a `.env` file using `env_file:` — users copy from `.env.example`.
- Optional env files (`sso.env`, `vcs.env`, `oidc.env`) are referenced with `env_file:` — include them with a comment that they're optional.
- Remove all hardcoded development-specific values (e.g., specific GitHub App IDs, webhook secrets).
- Use `${VARIABLE:-default}` syntax for sensible defaults.
- Add clear comments throughout.

**Service-by-service specification:**

#### `postgres`
```yaml
postgres:
  image: postgres:17
  container_name: postgres
  restart: unless-stopped
  environment:
    POSTGRES_USER: ${POSTGRES_USER:-iac}
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-iac_password}
    POSTGRES_DB: ${POSTGRES_DB:-iac_platform}
  volumes:
    - postgres_data:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-iac} -d ${POSTGRES_DB:-iac_platform}"]
    interval: 10s
    timeout: 5s
    retries: 5
  network_mode: host
```
Note: Remove the `init-postgres.sql` mount. The API auto-creates the UUID extension via GORM migrations, and the `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` is only needed for the dev setup. Actually — check whether the API really does this or relies on the init SQL. If it relies on the init SQL, we need to inline it via configs or keep it as a separate file. **Decision: include it as a Docker Compose `configs:` entry** since it's a single line. Use this approach:
```yaml
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - postgres-init:/docker-entrypoint-initdb.d/init.sql:ro
# ...
configs:
  postgres-init:
    content: |
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```
Wait — Docker Compose `configs:` with `content:` was added in Compose v2.23.1+ (Dec 2023). This may not be available to all users. **Safer approach: include the SQL as a separate file in the example directory.** Actually, even simpler — just include the single CREATE EXTENSION line as part of the compose via a command or init script. Let's keep it as a separate file since the code explorer will display it nicely.

#### `redis`
```yaml
redis:
  image: redis:7-alpine
  container_name: redis
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
  network_mode: host
```

#### `minio`
```yaml
minio:
  image: minio/minio:latest
  container_name: minio
  restart: unless-stopped
  environment:
    MINIO_ROOT_USER: ${MINIO_ACCESS_KEY:-minioadmin}
    MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY:-minioadmin}
  command: server /data --console-address ":9001"
  volumes:
    - minio_data:/data
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
    interval: 30s
    timeout: 20s
    retries: 7
  network_mode: host
```

#### `zitadel`
Same as dev compose but WITHOUT any vhco.pro-specific domain config. Use `localhost` defaults in the embedded `zitadel-defaults.yaml` file.
```yaml
zitadel:
  image: ghcr.io/zitadel/zitadel:latest
  container_name: zitadel
  restart: unless-stopped
  command: >
    start-from-init
    --config /etc/zitadel/defaults.yaml
    --steps /etc/zitadel/init-steps.yaml
    --masterkey "${ZITADEL_MASTERKEY:-LfcvxoyK4yAwsyp5WYeA3siK61yl7064}"
    --tlsMode external
  env_file:
    - ./.env
  environment:
    ZITADEL_SERVICE_USER_TOKEN: ${ZITADEL_LOGIN_SERVICE_USER_TOKEN:-}
    ZITADEL_DATABASE_POSTGRES_HOST: localhost
    ZITADEL_LOGIN_UI_BASE_URL: ${ZITADEL_LOGIN_UI_BASE_URL:-http://localhost:3000/ui/v2/login}
    ZITADEL_LOGIN_UI_ORIGIN: ${ZITADEL_LOGIN_UI_ORIGIN:-http://localhost:3000}
  volumes:
    - ./zitadel-defaults.yaml:/etc/zitadel/defaults.yaml:ro
    - ./zitadel-init-steps.yaml:/etc/zitadel/init-steps.yaml:ro
    - zitadel-pat:/pat
  user: "0"
  depends_on:
    postgres:
      condition: service_healthy
  network_mode: host
```

#### `login-ui`
```yaml
login-ui:
  image: ghcr.io/zitadel/zitadel-login:v4.11.1
  container_name: login-ui
  restart: unless-stopped
  env_file:
    - ./.env
  environment:
    NEXT_PUBLIC_BASE_PATH: /ui/v2/login
    ZITADEL_API_URL: http://localhost:8080
    ZITADEL_SERVICE_USER_TOKEN: ${ZITADEL_LOGIN_SERVICE_USER_TOKEN:-}
    EMAIL_VERIFICATION: "false"
    CUSTOM_REQUEST_HEADERS: "x-zitadel-instance-host:${ZITADEL_EXTERNAL_HOST:-}"
  depends_on:
    zitadel:
      condition: service_started
    zitadel-init:
      condition: service_completed_successfully
  network_mode: host
```

#### `zitadel-init`
```yaml
zitadel-init:
  image: ghcr.io/vhco-pro/stackweaver-zitadel-init:latest
  container_name: zitadel-init
  env_file:
    - ./.env
    - ./sso.env
  environment:
    ZITADEL_ISSUER: ${ZITADEL_ISSUER:-http://localhost:8080}/ui/v2/login
    ZITADEL_INTERNAL_ADDR: localhost:8080
    PROJECT_ROOT: /config
    ZITADEL_ADMIN_USERNAME: admin@ZITADEL.localhost
    ZITADEL_ADMIN_PASSWORD: ${ZITADEL_ADMIN_PASSWORD:-Password1!}
    ZITADEL_PAT_PATH: /pat/admin.pat
    ZITADEL_PAT: ${ZITADEL_PAT:-}
    ZITADEL_CUSTOM_DOMAINS: ${ZITADEL_CUSTOM_DOMAINS:-}
  volumes:
    - zitadel-pat:/pat:ro
  depends_on:
    zitadel:
      condition: service_started
  restart: "no"
  network_mode: host
```
**IMPORTANT:** In the dev compose, `zitadel-init` mounts the entire repo (`..:/config`) because it reads things like `deploy/zitadel-init.yaml` for custom domain config. In the production compose, the `zitadel-init` image needs to work WITHOUT the repo. Check if the `PROJECT_ROOT` is truly required or if env vars can substitute everything. Looking at the zitadel-init code, the `PROJECT_ROOT` is used to find `deploy/zitadel-init.yaml` for custom domain/redirect config, AND to write `.env` file. In the user-facing compose, `zitadel-init` needs to write the auto-generated `.env` file to the local directory. **Mount the current directory: `.:/config`** and provide a `zitadel-init.yaml` in the example directory.

#### `api`
```yaml
api:
  image: ghcr.io/vhco-pro/stackweaver-api:latest
  container_name: api
  restart: unless-stopped
  env_file:
    - ./.env
    - ./sso.env
    - ./vcs.env
    - ./oidc.env
  environment:
    CONFIG_PATH: /etc/iac/config/config.yaml
    LOG_LEVEL: ${LOG_LEVEL:-info}
    ZITADEL_ISSUER: ${ZITADEL_ISSUER:-http://localhost:8080}
    ZITADEL_API_CLIENT_ID: ${ZITADEL_API_CLIENT_ID:-}
    ZITADEL_API_CLIENT_SECRET: ${ZITADEL_API_CLIENT_SECRET:-}
    ZITADEL_LOGIN_SERVICE_USER_TOKEN: ${ZITADEL_LOGIN_SERVICE_USER_TOKEN:-}
    ZITADEL_INTERNAL_ADDR: localhost:8080
    CORS_EXTRA_ORIGINS: ${CORS_EXTRA_ORIGINS:-}
    ZITADEL_WEBHOOK_IDP_SYNC_KEY: ${ZITADEL_WEBHOOK_IDP_SYNC_KEY:-}
    ZITADEL_WEBHOOK_COMPLEMENT_TOKEN_KEY: ${ZITADEL_WEBHOOK_COMPLEMENT_TOKEN_KEY:-}
    STACKWEAVER_APP_URL: ${STACKWEAVER_APP_URL:-http://localhost:5173}
    ANSIBLE_ENCRYPTION_KEY: ${ENCRYPTION_KEY:-00000000000000000000000000000000}
    STORAGE_BACKEND: minio
    STORAGE_BUCKET: terraform-registry
    MINIO_ENDPOINT: localhost:9000
    MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY:-minioadmin}
    MINIO_SECRET_KEY: ${MINIO_SECRET_KEY:-minioadmin}
    MINIO_USE_SSL: "false"
    # GitHub App (optional — leave empty to disable)
    GITHUB_APP_ID: ${GITHUB_APP_ID:-}
    GITHUB_APP_NAME: ${GITHUB_APP_NAME:-}
    GITHUB_APP_PRIVATE_KEY_PATH: /etc/github-app-private-key.pem
    GITHUB_WEBHOOK_SECRET: ${GITHUB_WEBHOOK_SECRET:-}
  volumes:
    - ./github-app-private-key.pem:/etc/github-app-private-key.pem:ro
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
    zitadel:
      condition: service_started
    zitadel-init:
      condition: service_completed_successfully
  healthcheck:
    test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8022/health"]
    interval: 10s
    timeout: 5s
    retries: 5
  network_mode: host
```
Note: The `config.yaml` is already embedded in the API image at `/etc/iac/config/config.yaml` (see the distribution Dockerfiles — they `COPY backend/config /etc/iac/config`). So NO config volume mount is needed. The env vars override the config file values. Similarly, the `github-app-private-key.pem` mount should be optional — use a conditional or just document that users should create an empty file if they don't have a GitHub App key. **Create a placeholder `github-app-private-key.pem` in the example directory (empty file) with a comment.**

#### `frontend`
```yaml
frontend:
  image: ghcr.io/vhco-pro/stackweaver-frontend:latest
  container_name: frontend
  restart: unless-stopped
  volumes:
    - ./env.js:/usr/share/nginx/html/env.js:ro
  depends_on:
    api:
      condition: service_started
    zitadel:
      condition: service_started
    zitadel-init:
      condition: service_completed_successfully
  healthcheck:
    test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:80/health"]
    interval: 10s
    timeout: 5s
    retries: 5
  network_mode: host
```
The `env.js` file is a separate file in the example directory (see file #3 below). The `zitadel-init` process auto-generates the `.env` file which contains `ZITADEL_FRONTEND_CLIENT_ID` — the user then puts this value into `env.js`. **Problem: this creates a chicken-and-egg issue.** The frontend needs the client ID from Zitadel init, but `env.js` is a static file.

**Solution:** Use a startup script / init container pattern. BUT Docker Compose doesn't have init containers. **Better solution:** Use a shell entrypoint wrapper that substitutes env vars into `env.js` at container start. The nginx image supports `envsubst` templates natively via `/etc/nginx/templates/`. However, our `env.js` isn't an nginx template.

**Simplest solution:** Mount `env.js` as a template and use a custom entrypoint. Actually, the cleanest approach for Docker Compose is:
1. On first run, `zitadel-init` writes `.env` (containing `ZITADEL_FRONTEND_CLIENT_ID`).
2. Provide an `env.js.template` file with `${ZITADEL_FRONTEND_CLIENT_ID}` placeholder.
3. Override the frontend entrypoint to run `envsubst` on the template, then start nginx.

**But this adds complexity.** The simplest production-ready approach: provide the `env.js` as a separate file that users fill in AFTER the first `docker compose up` (which runs `zitadel-init` and generates `.env`). Document that they need to:
1. Run `docker compose up -d` (first run — zitadel-init generates `.env`)
2. Copy `ZITADEL_FRONTEND_CLIENT_ID` from `.env` into `env.js`
3. Run `docker compose restart frontend`

**Even simpler:** Use the `environment` + custom entrypoint approach. Override the frontend command to:
```yaml
entrypoint: ["/bin/sh", "-c"]
command:
  - |
    cat > /usr/share/nginx/html/env.js << 'ENVJS'
    window.__STACKWEAVER__ = {
      VITE_API_URL: "$${VITE_API_URL}",
      VITE_ZITADEL_ISSUER: "$${VITE_ZITADEL_ISSUER}",
      VITE_ZITADEL_CLIENT_ID: "$${VITE_ZITADEL_CLIENT_ID}",
      VITE_ZITADEL_REDIRECT_URI: "$${VITE_ZITADEL_REDIRECT_URI}",
    };
    ENVJS
    nginx -g 'daemon off;'
```
With env vars set:
```yaml
environment:
  VITE_API_URL: ${VITE_API_URL:-http://localhost:8022/api/v2}
  VITE_ZITADEL_ISSUER: ${VITE_ZITADEL_ISSUER:-http://localhost:8080}
  VITE_ZITADEL_CLIENT_ID: ${ZITADEL_FRONTEND_CLIENT_ID:-}
  VITE_ZITADEL_REDIRECT_URI: ${VITE_ZITADEL_REDIRECT_URI:-http://localhost:5173/auth/callback}
```
This is the cleanest. `ZITADEL_FRONTEND_CLIENT_ID` comes from the auto-generated `.env` file. **Use this approach.** No separate `env.js` file needed in the example. Remove `env.js` from the file list.

#### `orchestrator`
```yaml
orchestrator:
  image: ghcr.io/vhco-pro/stackweaver-orchestrator:latest
  container_name: orchestrator
  restart: unless-stopped
  env_file:
    - ./.env
    - ./vcs.env
  environment:
    CONFIG_PATH: /etc/iac/config/config.yaml
    REDIS_HOST: localhost
    REDIS_PORT: 6379
    REDIS_PASSWORD: ""
    REDIS_DB: 0
    GITHUB_APP_ID: ${GITHUB_APP_ID:-}
    GITHUB_APP_NAME: ${GITHUB_APP_NAME:-}
    GITHUB_APP_PRIVATE_KEY_PATH: /etc/github-app-private-key.pem
  volumes:
    - ./github-app-private-key.pem:/etc/github-app-private-key.pem:ro
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
    api:
      condition: service_started
  network_mode: host
```

#### `runner`
```yaml
runner:
  image: ghcr.io/vhco-pro/stackweaver-runner:latest
  container_name: runner
  restart: unless-stopped
  env_file:
    - ./.env
    - ./oidc.env
  environment:
    CONFIG_PATH: /etc/iac/config/config.yaml
    REDIS_HOST: localhost
    REDIS_PORT: 6379
    REDIS_PASSWORD: ""
    REDIS_DB: 0
    STORAGE_BACKEND: minio
    STORAGE_BUCKET: terraform-registry
    MINIO_ENDPOINT: localhost:9000
    MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY:-minioadmin}
    MINIO_SECRET_KEY: ${MINIO_SECRET_KEY:-minioadmin}
    MINIO_USE_SSL: "false"
    ENCRYPTION_KEY: ${ENCRYPTION_KEY:-00000000000000000000000000000000}
  volumes:
    - runner-workspaces:/home/iac/workspaces
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
    minio:
      condition: service_healthy
    orchestrator:
      condition: service_started
  network_mode: host
```

#### `ansible-runner`
```yaml
ansible-runner:
  image: ghcr.io/vhco-pro/stackweaver-ansible-runner:latest
  container_name: ansible-runner
  restart: unless-stopped
  env_file:
    - ./.env
    - ./vcs.env
    - ./oidc.env
  environment:
    REDIS_HOST: localhost
    REDIS_PORT: 6379
    REDIS_PASSWORD: ""
    DATABASE_HOST: localhost
    DATABASE_PORT: 5432
    DATABASE_USER: ${POSTGRES_USER:-iac}
    DATABASE_PASSWORD: ${POSTGRES_PASSWORD:-iac_password}
    DATABASE_NAME: ${POSTGRES_DB:-iac_platform}
    STORAGE_ENDPOINT: localhost:9000
    STORAGE_ACCESS_KEY: ${MINIO_ACCESS_KEY:-minioadmin}
    STORAGE_SECRET_KEY: ${MINIO_SECRET_KEY:-minioadmin}
    STORAGE_BUCKET: ansible-artifacts
    STORAGE_USE_SSL: "false"
    ANSIBLE_ENCRYPTION_KEY: ${ENCRYPTION_KEY:-00000000000000000000000000000000}
    WORKSPACES_DIR: /home/iac/workspaces
    ANSIBLE_HOST_KEY_CHECKING: "false"
    ANSIBLE_RETRY_FILES_ENABLED: "false"
    ANSIBLE_RUNNER_KEEP_WORKSPACE: "true"
  volumes:
    - runner-workspaces:/home/iac/workspaces
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
    minio:
      condition: service_healthy
    api:
      condition: service_started
  network_mode: host
```

### 2. `.env.example`

**Path:** `docs/get-started/self-hosting/docker-compose/example/.env.example`

This is the main env file that the user copies to `.env`. On first run, `zitadel-init` auto-generates and overwrites parts of it (the Zitadel client IDs and tokens).

```env
# StackWeaver Docker Compose — Environment Variables
# Copy this file to .env before starting:  cp .env.example .env
#
# On first startup, the zitadel-init container auto-generates Zitadel
# credentials and appends them to this file. Do not edit those values.

# ── Database ─────────────────────────────────────────────────────────
POSTGRES_USER=iac
POSTGRES_PASSWORD=iac_password
POSTGRES_DB=iac_platform

# ── MinIO / Object Storage ───────────────────────────────────────────
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# ── Encryption ───────────────────────────────────────────────────────
# 32-byte hex key for encrypting sensitive data (Ansible credentials, etc.)
# Generate with: openssl rand -hex 32
ENCRYPTION_KEY=00000000000000000000000000000000

# ── Zitadel ──────────────────────────────────────────────────────────
# Masterkey for Zitadel encryption (must be exactly 32 characters)
ZITADEL_MASTERKEY=LfcvxoyK4yAwsyp5WYeA3siK61yl7064

# Admin password for the default Zitadel admin user (admin@ZITADEL.localhost)
ZITADEL_ADMIN_PASSWORD=Password1!

# Zitadel issuer URL (change if using a custom domain)
ZITADEL_ISSUER=http://localhost:8080

# ── Frontend ─────────────────────────────────────────────────────────
# These are used by the frontend container to configure the SPA at startup.
# Change these if using a custom domain or reverse proxy.
VITE_API_URL=http://localhost:8022/api/v2
VITE_ZITADEL_ISSUER=http://localhost:8080
VITE_ZITADEL_REDIRECT_URI=http://localhost:5173/auth/callback

# ── Application URL ─────────────────────────────────────────────────
# Public URL of the StackWeaver frontend (used for GitHub App callback URLs)
STACKWEAVER_APP_URL=http://localhost:5173

# ── GitHub App (optional) ────────────────────────────────────────────
# GITHUB_APP_ID=
# GITHUB_APP_NAME=
# GITHUB_WEBHOOK_SECRET=

# ── Custom Domain (optional) ────────────────────────────────────────
# ZITADEL_CUSTOM_DOMAINS=auth.example.com
# CORS_EXTRA_ORIGINS=https://app.example.com

# ── Log Level ────────────────────────────────────────────────────────
LOG_LEVEL=info

# ─────────────────────────────────────────────────────────────────────
# Everything below this line is auto-generated by zitadel-init.
# Do not edit manually.
# ─────────────────────────────────────────────────────────────────────
```

### 3. `sso.env`

**Path:** `docs/get-started/self-hosting/docker-compose/example/sso.env`

Copy of `deploy/sso.env.example` content. Must exist (even if empty) because Docker Compose `env_file:` fails if the file is missing.

```env
# SSO / IdP configuration (optional)
# See docs/user-guides/sso/ for provider-specific guides.

# Azure AD / Entra ID
AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=
AZURE_AD_TENANT_ID=

# Generic OIDC (Okta, Cognito, etc.)
OIDC_IDP_NAME=
OIDC_IDP_ISSUER=
OIDC_IDP_CLIENT_ID=
OIDC_IDP_CLIENT_SECRET=

# Team sync
ENABLE_OIDC_TEAM_SYNC=true
OIDC_REMOVE_FROM_NON_SSO_TEAMS=false
```

### 4. `vcs.env`

**Path:** `docs/get-started/self-hosting/docker-compose/example/vcs.env`

```env
# VCS Provider configuration (optional)
# See docs/user-guides/vcs/ for provider-specific setup guides.

# Stackweaver public API base URL for webhook registration
#STACKWEAVER_WEBHOOK_BASE_URL=

# Azure DevOps — Microsoft Entra ID OAuth2
#AZURE_DEVOPS_CLIENT_ID=
#AZURE_DEVOPS_CLIENT_SECRET=
#AZURE_DEVOPS_REDIRECT_URI=http://localhost:5173/vcs/azure-devops/callback
#AZURE_DEVOPS_TENANT_ID=common
```

### 5. `oidc.env`

**Path:** `docs/get-started/self-hosting/docker-compose/example/oidc.env`

```env
# OIDC Workload Identity configuration (optional)
# Required only for cloud provider integrations (Azure, AWS, GCP).
# See docs/user-guides/azure-oidc-configuration.md for details.

# Base64-encoded RSA-2048 private key for signing workload identity tokens.
# Generate with: openssl genrsa 2048 | base64 -w 0
OIDC_SIGNING_KEY=

# Public issuer URL for OIDC tokens. Must match your cloud provider config.
OIDC_ISSUER_URL=
```

### 6. `zitadel-defaults.yaml`

**Path:** `docs/get-started/self-hosting/docker-compose/example/zitadel-defaults.yaml`

Simplified version of `deploy/zitadel-defaults.yaml` with `localhost` defaults:

```yaml
ExternalDomain: localhost
ExternalPort: 8080
ExternalSecure: false
TLS:
  Enabled: false

Database:
  Postgres:
    Host: localhost
    Port: 5432
    Database: zitadel
    Admin:
      Username: iac
      Password: iac_password
      SSL:
        Mode: disable
    User:
      Username: iac
      Password: iac_password
      SSL:
        Mode: disable

DefaultInstance:
  LoginPolicy:
    AllowUsernamePassword: true
    AllowExternalIDPs: true
  Org:
    LoginPolicy:
      AllowUsernamePassword: true
  Features:
    LoginDefaultOrg: true
    LoginV2:
      Required: true
      BaseURI: http://localhost:3000/ui/v2/login
  OIDCSettings:
    AccessTokenLifetime: 12h
    IdTokenLifetime: 12h
    RefreshTokenIdleExpiration: 720h
    RefreshTokenExpiration: 2160h
```

**IMPORTANT:** Do NOT include the massive `InternalAuthZ` and `SystemAuthZ` role-permission blocks. These are baked into the Zitadel image defaults and only need overriding if custom permissions are required. Check whether Zitadel merges config files (it does — `start-from-init --config` is additive with built-in defaults). If so, we only need to specify the fields we're overriding. **Confirm this is correct by checking Zitadel docs** — yes, Zitadel uses a layered config system where the `--config` flag merges on top of built-in defaults.

Wait — the dev compose includes the full `InternalAuthZ`/`SystemAuthZ` blocks because the project needs custom role-permission mappings that aren't in the Zitadel defaults. **These blocks are REQUIRED for StackWeaver to function correctly.** Include the full file.

**Action:** Copy the full `deploy/zitadel-defaults.yaml` but change the top three lines to localhost defaults:
- `ExternalDomain: localhost`
- `ExternalPort: 8080`
- `ExternalSecure: false`

Leave everything else identical.

### 7. `zitadel-init-steps.yaml`

**Path:** `docs/get-started/self-hosting/docker-compose/example/zitadel-init-steps.yaml`

Identical to `deploy/zitadel-init-steps.yaml`:

```yaml
FirstInstance:
  Skip: false
  PatPath: /pat/admin.pat
  InstanceName: "StackWeaver"
  DefaultLanguage: en
  Org:
    Name: ZITADEL
    Human:
      UserName: admin
      FirstName: Admin
      LastName: User
      Email:
        Address: admin@zitadel.localhost
        Verified: true
      Password: Password1!
      PasswordChangeRequired: false
    Machine:
      Machine:
        Username: admin
        Name: "Automatically Initialized IAM_OWNER"
      Pat:
        ExpirationDate: "2029-01-01T00:00:00Z"
```

### 8. `init-postgres.sql`

**Path:** `docs/get-started/self-hosting/docker-compose/example/init-postgres.sql`

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Files NOT needed

- **`config.yaml`** — Already embedded in the API and orchestrator images at `/etc/iac/config/config.yaml`. Env vars override values.
- **`env.js`** — Generated at container start via the frontend entrypoint override.
- **`github-app-private-key.pem`** — Make the volume mount conditional or document that users should create an empty placeholder. **Decision:** Don't mount it at all in the default compose. Use env var `GITHUB_APP_PRIVATE_KEY` (direct PEM content) instead of file path. Actually, check if the API supports this... Looking at the dev compose, it uses `GITHUB_APP_PRIVATE_KEY_PATH`. The API code likely reads from file. **Keep the file mount but make it optional.** Add a comment. Create an empty placeholder file OR use a Docker Compose profile to make GitHub services optional. **Simplest: don't include the GitHub App volume mount. Users can add it themselves following the VCS guide.** But this will cause a Docker error if the file doesn't exist... **Use a bind mount with `ro` flag and document it.** Actually, if the file doesn't exist Docker creates it as a directory. That's a problem. **Solution: remove the GitHub file mount entirely. Set `GITHUB_APP_PRIVATE_KEY_PATH` to a non-existent path and let the API handle it gracefully (it should — the GitHub integration is optional).** Or better: Don't set `GITHUB_APP_PRIVATE_KEY_PATH` at all if it's optional. Check whether the API crashes if the path doesn't exist... Looking at the dev compose, it's always set. **Safest: keep the mount and include an empty `github-app-private-key.pem` file in the example.** This way Docker won't error out.

Actually — the cleanest approach for the code explorer: just don't include the mount at all, and comment out the GitHub-related env vars. Users who need GitHub integration can follow the VCS docs to add the mount. If the env var isn't set, the API won't try to read the file.

Wait — looking more carefully at the dev compose, `GITHUB_APP_PRIVATE_KEY_PATH` is always set to `/etc/github-app-private-key.pem`. If the API always tries to read from this path regardless of whether GitHub integration is configured, it'll fail. But looking at the orchestrator too, it has the same mount. **Let's create the empty placeholder and include the mount.** This is the safest.

**REVISED: Do NOT include `github-app-private-key.pem` as a file. Instead, remove the volume mount and the `GITHUB_APP_PRIVATE_KEY_PATH` env var from the default compose. Add a comment block showing how to enable it.** This keeps the example clean.

---

## File List Summary

| # | File | Purpose |
|---|---|---|
| 1 | `docker-compose.yml` | Main compose file with all services using pre-built images |
| 2 | `.env.example` | Template env file — user copies to `.env` |
| 3 | `sso.env` | SSO config (empty defaults, must exist for `env_file:`) |
| 4 | `vcs.env` | VCS config (empty defaults, must exist for `env_file:`) |
| 5 | `oidc.env` | OIDC workload identity config (must exist for `env_file:`) |
| 6 | `zitadel-defaults.yaml` | Zitadel configuration (full copy with localhost defaults) |
| 7 | `zitadel-init-steps.yaml` | Zitadel first-instance bootstrap config |
| 8 | `init-postgres.sql` | PostgreSQL init script (UUID extension) |

Total: **8 files** in `docs/get-started/self-hosting/docker-compose/example/`

---

## Documentation Changes

### Update `docs/get-started/self-hosting/docker-compose/README.md`

The current README describes the development workflow (`git clone`, `make up`). It needs to be restructured to present the **production deployment** as the primary path, with a note about the development workflow for contributors.

**Changes:**

1. **Replace the "Quick Start" section** with instructions to:
   - Download/copy the example files (the code explorer shows them)
   - Copy `.env.example` to `.env`
   - Run `docker compose up -d`
   - Wait for `zitadel-init` to complete
   - Open `http://localhost:5173`

2. **Add the code explorer directive** right after the intro paragraph:
   ```markdown
   ::: code-explorer ./example
   :::
   ```

3. **Update the "Service Management" section** — remove `make` commands (those require the repo). Replace with raw `docker compose` commands:
   ```bash
   docker compose up -d          # Start all services
   docker compose down           # Stop all services (preserves data)
   docker compose down -v        # Stop and remove volumes (destroys data)
   docker compose pull           # Pull latest images
   docker compose up -d --pull   # Update to latest and restart
   ```

4. **Update the "Configuration" section** — reference the `.env` file and the optional env files. Remove the `make fresh-backend` references.

5. **Keep the "Architecture", "Reverse Proxy", "Data Persistence", "Upgrading", and "Troubleshooting" sections** mostly as-is. Update the "Upgrading" section to use `docker compose pull && docker compose up -d` instead of `git pull && make fresh`.

6. **Add a "Development Setup" section** at the bottom pointing to the repo README for contributors who want to build from source.

---

## Frontend Port Consideration

The production frontend image uses nginx on port **80** (not 5173). The architecture table and all references need to be updated:

| Service | Port (dev) | Port (production) |
|---|---|---|
| Frontend | 5173 (Vite) | 80 (nginx) |

Update the compose file and docs to reflect port 80 for the frontend. The `VITE_ZITADEL_REDIRECT_URI` default should use `http://localhost` (port 80 is implicit) or `http://localhost:80`.

Actually, using port 80 might conflict with other services on the host. The dev compose uses 5173 to avoid conflicts. For the production compose, we have two options:
1. Use port 80 (standard — but may conflict)
2. Map nginx to port 5173 to keep URLs consistent with docs

**Decision:** Keep port 80 in the nginx config but add a note about changing it if needed. The nginx.conf in the image listens on 80. With `network_mode: host`, the container binds to host port 80. If users want a different port, they can override with an nginx config mount or use a different network mode.

Actually — to keep the docs simpler and avoid port conflicts (many hosts run something on port 80), let's explicitly map to a different port. But we're using `network_mode: host`, so we can't use `ports:` mapping. We'd need to change the nginx config to listen on a different port.

**Simplest approach:** Add a custom nginx config file (or override via environment) to listen on port 5173 instead of 80. This keeps all URLs consistent with the existing docs. Include a `nginx.conf` in the example that listens on 5173.

Wait — this adds another file and complexity. Let's use Docker Compose `command` to sed the listen port:
```yaml
command: ["/bin/sh", "-c", "sed -i 's/listen 80/listen 5173/' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
```
But we already have a custom entrypoint for `env.js` generation. Combine them.

**Final frontend spec:**
```yaml
frontend:
  image: ghcr.io/vhco-pro/stackweaver-frontend:latest
  container_name: frontend
  restart: unless-stopped
  env_file:
    - ./.env
  environment:
    VITE_API_URL: ${VITE_API_URL:-http://localhost:8022/api/v2}
    VITE_ZITADEL_ISSUER: ${VITE_ZITADEL_ISSUER:-http://localhost:8080}
    VITE_ZITADEL_CLIENT_ID: ${ZITADEL_FRONTEND_CLIENT_ID:-}
    VITE_ZITADEL_REDIRECT_URI: ${VITE_ZITADEL_REDIRECT_URI:-http://localhost:5173/auth/callback}
  entrypoint: ["/bin/sh", "-c"]
  command:
    - |
      # Generate env.js with runtime configuration
      cat > /usr/share/nginx/html/env.js << EOF
      window.__STACKWEAVER__ = {
        VITE_API_URL: "$$VITE_API_URL",
        VITE_ZITADEL_ISSUER: "$$VITE_ZITADEL_ISSUER",
        VITE_ZITADEL_CLIENT_ID: "$$VITE_ZITADEL_CLIENT_ID",
        VITE_ZITADEL_REDIRECT_URI: "$$VITE_ZITADEL_REDIRECT_URI",
      };
      EOF
      # Change nginx listen port from 80 to 5173
      sed -i 's/listen 80/listen 5173/' /etc/nginx/conf.d/default.conf
      exec nginx -g 'daemon off;'
  depends_on:
    api:
      condition: service_started
    zitadel:
      condition: service_started
    zitadel-init:
      condition: service_completed_successfully
  healthcheck:
    test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:5173/health"]
    interval: 10s
    timeout: 5s
    retries: 5
  network_mode: host
```

This keeps port 5173 consistent and generates `env.js` dynamically from env vars. `ZITADEL_FRONTEND_CLIENT_ID` is auto-populated in `.env` by `zitadel-init`.

---

## Execution Checklist

The implementing model should:

1. **Create the 8 files** listed above in `docs/get-started/self-hosting/docker-compose/example/`.
2. **For `zitadel-defaults.yaml`:** Read the full `deploy/zitadel-defaults.yaml`, change the first 3 lines (ExternalDomain/Port/Secure to localhost defaults), and write to the example dir.
3. **Update `docs/get-started/self-hosting/docker-compose/README.md`** per the documentation changes section above.
4. **Verify** the code explorer directive works by checking the build-docs script processes it.
5. **Test mentally** the docker compose flow: user copies `.env.example` → `.env`, runs `docker compose up -d`, zitadel-init writes credentials to `.env`, services start.

### Critical details to get right

- Every `env_file:` reference must point to a file that EXISTS. The example includes `sso.env`, `vcs.env`, `oidc.env` as files with empty/commented values.
- The `.env.example` must be copied to `.env` — zitadel-init appends to `.env`, not `.env.example`.
- The frontend `entrypoint/command` override must use `$$` for shell variable references in YAML (Docker Compose escaping).
- `network_mode: host` means no port mapping — services bind directly to host ports.
- The `zitadel-init` container needs `.:/config` mount so it can write `.env` to the user's directory.

---

## Open Questions / Decisions for Review

1. **GitHub App private key:** Excluded from default compose. Users add it per the VCS guide. This means `GITHUB_APP_PRIVATE_KEY_PATH` should NOT be set in the default compose — the API should tolerate this var being absent. Verify this is the case.

2. **`zitadel-init` PROJECT_ROOT mount:** The `zitadel-init` binary expects `PROJECT_ROOT` to point to a directory where it can find `deploy/zitadel-init.yaml` and `deploy/.env`. In the example, the user's working directory IS the example directory, not the repo root. The `zitadel-init` binary writes `.env` to `$PROJECT_ROOT/deploy/.env`. This path needs to be adjusted. **The `zitadel-init` binary's behavior needs to be checked.** If it writes to `$PROJECT_ROOT/deploy/.env`, then `PROJECT_ROOT` should be set to `.` and `.env` will be at `./deploy/.env` which is wrong — we want it at `./.env`. **Resolution options:**
   a. Set `PROJECT_ROOT=/config` and mount `.:/config` — then `.env` goes to `/config/deploy/.env` which maps to `./deploy/.env`. Create a `deploy/` subdirectory in the example. Too complex.
   b. Check if `zitadel-init` supports writing `.env` to a configurable path.
   c. Set `PROJECT_ROOT` to the parent of the compose directory and mount appropriately.

   **ACTUALLY — look at the dev compose more carefully.** It mounts `..:/config` (the repo root) and sets `PROJECT_ROOT=/config`. The `zitadel-init` binary writes to `$PROJECT_ROOT/deploy/.env`. In the dev setup, that means it writes to the repo root's `deploy/.env`.

   For the production compose, we want `.env` in the same directory as `docker-compose.yml`. So we need `zitadel-init` to write to `./.env`. If `zitadel-init` always writes to `$PROJECT_ROOT/deploy/.env`, then set `PROJECT_ROOT` to the parent of `deploy/` which would be `./..`. But we don't want to write outside the user's directory.

   **BEST SOLUTION:** Create a `deploy/` symlink or subdirectory that `zitadel-init` can write to, OR check the `zitadel-init` source code to see exactly where it writes `.env`. The implementing model should read the `zitadel-init` source code (`scripts/zitadel-init/main.go` or `distribution/stackweaver-zitadel-init/main.go`) to determine the exact file path it writes to and adjust the mount accordingly.

   **Providing guidance:** The safest approach is to mount the example directory as a subdirectory called `deploy` inside the container: `-v .:/config/deploy` and set `PROJECT_ROOT=/config`. Then `zitadel-init` writes `/config/deploy/.env` which maps to `./.env` on the host.

3. **Frontend healthcheck port:** Must be 5173 after the nginx port change (handled above).

4. **`zitadel-init.yaml` (runtime config):** In the dev setup, `zitadel-init` reads `deploy/zitadel-init.yaml` for custom domain config. Include a minimal version in the example:
   ```yaml
   custom_domains: []
   frontend_redirect_uris: []
   frontend_post_logout_redirect_uris: []
   ```
   Mount location depends on where `zitadel-init` expects to find it relative to `PROJECT_ROOT`.

   **Add this as file #9:** `zitadel-init.yaml` in the example directory.
