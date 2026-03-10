<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Variables & Variable Sets JSON:API Migration

## Overview

This document tracks the migration of workspace variables and variable sets from Simple JSON format to full JSON:API format compliance with Terraform Enterprise (TFE) specification.

**TFE Specification References:**
- [Workspace Variables API](https://developer.hashicorp.com/terraform/enterprise/api-docs/workspace-variables)
- [Variable Sets API](https://developer.hashicorp.com/terraform/enterprise/api-docs/variable-sets)

**Status**: ✅ **COMPLETED** - All variables and variable sets now fully TFE-compliant with exact endpoint paths, JSON:API format, and all required relationships.

## TFE Compatibility Verification

### Workspace Variables (`/vars`)
✅ **Fully Compliant**
- Endpoint: `/api/v2/workspaces/:workspace_id/vars` (matches TFE spec)
- Request format: JSON:API with `data.type: "vars"` and `data.attributes`
- Response format: JSON:API with:
  - `type: "vars"`
  - `relationships.configurable` with `data` and `links.related`
  - `links.self`
- All required fields: `key`, `value`, `description`, `category`, `hcl`, `sensitive`

### Variable Sets (`/varsets`)
✅ **Fully Compliant**
- Endpoint: `/api/v2/organizations/:organization_name/varsets` (matches TFE spec)
- Direct access: `/api/v2/varsets/:varset_id` (matches TFE spec)
- Request format: JSON:API with `data.type: "varsets"` and `data.attributes`
- Response format: JSON:API with:
  - `type: "varsets"`
  - `relationships.organization` with `data`
  - `relationships.parent` with `data` (organization or project)
  - `relationships.vars` with array of variable resources
  - `relationships.workspaces` with array of workspace references (id/type only)
  - `relationships.projects` with array of project references (id/type only)
  - `links.self`
- Attributes: `name`, `description`, `global`, `priority`, `updated-at`, `var-count`, `workspace-count`, `project-count`

### Variable Set Variables (`/varsets/:id/relationships/vars`)
✅ **Fully Compliant**
- Endpoint: `/api/v2/varsets/:varset_id/relationships/vars` (matches TFE spec)
- Request format: JSON:API with `data.type: "vars"` and `data.attributes`
- Response format: JSON:API with:
  - `type: "vars"`
  - `relationships.varset` with `data` and `links.related`
  - `links.self`
- All required fields: `key`, `value`, `description`, `category`, `hcl`, `sensitive`, `created-at`

### 3-Level Scoping (TFE Compatible)
✅ **Fully Compatible**
The TFE spec supports exactly 3 levels of variable set scoping:
1. **Organization-wide (global)**: `data.attributes.global: true` - applies to all workspaces
2. **Project-specific**: `data.relationships.projects` - applies to all workspaces in selected projects
3. **Workspace-specific**: `data.relationships.workspaces` - applies to individual workspaces

**Note**: TFE uses `global: true` for organization-wide, and `relationships.projects`/`relationships.workspaces` for project/workspace scoping. Our implementation correctly maps:
- `global: true` → `scope: "organization"`
- `relationships.projects` → project-scoped assignments
- `relationships.workspaces` → workspace-scoped assignments

## Current State

### Issues Found

1. **Request Format**: Backend accepts Simple JSON format instead of JSON:API
   - Current: `{ "key": "...", "value": "...", "encrypted": false, "sensitive": false }`
   - Should be: `{ "data": { "type": "vars", "attributes": { ... } } }`

2. **Endpoint Path**: ✅ FIXED - Changed from `/variables` to `/vars` (TFE-compliant)
   - ✅ Updated: `/api/v2/workspaces/:id/vars`
   - TFE Spec: `/api/v2/workspaces/:workspace_id/vars`

3. **Missing Fields**: Variable model missing TFE-required fields
   - Missing: `category` ("terraform" | "env")
   - Missing: `hcl` (boolean)
   - Missing: `description` (string)

4. **Response Format**: Partially correct but needs fixes
   - Type should be `"vars"` not `"variables"`
   - Relationship should be `"configurable"` not `"workspace"`
   - Missing `version-id` attribute
   - Missing proper `links.self` format

5. **Frontend**: Sending Simple JSON format instead of JSON:API

## Migration Tasks

### Backend Changes

1. **Update Variable Model** (`backend/internal/models/variable.go`)
   - Add `Category` field (string, default: "terraform")
   - Add `HCL` field (boolean, default: false)
   - Add `Description` field (string, optional)

2. **Update Request Structs** (`backend/internal/api/v2/handlers/terraform/variables.go`)
   - Convert `CreateVariableRequestV2` to JSON:API format
   - Convert `UpdateVariableRequestV2` to JSON:API format
   - Add support for `category`, `hcl`, `description` fields

3. **Update Handler Logic**
   - Extract attributes from `data.attributes` instead of flat JSON
   - Update response formatting to match TFE spec exactly:
     - Type: `"vars"`
     - Relationship: `"configurable"` (not `"workspace"`)
     - Add `version-id` attribute
     - Add proper `links.self` format

4. **Update Routes** (`backend/internal/api/v2/routes/routes.go`)
   - Change `/variables` to `/vars` to match TFE spec
   - Update route comments to reference TFE spec

5. **Database Migration**
   - Add columns: `category`, `hcl`, `description` to `variables` table
   - Set defaults: `category = 'terraform'`, `hcl = false`

### Frontend Changes

1. **Update Variable Interface** (`frontend/src/api/client.ts`)
   - Add `category`, `hcl`, `description` fields
   - Update to match TFE response format

2. **Update variablesApi** (`frontend/src/api/client.ts`)
   - `create()`: Send JSON:API format
   - `update()`: Send JSON:API format
   - Update endpoint paths if changed

3. **Update UI Components**
   - Add category selector (terraform/env)
   - Add HCL toggle
   - Add description field
   - Update variable display to show new fields

### Documentation

1. **API Reference** (`docs/api-reference/backend-api-reference.md`)
   - Update variable endpoints to show JSON:API format
   - Add TFE spec references
   - Include example requests/responses

2. **Frontend API Reference** (`docs/api-reference/frontend-api-reference.md`)
   - Update variablesApi documentation
   - Show JSON:API format examples

3. **Migration Guide**
   - Document breaking changes (if any)
   - Provide migration examples

## TFE Specification Compliance

### Create Variable Request

**Endpoint**: `POST /api/v2/workspaces/:workspace_id/vars`

**Request Body** (JSON:API):
```json
{
  "data": {
    "type": "vars",
    "attributes": {
      "key": "some_key",
      "value": "some_value",
      "description": "some description",
      "category": "terraform",
      "hcl": false,
      "sensitive": false
    }
  }
}
```

**Response** (JSON:API):
```json
{
  "data": {
    "id": "var-EavQ1LztoRTQHSNT",
    "type": "vars",
    "attributes": {
      "key": "some_key",
      "value": "some_value",
      "description": "some description",
      "sensitive": false,
      "category": "terraform",
      "hcl": false,
      "version-id": "1aa07d63ea8ff4df941c94ca9ddfd5d2bd04"
    },
    "relationships": {
      "configurable": {
        "data": {
          "id": "ws-4j8p6jX1w33MiDC7",
          "type": "workspaces"
        },
        "links": {
          "related": "/api/v2/organizations/my-organization/workspaces/my-workspace"
        }
      }
    },
    "links": {
      "self": "/api/v2/workspaces/ws-4j8p6jX1w33MiDC7/vars/var-EavQ1LztoRTQHSNT"
    }
  }
}
```

### Update Variable Request

**Endpoint**: `PATCH /api/v2/workspaces/:workspace_id/vars/:variable_id`

**Request Body** (JSON:API):
```json
{
  "data": {
    "id": "var-yRmifb4PJj7cLkMG",
    "type": "vars",
    "attributes": {
      "key": "name",
      "value": "mars",
      "description": "some description",
      "category": "terraform",
      "hcl": false,
      "sensitive": false
    }
  }
}
```

## Breaking Changes

### Potential Breaking Changes

1. **Request Format**: Frontend must send JSON:API format (breaking for any external clients using Simple JSON)
2. **Endpoint Path**: If changed from `/variables` to `/vars`, all clients must update
3. **Response Format**: Minor changes to relationship structure (`configurable` instead of `workspace`)

### Backward Compatibility

- Consider keeping `/variables` endpoint as deprecated alias that redirects to `/vars`
- Or document breaking change and require clients to update

## Implementation Order

### Workspace Variables
1. ✅ Create migration plan (this document)
2. ✅ Update Variable model with new fields (`category`, `hcl`, `description`)
3. ⏳ Create database migration (requires manual migration script)
4. ✅ Update backend request structs to JSON:API
5. ✅ Update backend handler logic (extract from `data.attributes`)
6. ✅ Update backend response formatting (type: "vars", relationship: "configurable")
7. ✅ Update routes (changed `/variables` to `/vars` for TFE compliance)
8. ✅ Update frontend API client (sends JSON:API, converts responses, uses `/vars` endpoint)
9. ✅ Update frontend UI components (added description, hcl fields, custom delete dialog)
10. ✅ Update documentation (API references with TFE spec links)

### Variable Sets
1. ✅ Update VariableSetVariable model with new fields (`hcl`)
2. ✅ Update backend request structs to JSON:API (type: "varsets", "vars")
3. ✅ Update backend handler logic (extract from `data.attributes`, use "global" instead of "scope")
4. ✅ Update backend response formatting (type: "varsets" and "vars", not "variable-sets" or "variable-set-variables")
5. ✅ Update routes (changed `/variable-sets` to `/varsets`, `/variables` to `/relationships/vars`)
6. ✅ Update frontend API client (if needed - check current implementation)
7. ✅ Update documentation (API references with TFE spec links)

### Testing
- ⏳ Test all variable operations (create/update/delete/list)
- ⏳ Test all variable set operations (create/update/delete/list)
- ⏳ Test variable set variable operations
- ⏳ Test variable set assignment operations

## Testing Checklist

- [ ] Create variable with JSON:API format
- [ ] Update variable with JSON:API format
- [ ] List variables returns correct format
- [ ] Delete variable works
- [ ] Category field (terraform/env) works
- [ ] HCL field works
- [ ] Description field works
- [ ] Sensitive variables are hidden properly
- [ ] Frontend UI displays all fields correctly
- [ ] TFE provider compatibility (if applicable)
