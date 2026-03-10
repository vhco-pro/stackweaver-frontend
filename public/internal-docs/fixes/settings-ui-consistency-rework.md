# Settings UI Consistency Rework Plan

## Overview

The settings pages have accumulated several visual and structural inconsistencies. This plan documents every issue and specifies exactly what to change so that an implementer can work through it file-by-file.

---

## Reference Design (the "correct" pattern)

**Runners.tsx** (`frontend/src/pages/Settings/Runners.tsx`) and **AgentPools.tsx** (`frontend/src/pages/Settings/AgentPools.tsx`) are the gold-standard. All other settings pages with a "create/add" action button should match this pattern.

### Correct header structure

```
┌─────────────────────────────────────────────────────────────────┐
│ [← Back]  Title (gradient text, 3xl/4xl)     [Gradient Button] │
│           Subtitle (muted)                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Correct button design — gradient-border wrapper

```jsx
<div className="relative inline-flex rounded-xl bg-gradient-to-r from-{color}-500 via-{color}-500 to-{color}-500 p-[2px]">
  <Button
    variant="ghost"
    onClick={...}
    className="bg-white dark:bg-slate-950/80 dark:backdrop-blur-sm text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-950/90 border-0 whitespace-nowrap rounded-[calc(0.75rem-2px)] px-4 py-2"
  >
    <Plus className="h-4 w-4 mr-2" />
    Button Label
  </Button>
</div>
```

The gradient colors for the button wrapper should match the page's title gradient.

### Correct back button

```jsx
<Link to={orgName ? `/app/${orgName}/settings` : '/settings'}>
  <Button
    variant="ghost"
    size="icon"
    className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground"
    aria-label="Back to Settings"
  >
    <ArrowLeft className="h-5 w-5" />
  </Button>
</Link>
```

### Correct header title

```jsx
<h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-{color}-400 via-{color}-400 to-{color}-400 bg-clip-text text-transparent mb-2">
  Page Title
</h1>
<p className="text-muted-foreground">
  Description text
</p>
```

---

## Fix 1: Remove redundant organization selectors

### Problem
VCS Connections and Variable Sets have their own organization dropdown selector in the header. This is redundant because the organization is already selected at the top-level settings panel (i.e., orgName is in the URL: `/app/:orgName/settings/...`).

### Files to change

#### 1a. `frontend/src/pages/Settings/VCSConnections.tsx`

- **Remove the `<select>` element** (around lines 231–250) that renders the native org dropdown.
- **Remove associated state**: `selectedOrg` / `setSelectedOrg` state, the `organizations` fetch logic used solely for the selector.
- **Use `orgName` from `useParams()`** directly for all API calls instead of `selectedOrg`.
- The native `<select>` also uses inconsistent styling (not even shadcn/ui) — removal solves both problems.

#### 1b. `frontend/src/pages/Settings/VariableSets.tsx`

- **Remove the `<Select>` component** (around lines 591–605) that renders the shadcn org dropdown.
- **Remove the `handleOrgChange` handler** (around lines 192–194).
- **Remove**: `selectedOrg` / `setSelectedOrg` state, `organizations` fetch used for the selector.
- **Use `orgName` from `useParams()`** directly for all API calls instead of `selectedOrg`.
- Keep the gradient-border create button — it already follows the correct pattern.

---

## Fix 2: Update button designs to match the gradient-border pattern

### Problem
API Keys, Credentials, and OIDC Configurations all use plain `<Button>` (the default shadcn variant) for their create/add actions. They should use the gradient-border wrapper pattern seen in Runners and AgentPools.

### Files to change

#### 2a. `frontend/src/pages/Settings/ApiKeys.tsx`

**Current** (around lines 249–256):
```jsx
<Button
  onClick={() => setShowCreateForm(!showCreateForm)}
  className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
>
  <Plus className="h-4 w-4 mr-2" />
  Create API Key
</Button>
```

**Change to:**
```jsx
<div className="relative inline-flex rounded-xl bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 p-[2px]">
  <Button
    variant="ghost"
    onClick={() => setShowCreateForm(!showCreateForm)}
    className="bg-white dark:bg-slate-950/80 dark:backdrop-blur-sm text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-950/90 border-0 whitespace-nowrap rounded-[calc(0.75rem-2px)] px-4 py-2"
  >
    <Plus className="h-4 w-4 mr-2" />
    Create API Key
  </Button>
</div>
```

Note: The API Keys title gradient is `from-cyan-400 via-blue-400 to-cyan-400`, so the button gradient should match.

#### 2b. `frontend/src/pages/Ansible/Credentials.tsx`

**Current header** (around lines 623–637):
- Title uses `text-3xl font-bold tracking-tight` (NO gradient text)
- Button is a plain `<Button>` wrapped in `<DialogTrigger asChild>`

**Changes needed:**

1. **Update the header layout** to match the reference pattern (use `items-start` flex with the correct back-button pattern):
   - Change back button from bare `<Link>` with ArrowLeft icon to the full `<Button variant="ghost" size="icon" ...>` wrapper pattern
   - Change the layout from `flex-1 flex items-center justify-between` to the reference structure

2. **Update the title** to use gradient text:
```jsx
<h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400 bg-clip-text text-transparent mb-2">
  Credentials
</h1>
```
(Matching the amber/orange gradient from the settings card)

3. **Update the "New Credential" button** to use the gradient-border pattern:
```jsx
<div className="relative inline-flex rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 p-[2px]">
  <Button
    variant="ghost"
    onClick={() => setCreateDialogOpen(true)}
    className="bg-white dark:bg-slate-950/80 dark:backdrop-blur-sm text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-950/90 border-0 whitespace-nowrap rounded-[calc(0.75rem-2px)] px-4 py-2"
  >
    <Plus className="h-4 w-4 mr-2" />
    New Credential
  </Button>
</div>
```

Note: Since the button is currently inside `<DialogTrigger asChild>`, the dialog trigger approach must be changed. Use `onClick={() => setCreateDialogOpen(true)}` on the Button directly (like other pages do), and keep the `<Dialog>` component separate — not wrapping the trigger button. The `<Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>` should remain but the `<DialogTrigger>` wrapper should be removed from around the header button.

#### 2c. `frontend/src/pages/Settings/OIDCConfigurations.tsx`

**Current header** (around lines 141–166):
- Uses an icon badge (square with gradient bg + Shield icon) — non-standard
- Title is `text-2xl font-bold` (smaller than reference, no gradient)
- Back button is a bare `<Link>` with ArrowLeft (no Button wrapper)
- Create button is a plain `<Button>` with `className="gap-2"`

**Changes needed:**

1. **Update the entire header structure** to match the reference:
   - Replace bare `<Link>` back button with the standard `<Button variant="ghost" size="icon">` wrapper
   - Remove the icon badge `<div>` (the 10x10 square with gradient bg and Shield icon)
   - Update title to gradient text:
     ```jsx
     <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-sky-400 via-blue-400 to-sky-400 bg-clip-text text-transparent mb-2">
       OIDC Configurations
     </h1>
     ```
   - Update layout to use `flex items-start gap-4` → `flex-1` → `flex items-start justify-between gap-4 mb-2`

2. **Update the "Add Azure OIDC" button** to use the gradient-border pattern:
```jsx
<div className="relative inline-flex rounded-xl bg-gradient-to-r from-sky-500 via-blue-500 to-sky-500 p-[2px]">
  <Button
    variant="ghost"
    onClick={() => { setCreateOpen(true); }}
    className="bg-white dark:bg-slate-950/80 dark:backdrop-blur-sm text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-950/90 border-0 whitespace-nowrap rounded-[calc(0.75rem-2px)] px-4 py-2"
  >
    <Plus className="h-4 w-4 mr-2" />
    Add Azure OIDC
  </Button>
</div>
```

---

## Fix 3: Users & Teams button styling and placement

### Problem
Two issues with `frontend/src/pages/Settings/Users.tsx`:

1. **Button is below the tab navigation bar** — The "Add User" and "Create Team" buttons are placed inside `<TabsContent>`, which renders below the `<TabsList>` (tab triggers). This creates confinement and an awkward layout where clicking the tab and then seeing the button below it feels disconnected. The user reports a visual issue where the button location is confusing.

2. **Plain button styling** — Both "Add User" and "Create Team" use the default `<Button>` variant with no gradient styling.

### Changes needed

#### 3a. Move the action button to the header area, next to the title

The header currently has no action button (around lines 204–222):
```jsx
<div className="flex items-center justify-between">
  <div className="flex items-center gap-4">
    <Link ...><ArrowLeft /></Link>
    <div>
      <h1 ...>Users & Teams</h1>
      <p ...>Manage organization members and teams</p>
    </div>
  </div>
  <!-- nothing on the right side -->
</div>
```

**Add a dynamic action button in the header** that changes based on which tab is active. This requires:

1. Convert `<Tabs defaultValue="users">` to a controlled component:
   ```jsx
   const [activeTab, setActiveTab] = useState('users');
   // ...
   <Tabs value={activeTab} onValueChange={setActiveTab}>
   ```

2. Add an action button in the header that responds to the active tab:
   ```jsx
   <div className="flex items-center justify-between">
     <div className="flex items-center gap-4">
       <!-- back button + title (existing) -->
     </div>
     <div className="relative inline-flex rounded-xl bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500 p-[2px]">
       <Button
         variant="ghost"
         onClick={() => {
           if (activeTab === 'users') {
             setShowAddDialog(true);
           } else {
             // Need to call the team creation handler
             // This requires lifting setShowCreateDialog state up or using a ref
           }
         }}
         className="bg-white dark:bg-slate-950/80 dark:backdrop-blur-sm text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-950/90 border-0 whitespace-nowrap rounded-[calc(0.75rem-2px)] px-4 py-2"
       >
         <Plus className="h-4 w-4 mr-2" />
         {activeTab === 'users' ? 'Add User' : 'Create Team'}
       </Button>
     </div>
   </div>
   ```

3. **Remove the existing buttons** from inside `<TabsContent>`:
   - Remove the `<div className="flex items-center justify-end">` + `<Button>` block from the "users" tab content (around line 232)
   - Remove the corresponding `<div className="flex items-center justify-end">` + `<Button>` block from the TeamsTab component (around line 741)

4. **State lifting for teams**: The "Create Team" dialog state (`showCreateDialog`) currently lives inside the `TeamsTab` component. To trigger it from the header, either:
   - **Option A (recommended):** Lift `showCreateDialog` state up to the parent `UsersPage` component and pass it as a prop to `TeamsTab`.
   - **Option B:** Use an imperative ref to trigger the dialog from outside.

#### 3b. Update back button to match reference pattern

Current back button (around lines 207–212) is a bare `<Link>` with inline ArrowLeft:
```jsx
<Link
  to={`/app/${orgName}/settings`}
  className="text-muted-foreground hover:text-foreground transition-colors"
>
  <ArrowLeft className="h-5 w-5" />
</Link>
```

**Change to** the standard pattern:
```jsx
<Link to={`/app/${orgName}/settings`}>
  <Button
    variant="ghost"
    size="icon"
    className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground"
    aria-label="Back to Settings"
  >
    <ArrowLeft className="h-5 w-5" />
  </Button>
</Link>
```

---

## Summary Table

| # | File | Issue | Fix |
|---|------|-------|-----|
| 1a | `frontend/src/pages/Settings/VCSConnections.tsx` | Redundant native `<select>` org selector | Remove selector, use `orgName` from URL |
| 1b | `frontend/src/pages/Settings/VariableSets.tsx` | Redundant shadcn `<Select>` org selector | Remove selector, use `orgName` from URL |
| 2a | `frontend/src/pages/Settings/ApiKeys.tsx` | Filled gradient button instead of gradient-border | Change to gradient-border wrapper pattern |
| 2b | `frontend/src/pages/Ansible/Credentials.tsx` | Plain button, no gradient title, inconsistent header layout | Update header, title gradient, gradient-border button |
| 2c | `frontend/src/pages/Settings/OIDCConfigurations.tsx` | Plain button, icon badge header, smaller title, no gradient text | Update header to reference pattern, gradient-border button |
| 3a | `frontend/src/pages/Settings/Users.tsx` | Action buttons inside TabsContent (below tabs), plain styling | Move button to header, make dynamic per tab, gradient-border style |
| 3b | `frontend/src/pages/Settings/Users.tsx` | Back button is bare `<Link>` not wrapped in `<Button>` | Use standard back button pattern |
| 4a | `frontend/src/pages/Settings/OIDCConfigurations.tsx` | OIDC card IDs hard-truncated at `max-w-[200px]` regardless of available space; no copy affordance | Remove fixed max-width, let grid column decide truncation, add copy icon buttons with `Check` feedback per field |
| 5a | `frontend/src/pages/Settings/TerraformVersions.tsx` | Plain header (no gradient title/button), back button not wrapped in `<Button>`, status uses custom `ToggleLeft`/`ToggleRight` icons instead of shadcn `Switch` | Apply standard gradient header (`from-emerald-500 via-teal-500`), gradient-border button, replace toggle with `<Switch>` |
| 5b | `backend/internal/api/v2/handlers/admin_terraform_versions.go` | `usage` field is a static stored int (always 0), never updated when workspaces change their version | Compute live usage counts in the `List` handler via a single `GROUP BY terraform_version` query on the workspaces table |

## Implementation order

1. **Fix 1a** — VCS Connections: remove org selector (isolated change)
2. **Fix 1b** — Variable Sets: remove org selector (isolated change)
3. **Fix 2a** — API Keys: update button design (small change)
4. **Fix 2c** — OIDC Configurations: update full header + button (medium change)
5. **Fix 2b** — Credentials: update full header + button + untangle DialogTrigger (medium change)
6. **Fix 3a+3b** — Users & Teams: restructure header, lift state, move buttons (largest change — do last)

## Gradient colors per page (for reference)

| Page | Title gradient | Button gradient |
|------|---------------|-----------------|
| Runners | `from-purple-400 via-pink-400 to-purple-400` | `from-purple-500 via-pink-500 to-purple-500` |
| Agent Pools | `from-teal-400 via-cyan-400 to-teal-400` | `from-teal-500 via-cyan-500 to-teal-500` |
| Variable Sets | `from-blue-400 via-indigo-400 to-blue-400` | `from-blue-500 via-indigo-500 to-blue-500` |
| API Keys | `from-cyan-400 via-blue-400 to-cyan-400` | `from-cyan-500 via-blue-500 to-cyan-500` (match title) |
| OIDC Config | `from-sky-400 via-blue-400 to-sky-400` (new) | `from-sky-500 via-blue-500 to-sky-500` |
| Credentials | `from-amber-400 via-orange-400 to-amber-400` (new) | `from-amber-500 via-orange-500 to-amber-500` |
| Users & Teams | `from-violet-400 via-indigo-400 to-blue-400` (existing) | `from-violet-500 via-indigo-500 to-blue-500` |
| Terraform Versions | `from-emerald-500 via-teal-500 to-emerald-500` | `from-emerald-500 via-teal-500 to-emerald-500` |
