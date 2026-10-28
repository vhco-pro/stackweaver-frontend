// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { describe, it, expect } from 'vitest';
import { articleModule } from './publicArticles';
const source = (status: string) => `---\ntitle: Example\ndescription: A useful example\ncanonical: /compare/awx\nauthor: Michiel VH\nstatus: ${status}\npublished: 2026-10-27\nupdated: 2026-10-27\ntopics: [Ansible]\n---\nPrivate draft body`;
describe('public article build input', () => {
 it('does not ship draft bodies in a production virtual module', () => {
  expect(articleModule({'draft.md':source('draft')},false)).not.toContain('Private draft body');
  expect(articleModule({'draft.md':source('draft')},true)).toContain('Private draft body');
 });
 it('ships published sources and fails malformed source rather than hiding it', () => {
  expect(articleModule({'article.md':source('published')},false)).toContain('Private draft body');
  expect(() => articleModule({'broken.md':'No metadata'},false)).toThrow(/frontmatter/);
 });
});
