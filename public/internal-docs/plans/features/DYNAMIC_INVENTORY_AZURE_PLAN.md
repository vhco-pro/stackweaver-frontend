<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Plan: Dynamic Inventory — Dual Approach (UI-configured + VCS-backed)

TODO: Check if we really need to have the subject of the claim be TFC compliant because it seems to me that it's never created by the provider so in theory we could deviate to a more standard format for stackweaver but to be checked.

User-facing guide: [docs/user-guides/dynamic-inventories.md](../../../user-guides/dynamic-inventories.md)

## Goal

Enhance StackWeaver's dynamic inventory support with:
1. **Two approaches for dynamic inventories** — users can choose between UI-configured cloud sources (`dynamic` type) or VCS-backed inventory plugin files (`vcs` type). Neither is deprecated; both are fully supported.
2. **OIDC workload identity auth for Azure** — keyless authentication for the `azure.azcollection.azure_rm` inventory plugin, reusing the existing OIDC infrastructure built for Terraform.
3. **Robust dynamic inventory detection** — content-based detection via the `plugin:` YAML field, with filename fallback.

## Architecture: Two Approaches

### Why Both?

Not every user wants to manage infrastructure-as-code for their inventory source configs in a VCS repo. Some prefer the simplicity of configuring a cloud source directly in the UI. We support both:

| Approach | Inventory Type | Setup | Best For |
|----------|---------------|-------|----------|
| **UI-configured** | `dynamic` | Create inventory → Add Source (AWS/Azure/GCP/VMware) via the UI dialog | Quick setup, users who don't want a separate repo for inventory configs |
| **VCS-backed** | `vcs` | Store `azure_rm.yml` / `aws_ec2.yml` in a Git repo → point inventory to the file | GitOps workflows, version-controlled inventory configs, CI/CD integration |

### What Each Inventory Type Does

| Type | Source | Sync Target | Execution |
|------|--------|-------------|-----------|
| `static` | UI-defined hosts/groups | N/A | Directly in DB |
| `vcs` | Inventory file in VCS repo | Ansible runner (Redis queue) | Clone repo → `ansible-inventory --list` → cache hosts/groups in DB |
| `dynamic` | UI-configured cloud sources | Ansible runner (Redis queue) | Generate plugin YAML → `ansible-inventory --list` → cache hosts/groups in DB |

### Cache Pattern (shared by both `vcs` and `dynamic`)

When an inventory is synced, the discovered hosts and groups are stored in the database. This cached version is what the UI displays and what Ansible jobs use. Users can:
- View the cached inventory (hosts, groups, variables) in the UI at any time
- Trigger a manual re-sync to refresh the cache
- Configure update-on-launch to auto-resync before each job
- (Future) Set a sync schedule for periodic refresh

This avoids re-running the slow cloud provider API query on every Ansible job launch.

### VCS Detection: How the Frontend Knows It's Dynamic

The frontend detects whether a VCS-backed inventory file is a dynamic inventory plugin using two methods (in priority order):

1. **Content-based** (primary, most reliable): Parses the file content for the `plugin:` YAML key. Matches both fully-qualified names (`azure.azcollection.azure_rm`) and short names (`azure_rm`).
2. **Path-based** (fallback): Matches filename patterns like `azure_rm`, `aws_ec2`, `gcp_compute` before file content is loaded.

This means a user can name their file anything (e.g., `production-azure.yml`) and the detection still works as long as the `plugin:` field is present in the YAML content.

## Current State (What's Done)

### Phase 1: OIDC Workload Identity Auth ✅

Added OIDC workload identity as primary auth for Azure inventory sources in the API-side `InventorySourceService`. This code path works for both `dynamic` type sources (UI-configured) and will work for `vcs` type once the runner gets OIDC support (Phase 4).

**Changes made:**

| File | Change |
|------|--------|
| `services/ansible/inventory_source.go` | Added `azureOIDCRepo` + `oidcTokenService` fields, `SetOIDCServices()` method |
| `services/ansible/inventory_source.go` | New `getAzureOIDCEnvironment()` — generates JWT, writes to temp file, sets `AZURE_FEDERATED_TOKEN_FILE` / `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID` |
| `services/ansible/inventory_source.go` | Modified `getCredentialEnvironment()` — OIDC-first for Azure, fallback to credential |
| `services/ansible/inventory_source.go` | Fixed `AZURE_SECRET` → `AZURE_CLIENT_SECRET` |
| `services/ansible/inventory_source.go` | Added location filtering (`include_vm_locations`) and power state filter (`conditional_groups`) to `generateAzureInventoryYAML()` |
| `cmd/api/main.go` | Wired OIDC signing key + token service into `inventorySourceService` |
| `runner-images/ansible/Dockerfile` | Added `azure-mgmt-compute`, `azure-mgmt-network`, `azure-mgmt-subscription` pip packages |

**Auth priority**: OIDC workload identity (if `AzureOIDCConfiguration` exists for org) → Azure credential (client secret) → error.

### Phase 2: Frontend (Partial) ✅

| Change | Status |
|--------|--------|
| OIDC badge on Azure sources without credential | ✅ Done |
| Sync schedule dropdown in Add Source dialog | ✅ Done |
| Schedule badge in source list | ✅ Done |
| Azure OIDC auto-detection (checks if org has config) | ✅ Done |

### Phase 3: Ansible Runner Dockerfile ✅

The Dockerfile installs `azure-identity`, `azure-mgmt-resource`, `azure-mgmt-compute`, `azure-mgmt-network`, `azure-mgmt-subscription`, and `azure-cli-core`. The full collection `requirements.txt` (~60 packages) cannot be installed in the slim Python image because `uamqp` requires CMake/gcc, but the targeted packages are sufficient for the `azure_rm` inventory plugin.

## What Needs to Be Done

### Phase 4: Move OIDC Auth to the Runner ✅

The ansible-runner now has full OIDC workload identity support for VCS inventory sync, using azure-identity's native `WorkloadIdentityCredential` via a Python wrapper script.

**Problem**: The Azure RM Ansible collection (`azure.azcollection`) does NOT natively support OIDC workload identity or `AZURE_FEDERATED_TOKEN_FILE`. Its auth chain only checks for: MSI, CLI, client_id+secret+tenant, x509 cert, ad_user+password. An initial approach using `ExchangeOIDCForAzureToken` + `AZURE_ACCESS_TOKEN` env var failed because the collection never reads that env var.

**Solution**: A Python wrapper script (`backend/scripts/oidc-ansible-inventory`) monkey-patches the collection's `AzureRMAuth._get_credentials` to inject a `WorkloadIdentityCredential` when OIDC env vars are present. This uses the azure-identity SDK natively — no custom token exchange needed.

When the runner picks up an inventory sync job:
1. Looks up `AzureOIDCConfiguration` for the inventory's organization
2. Generates a federated JWT using the OIDC signing key
3. Writes the JWT to a temp file
4. Sets env vars: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_FEDERATED_TOKEN_FILE`
5. Runs `python3 /usr/local/bin/oidc-ansible-inventory` (wrapper) instead of `ansible-inventory`
6. The wrapper reads the env vars, creates `WorkloadIdentityCredential`, and patches the collection auth
7. Falls through to normal `ansible-inventory` behavior if OIDC vars aren't set

**Files modified:**
- `cmd/ansible-runner/main.go` — Added `azureOIDCRepo` and `oidcTokenService` fields, OIDC env var injection + wrapper command in `syncInventory()`
- `cmd/ansible-runner/main.go` — Initialization of OIDC signing key + token service (same pattern as `cmd/runner/main.go`)
- `backend/scripts/oidc-ansible-inventory` — NEW: Python wrapper with monkey-patch for `WorkloadIdentityCredential`
- `runner-images/ansible/Dockerfile` — COPY wrapper script to `/usr/local/bin/oidc-ansible-inventory`

### Phase 4b: Self-hosted Runner OIDC Support ✅

(Existing content unchanged — OIDC injection for self-hosted runner artifacts)

### Phase 4c: Move Dynamic (UI-configured) Sync to the Runner ✅

**Problem**: The `dynamic` type previously ran `ansible-inventory` in the API process. The API container doesn't have Ansible installed, causing `executable file not found in $PATH`.

**Solution**: Dynamic source sync now queues to the ansible-runner via Redis (same as VCS sync), and the runner handles execution.

**Changes made:**

| File | Change |
|------|--------|
| `cmd/ansible-runner/main.go` | Added `InventorySourceSyncMessage` struct and handler in `processSyncJob()` |
| `cmd/ansible-runner/main.go` | Added `inventorySourceService` field with OIDC wiring |
| `handlers/ansible/inventory_sources.go` | Changed Sync handler to enqueue `InventorySourceSyncMessage` to Redis `ansible_sync` queue |
| `handlers/ansible/inventory_sources.go` | Added `MarkSyncing` / `MarkSyncFailed` helper methods |
| `handlers/ansible/inventory_sources.go` | Added Redis queue field and initialization |
| `routes/ansible_routes.go` | Wired OIDC services and Redis queue to the inventory source handler |
| `services/ansible/inventory_source.go` | `SyncInventorySource()` uses OIDC wrapper for Azure when `AZURE_FEDERATED_TOKEN_FILE` is in env |
| `services/ansible/inventory_source.go` | `getAzureOIDCEnvironment()` writes JWT to temp file instead of token exchange |
| `services/ansible/inventory_source.go` | `getCredentialEnvironment()` passes `tempDir` for token file storage |
| `deploy/docker-compose.yml` | Added `oidc.env` to ansible-runner `env_file` |

### Phase 4d: Source Edit UI ✅

Users can now edit existing inventory sources directly from the inventory detail page.

**Changes made:**

| File | Change |
|------|--------|
| `frontend/src/pages/Ansible/InventoryDetail.tsx` | Added Edit Source dialog with all editable fields |
| `frontend/src/pages/Ansible/InventoryDetail.tsx` | Added "Edit" option in source dropdown menu |
| `frontend/src/pages/Ansible/InventoryDetail.tsx` | Auth type badges: OIDC (RefreshCw icon) and Credential (FileText icon) |
| `frontend/src/api/ansible.ts` | Added `credential-id` and `sync-schedule` to update API |
| `handlers/ansible/inventory_sources.go` | Expanded Update handler with `UpdateInventorySourceOptions` struct |
| `services/ansible/inventory_source.go` | `UpdateInventorySource()` accepts all fields: name, description, type, credential, enabled, config, schedule |

### Phase 5: Sync Schedule Support (Future)

The `sync_schedule` field exists on `AnsibleInventorySource` (for dynamic type) and could be added to `AnsibleInventory` (for VCS type). The orchestrator needs to:
1. Periodically check for inventories/sources due for sync
2. Enqueue sync jobs to the Redis queue
3. The runner processes them like manual syncs

This is the same pattern used for other scheduled tasks (job templates, playbook sync).

### Phase 6: Frontend — Dynamic Inventory Detection & Cloud Branding ✅

The frontend detects when a VCS-backed inventory file is a dynamic inventory plugin and displays prominent cloud-branded visual indicators.

**Detection utility** (`frontend/src/utils/dynamic-inventory.ts`):
- **Content-based detection (primary)**: Parses the `plugin:` YAML key for known plugin identifiers. Works regardless of filename — a file named `production.yml` with `plugin: azure.azcollection.azure_rm` is correctly detected.
- **Path-based detection (fallback)**: Recognizes `azure_rm`, `aws_ec2`, `gcp_compute` patterns in file paths when content hasn't loaded yet.
- Supports both fully-qualified (`azure.azcollection.azure_rm`) and short (`azure_rm`) plugin names.
- Returns provider info: icon path, color classes (bg, border, text), display label.

**Inventory Detail page** (`InventoryDetail.tsx`):
- Cloud provider icon replaces the generic GitBranch icon in the header when dynamic
- "Dynamic" badge with cloud icon appears next to the inventory name
- Type card shows provider-specific label (e.g., "Azure Dynamic Inventory" instead of "VCS")
- VCS info banner uses static Tailwind classes for proper JIT compilation
- Dynamic-specific description (e.g., "Hosts are automatically discovered from Azure")
- OIDC Workload Identity badge when org has Azure OIDC configured

**Inventory List page** (`Inventories.tsx`):
- Inventory cards show cloud provider SVG icon for dynamic VCS inventories
- Card badge shows provider name (e.g., "Azure") instead of "VCS"

**Icons used**: `/public/icons/azurerm.svg`, `/public/icons/aws.svg`, `/public/icons/google.svg` (already in project)

### Phase 6b: Bug Fixes ✅

**Inventory Source creation bug** (`handlers/ansible/inventory_sources.go`):
- The Create/Update handlers expected flat JSON but the frontend sends JSON:API format (`data.attributes`). Updated both handlers to parse `req.Data.Attributes` matching the pattern used by all other Ansible handlers (hosts, groups, inventories).

**Dynamic inventory detection robustness** (`utils/dynamic-inventory.ts`):
- Reversed detection priority: content-based (`plugin:` field) is now checked first, path-based second. Previously, path-based was first, meaning files not named `azure_rm.yml` wouldn't be detected even if they had the correct `plugin:` field.
- Added short plugin name variants (e.g., `plugin: azure_rm` without full collection prefix).

**Visual issues** (`InventoryDetail.tsx`, `Inventories.tsx`):
- Fixed `<img alt>` text leaking as visible text next to provider icons. All decorative icons now use `alt=""`.
- Fixed Tailwind JIT compilation failure: the VCS banner dynamically generated border class names (`border-${provider}-500/20`) which Tailwind can't detect at build time. Replaced with static `borderClass` and `bgClassLight` properties on the plugin definition.

### Phase 6c: JSON:API Response Formatting & Sync Feedback ✅

**Inventory Source JSON:API response** (`handlers/ansible/inventory_sources.go`):
- All CRUD handlers (Create, Get, List, Update) now return proper JSON:API format with `formatInventorySourceResponse()` helper, matching the `data.id/type/attributes/relationships` convention. Previously, Create returned the raw GORM model, causing the frontend's `getAnsibleInventorySourceFromJsonApi()` to get `undefined`.
- The List handler now manually formats JSON:API pagination instead of using the generic `response.Paginated` helper (which doesn't do JSON:API formatting).

**Azure icon fix** (`public/icons/azurerm.svg`):
- The SVG file contained error text from a failed download ("Package size exceeded the configured limit..."). Replaced with the actual Azure logo SVG.

**YAML syntax highlighting** (`components/code/InventoryFileViewer.tsx`):
- Added YAML format detection in `detectFormat()` — checks for `---` document markers, `plugin:` keys, and colon-based key:value patterns.
- Added `tokenizeYamlLine()` and `tokenizeYamlValue()` functions. Handles: document markers (`---`), comments, indentation, list items (`-`), key:value pairs, booleans, numbers, quoted strings, Jinja2 expressions (`{{ }}`), plugin FQCNs, flow sequences/mappings, and comparison expressions.

**Sync result reporting** (`cmd/ansible-runner/main.go`, `models/ansible_inventory.go`):
- Added `syncResult` struct that carries `HostsDiscovered` count and `Stderr` output from `ansible-inventory`.
- `syncInventory()` now returns `(syncResult, error)` instead of just `error`.
- New model fields: `LastSyncHostsDiscovered` (int) and `LastSyncLog` (text for stderr/warnings).
- On success, the runner stores host count and any stderr warnings. On failure, stderr is preserved alongside the error message.
- Backend's `formatInventoryResponse()` now includes `last-sync-hosts-discovered` and `last-sync-log` attributes.

**Frontend sync feedback** (`InventoryDetail.tsx`, `ansible-jsonapi.ts`, `ansible.ts`):
- Toast messages now show host count: "Inventory synced successfully — 3 hosts discovered" or a warning when 0 hosts found.
- New "Last Sync" stat card for VCS inventories showing host count, status icon, and timestamp.
- Sync error banner (red) with pre-formatted error text when sync fails.
- Sync warnings banner (amber) showing stderr output from ansible-inventory when present.
- `AnsibleInventory` type and JSON:API parser extended with `last_sync_hosts_discovered` and `last_sync_log` fields.

### Phase 6d: Dockerfile Fix, Copy Buttons & Documentation ✅

**Ansible runner Dockerfile fix** (`runner-images/ansible/Dockerfile`):
- The `azure.azcollection.azure_rm` inventory plugin failed at runtime with `name 'azure_cloud' is not defined` because the `azure-cli-core` Python package was missing. The collection's internal module (`azure_rm_common.py`) does `from azure.cli.core import cloud as azure_cloud`, which requires this package.
- Added `azure-cli-core` to the pip install alongside the existing Azure SDK packages.
- Note: installing the full collection `requirements.txt` was attempted but failed because `uamqp` requires CMake/gcc build tools not present in the slim Python base image. The targeted approach (adding only `azure-cli-core`) is sufficient for the `azure_rm` inventory plugin.

**Copy buttons on sync cards** (`InventoryDetail.tsx`):
- Added a clipboard copy button (ghost icon) to both the sync error banner (red) and sync warnings banner (amber).
- Uses the same `navigator.clipboard.writeText` pattern as other copy buttons in the codebase.
- Shows "Copied to clipboard" toast on success.

**Azure icon cache busting** (`utils/dynamic-inventory.ts`):
- Added `?v=2` query parameter to the Azure icon path to bust browser cache of the previous broken SVG file (which contained error text instead of the actual icon).

**User-facing documentation** (`docs/user-guides/dynamic-inventories.md`):
- Comprehensive guide covering both VCS-backed and UI-configured dynamic inventories.
- Sections: how it works, two approaches comparison, prerequisites per cloud provider, step-by-step creation for VCS-backed and UI-configured, authentication (OIDC + credentials), cloud provider detection, viewing synced hosts, troubleshooting.
- Troubleshooting covers: `azure_cloud` NameError, auth errors, zero hosts, deprecated option warnings, icon not appearing.

### Phase 6e: Wrapper Fix, Source Card UX & Polling ✅

**OIDC wrapper fix** (`backend/scripts/oidc-ansible-inventory`):
- The original wrapper pre-imported `azure_rm_common` before `InventoryCLI.run()`, which corrupted Ansible's collection metadata loader in Python 3.14. The error was: "Error loading plugin 'azure.azcollection.azure_rm': collection metadata was not loaded for collection azure.azcollection".
- Root cause: early import of any module under `ansible_collections.*` before the CLI initializes breaks the collection path resolution. `ANSIBLE_COLLECTIONS_PATH` env var doesn't help. `sys.meta_path` import hooks using `find_module`/`load_module` don't fire in Python 3.14 (deprecated protocol).
- Fix: rewrote the wrapper to use a lazy `builtins.__import__` override (one-shot hook). The hook installs before `InventoryCLI` starts and waits for Ansible's own code to import `azure_rm_common`. When that import fires, the hook patches `AzureRMAuth._get_credentials` and immediately restores the original `__import__` function.

**Source sync polling** (`InventoryDetail.tsx`):
- `handleSyncSource()` now polls every 2 seconds (max 30 polls = 60s) for source status changes, matching the existing `handleSync()` pattern for VCS inventories.
- On completion, refreshes hosts and groups, shows toast with host count or error message.
- If sync takes longer than 60 seconds, shows a "taking longer than expected" warning.

**Source card cloud provider icons** (`InventoryDetail.tsx`):
- Source cards now display the actual cloud provider SVG icon (`/icons/azurerm.svg`, `/icons/aws.svg`, `/icons/google.svg`) instead of the generic lucide `Cloud` icon.
- Icon background color matches the provider (blue for Azure, orange for AWS, red for GCP).
- Removed the redundant uppercase type badge (e.g., "AZURE") — the icon alone identifies the provider.

**Source card error display** (`InventoryDetail.tsx`):
- Error output now shows in a styled destructive banner with an `XCircle` icon and monospace `<pre>` formatting.
- Only displayed when the source status is `failed` (not on successful re-sync).
- A copy button on the error banner lets users copy the full error text to clipboard.

**Files modified:**

| File | Change |
|------|--------|
| `backend/scripts/oidc-ansible-inventory` | Rewrote with lazy `builtins.__import__` hook (no early imports) |
| `frontend/src/pages/Ansible/InventoryDetail.tsx` | Source sync polling, cloud SVG icons, error display with copy |

### Phase 7: Integration Testing

1. Create a VCS-backed inventory pointing to an `azure_rm.yml` file in a repo
2. Sync it — verify the runner generates an OIDC token, queries Azure, discovers VMs
3. Verify hosts/groups appear cached in the DB and the UI
4. Run an Ansible job against the cached inventory — verify it uses cached hosts without re-syncing
5. Manual re-sync — verify cache is updated
6. Test OIDC token expiry/refresh, fallback to credential, error cases

## Data Flow: UI-configured Dynamic Inventory (type=dynamic)

```
User creates inventory (type=dynamic) via UI
         ↓
User adds a Source (e.g., Azure VMs) via "Add Source" dialog
         ↓
User selects auth method: OIDC Workload Identity or Cloud Credential
         ↓
User clicks "Sync" on the source
         ↓
API enqueues InventorySourceSyncMessage to Redis `ansible_sync` queue
         ↓
Ansible Runner picks up the message
         ↓
Runner generates azure_rm.yml plugin config from source settings
         ↓
Runner looks up credentials (OIDC config or stored credential)
         ↓
For OIDC: Runner writes JWT to temp file, uses OIDC-aware wrapper (python3 oidc-ansible-inventory)
For credential: Runner sets AZURE_CLIENT_ID/SECRET/TENANT env vars, uses ansible-inventory
         ↓
Plugin queries Azure ARM API, returns JSON with VMs
         ↓
Runner parses output, creates/updates hosts and groups in database (THE CACHE)
         ↓
UI shows cached hosts/groups on the Hosts tab
```

## Data Flow: VCS-backed Dynamic Inventory (type=vcs) with OIDC

```
User stores azure_rm.yml in their Git repo:
  ---
  plugin: azure.azcollection.azure_rm
  include_vm_resource_groups:
    - my-resource-group
  conditional_groups:
    running: powerstate == "running"
         ↓
User creates StackWeaver inventory (type=vcs, repo=org/infra, path=inventory/azure_rm.yml)
         ↓
User clicks "Sync" (or update-on-launch triggers on job run)
         ↓
API enqueues InventorySyncMessage to Redis with inventory ID
         ↓
Ansible Runner picks up the message
         ↓
Runner loads inventory from DB, gets organization ID
         ↓
Runner looks up AzureOIDCConfiguration for the organization
         ↓
Runner generates OIDC JWT using TokenService (same signing key as Terraform)
         ↓
Runner writes token to temp file, sets AZURE_FEDERATED_TOKEN_FILE env vars
         ↓
Runner clones VCS repo, finds azure_rm.yml
         ↓
Runner runs: python3 /usr/local/bin/oidc-ansible-inventory -i azure_rm.yml --list  (with OIDC env vars)
         ↓
Wrapper monkey-patches Azure RM collection auth to use WorkloadIdentityCredential
         ↓
azure-identity SDK authenticates with Azure AD using the federated token
         ↓
Plugin queries Azure ARM API, returns JSON with VMs
         ↓
Runner parses output, creates/updates hosts and groups in database (THE CACHE)
         ↓
Runner updates inventory sync status + timestamp
         ↓
UI shows cached hosts/groups — no need to re-query Azure until next sync
```

## Files Summary

| File | Change | Phase | Status |
|------|--------|-------|--------|
| `services/ansible/inventory_source.go` | Fix `AZURE_SECRET` → `AZURE_CLIENT_SECRET` | 1 | ✅ Done |
| `services/ansible/inventory_source.go` | Add location + power state filters to Azure YAML | 1 | ✅ Done |
| `services/ansible/inventory_source.go` | Add OIDC workload identity auth (API-side) | 1 | ✅ Done |
| `cmd/api/main.go` | Wire OIDC services into inventory source service | 1 | ✅ Done |
| `runner-images/ansible/Dockerfile` | Add azure-mgmt-compute/network/subscription | 3 | ✅ Done |
| `frontend/src/pages/Ansible/InventoryDetail.tsx` | OIDC badge, schedule dropdown/badge | 2 | ✅ Done |
| `docs/features/ansible/api-reference.md` | Document OIDC + dynamic via VCS | - | ✅ Done |
| `docs/features/ansible/roadmap.md` | Add feature to completed list | - | ✅ Done |
| `handlers/ansible/inventory_sources.go` | Fix JSON:API parsing (Create/Update used flat JSON instead of `data.attributes`) | 6b | ✅ Done |
| `handlers/ansible/inventory_sources.go` | JSON:API response formatting for all CRUD handlers | 6c | ✅ Done |
| `frontend/src/utils/dynamic-inventory.ts` | Content-first detection, short plugin names, `bgClassLight`/`borderClass` | 6b | ✅ Done |
| `frontend/src/pages/Ansible/InventoryDetail.tsx` | Fix alt text leaking, fix dynamic Tailwind classes | 6b | ✅ Done |
| `frontend/src/pages/Ansible/Inventories.tsx` | Fix alt text leaking on cloud icons | 6b | ✅ Done |
| `frontend/public/icons/azurerm.svg` | Replace broken SVG (was error text) with actual Azure logo | 6c | ✅ Done |
| `frontend/src/components/code/InventoryFileViewer.tsx` | Add YAML format detection and syntax highlighting | 6c | ✅ Done |
| `backend/internal/models/ansible_inventory.go` | Add `LastSyncHostsDiscovered` and `LastSyncLog` fields | 6c | ✅ Done |
| `cmd/ansible-runner/main.go` | Return `syncResult` with host count + stderr from sync | 6c | ✅ Done |
| `cmd/ansible-runner/main.go` | Add OIDC token generation + wrapper for VCS inventory sync | 4 | ✅ Done |
| `cmd/ansible-runner/main.go` | Inject Azure OIDC env vars into OIDC wrapper command | 4 | ✅ Done |
| `cmd/ansible-runner/main.go` | Add `InventorySourceSyncMessage` handler in `processSyncJob()` | 4c | ✅ Done |
| `cmd/ansible-runner/main.go` | Add `inventorySourceService` field with OIDC wiring | 4c | ✅ Done |
| `backend/scripts/oidc-ansible-inventory` | NEW: Python wrapper for WorkloadIdentityCredential monkey-patch | 4 | ✅ Done |
| `runner-images/ansible/Dockerfile` | COPY OIDC wrapper script to `/usr/local/bin/` | 4 | ✅ Done |
| `services/ansible/inventory_source.go` | `getAzureOIDCEnvironment()` writes JWT to temp file (not token exchange) | 4c | ✅ Done |
| `services/ansible/inventory_source.go` | `SyncInventorySource()` uses OIDC wrapper for Azure sources | 4c | ✅ Done |
| `handlers/ansible/inventory_sources.go` | Sync handler enqueues to Redis instead of running directly | 4c | ✅ Done |
| `routes/ansible_routes.go` | Wire OIDC services + Redis queue to inventory source handler | 4c | ✅ Done |
| `deploy/docker-compose.yml` | Add `oidc.env` to ansible-runner env_file | 4c | ✅ Done |
| `frontend/src/pages/Ansible/InventoryDetail.tsx` | Edit Source dialog, auth type badges | 4d | ✅ Done |
| `frontend/src/api/ansible.ts` | Add credential-id + sync-schedule to update API | 4d | ✅ Done |
| `services/ansible/inventory_source.go` | `UpdateInventorySource()` expanded with `UpdateInventorySourceOptions` | 4d | ✅ Done |
| `services/oidc/azure_token_exchange.go` | Token exchange function (kept but unused — superseded by wrapper) | 4 | ✅ Done |
| `backend/internal/api/v2/handlers/ansible/inventories.go` | Add `last-sync-hosts-discovered` and `last-sync-log` to JSON:API response | 6c | ✅ Done |
| `frontend/src/api/ansible.ts` | Add `last_sync_hosts_discovered` and `last_sync_log` to type | 6c | ✅ Done |
| `frontend/src/utils/ansible-jsonapi.ts` | Parse new sync fields from JSON:API | 6c | ✅ Done |
| `frontend/src/pages/Ansible/InventoryDetail.tsx` | Sync toast with host count, Last Sync card, error/warning banners | 6c | ✅ Done |
| `runner-images/ansible/Dockerfile` | Add azure-cli-core to pip install (fixes azure_cloud error) | 6d | ✅ Done |
| `frontend/src/pages/Ansible/InventoryDetail.tsx` | Copy buttons on sync error/warning banners | 6d | ✅ Done |
| `frontend/src/utils/dynamic-inventory.ts` | Cache-busting `?v=2` on Azure icon path | 6d | ✅ Done |
| `docs/user-guides/dynamic-inventories.md` | User-facing guide for dynamic inventories | 6d | ✅ Done |
| `handlers/runner_agent.go` | OIDC injection for self-hosted runner artifacts (TF + Ansible) | 4b | ✅ Done |
| `routes/routes.go` | Wire OIDC services into RunnerAgentHandler | 4b | ✅ Done |
| `cmd/ansible-runner/agent_mode.go` | Consume `environment_vars` from artifacts in self-hosted runner | 4b | ✅ Done |
| `frontend/src/utils/dynamic-inventory.ts` | Cloud provider detection utility | 6 | ✅ Done |
| `frontend/src/pages/Ansible/InventoryDetail.tsx` | Cloud branding, dynamic badges, provider icons | 6 | ✅ Done |
| `frontend/src/pages/Ansible/Inventories.tsx` | Cloud icons and labels in inventory list | 6 | ✅ Done |
| `backend/scripts/oidc-ansible-inventory` | Rewritten with lazy `builtins.__import__` hook (fixes collection metadata error) | 6e | ✅ Done |
| `frontend/src/pages/Ansible/InventoryDetail.tsx` | Source sync polling, cloud SVG icons, error display with copy | 6e | ✅ Done |
| Orchestrator | Scheduled sync for inventories/sources | 5 | 🔲 Future |

## Architecture Notes

- **Dual approach, no deprecation**: Both `dynamic` (UI-configured) and `vcs` (repo-backed) inventory types are first-class. Users choose based on their workflow preference. Neither approach is deprecated.
- **OIDC reuse**: The Azure OIDC configuration created via `tfe_azure_oidc_configuration` (or the Settings > OIDC page) is shared between Terraform runs and Ansible inventory sync. One federated identity credential, one signing key.
- **OIDC wrapper pattern**: The Azure RM Ansible collection does NOT natively support workload identity. A Python wrapper (`oidc-ansible-inventory`) monkey-patches `AzureRMAuth._get_credentials` to inject a `WorkloadIdentityCredential` from the azure-identity SDK. The monkey-patch uses a lazy `builtins.__import__` hook — it waits for Ansible to naturally import `azure_rm_common` during CLI initialization, then patches at that point. Importing the module early corrupts Ansible's collection metadata loader in Python 3.14. The wrapper falls through to normal auth when OIDC env vars aren't set.
- **Cache = DB**: The database hosts/groups table IS the cache. Syncing populates it, the UI reads it, Ansible jobs use it.
- **Content-first detection**: Dynamic inventory plugin detection uses the `plugin:` YAML key as the primary signal, with filename patterns as a fallback. This means files can be named anything and still be correctly identified.
- **Static Tailwind classes**: All CSS class names in the plugin definitions are full static strings (e.g., `bg-blue-500/5`, `border-blue-500/20`) to ensure Tailwind's JIT compiler includes them. Never use string interpolation to build class names.
- The design is provider-extensible: the same OIDC pattern works for AWS (STS AssumeRoleWithWebIdentity), GCP (Workload Identity Federation), etc.
- **Unified execution**: Both `dynamic` and `vcs` types now run in the ansible-runner via Redis queue. The API only enqueues sync requests.

## References

- [Azure Dynamic Inventories](https://docs.ansible.com/projects/ansible/latest/collections/azure/azcollection/azure_rm_inventory.html#ansible-collections-azure-azcollection-azure-rm-inventory)
[AWS Dynamic Inventories](https://docs.ansible.com/projects/ansible/latest/collections/amazon/aws/docsite/aws_ec2_guide.html)