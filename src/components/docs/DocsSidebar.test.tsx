// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { DocsSidebar } from './DocsSidebar';
import { internalDocs, publicDocs, type DocsCollection, type DocsIndex } from './docsCollection';

const guides = { type: 'directory' as const, name: 'user-guides', path: 'user-guides', children: [
  { type: 'file' as const, name: 'README.md', path: 'user-guides/README.md', title: 'User guides' },
  { type: 'directory' as const, name: 'workload-identity', path: 'user-guides/workload-identity', children: [
    { type: 'file' as const, name: 'README.md', path: 'user-guides/workload-identity/README.md', title: 'Workload identity' },
    { type: 'file' as const, name: 'aws.md', path: 'user-guides/workload-identity/aws.md', title: 'AWS', icon: 'aws' },
    { type: 'file' as const, name: 'azure-devops.md', path: 'user-guides/workload-identity/azure-devops.md', title: 'Azure DevOps', icon: 'azure-devops' },
  ] },
  { type: 'file' as const, name: 'reading-the-dashboard.md', path: 'user-guides/reading-the-dashboard.md' },
] };
const index: DocsIndex = { generated: '', flat: {}, tree: [guides] };

afterEach(cleanup);
function sidebar(collection: DocsCollection) {
  const client = new QueryClient();
  client.setQueryData(['docs-index', collection.id, collection.docsBase, collection.indexFile], index);
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`${collection.docsBase}/user-guides/workload-identity/aws`]}>
    <DocsSidebar collection={collection} showSearch={false} />
  </MemoryRouter></QueryClientProvider>);
}

describe('collection sidebar options', () => {
  it('gives the public collection section labels, page titles and no icons', () => {
    const { container } = sidebar(publicDocs);
    expect(screen.getByRole('link', { name: 'User guides' })).toHaveClass('docs-nav-section');
    expect(screen.getByRole('button', { name: 'Workload identity' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Reading The Dashboard' })).toBeVisible();
    expect(container.querySelector('.folder-icon-container, .brand-icon, svg.lucide-file-text')).toBeNull();
  });

  it('keeps the internal collection on folder names, folder icons and every brand logo', () => {
    const { container } = sidebar(internalDocs);
    expect(container.querySelector('.docs-nav-section')).toBeNull();
    expect(screen.getByRole('button', { name: 'user-guides' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'workload-identity' })).toBeVisible();
    expect([...container.querySelectorAll('.brand-icon')].map(icon => icon.getAttribute('data-brand'))).toEqual(['aws', 'azure-devops']);
    expect(within(container).getAllByRole('link').some(link => link.querySelector('svg.lucide-file-text'))).toBe(true);
  });

  it('shows only permitted logos when a collection with icons keeps the default brand policy', () => {
    const { container } = sidebar({ ...internalDocs, id: 'handbook', brandLogos: undefined });
    expect([...container.querySelectorAll('.brand-icon')].map(icon => icon.getAttribute('data-brand'))).toEqual(['azure-devops']);
  });
});
