<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Icon Color Guidelines

## Rule: Consistent Icon Colors Across the Platform

**CRITICAL:** All icons throughout the platform MUST use consistent, semantic colors based on their purpose. The ONLY exceptions are buttons, which should keep their default colors (typically black/white or the button's variant color).

## Color Standards

### Inventory & Host Icons
- **Hosts/Server icons**: `text-blue-500` (or `text-blue-600` in some contexts)
- **Groups/FolderTree icons**: `text-green-500` (or `text-green-600`)
- **Sources/Cloud icons**: `text-cyan-500` (or `text-cyan-600`)
- **Database (Static inventory)**: `text-orange-500`
- **GitBranch (VCS inventory)**: `text-purple-500`

### Status Icons
- **Success/OK**: `text-green-500` or `text-green-600`
- **Running**: `text-blue-500` or `text-blue-600`
- **Warning**: `text-yellow-500` or `text-yellow-600`
- **Error/Failed**: `text-red-500` or `text-red-600`
- **Skipped**: `text-gray-400`
- **Ignored**: `text-gray-600`

### Action Icons in Lists
- **External links**: `text-blue-500`
- **Info icons**: `text-blue-500`

## Button Icons Exception

**IMPORTANT:** Icons that are part of buttons (Button components) should NOT have explicit color classes. They should use the default button styling:
- Default buttons: Icons inherit button text color
- Variant buttons: Icons inherit the variant's text color
- Destructive buttons: Icons inherit destructive text color

Example:
```tsx
// ❌ WRONG - Don't add color to button icons
<Button>
  <Plus className="h-4 w-4 mr-2 text-blue-500" />
  Add Item
</Button>

// ✅ CORRECT - Let button handle icon color
<Button>
  <Plus className="h-4 w-4 mr-2" />
  Add Item
</Button>
```

## Empty State Icons

Empty state icons should use the same colors as their corresponding list/item icons:
- Empty hosts: `text-blue-500`
- Empty groups: `text-green-500`
- Empty sources: `text-cyan-500`
- Empty inventories: `text-orange-500`

## Where This Applies

- ✅ All list views (Inventories, Playbooks, Jobs, etc.)
- ✅ Detail views (Inventory Detail, Playbook Detail, Job Detail, etc.)
- ✅ Empty states
- ✅ Stats cards
- ✅ Header icons (resource type indicators)
- ✅ Status indicators

## Where This Does NOT Apply

- ❌ Icons inside Button components (let buttons handle their own styling)
- ❌ Icons that are part of input fields or form controls (unless they're semantic indicators)
- ❌ Loading spinners (use `text-muted-foreground` or inherit from parent)

## Implementation Notes

When adding new icons or updating existing ones:

1. **Check if the icon is in a Button component** - If yes, leave it without color classes
2. **Identify the icon's semantic purpose** - Host, group, status, etc.
3. **Apply the appropriate color from the standards above**
4. **Ensure consistency** - Use the same color for the same type of icon across all views

## Examples

```tsx
// ✅ Correct - Icon in a card/stat, has semantic color
<Card>
  <CardHeader>
    <Server className="h-4 w-4 text-blue-500" />
    Hosts
  </CardHeader>
</Card>

// ✅ Correct - Empty state icon with color
<Server className="h-12 w-12 text-blue-500 mb-4" />

// ✅ Correct - Button icon without color (button handles it)
<Button>
  <Plus className="h-4 w-4 mr-2" />
  Add Host
</Button>

// ❌ Wrong - Button icon with explicit color
<Button>
  <Plus className="h-4 w-4 mr-2 text-blue-500" />
  Add Host
</Button>

// ❌ Wrong - Semantic icon without color
<Server className="h-4 w-4 text-muted-foreground" />
```

