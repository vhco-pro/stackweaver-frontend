<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Frontend Package Installation Guide

## Problem

When running Node.js in Docker containers, `npm install` creates files owned by the container's user (usually `root`), which causes permission errors when trying to access them from the host system.

## Solution

Since the frontend runs in a Docker container, you should install npm packages **inside the container**, not on the host system.

## Quick Start

### Option 1: Using Make (Recommended)

```bash
# Install packages in the frontend container
make frontend-install
```

This will:
1. Check if the frontend container is running
2. Start it if needed
3. Run `npm install` inside the container

### Option 2: Using Docker Directly

```bash
# If container is already running
docker exec iac-frontend npm install

# Or start container and install
docker compose -f deploy/docker-compose.yml up -d frontend
docker exec iac-frontend npm install
```

### Option 3: Fix Permissions (If you already installed on host)

If you've already run `npm install` on the host and have permission issues:

```bash
# Fix permissions on existing node_modules
make frontend-fix-perms

# Or manually:
sudo chown -R $(id -u):$(id -g) frontend/node_modules
```

## How It Works

The `docker-compose.yml` configuration uses:
- Volume mount: `../frontend:/app` - Maps your code to the container
- Anonymous volume: `/app/node_modules` - Keeps node_modules isolated in the container

This means:
- ✅ Your source code changes are synced to the container
- ✅ `node_modules` lives in the container (no permission issues)
- ✅ The container has its own isolated `node_modules`

## Adding New Packages

When you need to add a new npm package:

1. **Update `package.json`** on your host system (edit the file normally)
2. **Install in container**:
   ```bash
   make frontend-install
   ```
   Or:
   ```bash
   docker exec iac-frontend npm install
   ```

## Troubleshooting

### Container not running
```bash
docker compose -f deploy/docker-compose.yml up -d frontend
```

### Permission denied errors
```bash
# Remove host node_modules (it's not needed)
rm -rf frontend/node_modules

# Install in container
make frontend-install
```

### Need to rebuild container
```bash
docker compose -f deploy/docker-compose.yml build frontend
docker compose -f deploy/docker-compose.yml up -d frontend
make frontend-install
```

## Why This Approach?

1. **No Permission Issues**: Container manages its own `node_modules`
2. **Consistent Environment**: Same Node.js version as production
3. **Isolated Dependencies**: Host system doesn't need Node.js installed
4. **Hot Reload Works**: Vite dev server in container watches mounted files

