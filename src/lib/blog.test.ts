// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { describe, expect, it } from 'vitest';
import { parseArticles, publishedArticles } from './blog';

function source(overrides = '', body = '## Evaluate a real workflow\n\nUse the same playbook in each evaluation.') {
  return `---\ntitle: 'AWX alternatives: choosing your platform'\ndescription: 'Evaluate Ansible workflows and operating effort.'\ncanonical: /compare/awx\nauthor: Michiel VH\nstatus: published\npublished: 2026-10-27\nupdated: 2026-10-27\ntopics: [Ansible, Comparisons]\n${overrides}---\n${body}`;
}

describe('blog article source contract', () => {
  it('keeps author, canonical destination, topics and Markdown without rewriting prose', () => {
    const [article] = parseArticles({ 'awx.md': source() });
    expect(article.title).toBe('AWX alternatives: choosing your platform');
    expect(article.canonical).toBe('/compare/awx');
    expect(article.author).toBe('Michiel VH');
    expect(article.topics).toEqual(['Ansible', 'Comparisons']);
    expect(article.body).toBe('## Evaluate a real workflow\n\nUse the same playbook in each evaluation.');
  });
  it('preserves a boolean featured flag and rejects ambiguous values', () => {
    expect(parseArticles({ 'founder.md': source('featured: true\n') })[0].featured).toBe(true);
    expect(parseArticles({ 'ordinary.md': source() })[0].featured).toBeUndefined();
    expect(() => parseArticles({ 'bad.md': source('featured: "yes"\n') })).toThrow(/featured/i);
  });
  it('excludes drafts from published discovery without changing the source status', () => {
    const draft = source().replace('status: published', 'status: draft').replace('/compare/awx', '/compare/semaphore');
    const articles = parseArticles({ 'awx.md': source(), 'semaphore.md': draft });
    expect(publishedArticles(articles).map(article => article.canonical)).toEqual(['/compare/awx']);
    expect(articles.find(article => article.canonical === '/compare/semaphore')?.status).toBe('draft');
  });
  it('does not require or invent a publication date for a draft', () => {
    const draft = source().replace('status: published', 'status: draft').replace('published: 2026-10-27\n', '');
    const [article] = parseArticles({ 'awx.md': draft });
    expect(article.published).toBeUndefined();
    expect(publishedArticles([article])).toEqual([]);
  });
  it('rejects duplicate canonical destinations across articles', () => {
    expect(() => parseArticles({ 'one.md': source(), 'two.md': source() })).toThrow(/duplicate.*\/compare\/awx/i);
  });
  it.each(['/blog/../awx', 'https://example.com/post', '/compare/awx?variant=2', '/blog/a#part', '/compare/awx/'])('rejects a noncanonical article path: %s', canonical => {
    expect(() => parseArticles({ 'awx.md': source().replace('/compare/awx', canonical) })).toThrow(/canonical/i);
  });
  it('rejects malformed metadata instead of silently publishing incomplete articles', () => {
    expect(() => parseArticles({ 'awx.md': source().replace('author: Michiel VH\n', '') })).toThrow(/author/i);
    expect(() => parseArticles({ 'awx.md': source().replace('topics: [Ansible, Comparisons]', 'topics: Ansible') })).toThrow(/topics/i);
    expect(() => parseArticles({ 'awx.md': source().replace('status: published', 'status: complete') })).toThrow(/status/i);
  });
  it('rejects duplicate YAML keys and unsupported metadata tags', () => {
    expect(() => parseArticles({ 'awx.md': source('author: Someone else\n') })).toThrow(/metadata/i);
    expect(() => parseArticles({ 'awx.md': source().replace('author: Michiel VH', 'author: !custom value') })).toThrow(/metadata/i);
  });
  it('rejects missing frontmatter, empty bodies and impossible dates', () => {
    expect(() => parseArticles({ 'awx.md': 'An article without metadata' })).toThrow(/frontmatter/i);
    expect(() => parseArticles({ 'awx.md': source('', '') })).toThrow(/body/i);
    expect(() => parseArticles({ 'awx.md': source().replace('published: 2026-10-27', 'published: 2026-02-30') })).toThrow(/published/i);
    expect(() => parseArticles({ 'awx.md': source().replace('updated: 2026-10-27', 'updated: 2026-10-26') })).toThrow(/updated/i);
  });
  it('preserves positions and declared uncertainty in article bodies', () => {
    const body = 'I prefer self-hosting for this setup. A managed Stackweaver service is planned.\n\n[VERIFY: hosted availability before publication]';
    const [article] = parseArticles({ 'awx.md': source('', body) });
    expect(article.body).toBe(body);
  });
});
