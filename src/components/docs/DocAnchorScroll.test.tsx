// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// DocAnchorScroll: a docs URL that names an anchor ends on that heading once the
// content is in the DOM, and a fragment that names nothing ends at the top of
// the page rather than wherever the previous page was scrolled to.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DocAnchorScroll } from './DocAnchorScroll';

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <h2 id="configuration">Configuration</h2>
      <h2 id="common-use-cases">Common Use Cases</h2>
      <DocAnchorScroll />
    </MemoryRouter>,
  );
}

describe('DocAnchorScroll', () => {
  const scrollIntoView = vi.fn();
  const scrollTo = vi.fn();
  // The one observer the component creates, so a test can fire a resize by hand.
  let resize: (() => void) | null = null;
  let observing = false;

  beforeEach(() => {
    scrollIntoView.mockReset();
    scrollTo.mockReset();
    resize = null;
    observing = false;
    // jsdom implements none of these; the component only needs to call them.
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.stubGlobal('scrollTo', scrollTo);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {
          observing = true;
        }
        disconnect() {
          observing = false;
        }
      },
    );
  });

  afterEach(() => {
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    vi.unstubAllGlobals();
  });

  it('scrolls the heading the fragment names into view', () => {
    renderAt('/docs/features/opentofu/vcs-path-filtering#configuration');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById('configuration'));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('decodes a percent-encoded fragment', () => {
    renderAt('/docs/x#common%2Duse%2Dcases');
    expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById('common-use-cases'));
  });

  it('falls back to the top of the page when the fragment names nothing', () => {
    renderAt('/docs/x#no-such-heading');
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
  });

  it('holds the heading in place while late content resizes the page', () => {
    renderAt('/docs/x#configuration');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(observing).toBe(true);

    // A diagram above the heading finishes rendering.
    resize?.();
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView.mock.instances[1]).toBe(document.getElementById('configuration'));
  });

  it('lets go as soon as the reader scrolls', () => {
    renderAt('/docs/x#configuration');
    expect(observing).toBe(true);

    window.dispatchEvent(new Event('wheel'));
    expect(observing).toBe(false);
  });

  it('stops observing when it unmounts', () => {
    const { unmount } = renderAt('/docs/x#configuration');
    expect(observing).toBe(true);
    unmount();
    expect(observing).toBe(false);
  });

  it('does nothing without a fragment, leaving the reset to DocsLayout', () => {
    renderAt('/docs/x');
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
