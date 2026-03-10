<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# API Architecture Design

Official References for TFE

- https://developer.hashicorp.com/terraform/enterprise/api-docs#feature-entitlements

## Executive Summary

This document outlines the API architecture for the IaC Orchestration Platform, which will support multiple automation tools (Terraform, Ansible, Kubernetes, etc.) while maintaining compatibility with Terraform Enterprise (TFE) provider where needed.

## Design Goals

1. **Multi-Tool Support**: Support Terraform, Ansible, and future automation tools
2. **TFE Compatibility**: Maintain compatibility with `terraform-provider-tfe` where applicable
3. **Flexibility**: Design for future growth and extensibility
4. **Consistency**: Unified API structure across all tools
5. **Simplicity**: Clean, intuitive API design

---

## API Versioning Strategy

### Recommendation: **Unified v2 API with Tool-Specific Namespaces**

**Approach**: Migrate everything to `/api/v2/` with tool-specific prefixes where needed.

**Benefits**:
- ✅ Single API version to maintain
- ✅ Consistent structure across all tools
- ✅ TFE compatibility where needed (Terraform-specific endpoints)
- ✅ Clear separation of concerns (tool-specific vs. shared resources)
- ✅ Future-proof for new tools

**Structure**:
```
/api/v2/
  ├── organizations/          # Shared across all tools
  ├── projects/              # Shared across all tools
  ├── vcs-connections/       # Shared VCS integrations
  ├── terraform/              # Terraform-specific (TFE-compatible)
  │   ├── workspaces/
  │   ├── runs/
  │   ├── state-versions/
  │   └── variables/
  ├── ansible/                # Ansible-specific
  │   ├── playbooks/
  │   ├── inventories/
  │   └── executions/
  └── kubernetes/             # Future: Kubernetes-specific
      └── ...
```

---

## API Structure Design

### 1. Core Resources (Shared Across All Tools)

These resources are tool-agnostic and shared:

```
GET    /api/v2/organizations
POST   /api/v2/organizations
GET    /api/v2/organizations/:name
PATCH  /api/v2/organizations/:name
DELETE /api/v2/organizations/:name

GET    /api/v2/organizations/:name/projects
POST   /api/v2/organizations/:name/projects
GET    /api/v2/organizations/:name/projects/:name
PATCH  /api/v2/organizations/:name/projects/:name
DELETE /api/v2/organizations/:name/projects/:name

GET    /api/v2/organizations/:name/vcs-connections
POST   /api/v2/organizations/:name/vcs-connections
GET    /api/v2/vcs-connections/:id
DELETE /api/v2/vcs-connections/:id
GET    /api/v2/vcs-connections/:id/repositories
GET    /api/v2/vcs-connections/:id/repositories/:repo/branches
```

**Rationale**: Organizations and Projects are platform-level concepts that contain workspaces/playbooks/etc. from different tools.

---

### 2. Terraform-Specific Endpoints (TFE-Compatible)

For Terraform, we maintain TFE compatibility:

```
# TFE-Compatible Endpoints (terraform-provider-tfe expects these)
GET    /api/v2/organizations/:name/workspaces
POST   /api/v2/organizations/:name/workspaces
GET    /api/v2/organizations/:name/workspaces/:name
PATCH  /api/v2/organizations/:name/workspaces/:name
DELETE /api/v2/organizations/:name/workspaces/:name

POST   /api/v2/runs
GET    /api/v2/runs/:id
GET    /api/v2/runs/:id/plan
POST   /api/v2/runs/:id/actions/apply
POST   /api/v2/runs/:id/actions/cancel

GET    /api/v2/workspaces/:id/state-versions
POST   /api/v2/workspaces/:id/state-versions
GET    /api/v2/state-versions/:id

POST   /api/v2/workspaces/:id/vars
GET    /api/v2/workspaces/:id/vars
PATCH  /api/v2/workspaces/:id/vars/:variable_id
DELETE /api/v2/workspaces/:id/vars/:variable_id

# TFE Token Management
POST   /api/v2/tokens
GET    /api/v2/tokens
DELETE /api/v2/tokens/:id
```

**Note**: TFE uses organization name + workspace name (not IDs). We support both:
- `/api/v2/organizations/:name/workspaces/:name` (TFE-compatible, uses names)
- `/api/v2/terraform/workspaces/:id` (our internal API, uses UUIDs)

---

### 3. Ansible-Specific Endpoints (Implemented)

Ansible APIs are organization-scoped for list/create and by-ID for get/update/delete. Structure matches TFE-style patterns.

```
# Organization-scoped (list/create)
GET    /api/v2/organizations/:name/ansible/inventories
POST   /api/v2/organizations/:name/ansible/inventories
GET    /api/v2/organizations/:name/ansible/playbooks
POST   /api/v2/organizations/:name/ansible/playbooks
GET    /api/v2/organizations/:name/ansible/job-templates
POST   /api/v2/organizations/:name/ansible/job-templates
GET    /api/v2/organizations/:name/ansible/jobs
POST   /api/v2/organizations/:name/ansible/jobs
GET    /api/v2/organizations/:name/ansible/credentials
POST   /api/v2/organizations/:name/ansible/credentials
GET    /api/v2/organizations/:name/ansible/schedules
POST   /api/v2/organizations/:name/ansible/schedules
GET    /api/v2/organizations/:name/ansible/workflows
POST   /api/v2/organizations/:name/ansible/workflows

# By ID (get/update/delete, sub-resources)
GET/PATCH/DELETE  /api/v2/ansible/inventories/:id
GET/PATCH/DELETE  /api/v2/ansible/playbooks/:id
GET/PATCH/DELETE  /api/v2/ansible/job-templates/:id
GET/DELETE        /api/v2/ansible/jobs/:id
GET/PATCH/DELETE  /api/v2/ansible/credentials/:id
GET/PATCH/DELETE  /api/v2/ansible/schedules/:id
GET/PATCH/DELETE  /api/v2/ansible/workflows/:id
GET/PATCH/DELETE  /api/v2/ansible/hosts/:id
GET/PATCH/DELETE  /api/v2/ansible/groups/:id
GET/PATCH/DELETE  /api/v2/ansible/inventory-sources/:source_id
GET/PATCH/DELETE  /api/v2/ansible/workflow-nodes/:id
DELETE            /api/v2/ansible/workflow-edges/:id

# Jobs: cancel, relaunch, events, output
POST   /api/v2/ansible/jobs/:id/actions/cancel
POST   /api/v2/ansible/jobs/:id/actions/relaunch
GET    /api/v2/ansible/jobs/:id/events
GET    /api/v2/ansible/jobs/:id/output

# Project-scoped (backward compatibility)
GET    /api/v2/projects/:id/ansible/playbooks
GET    /api/v2/projects/:id/ansible/job-templates
GET    /api/v2/projects/:id/ansible/jobs

# Collections
GET    /api/v2/ansible/collections/pre-installed
GET    /api/v2/ansible/collections/search
GET    /api/v2/ansible/jobs/:id/collections
```

**Rationale**: 
- Organization-scoped list/create; by-ID for instance operations
- Jobs, playbooks, job-templates, inventories, credentials, schedules, workflows, hosts, groups, inventory-sources
- Collections and job outputs for execution support

---

## Recommended Structure: **Hybrid Approach**

### Core Principle: **Shared Resources + Tool-Specific Resources**

```
/api/v2/
  ├── organizations/              # Shared
  ├── projects/                  # Shared
  ├── vcs-connections/           # Shared
  │
  ├── varsets/:id                # Variable sets (TFE-compatible)
  ├── terraform/                 # Terraform (handlers: terraform/*.go)
  │   ├── workspaces/:id
  │   ├── runs/:id
  │   ├── state-versions/:id
  │   └── workspaces/:id/vars
  │
  └── ansible/                   # Ansible (handlers: ansible/*.go)
      ├── inventories/:id
      ├── playbooks/:id
      ├── jobs/:id
      ├── credentials/:id
      └── ...

# TFE-Compatible (for terraform-provider-tfe)
/api/v2/organizations/:name/workspaces/:name  # Uses names
/api/v2/runs/:id                              # Uses IDs
/api/v2/workspaces/:id/state-versions         # Uses IDs
```

**Why This Works**:
1. **Shared resources** (orgs, projects, VCS) at root level
2. **Tool-specific resources** in namespaces (`/terraform/`, `/ansible/`)
3. **TFE compatibility** via organization-scoped endpoints (uses names)
4. **Internal API** uses UUIDs for consistency

---

## URL Patterns Comparison

### Current v1 API:
```
/api/v1/organizations/:id
/api/v1/organizations/:id/projects/:project_id
/api/v1/projects/:project_id/workspaces/:id
/api/v1/workspaces/:workspace_id/runs/:id
```

### Proposed v2 API:
```
# Shared resources
/api/v2/organizations/:name                    # Use names (more RESTful)
/api/v2/organizations/:name/projects/:name

# Terraform (internal)
/api/v2/terraform/workspaces/:id
/api/v2/terraform/runs/:id

# Terraform (TFE-compatible)
/api/v2/organizations/:name/workspaces/:name  # TFE expects this
/api/v2/runs/:id                               # TFE expects this

# Ansible
/api/v2/ansible/playbooks/:id
/api/v2/ansible/executions/:id
```

---

## Authentication Strategy

### Why We Need Our Own TFE Token System

**Important**: We implement our own TFE token system (separate from Zitadel) because:

1. **TFE Compatibility Requirement**: 
   - Terraform Enterprise uses its own API token system (User API Tokens, Team Tokens, Organization Tokens)
   - `terraform-provider-tfe` expects TFE-style tokens, NOT OAuth tokens
   - TFE tokens are simple API tokens, not OAuth/JWT tokens

2. **Different Purposes**:
   - **Zitadel (OAuth/JWT)**: User authentication and authorization - "Who is the user?"
   - **TFE Tokens**: API access for automation tools - "API access for terraform-provider-tfe"
   - They serve different purposes and are not interchangeable

3. **TFE Token Characteristics**:
   - Simple bearer tokens (not JWTs)
   - Generated by users in the platform UI
   - Stored securely (hashed) in our database
   - Can have expiration dates
   - Tracked per user

**Conclusion**: We MUST implement our own TFE token system for full TFE compatibility. Zitadel handles user authentication, but TFE tokens are required for `terraform-provider-tfe` integration.

### Support Multiple Auth Methods:

1. **JWT from Zitadel** (Primary - for frontend)
   - `Authorization: Bearer <jwt-token>`
   - Used by frontend and internal API calls
   - Handles user authentication and identity

2. **TFE Token** (For terraform-provider-tfe)
   - `Authorization: Bearer <tfe-token>` (tokens prefixed with "tfe-")
   - Tokens generated in platform, stored per user
   - Compatible with TFE provider expectations
   - Required for `terraform-provider-tfe` to work

3. **API Keys** (Future - for CI/CD)
   - `X-API-Key: <key>`
   - For service accounts and automation

**Implementation**:
- Middleware checks TFE tokens first (if prefixed with "tfe-")
- Then checks JWT tokens (Zitadel)
- Finally checks API keys (future)
- All methods map to the same user context
- TFE tokens are hashed (SHA-256) before storage

---

## Response Format Standardization

### Standard Response Structure:

```json
{
  "data": { ... },           // Single resource
  "included": [ ... ],       // Related resources (optional)
  "meta": {                  // Metadata
    "pagination": { ... }
  },
  "links": {                 // HATEOAS links (optional)
    "self": "...",
    "next": "..."
  }
}
```

### List Response:

```json
{
  "data": [ ... ],           // Array of resources
  "meta": {
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 100
    }
  },
  "links": {
    "self": "/api/v2/organizations?page=1",
    "next": "/api/v2/organizations?page=2",
    "prev": null
  }
}
```

### Error Response:

```json
{
  "errors": [
    {
      "status": "422",
      "title": "Validation Error",
      "detail": "Name is required",
      "source": {
        "pointer": "/data/attributes/name"
      }
    }
  ]
}
```

---

## Pagination Strategy

### Support Multiple Pagination Styles:

1. **Offset-based** (Current, simple):
   ```
   ?page=1&per_page=20
   ?offset=0&limit=20
   ```

2. **Cursor-based** (Better for large datasets):
   ```
   ?cursor=abc123&limit=20
   ```

3. **TFE-style** (For compatibility):
   ```
   ?page[size]=20&page[number]=1
   ```

**Implementation**: Support all three, default to offset-based.

---

## Filtering & Querying

### Standard Query Parameters:

```
# Filtering
?filter[status]=pending,completed
?filter[workspace][name]=prod-*
?filter[created_at][gte]=2024-01-01

# Sorting
?sort=created_at
?sort=-name,created_at

# Field selection
?fields[workspace]=name,status
?include=project,organization

# Search
?search=terraform
```

---

## Migration Strategy

### Phase 1: Add v2 Endpoints (Parallel to v1)
- Implement v2 endpoints alongside v1
- Frontend continues using v1
- Test v2 endpoints

### Phase 2: Migrate Frontend to v2
- Update frontend to use v2 endpoints
- Keep v1 for backward compatibility (deprecated)

### Phase 3: Remove v1 (After sufficient testing)
- Remove v1 endpoints
- Update documentation

**Timeline**: 
- Phase 1: 2-3 weeks
- Phase 2: 1-2 weeks  
- Phase 3: After 1-2 months of v2 usage

---

## Implementation Plan

### Step 1: Design Core Models
- [ ] Review and finalize data models
- [ ] Design shared vs. tool-specific models
- [ ] Plan database schema

### Step 2: Implement Shared Resources
- [ ] Organizations API (v2)
- [ ] Projects API (v2)
- [ ] VCS Connections API (v2)

### Step 3: Implement Terraform Resources
- [ ] Workspaces API (v2, TFE-compatible)
- [ ] Runs API (v2, TFE-compatible)
- [ ] State Versions API (v2)
- [ ] Variables API (v2)

### Step 4: Implement Ansible Resources
- [ ] Playbooks API (v2)
- [ ] Inventories API (v2)
- [ ] Executions API (v2)

### Step 5: Frontend Migration
- [ ] Update API client to v2
- [ ] Update all frontend calls
- [ ] Test thoroughly

---

## Code Organization

### Backend Structure:

```
backend/internal/api/
  ├── v2/                      # v2 API handlers
  │   ├── handlers/
  │   │   ├── organizations.go
  │   │   ├── projects.go
  │   │   ├── vcs_connections.go
  │   │   ├── terraform/
  │   │   │   ├── workspaces.go
  │   │   │   ├── runs.go
  │   │   │   ├── state_versions.go
  │   │   │   ├── variables.go
  │   │   │   └── configuration_versions.go
  │   │   ├── variable_sets.go
  │   │   ├── tokens.go
  │   │   ├── vcs_app_installation.go
  │   │   └── ansible/
  │   │       ├── playbooks.go
  │   │       ├── inventories.go
  │   │       ├── jobs.go
  │   │       ├── credentials.go
  │   │       ├── schedules.go
  │   │       ├── workflows.go
  │   │       ├── collections.go
  │   │       └── ... (hosts, groups, inventory_sources, etc.)
  │   ├── routes/
  │   │   ├── routes.go
  │   │   └── ansible_routes.go
  │   └── response/
  │       └── response.go
  │
  └── (v1 group in main routes.go exists but unused; all APIs at /api/v2)
```

---

## TFE Compatibility Details

### What We Need to Match:

1. **URL Structure**: 
   - `/api/v2/organizations/:name/workspaces/:name` (not `/api/v2/workspaces/:id`)
   - Uses organization name + workspace name (not UUIDs)

2. **Response Format**:
   ```json
   {
     "data": {
       "id": "ws-abc123",
       "type": "workspaces",
       "attributes": { ... },
       "relationships": { ... }
     }
   }
   ```

3. **Pagination**:
   ```
   ?page[size]=20&page[number]=1
   ```

4. **Filtering**:
   ```
   ?filter[workspace][name]=prod-*
   ```

5. **Authentication**:
   - `Authorization: Bearer <token>`
   - Token format: TFE-style tokens (we generate these)

---

## Decision Matrix

| Approach | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **Unified v2** | Single version, consistent | TFE compatibility complexity | ✅ **Best for greenfield** |
| **Separate v2 for TFE** | Clear separation | Duplication, maintenance overhead | ❌ Not recommended |
| **Keep v1, add v2** | No breaking changes | Two versions to maintain | ⚠️ Temporary during migration |

**Final Recommendation**: **Unified v2 API with tool namespaces**

---

## Questions to Resolve

1. **Should we use names or UUIDs in URLs?**
   - **Recommendation**: Use names for organizations/projects (more RESTful), UUIDs for resources (workspaces, runs, etc.)
   - TFE compatibility requires names for workspaces in org-scoped endpoints

2. **How to handle tool-specific vs. shared resources?**
   - **Recommendation**: Shared at root (`/organizations`, `/projects`), tool-specific in namespaces (`/terraform/workspaces`, `/ansible/playbooks`)

3. **Should we support both name and ID lookups?**
   - **Recommendation**: Yes, for flexibility:
     - `/api/v2/organizations/:name` (by name)
     - `/api/v2/organizations/:id` (by UUID, internal)

4. **How to version the API going forward?**
   - **Recommendation**: Use header-based versioning (`Accept: application/vnd.api+json;version=2`) for future versions, URL versioning for major breaks

---

## Implementation Status

### ✅ Completed (Full Migration to v2)

1. ✅ **API Design Document** - Comprehensive design with TFE and Ansible compatibility
2. ✅ **Backend v2 API Implementation**:
   - ✅ Organizations API (v2) - uses names instead of IDs
     - `GET /api/v2/organizations` - List organizations
     - `POST /api/v2/organizations` - Create organization
     - `GET /api/v2/organizations/:name` - Get organization
     - `PATCH /api/v2/organizations/:name` - Update organization
     - `DELETE /api/v2/organizations/:name` - Delete organization
   - ✅ Projects API (v2) - uses names, nested under organizations
     - `GET /api/v2/organizations/:name/projects` - List projects
     - `POST /api/v2/organizations/:name/projects` - Create project
     - `GET /api/v2/organizations/:name/projects/:name` - Get project
     - `PATCH /api/v2/organizations/:name/projects/:name` - Update project
     - `DELETE /api/v2/organizations/:name/projects/:name` - Delete project
   - ✅ Terraform Workspaces API (v2) - TFE-compatible endpoints
     - `GET /api/v2/organizations/:name/workspaces` - List workspaces (TFE)
     - `POST /api/v2/organizations/:name/workspaces` - Create workspace (TFE)
     - `GET /api/v2/organizations/:name/workspaces/:name` - Get workspace (TFE)
     - `PATCH /api/v2/organizations/:name/workspaces/:name` - Update workspace (TFE)
     - `DELETE /api/v2/organizations/:name/workspaces/:name` - Delete workspace (TFE)
     - `GET /api/v2/terraform/workspaces/:id` - Get workspace by ID (internal)
   - ✅ Terraform Runs API (v2) - TFE-compatible endpoints
     - `POST /api/v2/runs` - Create run (TFE)
     - `GET /api/v2/runs/:id` - Get run (TFE)
     - `GET /api/v2/runs/:id/plan` - Get plan output (TFE)
     - `POST /api/v2/runs/:id/actions/apply` - Apply run (TFE)
     - `POST /api/v2/runs/:id/actions/cancel` - Cancel run (TFE)
     - `GET /api/v2/workspaces/:id/runs` - List runs by workspace
   - ✅ Repository methods for TFE compatibility
     - `GetByOrganizationAndName()` - Get workspace by org/workspace name
     - `ListByOrganization()` - List workspaces by organization name
   - ✅ All v2 routes configured and active
   - ✅ v1 API deprecated (minimal routes remain, see `backend/internal/api/routes/routes.go` - v1 group exists but mostly unused)
3. ✅ **Frontend Migration**:
   - ✅ API client updated to v2 endpoints (`/api/v2/`)
   - ✅ All pages updated to use names instead of IDs:
     - Organizations.tsx - uses organization names
     - OrganizationDetail.tsx - uses organization name
     - Projects.tsx - uses organization/project names
     - ProjectDetail.tsx - uses organization/project names
     - Workspaces.tsx - uses organization/workspace names
     - WorkspaceDetail.tsx - uses organization/workspace names, loads runs
     - RunDetail.tsx - uses run ID (TFE-compatible)
   - ✅ Routes updated in App.tsx to use names
   - ✅ Error handling updated for v2 error format (`{ errors: [{ detail: "..." }] }`)
   - ✅ Response format handling updated for v2 structure
4. ✅ **TFE Compatibility**:
   - ✅ `/api/v2/organizations/:name/workspaces/:name` endpoints (fully implemented)
   - ✅ `/api/v2/runs/:id` endpoints (fully implemented)
   - ✅ Response format matches TFE JSON:API structure
   - ✅ TFE-style pagination support (`page[size]`, `page[number]`)
   - ✅ Error format matches TFE structure
   - ✅ State Versions API (TFE-compatible) - fully implemented
   - ✅ Variables API (TFE-compatible) - fully implemented
   - ✅ TFE Token Authentication - middleware implemented
   - ✅ TFE Token Management API - fully implemented

### ⏭️ TODO / Future Work

1. ⏭️ **VCS Integration** (from TERRAFORM_CLOUD_WORKSPACE_FEATURES.md):
   - ⏭️ Configure GitHub as external IdP in Zitadel (via SDK or UI)
   - ⏭️ Implement VCS Connection model
   - ⏭️ Build OAuth flow to get GitHub tokens
   - ⏭️ Create workspace form with VCS selection
   - ⏭️ Repository/branch listing APIs
   - ⏭️ Webhook management

2. ✅ **TFE Token Authentication**:
   - ✅ TFE token model and repository implemented
   - ✅ Token generation with secure random tokens (prefixed with "tfe-")
   - ✅ Token hashing for secure storage (SHA-256)
   - ✅ Authentication middleware supports both JWT (Zitadel) and TFE tokens
   - ✅ TFE tokens checked first, then JWT tokens
   - ✅ Last used timestamp tracking
   - ✅ Token expiration support
   - ✅ Token management API: `POST /api/v2/tokens`, `GET /api/v2/tokens`, `DELETE /api/v2/tokens/:id`

3. ✅ **State Versions API** (TFE-compatible):
   - ✅ `GET /api/v2/workspaces/:id/state-versions` - List state versions for a workspace
   - ✅ `GET /api/v2/state-versions/:id` - Get state version by ID
   - ✅ `POST /api/v2/workspaces/:id/state-versions` - Create new state version
   - ✅ TFE-compatible response format with JSON:API structure
   - ✅ Automatic version numbering
   - ✅ Support for state data, serial, and lineage

4. ✅ **Variables API** (TFE-compatible; path uses `vars`):
   - ✅ `POST /api/v2/workspaces/:id/vars` - Create variable
   - ✅ `GET /api/v2/workspaces/:id/vars` - List variables for workspace
   - ✅ `PATCH /api/v2/workspaces/:id/vars/:variable_id` - Update variable
   - ✅ `DELETE /api/v2/workspaces/:id/vars/:variable_id` - Delete variable
   - ✅ TFE-compatible response format
   - ✅ Support for encrypted and sensitive variables
   - ✅ Key uniqueness validation per workspace

5. ✅ **Variable Sets API** (TFE-compatible; path uses `varsets`):
   - ✅ `GET/POST /api/v2/organizations/:name/varsets`
   - ✅ `GET/PATCH/DELETE /api/v2/varsets/:id`
   - ✅ `POST/DELETE /api/v2/varsets/:id/relationships/workspaces`
   - ✅ `POST/DELETE /api/v2/varsets/:id/relationships/projects`
   - ✅ `GET/POST/PATCH/DELETE /api/v2/varsets/:id/relationships/vars`

6. ✅ **Ansible Resources** (v2):
   - ✅ Inventories, hosts, groups, inventory-sources
   - ✅ Playbooks, job-templates, jobs (launch, cancel, relaunch, events, output)
   - ✅ Credentials, schedules, workflows (nodes, edges)
   - ✅ Collections (pre-installed, search, per-job)
   - ✅ Organization-scoped list/create; by-ID get/update/delete

7. ✅ **TFE Token Management API**:
   - ✅ `POST /api/v2/tokens` - Create new TFE token (returns plaintext token once)
   - ✅ `GET /api/v2/tokens` - List user's tokens (without plaintext)
   - ✅ `DELETE /api/v2/tokens/:id` - Delete token
   - ✅ Token description and expiration support
   - ✅ Secure token generation (prefixed with "tfe-")
   - ✅ Token hashing for storage (SHA-256)
   - ✅ User-scoped tokens (users can only manage their own tokens)
   - ✅ TFE-compatible response format

8. ⏭️ **Advanced Features**:
   - ⏭️ Workspace creation dialog/form (frontend)
   - ⏭️ Auto-queue runs on VCS push
   - ⏭️ Trigger patterns
   - ⏭️ Auto-apply configuration
   - ✅ Run list: `GET /api/v2/workspaces/:id/runs`

9. ⏭️ **Documentation**:
   - ⏭️ Create detailed API specification (OpenAPI/Swagger)
   - ⏭️ Update API documentation with v2 endpoints
   - ⏭️ Add TFE provider integration guide

---

## References

- [Terraform Enterprise API Documentation](https://developer.hashicorp.com/terraform/enterprise/api-docs)
- [JSON:API Specification](https://jsonapi.org/)
- [REST API Design Best Practices](https://restfulapi.net/)
- [Zitadel OIDC Integration](https://zitadel.com/docs/guides/integrate/login/oidc)

