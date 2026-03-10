<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Root Cause: Platform Variables “Undeclared Variable” and 403 on proxmox_virtual_environment_download_file

**Update:** The platform-variables part was fixed: platform vars are now injected only as environment variables via `GetEnvironmentVariablesForRun` (removed from `GetVariablesForRun`). See `backend/internal/services/variable/service.go`. The 403 remains a Proxmox-side permission; `stackweaver-tests/proxmox/passwd/main.tf` was updated to add an explicit ACL on `/storage/local` for `proxmox_virtual_environment_download_file`. StackWeaver now writes Terraform variables to `stackweaver.auto.tfvars` instead of `terraform.tfvars` so the user's `terraform.tfvars` is not overwritten; see `backend/internal/plugins/terraform/plugin.go` and `docs/user-guides/managing-workspace-variables.md`.

---

## Summary

The error output mixes **two separate issues**:

1. **“Value for undeclared variable … TF_WORKSPACE_ID”** – **caused by the platform variables feature** (variables written to `terraform.tfvars`).
2. **“Error initiating file download” / “HTTP 403 – Permission check failed”** on `proxmox_virtual_environment_download_file` – **Proxmox API permissions**, not related to StackWeaver or platform variables.

---

## 1. Undeclared variable warning (platform variables)

### What happens

- Platform variables (`TF_WORKSPACE_ID`, `TF_WORKSPACE_NAME`, `TF_PROJECT_NAME`, `TF_PROJECT_ID`, `TF_ORGANIZATION_NAME`, `TF_ORGANIZATION_ID`) are generated in `GetPlatformVariablesForWorkspace` and injected into `GetVariablesForRun` at lowest priority.
- `GetVariablesForRun`’s result is passed to the Terraform plugin and written to `terraform.tfvars` via `writeVariablesFile`:

  - `backend/internal/services/variable/service.go` (GetPlatformVariablesForWorkspace, GetVariablesForRun)
  - `backend/internal/plugins/terraform/plugin.go` (`writeVariablesFile`, used from `Plan`)

- `writeVariablesFile` emits lines like `TF_WORKSPACE_ID = "uuid"` (key used as-is).
- Terraform requires every key in `terraform.tfvars` to have a matching `variable "key" {}` in the **root** module. If the root module does not declare `variable "TF_WORKSPACE_ID"` (and the other platform vars), Terraform reports:

  > Warning: Value for undeclared variable … The root module does not declare a variable named TF_WORKSPACE_ID but a value was found in file terraform.tfvars.

### Relevant code

| Component | File | What it does |
|----------|------|---------------|
| Platform var generation | `backend/internal/services/variable/service.go` (GetPlatformVariablesForWorkspace) | Adds `TF_WORKSPACE_ID`, `TF_WORKSPACE_NAME`, `TF_PROJECT_*`, `TF_ORGANIZATION_*` |
| Merging into run vars | `backend/internal/services/variable/service.go` (GetVariablesForRun, Step 1) | Injects platform vars into the map used for `terraform.tfvars` |
| Writing tfvars | `backend/internal/plugins/terraform/plugin.go` (`writeVariablesFile`) | Writes `key = "value"` for each entry; keys like `TF_WORKSPACE_ID` are used literally |
| When it’s written | `backend/internal/plugins/terraform/plugin.go` (Plan / PlanWithOptions) | Before `terraform plan`; Apply does **not** write tfvars (it uses the plan file) |

### Why it’s a design issue

- The `TF_` prefix in Terraform is normally for **environment variables**: `TF_VAR_<name>` sets `variable "<name>"`. In `terraform.tfvars`, the key is the **exact** variable name.
- Putting `TF_WORKSPACE_ID` (and similar) into `terraform.tfvars` implies the root module must declare `variable "TF_WORKSPACE_ID"` etc. Most workspaces (including the Proxmox test root in `stackweaver-tests/proxmox/api/`) do not.
- Platform variables are **not** added to `GetEnvironmentVariablesForRun` (see “For now, platform env vars are empty” there), so they only affect `terraform.tfvars`.

### Conclusion (issue 1)

The “undeclared variable” warning is **directly caused** by the platform variables feature: we write `TF_WORKSPACE_ID` and the other platform keys into `terraform.tfvars` for every run, while the root module does not declare those variables.

---

## 2. HTTP 403 “Permission check failed” on download_file (Proxmox, unrelated)

### What happens

- `proxmox_virtual_environment_download_file` asks the **Proxmox API** to fetch a file from a URL (e.g. Debian ISO).
- The provider’s “GetQueryURLMetadata” / “error retrieving URL … HTTP 403 – Reason: Permission check failed” comes from the **Proxmox API** when it performs a permission check before starting the download. The 403 is from Proxmox, not from the Debian (or other) upstream URL.

### Evidence it’s Proxmox permissions

- Same error pattern is reported in bpg/terraform-provider-proxmox:  
  [Issue #1439 – “proxmox_virtual_environment_download_file can't read metadata”](https://github.com/bpg/terraform-provider-proxmox/issues/1439) (GetQueryURLMetadata, HTTP 403, “Permission check failed”).
- Proxmox fora and provider docs state that “Download from URL” requires more than storage privileges: in particular **`Sys.Audit`** and **`Sys.Modify`** in addition to storage-related rights (e.g. `Datastore.AllocateTemplate`). Users with only `Datastore.*` still get 403.
- “Permission check failed” in this context is Proxmox’s own wording when the API rejects the operation due to insufficient privileges.

### Why it’s unrelated to StackWeaver / platform variables

- StackWeaver does **not** set `HTTP_PROXY`, `HTTPS_PROXY`, `User-Agent`, or other HTTP-related env vars from platform variables or variable sets.
- Platform variables are either:
  - In `terraform.tfvars` (interpreted only by Terraform as input variables), or
  - Not in the env at all (GetEnvironmentVariablesForRun does not add them).
- The Proxmox provider’s outbound request to the **Debian (or other) CDN** is made by the **Proxmox server** when it performs the “download from URL” operation, not by the runner. The 403 is returned by Proxmox’s API after its internal “Permission check”, not by the external URL.
- The `proxmox_virtual_environment_download_file` resource only receives `content_type`, `datastore_id`, `node_name`, `url`, `file_name`, `verify`, etc. Nothing from `TF_WORKSPACE_ID` or other platform variables is passed into the provider’s download logic or HTTP handling.

### Conclusion (issue 2)

The 403 “Permission check failed” when using `proxmox_virtual_environment_download_file` is due to **Proxmox VE privileges** (missing `Sys.Audit` and/or `Sys.Modify` in addition to storage rights), not by the platform variables feature or any other StackWeaver change.

---

## 3. Recommendations (for when you do make changes)

### For the undeclared variable warning (platform variables)

- **Option A – Env-only platform variables**  
  - Inject platform variables only via **environment variables** (e.g. in `GetEnvironmentVariablesForRun`), not via `GetVariablesForRun` / `terraform.tfvars`.
  - Use keys like `TF_WORKSPACE_ID`, `TF_WORKSPACE_NAME`, etc. as **plain** env vars (no `TF_VAR_`). Terraform does not map those to `variable "..."` blocks, so no “undeclared variable” from Terraform.
  - Downside: Terraform code cannot consume them as normal variables unless the user declares `variable "tf_workspace_id" {}` and sets it via `TF_VAR_tf_workspace_id` or similar; that would require a separate, explicit mechanism if you want to support that.

- **Option B – Do not inject into tfvars by default**  
  - Only add platform variables to `GetVariablesForRun` (and thus `terraform.tfvars`) when the workspace (or a variable set) explicitly opts in. Reduces surprise for workspaces that do not declare these variables.

- **Option C – Document and require declaration**  
  - If you keep the current behavior, document that using these values in Terraform requires declaring e.g. `variable "TF_WORKSPACE_ID" {}` in the root module. Workspaces that do not need them will continue to see the warnings unless they declare and optionally use them.

### For the 403 on download_file

- Treat as a **Proxmox configuration** issue:
  - Ensure the Proxmox API user used by the provider has:
    - `Datastore.AllocateTemplate` (or equivalent for the target storage),
    - `Sys.Audit`,
    - `Sys.Modify`.
  - References: [Proxmox forum – “What privilege for Download from URL”](https://forum.proxmox.com/threads/what-privilege-for-download-from-url-iso-storage.126884/), [bpg/terraform-provider-proxmox #1439](https://github.com/bpg/terraform-provider-proxmox/issues/1439).

---

## 4. References

- `backend/internal/services/variable/service.go`: `GetPlatformVariablesForWorkspace`, `GetVariablesForRun`, `GetEnvironmentVariablesForRun`
- `backend/internal/plugins/terraform/plugin.go`: `writeVariablesFile`, `Plan` / `PlanWithOptions`
- `backend/cmd/runner/main.go`: use of `GetVariablesForRun` and `GetEnvironmentVariablesForRun`, and passing `variables` / `envVars` into the plugin
- `docs/internal/plans/features/terraform/variable-expansion-plan.md`: intended platform variable set and Phase 2 design
- [bpg/terraform-provider-proxmox #1439](https://github.com/bpg/terraform-provider-proxmox/issues/1439) (GetQueryURLMetadata, 403, “Permission check failed”)
- [Proxmox – “What privilege for Download from URL (ISO storage)”](https://forum.proxmox.com/threads/what-privilege-for-download-from-url-iso-storage.126884/)
