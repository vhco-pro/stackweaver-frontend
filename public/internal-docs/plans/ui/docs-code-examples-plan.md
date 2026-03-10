# Docs Code Examples Plan

> **Status: COMPLETE.** All features implemented. Minor polish: CodeExplorer tree filenames bumped from `text-xs` to `text-sm` (2026-03-09).
>
> **Status: IMPLEMENTED.** All three features implemented 2026-03-08.
> Test page: `docs/test-code-examples.md`
>
> **Phase 4 plan audited 2026-03-08.** Critical implementation context added for Sonnet 4.6.
> All code paths, line numbers, interfaces, and integration points verified against the actual codebase.
>
> **Phase 4 IMPLEMENTED 2026-03-08.** Features 4, 5, 6, and 7 implemented.
> - Feature 4: Language icons: `frontend/public/icons/file-types/` (12 SVGs), `fileTypeIcons.ts`, CodeExplorer + FileTreeViewer updated.
> - Feature 5: ZIP download: `jszip` installed, Download button + `handleDownload` in CodeExplorer.
> - Feature 6: GitHub sources (build-time): `processCodeExplorers` made async, `fetchGitHubExplorer` added to build script, `github:` path resolved in `markdownComponents.codeexplorer`, `source` field in manifest, GitHub ↗ link in CodeExplorer header.
> - Feature 7: Expand/fullscreen: `Maximize2` button in header, `Dialog` overlay at 90vw×90vh, shared state via parent, `codePaneContent` variable reused in both views.


## Problem

Non-markdown files co-located with docs (e.g. `entra-setup/main.tf`) are never copied by `build-docs-index.js` because the scanner filters to `.md` only. Clicking links to these files in the docs viewer silently fails: DocsViewer resolves a 404, the Vite SPA fallback returns `index.html`, and the viewer detects that as a missing page.

The broader need is a clean authoring experience for embedding real code examples — single files and multi-file folder structures — directly inside documentation, without iframes or duplicate content.

---

## Feature Overview

Three distinct enhancements, ordered by complexity:

| Feature | Directive | Use case |
|---|---|---|
| **File Tree** | ` ```tree ` | Visual folder structure diagram (no file contents) |
| **File Inclusion** | `<<< ./path/to/file` | Inline a single file as a syntax-highlighted code block |
| **Code Explorer** | `::: code-explorer ./dir` | Interactive file tree + viewer for multi-file examples |

Each feature builds on the existing framework: the remark plugin pattern (already used for `code-group` and callouts), the Shiki syntax highlighter, and `build-docs-index.js` as the build step.

---

## Critical Implementation Context

These facts are essential for correct implementation. Read before starting.

### Build script is CommonJS

`scripts/build-docs-index.js` uses `require()` / `module.exports` / `require.main === module`. All new code added to this file must use CommonJS syntax. Do NOT use `import` statements.

### `copyFiles` uses `fs.copyFileSync`: no content processing

`copyFiles()` currently copies bytes directly with `fs.copyFileSync`. The `<<<` file inclusion feature (Feature 2) needs to read markdown content, process inclusions, and write the result, not blindly copy. The function must be restructured so that for `.md` files it does:

```js
const content = fs.readFileSync(file.fullPath, 'utf-8')
const processed = processFileInclusions(content, file.fullPath)
fs.writeFileSync(destPath, processed, 'utf-8')
```

For non-`.md` files (code example files for code explorer), it continues using `fs.copyFileSync`.

### `copyFiles` nukes the output directory on every run

`copyFiles()` starts with `fs.rmSync(PUBLIC_DOCS, { recursive: true, force: true })`. If the image support plan has already been implemented, images and markdown are cleaned together. Any code explorer files must also be generated in the same build pass (or after the initial clean). Do not call `copyFiles()` more than once.

### How the remark plugin works (critical for Feature 3)

The current `remarkCodeGroup` plugin (MarkdownRenderer.tsx ~line 108) works as follows:

1. `isCodeGroupContainerStart(node)` checks if a paragraph node’s text matches `/^:::\s*code-group\s*$/i`
2. `isCodeGroupContainerEnd(node)` checks for `/^:::\s*$/` (the closing `:::`)
3. When a matching start is found, the plugin collects all children between start and end `:::`
4. It produces a virtual AST node of type `codeGroup` with the collected items
5. `codeGroupToHast()` (line ~149) converts this AST node to a `<codegroup>` HTML element with `data-code-group-items` JSON attribute
6. This handler is registered in `remarkRehypeOptions.handlers.codeGroup` (line ~932)
7. The `markdownComponents.codegroup` entry (line ~417) renders the custom element as a `<CodeGroup>` React component

For `::: code-explorer`, you must follow this exact same pattern:

**Step 1: Add detection function:**
```ts
function isCodeExplorerStart(node: unknown): { path: string; defaultFile: string } | null {
  const text = paragraphText(node);
  if (typeof text !== 'string') return null;
  const match = text.trim().match(/^:::\s*code-explorer\s+(\S+)(?:\s+default="([^"]+)")?\s*$/i);
  if (!match) return null;
  return { path: match[1], defaultFile: match[2] || '' };
}
```

**Step 2: Extend the `remarkCodeGroup` function** (rename it to `remarkDirectives` or keep it and add a second check in the scan loop). The closing `:::` delimiter is shared with code-group, so the parser must track which directive type opened the current block. Add a check for `isCodeExplorerStart` BEFORE the `isCodeGroupContainerStart` check in the `for` loop. When matched, skip forward to the closing `:::` and produce a `{ type: 'codeExplorer', path, defaultFile }` AST node.

**Step 3: Add hast handler:**
```ts
function codeExplorerToHast(_state: unknown, node: unknown) {
  const n = node as { path?: string; defaultFile?: string };
  return {
    type: 'element',
    tagName: 'codeexplorer',
    properties: {
      'data-path': n.path || '',
      'data-default': n.defaultFile || '',
    },
    children: [],
  };
}
```

**Step 4: Register the handler** in `remarkRehypeOptions.handlers` alongside the existing `codeGroup` handler:
```ts
remarkRehypeOptions={{
  handlers: {
    codeGroup: (_state, node) => codeGroupToHast(node),
    codeExplorer: (_state, node) => codeExplorerToHast(node),
  },
}}
```

**Step 5: Add to `markdownComponents`:**
```tsx
codeexplorer: (props: MarkdownBlockProps) => {
  const explorerPath = (props['data-path'] as string) || '';
  const defaultFile = (props['data-default'] as string) || '';
  return <CodeExplorer path={explorerPath} defaultFile={defaultFile} />;
},
```

### File tree `tree` language branch in MarkdownRenderer.tsx

The mermaid rendering branch is inside the `pre` component handler’s `isCodeElement` block (around line 550):

```tsx
if (lang === 'mermaid' && enableMermaid) {
  return <MermaidDiagram code={codeTextTrimmed} />;
}
```

Add the `tree` / `filetree` branch in the same location, immediately after the mermaid check:

```tsx
if (lang === 'tree' || lang === 'filetree') {
  return <FileTreeViewer content={codeTextTrimmed} />;
}
```

### Path traversal guard for `<<<` file inclusion

The `processFileInclusions` function resolves paths relative to the markdown file. It MUST validate that the resolved absolute path stays within the `docs/` directory to prevent path traversal attacks (e.g. `<<< ../../../etc/passwd`). After resolving the path:

```js
const resolved = path.resolve(markdownDir, filePath)
if (!resolved.startsWith(DOCS_ROOT)) {
  console.warn(`⚠ Skipping <<< inclusion outside docs/: ${filePath}`)
  // leave as fallback error block
  return
}
```

### Code explorer manifest generation: timing and parsing

The build script currently only reads markdown file content for frontmatter extraction via `gray-matter` (in `extractMetadata`). For code explorer manifest generation, the script must also scan each markdown file’s content for `::: code-explorer` directives AFTER the initial file scan but BEFORE (or during) `copyFiles`. The simplest approach: in a new `processCodeExplorers(files)` function called from `main()`, read each `.md` file, regex-match `::: code-explorer (\S+)`, resolve the directory path, scan it, copy its files, and write the `.explorer.json` manifest.

---

## Feature 1: File Tree (`::: file-tree` / ` ```tree `)

### What it does

Renders a GitHub-style visual file tree from a text description. This is a **static visualization only** with no file contents and no interactivity. Useful for docs that explain "your workspace should be organised like this".

### Authoring syntax

Authors write an indented tree inside a fenced code block with the `tree` language:

````markdown
```tree
entra-setup/
├── main.tf
├── variables.tf
└── outputs.tf
```
````

Standard `tree(1)` output format. The `├──`, `└──`, `│` characters are rendered by the tree command; authors can also write simplified indentation and the renderer normalises it.

Alternatively a `::: file-tree` directive (same as VitePress) can be supported using the existing remark plugin pattern, but the ` ```tree ` code block approach requires zero new AST walking and is simpler.

### Rendering

A custom Shiki language does NOT work here because tree rendering needs React (icons, hover, dark mode). Instead, the code block renderer in `MarkdownRenderer.tsx` already switches on the fenced language (it handles `mermaid` this way). Add a matching branch for `tree` / `filetree`.

**React component `FileTreeViewer.tsx`:**

- Parse the raw text line by line.
- Recognise `├──`, `└──`, `│`, and plain indentation (tabs/spaces).
- For each line: determine nesting depth, detect directories (trailing `/`) vs files.
- Render as a `<ul>` tree with:
  - Directory lines: folder icon (e.g. Lucide `Folder` / `FolderOpen`), directory name in normal weight.
  - File lines: file icon (Lucide `File`), optionally language-specific icon for `.tf`, `.yaml`, `.sh`, `.json`, `.toml`.
  - Connector lines use CSS (left border with offset, matching the `├──` / `└──` visual position).
- Styled: monospace font, `text-sm`, `bg-muted/40 rounded-md border border-border/40 p-4`.
- No interaction required.

**Language icon map** (a small lookup table by extension):

| Extension | Icon |
|---|---|
| `.tf`, `.tfvars` | Terraform icon or generic code icon |
| `.yaml`, `.yml` | generic code icon |
| `.sh`, `.bash` | terminal icon |
| `.json`, `.jsonc` | braces icon |
| `.toml` | config icon |
| `.md` | document icon |
| `.go` | generic code icon |
| `.ts`, `.tsx` | generic code icon |

Use the existing Lucide icon set already imported in the codebase; do not add a new icon library.

### Build script changes

None. This is purely a renderer-side feature. The tree text is inside the markdown file itself.

---

## Feature 2: File Inclusion (`<<<` directive)

### What it does

Inlines the contents of an external file as a fenced code block at **build time**, before the markdown is written to `public/docs/`. The markdown file stays clean; the referenced file is the single source of truth.

### Authoring syntax

````markdown
```
⚠ Could not include ./entra-setup/main.tf — file not found
```
````

A single line starting with `<<<`, followed by a path relative to the markdown file being processed.

Optionally, include a line range:

````markdown
```
⚠ Could not include ./main.tf — file not found
```
````

Only lines 10–50 of the file are included.

### Build-time processing in `build-docs-index.js`

After reading a `.md` file and before writing it to `public/docs/`, apply a `processFileInclusions(content, markdownFilePath)` pass:

1. Scan lines for the pattern `/^<<<\s+(\S+)$/`.
2. Extract the file path (strip `./` prefix, resolve relative to the markdown file's directory).
3. Optionally parse a `#L{start}-{end}` suffix for line ranges.
4. Read the referenced file from disk.
5. Auto-detect language from extension using the map in the table below.
6. Replace the `<<<` line with a fenced code block:
   ````
   ```hcl
   <file contents here>
   ```
   ````
7. Write the processed markdown to `public/docs/`.

**Extension to language map** (used to set the fenced code block language):

| Extension | Fenced language |
|---|---|
| `.tf`, `.tfvars` | `hcl` |
| `.yaml`, `.yml` | `yaml` |
| `.sh`, `.bash` | `bash` |
| `.json` | `json` |
| `.jsonc` | `jsonc` |
| `.toml` | `toml` |
| `.go` | `go` |
| `.ts`, `.tsx` | `typescript` |
| `.js` | `javascript` |
| `.py` | `python` |
| `.md` | `markdown` |
| Anything else | ` ` (empty — plaintext) |

**Error handling:**

If the referenced file does not exist or cannot be read, log a warning to stderr and leave the line as a fallback comment block:

````
```
⚠ Could not include ./path/to/file.tf — file not found
```
````

This prevents a silent build failure from hiding a broken include reference.

### Runtime changes

None. By the time the browser loads the markdown, the `<<<` line has been replaced with a regular fenced code block. Shiki highlights it exactly as if the author had pasted the content manually.

### Authoring convention addition

Add to `DOCUMENTATION_STANDARDS.md`:

- Use `<<< ./relative/path` to include external code files. The path is relative to the markdown file.
- Referenced files live alongside the markdown file or in a subdirectory.
- Use line ranges (`#L10-L50`) to include only the relevant excerpt.
- Files under `docs/internal/` can be referenced by internal plan documents.
- If including a large file, prefer a line range to avoid overwhelming readers.

---

## Feature 3: Code Explorer (`::: code-explorer`)

### What it does

Renders an interactive file browser for a directory of example code. Left panel shows a file tree; clicking a file shows it syntax-highlighted on the right. Designed for multi-file examples where the folder structure itself is part of the documentation (e.g. an example Terraform module with `main.tf`, `variables.tf`, `outputs.tf`).

### Authoring syntax

````markdown
::: code-explorer ./entra-setup
:::
````

The path is relative to the markdown file. An optional default file can be specified:

````markdown
::: code-explorer ./entra-setup default="main.tf"
:::
````

### Build-time processing in `build-docs-index.js`

When the scanner encounters a markdown file that contains a `::: code-explorer` directive:

1. Resolve the referenced directory path relative to the markdown file.
2. Recursively scan the directory for all code files (non-`.md`, non-image files matching the extension whitelist in Feature 2).
3. Copy each file to `public/docs/<same relative path as the directory>/`.
4. Generate a manifest JSON file at `public/docs/<explorer-dir-path>.explorer.json`:

```json
{
  "root": "entra-setup",
  "files": [
    { "path": "main.tf", "lang": "hcl" },
    { "path": "variables.tf", "lang": "hcl" },
    { "path": "outputs.tf", "lang": "hcl" }
  ]
}
```

The manifest contains only file metadata — not file contents. Content is fetched on demand at runtime.

### Remark plugin changes

Extend the existing remark plugin in `MarkdownRenderer.tsx` to recognise `::: code-explorer <path>` blocks alongside `::: code-group`. See the "Critical Implementation Context" section above for the exact step-by-step pattern: detection function, AST node production, hast handler, handler registration, and `markdownComponents` entry. All five steps must be implemented — the section above provides concrete code for each.

### React component `CodeExplorer.tsx`

**Responsibilities:**

1. On mount, fetch `<data-path>.explorer.json` from `public/docs/`.
2. Render the file tree (left column, ~220px wide).
3. On file click, fetch the file from `public/docs/<data-path>/<file.path>`.
4. Highlight the fetched content with Shiki (same async pattern as `CodeGroup.tsx`).
5. Render the highlighted HTML in the right column.

**Layout (fixed-height, no scroll on page):**

```
┌──────────────────────────────────────────────────────────────┐
│ ENTRA-SETUP                                          Copy    │
├──────────────┬───────────────────────────────────────────────┤
│ main.tf      │  terraform {                                   │
│ variables.tf │    required_providers {                        │
│ outputs.tf   │      azuread = {                               │
│              │        source  = "hashicorp/azuread"           │
│              │        version = "~> 3.0"                      │
│              │      }                                         │
│              │    }                                           │
│              │  }                                             │
└──────────────┴───────────────────────────────────────────────┘
```

- Total height: `480px` with the code pane scrollable internally (`overflow-y: auto`).
- File tree pane: `min-w-[180px] max-w-[220px]`, `overflow-y: auto`.
- Border: `border border-border/40 rounded-md`.
- Header: shows the directory name (capitalised) on the left, Copy button (copies current file) on the right.
- Active file: highlighted row with `bg-muted/60`.
- File tree shows nested directories if present, collapsible.
- Dark/light theme: follows the existing Shiki theme toggle pattern from `CodeGroup.tsx`.

**Loading state:** While fetching (manifest or file), show a skeleton pulse inside the code pane.

**Error state:** If manifest fetch fails (file not found in public/docs), render a fallback message:

```
Code explorer: example directory "entra-setup" not found.
```

### Why not iframes or external sandboxes

Iframes (StackBlitz, CodeSandbox) add an external dependency, require network access, impose CSP restrictions, and have inconsistent styling. The Code Explorer is self-contained, uses the existing Shiki highlighter, follows the site's own dark/light theme, and requires no external service.

---

## Implementation Order

### Phase 1 — File Tree (Feature 1)

1. Add `FileTreeViewer.tsx` component.
2. Add `tree` / `filetree` branch to the code block renderer in `MarkdownRenderer.tsx`.
3. Test with a sample ```` ```tree ```` block in a doc.

**Estimated scope:** ~150 lines of new React, 10 lines in MarkdownRenderer.

### Phase 2 — File Inclusion (Feature 2)

1. Add `processFileInclusions()` function to `build-docs-index.js`. Include the path traversal guard (resolved path must start with `DOCS_ROOT`).
2. Restructure `copyFiles()` to read `.md` content, run `processFileInclusions`, and write the result (instead of `fs.copyFileSync` for `.md` files).
3. Update `azure-devops.md` to use `<<< ./entra-setup/main.tf` instead of the plain link.
4. Add authoring note to `DOCUMENTATION_STANDARDS.md`.

**Estimated scope:** ~60 lines in the build script.

### Phase 3 — Code Explorer (Feature 3)

1. Extend `build-docs-index.js`: add `processCodeExplorers()` function that scans `.md` files for `::: code-explorer` directives, copies example directory files, and generates `.explorer.json` manifests. Call from `main()` after `copyFiles()`.
2. Extend the remark plugin in `MarkdownRenderer.tsx` following the five-step pattern in "Critical Implementation Context": detection function, AST node, hast handler (`codeExplorerToHast`), handler registration in `remarkRehypeOptions.handlers`, and `markdownComponents.codeexplorer` entry.
3. Add `CodeExplorer.tsx` component.
4. Test with the `entra-setup/` directory.

**Estimated scope:** ~250 lines of new React, ~80 lines in the build script, ~40 lines in the remark plugin.

---

## What This Does NOT Include

- In-browser code editing (read-only viewer only).
- Live Terraform plan preview or shell execution.
- External sandboxes (StackBlitz, CodeSandbox).
- File watching / hot reload of example files during development (the build script runs once; `make fresh-frontend` re-runs it).
- Syntax highlighting for languages not supported by Shiki (Shiki covers all languages in the extension map above).

---

## Phase 4 Extensions

> **Status: IMPLEMENTED** — Features 4, 5, 6, and 7 implemented 2026-03-09.
> Final state documented below reflects the actual codebase, including design decisions made during implementation.

Four new features extend the Code Explorer beyond its initial implementation.

---

### Phase 4 — Actual Implementation (2026-03-09)

This section describes the codebase as it exists after Phase 4 was implemented. All design decisions, trade-offs, and non-obvious choices are documented here.

#### `frontend/src/components/docs/fileTypeIcons.ts`

New file. Exports `getFileTypeIcon(name: string): string | null`. Maps file extensions to `/icons/file-types/<name>.svg` paths. Returns `null` for unknown extensions (callers fall back to Lucide `File`).

```ts
const BASE = '/icons/file-types';
const EXT_TO_ICON: Record<string, string> = {
  tf: 'terraform', tfvars: 'terraform', go: 'go', ts: 'typescript',
  tsx: 'typescript', js: 'javascript', jsx: 'javascript', py: 'python',
  yaml: 'yaml', yml: 'yaml', sh: 'shell', bash: 'shell',
  json: 'json', jsonc: 'json', toml: 'toml', md: 'markdown',
  rs: 'rust', java: 'java',
};
export function getFileTypeIcon(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const icon = EXT_TO_ICON[ext];
  return icon ? `${BASE}/${icon}.svg` : null;
}
```

#### `frontend/public/icons/file-types/` (14 SVG files)

SVGs sourced from **material-extensions/vscode-material-icon-theme** via jsDelivr CDN (`cdn.jsdelivr.net/npm/material-icon-theme@latest/icons/`). These are the canonical VS Code file type icons (MIT licensed). The `shell.svg` maps to `console.svg` from the theme (the theme does not have a file named `shell.svg`).

Files: `terraform.svg`, `typescript.svg`, `javascript.svg`, `python.svg`, `go.svg`, `yaml.svg`, `shell.svg`, `json.svg`, `toml.svg`, `markdown.svg`, `rust.svg`, `java.svg`, `folder.svg`, `folder-open.svg`.

#### `CodeExplorer.tsx` — file tree row design

**Directory rows** use `<img>` tags with `FOLDER_ICON`/`FOLDER_OPEN_ICON` constants (not Lucide `Folder`/`FolderOpen`). The folder icon itself communicates open/closed state — no ChevronRight was added, which would have been redundant and visually cluttered.

```tsx
const FOLDER_ICON = '/icons/file-types/folder.svg';
const FOLDER_OPEN_ICON = '/icons/file-types/folder-open.svg';

// In FileTree, directory node button:
<img src={isOpen ? FOLDER_OPEN_ICON : FOLDER_ICON} alt="" aria-hidden className="h-3.5 w-3.5 shrink-0" loading="lazy" />
```

**File rows** use `getFileTypeIcon(node.name)` → `<img>` if an icon exists, otherwise Lucide `<File>` as fallback.

**Row padding**: `py-px` (1px top + 1px bottom). With `text-sm` (20px line-height) this gives 22px rows — same density as VS Code. `py-0.5` (2px × 2 = 4px padding, 24px rows) was visually too spacious.

#### `CodeExplorer.tsx` — header and action buttons

All action buttons are **icon-only** (no text labels). A shared `actionButtons` JSX variable is defined once and rendered in both the inline header and the dialog header:

```tsx
const actionButtons = (
  <div className="flex items-center gap-3">
    {manifest.source?.type === 'github' && (
      <a href={manifest.source.url} target="_blank" rel="noopener noreferrer" ...>↗</a>
    )}
    <button onClick={() => { void handleDownload(); }} ...><Download className="h-3.5 w-3.5" /></button>
    <button onClick={() => { void handleCopy(); }} ...>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  </div>
);
```

Inline header appends `<Maximize2>` button after `{actionButtons}`. Dialog header appends `<Minimize2>` button that calls `setExpanded(false)`.

#### `CodeExplorer.tsx` — dialog (fullscreen) layout

The dialog uses Radix UI's `DialogContent`, which has `display: grid` baked in via the shadcn/ui defaults. Tailwind classes cannot reliably override this because `grid` appears after `flex` alphabetically in the generated stylesheet (so `grid` wins). The fix is **inline styles**, which always have higher specificity than class-based styles:

```tsx
<DialogContent
  hideCloseButton
  className="not-prose max-w-[90vw] p-0 gap-0 overflow-hidden"
  style={{ height: '90vh', display: 'flex', flexDirection: 'column' }}
>
```

- `hideCloseButton` — custom prop added to `dialog.tsx` to suppress the hardcoded Radix close button, which was overlapping the action buttons.
- `gap-0` — suppresses shadcn's default `gap-4` between header and body.
- `style={{ display: 'flex', flexDirection: 'column' }}` — beats Tailwind `grid` precedence.

The dialog body uses `flex flex-1 min-h-0 overflow-hidden` to fill remaining height below the header.

#### `dialog.tsx` — `hideCloseButton` prop

Added to `DialogContent`:

```tsx
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideCloseButton?: boolean }
>(({ className, children, hideCloseButton = false, ...props }, ref) => (
  ...
  {!hideCloseButton && (
    <DialogPrimitive.Close ...><X className="h-4 w-4" /></DialogPrimitive.Close>
  )}
```

#### `CodeExplorer.tsx` — shared rendering variables

`codePaneContent` is a JSX variable computed once (loading skeleton / Shiki-highlighted HTML / "No file selected" placeholder) and rendered in both inline and dialog code panes. This avoids a separate `<ExplorerBody>` component — the code pane content is purely derived from state, not stateful itself.

#### `FileTreeViewer.tsx` — updated

`getFileIcon(name)` now checks `getFileTypeIcon(name)` first. If it returns a path, renders `<img src={path} alt="" aria-hidden className="h-4 w-4 shrink-0" loading="lazy" />`. Falls back to Lucide `File` for unknown extensions. Lucide `Folder` (not `getFileTypeIcon`) is still used for directories in `FileTreeViewer` since it only shows static trees (not interactive open/close states).

#### `scripts/build-docs-index.js` — GitHub fetch

`processCodeExplorers(mdFiles)` is now `async`. When the path starts with `github:`, it calls `fetchGitHubExplorer(spec, destBase)` which uses the GitHub Contents API to recursively fetch directory trees and write files to `PUBLIC_DOCS/_github/<org>/<repo>/<ref>/<path>/`. The manifest includes a `source` field with `type: 'github'` and a `url` to the GitHub tree view.

Respects `GITHUB_TOKEN` env var for authenticated requests (60 req/hr unauthenticated, 5,000 req/hr authenticated).

#### `MarkdownRenderer.tsx` — `codeexplorer` handler

When `data-path` starts with `github:`, the handler resolves it to `_github/<org>/<repo>/<ref>/<path>` before passing to `<CodeExplorer path={...}>`. Local paths (`./`, `../`) resolve against `currentDir` as before.

---

### Feature 4: Language-Specific File Icons

**Status: IMPLEMENTED.** See "Phase 4 — Actual Implementation" above for the definitive implementation record.

**Summary of what was built:**
- 14 SVG icons from material-icon-theme in `frontend/public/icons/file-types/`
- `fileTypeIcons.ts` shared helper
- CodeExplorer: file rows use `<img>` via `getFileTypeIcon`, directory rows use `folder.svg`/`folder-open.svg` `<img>` (not Lucide `Folder`)
- FileTreeViewer: `getFileIcon()` checks `getFileTypeIcon` first, falls back to Lucide `File`
- Row padding `py-px` for 22px VS Code density

---

### Feature 5: ZIP Download

**Status: IMPLEMENTED.** See "Phase 4 — Actual Implementation" above.

**Summary of what was built:**
- `handleDownload` in `CodeExplorer` using lazy `import('jszip')`
- `downloading` state with `disabled` on the button while in progress
- Icon-only `<Download>` button in `actionButtons` shared variable
- jszip installed as a frontend dependency

---

### Feature 6: GitHub Repository Sources

**What it does**

Allows a `::: code-explorer` directive to point to a public GitHub repository path instead of a local directory. The referenced code lives in its own repository, is independently versioned, and is fetched at either build time (recommended) or render time. This makes it possible to maintain example projects as first-class repos and embed them in docs without copying files.

**Authoring syntax**

```markdown
::: code-explorer github:org/repo/path@ref
:::
```

The `github:` prefix is the discriminator. Examples:

```markdown
::: code-explorer github:hashicorp/terraform-provider-azuread/examples/basic@main
:::

::: code-explorer github:stackweaver-oss/examples/entra-setup@v1.2.0 default="main.tf"
:::
```

The `@ref` suffix is optional; defaults to `HEAD` / `main`.

**Build-time approach (recommended, Phase A)**

The build script resolves `github:org/repo/path@ref`, fetches the directory tree and file contents from the GitHub API, writes them to `public/docs/_github/<org>/<repo>/<ref>/<path>/`, and generates the `.explorer.json` manifest as usual. The runtime component is completely unaware of the source — it just fetches from `/docs/...` as it does today.

Pros: No API calls at render time; files are cached statically; no CORS issues; works the same as local explorers.
Cons: Requires a GitHub token for private repos or to avoid rate limits; rebuilding docs is needed to pick up upstream changes.

**Important:** `processCodeExplorers()` is currently synchronous. Adding GitHub fetch support requires making it `async` and updating the call in `main()` from `processCodeExplorers(mdFiles)` to `await processCodeExplorers(mdFiles)`. Since `main()` is already `async`, this is a one-line change.

The `fetch` API is available natively in Node.js 18+ (which the build container uses). No additional HTTP library is needed.

```js
// In build-docs-index.js: processCodeExplorers(), GitHub branch

async function fetchGitHubExplorer(spec, destBase) {
  // spec = { org, repo, path, ref }
  const apiBase = `https://api.github.com/repos/${spec.org}/${spec.repo}/contents/${spec.path}?ref=${spec.ref}`;
  const headers = process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {};

  // Recursively fetch directory listing
  async function fetchDir(apiPath, localPath) {
    const res = await fetch(apiPath, { headers });
    const entries = await res.json();
    for (const entry of entries) {
      if (entry.type === 'dir') {
        await fetchDir(entry.url, path.join(localPath, entry.name));
      } else if (entry.type === 'file') {
        const raw = await fetch(entry.download_url, { headers });
        const content = await raw.text();
        const dest = path.join(destBase, localPath, entry.name);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, content, 'utf-8');
      }
    }
  }

  await fetchDir(apiBase, '');
}
```

Rate limit: the GitHub API allows 60 unauthenticated requests per hour and 5,000 with a token. Set `GITHUB_TOKEN` in the build environment (not in user-facing env files — add to the build container's env or CI secrets).

**Runtime-only approach (Phase B, optional enhancement)**

For repos that update frequently, an optional runtime fetch mode can be added. The `::: code-explorer github:org/repo/path@ref live` attribute disables build-time caching; the component fetches the GitHub Contents API directly at render time. This works for public repos without a token. Implement rate-limit fallback: if the API returns 403, show a message with a link to the GitHub directory.

```tsx
// Runtime GitHub manifest fetch (no build step)
// extToLang must be duplicated or shared from a common module — currently it only exists
// in build-docs-index.js (CommonJS). Either extract to a shared .js file or duplicate
// the extension→language map as a const in CodeExplorer.tsx.
async function fetchGitHubManifest(org: string, repo: string, path: string, ref: string) {
  const url = `https://api.github.com/repos/${org}/${repo}/git/trees/${ref}?recursive=1`;
  const res = await fetch(url);
  const data = await res.json() as { tree: { path: string; type: string }[] };
  const files = data.tree
    .filter(e => e.type === 'blob' && e.path.startsWith(path + '/'))
    .map(e => ({
      path: e.path.slice(path.length + 1),
      lang: extToLang(e.path),
    }));
  return { root: path.split('/').pop() ?? path, files };
}
```

File content URL: `https://raw.githubusercontent.com/${org}/${repo}/${ref}/${path}/${file.path}`

No CORS issue: `raw.githubusercontent.com` allows cross-origin reads for public repos.

**Directive parsing change**

In `isCodeExplorerStart` (MarkdownRenderer.tsx line 223), the function currently returns `{ path, defaultFile, selfClosed }`. Extend it to also detect the `github:` prefix and parse the spec:

```ts
function isCodeExplorerStart(node: unknown): {
  path: string;
  defaultFile: string;
  selfClosed: boolean;
  github: { org: string; repo: string; path: string; ref: string } | null;
} | null {
  // ... existing firstLine extraction ...
  const match = /^:::\s*code-explorer\s+(\S+)(?:\s+default="([^"]+)")?\s*$/i.exec(firstLine);
  if (!match) return null;
  const rawPath = match[1];
  let github = null;
  if (rawPath.startsWith('github:')) {
    // Parse github:org/repo/path@ref
    const ghMatch = /^github:([^/]+)\/([^/]+)\/(.+?)(?:@(.+))?$/.exec(rawPath);
    if (ghMatch) {
      github = { org: ghMatch[1], repo: ghMatch[2], path: ghMatch[3], ref: ghMatch[4] || 'main' };
    }
  }
  // ... existing selfClosed detection ...
  return { path: rawPath, defaultFile: match[2] ?? '', selfClosed, github };
}
```

The `github` field propagates through the chain:

1. **AST node** (in `remarkCodeGroup` visit loop): `{ type: 'codeExplorer', path, defaultFile, github }`
2. **`codeExplorerToHast()`** (line 358): Serialize `github` fields to individual `data-` attributes:
   ```ts
   properties: {
     'data-path': n.path ?? '',
     'data-default': n.defaultFile ?? '',
     'data-github-org': n.github?.org ?? '',
     'data-github-repo': n.github?.repo ?? '',
     'data-github-path': n.github?.path ?? '',
     'data-github-ref': n.github?.ref ?? '',
   },
   ```
3. **`markdownComponents.codeexplorer`** (line 695): Read the `data-github-*` attributes and pass as a `github` prop to `<CodeExplorer>`.
4. **`CodeExplorerProps`**: Add `github?: { org: string; repo: string; path: string; ref: string }`.

Do NOT serialize the whole `github` object as JSON in a single `data-` attribute — individual attributes are cleaner and avoid JSON parse overhead.

**Manifest format extension**

The current `ExplorerManifest` interface in `CodeExplorer.tsx` (line 11) is:

```ts
interface ExplorerManifest {
  root: string;
  files: ExplorerFile[];
}
```

Add an optional `source` field:

```ts
interface ExplorerSource {
  type: 'github';
  org: string;
  repo: string;
  path: string;
  ref: string;
  url: string;
}

interface ExplorerManifest {
  root: string;
  files: ExplorerFile[];
  source?: ExplorerSource;
}
```

For GitHub-sourced explorers, the build script generates:

```json
{
  "root": "entra-setup",
  "source": {
    "type": "github",
    "org": "stackweaver-oss",
    "repo": "examples",
    "path": "entra-setup",
    "ref": "v1.2.0",
    "url": "https://github.com/stackweaver-oss/examples/tree/v1.2.0/entra-setup"
  },
  "files": [
    { "path": "main.tf", "lang": "hcl" },
    { "path": "variables.tf", "lang": "hcl" }
  ]
}
```

The `source` field lets the UI show a "View on GitHub ↗" link in the explorer header. For local (non-GitHub) explorers, `source` is omitted and the manifest stays backward compatible.

**GitHub link in the header**

When `manifest.source?.type === 'github'`, add a `<a>` link with the Lucide `ExternalLink` icon (already available in the `lucide-react` package) to the explorer header, placed between the directory name and the action buttons. Style it as `text-xs text-muted-foreground hover:text-foreground` matching the existing Copy button. Opens `manifest.source.url` in a new tab (`target="_blank" rel="noopener noreferrer"`). This makes the provenance of the example clear and gives users a path to the full repo history.

Note: When both GitHub link (Feature 6) and Download button (Feature 5) are present, the header right-side should group them: `[GitHub ↗] [Download] [Copy]`.

**Estimated scope:** ~100 lines in build script (Phase A), ~80 lines in `CodeExplorer.tsx` for runtime path + header link, 10 lines in remark plugin.

---

## Implementation Order (Phase 4)

| Priority | Feature | Effort | Value |
|---|---|---|---|
| 1 | Feature 4: Language icons | Low | Medium — polish |
| 2 | Feature 5: ZIP download | Low | High — core UX |
| 3 | Feature 6: GitHub sources (build-time) | Medium | Very high — scalability |
| 4 | Feature 6: GitHub sources (runtime/live) | Medium | Medium — only needed for high-churn repos |

Implement features 4 and 5 first since they touch only the existing `CodeExplorer.tsx` and `FileTreeViewer.tsx`. Feature 6 Phase A requires a build script extension; Feature 6 Phase B is purely additive to the component.

All features are independent — they can be implemented and shipped separately without coordination.

---

### Feature 7: Expand / Fullscreen Mode

**Status: IMPLEMENTED.** See "Phase 4 — Actual Implementation" above for the dialog layout details (inline style vs Tailwind class conflict, `hideCloseButton`, `gap-0`).

**Summary of what was built:**
- `expanded` state in `CodeExplorer`
- Inline header: `<Maximize2>` icon button → `setExpanded(true)`
- Dialog header: `<Minimize2>` icon button → `setExpanded(false)` (icon changes in-context, no modal X button)
- `codePaneContent` JSX variable shared between inline and dialog — no `<ExplorerBody>` component needed
- `actionButtons` JSX variable also shared, rendering identically in both headers
- Dialog `onOpenChange={setExpanded}` handles backdrop click and Escape to close
- `hideCloseButton` on `DialogContent` prevents the default Radix X from overlapping action buttons
- Dialog layout via `style={{ display: 'flex', flexDirection: 'column' }}` to beat Tailwind `grid` precedence

#### UX behaviour

- **Trigger**: `Maximize2` icon button in the inline header (rightmost button).
- **Overlay**: shadcn `Dialog` at `max-w-[90vw]` × `90vh`.
- **Content**: same explorer layout (header + file tree + code pane). Active file selection is shared state — switching files in either view updates both.
- **Closing**: backdrop click, Escape, or `<Minimize2>` button in dialog header.
- **Manifest cache**: module-level `manifestCache` Map ensures the dialog never re-fetches data already loaded.

#### Integration points

- `frontend/src/components/docs/CodeExplorer.tsx` — only file modified.
- `frontend/src/components/ui/dialog.tsx` — `hideCloseButton` prop added.

---

## Phase 5: Bug Fixes (2026-03-09)

> **Status: FIXED 2026-03-09** — All bugs fixed. Root cause was `.markdown-content img { @apply my-4 h-auto }` and `.markdown-content li { @apply mb-2 }` leaking into file tree components. Inline styles override both. Dialog view was unaffected because Radix portals render outside `.markdown-content`.

### Bug 1: Inline explorer — file tree vertical spacing is broken

> **Partial fix applied 2026-03-09:** Added `style={{ margin: 0 }}` to `<li>` elements — this fixed a secondary issue where `.markdown-content li { @apply mb-2 }` added 8px bottom margin. **The primary cause remains unfixed** — see below.

**Symptom:** In the inline (non-expanded) CodeExplorer, file tree items have large inconsistent vertical gaps. Entries with custom SVG icons (`<img>` tags — terraform.svg, folder-blue.svg, etc.) have ~32px of extra vertical space (16px above + 16px below each icon). Entries that fall back to Lucide inline `<svg>` icons (the `<File>` component) render correctly with tight spacing. The expanded (dialog) view works correctly for ALL entries.

**Root cause:** The CSS rule in `frontend/src/index.css` line 372–374:

```css
.markdown-content img {
  @apply max-w-full h-auto rounded-lg my-4;
}
```

This rule targets **every `<img>` element inside `.markdown-content`**. The CodeExplorer's `FileTree` component renders file type icons as `<img src="/icons/file-types/terraform.svg" className="h-3.5 w-3.5 shrink-0" />`. The `.markdown-content img` selector has specificity (0, 1, 1) — higher than the utility class `h-3.5` at (0, 1, 0). This causes:

1. **`my-4` adds `margin-top: 1rem` + `margin-bottom: 1rem`** (16px + 16px = 32px extra vertical space per icon). This is the primary cause of the large gaps between file tree items.
2. **`h-auto` overrides `h-3.5`** — though with the 1:1 aspect ratio of the SVGs and `w-3.5` constraining width, `height: auto` still resolves to ~14px, so height itself isn't visibly wrong.
3. **`rounded-lg`** adds unnecessary border radius to 14×14px icons (cosmetic, not a layout issue).

Lucide icons render as inline `<svg>` elements, NOT `<img>` tags. The `.markdown-content img` rule does not match `<svg>`, so Lucide icons are unaffected — confirming the user observation that "other entries with icons from that other pack don't have it."

In the expanded (dialog) view, the Radix `<Dialog>` portal renders outside `.markdown-content`, so `.markdown-content img` does not match — icons render correctly.

**Fix (TWO CHANGES NEEDED):**

**Change 1 — Add inline style to `<img>` icons in `FileTree`:**

On both `<img>` elements in the `FileTree` component (folder icon ~line 111 and file icon ~line 146 of `CodeExplorer.tsx`), add `style={{ margin: 0 }}` to override `my-4`:

```tsx
// Folder icon (directory node, ~line 111)
<img src={isOpen ? FOLDER_OPEN_ICON : FOLDER_ICON} alt="" aria-hidden className="h-3.5 w-3.5 shrink-0" loading="lazy" style={{ margin: 0, height: '0.875rem' }} />

// File icon (file node, ~line 146)
<img src={icon} alt="" aria-hidden className="h-3.5 w-3.5 shrink-0" loading="lazy" style={{ margin: 0, height: '0.875rem' }} />
```

Inline styles have the highest specificity (1, 0, 0, 0), overriding `.markdown-content img`.

The `height: '0.875rem'` (equivalent to `h-3.5`) is needed because `h-auto` from `.markdown-content img` also overrides the utility class. Without an inline height, the icon height depends on the SVG's intrinsic dimensions scaled by `w-3.5`.

**Change 2 — Same fix in `FileTreeViewer.tsx`:**

The `getFileIcon()` function (line 13) renders `<img>` tags for custom icons. Add the same inline style:

```tsx
function getFileIcon(name: string): ReactNode {
  const icon = getFileTypeIcon(name);
  if (icon) {
    return <img src={icon} alt="" aria-hidden className="h-4 w-4 shrink-0" loading="lazy" style={{ margin: 0, height: '1rem' }} />;
  }
  return <File className="h-4 w-4 shrink-0 text-muted-foreground" />;
}
```

Note: `FileTreeViewer` uses `h-4 w-4` (16px) while `CodeExplorer` uses `h-3.5 w-3.5` (14px). The inline `height` value must match the utility class.

**Files to modify:**
- `frontend/src/components/docs/CodeExplorer.tsx` — both `<img>` tags in `FileTree` component (~lines 111 and 146)
- `frontend/src/components/docs/FileTreeViewer.tsx` — `getFileIcon()` function (~line 16)

**Verification:** After the fix, compare the inline and expanded file trees. All entries (both custom SVG icons and Lucide fallback icons) should have identical row spacing (~22px per row with `py-px` padding in CodeExplorer, ~24px with `space-y-0.5` in FileTreeViewer). No large gaps between items.

---

### Bug 2: Expanded (dialog) view — grey background on code pane

> **Status: FIXED 2026-03-09.**

**Symptom:** In the expanded/fullscreen dialog view, the code pane showed a visible grey background behind the syntax-highlighted code, caused by Shiki's inline `background-color` not being overridden outside `.markdown-content`.

**Fix applied:** CSS rules added to strip Shiki background in code explorer regardless of parent context.

---

### Bug 3: Dialog missing accessible title (Radix console warning)

**Symptom:** Radix UI's `Dialog` component requires either a `<DialogTitle>` child or `aria-label`/`aria-labelledby` on `<DialogContent>` for accessibility. The current implementation has neither. Radix emits a console warning: *"Missing `Description` or `aria-describedby={undefined}` ...`* and *"Missing `Title`..."*.

**Root cause:** The `<DialogContent>` in `CodeExplorer.tsx` (line 419) uses `hideCloseButton` but provides no `<DialogTitle>` and no `aria-label`.

**Fix:** Add `aria-label={rootName}` to the `<DialogContent>` element and add `aria-describedby={undefined}` to suppress the description warning:

```tsx
<DialogContent
  hideCloseButton
  aria-label={rootName}
  aria-describedby={undefined}
  className="not-prose max-w-[90vw] p-0 gap-0 overflow-hidden"
  style={{ height: '90vh', display: 'flex', flexDirection: 'column' }}
>
```

Alternatively, add a visually-hidden `<DialogTitle>`:

```tsx
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
// inside DialogContent:
<VisuallyHidden><DialogTitle>{rootName}</DialogTitle></VisuallyHidden>
```

The `aria-label` approach is simpler and avoids adding a new dependency import.

**Files to modify:**
- `frontend/src/components/docs/CodeExplorer.tsx` — `<DialogContent>` element (~line 419)

**Verification:** Open browser DevTools console, expand the code explorer to fullscreen. No Radix accessibility warnings should appear.

---

### Bug 4: Inline explorer header height mismatch in body calc

**Symptom:** The inline explorer body height is calculated as `calc(100% - 2.25rem)` (line 402), but the actual header height may not be exactly `2.25rem` (36px). The header uses `py-2` (0.5rem = 8px top + 8px bottom = 16px padding) plus `text-xs` content (12px font with 16px line-height) plus `border-b` (1px). Total: 16px + 16px + 1px = 33px ≈ `2.0625rem`, not `2.25rem`. This 3px gap means the body is 3px shorter than available space, leaving a tiny sliver at the bottom.

**Root cause:** The `calc(100% - 2.25rem)` is a hard-coded approximation of the header height.

**Fix:** Replace the fixed-height layout with a flexbox approach that doesn't require height calculation:

```tsx
{/* Outer container — use flex-col instead of fixed height math */}
<div className="not-prose my-4 rounded-md border border-border/40 overflow-hidden flex flex-col" style={{ height: '480px' }}>
  {/* Header — shrink-0 */}
  <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-muted/30 shrink-0">
    ...
  </div>

  {/* Body — flex-1 + min-h-0 fills remaining space */}
  <div className="flex flex-1 min-h-0">
    ...
  </div>
</div>
```

This is the same pattern already used successfully in the dialog layout (line 438: `<div className="flex flex-1 min-h-0 overflow-hidden">`), making the two views consistent.

**Files to modify:**
- `frontend/src/components/docs/CodeExplorer.tsx` — inline explorer outer `<div>` (~line 383) and body `<div>` (~line 402)

**Verification:** The body should fill exactly the remaining space below the header. No gap or overflow at the bottom.

---

### Bug 5: `FileTreeViewer` also affected by `.markdown-content li` margins AND `img` margins

> **Partial fix applied 2026-03-09:** `<li>` margin fix applied. **`<img>` margin issue remains unfixed** — see below.

**Symptom:** The `FileTreeViewer` component (used for ` ```tree ` blocks) has two issues inside `.markdown-content`:
1. `<li>` elements got `mb-2` from `.markdown-content li` — **fixed** by adding `style={{ margin: 0 }}`.
2. `<img>` icons (from `getFileIcon()`) get `my-4` (16px top+bottom margin) and `h-auto` from `.markdown-content img { @apply max-w-full h-auto rounded-lg my-4 }` — **same root cause as Bug 1**.

Entries using Lucide `<File>` SVG fallback render correctly; entries with custom `<img>` icons have 32px extra vertical space.

**Fix:** Already described in Bug 1, Change 2. Add `style={{ margin: 0, height: '1rem' }}` to the `<img>` in `getFileIcon()` (~line 16 of `FileTreeViewer.tsx`).

---

### Bug 6: `FileTreeViewer` `<ul>` also gets unwanted left margin from `.markdown-content`

**Symptom:** The `FileTreeViewer.tsx` outer `<ul>` at line 77 uses `className="space-y-0.5"` but has no inline margin/padding override. The `.markdown-content ul { @apply mb-4 ml-6 }` rule adds `margin-left: 1.5rem` and `margin-bottom: 1rem` to this `<ul>`, shifting the entire tree to the right and adding bottom space.

**Root cause:** Unlike `CodeExplorer`'s `FileTree` component (which uses inline styles on `<ul>` to override), `FileTreeViewer` relies only on Tailwind classes.

**Fix:** Add inline styles to the `<ul>` in `FileTreeViewer.tsx`:

```tsx
<ul className="space-y-0.5" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
```

**Files to modify:**
- `frontend/src/components/docs/FileTreeViewer.tsx` — `<ul>` element (~line 77)

**Verification:** The file tree diagram should align flush with the left edge of the container (respecting the `p-4` padding on the outer `<div>`), with no extra left indentation from `ml-6`.

---

### Summary of all fixes

| Bug | Component | Issue | Fix approach |
|---|---|---|---|
| 1 | CodeExplorer (inline) | `<img>` file icons get `my-4` (32px margin) + `h-auto` from `.markdown-content img` — Lucide `<svg>` icons unaffected | Add `style={{ margin: 0, height: '0.875rem' }}` to `<img>` tags in `FileTree`; `<li>` margin already fixed |
| 2 | CodeExplorer (dialog) | ~~Shiki `<pre>` background not overridden outside `.markdown-content`~~ | **FIXED 2026-03-09** |
| 3 | CodeExplorer (dialog) | Missing `<DialogTitle>` / `aria-label` causing Radix console warnings | Add `aria-label={rootName}` and `aria-describedby={undefined}` to `<DialogContent>` |
| 4 | CodeExplorer (inline) | Header height hardcoded as `2.25rem` in `calc()`, doesn't match actual height | Use flexbox `flex-col` + `flex-1 min-h-0` instead of `calc()` |
| 5 | FileTreeViewer | `<img>` icons get `my-4` + `h-auto` from `.markdown-content img` (same as Bug 1); `<li>` margin already fixed | Add `style={{ margin: 0, height: '1rem' }}` to `<img>` in `getFileIcon()` |
| 6 | FileTreeViewer | `<ul>` gets `ml-6 mb-4` from `.markdown-content ul` | Add inline styles `{ listStyle: 'none', margin: 0, padding: 0 }` to `<ul>` |

---

## What This Does NOT Include

- In-browser code editing (read-only viewer only).
- Live Terraform plan preview or shell execution.
- External sandboxes (StackBlitz, CodeSandbox).
- File watching / hot reload of example files during development (the build script runs once; `make fresh-frontend` re-runs it).
- Syntax highlighting for languages not supported by Shiki (Shiki covers all languages in the extension map above).
- Private GitHub repository access from the browser (build-time fetch with `GITHUB_TOKEN` covers private repos; runtime fetch is public-only).

---

## Relationship to Image Support Plan

Image support (see `docs-image-support-plan.md`) and this plan both require build script changes. When implementing, coordinate the following:

- `build-docs-index.js` will need three additions in close proximity: image copying (image plan), file inclusion processing (Feature 2 here), and code-explorer manifest generation (Feature 3 here).
- Implement image support first (simpler, self-contained); then add file inclusion as a second pass in `copyFiles()`; then add code-explorer manifest generation as a third pass.
- `MarkdownRenderer.tsx` will grow two new custom element handlers: `img` (image plan) and `codeexplorer` (Feature 3). These are independent and can be added in either order.
