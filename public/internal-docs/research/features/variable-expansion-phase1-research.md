<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Phase 1 Research: Variable Expansion - AWX/Tower, TFE, and Design Analysis

## Executive Summary

This document presents research findings for Phase 1 of the variable expansion feature. Key findings:

1. **TFE provides environment variables, not Terraform variables** - Platform variables should be environment variables (`TFC_*`) not `tfvars`
2. **AWX/Tower uses extra_vars with complex precedence** - Job template extra_vars merge with surveys/launch overrides
3. **Current StackWeaver implementation is simpler than TFE** - Missing priority variable sets and lexical ordering
4. **Variable sets need project-level scoping** - Already partially implemented but needs extension for Ansible

## 1. Terraform Enterprise (TFE) Variable Research

### 1.1 Platform-Provided Variables

**Key Finding**: TFE provides **environment variables**, not Terraform input variables.

#### TFE Environment Variables (Automatically Provided)

TFE automatically injects these environment variables during workspace runs:

| Variable | Description | Example |
|----------|-------------|---------|
| `TFC_RUN_ID` | Unique ID for the current run | `run-CKuwsxMGgMd4W7Ui` |
| `TFC_WORKSPACE_ID` | ID of the workspace executing the run | `ws-YN6FoUBQciKyfi4b` |
| `TFC_WORKSPACE_NAME` | Name of that workspace | `prod-load-balancers` |
| `TFC_WORKSPACE_SLUG` | Organization/workspace slug | `acme-corp/prod-load-balancers` |
| `TFC_CONFIGURATION_VERSION_GIT_BRANCH` | The branch from which the config version was sourced | `main` |
| `TFC_CONFIGURATION_VERSION_GIT_COMMIT_SHA` | The commit SHA associated with the configuration version | `abcd1234...` |
| `TFC_CONFIGURATION_VERSION_GIT_TAG` | Git tag used, if any | `v0.1.0` |
| `TFC_PROJECT_NAME` | The name of the project containing the workspace | `proj-name` |
| `TFC_PROJECT_ID` | The project's unique ID | `proj-91XJpbLvbdohC6RD` |

**Important Notes:**
- These are **environment variables**, not Terraform input variables
- They use the `TFC_*` prefix (Terraform Cloud)
- Users can reference them in Terraform via `lookup("env", "TFC_WORKSPACE_NAME")` or declare them as variables
- `terraform.workspace` interpolation returns `default` in TFE remote backend - users should use `TFC_WORKSPACE_NAME` instead

#### Recommendation for StackWeaver

**Option A: Follow TFE Pattern (Recommended)**
- Provide platform variables as **environment variables** with `TFC_*` prefix
- Maintains TFE compatibility
- Users can declare them as Terraform variables if needed
- No risk of variable name conflicts

**Option B: Provide as Terraform Variables**
- Provide as actual Terraform input variables (in `tfvars`)
- More convenient for users (no need to declare variables)
- Risk of name conflicts if users want to override
- Less TFE-compatible

**Decision**: **Option A** - Provide as environment variables with `TFC_*` prefix for TFE compatibility.

### 1.2 TFE Variable Precedence Order

TFE has a complex precedence system with **priority variable sets** that can override workspace variables:

**Full Precedence Order (Highest → Lowest):**

1. **Priority global variable set** (organization-owned, marked priority)
2. **Priority project-scoped variable set** (organization-owned)
3. **Priority workspace-scoped variable set** (organization-owned)
4. **Priority project-scoped variable set** (project-owned)
5. **Priority workspace-scoped variable set** (project-owned)
6. **Command-line arguments** (`terraform apply/plan -var / -var-file`) - CLI workflows only
7. **Local environment variables** (`TF_VAR_*`) - CLI workflows only
8. **Workspace-specific variables** (defined in workspace UI)
9. **Workspace-scoped variable sets** (project-owned, non-priority)
10. **Project-scoped variable sets** (project-owned, non-priority)
11. **Workspace-scoped variable sets** (organization-owned, non-priority)
12. **Project-scoped variable sets** (organization-owned, non-priority)
13. **Global variable sets** (non-priority)
14. **Files**: `.auto.tfvars` (lowest precedence)

**Key Rules:**
- **Priority variable sets** can override workspace-specific variables and CLI inputs
- **Workspace variables** always override non-priority variable sets
- Between variable sets with same scope/ownership: **lexical order** (alphabetical) determines precedence
- `terraform.tfvars` is **ignored** by TFE during remote runs

#### Current StackWeaver Implementation vs TFE

**Current StackWeaver Precedence:**
1. Variable Set Variables (organization-scoped → workspace-scoped)
2. Workspace Variables (override variable sets)

**Missing from StackWeaver:**
- Priority variable sets
- Lexical ordering of variable sets
- Project-owned vs organization-owned distinction
- CLI/environment variable handling (not applicable for remote runs)


**TODO**: This must be tackled as well in the same feature since we are doing things on the vars anyway we might as well extend it to be fully compatible with:

- https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/variable
- https://developer.hashicorp.com/terraform/cloud-docs/api-docs/variable-sets
- https://developer.hashicorp.com/terraform/cloud-docs/api-docs/variables
- https://developer.hashicorp.com/terraform/cloud-docs/api-docs/workspace-variables

**Current TFE API Compatibility Status:**

**Variable Sets API:**
- ✅ Create variable set (`POST /organizations/:name/varsets`) - Handles `priority` in request but not stored
- ✅ List variable sets (`GET /organizations/:name/varsets`)
- ✅ Get variable set (`GET /varsets/:id`)
- ✅ Update variable set (`PATCH /varsets/:id`) - Handles `priority` in request but not stored
- ✅ Delete variable set (`DELETE /varsets/:id`)
- ✅ List variables in set (`GET /varsets/:id/relationships/vars`)
- ⚠️ **Missing**: `priority` field not stored in database (accepted in API but ignored)
- ⚠️ **Missing**: `parent` relationship support (organization vs project ownership)
- ✅ Workspace/project assignments supported

**Workspace Variables API:**
- ✅ Create variable (`POST /workspaces/:workspace_id/vars`)
- ✅ List variables (`GET /workspaces/:workspace_id/vars`)
- ✅ Get variable (`GET /workspaces/:workspace_id/vars/:variable_id`)
- ✅ Update variable (`PATCH /workspaces/:workspace_id/vars/:variable_id`)
- ✅ Delete variable (`DELETE /workspaces/:workspace_id/vars/:variable_id`)
- ✅ JSON:API format with proper relationships
- ✅ Sensitive value masking in responses

**TFE Provider Compatibility:**
- Need to verify all fields required by `terraform-provider-tfe` are supported
- Priority variable sets may be required for full provider compatibility

**Recommendation:**
- **Phase 1**: Add missing TFE API features:
  - Store `priority` field in `VariableSet` model
  - Implement `parent` relationship (organization vs project ownership)
  - Ensure priority variable sets work correctly in precedence
  - Verify TFE provider compatibility
- **Platform Variables**: Add at lowest precedence (before variable sets, respecting priority)




### 1.3 Reserved Variable Names

**TFE Reserved Names:**
- No explicit reserved Terraform variable names documented
- Environment variables: `TFC_*` prefix is reserved by TFE
- `terraform.workspace` returns `default` in remote backend (not a variable name issue)

**StackWeaver Reserved Names:**
- Should avoid `TFC_*` prefix for environment variables (TFE compatibility)
- Should avoid `STACKWEAVER_*` prefix for environment variables (future platform use)
- Terraform variables: No restrictions (users can override)

## 2. AWX/Ansible Tower Variable Research

### 2.1 Variable Precedence in AWX/Tower

AWX/Tower has a complex variable precedence system for Ansible:

**Precedence Order (Lowest → Highest):**

1. **Role defaults** (`roles/…/defaults/main.yml`)
2. **Inventory variables** (static/dynamic, group_vars, host_vars)
3. **Playbook group_vars/host_vars**
4. **Facts / set_facts / registered variables**
5. **Variables from vars_files, vars_prompt, play vars**
6. **Job Template extra_vars** (defined in template configuration)
7. **Survey variables or prompt-on-launch variables** (if enabled)
8. **extra_vars supplied via launch API/CLI** (only if survey enabled or `ask_variables_on_launch=True`)
9. **Direct extra_vars passed by user** (highest precedence)

**Key Rules:**
- "Last-listed wins" - if two sources at same precedence define same variable, later one wins
- Job template extra_vars merge with survey variables (don't overwrite, merge)
- `ask_variables_on_launch` must be enabled for API/CLI extra_vars to be honored
- When relaunching a job, it uses original extra_vars (doesn't recompute from template)

### 2.2 AWX/Tower Variable Sets

**Key Finding**: AWX/Tower does **NOT** have a "variable sets" feature like TFE.

Instead, AWX/Tower uses:
- **Job Template extra_vars**: Variables defined in the template
- **Surveys**: Prompt users for variables at launch time
- **Credentials**: Can inject variables via custom credential types
- **Inventories**: Can contain variables in group_vars/host_vars

**Credential Injection:**
- Credentials can inject data as:
  - Environment variables (e.g., `AWS_ACCESS_KEY_ID`)
  - Extra variables (via custom credential types)
  - File templates (rendered into files)
- Custom credential types allow defining injection methods
- Multiple credentials can be attached to a job template

### 2.3 Recommendations for StackWeaver Ansible Integration

**Option A: Extend Variable Sets to Ansible (Recommended)**
- Reuse existing variable sets infrastructure
- Add "ansible" category to variable sets
- Apply variable sets to job templates (similar to workspace assignment)
- Precedence: Variable Sets → Template ExtraVars → Launch Override ExtraVars

**Option B: Job Template Variables Only**
- Keep current approach (only template extra_vars)
- Simpler but less flexible
- No shared variable management

**Decision**: **Option A** - Extend variable sets to Ansible for consistency and flexibility.

**Precedence for Ansible:**
1. Platform Variables (lowest)
2. Variable Set Variables (project-scoped → template-assigned)
3. Job Template ExtraVars
4. Job Launch Override ExtraVars (highest)

**TODO**: Do we really need the "ansible" category - these are just env vars, no?

**Analysis:**

**Option A: Use "ansible" Category (Original Recommendation)**
- **Pros:**
  - Clear separation between Terraform and Ansible variables
  - Can filter variables by category when resolving for Ansible jobs
  - Explicit intent (this variable is for Ansible)
- **Cons:**
  - Adds complexity (new category to manage)
  - Variables can't be shared between Terraform and Ansible easily

**Option B: Use "env" Category for Ansible (Simpler)**
- **Pros:**
  - Reuse existing "env" category
  - Ansible can access environment variables via `lookup('env', 'VAR_NAME')`
  - Simpler implementation (no new category)
  - Variables can potentially be shared between Terraform env vars and Ansible
- **Cons:**
  - Less explicit (can't distinguish Terraform env vars from Ansible env vars)
  - Ansible would need to access via environment variables, not extra_vars
  - Less convenient than direct extra_vars

**Option C: Use "env" Category but Pass as Extra Vars**
- **Pros:**
  - Reuse existing "env" category
  - Still pass as extra_vars for convenience
  - Simpler than new category
- **Cons:**
  - Slight semantic mismatch (called "env" but passed as extra_vars)
  - Can't distinguish Terraform env vars from Ansible vars

**Recommendation: Option B or C**

**Decision**: Use **"env" category** for Ansible variables. This simplifies the implementation:
- No new category needed
- Variables with category "env" can be used for:
  - Terraform environment variables (set as actual env vars)
  - Ansible variables (can be passed as env vars OR extra_vars)
- For Ansible, we can pass "env" category variables as:
  - Environment variables (Ansible can access via `lookup('env', 'VAR_NAME')`)
  - OR as extra_vars (more convenient, but semantic mismatch)

**Implementation Note:**
- When resolving variables for Ansible jobs, include both:
  - Variables with category "env" (from variable sets and templates)
  - These can be passed as environment variables OR merged into extra_vars
- Consider adding a flag or configuration: "pass_env_vars_as_extra_vars" for Ansible jobs

## 3. Current StackWeaver Implementation Analysis

### 3.1 Variable Sets Current State

**Model**: `backend/internal/models/variable_set.go`

**Current Features:**
- Organization-scoped variable sets (can assign to specific projects)
- Workspace-scoped variable sets (assigned to specific workspaces)
- Variables have categories: "terraform" or "env"
- Support for sensitive/encrypted variables
- TFE-compatible structure

**Current Limitations:**
- No "ansible" category
- No direct assignment to job templates
- No priority flag
- No lexical ordering between variable sets

**Repository**: `backend/internal/repository/variable_set.go`

**Current Resolution Logic** (`ListByWorkspace`):
1. Fetch organization-scoped variable sets
   - If project assignments exist, only include if workspace's project is assigned
   - If no project assignments, applies to all workspaces in org
2. Fetch workspace-scoped variable sets
3. Return combined list

**Service**: `backend/internal/services/variable/service.go`

**Current Precedence** (`GetVariablesForRun`):
1. Variable Set Variables (processed first, lowest priority)
2. Workspace Variables (override variable sets)

### 3.2 Ansible Current State

**Job Templates**: `backend/internal/models/ansible_playbook.go:48-95`
- Has `ExtraVars` field (JSONB, `InventoryVariables` type)
- No variable set integration

**Jobs**: `backend/internal/models/ansible_job.go:56-120`
- Has `ExtraVars` field (JSONB, `JobExtraVars` type)
- Can be launched from templates with override variables

**Runner**: `backend/cmd/ansible-runner/main.go:1082-1087`
- Extra vars passed via `--extra-vars` flag as JSON
- Currently only from job/template `ExtraVars` field

### 3.3 Gaps Identified

1. **Platform Variables**: Not implemented for Terraform or Ansible
2. **Ansible Variable Sets**: No integration with variable sets
3. **Project-Level Variable Sets**: Partially implemented (organization-scoped with project assignments), but not used for Ansible
4. **Variable Set Assignment to Job Templates**: Not implemented
5. **Platform Variable Display**: No UI for showing platform variables

## 4. Design Recommendations

### 4.1 Platform Variables Design

#### Terraform Platform Variables

**Implementation Approach:**
- Generate as **environment variables** (not Terraform variables)
- Use `TFC_*` prefix for TFE compatibility
- Compute on-the-fly (no database storage)
- Inject at runtime when preparing run environment

**Variables to Provide:**
- `TFC_WORKSPACE_ID` - Workspace ID (e.g., "ws-abc123...")
- `TFC_WORKSPACE_NAME` - Workspace name
- `TFC_ORGANIZATION_NAME` - Organization name (need to fetch from workspace)
- `TFC_PROJECT_NAME` - Project name (need to fetch from workspace)
- `TFC_PROJECT_ID` - Project ID (UUID)
- `TFC_RUN_ID` - Run ID (available at run time)
- `TFC_CONFIGURATION_VERSION_GIT_BRANCH` - VCS branch (if VCS configured)
- `TFC_CONFIGURATION_VERSION_GIT_COMMIT_SHA` - Git commit SHA (if VCS configured)

**Precedence:**
- Platform environment variables (lowest priority)
- Variable Set environment variables (category "env")
- Workspace environment variables (category "env", highest priority)

**Code Location:**
- Modify `GetEnvironmentVariablesForRun()` in `backend/internal/services/variable/service.go`
- Add platform variable generation function
- Inject in run preparation (where environment variables are set)

#### Ansible Platform Variables

**Implementation Approach:**
- Generate as **extra_vars** (JSON)
- Use `stackweaver_*` prefix (not `TFC_*` since it's Ansible-specific)
- Compute on-the-fly
- Merge into job `ExtraVars` before execution

**Variables to Provide:**
- `stackweaver_organization_name` - Organization name
- `stackweaver_project_name` - Project name
- `stackweaver_inventory_name` - Inventory name
- `stackweaver_playbook_name` - Playbook name
- `stackweaver_job_template_name` - Job template name (if launched from template)
- `stackweaver_job_id` - Job ID (UUID)
- `stackweaver_job_name` - Job name/description

**Precedence:**
- Platform extra_vars (lowest priority)
- Variable Set extra_vars (if category "ansible" or new approach)
- Job Template ExtraVars
- Job Launch Override ExtraVars (highest priority)

**Code Location:**
- Modify `LaunchFromTemplate()` and job creation in `backend/internal/services/ansible/job.go`
- Add platform variable generation function
- Merge in `ansible-runner` before building args

### 4.2 Variable Sets for Ansible Design

**Approach:**
1. **Extend Variable Set Categories**
   - Add "ansible" category to `VariableSetVariable`
   - Or: Reuse existing categories with different scoping logic

2. **Add Job Template Assignment**
   - Create join table: `variable_set_job_templates`
   - Allow assigning variable sets directly to job templates
   - Also support project-level assignment (already exists)

3. **Variable Resolution for Ansible**
   - Create `GetVariablesForAnsibleJob()` method
   - Fetch variable sets assigned to:
     - Project (organization-scoped with project assignment)
     - Job Template (direct assignment)
   - Filter for "ansible" category variables
   - Merge with template/job extra_vars

**Database Changes:**
```sql
-- New join table for job template assignment
CREATE TABLE variable_set_job_templates (
    variable_set_id VARCHAR(25) NOT NULL,
    job_template_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL,
    PRIMARY KEY (variable_set_id, job_template_id)
);
```

**Model Changes:**
- Add `JobTemplates []AnsibleJobTemplate` relationship to `VariableSet`
- Add repository methods: `AddJobTemplate()`, `RemoveJobTemplate()`, `ListByJobTemplate()`

### 4.3 Precedence Order Final Design

#### Terraform Variables

**Terraform Input Variables** (category "terraform"):
1. Platform Variables (N/A - we use env vars)
2. Variable Set Variables (organization-scoped → workspace-scoped)
3. Workspace Variables (highest priority)

**Environment Variables** (category "env"):
1. Platform Environment Variables (`TFC_*`, lowest priority)
2. Variable Set Environment Variables
3. Workspace Environment Variables (highest priority)

#### Ansible Extra Variables

1. Platform Extra Variables (`stackweaver_*`, lowest priority)
2. Variable Set Extra Variables (project-scoped → template-assigned)
3. Job Template ExtraVars
4. Job Launch Override ExtraVars (highest priority)

### 4.4 Frontend Design

**Platform Variables Display:**

**Terraform (Workspace Detail Page):**
- Add new section: "Platform Environment Variables"
- Display as read-only list with `TFC_*` prefix
- Show icon/indicator that these are system-provided
- Tooltip: "These variables are automatically provided by the platform. You can override them by creating workspace environment variables with the same name."
- Link to documentation

**Ansible (Job Template Detail Page):**
- Add new section: "Platform Variables"
- Display as read-only list with `stackweaver_*` prefix
- Similar UI treatment as Terraform
- Show in job execution view as well

**Variable Sets for Ansible:**
- Add "Variable Sets" tab/section to Job Template detail page
- Allow assigning variable sets to job template
- Show preview of variables that will be applied
- Similar to workspace variable set assignment UI

## 5. Open Questions Resolved

### 5.1 Variable Naming

**Decision:**
- Terraform: Use `TFC_*` prefix for environment variables (TFE compatibility)
- Ansible: Use `stackweaver_*` prefix for extra_vars (platform branding, no conflicts)

### 5.2 Variable Set Scope for Ansible

**Decision:**
- Support both:
  - Project-level assignment (organization-scoped variable sets assigned to projects)
  - Template-level assignment (direct assignment to job templates)
- Precedence: Template-assigned → Project-assigned

### 5.3 Environment Variables

**Decision:**
- Terraform: Provide platform variables as environment variables (`TFC_*`)
- Ansible: Provide platform variables as extra_vars (`stackweaver_*`)
- Future: Could add environment variable support for Ansible if needed

### 5.4 Variable Set Categories

**Decision:**
- Add "ansible" category to `VariableSetVariable`
- Allows filtering: "terraform" for Terraform, "env" for environment vars, "ansible" for Ansible
- Clear separation of concerns

### 5.5 Frontend Display

**Decision:**
- Separate section for platform variables (not mixed with user variables)
- Clear visual distinction (read-only, system-provided indicator)
- Show in both workspace detail and job template detail pages
- Tooltip explaining override behavior

## 6. Implementation Considerations

### 6.1 Database Changes

**Required:**
- New join table: `variable_set_job_templates`
- No changes to existing tables (backward compatible)

**Optional (Future):**
- Priority flag on `VariableSet` (for future priority variable sets feature)
- Lexical ordering support (for future TFE-compatible ordering)

### 6.2 Backward Compatibility

**Terraform:**
- Platform variables are additive (no breaking changes)
- Existing variable resolution unchanged
- Environment variables are separate from Terraform variables

**Ansible:**
- Variable sets integration is additive
- Existing job template extra_vars unchanged
- Platform variables are additive

### 6.3 Performance

**Platform Variable Generation:**
- Compute on-the-fly (no database queries for platform vars)
- Cache workspace/project/organization lookups if needed
- Minimal performance impact

**Variable Set Resolution:**
- Current implementation already efficient
- Job template assignment adds one join table query
- No significant performance impact expected

### 6.4 Testing Strategy

**Unit Tests:**
- Platform variable generation functions
- Variable precedence logic
- Variable set resolution for Ansible

**Integration Tests:**
- End-to-end variable resolution for Terraform runs
- End-to-end variable resolution for Ansible jobs
- Override behavior (user vars override platform vars)
- Variable set assignment and resolution

**TFE Compatibility Tests:**
- Verify environment variables are set correctly
- Verify no conflicts with TFE provider
- Verify variable precedence matches expected behavior

## 7. Next Steps

### Phase 2 Preparation

1. **Finalize Design Decisions:**
   - Review and approve platform variable list
   - Review and approve precedence order
   - Review and approve UI design

2. **Create Detailed Implementation Plan:**
   - Break down into tasks
   - Estimate effort
   - Identify dependencies

3. **Start Implementation:**
   - Begin with Terraform platform variables (simpler)
   - Then Ansible variable sets integration
   - Then Ansible platform variables

### Documentation Updates

1. **API Documentation:**
   - Document platform environment variables
   - Document variable set assignment to job templates
   - Update variable precedence documentation

2. **User Documentation:**
   - Guide on using platform variables
   - Guide on variable sets for Ansible
   - Examples and use cases

## 8. References

### Code References

**Terraform Variables:**
- Variable Service: `backend/internal/services/variable/service.go:151-198`
- Variable Set Repository: `backend/internal/repository/variable_set.go:39-93`
- Variable Set Model: `backend/internal/models/variable_set.go`

**Ansible Variables:**
- Job Template Model: `backend/internal/models/ansible_playbook.go:48-95`
- Job Model: `backend/internal/models/ansible_job.go:56-120`
- Job Service: `backend/internal/services/ansible/job.go`
- Ansible Runner: `backend/cmd/ansible-runner/main.go:1082-1087`

### External References

- TFE Run Environment Variables: https://developer.hashicorp.com/terraform/enterprise/run/run-environment
- TFE Variable Precedence: https://developer.hashicorp.com/terraform/enterprise/workspaces/variables
- AWX Variable Precedence: https://ansible.readthedocs.io/projects/awx/en/24.6.1/userguide/job_templates.html
- AWX Credential Injection: https://docs.ansible.com/ansible-tower/3.5.6/html/userguide/credential_types.html
