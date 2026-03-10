<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Registry README Shiki Integration Plan

**Status:** ✅ Implemented — `MarkdownRenderer` from the docs viewer is imported and used in `ModuleDetail.tsx` for README rendering.

## Current State

### Registry README Rendering
- **Location**: `frontend/src/pages/Registry/ModuleDetail.tsx` (line 425)
- **Current Implementation**: Uses `dangerouslySetInnerHTML` to render raw HTML from backend
- **Issue**: No syntax highlighting, plain code blocks, no copy buttons, no language labels
- **Backend**: Returns pre-rendered HTML (likely from markdown parsing without syntax highlighting)

### Docs Viewer Implementation
- **Location**: `frontend/src/pages/Docs/DocsViewer.tsx`
- **Features**:
  - Uses `ReactMarkdown` for markdown parsing
  - Shiki syntax highlighting with `codeToHtml`
  - Language labels (top-left of code blocks)
  - Copy buttons (top-right of code blocks)
  - Custom styling with `shiki-wrapper` class
  - Support for callout boxes, code groups, Mermaid diagrams
  - Custom `pre` and `code` component overrides
  - State management for highlighted code blocks
  - Copy functionality with visual feedback

## Goal

Reuse the docs viewer's markdown rendering (with Shiki highlighting, copy buttons, language labels) in the registry README tab without code duplication.

## Implementation Plan

### Step 1: Create Reusable MarkdownRenderer Component

**File**: `frontend/src/components/docs/MarkdownRenderer.tsx`

**Purpose**: Extract the markdown rendering logic from `DocsViewer.tsx` into a reusable component.

**What to Extract**:
1. ReactMarkdown setup with `remarkGfm` and `rehypeRaw`
2. Custom markdown components (headings, code, pre, blockquote, links, etc.)
3. Shiki highlighting logic and state management
4. Copy button functionality
5. Language label display
6. Support for callout boxes, code groups, Mermaid diagrams

**Props Interface**:
```typescript
interface MarkdownRendererProps {
  content: string;  // Markdown content (not HTML)
  className?: string;
  // Optional: allow customization of which features to enable
  enableCallouts?: boolean;
  enableCodeGroups?: boolean;
  enableMermaid?: boolean;
}
```

**Key Features to Include**:
- ✅ Shiki syntax highlighting for code blocks
- ✅ Language labels (e.g., "yaml", "bash")
- ✅ Copy code buttons with visual feedback
- ✅ Same styling as docs viewer (`shiki-wrapper` class)
- ✅ Support for inline code (styled differently)
- ✅ Headings with IDs for anchor links
- ✅ Callout boxes (optional, if enabled)
- ✅ Code groups (optional, if enabled)
- ✅ Mermaid diagrams (optional, if enabled)
- ✅ Link handling (internal/external)

### Step 2: Update DocsViewer to Use MarkdownRenderer

**File**: `frontend/src/pages/Docs/DocsViewer.tsx`

**Changes**:
- Replace the ReactMarkdown setup with `MarkdownRenderer` component
- Pass markdown content (not HTML) to the component
- Enable all features (callouts, code groups, Mermaid)

**Benefits**:
- Reduces code duplication
- Single source of truth for markdown rendering
- Easier to maintain and update

### Step 3: Update Backend to Return Markdown

**Files to Update**:
1. `backend/internal/api/v2/handlers/registry_publishing.go`
   - Line 443: Change `markdownToHTML(v.Readme)` to `v.Readme`
   
2. `backend/internal/api/v2/handlers/registry_modules.go`
   - Line 431: Change `markdownToHTML(version.Readme)` to `version.Readme`
   - Line 403: Change `markdownToHTML(readmeVal)` to `readmeVal` (submodules)

**Testing**:
- Verify API responses return markdown strings (not HTML)
- Check that existing functionality still works
- Test both manual upload and Git tag webhook paths

### Step 4: Update Registry ModuleDetail to Use MarkdownRenderer

**File**: `frontend/src/pages/Registry/ModuleDetail.tsx`

**Current Code** (line 425):
```tsx
<div dangerouslySetInnerHTML={{ __html: selectedVersion.readme }} />
```

**Changes Needed**:
1. Import `MarkdownRenderer` component
2. Replace `dangerouslySetInnerHTML` with `MarkdownRenderer`
3. Pass `selectedVersion.readme` (now markdown) to component
4. Optionally disable features not needed for registry README (callouts, code groups, etc.)

**Code Change**:
```tsx
import { MarkdownRenderer } from '@/components/docs/MarkdownRenderer';

// In render:
{selectedVersion?.readme ? (
  <MarkdownRenderer 
    content={selectedVersion.readme}
    enableCallouts={true}
    enableCodeGroups={true}
    enableMermaid={true}
  />
) : (
  <p className="text-muted-foreground">No README available for this version.</p>
)}
```

### Step 4: Ensure CSS Styling is Shared

**File**: `frontend/src/index.css`

**Current State**:
- Shiki styles are already in `index.css` (lines 155-179)
- `.markdown-content` class has styling for markdown elements
- `.shiki-wrapper` class has styling for code blocks

**Action**:
- Ensure registry README uses `markdown-content` class wrapper
- Verify all Shiki styles apply correctly
- Test in both light and dark modes

### Step 5: Testing Checklist

- [x] Code blocks render with syntax highlighting
- [x] Language labels appear correctly (top-left)
- [x] Copy buttons work and show feedback
- [x] Inline code is styled differently from code blocks
- [ ] Headings, lists, links render correctly
- [ ] Dark/light mode works
- [x] No console errors
- [x] Performance is acceptable (Shiki is async)
- [x] Works with various languages (yaml, json, bash, etc.)
- [x] Long code blocks scroll correctly
- [x] Copy functionality works across browsers

## File Structure

```
frontend/src/
├── components/
│   └── docs/
│       ├── MarkdownRenderer.tsx      [NEW] - Reusable markdown renderer
│       ├── CalloutBox.tsx            [EXISTING] - Used by MarkdownRenderer
│       ├── CodeGroup.tsx            [EXISTING] - Used by MarkdownRenderer
│       └── MermaidDiagram.tsx       [EXISTING] - Used by MarkdownRenderer
├── pages/
│   ├── Docs/
│   │   └── DocsViewer.tsx           [UPDATE] - Use MarkdownRenderer
│   └── Registry/
│       └── ModuleDetail.tsx         [UPDATE] - Use MarkdownRenderer
└── index.css                        [VERIFY] - Ensure styles are shared
```

## Implementation Details

### MarkdownRenderer Component Structure

```typescript
export function MarkdownRenderer({ 
  content, 
  className,
  enableCallouts = true,
  enableCodeGroups = true,
  enableMermaid = true 
}: MarkdownRendererProps) {
  const [highlightedCode, setHighlightedCode] = useState<Record<string, string>>({});
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Extract markdown components logic from DocsViewer
  const markdownComponents = useMemo(() => {
    // ... all the component overrides from DocsViewer
  }, [highlightedCode, copiedCodeId]);

  return (
    <div className={cn('markdown-content', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCodeGroup]}
        rehypePlugins={[rehypeRaw]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

### Key Functions to Extract from DocsViewer

1. **`hashCode()`** - Generate hash for code blocks
2. **`parseCallout()`** - Parse callout boxes from blockquotes
3. **`remarkCodeGroup()`** - Remark plugin for code groups
4. **`codeGroupToHast()`** - Rehype handler for code groups
5. **`extractCodeText()`** - Extract text from React nodes
6. **Markdown component overrides**:
   - `h1-h6` - Headings with IDs
   - `blockquote` - Callout boxes
   - `pre` - Shiki wrapper with copy button
   - `code` - Shiki highlighting logic
   - `a` - Link handling
   - `details/summary` - Collapsible sections
   - `codegroup` - Code groups

## Backend Investigation Results

### Summary

✅ **Good News**: README is already stored as **raw markdown** in the database!

**Key Findings**:
- README is extracted from `README.md` file during module publishing (manual upload or Git tag webhook)
- Stored as raw markdown string in `ModuleVersion.Readme` field (database type: `text`)
- HTML conversion happens **only** at API response time via `markdownToHTML()` function
- **Solution**: Simply remove HTML conversion in API handlers - return raw markdown instead
- **No database changes needed** - data is already in correct format
- **No migration needed** - existing data is fine

**Publishing Paths**:
1. **Manual Upload**: Tarball → Extract → Parse `README.md` → Store markdown
2. **Git Tag Webhook**: Clone repo at tag → Parse `README.md` → Store markdown

**GitHub Integration**:
- Uses GitHub App for authentication
- Webhook triggers on tag push events
- Clones repository at specific tag (not live API fetching)
- README extracted during publish process, not fetched separately

### How README is Fetched and Stored

**README Source**:
1. **Manual Upload Path**: User uploads tarball → extracted to temp directory → parsed
2. **Git Tag Webhook Path**: GitHub webhook triggers → clones repo at tag → parsed

**Parsing Process** (`backend/internal/services/registry/parser.go`):
- README is read from `README.md` file in the module directory (line 132-139)
- Stored as **raw markdown string** in `ModuleMetadata.Readme` field
- No processing or conversion at this stage

**Storage** (`backend/internal/models/module_version.go`):
- README stored in database as `text` type (line 15)
- Field: `Readme string` - contains raw markdown
- No HTML conversion in database layer

**Publishing Process** (`backend/internal/services/registry/module_publisher.go`):
- `PublishVersionFromTarball()`: Extracts tarball → parses module → stores markdown (line 182)
- `PublishVersionFromDirectory()`: Clones repo → parses module → stores markdown (line 279)
- Both paths store raw markdown in `ModuleVersion.Readme` field

**GitHub Integration**:
- Uses GitHub App for authentication (`githubAppManager`)
- Webhook handler: `backend/internal/api/v2/handlers/vcs_app_installation.go`
- On tag push: Clones repository at tag → parses → stores markdown
- No live API fetching - README is extracted during publish process

### Current API Response Format

**API Endpoints Returning README**:
1. **`ListModuleVersions`** (`registry_publishing.go:443`)
   - Endpoint: `GET /api/v2/organizations/:name/registry/modules/:module_name/:provider/versions`
   - Used by: Frontend `registryApi.modules.getVersions()`
   - Currently: Returns HTML via `markdownToHTML(v.Readme)`

2. **`formatModuleDetail`** (`registry_modules.go:431`)
   - Used by: `GetModule` and `GetModuleVersion` handlers
   - Currently: Returns HTML via `markdownToHTML(version.Readme)`
   - Also handles submodules (line 403): `markdownToHTML(readmeVal)`

**Current Conversion**:
- `markdownToHTML()` function (`registry_modules.go:489-517`)
- Uses `gomarkdown` library to convert markdown → HTML
- Wraps result in `<div class="markdown-content">` wrapper
- Applied at API response time, not at storage time

### Required Backend Changes

**Solution: Return Raw Markdown (Simple Change)**

Since README is already stored as markdown in the database, we just need to:
1. Remove `markdownToHTML()` calls in API response handlers
2. Return raw markdown string instead of HTML
3. Frontend will handle rendering with Shiki

**Files to Update**:
1. `backend/internal/api/v2/handlers/registry_publishing.go`
   - Line 443: Change `markdownToHTML(v.Readme)` to `v.Readme`
   - **Impact**: Frontend `getVersions()` API call

2. `backend/internal/api/v2/handlers/registry_modules.go`
   - Line 431: Change `markdownToHTML(version.Readme)` to `version.Readme`
   - Line 403: Change `markdownToHTML(readmeVal)` to `readmeVal` (for submodules)
   - **Impact**: Legacy TFE-compatible API endpoints (if used)

**No Database Changes Required**:
- README is already stored as markdown
- No migration needed
- No data conversion needed

**Backward Compatibility**:
- If any external clients depend on HTML format, we may need to:
  - Add a query parameter `?format=html` to return HTML
  - Or create separate endpoints
  - **Recommendation**: Check if external clients exist first

## API Client Interface

**File**: `frontend/src/api/client.ts` (line 1533)
- `ModuleVersion` interface has `readme?: string` field
- Currently expects HTML string (from backend)
- After backend update, will receive markdown string
- No changes needed to TypeScript types (both are strings)

## Migration Strategy

1. **Phase 1**: Create `MarkdownRenderer` component
   - Extract all logic from `DocsViewer.tsx`
   - Test in isolation
   - Ensure all features work

2. **Phase 2**: Update `DocsViewer` to use `MarkdownRenderer`
   - Replace existing code with component
   - Verify docs viewer still works correctly
   - Test all features

3. **Phase 3**: Update `ModuleDetail` to use `MarkdownRenderer`
   - Check backend response format
   - Update if needed (markdown vs HTML)
   - Replace `dangerouslySetInnerHTML` with component
   - Test registry README rendering

4. **Phase 4**: Testing & Refinement
   - Test both locations
   - Verify styling consistency
   - Check performance
   - Fix any issues

## Benefits

1. **No Code Duplication**: Single component for markdown rendering
2. **Consistency**: Same styling and features in both places
3. **Maintainability**: Update once, works everywhere
4. **Feature Parity**: Registry README gets all docs viewer features
5. **Better UX**: Syntax highlighting, copy buttons, language labels

## Potential Challenges

1. **Backend Format**: May need to update backend to return markdown
2. **Performance**: Shiki is async, need loading states
3. **Bundle Size**: Shiki adds to bundle size (already included)
4. **Styling Conflicts**: Ensure no CSS conflicts between contexts

## Success Criteria

- ✅ Registry README code blocks have syntax highlighting
- ✅ Language labels appear on code blocks
- ✅ Copy buttons work with visual feedback
- ✅ Styling matches docs viewer exactly
- ✅ No code duplication between DocsViewer and ModuleDetail
- ✅ All existing docs viewer features still work
- ✅ Performance is acceptable
