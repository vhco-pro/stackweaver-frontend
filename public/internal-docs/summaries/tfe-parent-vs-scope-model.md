<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# TFE Variable Set Model: Parent vs Scope

## Problem Statement

The initial implementation had both "Scope" and "Parent" as independent UI fields, which allowed invalid combinations like:
- Organization-wide scope + Project-owned parent (doesn't make sense)
- Confusing UX where users could set conflicting options

## TFE's Actual Model

Based on [TFE API documentation](https://developer.hashicorp.com/terraform/enterprise/api-docs/variable-sets):

### Parent (Ownership)
- **Definition**: Who owns/manages the variable set (organization or project)
- **Inference**: Parent is **inferred from creation context**, not explicitly chosen:
  - Creating from **organization settings** → Organization-owned
  - Creating from **project settings** → Project-owned (future feature)
- **Immutable**: Cannot be changed after creation (must delete and recreate)
- **Purpose**: Determines permissions and whether `global` is allowed

### Scope (Where it applies)
- **Definition**: Where the variable set applies within its parent context
- **Options** (TFE UI terminology):
  1. **"Apply to all projects and workspaces"** → `global: true`
     - Only available for organization-owned sets
     - Applies to all current and future workspaces in the organization
  2. **"Apply to specific projects and workspaces"** → `global: false`
     - Available for both organization-owned and project-owned sets
     - Requires explicit assignment to projects/workspaces

### Constraints
- **Project-owned variable sets CANNOT be global** (TFE requirement)
- **Global variable sets can only be organization-owned**
- **Parent cannot be changed** after creation

## Solution Implemented

### Frontend Changes

1. **Removed "Parent" field from UI**
   - Parent is always inferred as "organization-owned" when creating from organization settings
   - Display ownership in manage dialog as read-only information
   - Future: When project settings are added, variable sets created there will be project-owned by default

2. **Updated "Scope" to match TFE model**
   - Changed from dropdown to radio buttons matching TFE UI:
     - "Apply to all projects and workspaces" (global = true)
     - "Apply to specific projects and workspaces" (global = false)
   - Kept the colored explanation boxes (blue for global, purple for scoped)
   - Updated descriptions to match TFE terminology

3. **Form State**
   - Changed from `scope: 'organization' | 'workspace'` to `global: boolean`
   - Removed `parentType` and `parentId` from form state
   - Parent is always set to organization when creating from org settings

### Backend Changes

- Backend already validates: project-owned sets cannot be global
- Backend already enforces: parent cannot be changed after creation
- No changes needed - backend was already correct

### API Client Changes

- Always sends `parent: { type: 'organizations', id: organizationName }` when creating from org settings
- Update API doesn't send parent (it cannot be changed)

## Future Enhancements

When project settings are added:
1. Variable sets created from project settings will be project-owned by default
2. Scope options will be limited (cannot be global for project-owned)
3. Parent will still be inferred from context, not user-selected

## References

- [TFE Variable Sets API](https://developer.hashicorp.com/terraform/enterprise/api-docs/variable-sets)
- [TFE Variable Sets Documentation](https://developer.hashicorp.com/terraform/enterprise/variables/managing-variables)
