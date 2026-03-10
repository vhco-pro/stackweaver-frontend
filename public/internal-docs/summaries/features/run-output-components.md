<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Run Output Components Documentation

This document describes the components used for displaying Terraform plan and apply outputs in StackWeaver.

## Components

### OutputViewer

**Location**: `frontend/src/components/runs/OutputViewer.tsx`

Component for displaying Terraform plan outputs, including resource changes and data sources.

#### Features

- **Resource Changes Display**: Shows all resources with changes (add, change, delete, replace)
- **Data Sources Display**: Optional checkbox to show/hide data sources in the plan view
  - Data sources are identified by `mode === "data"` in the plan output
  - When enabled, data sources are displayed with a double-headed arrow icon (`ArrowLeftRight`) instead of action badges
  - Data sources are shown even if they have no changes (unlike managed resources which are filtered out)

#### Data Source Extraction

Data sources are extracted from Terraform plan output using a recursive module traversal approach:

- **Source Locations**: 
  - `planned_values.root_module` and its `child_modules`
  - `prior_state.values.root_module` and its `child_modules`
  - **Note**: `configuration.root_module` does NOT contain resources or child_modules in plan output

- **Implementation**: 
  - Uses `collectResourcesFromModule()` helper function to recursively traverse nested module structures
  - Handles data sources in modules (e.g., `module.proxmox_test.data.proxmox_virtual_environment_version.version`)
  - Data sources are identified by `mode === "data"` property

- **Visual Styling**: 
  - Matches managed resources (same background, border, font size)
  - Retains distinct color coding (orange for keys, green for strings)
  - Wrapped in styled container matching `ResourceDiffView` appearance

- **Value Display**: 
  - Data source values are extracted from `prior_state.values.root_module.resources` or `planned_values.root_module.resources`
  - Values shown as key-value pairs below the resource address (e.g., "version: 8.4.0, release: 8.4")
  - Users can expand data sources to see full details in the diff view

#### Resource Filtering

- **No-Op Filtering**: Resources with no changes (empty actions array or all "no-op" actions) are filtered out from display
- **Action Filtering**: Users can filter by action type (create, update, delete, replace)
- **Address Filtering**: Search/filter resources by address

#### Summary Display

- **Accurate Total Changes**: Total changes count is sum of add, change, destroy, and replace (not number of resources)
- **Replace Operations**: Resources with both `delete` and `create` actions are counted as `replace` (shown in orange)
- **Resource Changes Header**: Shows "Resource Changes ({count})" where count is actual resources with changes

### ApplyOutputViewer

**Location**: `frontend/src/components/runs/ApplyOutputViewer.tsx`

Component for displaying Terraform apply phase output with real-time resource status updates.

#### Features

- **Real-Time Resource Status**: Resources show status indicators that update as apply progresses
  - `pending`: Empty circle (waiting to be applied)
  - `applying`: Blue spinning circle (currently being applied)
  - `completed`: Green checkmark (successfully applied)
  - `failed`: Red X (application failed)

- **Error State Handling**: Improved resource error state transitions
  - Resources that produce errors now correctly transition from `applying` (blue) to `failed` (red) state
  - Uses fuzzy resource address matching to handle module prefix mismatches in error messages
  - Error messages are displayed on resource cards with failed status

#### Fuzzy Resource Address Matching

The `findMatchingResourceAddress()` helper function performs three-level matching to associate error messages with correct resource addresses:

1. **Exact Match**: `module.path.type.name` matches `module.path.type.name`
2. **Suffix Match**: `type.name` matches `module.path.type.name`
3. **Type-Name Match**: `type.name` matches any `*.type.name`

This handles cases where Terraform error messages contain partial addresses without module prefixes (e.g., `proxmox_virtual_environment_download_file.test_iso` vs `module.proxmox_test.proxmox_virtual_environment_download_file.test_iso`).

**Implementation**: See `findMatchingResourceAddress()` in `frontend/src/components/runs/ApplyOutputViewer.tsx:207-253`

#### Summary Badges

The summary section displays badges for:
- **Total Resources**: Total count of resources being applied
- **Added**: Resources successfully created (green badge)
- **Changed**: Resources successfully modified (blue badge)
- **Destroyed**: Resources successfully deleted (red badge)
- **Replaced**: Resources that were destroyed and recreated (orange badge)
- **Failed**: Resources that failed during apply (red badge with XCircle icon) ⭐ **New**

The failed badge:
- Displays count of resources that failed during apply (e.g., "1 added, 1 failed")
- Red badge with XCircle icon, matches styling of other summary badges
- Counted from resource status map after error parsing
- Shown only when `summary.failed > 0`

**Layout**: Added padding between resource cards and summary badges (`pt-4` on badges container) for better visual separation.

#### Resource Status Tracking

- **Status Map**: Uses `Map<string, 'pending' | 'applying' | 'completed' | 'failed'>` to track resource status
- **Error Parsing**: Parses Terraform error messages and updates resource status accordingly
- **Staged Resources**: All planned resources are shown immediately when apply phase starts, with status updating in real-time

## Related Documentation

- **TFE Workspace Design**: See `docs/architecture/design/TFE_WORKSPACE_DESIGN.md` for overall run output display architecture
- **Status Badge Unification**: See `docs/architecture/status/STATUS_BADGE_UNIFICATION.md` for status badge logic
- **Workspace Run UI Enhancement**: See `docs/terraform/workspace-run-ui-enhancement.md` for UI design details


