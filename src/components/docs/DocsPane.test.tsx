// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// DocsPane wiring (#131): the collapse toggle and the keyboard-resizable
// separator update the pane and persist to localStorage, and a remount (a page
// reload) restores what was saved. The pane hands its collapse button to the
// body, which seats it in its own header row; the collapsed rail carries the
// expand button.

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocsPane } from './DocsPane';
import { SIDEBAR_PANE, TOC_PANE } from './docsPanes';

function renderPane(config = SIDEBAR_PANE, label = 'navigation sidebar') {
  return render(
    <DocsPane config={config} id="pane" label={label}>
      {(collapseButton) => (
        <div data-testid="pane-header">
          {collapseButton}
          <p>pane body</p>
        </div>
      )}
    </DocsPane>,
  );
}

describe('DocsPane', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders at the default width with an accessible separator', () => {
    renderPane();
    const separator = screen.getByRole('separator', { name: 'Resize navigation sidebar' });
    expect(separator).toHaveAttribute('aria-orientation', 'vertical');
    expect(separator).toHaveAttribute('aria-valuenow', '256');
    expect(separator).toHaveAttribute('aria-valuemin', String(SIDEBAR_PANE.minWidth));
    expect(separator).toHaveAttribute('aria-valuemax', String(SIDEBAR_PANE.maxWidth));
    expect(screen.getByRole('complementary', { name: 'navigation sidebar' })).toHaveStyle({ width: '256px' });
  });

  it('resizes with the arrow keys and persists the width across a remount', async () => {
    const user = userEvent.setup();
    const { unmount } = renderPane();

    screen.getByRole('separator').focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '288');
    expect(JSON.parse(localStorage.getItem('docs-sidebar-pane') ?? '{}')).toEqual({ width: 288, collapsed: false });

    unmount();
    renderPane();
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '288');
    expect(screen.getByRole('complementary')).toHaveStyle({ width: '288px' });
  });

  it('collapses and expands, hiding the content and separator, and persists it', async () => {
    const user = userEvent.setup();
    const { unmount } = renderPane(TOC_PANE, 'table of contents');

    await user.click(screen.getByRole('button', { name: 'Collapse table of contents' }));
    expect(screen.getByText('pane body')).not.toBeVisible();
    expect(screen.queryByRole('separator')).toBeNull();
    expect(JSON.parse(localStorage.getItem('docs-toc-pane') ?? '{}')).toEqual({ width: 256, collapsed: true });

    unmount();
    renderPane(TOC_PANE, 'table of contents');
    const expand = screen.getByRole('button', { name: 'Expand table of contents' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    await user.click(expand);
    expect(screen.getByText('pane body')).toBeVisible();
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '256');
    expect(JSON.parse(localStorage.getItem('docs-toc-pane') ?? '{}')).toEqual({ width: 256, collapsed: false });
  });

  it('seats the collapse button inside the body it is handed to, not in a row of its own', () => {
    renderPane();
    const collapse = screen.getByRole('button', { name: 'Collapse navigation sidebar' });
    expect(screen.getByTestId('pane-header')).toContainElement(collapse);
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
  });

  it('hands focus to the counterpart button across a collapse and an expand', async () => {
    const user = userEvent.setup();
    renderPane();

    // The pressed button is hidden by the toggle, so without the hand-over
    // keyboard focus would fall back to <body>.
    await user.click(screen.getByRole('button', { name: 'Collapse navigation sidebar' }));
    expect(screen.getByRole('button', { name: 'Expand navigation sidebar' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Collapse navigation sidebar' })).toHaveFocus();
  });
});
