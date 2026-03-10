<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Root Cause Analysis: Terraform State Wipe & Users “Removed”

**Date**: 2026-01-28  
**Status**: Analysis complete (no code changes yet)  
**Context**: Workspace run `run-a1YW1xXG5Bexa1YW`, tfe-tests config (varset-tests.tf, main.tf). User reports state “wiped” and users “removed” despite no DB drop or manual state removal. **Only one workspace** was affected; others were fine.

---

## 1. What actually happened

- **Terraform state**: Terraform no longer “sees” previously applied resources (e.g. `tfe_variable`, `tfe_variable_set`, `tfe_organization_membership`). On `terraform apply` it tries to create them again → **409 Conflict** (“variable X already exists in this variable set”, etc.).
- **Users “removed”**: Users that used to exist (org members / team members) disappeared from the UI. User recreated them via `tfe_organization_membership` (and related resources).
- **DB not dropped**: Postgres data (organizations, projects, workspaces, variables, variable sets, etc.) is still there. “Variable already exists” confirms that.

So: **Terraform’s state was lost**; **StackWeaver’s DB was not wiped**. Users “removed” is a separate, already-documented issue (org visibility / `organization_members`).

---

## 2. Root cause: Terraform state wipe

### 2.1 Where we store Terraform state

- **Runner-created state** (runs executed by StackWeaver): Stored in **DB** (`state_versions.state_data` jsonb) **and** MinIO (`workspaces/{workspace_id}/state/{version}.json`). See `state.Service.SaveState` and runner usage.
- **API-created state** (Terraform remote backend push via `POST /workspaces/:id/state-versions`): Stored **only in MinIO**. We create a `state_versions` row with **empty `state_data`** and put the raw state JSON in MinIO. See `StateVersionHandlerV2.Create` in `backend/internal/api/v2/handlers/terraform/state_versions.go` (lines 541–579).

Your tfe-tests use the **remote** backend (`terraform { backend "remote" { ... } }` in `providers.tf`). Terraform pushes state to our API → we write only to MinIO for that path. So **remote-backend state lives only in MinIO**.

### 2.2 MinIO volume is anonymous (fragile)

In `deploy/docker-compose.yml`, the MinIO service:

- Uses `command: server /data`.
- **Has no named volume** declared for `/data` (unlike Postgres’s `postgres_data`).

Docker typically creates an **anonymous** volume for `/data` when the container writes there. That volume can persist across `docker compose down` / `up` **unless**:

- You run **`docker compose down -v`** (removes volumes) → MinIO data is wiped.
- You run **`docker volume prune`** (or similar) and the anonymous volume is considered unused → it can be removed.
- The MinIO container is recreated in a way that gets a **new** anonymous volume (e.g. compose project/path change, or volume was explicitly removed) → old data is orphaned.

So MinIO **can** persist, but it’s fragile. Losing that anonymous volume (e.g. `down -v` or prune) wipes all object storage, including state files.

By contrast, Postgres uses a **named** volume `postgres_data` in compose, so it’s explicit and stable.

### 2.3 Effect when MinIO is recreated

1. MinIO is recreated → all buckets (`iac-state`, `terraform-registry`, etc.) and objects are wiped.
2. State version **rows** remain in Postgres (we never deleted them), but the actual state JSON for API-created versions was only in MinIO → **gone**.
3. When Terraform (or our backend) tries to read state, we either:
   - Serve from `state_data` when non-empty (runner path), or
   - Fetch from MinIO when `state_data` is empty (API path). See e.g. `state.Service.RemoveResourceFromState` (load from MinIO when `StateData` empty).
4. For API-created state, MinIO fetch fails or returns nothing → we effectively have **no state** to return.
5. Terraform then behaves as if there is **no state**: it tries to create all resources again → **409 Conflict** because variables, variable sets, etc. already exist in Postgres.

So the “state wipe” is **MinIO data loss**, not Postgres deletion.

### 2.4 What could have triggered state loss

- **`docker compose down -v`** (or equivalent) → removes volumes, including MinIO’s anonymous `/data` volume → all state files gone.
- **`docker volume prune`** (or similar) → can remove the anonymous MinIO volume if it’s considered unused.
- **Recreating MinIO with a new anonymous volume** (e.g. after removing the old volume, or changing compose project/path) → old MinIO data is orphaned.
- **Deployments or “migrations”** that run `down -v` or prune volumes.

Without exact timestamps we can’t pin it to a specific command, but **losing the MinIO volume** (via `-v`, prune, or switching to a new volume) explains the state wipe.

### 2.5 Why only one workspace? (user correction)

User clarified: **all workspaces are remote**. We store **metadata** in DB and **state** in object storage. “Only one workspace” may have been due to that workspace’s state (or MinIO data) being lost specifically; or drift from missing **hosted-state-download-url** (see §2.6).

### 2.6 tfe_variable drift (fixed 2026-01-28)

Terraform plan showed “+5 To Add” for `tfe_variable` resources already applied because we did **not** expose a working state **download** path. The remote backend fetches `GET /workspaces/:id/current-state-version`, then downloads from `hosted-state-download-url`. We lacked both, so Terraform couldn’t pull state → saw “no state” → drift.

**Fix:** Added `GET /workspaces/:id/current-state-version`, `GET /state-versions/:id/download`, and `hosted-state-download-url` in state version responses. State stays in object storage; we serve it via the download endpoint. See [STATE_STORAGE_DESIGN_AND_DEBUG](STATE_STORAGE_DESIGN_AND_DEBUG.md) §6.

---

## 3. Users “removed” (separate from state wipe)

Users disappearing from the UI and having to be “recreated via the provider” is the **same issue** as in [TEAM_BASED_ORG_ACCESS_FIX.md](../status/auth/TEAM_BASED_ORG_ACCESS_FIX.md):

- Org visibility and “who is in the org” were originally based only on `organization_members`.
- A migration/backfill likely updated **teams** and `team_members` (e.g. added admin to “owners”) but **did not** backfill `organization_members`.
- Result: users were still in `team_members`, but not in `organization_members` → they disappeared from the org list and related UI.
- “Recreating” them via `tfe_organization_membership` adds rows to `organization_members` again (and you can also add them to teams via `tfe_team_organization_member` etc.).

So **users “removed”** = **org_members out of sync with team_members**, not state wipe. The fix we implemented (org visibility = `organization_members` OR team membership) addresses that.

---

## 4. Summary

| Symptom | Root cause | Where |
|--------|------------|-------|
| Terraform state “wiped” | MinIO has no persistent volume; state pushed via remote backend is stored only in MinIO → lost on MinIO recreate | `deploy/docker-compose.yml` (MinIO), state version create handler |
| 409 “variable already exists” | Terraform state gone → Terraform tries to create resources that still exist in Postgres | N/A (consequence) |
| Users “removed” | `organization_members` not backfilled when teams were migrated; UI used only org_members | Migration/backfill; see TEAM_BASED_ORG_ACCESS_FIX |

---

## 5. Checks you can run (containers / logs)

- **Inspect MinIO mounts**:
  ```bash
  docker inspect minio --format '{{json .Mounts}}' | jq .
  ```
  You may see an **anonymous** volume for `/data` (Docker-created). There is no **named** `minio_data` (or similar) in compose.

- **List Docker volumes**:
  ```bash
  docker volume ls
  ```
  `postgres_data` is a named volume; MinIO uses an anonymous one (or none if it was removed).

- **Optional – API/MinIO around state operations**: If you have approximate time of “state gone” or failed applies, inspect API and MinIO logs for that window (e.g. 500s or “failed to load state from storage”) to correlate with MinIO recreate or state fetch failures.

---

## 6. Recommended follow-ups (no changes made yet)

1. **Add a named volume for MinIO** in `deploy/docker-compose.yml` (e.g. `minio_data:/data`) so that state and other object-storage data are explicit and survive `down`/`up` and avoid accidental prune. Prefer that over relying on an anonymous volume.
2. **Store API-created state in DB as well**: When creating state versions via the API (remote backend push), persist the state JSON in `state_versions.state_data` instead of (or in addition to) MinIO. That way, even if MinIO is lost, we still have state in Postgres.
3. **Reconcile Terraform state with existing resources**: Either `terraform import` the existing variables/variable sets/etc. into Terraform state, or remove those resources from StackWeaver (via API/UI) and let Terraform create them again. Prefer import if you need to keep existing IDs and avoid churn.

---

## 7. References

- State storage design, frontend reads, DB vs MinIO: [STATE_STORAGE_DESIGN_AND_DEBUG](STATE_STORAGE_DESIGN_AND_DEBUG.md).
- State version create (API): `backend/internal/api/v2/handlers/terraform/state_versions.go` (Create, ~513–596).
- State save (runner): `backend/internal/services/state/service.go` (`SaveState`); `backend/cmd/runner/main.go` (state persistence after apply).
- State read from MinIO when `StateData` empty: `backend/internal/services/state/service.go` (`RemoveResourceFromState` and related).
- MinIO in deploy: `deploy/docker-compose.yml` (minio service, no `/data` volume).
- Org visibility / users: [TEAM_BASED_ORG_ACCESS_FIX.md](../status/auth/TEAM_BASED_ORG_ACCESS_FIX.md).
