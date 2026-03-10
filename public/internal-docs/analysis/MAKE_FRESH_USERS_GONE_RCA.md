<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# RCA: Users Gone After "Make Fresh"

RESOLVED: Old orgs have an issue because they were created before the DB migrations - Test with clean orgs to be sure there is no issue

**Date**: 2026-01-28  
**Status**: Analysis only (no code changes)  
**Context**: Users disappear from the UI after `make fresh`. They can recreate them by running the workspace (Terraform apply). Issue did not occur before self‑hosted runner work. Run `run-TmqGPDm0J4HeTmqG` mentioned for logs.

---

## 1. What "make fresh" does

**Makefile:** `make fresh` → `scripts/refresh-code.sh`

**refresh-code.sh:**

1. Build docs, build Go binaries (api, orchestrator, runner, ansible-runner).
2. **Stop** only: `api`, `orchestrator`, `runner`, `ansible-runner`, `frontend`.
3. **Rebuild** those images.
4. **Start** those services: `docker compose up -d api orchestrator runner ansible-runner frontend`.

**Explicitly not done:**

- No `docker compose down` or `down -v`.
- No `docker volume prune`, `image prune`, `container prune`, etc.
- No restart of **infrastructure**: `postgres`, `redis`, `minio`, `zitadel` keep running.

So **make fresh** does **not** remove containers, networks, or **volumes**. Postgres and its `postgres_data` volume are untouched.

---

## 2. Where users live

- **Users:** `users` table (Postgres).
- **Org members (UI "users"):** `organization_members` (+ `users` via join).
- **Team members:** `team_members`.

All stored in **Postgres** only. Terraform creates org memberships via API → we insert into `organization_members` and `users` (placeholders as needed).

---

## 3. What *does* wipe the DB (and thus users)

These **do** remove data:

| Command | Effect |
|--------|--------|
| **`make clean`** | `docker compose down -v` → removes **all** Compose volumes, including **`postgres_data`** → DB wiped. |
| **`make restage`** | Runs **clean-restart.sh**: `down -v` (unless `--preserve-db`), **volume prune**, then full restart. DB wiped unless you pass `--preserve-db`. |
| **`make clean` then `make up`** | Same as above: new Postgres, new empty `postgres_data` → users gone. |

After any of these, users and org members are gone. Terraform can re-apply and recreate them (no 409).

---

## 4. Self‑hosted runner and make fresh

**Make fresh** now includes the **runner** (and ansible-runner): we stop/rebuild/start them too.

- Runner uses **`runner-workspaces`** volume for workspace dirs (e.g. Terraform state files).
- **make fresh** only **stops** then **starts** those containers; it does **not** `down` or `down -v`, and does **not** prune volumes.
- So `runner-workspaces` and **`postgres_data`** both persist across **make fresh**.

Runner addition **does not** change that. Nothing in **make fresh** or **refresh-code.sh** touches Postgres or deletes users.

---

## 5. Run logs (run-TmqGPDm0J4HeTmqG)

- API logs show `GET /api/v2/runs/run-TmqGPDm0J4HeTmqG` → 200, and `users` lookups (e.g. by email) as usual.
- No log evidence of migrations or app code **deleting** users or org members during or after that run.

So the run itself doesn’t point to a **code path** that removes users.

---

## 6. API startup and migrations

On startup, API runs **GORM AutoMigrate** only. AutoMigrate **creates** tables and **adds** columns; it does **not** drop tables, drop columns, or truncate data. No custom migration or init SQL deletes users or org members.

---

## 7. Root cause assessment

**If users disappear only when you run `make fresh`:**

- **make fresh** (as implemented) does **not** touch Postgres or any volumes. Users **should** persist.
- So either:
  1. **Command confusion:** A command that **does** wipe the DB is being run **instead of** or **in addition to** `make fresh` (e.g. `make clean`, `make restage`, or `make clean` then `make up` / `make fresh`). Those **do** remove `postgres_data` → users gone.
  2. **Different workflow:** e.g. sometimes doing a full teardown (`down -v`) or `docker volume prune` elsewhere, then bringing the stack back up.

**Most plausible explanation:** Users disappear when **`make clean`** or **`make restage`** (or equivalent `down -v` + restart) is used. That wipes the DB. **`make fresh`** alone does not.

---

## 8. Recommendations (for later, no changes now)

1. **Confirm which command you run** when users disappear: strictly `make fresh`, or also `make clean` / `make restage` / `make clean` then `make up`?
2. **Preserve DB when doing full restarts:**  
   `make restage --preserve-db` (if we add that) or `./scripts/clean-restart.sh --preserve-db` keeps `postgres_data` and thus users.
3. **Optional:** Add a small **safety check** in `clean-restart.sh` when **no** `--preserve-db` (e.g. warn “this will delete all DB data including users”) so it’s explicit.

---

## 9. References

- `Makefile`: `fresh` → `scripts/refresh-code.sh`; `clean` → `down -v`; `restage` → `scripts/clean-restart.sh`.
- `scripts/refresh-code.sh`: stop/build/up for code containers only; no `down` or prune.
- `scripts/clean-restart.sh`: `down -v` (unless `--preserve-db`), volume prune, then infra + Zitadel + app bring-up.
- `deploy/docker-compose.yml`: `postgres_data` volume, `runner-workspaces` volume.
- API migrations: `backend/cmd/api/main.go` (AutoMigrate only).
