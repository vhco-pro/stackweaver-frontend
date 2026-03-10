<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Frontend V2 Design Document

## Overview

This document outlines the complete redesign of the Stackweaver frontend to align with Terraform Enterprise (TFE) patterns for better multi-tenancy support, improved navigation, and native JSON:API format adoption.

## Goals

1. **Organization-First Architecture**: Organizations are the primary navigation context
2. **TFE-Compatible URL Structure**: URLs match what Terraform CLI expects
3. **Contextual Navigation**: Dashboard and navigation adapt based on organization selection
4. **Native JSON:API**: Remove translation layer, use JSON:API format directly
5. **Improved Multi-Tenancy**: Better organization switching and management
6. **Consistent UI/UX**: Match Terraform Enterprise patterns users expect

---

## URL Structure

### Current Structure (Problems)
```
/dashboard
/organizations
/organizations/:name
/organizations/:organizationName/workspaces
/organizations/:organizationName/workspaces/:workspaceName
/organizations/:organizationName/projects/:projectName  ❌ Projects in URL
```

### New Structure (TFE-Compatible)
```
/dashboard                                    # Global overview (all orgs)
/organizations                                # Organization management
/organizations/:orgName                       # Organization detail (optional)

/app/:orgName/projects                        # Projects (org-scoped, logical grouping)
/app/:orgName/projects/:projectName           # Project detail
/app/:orgName/workspaces                      # Workspace list (org-scoped)
/app/:orgName/workspaces/:workspaceName       # Workspace detail
/app/:orgName/workspaces/:workspaceName/runs/:runId  # Run detail (TFE format)
/app/:orgName/:workspaceName/states/:stateVersionId  # State version detail

/app/:orgName/registry                        # Registry (org-scoped)
/app/:orgName/registry/modules/:moduleName/:provider
/app/:orgName/registry/providers
/app/:orgName/registry/providers/:providerName

/app/:orgName/usage                           # Usage metrics (org-scoped)
/app/:orgName/settings                        # Organization settings
/app/:orgName/settings/variable-sets
/app/:orgName/settings/vcs-connections
/app/:orgName/settings/users
/app/:orgName/settings/webhooks
/app/:orgName/settings/api-keys
/app/:orgName/settings/credentials            # Ansible credentials

# Ansible (org-scoped)
/app/:orgName/ansible/inventories
/app/:orgName/ansible/inventories/:inventoryId
/app/:orgName/ansible/jobs
/app/:orgName/ansible/jobs/:jobId
/app/:orgName/ansible/playbooks
/app/:orgName/ansible/playbooks/:playbookId
/app/:orgName/ansible/job-templates
/app/:orgName/ansible/job-templates/:templateId
/app/:orgName/ansible/schedules
/app/:orgName/ansible/collections
/app/:orgName/ansible/workflows

/settings                                     # User settings (global)
/settings/profile
/settings/security
/settings/api-keys
/settings/sessions
```

### Key Changes
- ✅ **Workspace-centric URLs**: Workspaces and runs live under `/app/:orgName/workspaces/...` (not under projects in the path). Projects have their own `/app/:orgName/projects` for management.
- ✅ **`/app/` prefix**: Matches TFE pattern (`https://tfe.example.com/app/org-name/workspaces/...`)
- ✅ **Organization in path**: All org-scoped resources include org name
- ✅ **Workspace-centric**: Workspaces are directly under organization

---

## Navigation Structure

### Top-Level Navigation

The navigation adapts based on context:

#### 1. Dashboard Context (`/dashboard`)
**Shown items:**
- Dashboard (active)
- Settings (user settings)
- Organizations

**Hidden items:**
- Workspaces
- Registry
- Usage
- Organization Settings

**Organization Selector:**
- Dropdown at top right
- "Choose an organization" placeholder
- Shows all organizations user has access to
- Selecting an org redirects to `/app/:orgName/workspaces`

#### 2. Organization Context (`/app/:orgName/*`)
**Shown items:**
- Dashboard (org-scoped)
- Projects (logical grouping for workspaces)
- Workspaces
- Registry
- Usage
- Settings (org settings submenu)

**Organization Selector:**
- Always visible in header/navbar
- Shows current organization
- Dropdown to switch organizations
- "Manage Organizations" option

### Sidebar Navigation Structure

**Updated Design:**
- Remove "ADMINISTRATION" section header
- Remove "Providers" from navigation (can be accessed via Registry if needed)
- Settings moved under CORE section
- Simplified, cleaner navigation structure

```
┌─────────────────────────────┐
│  Stackweaver                │
├─────────────────────────────┤
│  CORE                       │
│  • Dashboard                │
│  • Projects                 │  (org-scoped, logical grouping)
│  • Workspaces               │  (org-scoped)
│  • Registry                 │  (org-scoped)
│  • Usage                    │  (org-scoped)
│  • Settings                 │  (context-aware)
│                             │
│  Organizations              │
│  ▼ org-name                 │  (current org, handled by top bar selector)
│    • example                │
│    Manage Organizations     │
└─────────────────────────────┘
```

---

## Dashboard Behavior

### Global Dashboard (`/dashboard`)

**When**: User is on `/dashboard` (no organization selected)

**Purpose**: Overview of all organizations user is part of

**Content:**
- Summary cards across all orgs:
  - Total Projects
  - Total Workspaces
  - Active Runs
  - Completed Runs (this month)
- Recent Activity (across all orgs)
- Organization Cards:
  - Quick stats per organization
  - Link to org dashboard
- Quick Actions:
  - Create Organization
  - View All Organizations

**Navigation:**
- Only shows: Dashboard, Settings, Organizations

### Organization Dashboard (`/app/:orgName`)

**When**: Organization is selected (redirects to `/app/:orgName/workspaces`)

**Actually**: Workspace list serves as the org dashboard, showing:
- Summary cards for the organization:
  - Projects count
  - Workspaces count
  - Active Runs
  - Completed Runs (this month)
- Workspace list with filters
- Recent Activity (org-scoped)

**Future Enhancement**: Dedicated `/app/:orgName` dashboard page could show:
- Organization overview
- Resource breakdown
- Cost metrics
- Team activity

---

## Organization Selector Component

### Design (TFE-Inspired)

```
┌─────────────────────────────────────┐
│  [Stackweaver Logo]                 │
│                                     │
│  [Organization Selector ▼]          │
│  ┌───────────────────────────────┐ │
│  │ 🏢 engie-bnl-ms          ✓   │ │
│  └───────────────────────────────┘ │
│                                     │
│  [Help] [User] [Theme] [Logout]    │
└─────────────────────────────────────┘
```

**Features:**
- Dropdown selector in top navbar
- Shows current organization
- Checkmark on selected org
- "Manage Organizations" link
- Keyboard navigation
- Search/filter for many orgs

**Behavior:**
- Selecting an org navigates to `/app/:orgName/workspaces`
- Persists selection in localStorage
- Context persists across navigation

---

## JSON:API Format Adoption

### Current State

**Backend**: Returns JSON:API format
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "workspaces",
      "attributes": {
        "name": "...",
        "terraform-version": "...",
        ...
      },
      "relationships": {
        "project": {
          "data": {
            "id": "uuid",
            "type": "projects"
          }
        }
      }
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 100
    }
  }
}
```

**Frontend**: Translates to flat format
```typescript
interface Workspace {
  id: string;
  name: string;
  terraform_version?: string;
  project_id: string;
  ...
}
```

### New State (V2)

**Frontend**: Uses JSON:API format directly

```typescript
interface JsonApiResource {
  id: string;
  type: string;
  attributes: Record<string, any>;
  relationships?: Record<string, JsonApiRelationship>;
}

interface JsonApiRelationship {
  data: JsonApiResourceIdentifier | JsonApiResourceIdentifier[];
  links?: Record<string, string>;
}

interface JsonApiResourceIdentifier {
  id: string;
  type: string;
}
```

### Helper Functions

Create utility functions to work with JSON:API:

```typescript
// Extract attributes from JSON:API resource
export function getAttributes(resource: JsonApiResource): Record<string, any>

// Extract relationship
export function getRelationship(resource: JsonApiResource, name: string): JsonApiResourceIdentifier | null

// Transform resource to flat format (only when needed)
export function flattenResource(resource: JsonApiResource): any
```

### API Client Updates

Update API client to work with JSON:API natively:

```typescript
export const workspacesApi = {
  list: (orgName: string) => 
    apiClient.get<JsonApiResponse<JsonApiResource[]>>(
      `/organizations/${orgName}/workspaces`
    ),
  
  get: (orgName: string, workspaceName: string) =>
    apiClient.get<JsonApiResponse<JsonApiResource>>(
      `/organizations/${orgName}/workspaces/${workspaceName}`
    ),
};
```

---

## Component Structure

### New Components Needed

1. **OrganizationSelector**
   - Dropdown component for org selection
   - Persists selection
   - Handles navigation

2. **ContextualSidebar**
   - Adapts based on route
   - Shows/hides org-scoped items
   - Organization section at bottom

3. **OrganizationContext**
   - React context for current organization
   - Provides org state throughout app
   - Handles org switching

4. **DashboardView** (Enhanced)
   - Context-aware dashboard
   - Global vs org-scoped views

### Updated Components

1. **Layout**
   - Organization selector in navbar
   - Contextual sidebar rendering
   - Route-based navigation filtering

2. **App Router**
   - New route structure
   - Organization parameter handling
   - Redirects for legacy routes

---

## Routing Implementation

### Route Definitions

```typescript
// Global routes (no org context)
<Route path="/dashboard" element={<DashboardView />} />
<Route path="/organizations" element={<OrganizationsPage />} />
<Route path="/organizations/:orgName" element={<OrganizationDetailPage />} />
<Route path="/settings/*" element={<UserSettings />} />

// Organization-scoped routes
<Route path="/app/:orgName/projects" element={<ProjectsPage />} />
<Route path="/app/:orgName/projects/:projectName" element={<ProjectDetailPage />} />
<Route path="/app/:orgName/workspaces" element={<WorkspacesPage />} />
<Route path="/app/:orgName/workspaces/:workspaceName" element={<WorkspaceDetailPage />} />
<Route path="/app/:orgName/workspaces/:workspaceName/runs/:runId" element={<RunDetailPage />} />
<Route path="/app/:orgName/registry" element={<RegistryPage />} />
<Route path="/app/:orgName/registry/modules/:moduleName/:provider" element={<ModuleDetailPage />} />
<Route path="/app/:orgName/registry/providers" element={<ProviderListPage />} />
<Route path="/app/:orgName/registry/providers/:providerName" element={<ProviderDetailPage />} />
<Route path="/app/:orgName/usage" element={<UsagePage />} />
<Route path="/app/:orgName/settings" element={<OrganizationSettings />} />
<Route path="/app/:orgName/settings/variable-sets" element={<VariableSets />} />
<Route path="/app/:orgName/settings/vcs-connections" element={<VCSConnections />} />
<Route path="/app/:orgName/settings/users" element={<UsersSettings />} />
<Route path="/app/:orgName/settings/webhooks" element={<Webhooks />} />
<Route path="/app/:orgName/settings/api-keys" element={<ApiKeysSettings />} />
<Route path="/app/:orgName/settings/credentials" element={<AnsibleCredentials />} />
<Route path="/app/:orgName/ansible/inventories" element={<AnsibleInventories />} />
<Route path="/app/:orgName/ansible/inventories/:inventoryId" element={<AnsibleInventoryDetail />} />
<Route path="/app/:orgName/ansible/jobs" element={<AnsibleJobs />} />
<Route path="/app/:orgName/ansible/jobs/:jobId" element={<AnsibleJobDetail />} />
<Route path="/app/:orgName/ansible/playbooks" element={<AnsiblePlaybooks />} />
<Route path="/app/:orgName/ansible/playbooks/:playbookId" element={<AnsiblePlaybookDetail />} />
<Route path="/app/:orgName/ansible/job-templates" element={<AnsibleJobTemplates />} />
<Route path="/app/:orgName/ansible/job-templates/:templateId" element={<AnsibleJobTemplateDetail />} />
<Route path="/app/:orgName/ansible/schedules" element={<AnsibleSchedules />} />
<Route path="/app/:orgName/ansible/collections" element={<AnsibleCollections />} />
<Route path="/app/:orgName/ansible/workflows" element={<AnsibleWorkflows />} />

// TFE-compatible run routes
<Route path="/app/:orgName/workspaces/:workspaceName/runs/:runId" element={<RunDetailPage />} />
<Route path="/app/:orgName/:workspaceName/runs/:runId" element={<RunDetailPage />} />
<Route path="/app/:org/:workspace/runs/:id" element={<RunDetailPage />} />
<Route path="/app/:orgName/:workspaceName/states/:stateVersionId" element={<StateVersionDetail />} />
```

### Route Guards

```typescript
// Ensure organization exists and user has access
function OrganizationGuard({ children }) {
  const { orgName } = useParams();
  const { organizations } = useOrganizations();
  
  if (!orgName || !organizations.some(o => o.name === orgName)) {
    return <Navigate to="/organizations" />;
  }
  
  return children;
}
```

---

## State Management

### Organization Context

```typescript
interface OrganizationContextType {
  currentOrg: Organization | null;
  organizations: Organization[];
  setCurrentOrg: (org: Organization | null) => void;
  switchOrganization: (orgName: string) => void;
  hasAccess: (orgName: string) => boolean;
}

export const OrganizationProvider: React.FC = ({ children }) => {
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  
  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('currentOrganization');
    if (saved) {
      const org = organizations.find(o => o.name === saved);
      if (org) setCurrentOrg(org);
    }
  }, [organizations]);
  
  // Persist to localStorage
  useEffect(() => {
    if (currentOrg) {
      localStorage.setItem('currentOrganization', currentOrg.name);
    }
  }, [currentOrg]);
  
  const switchOrganization = (orgName: string) => {
    const org = organizations.find(o => o.name === orgName);
    if (org) {
      setCurrentOrg(org);
      navigate(`/app/${orgName}/workspaces`);
    }
  };
  
  return (
    <OrganizationContext.Provider value={{...}}>
      {children}
    </OrganizationContext.Provider>
  );
};
```

---

## Migration Plan

### Phase 1: Foundation ✅ COMPLETED
1. ✅ Create `OrganizationContext` provider
2. ✅ Implement `OrganizationSelector` component
3. ✅ Update routing structure to `/app/:orgName/*` pattern
4. ✅ Create JSON:API helper utilities

### Phase 2: Navigation ✅ COMPLETED
1. ✅ Update `Layout` component with org selector
2. ✅ Create contextual sidebar component (removed ADMINISTRATION, moved Settings to CORE)
3. ✅ Update route guards (`OrganizationGuard`)
4. ✅ Implement navigation filtering based on route context

### Phase 3: Pages Migration ✅ COMPLETED
1. ✅ Update Dashboard (global + org-scoped views) - Added organization cards, updated quick actions to use new URLs
2. ✅ Migrate Workspaces page to new URL structure - Already supports `/app/:orgName/workspaces`
3. ✅ Migrate Registry page to `/app/:orgName/registry` - Updated to use orgName from URL params
4. ✅ Migrate Usage page to `/app/:orgName/usage` - Updated to use orgName from URL params
5. ✅ Update Settings pages for org-scoped context - Updated Settings page to link to new org-scoped routes
6. ✅ Add Projects page as org-scoped logical grouping - Added `/app/:orgName/projects` route and sidebar navigation
7. ✅ Fix ProviderList and ProviderPublish to use orgName parameter

### Phase 4: JSON:API Adoption ✅ MOSTLY COMPLETE
**Note**: Full JSON:API adoption - pages use JSON:API format via helper functions. API client returns `JsonApiResponse<JsonApiResource>`; components use `getRunFromJsonApi()`, `getAnsibleJobFromJsonApi()`, `getAttribute()` from `@/utils/jsonapi` and `@/utils/ansible-jsonapi`.

**Current State**:
- Backend: Returns JSON:API format ✅
- API Client: Returns `JsonApiResponse<JsonApiResource>`; runs/Ansible use helpers ✅
- Pages using JSON:API helpers: Workspaces, WorkspaceDetail, RunDetail, Usage, Ansible JobDetail, JobTemplateDetail ✅
- Registry: Uses API client; may use `?format=simple` or other; no `getAttribute` in Registry pages

**Migration Progress**:
1. ✅ JSON:API helpers (`utils/jsonapi.ts`, `utils/ansible-jsonapi.ts`): `getRunStatus()`, `getRunOperation()`, `getRunFromJsonApi()`, `getAttribute()`, `getRelationship()`, `getAnsibleJobFromJsonApi()`, and other Ansible helpers
2. ✅ `runsApi` returns JSON:API; `getRunFromJsonApi()` in RunDetail, WorkspaceDetail, Workspaces, Usage, `useRunPolling`
3. ✅ Workspaces: `getRunStatus()`, `getRunOperation()`, `getAttribute()` for runs and workspaces
4. ✅ WorkspaceDetail: `getRunFromJsonApi()` for runs
5. ✅ RunDetail, Usage: `getRunFromJsonApi()`, `getAnsibleJobFromJsonApi()`
6. ⏳ Registry: continues to work; optional migration to JSON:API helpers for new features
7. ⏳ Remaining pages: adopt helpers as touched

**Critical Requirements**:
- ✅ Run status logic (`status`, `operation`, `plan_only`, `permissions['can-apply']`)
- ✅ Plan vs Plan-and-Apply distinction
- ✅ Registry works

### Phase 5: Polish
1. ✅ Update design documentation with latest changes
2. ✅ Discard functionality for plan runs (Plan and Apply in `planned` status; `POST /api/v2/runs/:id/actions/discard`; RunDetail + UnifiedPhaseTimeline)
3. ⏳ Testing and bug fixes
4. ⏳ Webhook debugging and fixes

---

## API Changes Required

### Backend (Minor)

**Current**: Backend already uses JSON:API ✅

**Optional Enhancements:**
1. Ensure all endpoints return consistent JSON:API format
2. Add `?format=simple` support where needed (already exists for workspaces)
3. Ensure organization name validation in paths

### Frontend API Client

**Changes Needed:**
1. Remove all transformation functions
2. Update type definitions to JSON:API
3. Update response handling
4. Create helper utilities for JSON:API

---

## URL Migration & Redirects

### Legacy Route Redirects

```typescript
// Old routes redirect to new structure
<Route path="/organizations/:orgName/workspaces" 
  element={<Navigate to="/app/:orgName/workspaces" replace />} />

<Route path="/organizations/:orgName/workspaces/:workspaceName"
  element={<Navigate to="/app/:orgName/workspaces/:workspaceName" replace />} />

// TFE-compatible route already exists
<Route path="/app/:org/:workspace/runs/:id" element={<RunDetailPage />} />
```

---

## User Experience Flow

### New User Flow

1. **Login** → `/dashboard`
2. **See empty state**: "No organizations found"
3. **Click "Create Organization"** → `/organizations` (create form)
4. **Create org** → Redirect to `/app/:orgName/workspaces`
5. **Organization selected** → Navigation shows org-scoped items
6. **Create workspace** → Shows in workspace list

### Existing User Flow

1. **Login** → `/dashboard`
2. **See all orgs** → Summary cards
3. **Select organization** from dropdown → `/app/:orgName/workspaces`
4. **View workspaces** → Org-specific dashboard
5. **Navigate** → Registry, Usage, Settings (org-scoped)
6. **Switch org** → Selector updates, navigate to new org

---

## Testing Strategy

### Unit Tests
- Organization context provider
- JSON:API helper functions
- Route guards
- Navigation filtering logic

### Integration Tests
- Organization switching flow
- Route navigation
- URL parameter handling
- Context persistence

### E2E Tests
- Complete user flows
- Organization creation → workspace creation
- Org switching
- URL structure validation

---

## Documentation Updates

### Required Updates

1. **Frontend API Reference**
   - Update with JSON:API format
   - Remove transformation examples
   - Add JSON:API helper examples

2. **Architecture Documentation**
   - Update URL structure section
   - Document organization context
   - Navigation structure

3. **User Guide** (if exists)
   - Update screenshots
   - Update URL examples
   - Organization switching guide

---

## Rollback Plan

### Feature Flags

Use feature flags to gradually roll out:

```typescript
const useV2Routing = process.env.VITE_ENABLE_V2_ROUTING === 'true';
const useJsonApi = process.env.VITE_ENABLE_JSON_API === 'true';
```

### Dual Support

Initially support both URL structures:
- New routes work with V2
- Old routes redirect to new
- Gradual migration

---

## Success Metrics

### Technical
- ✅ All routes use new URL structure
- ✅ No translation layer in API client
- ✅ Organization context works correctly
- ✅ Navigation adapts to context

### User Experience
- ✅ URL structure matches Terraform CLI expectations
- ✅ Organization switching is intuitive
- ✅ Navigation is clear and contextual
- ✅ Dashboard provides useful overview

---

## Future Enhancements

1. **Projects UI**
   - Projects page (org-scoped)
   - Project management
   - Project-based filtering

2. **Teams & RBAC**
   - Team management page
   - Permission management
   - Role assignments

3. **Advanced Dashboard**
   - Customizable widgets
   - Saved views
   - Cross-org comparisons

4. **AWX Integration**
   - AWX metrics on dashboard
   - Ansible job tracking
   - Unified activity feed

---

## Appendix

### JSON:API Resource Examples

**Organization:**
```json
{
  "data": {
    "id": "uuid",
    "type": "organizations",
    "attributes": {
      "name": "engie-bnl-ms",
      "description": "...",
      "created-at": "2024-01-01T00:00:00Z",
      "updated-at": "2024-01-01T00:00:00Z"
    }
  }
}
```

**Workspace:**
```json
{
  "data": {
    "id": "uuid",
    "type": "workspaces",
    "attributes": {
      "name": "production",
      "terraform-version": "1.6.0",
      "auto-apply": false,
      "execution-mode": "remote",
      "created-at": "2024-01-01T00:00:00Z"
    },
    "relationships": {
      "project": {
        "data": {
          "id": "uuid",
          "type": "projects"
        }
      }
    }
  }
}
```

---

## References

- [Terraform Enterprise API Documentation](https://developer.hashicorp.com/terraform/enterprise/api-docs)
- [JSON:API Specification](https://jsonapi.org/)
- [Frontend API Reference](../api-reference/frontend-api-reference.md)
- [Backend API Reference](../api-reference/backend-api-reference.md)

---

## Implementation Notes

### Ansible API Pattern Alignment

The Ansible API layer has been refactored to match the Terraform API pattern for consistency:

#### Pattern Description

**Before (Ansible-specific pattern):**
```typescript
// API layer did parsing internally
export const ansibleJobsApi = {
  get: (id: string) =>
    apiClient.get<{ data: JsonApiResource }>(`/ansible/jobs/${id}`)
      .then(res => parseJobFromJsonApi(res.data)), // Parsed to flat object

  list: (orgName: string) =>
    apiClient.get<{ data: JsonApiResource[] }>(`/organizations/${orgName}/ansible/jobs`)
      .then(res => ({
        data: res.data.map(parseJobFromJsonApi), // Parsed to flat objects
        meta: res.meta,
      })),
};

// Component received flat object directly
const job = await ansibleJobsApi.get(jobId);
console.log(job.name); // Direct property access
```

**After (Terraform-compatible pattern):**
```typescript
// API layer returns raw JSON:API format
export const ansibleJobsApi = {
  get: (id: string) =>
    apiClient.get<JsonApiResponse<JsonApiResource>>(`/ansible/jobs/${id}`),

  list: (orgName: string) =>
    apiClient.get<JsonApiListResponse<JsonApiResource>>(
      `/organizations/${orgName}/ansible/jobs`
    ),
};

// Component uses helper functions from @/utils/jsonapi
import { getAnsibleJobFromJsonApi } from '@/utils/jsonapi';

const response = await ansibleJobsApi.get(jobId);
const job = getAnsibleJobFromJsonApi(response.data);
console.log(job.name); // Flat object from helper
```

#### Helper Functions in `@/utils/jsonapi`

| Function | Description |
|----------|-------------|
| `getAnsibleJobFromJsonApi` | Transform JSON:API resource to flat AnsibleJob |
| `getAnsiblePlaybookFromJsonApi` | Transform JSON:API resource to flat AnsiblePlaybook |
| `getAnsibleInventoryFromJsonApi` | Transform JSON:API resource to flat AnsibleInventory |
| `getAnsibleCredentialFromJsonApi` | Transform JSON:API resource to flat AnsibleCredential |
| `getAnsibleJobTemplateFromJsonApi` | Transform JSON:API resource to flat AnsibleJobTemplate |
| `getAnsibleHostFromJsonApi` | Transform JSON:API resource to flat AnsibleInventoryHost |
| `getAnsibleGroupFromJsonApi` | Transform JSON:API resource to flat AnsibleInventoryGroup |
| `getAnsibleJobEventFromJsonApi` | Transform JSON:API resource to flat AnsibleJobEvent |
| `getRunFromJsonApi` | Transform JSON:API resource to flat Run (Terraform) |

#### Benefits

1. **Consistency**: Both Terraform and Ansible APIs follow the same pattern
2. **Flexibility**: Components can access raw JSON:API data when needed (e.g., relationships)
3. **Debugging**: Easier to see what the API actually returns
4. **Type Safety**: Explicit transformation keeps TypeScript types accurate
5. **Maintainability**: Single place to update attribute mapping (in helpers)

#### Usage Example

```typescript
// In a component
import { ansibleJobsApi } from '@/api/ansible';
import { getAnsibleJobFromJsonApi, getAnsiblePlaybookFromJsonApi } from '@/utils/jsonapi';

// Fetch job list
const response = await ansibleJobsApi.listByOrganization(orgName);
const jobs = (response.data || []).map(getAnsibleJobFromJsonApi);

// Fetch single job with related data
const jobResponse = await ansibleJobsApi.get(jobId);
const job = getAnsibleJobFromJsonApi(jobResponse.data);

// Access relationship ID directly if needed
const playbookId = job.playbook_id;
const playbookResponse = await ansiblePlaybooksApi.get(playbookId);
const playbook = getAnsiblePlaybookFromJsonApi(playbookResponse.data);
```

---

**Document Version**: 1.2  
**Last Updated**: 2025-01  
**Status**: Updated - Routes (Ansible, settings), Phase 4/5 progress, discard implemented
