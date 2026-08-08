---
description: "Design plan for inline code highlight styling in the docs viewer"
covers:
  - "frontend/src/index.css"
  - "frontend/src/components/docs/MarkdownRenderer.tsx"
---

# Plan: Inline Code Highlight Redesign

**Status:** Implemented: Indigo (Option C variant)
**Scope:** Docs viewer only: `MarkdownRenderer.tsx`, `index.css`

---

## Problem

Current inline code styling:

```css
/* index.css line 145 */
.markdown-content code {
  @apply bg-muted px-1.5 py-0.5 rounded text-sm font-mono;
}

/* MarkdownRenderer.tsx line 911 */
<code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
```

`bg-muted` resolves to the shadcn/ui muted token, a flat mid-gray in both light and dark mode. No text color change, no definition, no visual interest. The result is inline code that barely stands out from surrounding prose.

---

## What Already Works (Callouts)

Inside callout boxes, inline code already gets contextual color treatment. For example, `:::note` applies:

```
bg-blue-500/20 dark:bg-blue-500/15
text-blue-800 dark:text-blue-300
```

This looks alive and intentional. The approach is proven; we just need to bring the same energy to *default* inline code outside callouts.

---

## Reference: VitePress Approach

VitePress default theme uses:

- **Background**: `rgba(125,125,125, 0.12–0.14)`: neutral, slightly higher contrast than pure muted
- **Text**: `var(--vp-c-text-code)`: slightly brighter/offset from body text, often with a subtle warm or cool cast
- **Border-radius**: slightly more than body text baseline (feels like a pill-ish chip)
- **Padding**: similar to current (`px-1.5 py-0.5`)

The key difference is VitePress gives code a **distinct identity**; it reads as a semantic element, not just a gray smudge. Some VitePress themes go further with a faint accent-colored background (e.g., green-tinted for code, blue for notes).

---

## Options

### Option A: Neutral but Defined (lowest risk)

Increase contrast and add a subtle border. No brand color.

```
Light: bg-slate-100 border border-slate-200/80 text-slate-700
Dark:  bg-slate-800 border border-slate-700/60 text-slate-200
```

**Pros:** Safe, works with any content. **Cons:** Still fairly colorless, only marginally better than current.

---

### Option B: Warm Neutral (VitePress-closest)

Use a slightly warm gray tint that shifts with mode.

```
Light: bg-stone-100 text-stone-700
Dark:  bg-zinc-800 text-zinc-200
```

Plus a subtle 1px border to give shape:

```
Light: border border-stone-300/60
Dark:  border border-zinc-600/40
```

**Pros:** Feels warm, natural, close to VitePress's tone. Not jarring. **Cons:** No brand color.

---

### Option C: Brand Accent (Stackweaver-native) ← Recommended

Use the app's violet/purple brand color as a very subtle tint. Mirrors how callouts already work but in a softer, neutral register.

```
Light: bg-violet-50 border border-violet-200/70 text-violet-800
Dark:  bg-violet-950/40 border border-violet-700/30 text-violet-200
```

Round up to `rounded-md` (from `rounded`) for a slightly more polished chip feel.

**Pros:** Cohesive with Stackweaver brand; clearly semantic; both modes look intentional. Not so loud it distracts. **Cons:** Slightly opinionated; docs with many inline code references will have a purple cast.

---

### Option D: Monochrome Chip with Stronger Contrast

Skip color tint, go higher contrast with a clear border:

```
Light: bg-gray-100 border border-gray-300 text-gray-800
Dark:  bg-gray-800/70 border border-gray-600/50 text-gray-100
```

**Pros:** Very legible, neutral. **Cons:** Clinical feel, still no personality.

---

## Recommendation

**Option C (Brand Accent) as the default**, with Option B as the fallback if the violet tint feels too strong after visual review.

Rationale:
1. The app already uses violet/purple heavily (gradient headers, action buttons).
2. Callouts already demonstrate colored code works; we're just bringing that to the baseline.
3. VitePress's appeal isn't gray: it's that code elements have *identity*. Brand tint gives identity.

---

## Implementation

### Files to Change

| File | Location | Change |
|------|----------|--------|
| `frontend/src/index.css` | Line 145–147 | Update `.markdown-content code` rule |
| `frontend/src/components/docs/MarkdownRenderer.tsx` | Line 911 | Update inline `className` to match |

### Changes

**`index.css` line 145:**

```css
/* BEFORE */
.markdown-content code {
  @apply bg-muted px-1.5 py-0.5 rounded text-sm font-mono;
}

/* AFTER (Option C) */
.markdown-content code {
  @apply bg-violet-50 dark:bg-violet-950/40
         border border-violet-200/70 dark:border-violet-700/30
         text-violet-800 dark:text-violet-200
         px-1.5 py-0.5 rounded-md text-sm font-mono;
}
```

**`MarkdownRenderer.tsx` line 911:**

```tsx
/* BEFORE */
<code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>

/* AFTER (Option C) */
<code
  className="bg-violet-50 dark:bg-violet-950/40 border border-violet-200/70 dark:border-violet-700/30 text-violet-800 dark:text-violet-200 px-1.5 py-0.5 rounded-md text-sm font-mono"
  {...props}
>
```

### Callout Interaction

Callout boxes use `[&_code]` selectors that **override** the default inline code style. No changes needed there; callouts will continue to render code in their contextual color (blue for note, yellow for warning, etc.). The default style only applies when code is not inside a callout.

### Pre / Code Block Safety

The existing rule at line 153 (`pre:not([class*='shiki']) code { bg-transparent p-0 }`) will still override, preventing the new styles from leaking into code blocks. No change needed.

---

## Visual Preview (approximate)

| Mode | Before | After (Option C) |
|------|--------|------------------|
| Light | gray chip, no text color shift | soft violet chip, violet-800 text |
| Dark | dark gray chip, inherited text | very dark violet chip, violet-200 text |

---

## Decision

**Implemented: Indigo**: Option C with `indigo` instead of `violet`.

Violet was rejected after visual review: it reads too much like Terraform's brand color. Indigo sits at the blue-purple midpoint, leans more blue, and feels native to Stackweaver without the Terraform association.

### Final applied styles

```css
/* index.css */
.markdown-content code {
  @apply bg-indigo-50 dark:bg-indigo-950/40
         border border-indigo-200/70 dark:border-indigo-700/30
         text-indigo-800 dark:text-indigo-200
         px-1.5 py-0.5 rounded-md text-sm font-mono;
}
```

```tsx
/* MarkdownRenderer.tsx - inline code */
<code className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-700/30 text-indigo-800 dark:text-indigo-200 px-1.5 py-0.5 rounded-md text-sm font-mono">
```

### Tried and saved (for reference)

| Variant | Light | Dark | Verdict |
|---------|-------|------|---------|
| Violet | `bg-violet-50 border-violet-200/70 text-violet-800` | `bg-violet-950/40 border-violet-700/30 text-violet-200` | Rejected: too Terraform |
| **Indigo** | `bg-indigo-50 border-indigo-200/70 text-indigo-800` | `bg-indigo-950/40 border-indigo-700/30 text-indigo-200` | **Shipped** |
