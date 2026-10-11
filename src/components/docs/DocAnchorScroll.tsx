// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Input that means the reader has taken over the scroll position. */
const RELEASE_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

/** The element a URL fragment names, or null when the fragment is empty or matches nothing. */
function anchorTarget(hash: string): HTMLElement | null {
  const raw = hash.replace(/^#/, '');
  if (!raw) return null;
  try {
    return document.getElementById(decodeURIComponent(raw));
  } catch {
    // A malformed percent-escape names nothing.
    return document.getElementById(raw);
  }
}

/**
 * Brings the heading the URL's fragment names into view, once the page content
 * it lives in has rendered.
 *
 * The browser's own fragment navigation cannot do this for a docs page: the
 * Markdown is fetched after load, so the target does not exist when the browser
 * looks for it, and a deep link either stayed at the top of the page or landed
 * wherever a later reflow left it. Mount this beside the rendered content, so
 * its effect runs when the headings are in the DOM. Where the heading lands is
 * not decided here: `scroll-margin-top` on the docs headings (index.css) clears
 * the fixed navigation for this, for in-page links and for the table of
 * contents alike.
 *
 * One scroll is not enough. Diagrams and highlighted code render after the
 * Markdown does, and they change the height of everything above the heading: on
 * a page with eight diagrams the document grew from 3,890px to 10,452px after
 * the jump, carrying the heading 6,600px out of view. So the heading is held in
 * place while the content resizes, until the reader takes over by scrolling,
 * typing or pressing. The target is looked up again on every pass, because the
 * highlighter's re-render replaces the heading elements.
 *
 * A fragment that names nothing falls back to the top of the page, which is
 * where DocsLayout leaves a navigation that carries no fragment at all.
 */
export function DocAnchorScroll() {
  const location = useLocation();

  useLayoutEffect(() => {
    const hash = location.hash;
    if (!hash) return;

    const first = anchorTarget(hash);
    if (!first) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      return;
    }

    const align = () => {
      anchorTarget(hash)?.scrollIntoView({ block: 'start', behavior: 'instant' });
    };
    align();

    const observer = new ResizeObserver(align);
    observer.observe(first.closest('main') ?? document.body);

    const release = () => {
      observer.disconnect();
      for (const event of RELEASE_EVENTS) window.removeEventListener(event, release);
    };
    for (const event of RELEASE_EVENTS) window.addEventListener(event, release, { passive: true });
    return release;
  }, [location.key, location.hash]);

  return null;
}
