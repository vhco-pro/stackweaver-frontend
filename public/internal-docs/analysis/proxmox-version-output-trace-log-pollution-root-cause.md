<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Root Cause: `proxmox_version` Output Shows Trace/Debug Log Instead of Clean Value

## Summary

The **Outputs** section in the apply view shows `proxmox_version` (and likely other object-valued outputs) as a large blob of JSON trace/debug lines instead of the real value (`version`, `release`, etc.). That happens because:

1. **TF_LOG=JSON** makes Terraform and providers (including Proxmox) write JSON log lines to **stderr**.
2. The Terraform plugin **merges stdout and stderr** into one stream for the apply log; the order is **interleaved** (and, in `applyWithStreaming`, the two goroutines write to the same buffer without synchronization, so ordering is nondeterministic).
3. The frontend **parses the "Outputs:" block from that merged log** and treats everything between `Outputs:` and the end of each output value as part of the value. **TF_LOG JSON lines** that end up **inside** a multiline output’s range (e.g. between `proxmox_version = {` and the closing `}`) are appended to `valueLines` and then into the “value” we display. So the rendered output includes the trace/debug JSON.

---

## 1. TF_LOG=JSON

**Where:** `backend/internal/plugins/terraform/plugin.go` – `buildEnvironment()` sets `TF_LOG=JSON` for all Terraform commands (init, plan, apply, destroy).

**Effect:** Terraform and providers (e.g. bpg/proxmox) emit JSON log lines to **stderr**: `{"@level":"trace","@message":"...","@module":"provider.stdio",...}`. At trace/debug those can be very frequent (every RPC, vertex visit, etc.). The real `proxmox_version` data comes from the Proxmox provider; its internal logging with `TF_LOG=JSON` goes to stderr too.

---

## 2. Apply: Merged stdout and stderr

**Where:** `backend/internal/plugins/terraform/plugin.go` – `applyWithStreaming()`.

- `terraform apply -auto-approve <planfile>` is run **without** `-json`. So:
  - **stdout:** normal human-oriented output, including the final **Outputs:** block, e.g.  
    `proxmox_version = { id = "version" release = "9.1" ... }`
  - **stderr:** TF_LOG JSON lines from Terraform and the Proxmox provider.
- The plugin uses two goroutines: one reads stdout, one reads stderr. **Both** append every line to the same `outputBuffer` and to `OnOutputLine` (which streams to Redis). There is **no mutex** and no ordering guarantee, so stdout and stderr are **interleaved** in the final “apply log”.
- That merged buffer is what gets stored as the apply logs and shown in the UI.

So the string we treat as “the apply log” is a mix of:

- The real `Outputs:` block (from stdout), and  
- `{"@level":"trace",...}`, `{"@level":"debug",...}`, `"rpc error: ..."`, etc. (from stderr).

---

## 3. Frontend: Outputs parsed from the merged log

**Where:** `frontend/src/components/runs/ApplyOutputViewer.tsx` – `outputs` `useMemo` (and equivalent logic).

- The **only** source of output values is the apply log. The backend does **not** run `terraform output -json`; it never has a separate, clean output blob.
- The frontend:
  1. Finds the `Outputs:` line in `cleanedLogs` (the apply log).
  2. From there, parses `key = value` or multiline `key = { ... }` using brace/brace-depth to detect the end of an object.
  3. For a multiline like `proxmox_version = { ... }`, it accumulates lines in `currentOutput.valueLines` until `braceDepth` goes to 0 and the line ends with `}`.

- Because the log is **interleaved**:
  - A TF_LOG line such as `{"@level":"trace","@message":"...",...}` can appear **between** e.g. `release = "9.1"` and `repository_id = "5ac30304265fbd8e"`.
  - That line is **still between** `proxmox_version = {` and the closing `}` from the parser’s point of view, so it gets appended to `valueLines`.
  - The `{` and `}` in that JSON line can affect `braceDepth`, but even when they balance, the line is already part of `valueLines`. When we “close” the object (on the real `}`), we join `valueLines` and treat that as the value.
- The “value” we pass to the JSON/HCL parser and then to the UI therefore **includes those JSON log lines**. Parsing either fails or yields a useless structure, and the UI falls back to showing the raw string or a broken object – which looks like “random trace log” in the Outputs.

---

## 4. Why it’s “random shizzle” and the EOF error

- The **trace/debug JSON** is whatever the Proxmox provider (and Terraform) emits: `@level`, `@message`, `@module`, `@timestamp`, `err`, etc. So the output looks like a pile of log entries.
- The `"rpc error: code = Unavailable desc = error reading from server: EOF"` is one of those `err` messages from the provider’s gRPC layer. It ends up in stderr, gets merged into the apply log, and then into the parsed “value” for an output, so it appears inside the Outputs block. It’s a side effect of (1) TF_LOG and (2) merged stdout/stderr, not necessarily the main cause of the wrong value, but it reinforces that **stderr is being mixed into the Outputs**.

---

## 5. Relevant code

| Component | File | What it does |
|-----------|------|--------------|
| TF_LOG=JSON | `backend/internal/plugins/terraform/plugin.go` (`buildEnvironment`) | Sets `TF_LOG=JSON` for all Terraform commands. |
| Apply stdout/stderr merge | `backend/internal/plugins/terraform/plugin.go` (`applyWithStreaming`) | Two goroutines append stdout and stderr into the same `outputBuffer` and `OnOutputLine`; no ordering guarantee. |
| No `terraform output -json` | (nowhere) | Outputs are never read via `terraform output -json`; only from the apply log. |
| Output parsing | `frontend/src/components/runs/ApplyOutputViewer.tsx` | Parses `Outputs:` and `key = value` / `key = { ... }` from `cleanedLogs` (the apply log). Multiline values are built from all lines between `key = {` and the matching `}`; interleaved TF_LOG lines are included. |

---

## 6. Root cause (concise)

1. **TF_LOG=JSON** → stderr is full of JSON log lines (including from the Proxmox provider).
2. **Apply log = merged stdout + stderr** → those lines are interleaved with the real `Outputs:` block.
3. **Outputs are parsed only from that merged log** → any line that falls between `proxmox_version = {` and its `}` is treated as part of the value, so TF_LOG lines (and things like the EOF `err`) become part of the “value” we show.
4. **We never use `terraform output -json`** → we have no separate, clean source of output values to prefer over the parsed apply log.

---

## 7. Directions for fixes (no changes made here)

- **Backend / runner**
  - **Option A:** After a successful apply, run `terraform output -json` and store that as the **authoritative** outputs. The UI would use this instead of parsing the apply log for output values. The apply log would remain for human viewing, but Outputs would come from `terraform output -json`.
  - **Option B:** For apply, do **not** merge stderr into the same stream we use for output parsing. E.g. stream stderr to a separate “debug/trace” log and only feed stdout into the “apply log” we parse for Outputs. That would require a clear split in how we store/display “main apply log” vs “TF_LOG/trace”.

- **Frontend**
  - **Option D:** When parsing the Outputs block, **skip lines that look like TF_LOG JSON** (e.g. `^\s*\{\"@level\"` or `^\s*\{.*\"@timestamp\"`). That reduces pollution as long as the backend keeps merging stdout and stderr; it’s a heuristic and can be brittle.
  - If **Option A** is done, the frontend would stop parsing Outputs from the apply log and would instead consume the stored `terraform output -json` blob.

- **Recommendation:** Use **Option A** (run and store `terraform output -json` after apply, and treat it as the source of truth for Outputs). It avoids dependence on the format of the apply log and on TF_LOG. Option B or C can still be useful to keep the apply log easier to read and to debug.

---

## 8. How Terraform Enterprise / HCP Terraform does it

TFE does **not** derive outputs from the apply log. Outputs come from **state** only.

- **State version outputs API**  
  - `GET /state-versions/:state_version_id/outputs` — values are the [output values from a Terraform state file](https://developer.hashicorp.com/terraform/cloud-docs/api-docs/state-version-outputs).  
  - `GET /workspaces/:workspace_id/current-state-version-outputs` — convenience for the latest state’s outputs.  
- **Population:** TFE populates state-version outputs **asynchronously** after the state version is uploaded. The `resources-processed` property on the state version indicates when that’s done.  
- **CLI:** `terraform output` and `terraform output -json` read from **state** (same conceptual source as state-version-outputs when using the remote backend).  
- **References:**  
  - [State version outputs API](https://developer.hashicorp.com/terraform/cloud-docs/api-docs/state-version-outputs)  
  - [Retrieving Run Outputs from Terraform Cloud](https://support.hashicorp.com/hc/en-us/articles/6615677257747-Retrieving-Run-Outputs-from-Terraform-Cloud)

So **Option A is aligned with TFE**: use state (or its equivalent, `terraform output -json`) as the source of truth for Outputs, not the apply log.

---

## 9. Option A refined: we already have state-based outputs

We do **not** need to run `terraform output -json` as an extra step:

- After apply, we read `terraform.tfstate` and pass the full state JSON to `SaveState`. `StateData` includes the `outputs` object.  
- `GET /api/v2/state-versions/:id/outputs` already reads `version.StateData["outputs"]` — i.e. from **state**. That is TFE-aligned and uncontaminated by TF_LOG or log parsing.  
- The state version is linked to the run via `StateVersion.RunID`.

The gap is only in the **Apply view**: it uses only the apply log. The fix is to use state-version outputs when the run has produced a state version, and to fall back to log parsing only when there is no state version (e.g. apply not yet finished or not saved).

**Implementation options (for planning):**

1. **Run → output state version**  
   - In the run payload: when the run has created a state version, include e.g. `relationships["output-state-version"]["data"] = { "id": "sv-xxx", "type": "state-versions" }`.  
   - Backend: add something like `StateVersionRepository.GetByRunID(runID)` (or existing list + filter) to resolve the state version where `run_id = run.ID`.  
   - Frontend: if present, call `GET /api/v2/state-versions/:id/outputs` and use that for the Outputs section; otherwise keep parsing the apply log.

2. **Convenience endpoint**  
   - `GET /api/v2/runs/:id/outputs` (or similar): looks up the state version with `run_id = :id`, then returns the same shape as `GET /api/v2/state-versions/:id/outputs`. Reduces frontend work but adds a new endpoint.

3. **`/workspaces/:id/current-state-version-outputs`**  
   - TFE has this for “latest” outputs. It does not tie to a specific run; for the Apply view we need the state version for *this* run, so run→state-version linkage (1 or 2) is better than “current” only.

**Destroy runs:** After destroy, state is empty (or we may not save a new state version). Outputs would be empty. The Apply view can treat “no output state version” as “no outputs” and avoid log parsing for outputs in that case.
