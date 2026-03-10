# Docs Viewer: Scroll-to-Top Navigation Bug

**Date:** 2026-03-09
**Status:** Fixed
**Components:** `DocsLayout.tsx`, `DocNavigation.tsx`, `DocsSidebar.tsx`, `index.css`

## Symptoms

1. **Bottom prev/next buttons:** Clicking the Previous/Next navigation buttons at the bottom of a doc page does not scroll to the top of the new page.
2. **Sidebar links after scrolling:** If the user scrolls down on a page and then clicks a sidebar item, the page does not jump back to the top. However, if the user has *not* scrolled, clicking a sidebar item works correctly (trivially — the page is already at position 0).

Both symptoms point to `window.scrollTo(0, 0)` silently failing when the user has a non-zero scroll position.

## Root Cause

**Global `scroll-behavior: smooth` in CSS conflicts with programmatic scroll-to-top calls.**

In `frontend/src/index.css` (line 429):

```css
html {
  scroll-behavior: smooth;
}
```

This CSS property makes **all** `window.scrollTo()` calls animate smoothly instead of jumping instantly — including the navigation scroll-to-top calls in `DocsLayout` and `DocNavigation`.

### Why this breaks navigation scroll-to-top

The scroll-to-top logic lives in two places:

1. **`DocsLayout.tsx` — `useLayoutEffect`:** Fires on every `location.key` change and calls `window.scrollTo(0, 0)`.
2. **`DocNavigation.tsx` — `onClick` handlers:** The Previous/Next `<Link>` buttons each call `window.scrollTo(0, 0)` in their `onClick`.

Both calls are designed to execute synchronously/immediately. However, `scroll-behavior: smooth` converts them into **asynchronous animations** (~300-500 ms). During that animation:

- React re-renders the component tree for the new route.
- `DocsViewer` calls `setLoading(true)`, replacing the tall document content with a short skeleton loader.
- The DOM height shrinks dramatically, and the smooth-scroll animation target (position 0) is no longer meaningful or the animation is interrupted/cancelled by the browser because the scrollable area changed.

The result: the scroll position ends up stuck at whatever intermediate point the animation reached before being interrupted, or at the maximum scroll of the now-shorter skeleton content (which is not 0 when the real content loads back in).

### Why it "works" when the user hasn't scrolled

When `window.scrollY` is already `0`, `scrollTo(0, 0)` is a no-op — there's nothing to animate, so the smooth-scroll issue never manifests.

### Secondary issue: redundant scroll-to-top calls

`DocNavigation.tsx` has `onClick={() => window.scrollTo(0, 0)}` on both the Previous and Next `<Link>` elements. This is redundant because `DocsLayout.tsx` already handles scroll-to-top via `useLayoutEffect` on `location.key`. Having two competing callers adds confusion but isn't the root cause — both suffer from the same `scroll-behavior: smooth` problem.

## Fix

1. **`DocsLayout.tsx`:** Change `window.scrollTo(0, 0)` to `window.scrollTo({ top: 0, left: 0, behavior: 'instant' })` to explicitly override the CSS `scroll-behavior: smooth`.
2. **`DocNavigation.tsx`:** Remove the redundant `onClick={() => window.scrollTo(0, 0)}` from the Previous and Next `<Link>` elements — `DocsLayout` already handles this centrally.

The global `scroll-behavior: smooth` is kept because it benefits in-page anchor scrolling (Table of Contents links already pass `behavior: 'smooth'` explicitly in their `scrollToHeading` function, so they are unaffected by this fix).

## Changes Applied

### `frontend/src/components/docs/DocsLayout.tsx`

```diff
  useLayoutEffect(() => {
-   window.scrollTo(0, 0);
+   window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.key]);
```

### `frontend/src/components/docs/DocNavigation.tsx`

Removed redundant `onClick={() => window.scrollTo(0, 0)}` from both Previous and Next `<Link>` elements. The `DocsLayout` `useLayoutEffect` already handles scroll-to-top centrally for every navigation.

**Status:** Fixed
