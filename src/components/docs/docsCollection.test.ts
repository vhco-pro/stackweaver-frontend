// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { describe, it, expect } from 'vitest';
import { homepageEntries, docUrl, resolveCollection, type DocsIndex } from './docsCollection';
const index: DocsIndex = { generated: '', tree: [{ type: 'directory', name: 'handbook', path: 'handbook', children: [{ type: 'file', name: 'intro.md', path: 'handbook/intro.md', title: 'Intro' }] }, { type: 'file', name: 'welcome.md', path: 'welcome.md', title: 'Welcome' }], flat: { 'handbook/README.md': { type: 'file', name: 'README.md', path: 'handbook/README.md', title: 'Team handbook', description: 'Our team' } } };
describe('generated homepage adapter', () => {
  it('uses generated summaries, descendants and root files in any collection', () => {
    const entries = homepageEntries(index);
    expect(entries.folders[0]).toMatchObject({ title: 'Team handbook', description: 'Our team', count: 1 });
    expect(entries.files.map(n => n.path)).toEqual(['welcome.md']);
    expect(docUrl('/handbook', 'handbook/README.md')).toBe('/handbook/handbook');
    expect(docUrl('/handbook', 'README.md')).toBe('/handbook');
  });
  it('handles empty, nested and missing-metadata folders without fixed links', () => {
    expect(homepageEntries({ generated: '', tree: [], flat: {} }).folders).toEqual([]);
    expect(homepageEntries(index, 'handbook').files[0].path).toBe('handbook/intro.md');
    expect(homepageEntries({ ...index, flat: {} }).folders[0].title).toBe('Handbook');
    expect(resolveCollection({ docsBase: '/internal-docs' }).statusFilter).toBe(true);
    expect(resolveCollection({ collection: { id: 'team', docsBase: '/team', indexFile: '/team.json', searchIndexFile: '/team-search.json', title: 'Team', description: '' } }).id).toBe('team');
  });
});
