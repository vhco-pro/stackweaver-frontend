# Docs Viewer: Image Support Plan

## Status: IMPLEMENTED ✅

All sections below are implemented. See the test page at `docs/test-images.md` to verify behaviour in the running docs viewer.

---

## Goal

Allow documentation authors to embed images in markdown files using standard syntax, with behaviour that mirrors GitHub's markdown viewer: relative paths resolve correctly, images are styled cleanly, captions are supported, and lazy loading is applied by default.

## Current State (at time of writing)

- `build-docs-index.js` scans `docs/` for `.md` files only and copies them to `frontend/public/docs/`, preserving directory structure.
- `MarkdownRenderer.tsx` uses `react-markdown` + `rehype-raw` but has no custom `img` handler; images with relative `src` paths would be resolved by the browser against the current URL (e.g. `/docs/features/terraform/screenshot.png`), which would work if the file was present, but images are never copied because the build script ignores non-`.md` files.
- No image files currently exist in `docs/` except `docs/internal/image.png` (internal only).

## Chosen Approach

**Store images co-located with their markdown files** inside `docs/`, using standard relative paths in markdown syntax. This mirrors GitHub's convention (e.g. `docs/features/terraform/` holds both `run-timeout.md` and `run-timeout-screenshot.png`).

Images are served from `frontend/public/docs/` at runtime (the same location as the markdown files), so relative paths in `![alt](./image.png)` resolve correctly in the browser without any extra URL rewriting.

## Critical Implementation Context

These facts are essential for correct implementation. Read before starting.

### Build script is CommonJS

`scripts/build-docs-index.js` uses `require()` / `module.exports` / `require.main === module`. All code examples in this plan that show `import` syntax (e.g. `import sharp from 'sharp'`) must be translated to `require()` calls:

```js
const { optimize } = require('svgo')
const sharp = require('sharp')
```

Do NOT convert the file to ESM, as that would break the `require.main === module` entry point.

### `copyFiles()` nukes the output directory

`copyFiles()` starts with `fs.rmSync(PUBLIC_DOCS, { recursive: true, force: true })`. This means if you call `copyFiles(mdFiles)` then `copyFiles(imageFiles)`, the second call deletes the first's output. Both file lists must be combined into a single `copyFiles()` call, OR the function must be refactored to only clean on the first call. The simplest approach: collect all files (md + images) into one array, call `copyFiles` once, and only pass the md subset to `buildTree`.

### Image cache manifest must live outside `PUBLIC_DOCS`

Because `copyFiles` deletes and recreates `PUBLIC_DOCS` on every run, the `.image-cache.json` manifest for skipping unchanged images must be stored outside it, e.g. at `frontend/.image-cache.json`.

### `copyFiles` is synchronous but `sharp` is async

`copyFiles()` uses `fs.copyFileSync`. The `sharp` API is async (`await sharp(...).toFile(...)`). When adding image optimisation, `copyFiles` must become an `async` function, and `main()` must `await` it. The script's entry point `if (require.main === module)` block should wrap the call: `main().catch(err => { console.error(err); process.exit(1); })`.

### `useTheme` is NOT imported in MarkdownRenderer.tsx

The plan's Section 7 incorrectly claims `ThemeContext` is "already imported in `MarkdownRenderer.tsx` for the Shiki highlighter". **It is not.** The file detects theme changes via a `MutationObserver` on `document.documentElement` class changes (see the `useEffect` around line 362). You must add a new import:

```ts
import { useTheme } from '@/contexts/ThemeContext';
```

`useTheme()` returns `{ theme, setTheme, resolvedTheme }` where `theme` can be `'light' | 'dark' | 'system'` and `resolvedTheme` is always `'light' | 'dark'`. Use `resolvedTheme === 'dark'` for dark mode checks, not `theme === 'dark'` (which misses the `'system'` case).

### The `img` handler must be a standalone component (not inline in `useMemo`)

All component handlers in `markdownComponents` are defined inside a `useMemo` block (line ~383). When the memo's dependencies change (theme, highlight state, copiedCodeId, etc.), React sees entirely new component functions, unmounts old instances, and remounts, **resetting all hook state**. This means `useState` / `useEffect` hooks defined inside a `useMemo`-returned component will lose state on every recomputation.

The `img` handler uses `useState` for `darkFailed` and `useEffect` to reset it. These hooks **must not** be defined inside the `useMemo` closure. Instead, extract a standalone `DocImage` component defined OUTSIDE the `useMemo` (either at module level or as a named function component in the same file):

```tsx
interface DocImageProps {
  src?: string;
  alt?: string;
  title?: string;
  currentDir: string;
  onLightbox: (src: string, alt: string) => void;
}

function DocImage({ src, alt, title, currentDir, onLightbox }: DocImageProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [darkFailed, setDarkFailed] = useState(false);
  // ... path resolution, dark variant, rendering
}
```

Then inside the `useMemo` `markdownComponents` object:

```tsx
img: (props: MarkdownImageProps) => (
  <DocImage
    {...props}
    currentDir={currentDir}
    onLightbox={(src, alt) => { setLightboxSrc(src); setLightboxAlt(alt); }}
  />
)
```

The `currentDir` value can be computed once before `useMemo` (or inside it) using the existing logic from the `a` handler, and passed as a prop.

### Lightbox Dialog import

The lightbox uses shadcn/ui `Dialog`. Add this import to `MarkdownRenderer.tsx`:

```tsx
import { Dialog, DialogContent } from '@/components/ui/dialog';
```

The dialog component file exports: `Dialog`, `DialogTrigger`, `DialogPortal`, `DialogClose`, `DialogOverlay`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`. Only `Dialog` and `DialogContent` are needed.

### Dependency installation

Add `sharp` and `svgo` as `devDependencies` in `frontend/package.json`:

```bash
cd frontend && npm install --save-dev sharp svgo
```

Both packages resolve correctly in the Docker build container (Linux x64). After modifying `package.json`, run `make frontend-install` to update the container.

---

## Changes Required

### 1. ✅ `scripts/build-docs-index.js`: copy image files alongside markdown

The `scanDocsDir` function currently filters to `.md` only. Extend it to also collect image files (`.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.avif`).

Image files are added to a separate `imageFiles` list (not the `files` list used for the navigation tree/index; they should not appear in the sidebar). The `copyFiles` function is called for both lists.

Specifically:
- In the `entry.isFile()` branch inside `scanDocsDir`, also collect entries matching `/\.(png|jpe?g|gif|svg|webp|avif)$/i`.
- Return `{ mdFiles, imageFiles }` from `scanDocsDir` (or keep a single list with a `type` field).
- In `main()`, copy both lists; only pass `mdFiles` to `buildTree`.
- Do NOT index image files in the navigation `flat` map.

Internal images (under `docs/internal/`) are already excluded because `internal` is in `DIR_IGNORE_PATTERNS`. That directory's images will not be copied or served.

### 2. ✅ `frontend/src/components/docs/MarkdownRenderer.tsx`: custom `img` component

Add an `img` entry to `markdownComponents`. This component must:

**a) Resolve relative `src` paths**

Use the same `currentDir` logic already present in the `a` (link) handler:

```
currentDir =
  docPath === '' || docPath === 'README' ? ''
  : isDirectoryPage                       ? docPath
  : docPath up to last '/'
```

If `src` is relative (does not start with `http://`, `https://`, `/`, or `data:`), prepend `/docs/<currentDir>/`.

Strip any leading `./` before prepending.

Handle `../` by walking up `currentDir` segments (same logic as links).

If `src` is already absolute or an external URL, pass it through untouched.

**b) GitHub-style presentation**

- `max-width: 100%`: never overflow the content column.
- `height: auto`: preserve aspect ratio.
- Subtle `rounded-md` border-radius (matches GitHub's slight rounding).
- `border border-border/40`: faint border so images on white/dark backgrounds have definition.
- `my-4` vertical margin.
- `loading="lazy"`: browser-native lazy loading, no library needed.
- `display: block`: prevents inline baseline gap.

**c) Figure + caption (optional)**

If the image has a `title` attribute (the third element of `![alt](src "title")` syntax), wrap the `<img>` in a `<figure>` with a `<figcaption>` below it, styled as small muted text centred under the image. This mirrors GitHub Docs and many static site generators.

```markdown
![Architecture overview](./arch.png "Figure 1: High-level architecture")
```

Renders as image + caption "Figure 1: High-level architecture".

If no `title`, render a plain `<img>` (no figure wrapper).

**d) Interface addition**

Add `MarkdownImageProps` interface:

```ts
interface MarkdownImageProps {
  src?: string;
  alt?: string;
  title?: string;
  [key: string]: unknown;
}
```

**e) Dependency on `docPath` / `isDirectoryPage`**

The `img` handler needs `docPath` and `isDirectoryPage`, both of which are already in the `useMemo` dependency array via the `a` handler, so no changes are needed there.

### 3. ✅ Image storage convention (authoring guide)

Added to `docs/internal/guidelines/documentation/USER_FACING_DOCS_STANDARDS.md` under an "Images" section documenting:

- Place images in the same directory as the referencing markdown file.
- Use `./image-name.png` (explicit relative prefix) for clarity.
- Prefer descriptive filenames: `workspace-run-list.png` not `screenshot1.png`.
- Prefer `.png` for UI screenshots, `.svg` for diagrams.
- Use the `title` attribute for captions: `![alt](./img.png "Caption text")`.
- Images under `docs/internal/` are never published.

### 4. ✅ `frontend/public/docs/images/` (optional shared assets)

If authors need images shared across multiple docs pages (e.g. a logo used in several places), a `docs/images/` directory at the root of `docs/` can hold them. Reference as `../../images/logo.png` from a nested doc or `/docs/images/logo.png` as an absolute path.

No special tooling changes are needed for this; it falls out naturally from the build script copying all image files.

### 5. ✅ Build-time image optimisation: lossless only

All optimisation applied by the build script is strictly lossless: no pixel data is altered, no quality is traded for file size. Authors do not need to manually optimise assets before committing.

**SVG: `svgo` (included in main implementation)**

SVG files are XML. `svgo` removes comments, redundant attributes, editor metadata (`<sodipodi:*>`, `<inkscape:*>`), unused `<defs>`, and empty groups. Visual output is identical. No native binary is required; `svgo` is a pure-JS npm package already common in frontend toolchains.

In `build-docs-index.js`, after reading an SVG's content and before writing it to `public/docs/`:

```js
const { optimize } = require('svgo')
// ...
const result = optimize(svgContent, { path: srcPath, multipass: true })
fs.writeFileSync(destPath, result.data)
```

**PNG: lossless recompression via `sharp` (included in main implementation)**

`sharp` recompresses PNG files using libvips's lossless encoder (`compressionLevel: 9`). This is equivalent to running `optipng -o7`: it finds a smaller byte representation of the exact same pixel data by trying different deflate strategies and filter combinations. No colour information is discarded.

```js
const sharp = require('sharp')
// ...
await sharp(srcPath).png({ compressionLevel: 9, effort: 10 }).toFile(destPath)
```

`effort: 10` is the maximum compression pass count; it produces a slower build, smaller output, and zero quality loss.

**JPEG: metadata strip + lossless Huffman via `sharp` (included in main implementation)**

`sharp` can rewrite JPEG files with `mozjpeg: true, quality: 100`. At `quality: 100`, MozJPEG performs no lossy quantisation; it only strips EXIF/IPTC metadata and reoptimises Huffman tables. The pixel values written to the screen are unchanged.

```js
// Using require'd sharp (see above)
await sharp(srcPath).jpeg({ quality: 100, mozjpeg: true }).toFile(destPath)
```

Note: `.jpg` screenshots exported from macOS or Windows often carry several kilobytes of metadata (GPS, colour profile, app info). Stripping it is always safe and frequently reduces file size by 5–20 % without touching a single pixel.

**WebP: NOT generated at build time**

Auto-generating `.webp` variants requires the browser to switch between sources, which involves either `<picture>` markup (requires build-time rewriting of markdown) or serving WebP with `Accept: image/webp` content negotiation (requires a server that inspects headers, which the static public/ directory cannot do). This is deferred; see the dark-mode variants section, which handles a similar `<picture>` pattern.

**`sharp` as a build dependency**

`sharp` is a native binary (libvips) distributed as pre-built platform-specific npm packages. It is already one of the most widely used image processing packages in the Node ecosystem and is explicitly supported on Linux x64 (the Docker build environment). Add it as a `devDependency` of the frontend package alongside existing build tooling. No changes to the Docker image are required; `npm install` in the container resolves the correct pre-built binary.

**Optimisation is skipped when the source file is unchanged**

Before processing, compare the source file's mtime or content hash against a stored manifest (`frontend/.image-cache.json`; NOT inside `public/docs/` which is deleted on every build). If unchanged, copy the previously optimised output directly from `frontend/.docs-image-cache/`. This keeps incremental builds fast.

**Estimated size savings (typical docs screenshots)**

| Format | Typical saving |
|---|---|
| SVG | 10–40 % (metadata-heavy exports from Figma/Illustrator) |
| PNG | 5–25 % (deflate reoptimisation) |
| JPEG | 3–15 % (metadata strip + Huffman) |

No quality regression in any case.

---

### 6. ✅ Lightbox — click to zoom

A lightbox opens a full-viewport modal when the user clicks any doc image. It shows the image at its natural dimensions (constrained to 90 vw / 90 vh), allowing readers to examine detail that was reduced by the content column width.

**No new library.** The shadcn/ui `Dialog` component is already available. Wrap it around a full-size `<img>`.

**State management**

In `MarkdownRenderer.tsx`, add a `lightboxSrc` state variable at the component level (not inside the memoised `img` handler, since the handler closes over a setter):

```ts
const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
const [lightboxAlt, setLightboxAlt] = useState<string>('')
```

The `img` component handler receives these setters via closure (they are defined in the same component scope as `markdownComponents`).

**`img` handler change**

Add `onClick` to the rendered `<img>`:

```tsx
onClick={() => {
  setLightboxSrc(resolvedSrc)
  setLightboxAlt(alt ?? '')
}}
```

Add `cursor-zoom-in` to the img className so the pointer communicates interactivity.

If the image is wrapped in a `<figure>` (caption case), the click handler goes on the `<img>` inside the figure, not on the figure itself.

**Dialog markup** (rendered once, at the bottom of the MarkdownRenderer return):

```tsx
<Dialog open={lightboxSrc !== null} onOpenChange={() => setLightboxSrc(null)}>
  <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 flex items-center justify-center bg-background/95 backdrop-blur-sm">
    {lightboxSrc && (
      <img
        src={lightboxSrc}
        alt={lightboxAlt}
        className="max-w-full max-h-[86vh] object-contain rounded-md"
      />
    )}
  </DialogContent>
</Dialog>
```

- `DialogContent` already handles backdrop, close-on-escape, and close-on-outside-click via shadcn/ui.
- No close button needed — shadcn/ui Dialog renders one by default; remove it with `showCloseButton={false}` if the X feels redundant.
- `object-contain` preserves aspect ratio within the constrained box.

**Keyboard and accessibility**

- Close on Escape: handled by shadcn/ui Dialog.
- The dialog receives focus on open: handled by shadcn/ui Dialog.
- `aria-label` on the `<img>` uses the `alt` text.
- The inline `<img>` should have `tabIndex={0}` and an `onKeyDown` handler triggering the lightbox on Enter/Space so keyboard users can open it.

**No pan/zoom in this implementation**

Simple zoom-to-view-full-size covers the primary need (reading a screenshot that was shrunk by column width). Pinch-to-zoom and drag-to-pan add meaningful complexity and a library dependency (e.g. `react-zoom-pan-pinch`). Deferred to a follow-up if user demand exists.

**Opt-out for authors**

If an image should never open a lightbox (e.g. an inline icon or logo), authors can suppress it with a `no-lightbox` class or title fragment. Define a convention if needed: if the markdown `title` attribute ends with `|no-lightbox`, the `img` handler skips adding the click handler and cursor style. This is a rare case — do not implement until an actual need arises.

---

### 7. ✅ Dark-mode image variants

Docs screenshots taken in light mode look jarring on a dark-themed doc viewer. Authors can supply a dark variant of any image; the viewer displays the appropriate one based on the active theme.

**Naming convention**

| Light (default) | Dark variant |
|---|---|
| `screenshot.png` | `screenshot-dark.png` |
| `arch-diagram.svg` | `arch-diagram-dark.svg` |

The dark file sits alongside the light file in the same directory. No frontmatter or markdown attribute change is needed — the convention is purely file-naming.

**Why not `<picture>` + `prefers-color-scheme`**

The standard HTML approach uses a `<picture>` element with a `media="(prefers-color-scheme: dark)"` source. This responds to the OS-level setting — but Stackweaver's docs use a class-based theme toggle (`dark` class on `<html>`) driven by `ThemeContext`. A user who has set their OS to dark but has toggled the site to light would see the dark image. These must be in sync with the site's own theme state, not the OS preference.

**React implementation in the `DocImage` component**

The `img` handler must be a standalone `DocImage` component (see "Critical Implementation Context" above — hooks inside `useMemo`-defined components lose state). `DocImage` imports `useTheme` from `@/contexts/ThemeContext` (this is a NEW import — NOT already present in the file):

```ts
const { resolvedTheme } = useTheme()
const isDark = resolvedTheme === 'dark'
```

Note: use `resolvedTheme` (always `'light'` or `'dark'`), NOT `theme` (which can be `'system'`).

Derive the expected dark-variant path from `resolvedSrc`:

```ts
function darkVariant(src: string): string {
  const dot = src.lastIndexOf('.')
  if (dot === -1) return src + '-dark'
  return src.slice(0, dot) + '-dark' + src.slice(dot)
}
```

Track whether the dark variant failed to load (i.e. does not exist for this image):

```ts
const [darkFailed, setDarkFailed] = useState(false)
```

Reset `darkFailed` when `resolvedSrc` changes (different image):

```ts
useEffect(() => { setDarkFailed(false) }, [resolvedSrc])
```

Choose the active src:

```ts
const activeSrc = isDark && !darkFailed ? darkVariant(resolvedSrc) : resolvedSrc
```

Attach an error handler to fall back gracefully:

```tsx
<img
  src={activeSrc}
  onError={isDark && !darkFailed ? () => setDarkFailed(true) : undefined}
  ...
/>
```

**Behaviour summary**

- Light theme → always uses the base image (`screenshot.png`).
- Dark theme, dark variant exists → uses `screenshot-dark.png`.
- Dark theme, dark variant absent → `onError` fires, `darkFailed` becomes `true`, re-render uses base image. No broken-image icon; fallback is immediate.
- Theme toggle from dark to light → `activeSrc` switches back to base image immediately (no error state involved).
- Theme toggle from light to dark → tries dark variant; if the browser already has it cached (from a previous visit in dark mode) the switch is instant; otherwise one network request.

**Build script — copy dark variants**

Dark variant files match the same extension pattern as regular images (`.png`, `.jpg`, etc.) and will be copied automatically once the scanner is extended to collect image files (Change 1). No additional build script logic is needed; the `-dark` naming is purely a client-side convention.

**Authoring guidance addition**

Add to the authoring guidelines:

- To supply a dark-mode version of an image, place a file with `-dark` before the extension in the same directory: `screenshot.png` → `screenshot-dark.png`.
- Both files are committed to the repository. The viewer picks the right one automatically.
- If no dark variant is present, the light image is used in both modes.
- Dark variants are optional. Most screenshots do not need one unless the UI has significantly different contrast in dark mode.

---

## Implementation Order

1. ✅ Update `scripts/build-docs-index.js` to copy image files (and optimise SVG, PNG, JPEG losslessly using `svgo` + `sharp`).
2. ✅ Add `img` component to `MarkdownRenderer.tsx` (path resolution, styling, dark-variant switching, lightbox click handler).
3. ✅ Add `Dialog`-based lightbox markup to `MarkdownRenderer.tsx`.
4. ✅ Test with real images in `docs/test-images.md` (SVG placeholders covering all feature cases).
5. ✅ Test dark-mode variant with a paired `test-image-themed-dark.svg`.
6. ✅ Update authoring guidelines.
