<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Encryption at Rest: State Files and VCS Connection Tokens

**Issue:** [#95](https://github.com/michielvha/stackweaver/issues/95)
**Status:** Updated Draft
**Created:** 2025-12-15
**Updated:** 2026-02-28
**Depends on:** [Storage Backend Rework (#117)](../infrastructure/storage-backend-rework-plan.md) — implement this plan **after** the storage rework is complete.

## Overview

State files in object storage and VCS connection tokens in the database are currently stored **unencrypted**. Terraform state can contain secrets and connection strings; VCS tokens grant repository and API access. This plan covers encrypting both at rest.

This plan replaces the original version which predated the VCS provider-registry rework and the storage backend rework plan. It reflects the **current architecture** as of 2026-02-28.

## Scope

| Data | Location | Current | Target |
|------|----------|---------|--------|
| State files | Object storage `workspaces/{workspace_id}/state/{version}.json` | Plain JSON | AES-256-GCM ciphertext |
| VCSConnection.AccessToken | PostgreSQL `vcs_connections` | Plain text | Encrypted in DB |
| VCSConnection.RefreshToken | PostgreSQL `vcs_connections` | Plain text | Encrypted in DB |

**Out of scope (already encrypted):**
- Workspace variables — encrypted via `variable.Service` + `ENCRYPTION_KEY`
- Variable-set variables — same encryption path
- Ansible credentials — encrypted via `CredentialService` + `ENCRYPTION_KEY`

**Low priority (not credentials):**
- `ConfigurationVersion.UploadToken` — short-lived, auto-generated, ephemeral
- `TFEToken.Token` — already hashed (irreversible)

## Prerequisite: Storage Backend Rework

This plan assumes the [storage backend rework (#117)](../infrastructure/storage-backend-rework-plan.md) is complete. That rework:
- Replaces MinIO with a pluggable `storage.Client` interface (S3-compatible, Azure Blob, GCS, local filesystem)
- Unifies environment variables under `STORAGE_*` naming
- Centralizes storage initialization (single `storage.NewClient()` per binary)

Encryption at rest for state files is implemented **on top of** the unified `storage.Client` interface, making it backend-agnostic. The encryption layer does not depend on which storage backend is configured.

---

## Current State Analysis

### What exists today

The codebase has a well-established encryption pattern in `pkg/crypto`:

| Component | Encryption | Key source |
|-----------|-----------|------------|
| `variable.Service` | AES-256-GCM (inline implementation) | `ENCRYPTION_KEY` env var |
| `ansible.CredentialService` | AES-256-GCM (inline implementation) | `ENCRYPTION_KEY` / `ANSIBLE_ENCRYPTION_KEY` |
| `pkg/crypto.CryptoService` | AES-256-GCM (`Encrypt`/`Decrypt`, `EncryptBytes`/`DecryptBytes`) | Constructor arg |

**Problem:** Both `variable.Service` and `CredentialService` have their own copy-pasted AES-GCM encrypt/decrypt methods instead of using `pkg/crypto.CryptoService`. This plan standardizes on `pkg/crypto.CryptoService` for new encryption work.

### VCS architecture (post-rework)

The VCS layer has been reworked into a **provider-registry** pattern:

```
backend/internal/services/vcs/
├── provider.go              # ProviderService interface
├── registry.go              # ProviderRegistry (dispatches by provider type)
├── github_provider.go       # GitHub App + PAT support
├── azuredevops_provider.go  # Full OAuth + token refresh
├── gitlab_provider.go       # Stub
├── bitbucket_provider.go    # Stub
├── github_app.go            # GitHub App JWT/installation token generation
├── github_app_manager.go    # Manages GitHub App installations
└── azuredevops_manager.go   # Azure DevOps OAuth manager
```

**Key interfaces:**

- `ProviderService.GetFreshToken(ctx, conn)` — returns a valid token, refreshing if needed
- `ProviderService.BuildCloneURL(conn, token, repoPath)` — returns HTTPS URL with embedded auth
- `ConnUpdater func(conn *models.VCSConnection) error` — callback to persist refreshed tokens

**Token flow per provider:**

| Provider | GetFreshToken behavior | Token storage |
|----------|----------------------|---------------|
| GitHub App | Generates short-lived installation token (no stored token needed) | `InstallationID` only |
| GitHub PAT | Returns stored `conn.AccessToken` | `AccessToken` in DB |
| Azure DevOps | Checks expiry, refreshes via OAuth if needed, persists via `ConnUpdater` | `AccessToken` + `RefreshToken` in DB |
| GitLab/Bitbucket | Returns stored `conn.AccessToken` (stubs) | `AccessToken` in DB |

**Token consumers (where plaintext tokens are needed):**

| Consumer | How it gets the token | Binary |
|----------|----------------------|--------|
| `runner_agent.go` (Ansible jobs) | API calls `GetFreshToken` + `BuildCloneURL`, sends clone URL to runner | API |
| `runner_agent.go` (Terraform VCS runs) | API calls `GetFreshToken` + `BuildCloneURL`, sends clone URL | API |
| `runs.go` (config version from VCS) | API clones repo, uploads tarball — runner never sees token | API |
| `vcs_app_installation.go` (webhooks) | API clones on push/PR, creates config version | API |
| `ansible-runner/main.go` | Loads VCS connection from DB, calls `GetFreshToken` + `BuildCloneURL`, clones directly | Ansible runner |

The Terraform runner **never** accesses VCS tokens — it receives pre-built tarballs from object storage.

---

## Design

### Approach: Centralize on `pkg/crypto.CryptoService`

All new encryption uses `pkg/crypto.CryptoService`, initialized once per binary from `ENCRYPTION_KEY`. The two existing inline implementations (`variable.Service`, `CredentialService`) can be migrated later as a cleanup task (out of scope for this plan).

### Key: Single `ENCRYPTION_KEY`

Reuse the existing `ENCRYPTION_KEY` environment variable (hex-encoded, 32 bytes for AES-256). State files and VCS tokens share the same key. If key separation is needed later, dedicated env vars (`STATE_ENCRYPTION_KEY`, `VCS_ENCRYPTION_KEY`) can be introduced with fallback to `ENCRYPTION_KEY`.

---

## Phase 1: State File Encryption

### 1.1 Current Flow

- **Write:** `state.Service.SaveState()` → `json.Marshal(stateData)` → `storageClient.Put(ctx, key, stateJSON)`
- **Read:** `storageClient.Get(ctx, key)` → `json.Unmarshal` (in `RemoveResourceFromState`)
- **Delete:** `storageClient.Delete(ctx, key)` (no decryption needed)
- **Key pattern:** `workspaces/{workspace_id}/state/{version}.json`

Note: State is also stored in the database via `StateVersion.StateData` (JSONB column). The DB copy is used for most reads; object storage is the authoritative copy and is read in `RemoveResourceFromState` and potentially in handlers.

### 1.2 Implementation

#### Step 1: Add `*crypto.CryptoService` to `state.Service`

```go
// backend/internal/services/state/service.go
type Service struct {
    stateVersionRepo *repository.StateVersionRepository
    stateLockRepo    *repository.StateLockRepository
    workspaceRepo    *repository.WorkspaceRepository
    storageClient    storage.Client
    crypto           *crypto.CryptoService // NEW
}

func NewService(
    stateVersionRepo *repository.StateVersionRepository,
    stateLockRepo *repository.StateLockRepository,
    workspaceRepo *repository.WorkspaceRepository,
    storageClient storage.Client,
    cryptoSvc *crypto.CryptoService, // NEW — nil = no encryption (dev mode)
) *Service { ... }
```

When `cryptoSvc` is nil, state is stored/read as plain JSON (development mode, backward compatible).

#### Step 2: Encrypt on write

In `SaveState`, after `json.Marshal(stateData)`:

```go
stateJSON, _ := json.Marshal(stateData)
dataToStore := stateJSON
if s.crypto != nil {
    encrypted, err := s.crypto.EncryptBytes(stateJSON) // returns base64 string
    if err != nil {
        return nil, fmt.Errorf("failed to encrypt state: %w", err)
    }
    dataToStore = []byte(encrypted) // store as base64 bytes
}
s.storageClient.Put(ctx, key, dataToStore)
```

**On-disk format:** Base64-encoded AES-256-GCM ciphertext (nonce prepended). This is what `CryptoService.EncryptBytes` produces.

#### Step 3: Decrypt on read (with backward compatibility)

Add a helper to `state.Service`:

```go
// decryptStateBytes attempts to decrypt data; falls back to plain JSON for legacy files.
func (s *Service) decryptStateBytes(data []byte) ([]byte, error) {
    if s.crypto == nil {
        return data, nil
    }
    decrypted, err := s.crypto.DecryptBytes(string(data))
    if err != nil {
        // Legacy plain JSON — try parsing directly
        if json.Valid(data) {
            return data, nil
        }
        return nil, fmt.Errorf("failed to decrypt state and data is not valid JSON: %w", err)
    }
    return decrypted, nil
}
```

Apply this in `RemoveResourceFromState` and any handler path that reads state from object storage.

#### Step 4: Wire up in routes.go and runner binaries

After the storage backend rework centralizes initialization, add `CryptoService` creation alongside the storage client:

```go
// backend/internal/api/v2/routes/routes.go (or cmd/api/main.go after rework)
cryptoSvc, err := crypto.CryptoServiceFromEnv()
if err != nil {
    logger.Warn("ENCRYPTION_KEY not configured — state encryption disabled")
}
stateService := state.NewService(stateVersionRepo, stateLockRepo, workspaceRepo, storageClient, cryptoSvc)
```

### 1.3 Files to Modify

| File | Changes |
|------|---------|
| `backend/internal/services/state/service.go` | Add `crypto` field, encrypt in `SaveState`, decrypt helper, update `RemoveResourceFromState` |
| `backend/pkg/crypto/service.go` | Add `NewCryptoServiceFromHex` constructor (if needed beyond factory) |
| `backend/internal/api/v2/routes/routes.go` | Create shared `CryptoService`, pass to state service |
| `backend/internal/api/v2/handlers/terraform/state_versions.go` | Ensure any storage reads go through state service (no direct `storageClient.Get` for state) |

---

## Phase 2: VCS Connection Token Encryption

### 2.1 Current State

- **Model:** `VCSConnection.AccessToken` and `RefreshToken` are `string` fields with `json:"-"` (never serialized to API responses). Comments say "Encrypted" but they are **not yet encrypted**.
- **Write:** Handler in `vcs_connections.go` stores tokens in plaintext with `// TODO: Encrypt` comments.
- **Reads needing plaintext:**
  - `ProviderService.GetFreshToken()` (all providers) — returns `conn.AccessToken`
  - `AzureDevOpsProvider.GetFreshToken()` — reads `conn.RefreshToken` for OAuth refresh
  - `ConnUpdater` callback — persists refreshed tokens (Azure DevOps OAuth)
  - `ansible-runner` `cloneVCSRepoGeneric()` — reads `conn.AccessToken` from DB

### 2.2 Architecture Decision: Decrypt in ProviderRegistry

Rather than scattering decrypt calls across handlers and runners, centralize decryption in the `ProviderRegistry`. It already wraps all VCS operations, so it's the natural chokepoint:

```go
// backend/internal/services/vcs/registry.go
type ProviderRegistry struct {
    githubAppManager    *GitHubAppManager
    azureDevOpsManager  *AzureDevOpsManager
    connUpdater         ConnUpdater
    crypto              *crypto.CryptoService // NEW
}

// DecryptTokens decrypts VCS connection tokens in-place for use by providers.
// Falls back to plaintext for legacy unencrypted rows.
func (r *ProviderRegistry) DecryptTokens(conn *models.VCSConnection) {
    if r.crypto == nil {
        return
    }
    if conn.AccessToken != "" {
        if plain, err := r.crypto.Decrypt(conn.AccessToken); err == nil {
            conn.AccessToken = plain
        }
        // On error: token is legacy plaintext, leave as-is
    }
    if conn.RefreshToken != "" {
        if plain, err := r.crypto.Decrypt(conn.RefreshToken); err == nil {
            conn.RefreshToken = plain
        }
    }
}

// EncryptTokens encrypts VCS connection tokens in-place for DB storage.
func (r *ProviderRegistry) EncryptTokens(conn *models.VCSConnection) error {
    if r.crypto == nil {
        return nil
    }
    if conn.AccessToken != "" {
        enc, err := r.crypto.Encrypt(conn.AccessToken)
        if err != nil {
            return fmt.Errorf("failed to encrypt access token: %w", err)
        }
        conn.AccessToken = enc
    }
    if conn.RefreshToken != "" {
        enc, err := r.crypto.Encrypt(conn.RefreshToken)
        if err != nil {
            return fmt.Errorf("failed to encrypt refresh token: %w", err)
        }
        conn.RefreshToken = enc
    }
    return nil
}
```

### 2.3 Implementation Steps

#### Step 1: Add encryption to ProviderRegistry

- Add `crypto *crypto.CryptoService` to `ProviderRegistry`
- Add `DecryptTokens` and `EncryptTokens` methods
- Update the `ConnUpdater` wrapper: when the Azure DevOps provider refreshes tokens and calls `connUpdater`, the tokens in `conn` are plaintext. The `ConnUpdater` must **encrypt before persisting**:

```go
// In ProviderRegistry constructor, wrap the user-provided connUpdater
wrappedUpdater := func(conn *models.VCSConnection) error {
    if err := registry.EncryptTokens(conn); err != nil {
        return err
    }
    return originalUpdater(conn)
}
```

#### Step 2: Decrypt before provider calls

In `ProviderRegistry`, each method that receives a `conn` calls `DecryptTokens(conn)` first. This ensures all providers receive plaintext tokens without needing to know about encryption. There are only a handful of call sites.

#### Step 3: Encrypt on create/update in handler

In `vcs_connections.go`:

```go
// Create handler — before repo.Create
conn := &models.VCSConnection{
    AccessToken:  req.AccessToken,
    RefreshToken: req.RefreshToken,
    // ...
}
if err := h.vcsRegistry.EncryptTokens(conn); err != nil {
    respondError(c, http.StatusInternalServerError, "failed to encrypt tokens")
    return
}
h.vcsConnectionRepo.Create(conn)
```

Remove the `// TODO: Encrypt` comments.

#### Step 4: Ansible runner transparency

The ansible-runner loads VCS connections from the DB and calls `provider.GetFreshToken()` directly. It already has a `ProviderRegistry` instance. After this change, the registry's methods will decrypt automatically.

In `cloneVCSRepoGeneric()` (ansible-runner), the flow becomes:
1. Load `VCSConnection` from DB (encrypted `AccessToken`)
2. Call `provider.GetFreshToken(ctx, conn)` — registry decrypts first
3. Call `provider.BuildCloneURL(conn, token, repo)` — uses decrypted token
4. `git clone` with the URL

No changes needed in the runner itself — the `ProviderRegistry` handles decryption transparently.

#### Step 5: Backward compatibility

Use the same "try decrypt, fallback to plain" pattern. `DecryptTokens` already handles this: if `crypto.Decrypt` fails (because the value is plaintext), the token is left as-is. On next `EncryptTokens` call (via `ConnUpdater` or handler update), the tokens are stored encrypted.

### 2.4 Files to Modify

| File | Changes |
|------|---------|
| `backend/internal/services/vcs/registry.go` | Add `crypto` field, `DecryptTokens`/`EncryptTokens` methods, wrap `ConnUpdater` |
| `backend/internal/api/v2/handlers/vcs_connections.go` | Call `EncryptTokens` before create/update, remove `// TODO: Encrypt` |
| `backend/internal/api/v2/routes/routes.go` | Pass `CryptoService` to `ProviderRegistry` constructor |
| `backend/cmd/ansible-runner/main.go` | Pass `CryptoService` to `ProviderRegistry` constructor |
| `backend/cmd/orchestrator/main.go` | Pass `CryptoService` to `ProviderRegistry` constructor |

---

## Phase 3: Consolidate Key Initialization (Cleanup)

### 3.1 Problem

`ENCRYPTION_KEY` is currently parsed identically in 3+ places (`routes.go`, ansible-runner, orchestrator) with the same hex-decode + 32-byte pad/trim logic. This is duplicated and error-prone.

### 3.2 Solution

Add a `CryptoServiceFromEnv()` factory to `pkg/crypto`:

```go
// backend/pkg/crypto/factory.go
func CryptoServiceFromEnv() (*CryptoService, error) {
    key := os.Getenv("ENCRYPTION_KEY")
    if key == "" {
        return nil, nil // No encryption configured
    }
    keyBytes, err := hex.DecodeString(key)
    if err != nil {
        keyBytes = []byte(key) // fallback to raw bytes
    }
    // Pad or trim to 32 bytes for AES-256
    if len(keyBytes) < 32 {
        padded := make([]byte, 32)
        copy(padded, keyBytes)
        keyBytes = padded
    } else if len(keyBytes) > 32 {
        keyBytes = keyBytes[:32]
    }
    return NewCryptoService(keyBytes)
}
```

All binaries call `crypto.CryptoServiceFromEnv()` once at startup and share the instance.

### 3.3 Files to Modify

| File | Changes |
|------|---------|
| `backend/pkg/crypto/factory.go` | New — `CryptoServiceFromEnv()` |
| `backend/internal/api/v2/routes/routes.go` | Replace inline `ENCRYPTION_KEY` parsing with `crypto.CryptoServiceFromEnv()` |
| `backend/cmd/ansible-runner/main.go` | Use `crypto.CryptoServiceFromEnv()` |
| `backend/cmd/orchestrator/main.go` | Use `crypto.CryptoServiceFromEnv()` |

---

## Implementation Order

| Phase | Effort | Description | Depends on |
|-------|--------|-------------|------------|
| 3 | S | `CryptoServiceFromEnv()` factory | — |
| 1 | M | State file encryption in `state.Service` | Storage backend rework (#117), Phase 3 |
| 2 | M | VCS token encryption in `ProviderRegistry` | Phase 3 |

**Recommended sequence:** Phase 3 → Phase 1 → Phase 2. Phase 3 is a small prerequisite. Phases 1 and 2 are independent and can be done in parallel or either order.

---

## Migration & Backward Compatibility

### State files

- Existing plain JSON files remain readable via the "try decrypt, fallback to plain" pattern
- New and re-written state files are encrypted
- No batch migration needed — files are encrypted on next write
- Optionally: provide a CLI command or script to batch-encrypt existing state files

### VCS tokens

- Existing plaintext tokens in the database remain usable via the same fallback pattern
- New tokens and refreshed tokens (Azure DevOps OAuth) are stored encrypted
- No schema migration needed — the column type stays `text`
- Tokens are encrypted on next create, update, or OAuth refresh

### Never-expose guarantee

- `VCSConnection.AccessToken` and `RefreshToken` have `json:"-"` tags — never serialized in API responses
- Decrypted tokens are only passed in-memory to provider methods or embedded in clone URLs sent to runners
- Clone URLs in runner job payloads contain short-lived tokens (GitHub App) or are used once and not persisted

---

## Testing Strategy

### State file encryption

- Unit test: `SaveState` → verify stored bytes are not valid JSON (encrypted)
- Unit test: `RemoveResourceFromState` with encrypted state → roundtrip succeeds
- Unit test: `RemoveResourceFromState` with legacy plain JSON → backward compat
- Unit test: `decryptStateBytes` with `crypto == nil` → passthrough
- Integration test: full run cycle (create run → save state → read state via API)

### VCS token encryption

- Unit test: `EncryptTokens`/`DecryptTokens` roundtrip
- Unit test: `DecryptTokens` on plaintext (legacy) → returns unchanged
- Unit test: `ConnUpdater` wrapper encrypts before DB persist
- Unit test: Handler `Create` stores ciphertext (not equal to input)
- Integration test: Create VCS connection → use it to list repos → tokens decrypted correctly

### Key management

- Unit test: `CryptoServiceFromEnv()` with hex key, raw key, empty key
- Unit test: `CryptoServiceFromEnv()` with short key (padded) and long key (trimmed)

---

## Security Considerations

- **Key in memory:** The `CryptoService` holds the key in process memory. This is the standard Go approach. For enhanced security, consider a future integration with HashiCorp Vault or cloud KMS for key wrapping.
- **Key rotation:** Not in scope. Future work could add key versioning (prepend a key ID byte to ciphertext) and support decrypting with previous keys.
- **Logging:** Never log encryption keys, decrypted state content, or decrypted tokens. Log only "state encrypted"/"state decrypted (legacy)" at debug level.
- **Nonce reuse:** `CryptoService` generates a random nonce per encryption call. AES-GCM requires unique nonces — this is satisfied by `crypto/rand`.

---

## Success Criteria

- [ ] State files in object storage are AES-256-GCM encrypted; legacy plain files remain readable
- [ ] `VCSConnection.AccessToken` and `RefreshToken` are encrypted in the database
- [ ] Token refresh (Azure DevOps OAuth) stores re-encrypted tokens via `ConnUpdater`
- [ ] Ansible runner transparently decrypts tokens via `ProviderRegistry`
- [ ] `ENCRYPTION_KEY` parsing is consolidated in `crypto.CryptoServiceFromEnv()`
- [ ] No decrypted tokens appear in REST API responses or logs
- [ ] All backward compatibility tests pass (legacy plain data)

---

## Files to Modify (Summary)

| File | Phase | Changes |
|------|-------|---------|
| `backend/pkg/crypto/factory.go` | 3 | New — `CryptoServiceFromEnv()` |
| `backend/pkg/crypto/service.go` | 3 | Add `NewCryptoServiceFromHex` (optional, if `CryptoServiceFromEnv` doesn't cover all cases) |
| `backend/internal/services/state/service.go` | 1 | Add `crypto` field, encrypt on write, decrypt on read |
| `backend/internal/api/v2/handlers/terraform/state_versions.go` | 1 | Ensure storage reads go through state service |
| `backend/internal/services/vcs/registry.go` | 2 | Add `crypto` field, `EncryptTokens`/`DecryptTokens`, wrap `ConnUpdater` |
| `backend/internal/api/v2/handlers/vcs_connections.go` | 2 | Call `EncryptTokens` on create/update, remove TODO comments |
| `backend/internal/api/v2/routes/routes.go` | 1, 2, 3 | Use `CryptoServiceFromEnv()`, pass to state service + VCS registry |
| `backend/cmd/ansible-runner/main.go` | 2, 3 | Use `CryptoServiceFromEnv()`, pass to `ProviderRegistry` |
| `backend/cmd/orchestrator/main.go` | 2, 3 | Use `CryptoServiceFromEnv()`, pass to `ProviderRegistry` |

## References

- `backend/pkg/crypto/service.go` — existing `CryptoService` (AES-256-GCM)
- `backend/internal/services/state/service.go` — state file storage
- `backend/internal/services/vcs/registry.go` — VCS provider registry
- `backend/internal/services/vcs/provider.go` — `ProviderService` interface
- `backend/internal/api/v2/handlers/vcs_connections.go` — VCS connection CRUD
- `backend/internal/models/vcs_connection.go` — VCS connection model
- `backend/internal/services/variable/service.go` — existing variable encryption pattern
- `backend/internal/services/ansible/credential.go` — existing credential encryption pattern
- `docs/internal/plans/infrastructure/storage-backend-rework-plan.md` — prerequisite plan
