<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# tfe_variable Drift vs State Pull: What’s Different, What We Changed

**Date**: 2026-01-28  
**Status**: Clarification only (no code changes)  
**Context**: User saw only `tfe_variable` resources drifting (“+5 To Add”) while other TFE resources were fine. Questions: Do variables read state differently? Is it encryption? Why only vars vs variable sets? If we were missing “core” state endpoints, why didn’t everything drift?

---

## 1. Do variables read state differently than other resources?

**No.** Terraform state is a single JSON blob. All resources (`tfe_variable`, `tfe_team`, `tfe_workspace`, `tfe_variable_set`, etc.) live in the same `resources[]` array. Terraform does **not** fetch variables from a separate “state path.” There is no variable-specific state read.

**“To Add”** means the resource address is **not in state** — i.e. Terraform has never recorded that resource in state (or state was lost for it). So “+5 To Add” for five `tfe_variable` resources means those five are **missing from state**, not “read differently.”

---

## 2. Encryption / sensitive variables

We encrypt sensitive variable values and mask them in API responses (e.g. `••••••••`). That affects **refresh** only:

- **Refresh**: Provider calls our Variables API (e.g. `GET /workspaces/:id/vars`). We return masked values. The provider can’t compare meaningfully to config → possible **refresh** drift (value “changed” or “unknown”).
- **“To Add”** is **not** refresh drift. It means “not in state.” Encryption/masking doesn’t cause resources to disappear from state.

So encryption is **not** why those five variables show as “to add.”

---

## 3. Variables vs variable sets

- **`tfe_variable`**: Workspace-level or variable-set-level variables. API: workspace vars (`GET /workspaces/:id/vars`) or variable-set vars.
- **`tfe_variable_set`**: Different resource; variable-set metadata and attachments.

Both use the **same** state model. No special state handling for variables vs variable sets. Difference is **which API** the provider calls on refresh (workspace vars vs variable-set APIs). Still no “variables read state differently.”

---

## 4. When do we use state pull? (current-state-version, hosted-state-download-url, download)

**We use state pull only when Terraform uses `backend "remote"` to talk to our API.**

Two distinct flows:

| Flow | Who runs Terraform? | Backend used at runtime | State source | Uses our state pull? |
|------|---------------------|--------------------------|--------------|----------------------|
| **Our UI runs** (Plan Finished, etc.) | Our **runner** | **Local** (we rewrite `backend "remote"` → `backend "local"` before run) | `terraform.tfstate` in workspace dir | **No** |
| **External Terraform** (user runs `terraform plan` locally with remote backend) | User / CI | **Remote** (our API) | Our API: current-state-version → hosted-state-download-url → download | **Yes** |

For **our runs**:

- We replace `backend "remote"` with `backend "local" { path = "terraform.tfstate" }` before init/plan/apply.
- State lives in the workspace dir (`/home/iac/workspaces/<workspace_id>/...`). We persist it to storage **after** apply (DB + MinIO) but **never restore from storage** into the workspace before plan.
- Terraform **never** calls our state API during our runs. So **current-state-version**, **hosted-state-download-url**, and **GET /state-versions/:id/download** are **not used** for “Plan Finished” in the UI.

Those endpoints **only** matter when someone runs `terraform plan` / `apply` **outside** our platform with `backend "remote"` pointing at us. Then Terraform pulls state via those APIs.

---

## 5. Why didn’t “everything” drift if we were missing state pull?

- **Our UI runs**: We don’t use state pull. Missing state endpoints **cannot** explain drift (or lack of it) for Plan Finished. State comes from the workspace dir.
- **External Terraform with remote backend**: If we had **no** working state pull, Terraform would either **error** (can’t get state) or run with **empty** state → **all** resources “to add,” not just variables.

So **“only variables drifted”** contradicts “we were missing state pull for everything.” It implies **state was available** (other resources in state) and only those five `tfe_variable` instances were **missing from state**.

---

## 6. Why would only those five `tfe_variable` resources be “to add”?

Plausible explanations (no special “variable state read”):

1. **Never applied**: The five variables were added to `.tf` after the last successful apply, or the apply that created them never completed (we only save state **after** a successful apply).
2. **Apply succeeded for vars, state not persisted**: e.g. apply created vars via API, then we failed before reading `terraform.tfstate` and calling `SaveState` (runner crash, etc.). Next run would still use **local** `terraform.tfstate` in the workspace dir. If that run saw “only vars to add,” then local state had other resources but not those vars — which fits “we never wrote them to state” (e.g. apply failed right after creating vars, before Terraform wrote state).
3. **Different workspace / working dir**: Different state file → one workspace’s state has teams/workspaces/etc., other has nothing or only vars missing. “Only vars” could be about one specific workspace’s state.

None of this requires variables to “read state differently” or use a different state path.

---

## 7. What we actually changed (and what it fixes)

### 7.1 State pull (remote backend)

- `GET /workspaces/:id/current-state-version` — latest state version + `hosted-state-download-url`
- `GET /state-versions/:id/download` — stream raw state JSON (from object storage or DB when present)
- `hosted-state-download-url` in state-version responses (Get, CurrentStateVersion)

**Fixes:** **External** `terraform plan` / `apply` with **backend "remote"** when Terraform pulls state from us.

### 7.2 Variable / org-membership lookup (provider Read)

**Problem:** Provider **Read**s resources by ID (GET by id) for refresh. We were **missing GET (Read)** for workspace variables and variable-set variables. Provider got **404** → “resource gone” → removed from state → **drift** (“to add” or “removed”). Same idea if we 404’d on org membership Read.

**Added:**

- **`GET /workspaces/:id/vars/:variable_id`** — Show workspace variable (TFE “Show variable”). Provider uses this for **Read**/refresh. Missing → 404 → drift.
- **`GET /varsets/:id/relationships/vars/:variable_id`** (and org-scoped equiv.) — Show variable-set variable. Same for `tfe_variable` with `variable_set_id`.

**Existing (unchanged):** `GET /organization-memberships/:id` — we already have Read for org memberships. We use UUID; provider stores what we return. Ensure we never 404 when the membership exists.

**Fixes:** Provider can **Read** variables (workspace and variable-set) by ID. No spurious 404 → no “resource gone” → no drift. Team members / org members stop being “randomly removed” from state when they exist in the platform.

---

## 8. Summary

| Question | Answer |
|----------|--------|
| Do variables read state differently? | No. Same state blob for all resources. |
| Is it encryption? | Encryption affects **refresh** (API), not “to add.” |
| Variables vs variable sets? | Same state model; different APIs on refresh. |
| Why only vars drifted? | Those five were **not in state** (never applied, or state not persisted). Not “variables read state differently.” |
| Why didn’t everything drift? | For our runs we don’t use state pull. For external remote backend, “only vars” implies state **was** available; missing state pull would affect **all** resources. |
| What do the new endpoints fix? | **External** Terraform with **remote** backend pulling state from us. They do **not** affect Plan Finished in our UI. |

---

## 9. References

- Runner backend rewrite: `replaceRemoteBackendWithLocal` in `backend/cmd/runner/main.go`; state save after apply (read `terraform.tfstate`, `SaveState`).
- State pull endpoints: `GET /workspaces/:id/current-state-version`, `GET /state-versions/:id/download`, `hosted-state-download-url` — `backend/internal/api/v2/handlers/terraform/state_versions.go`, routes.
- Variables API: `backend/internal/api/v2/handlers/terraform/variables.go`; variable sets: `variable_sets.go`.
- STATE_STORAGE_DESIGN_AND_DEBUG.md, STATE_WIPE_AND_USERS_REMOVED_RCA.md.
