<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Variable Expansion Implementation Plan

## Overview

This document outlines the implementation of platform-provided variables and Ansible variable integration for StackWeaver, maintaining full TFE compatibility.

## Implementation Status

### ✅ Phase 1.5: TFE API Compatibility & Frontend Enhancements - COMPLETE

**Backend Changes:**
- Added `priority` field to `VariableSet` model - See `backend/internal/models/variable_set.go:24`
- Implemented `parent` relationship support (organization vs project ownership) - See `backend/internal/models/variable_set.go:29`
- Updated variable precedence logic to respect priority - See `backend/internal/services/variable/service.go:151-198`

**Frontend Enhancements:**
- Replaced checkboxes with shadcn Switch components - See `frontend/src/pages/Settings/VariableSets.tsx`
- Multi-select dropdowns for project/workspace assignment - See `frontend/src/pages/Settings/VariableSets.tsx`
- Refactored "manage variable set" view: scope moved to "Assignment" tab - See `frontend/src/pages/Settings/VariableSets.tsx`
- Replaced browser dialogs with styled warning dialogs - See `frontend/src/pages/Settings/VariableSets.tsx`

**References:**
- TFE Variable Sets API: https://developer.hashicorp.com/terraform/cloud-docs/api-docs/variable-sets
- Handler Implementation: `backend/internal/api/v2/handlers/variable_sets.go`

### ✅ Phase 2: Terraform Platform Variables - COMPLETE

**Backend Implementation:**
- Platform variable generation - See `GetPlatformVariablesForWorkspace` in `backend/internal/services/variable/service.go`
- Platform variables injected as **environment variables only** (not in terraform.tfvars) in `GetEnvironmentVariablesForRun()` - See `backend/internal/services/variable/service.go`
- API endpoint for platform variable keys - See `backend/internal/api/v2/handlers/terraform/workspaces.go`

**Platform Variables Generated (as env vars, TFC-style):**
- `TF_WORKSPACE_NAME`, `TF_ORGANIZATION_NAME`, `TF_PROJECT_NAME`
- `TF_WORKSPACE_ID`, `TF_ORGANIZATION_ID`, `TF_PROJECT_ID`
- `TF_RUN_ID` (at runtime, when run context is available)

**Design note:** Platform variables are passed as environment variables only (not in terraform.tfvars) to avoid "value for undeclared variable" when the root module does not declare them. This matches TFC (TFC_RUN_ID, TFC_WORKSPACE_ID, etc.). To use in Terraform: read from env via `external` data source, or in provisioners the shell can use `$TF_WORKSPACE_ID`.

**Frontend Implementation:**
- Warning dialog on variable override - See `frontend/src/pages/WorkspaceDetail.tsx`
- Read-only informational section (collapsed by default) - See `frontend/src/pages/WorkspaceDetail.tsx:2479+`

**Variable Precedence (lowest to highest):**
1. Platform variables (system-provided)
2. Non-priority variable sets
3. Priority variable sets
4. Workspace variables (cannot override priority sets)

### ✅ Phase 3: Ansible Variable Sets Integration - COMPLETE

**Backend Implementation:**
- Variable sets inherited from project/organization - See `backend/internal/services/variable/service_ansible.go:46-133`
- Organization-scoped sets apply to all projects when no project assignments exist - See `backend/internal/models/variable_set.go:166-219`
- Integration with Ansible job execution - See `backend/internal/services/ansible/job.go`

**Frontend Implementation:**
- Variable sets displayed in job template detail - See `frontend/src/pages/Ansible/JobTemplateDetail.tsx:919+`
- Only displays variable sets with `env` category variables (Ansible-compatible)
- Platform variables section (collapsed by default) - See `frontend/src/pages/Ansible/JobTemplateDetail.tsx:990+`

**Variable Precedence (lowest to highest):**
1. Platform variables (`stackweaver_*` prefix)
2. Organization/Project Variable Sets (non-priority, then priority)
3. Template Variables (Phase 4)
4. Template ExtraVars
5. Job Override ExtraVars

### ✅ Phase 4: Job Template Variables - COMPLETE

**Backend Implementation:**
- `AnsibleJobTemplateVariable` model - See `backend/internal/models/ansible_job_template_variable.go`
- Repository methods - See `backend/internal/repository/ansible_job_template_variable.go`
- Service integration - See `backend/internal/services/variable/service.go:59-62` and `service_ansible.go:46-133`
- API endpoints - See `backend/internal/api/v2/handlers/ansible/job_template_variables.go`

**API Endpoints:**
- `GET /api/v2/ansible/job-templates/:id/vars` - List template variables
- `POST /api/v2/ansible/job-templates/:id/vars` - Create template variable
- `PATCH /api/v2/ansible/job-templates/:id/vars/:variable_id` - Update template variable
- `DELETE /api/v2/ansible/job-templates/:id/vars/:variable_id` - Delete template variable

**Route Registration:** See `backend/internal/api/v2/routes/ansible_routes.go`

**Frontend Implementation:**
- Template variables management UI - See `frontend/src/pages/Ansible/JobTemplateDetail.tsx:838+`
- Variables tab with three sections: Template Variables, Variable Sets, Platform Variables
- API client methods - See `frontend/src/api/ansible.ts:677+`

**Updated Variable Precedence for Ansible:**
1. Platform variables (lowest)
2. Organization/Project Variable Sets (non-priority, then priority)
3. Template Variables (override non-priority sets, but NOT priority sets)
4. Template ExtraVars
5. Job Override ExtraVars (highest, except priority sets)

## Technical Details

### Variable Precedence

**Terraform Workspaces:**
1. Platform variables → 2. Non-priority variable sets → 3. Priority variable sets → 4. Workspace variables

**Ansible Job Templates:**
1. Platform variables → 2. Organization/Project Variable Sets (non-priority, then priority) → 3. Template Variables (override non-priority sets only) → 4. Template ExtraVars → 5. Job Override ExtraVars

### Key Design Decisions

- **Platform Variables**: Generated on-the-fly (no database storage) - See `backend/internal/services/variable/service.go:64-138`
- **TFE Compatibility**: Full JSON:API format compliance, TFE-compatible variable precedence
- **Ansible Integration**: Variable sets assigned to projects automatically apply to all job templates in that project
- **Organization-Scoped Sets**: Apply to all projects (and job templates) when no project assignments exist

### Code References

**Backend:**
- Variable Service: `backend/internal/services/variable/service.go`
- Ansible Variable Service: `backend/internal/services/variable/service_ansible.go`
- Variable Models: `backend/internal/models/variable.go`, `backend/internal/models/variable_set.go`
- Template Variable Model: `backend/internal/models/ansible_job_template_variable.go`
- Variable Handlers: `backend/internal/api/v2/handlers/variable_sets.go`
- Template Variable Handlers: `backend/internal/api/v2/handlers/ansible/job_template_variables.go`

**Frontend:**
- Workspace Variables: `frontend/src/pages/WorkspaceDetail.tsx`
- Variable Sets Management: `frontend/src/pages/Settings/VariableSets.tsx`
- Job Template Variables: `frontend/src/pages/Ansible/JobTemplateDetail.tsx`
- API Client: `frontend/src/api/client.ts`, `frontend/src/api/ansible.ts`

## Database Changes

- Added `priority` column to `variable_sets` table
- Added `ansible_job_template_variables` table (via GORM AutoMigrate)
- No database storage for platform variables (computed on-the-fly)

## Success Criteria

All criteria met:
- ✅ Platform variables available in Terraform runs and Ansible jobs
- ✅ Users can override platform variables
- ✅ Variable sets work with Ansible job templates
- ✅ TFE compatibility maintained
- ✅ Frontend shows warnings for overrides
- ✅ Job template variables fully implemented
