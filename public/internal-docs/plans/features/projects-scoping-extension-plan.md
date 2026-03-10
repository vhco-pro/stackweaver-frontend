<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Projects Scoping Extension Plan

TODO: Verify status of this implementation

## Executive Summary

This document outlines the current state of projects in StackWeaver, compares it with Terraform Enterprise (TFE) and AWX/Ansible Tower approaches, and provides a detailed plan for extending project scoping to include Ansible resources (inventories, playbooks, job templates) and credentials/variable sets.

### Quick Status Overview

| Resource | Model | Repository | API Endpoint | Frontend | Status |
|----------|-------|------------|--------------|----------|--------|
| **Workspaces** | ✅ ProjectID | ✅ ListByProject | ✅ Org-scoped | ✅ Shown | ✅ Complete |
| **AnsiblePlaybook** | ✅ ProjectID | ✅ ListByProject | ✅ Org-scoped | ❌ Missing | ⚠️ Backend ready |
| **AnsibleJobTemplate** | ✅ ProjectID | ✅ ListByProject | ✅ Org-scoped | ❌ Missing | ⚠️ Backend ready |
| **AnsibleWorkflow** | ✅ ProjectID | ✅ ListByProject | ❌ Missing | ❌ Missing | ⚠️ Partial |
| **AnsibleJob** | ✅ ProjectID | ✅ ListByProject | ✅ Project endpoint | ❌ Missing | ⚠️ Backend ready |
| **AnsibleInventory** | ❌ No ProjectID | ❌ No ListByProject | ❌ Missing | ❌ Missing | ❌ Not started |
| **AnsibleCredential** | ❌ No ProjectID | ❌ No ListByProject | ❌ Missing | ❌ Missing | ❌ Not started |
| **VariableSet** | ✅ Project support | ✅ Project filtering | ✅ Supports projects | ⚠️ Needs UI | ⚠️ Partial |

### Key Findings

1. **Backend Infrastructure Partially Ready**: Playbooks, job templates, workflows, and jobs already have project scoping in the database and repositories. Only inventories and credentials need database schema updates.

2. **API Endpoints**: Organization-scoped endpoints exist for all resources. Frontend filters client-side by `project_id` (same pattern as workspaces). Project-scoped endpoints exist for playbooks/job templates but are legacy and not used by frontend.

3. **Frontend Missing**: The ProjectDetail page only shows workspaces. All Ansible resources need to be added to the UI.

4. **Quick Wins Available**: Can immediately add playbooks and job templates to the project detail view since backend support exists.

### Recommended Next Steps

1. **Immediate (Quick Wins)**: Add playbooks and job templates sections to ProjectDetail page
2. **Short-term**: Add ProjectID to inventories, support in create/update API, add to frontend (filter client-side)
3. **Medium-term**: Add ProjectID to credentials (optional), support in create/update API, add to frontend (filter client-side)
4. **Long-term**: Enhance variable sets UI, verify RBAC integration

## Current State Analysis

### Current Project Model

**Location**: `backend/internal/models/project.go`

```go
type Project struct {
    ID             uuid.UUID
    OrganizationID uuid.UUID
    Name           string
    Description    string
    Workspaces     []Workspace  // Only workspaces currently associated
}
```

### Currently Project-Scoped Resources

1. **Workspaces** (Terraform)
   - Direct foreign key relationship: `Workspace.ProjectID`
   - Model: `backend/internal/models/workspace.go:13`
   - Repository: `ListByProject()` exists
   - API: Organization-scoped listing with project filtering
   - Frontend: ✅ Shown in ProjectDetail page
   - Status: ✅ Fully implemented

2. **AnsiblePlaybook**
   - Direct foreign key relationship: `AnsiblePlaybook.ProjectID`
   - Model: `backend/internal/models/ansible_playbook.go:15`
   - Repository: `ListByProject()` exists (`backend/internal/repository/ansible_playbook.go:41`)
   - API: Organization-scoped endpoint exists (project-scoped endpoint exists but not used by frontend)
   - Frontend: ❌ Not shown in project detail view (should filter org-scoped list client-side)
   - Status: ⚠️ Backend ready, frontend missing

3. **AnsibleJobTemplate**
   - Direct foreign key relationship: `AnsibleJobTemplate.ProjectID`
   - Model: `backend/internal/models/ansible_playbook.go:52`
   - Repository: `ListByProject()` exists (`backend/internal/repository/ansible_playbook.go:170`)
   - API: Organization-scoped endpoint exists (project-scoped endpoint exists but not used by frontend)
   - Frontend: ❌ Not shown in project detail view (should filter org-scoped list client-side)
   - Status: ⚠️ Backend ready, frontend missing

4. **AnsibleWorkflow**
   - Direct foreign key relationship: `AnsibleWorkflow.ProjectID` (optional)
   - Model: `backend/internal/models/ansible_workflow.go:15`
   - Repository: `ListByProject()` exists (`backend/internal/repository/ansible_workflow.go:81`)
   - API: Organization-scoped only (no project endpoint yet)
   - Frontend: ❌ Not shown in project detail view
   - Status: ⚠️ Repository ready, API and frontend missing

5. **AnsibleJob**
   - Direct foreign key relationship: `AnsibleJob.ProjectID`
   - Model: `backend/internal/models/ansible_job.go:58`
   - Repository: `ListByProject()` exists (`backend/internal/repository/ansible_job.go:37`)
   - API: ✅ Project-scoped endpoint exists (`GET /api/v2/projects/:id/ansible/jobs`)
   - Frontend: ❌ Not shown in project detail view
   - Status: ⚠️ Backend ready, frontend missing

### Currently Organization-Scoped Resources (Need Project Scoping)

1. **AnsibleInventory**
   - Currently: Only `OrganizationID` (no `ProjectID`)
   - Model: `backend/internal/models/ansible_inventory.go:46`
   - Repository: Only `ListByOrganization()` exists, no `ListByProject()`
   - API: Organization-scoped only, no project endpoint
   - Status: ❌ Needs `ProjectID` field, repository method, API endpoint, and frontend

2. **AnsibleCredential**
   - Currently: Only `OrganizationID` (no `ProjectID`)
   - Model: `backend/internal/models/ansible_credential.go:28`
   - Status: ❌ Needs `ProjectID` field added (optional, for project-scoped credentials)

3. **VariableSet**
   - Currently: Organization-scoped with optional project assignments via many-to-many
   - Model: `backend/internal/models/variable_set.go:26`
   - Status: ⚠️ Already supports project scoping via `variable_set_projects` join table, but implementation may need enhancement

### Frontend Current State

**Location**: `frontend/src/pages/ProjectDetail.tsx`

- Currently only displays **Workspaces**
- Filters workspaces by `project_id` from the full organization list
- No sections for Ansible resources

## Comparison with TFE and AWX

### Terraform Enterprise (TFE) Approach

**Project Scoping:**
- Projects group workspaces
- Variable sets can be scoped to:
  - **Global (organization)**: Applies to all workspaces
  - **Project-scoped**: Applies to all workspaces in one or more projects
  - **Workspace-scoped**: Applies to specific workspaces
- Credentials are typically stored in variable sets as environment variables
- Projects are used as RBAC boundaries for permissions

**Key Insights:**
- Variable sets support project-level scoping via many-to-many relationships
- Credentials are not directly project-scoped; they're in variable sets
- Projects are primarily organizational/grouping constructs with RBAC implications

### AWX/Ansible Tower Approach

**Project Scoping:**
- **Projects** are SCM-backed repositories containing playbooks
- **Inventories** are organization-scoped but can be used by job templates
- **Job Templates** reference: project, inventory, playbook, credentials
- **Credentials** are organization-scoped but can be restricted via permissions
- Permissions are resource-based (use, read, execute roles)

**Key Insights:**
- AWX "Projects" are different from StackWeaver projects (they're SCM repos)
- Inventories are organization-scoped but used within project contexts
- Credentials are organization-scoped with permission-based access control
- Job templates tie everything together

### StackWeaver Hybrid Approach (Recommended)

Given that StackWeaver supports both Terraform and Ansible, we should adopt a hybrid approach:

1. **Projects** are organizational grouping constructs (like TFE)
   - **Important**: Projects are primarily organizational/grouping constructs with RBAC implications
   - Projects serve as boundaries for permissions and resource organization
   - Not all resources need to be project-scoped; some remain organization-scoped

2. **Ansible resources** can be project-scoped (inventory, playbook, job template)
3. **Credentials** can be optionally project-scoped (for better isolation)
4. **Variable sets** already support project scoping (enhance as needed)

### Default Project Logic

**Key Requirement**: On creation of items that require project scope, default to the organization's default project if no project was selected. This makes the feature non-intrusive for users who just want to group everything in one project.

**Implementation Notes:**
- Organizations should have a "default" project (or we create one automatically)
- When creating resources from organization level without specifying project, assign to default project
- When creating resources from project detail page, pre-fill the project_id
- This ensures resources are always project-scoped without requiring explicit selection

## Implementation Plan

### Phase 1: Database Schema Updates

#### 1.0 Identify/Create Default Project

**Requirement**: Each organization needs a default project for auto-assignment.

**Options:**
1. Create a "default" project automatically when organization is created
2. Use the first project created in the organization as default
3. Add a `default_project_id` field to Organization model

**Recommendation**: Option 1 - Automatically create a "default" project when organization is created. This ensures every organization has a default project from the start.

**Files to update:**
- `backend/internal/models/organization.go` - Add `DefaultProjectID` field (optional)
- `backend/internal/repository/organization.go` - Create default project on org creation
- Or: Create default project in organization creation handler

#### 1.1 Add ProjectID to AnsibleInventory

**File**: `backend/internal/models/ansible_inventory.go`

```go
// Add to AnsibleInventory struct:
ProjectID   *uuid.UUID `gorm:"type:uuid;index" json:"project_id,omitempty"` // Optional: null = org-scoped, set = project-scoped
Project     *Project   `gorm:"foreignKey:ProjectID" json:"project,omitempty"`

// Update unique index:
// Change: uniqueIndex:idx_org_inventory
// To: uniqueIndex:idx_org_inventory (when ProjectID is null)
// Add: uniqueIndex:idx_project_inventory (when ProjectID is set)
```

**Migration Considerations:**
- Make `ProjectID` nullable (optional)
- Existing inventories remain organization-scoped (ProjectID = null)
- New inventories can be created with ProjectID for project scoping
- Update unique constraint to allow same name in different projects
- **Default Project Logic**: When creating inventory without ProjectID, assign to organization's default project

#### 1.2 Add ProjectID to AnsibleCredential (Optional)

**File**: `backend/internal/models/ansible_credential.go`

```go
// Add to AnsibleCredential struct:
ProjectID   *uuid.UUID `gorm:"type:uuid;index" json:"project_id,omitempty"` // Optional: null = org-scoped, set = project-scoped
Project     *Project   `gorm:"foreignKey:ProjectID" json:"project,omitempty"`

// Update unique index:
// Change: uniqueIndex:idx_org_credential
// To: Support both org-scoped and project-scoped credentials
```

**Migration Considerations:**
- Make `ProjectID` nullable (optional)
- Existing credentials remain organization-scoped
- New credentials can be project-scoped for better isolation
- **Default Project Logic**: When creating credential without ProjectID, assign to organization's default project

#### 1.3 Update Project Model Relationships

**File**: `backend/internal/models/project.go`

```go
// Add relationships to Project struct:
Inventories      []AnsibleInventory      `gorm:"foreignKey:ProjectID" json:"inventories,omitempty"`
Playbooks        []AnsiblePlaybook       `gorm:"foreignKey:ProjectID" json:"playbooks,omitempty"`
JobTemplates     []AnsibleJobTemplate    `gorm:"foreignKey:ProjectID" json:"job_templates,omitempty"`
Workflows        []AnsibleWorkflow       `gorm:"foreignKey:ProjectID" json:"workflows,omitempty"`
Credentials      []AnsibleCredential     `gorm:"foreignKey:ProjectID" json:"credentials,omitempty"`
```

### Phase 2: Backend API Updates

#### 2.1 Update Project Repository

**File**: `backend/internal/repository/project.go`

Add methods to preload related resources:

```go
func (r *ProjectRepository) GetByIDWithResources(id uuid.UUID) (*models.Project, error) {
    var project models.Project
    err := r.db.
        Preload("Organization").
        Preload("Workspaces").
        Preload("Inventories").
        Preload("Playbooks").
        Preload("JobTemplates").
        Preload("Workflows").
        Preload("Credentials").
        First(&project, "id = ?", id).Error
    return &project, err
}
```

**Status**: ⚠️ Not yet implemented

#### 2.2 Update Project Handler

**File**: `backend/internal/api/v2/handlers/projects.go`

- Update `Get()` and `GetByID()` to use `GetByIDWithResources()`
- Add resource counts to project response (optional, for UI display)

**Status**: ❌ Not yet implemented

#### 2.3 Update Ansible Resource Handlers

**Files to update:**
- ✅ `backend/internal/api/v2/handlers/ansible/playbooks.go` - Already has project endpoints
- ✅ `backend/internal/api/v2/handlers/ansible/job_templates.go` - Already has project endpoints  
- ❌ `backend/internal/api/v2/handlers/ansible/inventories.go` - Needs project endpoint
- ❌ `backend/internal/api/v2/handlers/ansible/credentials.go` - Needs project endpoint
- ❌ `backend/internal/api/v2/handlers/ansible/workflows.go` - Needs project endpoint

**Changes needed:**
- ✅ Playbooks/JobTemplates: Already support project scoping (legacy project endpoints exist but not used by frontend)
- ❌ Inventories: Support `project_id` in create/update (NO project endpoint - use org-scoped, filter client-side)
- ❌ Credentials: Support `project_id` in create/update (NO project endpoint - use org-scoped, filter client-side)
- ❌ Workflows: Support `project_id` in create/update (NO project endpoint - use org-scoped, filter client-side)
- **Pattern**: Keep organization-scoped endpoints, frontend filters client-side by `project_id` (same as workspaces)
- All: Update validation to ensure project belongs to organization
- **Default Project Logic**: When creating resources without `project_id`, automatically assign to organization's default project

#### 2.4 Update Ansible Repositories

**Files to update:**
- ❌ `backend/internal/repository/ansible_inventory.go` - Needs `ListByProject()` method (for internal use only)
- ❌ `backend/internal/repository/ansible_credential.go` - Needs `ListByProject()` method (for internal use only)
- ✅ `backend/internal/repository/ansible_playbook.go` - Already has `ListByProject()` (for internal use)
- ✅ `backend/internal/repository/ansible_workflow.go` - Already has `ListByProject()` (for internal use)

**Changes needed:**
- Add `ListByProject(projectID uuid.UUID)` methods for inventories and credentials (for internal use, not exposed as endpoints)
- **Keep `ListByOrganization()` as-is** - returns all resources (org-scoped and project-scoped), frontend filters client-side
- **No project-scoped API endpoints needed** - frontend uses org-scoped endpoints and filters by `project_id` (same pattern as workspaces)

### Phase 3: Frontend Updates

#### 3.1 Update Project Detail Page

**File**: `frontend/src/pages/ProjectDetail.tsx`

**UI Design Decision**: Make project detail sections collapsible - keep the same kind of ordering we have now (header and cards under it), with options to easily filter and expand.

**Changes:**
1. Add collapsible sections for:
   - Workspaces (existing - make collapsible)
   - Inventories
   - Playbooks
   - Job Templates
   - Workflows (optional)
   - Credentials (optional)

2. Each section should have:
   - Collapsible header with resource count
   - Filter/search functionality
   - Grid of resource cards (same style as current workspaces)
   - "Create" button in section header

3. Fetch and display resources for each section (same pattern as workspaces):
   ```typescript
   // Add state for each resource type
   const [inventories, setInventories] = useState<AnsibleInventory[]>([]);
   const [playbooks, setPlaybooks] = useState<AnsiblePlaybook[]>([]);
   const [jobTemplates, setJobTemplates] = useState<AnsibleJobTemplate[]>([]);
   
   // Fetch from organization-scoped endpoints, filter client-side by project_id
   void Promise.all([
     ansibleApi.listInventories(orgName), // Org-scoped endpoint
     ansibleApi.listPlaybooks(orgName),   // Org-scoped endpoint
     ansibleApi.listJobTemplates(orgName), // Org-scoped endpoint
   ]).then(([invRes, pbRes, jtRes]) => {
     // Filter client-side by project_id (same pattern as workspaces)
     setInventories((invRes.data || []).filter(i => i.project_id === project.id));
     setPlaybooks((pbRes.data || []).filter(p => p.project_id === project.id));
     setJobTemplates((jtRes.data || []).filter(jt => jt.project_id === project.id));
   });
   ```

3. Add "Create" buttons for each resource type (scoped to the project)

#### 3.2 Update Ansible API Client

**File**: `frontend/src/api/ansible.ts`

**Changes:**
- Add `project_id` parameter to list methods (optional)
- Update create methods to accept `project_id`

#### 3.3 Update Resource Creation Dialogs

**Files to update:**
- `frontend/src/components/ansible/CreateInventoryDialog.tsx` (if exists)
- `frontend/src/components/ansible/CreatePlaybookDialog.tsx` (if exists)
- `frontend/src/components/ansible/CreateJobTemplateDialog.tsx` (if exists)

**Changes:**
- Accept `projectId` prop
- Pre-fill `project_id` when creating from project detail page
- Allow selection of project when creating from organization level

### Phase 4: Variable Sets Enhancement

#### 4.1 Review Current Implementation

**File**: `backend/internal/models/variable_set.go`

**Current State:**
- Variable sets already support project scoping via `variable_set_projects` join table
- Organization-scoped variable sets can be assigned to specific projects

**Enhancements Needed:**
- Ensure project-scoped variable sets work correctly
- Update UI to show project assignments
- Add project-level variable set management in project detail view

#### 4.2 Update Variable Set Repository

**File**: `backend/internal/repository/variable_set.go`

**Review**: `ListByWorkspace()` already handles project-scoped variable sets correctly (see lines 47-78)

**Enhancements:**
- Add `ListByProject(projectID uuid.UUID)` method
- Ensure project-scoped variable sets are properly filtered

### Phase 5: RBAC Integration

#### 5.1 Project-Level Permissions

**Considerations:**
- Projects are already used as RBAC boundaries (see `TeamProjectAccess`)
- Ensure Ansible resources respect project-level permissions
- Update permission checks to verify project access for project-scoped resources

**Files to review:**
- `backend/internal/services/rbac/service.go`
- Project access checks in Ansible handlers

## Migration Strategy

### Database Migration

1. **Add nullable ProjectID columns:**
   ```sql
   ALTER TABLE ansible_inventories 
   ADD COLUMN project_id UUID REFERENCES projects(id);
   
   CREATE INDEX idx_ansible_inventories_project_id ON ansible_inventories(project_id);
   
   -- Update unique constraint to allow same name in different projects
   -- (Keep org-level uniqueness when project_id is null)
   ```

2. **Repeat for ansible_credentials**

3. **Update GORM models** (already covered in Phase 1)

### Data Migration

- **No data migration needed** - existing resources remain organization-scoped (ProjectID = null)
- New resources can be created with ProjectID
- Users can optionally migrate existing resources to projects via update API

## Testing Plan

### Unit Tests

1. **Model Tests:**
   - Test project relationships load correctly
   - Test unique constraints with project scoping

2. **Repository Tests:**
   - Test `ListByProject()` methods
   - Test filtering by project in list queries

3. **Handler Tests:**
   - Test creating resources with project_id
   - Test listing resources filtered by project
   - Test validation (project belongs to organization)

### Integration Tests

1. **Project Detail API:**
   - Test project endpoint returns all related resources
   - Test resource counts are accurate

2. **Resource Creation:**
   - Test creating inventory/playbook/job template with project_id
   - Test creating from project detail page vs organization level

3. **RBAC Tests:**
   - Test project-scoped resources respect project permissions
   - Test users without project access cannot see project-scoped resources

### Frontend Tests

1. **Project Detail Page:**
   - Test all resource sections render correctly
   - Test resource counts display
   - Test create buttons work and pre-fill project_id

2. **Resource Lists:**
   - Test filtering by project works
   - Test organization-level lists show both org and project-scoped resources

## Implementation Order

### Recommended Sequence

1. **Phase 1: Database Schema** (Foundation)
   - Add ProjectID to AnsibleInventory
   - Add ProjectID to AnsibleCredential (optional)
   - Update Project model relationships
   - Create database migration

2. **Phase 2: Backend API - Inventories** (Priority: High)
   - Add `ListByProject()` to inventory repository
   - Add project endpoint for inventories
   - Support `project_id` in create/update requests

3. **Phase 3: Backend API - Credentials** (Priority: Medium)
   - Add `ListByProject()` to credential repository
   - Add project endpoint for credentials
   - Support `project_id` in create/update requests

4. **Phase 4: Backend API - Workflows** (Priority: Low)
   - Add project endpoint for workflows (repository method already exists)

5. **Phase 5: Backend API - Project Detail** (Priority: High)
   - Update Project repository to preload all resources
   - Update Project handler to return resource counts

6. **Phase 6: Frontend - Project Detail** (User-facing)
   - Update ProjectDetail page
   - Add resource sections (Inventories, Playbooks, Job Templates, Workflows, Credentials)
   - Add create buttons for each resource type

7. **Phase 7: Frontend - Resource Creation** (Completeness)
   - Update creation dialogs to accept `projectId` prop
   - Support project selection when creating from organization level

8. **Phase 8: Variable Sets & RBAC** (Polish)
   - Enhance variable set project scoping UI
   - Verify RBAC integration for project-scoped resources

### Quick Wins (Can be done immediately)

Since playbooks and job templates already have backend support:
1. **Frontend: Add Playbooks section to ProjectDetail** (30 min)
2. **Frontend: Add Job Templates section to ProjectDetail** (30 min)
3. **Backend: Add resource counts to Project API response** (1 hour)

## Design Decisions

### ✅ Approved Decisions

1. **Credential Scoping:**
   - **Decision**: Optional (nullable ProjectID) for flexibility
   - Credentials can be organization-scoped (ProjectID = null) or project-scoped (ProjectID set)
   - Allows for both shared org credentials and project-specific credentials

2. **Inventory Scoping:**
   - **Decision**: Optional (nullable ProjectID) to support both org and project scoping
   - Inventories can be organization-scoped (ProjectID = null) or project-scoped (ProjectID set)
   - Provides flexibility for shared vs project-specific inventories

3. **Backward Compatibility:**
   - **Decision**: Don't need to care about this - it's an MVP
   - Existing resources without ProjectID remain organization-scoped
   - No migration needed for MVP phase

4. **UI Organization:**
   - **Decision**: Collapsible sections in ProjectDetail page
   - Keep the same ordering style (header and cards under it)
   - Each section should have:
     - Collapsible header with resource count
     - Filter/search functionality
     - Expand/collapse toggle
     - Grid of resource cards (same style as current workspaces)

5. **Resource Counts:**
   - **Decision**: Yes, show counts in project list/cards
   - Similar to how workspaces are currently shown
   - Display counts for each resource type in project cards/list

6. **Default Project Logic:**
   - **Decision**: Default to organization's default project when creating resources without explicit project selection
   - Makes feature non-intrusive for users who want everything in one project
   - Requires identifying/creating a default project per organization

## References

### Code Locations

- **Project Model**: `backend/internal/models/project.go:10-19`
- **Project Handler**: `backend/internal/api/v2/handlers/projects.go`
- **Project Repository**: `backend/internal/repository/project.go`
- **Project Detail Frontend**: `frontend/src/pages/ProjectDetail.tsx`
- **Ansible Inventory Model**: `backend/internal/models/ansible_inventory.go:44-69`
- **Ansible Playbook Model**: `backend/internal/models/ansible_playbook.go:13-39`
- **Ansible Job Template Model**: `backend/internal/models/ansible_playbook.go:50-95`
- **Ansible Credential Model**: `backend/internal/models/ansible_credential.go:26-67`
- **Variable Set Model**: `backend/internal/models/variable_set.go:13-37`

### External References

- **TFE Projects Documentation**: [Terraform Enterprise Projects](https://developer.hashicorp.com/terraform/enterprise/projects/best-practices)
- **TFE Variable Sets**: [Terraform Enterprise Variable Sets](https://developer.hashicorp.com/terraform/enterprise/variables/managing-variables)
- **AWX Projects**: [AWX Projects Documentation](https://ansible.readthedocs.io/projects/awx/en/24.6.1/userguide/projects.html)
