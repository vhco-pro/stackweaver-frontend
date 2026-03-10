# Plan: Make API Config File Optional (Env-Var-Only Mode)

> **Status:** Draft  
> **Scope:** `backend/cmd/api/main.go`, Helm chart `api-deployment.yaml`, `values.yaml`  
> **Goal:** Allow the API binary to start without `config.yaml`, relying entirely on environment variables. Zero secrets in any ConfigMap. Docker Compose continues unchanged.

---

## Problem

The `api` binary crashes on Kubernetes with:

```
failed to read config file: config/config.yaml
```

Docker Compose bind-mounts `../backend/config/config.yaml` into the container and sets `CONFIG_PATH=/etc/iac/config/config.yaml`. The Helm chart has no such file — and **should not** have one, because the config file contains secrets (`password`, `client_id`, `client_secret`) that cannot be committed to a GitOps-managed ConfigMap.

## Current State

| Concern | Docker Compose | Helm Chart |
|---------|---------------|------------|
| DB credentials | config.yaml + env override | env vars from `secretKeyRef` |
| Zitadel creds | config.yaml + env override | env vars from `secretKeyRef` |
| Server host/port | config.yaml (`0.0.0.0:8022`) | **not set** |
| Server timeouts | config.yaml (`30s / 30s`) | **not set** |
| CONFIG_PATH | `/etc/iac/config/config.yaml` | **not set** |

The `api` binary's `applyEnvOverrides()` already supports overriding every config field via env vars, but the binary fatals before reaching that function if the file is missing.

Only `backend/cmd/api/main.go` reads the config file. Orchestrator and runner binaries use env vars exclusively.

## Design

### Part 1: Make config file optional in Go (backend change)

**File:** `backend/cmd/api/main.go`

1. **Add `"errors"` to imports.**

2. **Replace the file-loading block** (currently lines ~57-75) with logic that distinguishes between "no file specified" and "file explicitly specified but missing":

   ```go
   configPath := os.Getenv("CONFIG_PATH")
   explicitPath := configPath != ""
   if !explicitPath {
       configPath = "config/config.yaml"
   }

   var config Config
   configData, err := os.ReadFile(configPath)
   switch {
   case err == nil:
       if err := yaml.Unmarshal(configData, &config); err != nil {
           logger.Fatalf("Failed to parse config: %v", err)
       }
   case errors.Is(err, os.ErrNotExist) && !explicitPath:
       logger.Info("No config file found, using environment variables only")
   default:
       logger.Fatalf("Failed to read config file: %v", err)
   }

   applyEnvOverrides(&config)
   ```

   **Behaviour matrix:**

   | CONFIG_PATH set? | File exists? | Result |
   |-----------------|-------------|--------|
   | Yes | Yes | Load file, apply env overrides (Docker Compose path) |
   | Yes | No | **Fatal** — explicit misconfiguration |
   | No | Yes (default path) | Load file, apply env overrides (local dev) |
   | No | No (default path) | **Skip file**, use env-var-only mode (Kubernetes path) |

3. **Add sensible defaults** so the struct isn't all zero-valued when no file is loaded. Add a `defaultConfig()` function and call it before file loading:

   ```go
   func defaultConfig() Config {
       var cfg Config
       cfg.Server.Host = "0.0.0.0"
       cfg.Server.Port = 8022
       cfg.Server.ReadTimeout = 30 * time.Second
       cfg.Server.WriteTimeout = 30 * time.Second
       cfg.Database.Port = 5432
       cfg.Database.SSLMode = "disable"
       cfg.Database.MaxOpenConns = 25
       cfg.Database.MaxIdleConns = 5
       cfg.Database.ConnMaxLifetime = 5 * time.Minute
       return cfg
   }
   ```

   Then in `main()`:
   ```go
   config := defaultConfig()
   ```

   This ensures that even without a config file, the server binds to `0.0.0.0:8022` with reasonable timeouts — matching the values in the current `config.yaml`. Env vars can still override everything.

### Part 2: Add missing env var overrides (backend change)

**File:** `backend/cmd/api/main.go`, function `applyEnvOverrides`

The current `applyEnvOverrides` handles `SERVER_HOST` and `SERVER_PORT` but is missing overrides for server timeouts and database connection pool settings. Add all missing overrides so **every** `config.yaml` field has an env var equivalent:

```go
// Server timeouts
if v := os.Getenv("SERVER_READ_TIMEOUT"); v != "" {
    if d, err := time.ParseDuration(v); err == nil {
        config.Server.ReadTimeout = d
    }
}
if v := os.Getenv("SERVER_WRITE_TIMEOUT"); v != "" {
    if d, err := time.ParseDuration(v); err == nil {
        config.Server.WriteTimeout = d
    }
}

// Database connection pool
if v := os.Getenv("DATABASE_MAX_OPEN_CONNS"); v != "" {
    if n, err := strconv.Atoi(v); err == nil {
        config.Database.MaxOpenConns = n
    }
}
if v := os.Getenv("DATABASE_MAX_IDLE_CONNS"); v != "" {
    if n, err := strconv.Atoi(v); err == nil {
        config.Database.MaxIdleConns = n
    }
}
if v := os.Getenv("DATABASE_CONN_MAX_LIFETIME"); v != "" {
    if d, err := time.ParseDuration(v); err == nil {
        config.Database.ConnMaxLifetime = d
    }
}
```

Full env var coverage after this change:

| Config Field | Env Var |
|---|---|
| `Server.Host` | `SERVER_HOST` |
| `Server.Port` | `SERVER_PORT` |
| `Server.ReadTimeout` | `SERVER_READ_TIMEOUT` |
| `Server.WriteTimeout` | `SERVER_WRITE_TIMEOUT` |
| `Database.Host` | `DATABASE_HOST` |
| `Database.Port` | `DATABASE_PORT` |
| `Database.User` | `DATABASE_USER` |
| `Database.Password` | `DATABASE_PASSWORD` |
| `Database.DBName` | `DATABASE_NAME` |
| `Database.SSLMode` | `DATABASE_SSLMODE` |
| `Database.MaxOpenConns` | `DATABASE_MAX_OPEN_CONNS` |
| `Database.MaxIdleConns` | `DATABASE_MAX_IDLE_CONNS` |
| `Database.ConnMaxLifetime` | `DATABASE_CONN_MAX_LIFETIME` |
| `Zitadel.Issuer` | `ZITADEL_ISSUER` |
| `Zitadel.ClientID` | `ZITADEL_API_CLIENT_ID` |
| `Zitadel.ClientSecret` | `ZITADEL_API_CLIENT_SECRET` |

### Part 3: Helm chart — add server env vars and expose all config in values.yaml (Helm changes)

**File:** `deploy/helm/stackweaver/values.yaml`

Add a `server` block under `api:` for the non-secret server settings:

```yaml
api:
  port: 8022
  server:
    host: "0.0.0.0"
    readTimeout: "30s"
    writeTimeout: "30s"
```

`api.port` already exists — only the `server` sub-block is new.

**File:** `deploy/helm/stackweaver/templates/api/api-deployment.yaml`

Add to the `env:` section (before the extra env block):

```yaml
# ── Server ──
- name: SERVER_HOST
  value: {{ .Values.api.server.host | default "0.0.0.0" | quote }}
- name: SERVER_PORT
  value: {{ .Values.api.port | quote }}
- name: SERVER_READ_TIMEOUT
  value: {{ .Values.api.server.readTimeout | default "30s" | quote }}
- name: SERVER_WRITE_TIMEOUT
  value: {{ .Values.api.server.writeTimeout | default "30s" | quote }}
```

This ensures every config field is controllable from `values.yaml` (or `--set`) without editing templates.

The database pool settings (`DATABASE_MAX_OPEN_CONNS`, etc.) and any other non-standard overrides can be injected via the existing `api.env` escape hatch in `values.yaml`:

```yaml
api:
  env:
    DATABASE_MAX_OPEN_CONNS: "50"
    DATABASE_MAX_IDLE_CONNS: "10"
    DATABASE_CONN_MAX_LIFETIME: "10m"
```

No dedicated `values.yaml` fields are needed for the pool settings since they are rarely changed and sane defaults are baked into `defaultConfig()`.

### Part 4: Do NOT set CONFIG_PATH in Helm (Helm non-change)

The Helm deployment **must not** set `CONFIG_PATH`. When `CONFIG_PATH` is unset and the default `config/config.yaml` doesn't exist in the container, the new Go code gracefully falls through to env-var-only mode. No ConfigMap for config.yaml is needed.

## Backwards Compatibility

| Deployment | Before | After |
|-----------|--------|-------|
| **Docker Compose** | Mounts config.yaml, sets `CONFIG_PATH` → file loaded, env overrides applied | Identical — `CONFIG_PATH` is set, file exists → same code path |
| **Local dev** (no Docker) | Reads `config/config.yaml` from working dir | Identical — default path still checked |
| **Kubernetes (Helm)** | Crashes — no file | New — no `CONFIG_PATH`, no file at default path → logs info message, uses defaults + env vars |

## Files Changed

| File | Change |
|------|--------|
| `backend/cmd/api/main.go` | Add `"errors"` import; add `defaultConfig()`; make file-loading non-fatal; add timeout + DB pool env overrides to `applyEnvOverrides` |
| `deploy/helm/stackweaver/templates/api/api-deployment.yaml` | Add `SERVER_HOST`, `SERVER_PORT`, `SERVER_READ_TIMEOUT`, `SERVER_WRITE_TIMEOUT` env vars |
| `deploy/helm/stackweaver/values.yaml` | Add `api.server` block (host, readTimeout, writeTimeout) |

## Files NOT Changed

| File | Reason |
|------|--------|
| `deploy/docker-compose.yml` | Continues mounting config.yaml and setting `CONFIG_PATH` — no change needed |
| `backend/config/config.yaml` | Remains as local dev / Docker Compose default — no change needed |
| Any ConfigMap template | Not created — zero config files in Kubernetes, zero secrets in ConfigMaps |

## Testing

1. **Docker Compose** — `make fresh-backend`, verify API starts and reads config file as before
2. **No config file** — `unset CONFIG_PATH && rm -f config/config.yaml && go run ./cmd/api` → should log "No config file found, using environment variables only" and start with defaults (will fail at DB connect if no env vars set, which is expected)
3. **Explicit missing file** — `CONFIG_PATH=/nonexistent go run ./cmd/api` → should fatal with "Failed to read config file"
4. **Helm chart** — `helm template` and verify no `CONFIG_PATH` in API deployment, `SERVER_HOST` and `SERVER_PORT` are present
5. **Full Kubernetes deploy** — API pod starts, connects to DB, serves `/health`

## Implementation Order

1. Add `defaultConfig()` and make file-loading non-fatal in `main.go`
2. Add timeout env var overrides in `applyEnvOverrides()`
3. Add `SERVER_HOST` / `SERVER_PORT` to Helm API deployment template
4. Test all three scenarios (Docker Compose, no file, explicit missing)
