<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Zitadel Setup Guide

This guide will help you set up Zitadel for authentication in the Stackweaver Orchestration Platform.

> **Note:**
> For a full configuration reference, see:
> - https://github.com/zitadel/zitadel/blob/main/cmd/defaults.yaml
> - https://github.com/zitadel/zitadel/blob/main/cmd/setup/steps.yaml
> for official production setup guide check:
> - https://zitadel.com/docs/self-hosting/manage/production

## Overview

Zitadel is an open-source identity and access management (IAM) system that provides:
- OpenID Connect (OIDC) and OAuth 2.0 support
- Multi-factor authentication (MFA)
- Passwordless authentication (FIDO2, Passkeys, OTP)
- User management and roles
- API access management

## Quick Start (Automated Go Bootstrap)

The repo ships with a Go bootstrap (`scripts/zitadel-init/main.go`) that uses the v2 Zitadel gRPC APIs. It creates/updates organizations, projects, OIDC apps, the API app, and the dedicated v2 Login UI service user, then writes all required `.env` files.

```bash
# 1. Start the stack
cd deploy
docker compose up -d --build

# 2. Run the initializer once
docker compose run --rm zitadel-init

# 3. Restart services so they pick up the new env files
docker compose up -d
```

> **Linux tip:** if you’re on a host that supports `network_mode: host`, run  
> `docker compose -f docker-compose.linux-host.yml up -d --build`  
> so every container can dial `localhost:8080` without extra aliases. The default compose file still includes `internal-zitadel`/`localhost-api` aliases for macOS/Windows.

## Step 1: Start Zitadel

Zitadel is defined in `deploy/docker-compose.yml` as the `localhost` service (exported on port `8080`). Start it together with Postgres/other dependencies:

```bash
cd deploy
docker compose up -d --build localhost postgres
# or bring up everything
docker compose up -d --build
```

## Step 2: Run the Go Bootstrap (v2 APIs)

The initializer container (`zitadel-init`) does the heavy lifting:

1. Waits for `/pat/admin.pat` (written by `zitadel-defaults.yaml`).
2. Uses the PAT to connect to Zitadel via gRPC (`internal-zitadel:8080` by default).
3. Creates/updates:
   - Organization `IAC Platform`
   - Project `IAC Platform Project`
   - Frontend OIDC app (code+PKCE)
   - API app (client secret)
   - Login UI service machine user + PAT (`IAM_LOGIN_CLIENT` role)
4. Writes the resulting values to:
   - `deploy/.env` (single source of truth for all environment variables)

Run it after the services are up:

```bash
cd deploy
docker compose run --rm zitadel-init
```

Environment variables you can override before launching:

**Reference**: See `scripts/zitadel-init/main.go` for environment variable handling.

| Variable | Description | Default |
| --- | --- | --- |
| `ZITADEL_ISSUER` | Public issuer used in `.env` | `http://localhost:8080` |
| `ZITADEL_INTERNAL_ADDR` | Host:port the initializer dials | `internal-zitadel:8080` |
| `ZITADEL_ADMIN_USERNAME` / `PASSWORD` | Matches `zitadel-init-steps.yaml` | `admin@ZITADEL.localhost` / `Password1!` |
| `PROJECT_ROOT` | Where env/config files are written | `/config` inside container |
| `ZITADEL_PAT` | Optional PAT override (instead of `/pat/admin.pat`) | empty |

If you ever need to re-run the initializer, make sure the PAT in `/pat/admin.pat` (or `ZITADEL_PAT`) is valid. The bootstrap is idempotent: existing apps/orgs are reused.

## Step 3: Manual Console Access (Optional)

You can still use the console if you need to inspect settings:

1. `http://localhost:8080/ui/console` (proxied through the same container)
2. Login with `admin@ZITADEL.localhost / Password1!` (or your rotated credentials)
3. Make manual edits (roles, branding, etc.)

## Step 4: Login UI and Login V2 Configuration

### What is Login V2?

Login V2 is Zitadel's external login UI feature that allows you to use a separate, customizable Next.js frontend for authentication instead of Zitadel's built-in login interface. This provides:

- **Customizable UI**: Full control over the login experience
- **Better UX**: Modern, responsive design
- **Separation of Concerns**: Login UI runs as a separate service
- **Automatic Redirects**: OAuth flows automatically redirect to the external login UI

### How It Works

1. **External Login UI Service**: A separate Next.js service (`login-ui`) runs on port `3000`
2. **Zitadel Backend**: Zitadel runs on port `8080` and handles OAuth/OIDC flows
3. **Automatic Redirects**: When users need to authenticate, Zitadel automatically redirects to the external login UI
4. **OAuth Flow**: After authentication, users are redirected back to your application

### Configuration in YAML

To enable Login V2, you must configure it in `deploy/zitadel-defaults.yaml` under the `DefaultInstance.Features` section.

**Reference**: See `deploy/zitadel-defaults.yaml` for the complete configuration.

**Key Configuration Options:**

- `LoginV2.Required: true` - Makes Login V2 mandatory (users cannot use built-in login)
- `LoginV2.BaseURI` - The base URL where your external login UI is accessible
  - Must include the full path: `http://localhost:3000/ui/v2/login`
  - This is where Zitadel will redirect users for authentication

**Important:** This YAML configuration is the primary way to enable Login V2. It must be set in `DefaultInstance.Features` for the feature to be enabled during bootstrap. Environment variables alone are not sufficient.

### Docker Compose Configuration

The `login-ui` service is configured in `deploy/docker-compose.yml`.

**Reference**: See `deploy/docker-compose.yml` for the complete `login-ui` service configuration.

**Important Environment Variables:**

- `NEXT_PUBLIC_BASE_PATH=/ui/v2/login` - The base path for the login UI routes
- `ZITADEL_API_URL=http://localhost:8080` - URL to the Zitadel backend API
- `ZITADEL_SERVICE_USER_TOKEN` - Token for the login service user (created by `zitadel-init`)

### Zitadel Service Configuration

The Zitadel service also needs environment variables to know about the external login UI.

**Reference**: See `deploy/docker-compose.yml` for the `zitadel` service environment variables.

## Docker Networking & Localhost Aliases

> **Note**: This section provides technical details about Docker networking for Zitadel. If you're just getting started, the default setup should work. Read this if you encounter networking issues or need to understand how localhost access works with Docker.

### Goals

The networking setup aims to:
- Keep `ExternalDomain` as `localhost` so browsers/OIDC metadata use `http://localhost:8080`
- Ensure Docker containers (init script, backend, etc.) can access Zitadel without trying to dial their own loopback

### Key Pieces

**Docker Compose Configuration** (`deploy/docker-compose.yml`):
- ZITADEL service (named `localhost`) publishes `8080:8080`
- Network aliases are added:
  ```yaml
  networks:
    default:
      aliases:
        - zitadel
        - internal-zitadel
  ```
- `zitadel-init` container receives:
  ```yaml
  - ZITADEL_ISSUER=http://localhost:8080
  - ZITADEL_INTERNAL_ADDR=internal-zitadel:8080
  ```
- Any other container can dial `http://internal-zitadel:8080` (or `http://zitadel:8080`) and resolve correctly
- The container reads `ZITADEL_LOGIN_SERVICE_USER_TOKEN` and wires it into `ZITADEL_SERVICE_USER_TOKEN` for the v2 Login UI
- `login-ui` (ghcr.io/zitadel/zitadel-login) listens on `8085`, serves Next.js app under `/ui/v2/login`, and uses `ZITADEL_API_URL=http://localhost-api:8080` plus the same PAT

**Bootstrap Script** (`scripts/zitadel-init/main.go`):
- Public issuer stays `http://localhost:8080`
- Accepts `ZITADEL_INTERNAL_ADDR` environment variable (defaults to `internal-zitadel:8080`)
- gRPC readiness checks and custom dialer use the alias to avoid container-local loopback confusion
- Provisions a dedicated login service user (role `IAM_LOGIN_CLIENT`), issues a PAT, and writes to `.env` / `deploy/.env` as `ZITADEL_LOGIN_SERVICE_USER_TOKEN`
- Stores service user ID as `ZITADEL_LOGIN_SERVICE_USER_ID` for inspection/rotation

### Usage Flow

1. `docker compose up -d --build` (from `deploy/`) - aliases and env vars are available. On Linux, you can use host networking: `docker compose -f docker-compose.linux-host.yml up -d --build` to bypass Docker DNS quirks. The host file runs every service with `network_mode: host`, so browsers hit your OCI box directly while macOS/Windows users stay on the default stack with aliases.

2. `docker compose run --rm zitadel-init` - script waits for `internal-zitadel:8080`, runs org/app provisioning, and writes `.env` files (including login service PAT and ID).

3. `docker compose up -d` - UI is reachable via `http://localhost:8085/ui/v2/login`, and Zitadel proxies `/ui/v2/login` on port 8080 to that path. Containers call `http://localhost-api:8080`, which resolves to the same service but preserves the `localhost` hostname expected by Zitadel's v2 APIs. If you used host-network override, the login UI automatically points at `http://localhost:8080`.

4. Any other service that previously hardcoded `zitadel:8080` continues to work because that alias still exists.

### Important Notes

- **macOS Docker limitation**: Do **not** rely on `localhost` inside Docker containers on macOS – it always points back to the same container.
- **HTTPS in production**: If the host needs HTTPS, bolt a local proxy (Caddy/nginx) in front, but keep the alias strategy so containers avoid `localhost`.
- **Testing inside containers**: For manual testing with curl inside containers: `curl -k http://internal-zitadel:8080/ui/console`.

**Note:** These environment variables work together with the YAML configuration. The YAML `Features.LoginV2.BaseURI` is the primary configuration that enables the feature during bootstrap.

### Bootstrap Process

When Zitadel starts with `start-from-init`, it:

1. Reads `zitadel-defaults.yaml` and applies `DefaultInstance.Features.LoginV2`
2. Creates the first instance with Login V2 enabled
3. All OAuth/OIDC authorization requests automatically redirect to the configured `BaseURI`

### Verification

To verify Login V2 is working:

1. **Check OAuth Redirect**: Test an OAuth authorization request:
   ```bash
   CLIENT_ID=$(cat deploy/.env | grep FRONTEND_CLIENT_ID | cut -d= -f2)
   curl -sL "http://localhost:8080/oauth/v2/authorize?client_id=${CLIENT_ID}&redirect_uri=http://localhost:5173/auth/callback&response_type=code&scope=openid" | head -10
   ```
   Should redirect to `http://localhost:3000/ui/v2/login` instead of `http://localhost:8080/ui/v2/login`

2. **Check Login UI**: Access the login UI directly:
   ```bash
   curl -s http://localhost:3000/ui/v2/login | head -5
   ```
   Should return the login UI HTML

3. **Check Console**: The Zitadel console should also use the external login UI when accessing `http://localhost:8080/ui/console`

### Troubleshooting Login V2

**Issue: OAuth still redirects to port 8080**

- Ensure `DefaultInstance.Features.LoginV2` is configured in `zitadel-defaults.yaml`
- Verify the database was reset after adding the configuration (existing instances don't pick up new defaults)
- Check that `ZITADEL_LOGIN_UI_BASE_URL` environment variable matches the YAML `BaseURI`

**Issue: Login UI shows 404**

- Verify `login-ui` service is running: `docker compose ps login-ui`
- Check `NEXT_PUBLIC_BASE_PATH` matches the URL path
- Ensure `ZITADEL_SERVICE_USER_TOKEN` is set in `.env` file

**Issue: "App.NotFound" error**

- This usually means the OAuth client ID doesn't exist or isn't accessible
- Run `zitadel-init` to create/update applications
- Verify the ClientId in `deploy/.env` matches what's in Zitadel
- Ensure frontend container has the correct `VITE_ZITADEL_CLIENT_ID` environment variable
- Check that `zitadel-init` completed successfully before starting frontend

**Issue: User gets logged out immediately after login**

- Check browser console for token validation errors
- Verify `getUserInfo` endpoint is accessible: `curl -H "Authorization: Bearer <token>" http://localhost:8080/oidc/v1/userinfo`
- Ensure issuer URL is correct: `http://localhost:8080` (not `/ui/v2/login`)
- Check that tokens are being stored in sessionStorage

### Important Notes

- **YAML Configuration is Primary**: The `Features.LoginV2` in `zitadel-defaults.yaml` is the authoritative configuration. Environment variables supplement it but don't replace it.
- **Bootstrap Only**: `DefaultInstance` settings only apply when creating a new instance. For existing instances, you'd need to reset the database or configure via the console/API.
- **Full URL Required**: The `BaseURI` must be a complete URL including protocol, host, port, and path: `http://localhost:3000/ui/v2/login`
- **Service User Token**: The `zitadel-init` script automatically creates the login service user and generates the `ZITADEL_LOGIN_SERVICE_USER_TOKEN` required for the login UI to function.

## Step 5: Environment Outputs

1. **Access Zitadel Console**:
   - URL: http://localhost:8081/ui/console
   - Default credentials:
     - Username: `zitadel-admin@zitadel.localhost`
     - Password: `Password1!`

2. **Change Default Password** (Recommended):
   - Log in with default credentials
   - Navigate to your user profile
   - Change the password to something secure

## Step 4: Create an Organization (Console Method Only)

1. In Zitadel Console, create a new organization:
   - Name: `IAC Platform` (or your preferred name)
   - This will be your main organization

## Step 5: Create an Application (Console Method Only)

1. **Navigate to Applications**:
   - Go to your organization → Applications
   - Click "New Application"

2. **Create OIDC Application**:
   - **Name**: `IAC Platform Frontend`
   - **Type**: `User Agent` (for web applications)
   - **Auth Method**: `PKCE` (recommended for SPAs)
   - **Redirect URIs**: 
     - `http://localhost:5173/auth/callback`
     - `http://localhost:5173/*` (for development)
   - **Post Logout Redirect URIs**:
     - `http://localhost:5173`
   - **Response Types**: `code`
   - **Grant Types**: `authorization_code`, `refresh_token`
   - **Access Token Type**: `Bearer`
   - **Access Token Role Assertion**: Enable if using roles

3. **Save and Note**:
   - **Client ID**: Copy this value
   - **Client Secret**: Copy this value (if not using PKCE)

## Step 6: Create API Application (for Backend) (Console Method Only)

1. **Create Another Application**:
   - **Name**: `IAC Platform API`
   - **Type**: `API`
   - **Auth Method**: `Private Key JWT` or `Basic`
   - **Token Type**: `JWT`

2. **Save and Note**:
   - **Client ID**: Copy this value
   - **Client Secret**: Copy this value

## Step 7: Configure Environment Variables

**Note:** If you used the API setup script, it will output the client IDs and secrets. Copy those values to your configuration files.

### Environment Variables (Single Source of Truth)

**Important:** All environment variables are managed through `deploy/.env` - this is the single source of truth.

The bootstrap writes to `deploy/.env`:

```env
ZITADEL_FRONTEND_CLIENT_ID=<frontend-client-id>
ZITADEL_API_CLIENT_ID=<api-client-id>
ZITADEL_API_CLIENT_SECRET=<api-client-secret>
ZITADEL_LOGIN_SERVICE_USER_TOKEN=<login-service-user-pat>
ZITADEL_LOGIN_SERVICE_USER_ID=<login-service-user-id>
```

**How Services Get Values:**

1. **Frontend**: Gets `VITE_ZITADEL_CLIENT_ID` from docker-compose environment variable substitution:
   ```yaml
   environment:
     - VITE_ZITADEL_CLIENT_ID=${ZITADEL_FRONTEND_CLIENT_ID}
   ```
   Docker-compose reads `ZITADEL_FRONTEND_CLIENT_ID` from `deploy/.env` via `env_file: - ./.env`

2. **Backend API**: Gets `ZITADEL_API_CLIENT_ID` and `ZITADEL_API_CLIENT_SECRET` from docker-compose environment variables:
```yaml
   environment:
     - ZITADEL_API_CLIENT_ID=${ZITADEL_API_CLIENT_ID}
     - ZITADEL_API_CLIENT_SECRET=${ZITADEL_API_CLIENT_SECRET}
   ```
   The backend reads these environment variables at runtime (preferring env vars over config file values)

3. **Login UI**: Gets `ZITADEL_SERVICE_USER_TOKEN` from docker-compose:
```yaml
   environment:
     - ZITADEL_SERVICE_USER_TOKEN=${ZITADEL_LOGIN_SERVICE_USER_TOKEN}
   ```

**No Manual Configuration Needed:**
- ❌ Do NOT manually edit `frontend/.env` - values come from docker-compose
- ❌ Do NOT manually edit `backend/config/config.yaml` - values come from environment variables
- ✅ Only `deploy/.env` needs to exist - it's the single source of truth

## Step 8: Install Required Packages

### Frontend

```bash
# Install Zitadel SDK
docker exec -it iac-frontend npm install @zitadel/react
```

### Backend

Add to `backend/go.mod` dependencies:

```bash
cd backend
go get github.com/zitadel/oidc/v3
go mod tidy
```

## Step 9: Integration Steps

### Frontend Integration

1. **Update AuthContext** (`frontend/src/contexts/AuthContext.tsx`):
   - Use `@zitadel/react` hooks
   - Implement session management
   - Handle login/logout flows

2. **Create Auth Pages**:
   - Login page with Zitadel login
   - Callback handler for OAuth redirect
   - Logout handler

3. **Update API Client** (`frontend/src/api/client.ts`):
   - Add Zitadel access token to Authorization header
   - Handle token refresh

### Backend Integration

1. **Update Auth Service** (`backend/internal/services/auth/service.go`):
   - Implement OIDC token verification
   - Extract user information from JWT
   - Sync users to database

2. **Update Middleware**:
   - Verify JWT tokens
   - Extract user ID and roles
   - Set user context

## Step 10: User Roles and Permissions

1. **Create Roles in Zitadel**:
   - Go to your organization → Roles
   - Create roles like:
     - `admin`: Full access
     - `member`: Standard user access
     - `viewer`: Read-only access

2. **Assign Roles to Users**:
   - Assign roles when creating users
   - Or assign via user management interface

3. **Map Roles in Backend**:
   - Extract roles from JWT claims
   - Use for RBAC (Role-Based Access Control)

## Step 11: Testing

1. **Test Login Flow**:
   - Navigate to http://localhost:5173/auth/login
   - Should redirect to Zitadel login
   - After login, should redirect back with code
   - Frontend should exchange code for tokens

2. **Test API Calls**:
   - Verify access token is sent in Authorization header
   - Backend should verify token and extract user info
   - API calls should work with authenticated user

3. **Test Logout**:
   - Logout should clear session
   - Should redirect to Zitadel logout endpoint
   - Then redirect back to application

## Troubleshooting

### Zitadel Not Starting

```bash
# Check logs
docker logs iac-zitadel

# Check if database is accessible
docker exec -it iac-postgres psql -U iac -d iac_platform -c "SELECT 1;"
```

### Connection Issues

- **Frontend can't connect**: Check `VITE_ZITADEL_ISSUER` environment variable (should be `http://localhost:8080`, not `/ui/v2/login`)
- **Backend can't verify tokens**: Check `ZITADEL_ISSUER` environment variable or `zitadel.issuer` in config.yaml
- **CORS errors**: Configure CORS in Zitadel application settings
- **Client ID mismatch**: Verify `deploy/.env` has correct values and services were restarted after changes

### Token Verification Fails

- Verify issuer URL matches exactly
- Check client ID and secret are correct
- Ensure token hasn't expired
- Check clock skew (time sync between services)

## Production Considerations

1. **Use HTTPS**: Always use HTTPS in production
2. **Secure Secrets**: Store client secrets securely (use secrets management)
3. **Token Expiry**: Configure appropriate token lifetimes
4. **Refresh Tokens**: Implement refresh token rotation
5. **Rate Limiting**: Configure rate limiting in Zitadel
6. **Audit Logging**: Enable audit logging in Zitadel
7. **Backup**: Regular backups of Zitadel database

## Additional Resources

- [Zitadel Documentation](https://zitadel.com/docs)
- [Zitadel React SDK](https://github.com/zitadel/zitadel-react)
- [OIDC Specification](https://openid.net/specs/openid-connect-core-1_0.html)
- [OIDC SDK](https://github.com/zitadel/oidc)
   - [OIDC SDK Docs for Golang](https://zitadel.com/docs/sdk-examples/go)
   - [Full Reference for the OIDC SDK Go Package](https://pkg.go.dev/github.com/zitadel/oidc/v3/pkg/oidc)
- [Go Examples](https://github.com/zitadel/zitadel-go/tree/main/example)
- [OAuth 2.0 Specification](https://oauth.net/2/)

## Next Steps

After completing this setup:

1. Integrate Zitadel SDK in frontend
2. Implement token verification in backend
3. Create user sync mechanism
4. Implement role-based access control
5. Add MFA support (optional)
6. Configure passwordless authentication (optional)
7. Integrate login UI into our own frontend using this guide: https://zitadel.com/docs/guides/integrate/login-ui