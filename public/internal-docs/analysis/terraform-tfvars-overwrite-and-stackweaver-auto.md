<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Analysis: Overwriting `terraform.tfvars` vs Using `stackweaver.auto.tfvars`

## 1. Current Behaviour: We Overwrite `terraform.tfvars`

**Where it happens**

- `backend/internal/plugins/terraform/plugin.go`: `PlanWithOptions` builds `varFile = filepath.Join(workspaceDir, "terraform.tfvars")` and calls `writeVariablesFile(varFile, variables)` before running `terraform plan`.
- `writeVariablesFile` does `os.WriteFile(path, content, 0o600)`: the file is fully replaced, not merged or appended.

**When it runs**

- Before every `terraform plan`: plan-only, plan-and-apply, and destroy (destroy runs a plan first, which triggers this).
- Apply and Destroy do **not** write any tfvars; only Plan does.

**What goes into the file**

- The merged map from `GetVariablesForRun`: variable sets (terraform category) + workspace variables (terraform category). Platform variables are **not** included (they are env-only).
- Anything that exists only in the repo and is **not** in our DB is not in that map.

---

## 2. Likelihood That a User Has `terraform.tfvars` in the Repo

**Likelihood: medium to high.**

- `terraform.tfvars` is the default “put your default/example values here” file in docs, tutorials, and many repos.
- It’s often committed with non-sensitive defaults (`region`, `instance_type`, `environment`, etc.).
- Some teams use it for local overrides and still commit a `.tfvars.example` or even the real file (if they consider it non-secret).

So it’s reasonable to assume a non‑trivial share of workspaces will have a `terraform.tfvars` (or `terraform.tfvars.json`) in the repo.

---

## 3. Does Overwriting `terraform.tfvars` Hurt the User?

**Yes. We can cause real breakage.**

- We overwrite the file with **only** what’s in our DB (variable sets + workspace vars).
- Any variable that:
  - exists **only** in the repo’s `terraform.tfvars`, and  
  - is **not** defined in our workspace variables or variable sets  

  is effectively dropped. Terraform will then either use the default from the `variable` block (if any) or fail with “variable X is not set” (or similar).

**Example**

- Repo has `terraform.tfvars`:

  ```hcl
  region         = "eu-west-1"
  instance_type  = "t3.medium"
  ```

- In our DB we only have e.g. `project_id` (from a variable set).
- We overwrite `terraform.tfvars` with only `project_id = "..."`.
- `region` and `instance_type` are no longer set. If they have no `default` in the `variable` blocks, the run can fail or behave differently from what the user expects when running locally.

So: overwriting `terraform.tfvars` **can** hurt users who rely on repo‑scoped defaults we don’t know about.

---

## 4. Precedence: What We Implement vs What We Write

**Our merge order (in `GetVariablesForRun` / `GetEnvironmentVariablesForRun`):**

1. Platform variables (env-only; not in the tfvars content).
2. Non‑priority variable sets.
3. Priority variable sets.
4. Workspace variables.

**Rules:**

- **Workspace variables override** non‑priority variable sets.
- **Priority variable sets override** workspace variables (and everything else).
- That’s TFE‑style behaviour and is independent of *where* we write the result.

**What we write**

- We write the **final** merged map (variable sets + workspace vars) into the tfvars file. The file format (`terraform.tfvars` vs `stackweaver.auto.tfvars`) does **not** change that merge; we’re just choosing the target file.

So: “workspace vars take precedence” over non‑priority sets; priority sets override workspace. That’s for our DB sources. The “prefer varsets” (priority variable sets) is exactly this: priority sets beat workspace vars. It is **not** tied to using `stackweaver.auto.tfvars`; we’d keep the same merge and precedence with either file name.

---

## 5. If We Switch to `stackweaver.auto.tfvars`

**What we’d do**

- Write our merged map (same as today) to `stackweaver.auto.tfvars` instead of `terraform.tfvars`.
- **Do not** create or modify `terraform.tfvars`. The user’s `terraform.tfvars` in the repo stays as-is.

**Terraform load order (conceptual)**

- Terraform auto-loads, in order: `terraform.tfvars` (and `terraform.tfvars.json`), then `*.auto.tfvars` / `*.auto.tfvars.json` (lexicographic). Other mechanisms like `-var` / `-var-file` / `TF_VAR_*` have their own place in the overall precedence.
- So: `terraform.tfvars` is loaded first, then `stackweaver.auto.tfvars`. For any given variable, the **last** supplied value wins. That means: **our values override the repo’s `terraform.tfvars`** for overlapping keys.

**Effect**

- Repo-only variables (only in `terraform.tfvars`): **kept**. Terraform still sees them.
- Variables we manage (in variable sets / workspace): **in `stackweaver.auto.tfvars`** and load after `terraform.tfvars`, so they override for overlapping keys.
- Our precedence (priority sets > workspace vars > non‑priority sets) is unchanged; we still write the same merged map, just to a different file.

So with `stackweaver.auto.tfvars` we both **preserve** the user’s `terraform.tfvars` and **override** it for the keys we manage, which is the desired behaviour.

---

## 6. Edge Cases and Caveats

**User also has `stackweaver.auto.tfvars`**

- We would overwrite our own `stackweaver.auto.tfvars` each run. If the user committed a `stackweaver.auto.tfvars`, we’d overwrite it. That’s consistent with “we fully control this file”; we’d need to document that `stackweaver.auto.tfvars` is managed by StackWeaver and should not be edited in the repo.

**Other `*.auto.tfvars`**

- We only write `stackweaver.auto.tfvars`. Other `*.auto.tfvars` (e.g. `secrets.auto.tfvars`) are untouched. Load order between `stackweaver.auto.tfvars` and others depends on lexicographic order; we don’t need to special‑case that for this analysis.

**Apply / Destroy**

- Apply doesn’t write any tfvars; it uses the plan. Destroy runs `terraform destroy` and will use whatever tfvars (and `*.auto.tfvars`) are present. With `stackweaver.auto.tfvars`, the Plan step would have written it, and it would still be there for Destroy. So behaviour is consistent.

---

## 7. Summary

| Aspect | `terraform.tfvars` (current) | `stackweaver.auto.tfvars` |
|--------|-----------------------------|----------------------------|
| User has `terraform.tfvars` in repo | **Overwritten.** Repo-only vars are lost. | **Left alone.** Repo-only vars are kept. |
| Our vars (sets + workspace) | Written. Override nothing in this file (we replace the whole file). | Written. Override the user’s `terraform.tfvars` for overlapping keys (load order). |
| Priority / workspace precedence | Unchanged (in our merge). | Unchanged (same merge, different file). |
| Risk of breaking users | **Yes**: dropping repo-only variables. | **Lower**: we only override keys we manage; we don’t remove the user’s file. |

**Conclusion:** Overwriting `terraform.tfvars` can hurt users who rely on repo `terraform.tfvars` for variables we don’t store. Switching to `stackweaver.auto.tfvars` for our managed variables avoids that, keeps our precedence behaviour, and makes “our values override the repo” explicit via Terraform’s normal load order. The main trade-off is that we must treat `stackweaver.auto.tfvars` as a StackWeaver‑managed file and document that users should not expect to maintain it in the repo.

**Implemented:** The plugin now writes to `stackweaver.auto.tfvars`; see `backend/internal/plugins/terraform/plugin.go`. User-facing documentation: `docs/user-guides/managing-workspace-variables.md` (sections “How StackWeaver passes variables to Terraform” and “Platform variables”).
