<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# State Storage: Design, Debug, and TFE Comparison

**Date**: 2026-01-28  
**Status**: Analysis + minimal compose change (named volume `minio_data` defined only; no MinIO mount)  
**Context**: User asked how TFE stores state, whether dual storage is redundant, how the frontend reads state. Clarified: all workspaces are remote; we store **metadata** (which resources applied, etc.) in DB, **state** in object storage so Terraform can reach it. No full state in DB.

---

## 1. How Terraform Enterprise stores state

TFE uses **one place** for the actual state file:

- **Object storage** (S3-compatible): State **files**, plan files, run logs, configuration versions. ([TFE storage overview](https://developer.hashicorp.com/terraform/enterprise/deploy/configuration/storage), [object storage config](https://developer.hashicorp.com/terraform/enterprise/deploy/configuration/storage/connect-object).)
- **PostgreSQL**: Application data, workspace/org settings, **run info**, **metadata** – **not** the raw state JSON.

So **TFE does not store state in the DB**. State lives only in object storage. There is **no** “store in two places” for state in TFE.

---

## 2. How we store state today

### 2.1 Two creation paths

| Path | When | Where we store | `state_versions.state_data` |
|------|------|----------------|-----------------------------|
| **Runner** (StackWeaver runs) | Apply via orchestrator/runner | **DB** + **MinIO** | Full state (jsonb) |
| **API** (remote backend push) | `terraform apply` with `backend "remote"` → `POST /workspaces/:id/state-versions` | **MinIO only** | **Empty** |

- **Runner**: `state.Service.SaveState` writes to DB (`state_data`) and MinIO (`workspaces/{workspace_id}/state/{version}.json`). See `backend/cmd/runner/main.go` (state save after apply) and `backend/internal/services/state/service.go`.
- **API**: Handler creates a `state_versions` row with **empty `state_data`** and uploads the JSON to MinIO. See `backend/internal/api/v2/handlers/terraform/state_versions.go` (Create, ~541–579).

### 2.2 Where we read state from (API → frontend)

All **read** paths use the **DB only**:

- **List state versions** (`GET /workspaces/:id/state-versions`): Returns `state_versions` rows from DB. Frontend uses `latestStateVersion.state_data` for Resources/Outputs tabs.
- **Get state version** (`GET /state-versions/:id`): Returns one row from DB.
- **Run outputs** (`GET /runs/:id/outputs`): Loads state version by `run_id`, then `extractOutputsFromStateData(version, …)`. That reads **only** `version.StateData` from the DB. We **never** fetch from MinIO here.

The **only** place we fall back to MinIO when `state_data` is empty is **`state.Service.RemoveResourceFromState`** (terraform state rm). List/Get/Outputs do **not** do that.

So:

- **Runner-created state**: `state_data` is set → frontend and run outputs work.
- **API-created state**: `state_data` is empty, state only in MinIO → frontend gets **empty** resources/outputs, and run outputs are **empty** (we still return 200 with `data: []` when we have a state version but no outputs in state_data). We **never** serve API-created state from MinIO to the UI.

---

## 3. All workspaces remote; metadata vs state

All workspaces use the **remote** backend. We store **metadata** in the DB (state version rows, run links, etc.) and **state** in object storage so Terraform can push/pull it. The frontend reads **metadata** (and, when available, outputs/resources derived from state) to show which resources applied, run outputs, etc. Full state is **not** stored in the DB; it lives in object storage.

---

## 4. Redundancy: TFE vs us

- **TFE**: State in **one** place (object storage). No duplication with DB.
- **Us**:  
  - Runner: **two** places (DB + MinIO).  
  - API: **one** place (MinIO only), but we **don’t** use MinIO when serving list/get/outputs.

So the “redundancy” is our **runner** dual-write. TFE does not do that. We could:

- **Single store**: Either DB-only or MinIO-only for state, and use that consistently for both runner and API.
- **Dual store**: Keep DB + MinIO only if we want a backup tier and accept the extra complexity.

---

## 5. Frontend “needs to read state after the run”

Today:

- **Run detail** → Run outputs come from `GET /runs/:id/outputs` → state version by `run_id` → `extractOutputsFromStateData(version)` → **DB only** (`state_data`).
- **Workspace detail** → Resources/Outputs tabs use `stateVersionsApi.list` → `latestStateVersion.state_data` → **DB only**.

So the frontend **already** reads state only from the DB (via our API). It does **not** talk to MinIO. For that to work:

- State must **exist in DB** (`state_data`). That’s true for **runner-created** state.
- For **API-created** state we store nothing in DB → frontend always sees empty Resources/Outputs for that workspace, and run outputs are empty.

We do **not** store full state in the DB; state stays in object storage so Terraform can reach it. Metadata (state version IDs, run linkage, etc.) lives in the DB.

---

## 6. tfe_variable drift fix (2026-01-28)

Terraform plan showed “+5 To Add” for `tfe_variable` resources that were already applied because we did **not** expose a working **state download** path. Terraform remote backend fetches current state via `GET /workspaces/:id/current-state-version`, then downloads from `hosted-state-download-url`. We lacked both.

**Changes made:**

- **`GET /workspaces/:id/current-state-version`**: Returns latest state version with **`hosted-state-download-url`** pointing at our API download URL.
- **`GET /state-versions/:id/download`**: Streams raw state JSON from object storage (or DB when present). Terraform fetches from this URL (with auth).
- **`GET /state-versions/:id`**: Attributes now include **`hosted-state-download-url`**.

State remains in object storage; we serve it via the download endpoint so Terraform can pull it and stop drifting.

---

## 7. Named MinIO volume “without losing current state”

**Today:** MinIO uses an **anonymous** volume for `/data` (or none). Current state files (and any other MinIO data) live there.

**If we add a named volume** (e.g. `minio_data:/data` in compose) and **recreate** the MinIO container:

- Compose will mount the **new** named volume at `/data`.
- MinIO will use that **new** volume, which is **empty**.
- The **old** data stays in the anonymous volume (until pruned), but MinIO **no longer uses it** → we effectively “lose” current MinIO-backed state from MinIO’s perspective.

So **adding a named volume and switching MinIO to it** **does** lose current state **unless** we migrate.

**Ways to avoid losing current state:**

1. **Don’t recreate MinIO yet.** Add the named volume to `docker-compose.yml` but **don’t** run `docker compose up -d --force-recreate` for MinIO. Existing MinIO keeps using its current (anonymous) volume. New installs get the named volume from day one. When you’re ready to migrate (or accept loss), you can recreate MinIO.
2. **Migrate first.** Before switching:
   - Add a named volume to compose.
   - Run a one-off container that mounts both the current MinIO data (anonymous volume) and the new named volume, then copy `/data` contents into the named volume.
   - Recreate MinIO using the named volume. MinIO then uses the migrated data.

**Practical safe approach:** Add a **named volume** `minio_data` in the `volumes` section only (no MinIO mount yet). That **does not** change MinIO’s current storage → **no loss** of current state. When ready:
- **New installs**: Add `minio_data:/data` to the MinIO service volumes; MinIO uses the named volume from day one.
- **Existing installs**: Migrate data from the current (anonymous) MinIO volume to `minio_data`, then add the mount and recreate MinIO. See [STATE_WIPE_AND_USERS_REMOVED_RCA](STATE_WIPE_AND_USERS_REMOVED_RCA.md) and compose comments.

**Done:** `minio_data` is defined in `deploy/docker-compose.yml`; the MinIO service does **not** use it yet, so current state is unchanged.

---

## 8. Summary

| Topic | Finding |
|-------|--------|
| **TFE state storage** | State **only** in object storage; DB for metadata. No dual store. |
| **Our state write** | Runner: DB + MinIO. API (remote backend): MinIO only, `state_data` empty. |
| **Our state read** | List, Get, Run outputs use **DB only**. MinIO used only in `RemoveResourceFromState` when `state_data` empty. |
| **Frontend** | Reads state via our API → DB. Never MinIO. |
| **Metadata vs state** | All workspaces remote. Metadata in DB; state in object storage. No full state in DB. |
| **Redundancy** | TFE: no. Us: runner dual-write (DB+MinIO) for runner-created state; API MinIO-only. |
| **Store full state in DB?** | **No.** State stays in object storage so Terraform can reach it. |
| **Named MinIO volume** | Safe **if** we don’t recreate MinIO (keep current anonymous volume). Add named volume for new installs; migrate before switching existing MinIO. |
| **Drift fix** | `current-state-version` + `hosted-state-download-url` + `GET /state-versions/:id/download` so Terraform can pull state. |

---

## 9. References

- TFE storage: [Data storage overview](https://developer.hashicorp.com/terraform/enterprise/deploy/configuration/storage), [object storage](https://developer.hashicorp.com/terraform/enterprise/deploy/configuration/storage/connect-object).
- Our state create: `state_versions.go` Create (API), `state.Service.SaveState` (runner).
- Our state read: `state_version` repo, `extractOutputsFromStateData`, `RemoveResourceFromState` (MinIO fallback).
- Frontend: `WorkspaceDetail` (state versions, resources/outputs), `RunDetail` / `useRunPolling` (run outputs), `ApplyOutputViewer`, `stateVersionsApi`, `runsApi.getOutputs`.
- RCA: `docs/internal/analysis/STATE_WIPE_AND_USERS_REMOVED_RCA.md`.
- Drift fix: `GET /workspaces/:id/current-state-version`, `GET /state-versions/:id/download`, `hosted-state-download-url` in state version responses — `backend/internal/api/v2/handlers/terraform/state_versions.go`, `routes.go`.
