<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Setup Guide

USE THIS REFERENCE TO SEE ALL THE CONFIG OPTIONS OF ZITADEL


## Prerequisites

- Go 1.23+ (or latest stable)
- Node.js 22+
- Docker & Docker Compose
- PostgreSQL 17 (via Docker)
- Redis 7+ (via Docker)

## Quick Start

### 1. Install Dependencies

```bash
# Install Go dependencies
cd backend
go mod download

# Install Node.js dependencies
cd ../frontend
npm install
```

### 2. Start Infrastructure Services

```bash
# From project root
make up

# This starts:
# - PostgreSQL on port 5432
# - pgAdmin on port 5050 (Web UI: http://localhost:5050)
# - Redis on port 6379
# - MinIO on ports 9000 (API) and 9001 (Console)
# - Zitadel on ports 8080 (API) and 8081 (Console)
# - API on port 8022
```

### 3. Access pgAdmin (Optional)

pgAdmin is available at http://localhost:5050

**Login credentials:**
- Email: `admin@iac.local`
- Password: `admin`

**To connect to the PostgreSQL database:**
1. Right-click "Servers" → "Register" → "Server"
2. General tab:
   - Name: `IAC Platform DB`
3. Connection tab:
   - Host name/address: `postgres` (or `localhost` if connecting from host)
   - Port: `5432`
   - Maintenance database: `iac_platform`
   - Username: `iac`
   - Password: `iac_password`
   - Check "Save password"
4. Click "Save"

### 4. Set Up Zitadel Authentication

See [ZITADEL_SETUP.md](../../get-started/self-hosting/ZITADEL_SETUP.md) for detailed instructions.

**Quick Start:**
1. Start services: `make up`
2. Access Zitadel Console: http://localhost:8081/ui/console
3. Login with default credentials:
   - Username: `zitadel-admin@zitadel.localhost`
   - Password: `Password1!`
4. Create an organization and applications (see ZITADEL_SETUP.md)
5. Update configuration files with client IDs and secrets

### 5. Database Migrations

**Automatic Migrations:** Database migrations run automatically when the API service starts. The API uses GORM AutoMigrate to create/update all database tables on startup.

**What Gets Created:**
- All tables for models (User, Organization, Project, Workspace, Run, Variable, StateVersion, StateLock, AuditLog)
- Indexes and foreign key constraints
- UUID extension (uuid-ossp) is enabled automatically

**No Manual Steps Required:** Just start the services and the database will be populated automatically.

### 6. Environment Variables

**Single Source of Truth:** All environment variables are managed through `deploy/.env`. The `zitadel-init` script automatically creates this file with all required values.

**No Manual Configuration:** After running `zitadel-init`, all services automatically get their configuration from `deploy/.env` via docker-compose environment variable substitution.

**What Gets Configured:**
- Frontend gets `VITE_ZITADEL_CLIENT_ID` from `${ZITADEL_FRONTEND_CLIENT_ID}`
- Backend gets `ZITADEL_API_CLIENT_ID` and `ZITADEL_API_CLIENT_SECRET` from environment variables
- Login UI gets `ZITADEL_SERVICE_USER_TOKEN` from `${ZITADEL_LOGIN_SERVICE_USER_TOKEN}`

### 7. Start Services

All services are managed via Docker Compose:

```bash
cd deploy
docker compose up -d
```

**Services and Ports:**
- **Frontend**: http://localhost:5173
- **API**: http://localhost:8022
- **Zitadel**: http://localhost:8080
- **Login UI**: http://localhost:3000/ui/v2/login
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **MinIO**: localhost:9000 (API), localhost:9001 (Console)

**Note:** The API automatically runs database migrations on startup, so no manual migration step is needed.

## First Time Setup

1. **Access MinIO Console**: http://localhost:9001
   - Username: `minioadmin`
   - Password: `minioadmin`
   - Create bucket: `iac-state`

2. **Set Encryption Key** (for variable encryption):
   ```bash
   export ENCRYPTION_KEY=$(openssl rand -base64 32)
   ```

## Development Workflow

```bash
# Start all services (from deploy directory)
cd deploy
docker compose up -d --build

# Run Zitadel initialization (first time or after reset)
docker compose run --rm zitadel-init

# Restart services to pick up new config
docker compose up -d

# View logs
docker compose logs -f [service-name]

# Stop services
docker compose down

# Clean everything (removes volumes)
docker compose down -v
```

**Note:** Database migrations run automatically when the API starts - no manual migration step needed.

## Troubleshooting

### Database connection errors
- Ensure PostgreSQL is running: `docker ps`
- Check connection string in `backend/config/config.yaml`
- Migrations run automatically on API startup - check API logs for migration errors
- Verify uuid-ossp extension: `docker exec iac-postgres psql -U iac -d iac_platform -c "SELECT * FROM pg_extension WHERE extname='uuid-ossp';"`

### Frontend can't connect to backend
- Check `VITE_API_URL` environment variable in docker-compose.yml (should be `http://localhost:8022/api/v1`)
- Ensure backend is running on port 8022
- Check CORS settings in backend
- Verify frontend container has correct environment variables: `docker exec iac-frontend env | grep VITE`

## Next Steps

1. Configure Zitadel authentication
2. Create your first user account
3. Create an organization
3. Create a project
4. Create a workspace
5. Link a VCS repository
6. Run your first Terraform plan!

