<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Docs Viewer Implementation Plan

## Overview
Build a simple, self-contained documentation viewer that automatically indexes all markdown files in the `docs/` folder and displays them in a VitePress-like interface.

## Implementation Status

### ✅ Completed
- Build script (`scripts/build-docs-index.js`) - Copies docs and generates index
- Public navigation (`PublicNav` component) - Extracted from landing page
- Docs layout (`DocsLayout`) - Three-column layout with navigation
- Docs sidebar (`DocsSidebar`) - Tree navigation with active state
- Table of Contents (`TableOfContents`) - "On this page" section with scroll spy
- Docs Viewer (`DocsViewer`) - Core markdown rendering with syntax highlighting
- Docs Index (`DocsIndex`) - Landing page for docs
- Routes - Added to `App.tsx`
- Syntax highlighting - JSON (via `JsonSyntaxHighlighter`), YAML/Go/other (via Shiki)
- Tables - GitHub Flavored Markdown support via `remark-gfm`
- Code blocks - Full syntax highlighting support
- Mermaid diagrams (` ```mermaid `) - Rendered via `MermaidDiagram` in `frontend/src/components/docs/MermaidDiagram.tsx`
- HTML in markdown - Enabled via `rehype-raw` in `frontend/src/pages/Docs/DocsViewer.tsx`
  - `<details>/<summary>` collapsibles (GitHub-style) - Styled via custom `details`/`summary` renderers in `DocsViewer`
- Callout boxes - Rendered via `CalloutBox` in `frontend/src/components/docs/CalloutBox.tsx`

### ⚠️ In Progress / Partially Complete
- **Callout parsing polish** (`Step 6b`)
  - ✅ `CalloutBox` is wired up in `DocsViewer` blockquote rendering
  - ⚠️ `parseCallout` still contains debug logging and should be simplified/hardened (edge cases, nested formatting)
- **Docs typography polish**
  - ✅ Headings/body contrast updated in `frontend/src/index.css` (`.markdown-content`)
  - ⚠️ Needs a final consistency pass for tables/blockquote/etc.

### ❌ Not Started
- **Code Group Component Integration** (`Step 6a`)
  - ✅ Component exists (`CodeGroup.tsx`)
  - ❌ Not integrated into `DocsViewer.tsx` markdown rendering
- Error boundaries
- Mobile responsiveness testing
- Code group rendering testing

## Architecture

### Approach: Static Docs with Runtime Indexing

**Strategy**: Ephemeral copy to `public/docs` during build, fetched at runtime
- **Source of truth**: Docs remain in project root `docs/` folder
- **Ephemeral copy**: Build script copies docs to `public/docs/` on each build (overwrites previous copy)
- Build script generates `public/docs-index.json` for navigation tree
- Frontend fetches docs from `public/docs/` as static files (no backend needed)
- Simple, no backend dependencies
- **Important**: `public/docs/` is ephemeral - always edit files in root `docs/` folder
- **File Filtering**: Build script excludes internal and non-user-facing content.
  - **Primary rule**: `docs/internal/` is excluded entirely (see `DIR_IGNORE_PATTERNS` in `scripts/build-docs-index.js`).
  - Additional filename-based ignore rules exist for plans/research/status/etc. (see `FILE_IGNORE_PATTERNS` in `scripts/build-docs-index.js`).

The examples below describe the intent behind the ignore list (keep user-facing docs in the viewer):

  **Filename Patterns (case-insensitive)**:
  - `*-analysis.md` / `*_ANALYSIS.md` (e.g., `varset-verification-analysis.md`)
  - `*-plan.md` / `*_PLAN.md` / `*_plan.md` (e.g., `variable-expansion-plan.md`, `add_trivy_*.plan.md`)
  - `*implementation*.md` / `*IMPLEMENTATION*.md` (e.g., `github-pr-status-checks-implementation.md`)
  - `*-research.md` / `*_RESEARCH.md` (e.g., `variable-expansion-phase1-research.md`)
  - `*-sitrep.md` / `*_SITREP.md` (e.g., `TFE_ENDPOINT_COMPATIBILITY_SITREP.md`)
  - `*-status.md` / `*_STATUS.md` (e.g., `PHASE1_TEAMS_IMPLEMENTATION_STATUS.md`)
  - `*-checklist.md` / `*_CHECKLIST.md` (e.g., `phase3-verification-checklist.md`)
  - `*-audit.md` / `*_AUDIT.md` (e.g., `TFE_COMPATIBILITY_AUDIT.md`)
  - `*-summary.md` / `*_SUMMARY.md` (e.g., `workspace-run-ui-enhancement-summary.md`)
  - `*-issue.md` (e.g., `ansible-playbook-webhook-sync-issue.md`)
  - `*_old.md`, `*_v0.md`, `*_v1.md` (versioned/old files)
  - `TODO.md`, `random.md` (internal notes)

  **Directory Patterns**:
  - `internal/` - internal docs are grouped under internal and should be excluded.


  **Note**: The build script should have a configurable ignore list/patterns to easily adjust what gets excluded.

### Navigation & Header Strategy

**Recommendation: Reuse Landing Page Header Style**

Since docs are public-facing (like the landing page), we should reuse the landing page navigation for consistency and economy. This provides:

- ✅ Consistent branding and user experience
- ✅ Same theme toggle and navigation patterns
- ✅ Economical (reuse existing code)
- ✅ Familiar navigation for users coming from landing page

**Implementation Options**:

**Extract Shared Nav Component**
   - Extract landing page nav into `PublicNav.tsx` component
   - Use in both `Landing.tsx` and `DocsLayout.tsx`
   - Add "Docs" link to nav when on landing page
   - Keep "Home" link when in docs

**Nav Links for Docs Page**:
- Logo → Links to `/` (home/landing)
- Home → Links to `/` (landing page)
- Docs → Active/highlighted (current page)
- Overview → Links to `/#overview` (landing anchor)
- Install → Links to `/#install` (landing anchor)
- Features → Links to `/#features` (landing anchor)
- Theme Toggle → Same as landing
- Get Started → Same as landing (or "Dashboard" if logged in)

**Visual Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  PublicNav (reused from landing)                        │
│  [Logo] [Home] [Docs*] [Overview] [Install] [Features] │
│                                    [Theme] [Get Started]│
├──────────┬──────────────────────────────┬───────────────┤
│          │                              │               │
│ Docs     │  Main Content Area           │  Table of     │
│ Sidebar  │  (Markdown rendered here)   │  Contents     │
│ (Tree)   │                              │  (Headings)   │
│          │                              │               │
│ - setup/ │  # Documentation Title      │  - Title      │
│   - ...  │                              │  - Section 1   │
│ - api/   │  ## Section 1               │  - Section 2   │
│   - ...  │  Content...                 │    - Sub 2.1   │
│ - ...    │                              │               │
│          │  ## Section 2               │               │
│          │  ### Sub 2.1                │               │
│          │  Content...                 │               │
│          │                              │               │
└──────────┴──────────────────────────────┴───────────────┘
```

**Benefits of Reusing Landing Nav**:
1. **Consistency**: Users see familiar navigation
2. **Economy**: One component, two uses (landing + docs)
3. **Maintenance**: Update nav in one place
4. **Branding**: Consistent StackWeaver branding
5. **UX**: Easy navigation between landing and docs

### Components Needed

1. **Build Script** (`scripts/build-docs-index.js` or similar)
   - Scans root `docs/` folder
   - **Copies all docs to `public/docs/`** (ephemeral - overwrites on each build)
   - Generates `public/docs-index.json` with file tree structure
   - **Note**: `public/docs/` is ephemeral - source of truth is root `docs/` folder

2. **Docs Index Page** (`frontend/src/pages/Docs/DocsIndex.tsx`)
   - Landing page for docs (shows README.md or index)
   - Auto-indexed table of contents

3. **Docs Viewer Page** (`frontend/src/pages/Docs/DocsViewer.tsx`)
   - Renders individual markdown files
   - Sidebar navigation tree
   - Table of contents (extracted from headings)
   - Breadcrumbs

4. **Docs Navigation Sidebar** (`frontend/src/components/docs/DocsSidebar.tsx`)
   - Tree navigation of all docs
   - Expandable folders
   - Active state highlighting

5. **Table of Contents** (`frontend/src/components/docs/TableOfContents.tsx`)
   - Extracts headings from markdown
   - Anchor links to sections
   - Highlights active section on scroll

6. **Code Group Component** (`frontend/src/components/docs/CodeGroup.tsx`)
   - Renders tabbed code blocks
   - Groups multiple code blocks with tabs
   - Syntax highlighting for each tab

7. **Callout Box Component** (`frontend/src/components/docs/CalloutBox.tsx`)
   - Renders admonition/callout boxes
   - Supports NOTE, WARNING, TIP, IMPORTANT, CAUTION
   - Matches existing design system (blurry background, colored border)
   - Uses icons from `lucide-react`

## Implementation Steps

### Step 1: Create Build Script to Index Docs

**File**: `scripts/build-docs-index.ts` or `scripts/build-docs-index.js`

This script will:
1. Recursively scan root `docs/` folder
2. Find all `.md` files (and other assets like images)
3. **Filter out files** matching ignore patterns (analysis, plans, implementation, research, sitrep, status, checklists, audits, summaries, issues, old versions, TODO, etc.)
4. **Filter out directories** like `archive/`, `architecture/status/`, `architecture/analysis/`, `architecture/*/research/`, `architecture/*/plans/`, `architecture/*/implementation/`, `architecture/legacy/`, etc.
5. **Copy filtered files to `public/docs/`** (ephemeral copy - overwrites on each build)
6. Extract frontmatter (if present) for title/description
7. Build tree structure matching folder hierarchy (only for non-filtered files)
8. Generate `public/docs-index.json` with navigation tree
9. **Important**: `public/docs/` is ephemeral - always edit source files in root `docs/` folder

**Ignore Patterns Configuration**:
- Define ignore patterns as arrays of regex/glob patterns
- Support both filename patterns and directory patterns
- Allow special cases (e.g., always include `README.md` even in ignored directories)
- Configurable via config file or script constants

**Structure of `docs-index.json`**:
```json
{
  "tree": [
    {
      "type": "directory",
      "name": "setup",
      "path": "setup",
      "children": [
        {
          "type": "file",
          "name": "setup-guide.md",
          "path": "setup/setup-guide.md",
          "title": "Setup Guide",
          "description": "Complete guide to setting up the platform"
        }
      ]
    },
    {
      "type": "file",
      "name": "README.md",
      "path": "README.md",
      "title": "Documentation Index",
      "description": "Welcome to the documentation"
    }
  ],
  "flat": {
    "README.md": {
      "path": "README.md",
      "title": "Documentation Index",
      "description": "...",
      "type": "file"
    }
  }
}
```

### Step 2: Update Package.json Scripts

Add docs build step:
```json
{
  "scripts": {
    "build:docs": "node scripts/build-docs-index.js",
    "build": "npm run build:docs && tsc -b && vite build"
  }
}
```

### Step 3: Extract Shared Public Navigation

**File**: `frontend/src/components/navigation/PublicNav.tsx` (new)

Extract the landing page navigation into a reusable component:
- Logo + Stackweaver branding
- Navigation links (Overview, Install, Features, Docs)
- Theme toggle
- Get Started button
- Accepts props for active link highlighting
- Same styling as landing page nav

**Update**: `frontend/src/pages/Landing.tsx`
- Replace inline nav with `<PublicNav activeLink="home" />`

### Step 4: Create Docs Layout Component

**File**: `frontend/src/components/docs/DocsLayout.tsx`

Three-column layout with public nav:
- Top: PublicNav component (with "Docs" as active)
- Left: Sidebar navigation (tree)
- Center: Main content area
- Right: Table of contents

### Step 5: Create Docs Navigation Sidebar

**File**: `frontend/src/components/docs/DocsSidebar.tsx`

Features:
- Recursive tree rendering
- Expandable/collapsible folders
- Active route highlighting
- Search/filter (optional)
- Follows folder structure from index
- Different from authenticated Sidebar - this is docs-specific

### Step 6: Create Table of Contents Component

**File**: `frontend/src/components/docs/TableOfContents.tsx`

Features:
- Parse markdown headings (h1-h6)
- Generate anchor links
- Scroll spy to highlight active section
- Smooth scroll to sections

### Step 6a: Create Code Group Component

**File**: `frontend/src/components/docs/CodeGroup.tsx` ✅ **COMPONENT EXISTS** ⚠️ **NOT INTEGRATED**

Features:
- ✅ Component created
- Detects consecutive code blocks in markdown
- Groups them by language or explicit group identifier
- Renders tabs above code blocks
- Each tab shows syntax-highlighted code
- Active tab highlighting

**Status**: Component exists at `frontend/src/components/docs/CodeGroup.tsx` but is not yet integrated into `DocsViewer.tsx` markdown rendering. Needs integration into the `pre` or `code` component handlers.

### Step 6b: Create Callout Box Component

**File**: `frontend/src/components/docs/CalloutBox.tsx` ✅ **COMPLETED**

Features:
- ✅ Component created with all callout types
- Renders styled boxes matching design system:
  - Blurry background (`backdrop-blur-md`)
  - Colored border and text
  - Icon from `lucide-react`
  - Rounded corners
- Supports: NOTE (blue), TIP (cyan), IMPORTANT (purple), WARNING (yellow), CAUTION (orange)
- Reference styling from `NotificationToast.tsx` pattern

**Status**:
- ✅ Integrated into markdown rendering via `DocsViewer` blockquote handler (see `parseCallout` and `blockquote` override in `frontend/src/pages/Docs/DocsViewer.tsx`)
- ✅ Callout inline-code styling refined to match VitePress feel (see `codeBg` / `codeFg` in `frontend/src/components/docs/CalloutBox.tsx`)
- ⚠️ `parseCallout` needs cleanup (remove debug logs, harden parsing)

### Step 7: Create Docs Viewer Page

**File**: `frontend/src/pages/Docs/DocsViewer.tsx`

Features:
- Fetches markdown content from `public/docs/` folder (static files)
- Uses `fetch('/docs/{path}')` to load markdown files
- Renders with `react-markdown` with custom components:
  - **Code blocks**: Syntax highlighting with `shiki`
  - **Code groups**: Tabbed code blocks via `CodeGroup` component
  - **Callout boxes**: Admonition boxes via `CalloutBox` component
  - **Tables**: Custom styled tables
  - **Links**: Convert to React Router `Link` for internal docs
  - **Images**: Handle relative paths
  - **Headings**: Add IDs for anchor links
- Breadcrumbs navigation
- Uses DocsLayout wrapper
- **Note**: Files are served from ephemeral `public/docs/` copy created during build

### Step 8: Create Docs Index Page

**File**: `frontend/src/pages/Docs/DocsIndex.tsx`

Features:
- Shows `docs/README.md` by default
- Or shows a nice landing page with categorized links
- Uses DocsLayout wrapper

### Step 9: Add Routes

**File**: `frontend/src/App.tsx`

Add routes:
- `/docs` → DocsIndex (shows README or landing)
- `/docs/*` → DocsViewer (catches all doc paths)

### Step 10: Update Navigation

**File**: `frontend/src/pages/Landing.tsx`

After extracting PublicNav, the "Docs" link will automatically appear in the nav (handled by PublicNav component).

**File**: `frontend/src/components/layout/Sidebar.tsx` (optional)

Consider adding docs link to authenticated sidebar for easy access from within the app.

## File Structure

```
project-root/
├── docs/                          # SOURCE OF TRUTH - Edit files here
│   ├── README.md
│   ├── setup/
│   │   └── setup-guide.md
│   └── ...
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   └── Docs/
│   │   │       ├── DocsIndex.tsx      # Landing/index page
│   │   │       └── DocsViewer.tsx     # Individual doc viewer
│   │   └── components/
│   │       ├── navigation/
│   │       │   └── PublicNav.tsx      # Shared public navigation
│   │       └── docs/
│   │           ├── DocsLayout.tsx     # Three-column layout
│   │           ├── DocsSidebar.tsx    # Navigation tree
│   │           ├── TableOfContents.tsx # TOC component
│   │           ├── CodeGroup.tsx       # Tabbed code blocks
│   │           └── CalloutBox.tsx      # Admonition/callout boxes
│   └── public/
│       ├── docs/                      # EPHEMERAL COPY (created during build)
│       │   ├── README.md              # (copied from root docs/)
│       │   ├── setup/
│       │   │   └── setup-guide.md     # (copied from root docs/)
│       │   └── ...
│       └── docs-index.json            # Generated index
└── scripts/
    └── build-docs-index.js         # Build script (copies docs + generates index)
```

**Important Notes**:
- **Source of truth**: Root `docs/` folder - always edit files here
- **Ephemeral copy**: `public/docs/` is created/copied during build, overwritten each time
- **Never edit** files in `public/docs/` - they will be overwritten on next build

## Technical Details

### Markdown Rendering

Use existing `react-markdown` with custom components:
- Code blocks → Use `shiki` for syntax highlighting (already installed)
- **Code groups** → Tabbed code blocks (multiple code blocks with tabs)
- **Callout/Admonition boxes** → Custom styled boxes for `> [!NOTE]`, `> [!WARNING]`, etc.
- **Custom tables** → Enhanced table styling with better borders and spacing
- Links → Convert to React Router `Link` for internal docs
- Images → Handle relative paths
- Headings → Add IDs for anchor links
- HTML in markdown → Enable via `rehype-raw` (trusted docs content only)

### Styling

Use existing markdown styles from `frontend/src/index.css` (`.markdown-content` class).

### Routing Strategy

**Option A: Path-based routing** (Recommended)
- `/docs` → Index page
- `/docs/setup/setup-guide` → Renders `setup/setup-guide.md`
- `/docs/README` → Renders `README.md`

**Option B: Query-based routing**
- `/docs?path=setup/setup-guide` → Renders that file

Prefer Option A for cleaner URLs and better SEO.

### Handling Internal Links

Convert markdown links like `[Setup Guide](./setup/setup-guide.md)` to React Router links `/docs/setup/setup-guide`.

### Code Highlighting

See the current code-block implementation in `frontend/src/pages/Docs/DocsViewer.tsx` (custom `pre`/`code` renderers using Shiki + JSON special casing).

### Code Groups (Tabbed Code Blocks)

Support multiple code blocks with tabs (like VitePress):
- Parse markdown with multiple consecutive code blocks
- Group by language or explicit group identifier
- Render as tabs above code blocks
- Example:
  ````markdown
  ```kubernetes
  # Kubernetes config
  ```
  
  ```docker-compose
  # Docker Compose config
  ```
  ````
- Component: `frontend/src/components/docs/CodeGroup.tsx`

### Callout/Admonition Boxes

Support VitePress-style callout boxes using blockquote syntax:
- Parse `> [!NOTE]`, `> [!WARNING]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!CAUTION]`
- Match existing design system pattern:
  - **NOTE**: `bg-blue-500/10 border-blue-500/30 text-blue-400 backdrop-blur-md`
  - **TIP**: `bg-cyan-500/10 border-cyan-500/30 text-cyan-400 backdrop-blur-md`
  - **IMPORTANT**: `bg-purple-500/10 border-purple-500/30 text-purple-400 backdrop-blur-md`
  - **WARNING**: `bg-yellow-500/10 border-yellow-500/30 text-yellow-400 backdrop-blur-md`
  - **CAUTION**: `bg-orange-500/10 border-orange-500/30 text-orange-400 backdrop-blur-md`
- Use icons from `lucide-react`: `Info`, `AlertTriangle`, `Lightbulb`, `AlertCircle`, `Zap`
- Component: `frontend/src/components/docs/CalloutBox.tsx`
- Reference: `frontend/src/components/notifications/NotificationToast.tsx` for styling pattern

### Custom Tables

Enhanced table styling:
- Better borders and spacing
- Hover effects on rows
- Responsive design (horizontal scroll on mobile)
- Alternating row colors (subtle)
- Styled headers with background
- Component: Custom table renderer in `react-markdown` components

## Alternative Approaches Considered

### Option 1: Copy to `src/content/docs` and use `import.meta.glob`

**Pros**: 
- Works like blog implementation
- Build-time bundling

**Cons**:
- Requires moving docs into src
- Can't easily update docs without rebuild

### Option 2: Backend API to serve docs

**Pros**:
- Full control
- Can add features like search

**Cons**:
- More complex
- Backend dependency
- You wanted to avoid this

### Option 3: Vite Plugin to virtualize docs

**Pros**:
- No file copying
- Works at build time

**Cons**:
- More complex
- Requires Vite plugin development

### Chosen: Ephemeral copy to public + Static serving (Simplest)

**Pros**:
- Simple implementation
- Docs stay in their natural location (root `docs/` - source of truth)
- Easy to update docs (just edit files in root, copy happens on build)
- No backend changes needed (static files served by Vite)
- Can be enhanced later
- Clear separation: source (root) vs. build artifact (public)

**Cons**:
- Build script must copy files on each build (but fast for markdown)
- Need build script for copy + index (but it's simple)
- `public/docs/` is ephemeral (but that's fine - it's just for serving)

## Dependencies

Already have:
- ✅ `react-markdown` - Markdown rendering
- ✅ `gray-matter` - Frontmatter parsing
- ✅ `shiki` - Syntax highlighting
- ✅ Markdown styles in `index.css`
- ✅ React Router - Navigation

Need to add:
- ✅ `mermaid` - diagram rendering for ` ```mermaid ` blocks
- ✅ `rehype-raw` - enables HTML in markdown (used for GitHub-style `<details>/<summary>`)

## Markdown Features

### Supported Features

1. ✅ **Syntax Highlighting**: Code blocks with `shiki`
2. ⚠️ **Code Groups**: Component exists but not yet integrated into markdown rendering
3. ✅ **Callout Boxes**: Admonition boxes (`> [!NOTE]`, `> [!WARNING]`, etc.)
4. ✅ **Custom Tables**: Enhanced table styling
5. ✅ **Internal Links**: Auto-convert to React Router links
6. ✅ **Images**: Relative path support
7. ✅ **Headings**: Auto-generated anchor links
8. ✅ **Mermaid Diagrams**: Render ` ```mermaid ` blocks as diagrams
9. ✅ **Collapsible Sections**: Render `<details>/<summary>` in markdown (GitHub-style)

### Callout Box Types

- `> [!NOTE]` - Blue (`bg-blue-500/10 border-blue-500/30`)
- `> [!TIP]` - Cyan (`bg-cyan-500/10 border-cyan-500/30`)
- `> [!IMPORTANT]` - Purple (`bg-purple-500/10 border-purple-500/30`)
- `> [!WARNING]` - Yellow (`bg-yellow-500/10 border-yellow-500/30`)
- `> [!CAUTION]` - Orange (`bg-orange-500/10 border-orange-500/30`)

All callouts use:
- `backdrop-blur-md` for blurry background
- Colored border matching the type
- Icon from `lucide-react`
- Rounded corners (`rounded-lg`)

## Future Enhancements (Optional)

1. **Search**: Full-text search across all docs
2. **Dark mode**: Already supported via existing theme system
3. **Versioning**: Support multiple doc versions
4. **Edit links**: Link to GitHub for editing
5. **Breadcrumbs**: Show full path
6. **Previous/Next**: Navigation between docs
7. **Print styles**: Better printing support
8. **Math equations**: LaTeX/MathJax support
9. **HTML sanitization**: Consider adding a sanitize step if docs ever become user-generated

## Implementation Checklist

- [x] Extract `PublicNav` component from landing page nav
- [x] Update `Landing.tsx` to use `PublicNav`
- [x] Create build script to copy docs from root `docs/` to `public/docs/` (ephemeral)
- [x] Create build script to generate `docs-index.json` (scans root `docs/`)
- [x] Update package.json with docs build step
- [x] Create `DocsLayout` component (with PublicNav)
- [x] Create `DocsSidebar` component with tree navigation
- [x] Create `TableOfContents` component
- [ ] Create `CodeGroup` component (tabbed code blocks) - *Component exists but not integrated*
- [x] Create `CalloutBox` component (admonition boxes matching design system)
- [x] Integrate `CalloutBox` into `DocsViewer`
- [x] Create `DocsViewer` page (fetches from `/docs/{path}` static files)
- [x] Integrate custom markdown components (code blocks, syntax highlighting, tables)
- [ ] Integrate `CodeGroup` component into markdown rendering
- [x] Create `DocsIndex` page
- [x] Add routes to `App.tsx`
- [x] Test with existing docs folder
- [x] Handle edge cases (missing files, invalid paths)
- [ ] Add error boundaries
- [x] Test markdown rendering (code blocks, syntax highlighting, tables, links, images)
- [x] Test callout box rendering (`> [!NOTE]`, `> [!WARNING]`, etc.)
- [ ] Test code group rendering (tabbed code blocks)
- [x] Test navigation and active states
- [ ] Test mobile responsiveness
- [ ] (Optional) Add docs link to authenticated Sidebar
- [x] Add Mermaid diagram rendering
- [x] Add GitHub-style `<details>/<summary>` rendering (via `rehype-raw`)

## Questions to Resolve

1. **Docs location**: Copy to `public/docs` or fetch from project root via backend?
   - ✅ **Resolved**: Ephemeral copy to `public/docs/` during build. Source of truth is root `docs/` folder. Copy is overwritten on each build.

2. **Index generation**: When to run? (pre-build script, or separate command?)
   - ✅ **Resolved**: As part of build process

3. **Default page**: Show `README.md` or custom landing page?
   - ✅ **Resolved**: Show `README.md` as default

4. **Internal links**: Convert automatically or require manual linking?
   - ✅ **Resolved**: Auto-convert relative `.md` links to React Router links

5. **Navigation header**: Reuse landing page nav or create new?
   - ✅ **Resolved**: Extract to shared `PublicNav` component for consistency and economy

---

## References

- Blog implementation: `frontend/src/pages/Blog/BlogIndex.tsx` (shows `import.meta.glob` pattern)
- Markdown styles: `frontend/src/index.css` (lines 71-173)
- React Router docs: Already used throughout app
- React Markdown: https://github.com/remarkjs/react-markdown
