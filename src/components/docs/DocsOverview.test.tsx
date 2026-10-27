// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { DocsOverview } from './DocsOverview';
import { type DocsIndex } from './docsCollection';
const files = [{ type: 'file' as const, name: 'start.md', path: 'team/start.md', title: 'Start here' }];
const index: DocsIndex = { generated: '', flat: {}, tree: [{ type: 'directory', name: 'team', path: 'team', children: files }] };
function show(data: DocsIndex, folderPath = '') {
  return render(<MemoryRouter><DocsOverview index={data} folderPath={folderPath} docsBase="/handbook" hideCompleted={false} /></MemoryRouter>);
}
describe('collection-neutral overview composition', () => {
  it('keeps an unordered root quiet and uses collection routes', () => {
    show(index);
    expect(screen.getByRole('article')).toHaveAttribute('data-overview-lead', 'false');
    expect(screen.getByRole('link', { name: 'Browse Team' })).toHaveAttribute('href', '/handbook/team');
  });
  it('uses full-width article rows for a leaf folder', () => {
    show(index, 'team');
    expect(screen.getByRole('link', { name: /Start here/ })).toHaveAttribute('href', '/handbook/team/start');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
  it('keeps folder-only navigation useful even with no article', () => {
    show({ ...index, tree: [{ ...index.tree[0], children: [] }] });
    expect(screen.getByRole('link', { name: 'Browse Team' })).toBeVisible();
    expect(screen.queryByText('No documentation yet')).not.toBeInTheDocument();
  });
  it('shows an empty folder state', () => {
    show({ ...index, tree: [{ ...index.tree[0], children: [] }] }, 'team');
    expect(screen.getByText('No documentation yet')).toBeVisible();
  });
  it('shows generated child folders as lead links instead of a curated list', () => {
    show({ ...index, flat: { 'team/start-here/README.md': { type: 'file', name: 'README.md', path: 'team/start-here/README.md', title: 'Onboarding' } }, tree: [{ ...index.tree[0], nav_order: 10, children: [{ type: 'directory', name: 'start-here', path: 'team/start-here', children: [] }] }] });
    expect(screen.getByRole('link', { name: /Onboarding/ })).toHaveAttribute('href', '/handbook/team/start-here');
  });
});
