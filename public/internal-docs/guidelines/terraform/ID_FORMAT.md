<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# ID Format Standards

This document describes the ID format conventions used in StackWeaver's Terraform Enterprise (TFE) compatible API.

## Overview

StackWeaver uses two different ID formats depending on the resource type:

1. **TFE-Compatible Resources**: Use prefixed 16-character alphanumeric IDs (e.g., `ws-abc123xyz789...`)
2. **StackWeaver-Specific Resources**: Use standard UUIDs (36 characters)

## TFE-Compatible Resources (Prefixed IDs)

All Terraform Enterprise-specific resources use prefixed IDs to match TFE's format and ensure compatibility with TFE providers and tooling.

### Format

- **Pattern**: `{prefix}-{16-char-random}`
- **Total Length**: 19-25 characters (depending on prefix length)
- **Character Set**: Alphanumeric only (A-Z, a-z, 0-9) - no underscores or hyphens in the random part
- **Storage**: Stored directly in the database with prefix included

### Resource Types and Prefixes

| Resource Type | Prefix | Example | Database Column Type |
|--------------|--------|---------|---------------------|
| Workspace | `ws-` | `ws-abc123xyz789def0` | `varchar(20)` |
| Run | `run-` | `run-xyz789abc123def4` | `varchar(20)` |
| State Version | `sv-` | `sv-def456xyz789abc1` | `varchar(20)` |
| Configuration Version | `cv-` | `cv-ghi789jkl012mno3` | `varchar(20)` |
| Variable | `var-` | `var-pqr456stu789vwx0` | `varchar(20)` |
| Variable Set | `varset-` | `varset-yza123bcd456efg7` | `varchar(25)` |
| Variable Set Variable | `varsv-` | `varsv-hij789klm012nop4` | `varchar(20)` |

### Implementation

- **ID Generation**: See `backend/pkg/id/generator.go`
- **Model Hooks**: All TFE-compatible models have `BeforeCreate` hooks that automatically generate prefixed IDs
- **API Responses**: IDs are returned with prefixes in all JSON:API responses
- **Frontend Display**: IDs are displayed as-is (no additional prefixing needed)

### Why Prefixed IDs?

1. **TFE Compatibility**: Matches Terraform Enterprise's ID format exactly
2. **Easy Identification**: Prefixes make it immediately clear what resource type an ID refers to
3. **Provider Compatibility**: Some TFE providers may depend on the ID format
4. **User Experience**: Shorter, more readable IDs than UUIDs

## StackWeaver-Specific Resources (UUIDs)

Resources that are specific to StackWeaver (not part of TFE) continue to use standard UUIDs:

- **Organizations**: `uuid.UUID` (36 characters)
- **Projects**: `uuid.UUID` (36 characters)
- **Users**: `uuid.UUID` (36 characters)
- **API Keys**: `uuid.UUID` (36 characters)
- **VCS Connections**: `uuid.UUID` (36 characters)
- **Other StackWeaver-specific entities**: `uuid.UUID` (36 characters)

### Why UUIDs for StackWeaver Resources?

1. **No TFE Dependency**: These resources don't need to be compatible with TFE providers
2. **Standard Format**: UUIDs are a well-established standard for unique identifiers
3. **No Prefix Needed**: Since these aren't exposed to TFE tooling, prefixes aren't necessary
4. **Consistency**: Maintains consistency with existing StackWeaver infrastructure

## Migration

For information about migrating from UUIDs to prefixed IDs, see:
- **Migration Guide**: `docs/migration/16_CHAR_ID_MIGRATION.md`

## API Usage

### Example: Creating a Workspace

```json
POST /api/v2/organizations/{org_id}/workspaces
{
  "data": {
    "type": "workspaces",
    "attributes": {
      "name": "my-workspace"
    }
  }
}
```

**Response:**
```json
{
  "data": {
    "id": "ws-abc123xyz789def0",
    "type": "workspaces",
    "attributes": {
      "name": "my-workspace"
    }
  }
}
```

### Example: Creating a Run

```json
POST /api/v2/runs
{
  "data": {
    "type": "runs",
    "relationships": {
      "workspace": {
        "data": {
          "id": "ws-abc123xyz789def0",
          "type": "workspaces"
        }
      }
    }
  }
}
```

**Response:**
```json
{
  "data": {
    "id": "run-xyz789abc123def4",
    "type": "runs",
    "relationships": {
      "workspace": {
        "data": {
          "id": "ws-abc123xyz789def0",
          "type": "workspaces"
        }
      }
    }
  }
}
```

## References

- **TFE API Documentation**: https://developer.hashicorp.com/terraform/enterprise/api-docs
- **ID Generator Implementation**: `backend/pkg/id/generator.go`
- **Migration Guide**: `docs/migration/16_CHAR_ID_MIGRATION.md`


