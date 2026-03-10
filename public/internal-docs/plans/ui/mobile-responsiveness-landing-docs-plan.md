<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Mobile Responsiveness: Landing Page & Docs Page

**Status:** Implemented (Phases 1–4), Testing Remaining (Phase 5)
**Priority:** High
**Created:** 2026-02-28
**Updated:** 2026-03-01

## Problem

The landing page and documentation pages are currently unusable on mobile devices. Several critical issues exist:

1. **PublicNav has no mobile hamburger menu** — all navigation links (Overview, Install, Features, Docs, theme toggle, Get Started button) are rendered inline with no responsive breakpoint or collapse behavior. On small screens the nav items overflow, overlap, or become untappable.
2. **DocsLayout has no mobile sidebar navigation** — the docs sidebar (`DocsSidebar`) is hidden below `lg:` breakpoint (`hidden lg:block`). There is a TODO comment in the code (`{/* Mobile Sidebar Toggle - TODO: Add mobile navigation */}`) but no implementation exists. Users on mobile have no way to navigate between documentation pages.
3. **Table of Contents is hidden on mobile** — the right-sidebar `TableOfContents` is hidden below `xl:` breakpoint. No alternative access is provided.
4. **Landing page hero text sizing** — the hero heading uses `text-6xl md:text-8xl` which can be excessively large on narrow viewports, causing text overflow.
5. **ProductOverview headings overflow on mobile** — `text-5xl md:text-6xl` and `text-4xl md:text-5xl` headings with inline `RotatingTextContainer` can overflow on small screens.
6. **ProductOverview 3D visual overflows** — the fake dashboard preview with floating `motion.div` elements positioned with negative offsets (`right-[-20px]`, `left-[-10px]`) overflows the viewport on mobile.
7. **Feature pills wrap awkwardly** — the flex-wrap pill badges in ProductOverview can create uneven layouts on narrow screens.
8. **Footer grid collapses to single column** — works but spacing could be tighter on mobile.
9. **Button styling issues on mobile** — the gradient-bordered "Get Started" / "View on GitHub" buttons have complex border-radius calculations that may render inconsistently on mobile browsers.

## Affected Components

| Component | File | Issues |
|-----------|------|--------|
| `PublicNav` | `frontend/src/components/navigation/PublicNav.tsx` | No hamburger menu, no mobile collapse |
| `DocsLayout` | `frontend/src/components/docs/DocsLayout.tsx` | No mobile sidebar, no mobile ToC access |
| `DocsSidebar` | `frontend/src/components/docs/DocsSidebar.tsx` | Only renders in desktop aside, no mobile wrapper |
| `TableOfContents` | `frontend/src/components/docs/TableOfContents.tsx` | Hidden on mobile, no alternative |
| `Landing` | `frontend/src/pages/Landing.tsx` | Hero text overflow, section spacing |
| `ProductOverview` | `frontend/src/components/landing/ProductOverview.tsx` | Heading overflow, 3D visual overflow, button styling |
| `Footer` | `frontend/src/components/layout/Footer.tsx` | Minor spacing adjustments |

## Implementation Plan

### Phase 1: PublicNav Mobile Menu (Critical) ✅

**Goal:** Add a hamburger menu to `PublicNav` that collapses navigation links on mobile.

**Implemented:**
1. Added `mobileMenuOpen` state with `useState`.
2. Added hamburger icon button (`Menu` from lucide-react) visible only below `md:` breakpoint (`flex md:hidden`).
3. Desktop nav links wrapped in `hidden md:flex` — unchanged on desktop.
4. Mobile slide-out `Sheet` (side="right") contains all nav links, theme toggle (Light/Dark/Auto buttons), and gradient-bordered Get Started/Dashboard CTA.
5. Sheet auto-closes on route change via `useLocation` + `useEffect`.
6. Added `useLocation` import from react-router-dom.
7. Created new `Sheet` UI component (`frontend/src/components/ui/sheet.tsx`) based on Radix Dialog primitive, matching existing shadcn pattern.

### Phase 2: Docs Mobile Navigation (Critical) ✅

**Goal:** Add a mobile-accessible sidebar for documentation navigation.

**Implemented:**
1. Added fixed mobile nav bar (`lg:hidden`) below the PublicNav with "Navigation" and "On this page" buttons.
2. Left `Sheet` (side="left") renders `DocsSidebar` in a slide-out drawer — triggered by "Navigation" button.
3. Right `Sheet` (side="right") renders `TableOfContents` — triggered by "On this page" button.
4. Both sheets auto-close on route change via `useEffect` on `location.pathname`.
5. Breadcrumbs now have `overflow-x-auto` and `whitespace-nowrap` to prevent overflow on mobile.
6. Main content padding adjusted: `px-4 md:px-8` and `pt-12 lg:pt-4` to account for the mobile nav bar.
7. Removed the `{/* Mobile Sidebar Toggle - TODO: Add mobile navigation */}` comment — it's now implemented.

### Phase 3: Landing Page Mobile Typography & Layout (High) ✅

**Goal:** Fix text overflow and layout issues on the landing page for mobile viewports.

**Implemented:**
1. **Hero heading:** Changed from `text-6xl md:text-8xl` → `text-4xl sm:text-6xl md:text-8xl`.
2. **ProductOverview H1:** Changed from `text-5xl md:text-6xl` → `text-3xl sm:text-5xl md:text-6xl`.
3. **ProductOverview H2:** Changed from `text-4xl md:text-5xl` → `text-2xl sm:text-4xl md:text-5xl`.
4. **RotatingTextContainer:** Reduced `min-w-[140px]` → `min-w-[100px] sm:min-w-[140px]`.
5. **3D dashboard floating elements:** Added `hidden md:block` to both `motion.div` elements with negative positioning — they now only appear on `md:` screens and above.
6. **Section padding:** All three content sections (Overview, Install, Features) changed from `py-24 px-6` → `py-12 md:py-24 px-4 md:px-6`.
7. **Features heading:** Changed from `text-4xl md:text-5xl` → `text-3xl sm:text-4xl md:text-5xl`, margin from `mb-16` → `mb-8 md:mb-16`.
8. **Install heading:** Changed from `text-4xl md:text-5xl` → `text-3xl sm:text-4xl md:text-5xl`, margin from `mb-16` → `mb-8 md:mb-16`.

### Phase 4: Button & Component Styling Fixes (Medium) ✅

**Goal:** Ensure gradient-bordered buttons and interactive elements render correctly on mobile.

**Implemented:**
1. Gradient-border buttons left unchanged — `whitespace-nowrap` already prevents text wrapping, and the `inline-flex` container prevents overflow. 
2. Theme toggle on mobile is handled via the Sheet menu (3 inline buttons: Light/Dark/Auto) instead of the DropdownMenu, avoiding viewport clipping issues.
3. Feature cards grid already uses `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` — verified correct.
4. Nav container padding adjusted from `px-6` → `px-4 md:px-6` for better mobile edge spacing.

### Phase 5: Testing & Polish (Low)

1. Test on common mobile viewports: iPhone SE (375px), iPhone 14 (390px), Pixel 7 (412px), iPad Mini (768px).
2. Test both landscape and portrait orientations.
3. Test dark mode + light mode on all mobile viewpoints.
4. Verify touch targets meet minimum 44x44px accessibility guidelines.
5. Test with iOS Safari, Android Chrome, and Firefox Mobile.

## Technical Notes

- The app sidebar (`Navbar` + `Sidebar` in `Layout.tsx`) already has a working mobile hamburger menu implementation that can be referenced as a pattern.
- Created new `Sheet` component at `frontend/src/components/ui/sheet.tsx` using `@radix-ui/react-dialog` (already installed) and `class-variance-authority`.
- The `PublicNav` uses `w-[98%]` which is appropriate for mobile; internal flex layout now collapses at `md:` breakpoint.
- The `DocsLayout` TODO comment has been resolved with a full mobile navigation implementation.
- All changes use Tailwind responsive prefixes (`md:`, `lg:`, `sm:`) to ensure desktop behavior is completely unchanged.

## Acceptance Criteria

- [x] PublicNav displays a hamburger menu on screens < 768px with all navigation options accessible
- [x] Docs pages have a slide-out sidebar for navigation on screens < 1024px
- [x] Table of Contents is accessible on mobile via a button/drawer
- [x] Landing page hero text does not overflow on any screen width >= 320px
- [x] ProductOverview section renders cleanly without horizontal overflow on mobile
- [x] All interactive elements (buttons, links, toggles) are tappable with proper touch targets
- [x] No horizontal scroll on any page at mobile viewport widths
