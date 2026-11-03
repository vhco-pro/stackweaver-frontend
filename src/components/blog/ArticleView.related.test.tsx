// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { DocsEnvironmentContext } from '@/components/docs/DocsEnvironment';
import type { BlogArticle } from '@/lib/blog';
import { ArticleView } from './ArticleView';

vi.mock('mermaid', () => ({ default: { initialize: vi.fn(), run: vi.fn() } }));
const story = (canonical: string, topics: string[], extra: Partial<BlogArticle> = {}): BlogArticle => ({
  canonical, topics, title: canonical, description: 'A practical workflow', author: 'Michiel VH',
  status: 'published', published: '2026-10-30', updated: '2026-10-30', body: '## Workflow\nUseful guidance.', ...extra,
});
const founder = story('/blog/why-i-built-stackweaver', ['Stackweaver', 'Vision'], { featured: true });
const ai = story('/blog/infrastructure-automation-ai-agents', ['AI agents', 'GitOps', 'Ansible', 'OpenTofu']);
const aap = story('/compare/awx', ['Ansible', 'Comparisons']);
const semaphore = story('/compare/semaphore', ['Ansible', 'OpenTofu', 'Comparisons']);
const terraform = story('/compare/terraform-cloud', ['OpenTofu', 'Comparisons']);
const tutorial = story('/blog/run-schedule-ansible-playbook', ['Ansible', 'Tutorial'], { published: '2026-11-03', updated: '2026-11-03' });
const draft = story('/blog/unpublished', ['Ansible', 'OpenTofu'], { status: 'draft', featured: true });
const articles = [founder, ai, aap, semaphore, terraform, tutorial, draft];
function page(article: BlogArticle, related: readonly BlogArticle[] = articles) {
  const node = document.createElement('div');
  node.innerHTML = renderToStaticMarkup(<MemoryRouter initialEntries={[article.canonical]}><ThemeProvider><DocsEnvironmentContext.Provider value={{basePath:'',staticRender:true}}><ArticleView article={article} related={related}/></DocsEnvironmentContext.Provider></ThemeProvider></MemoryRouter>);
  return node;
}
it('links an Ansible comparison to relevant published reading before JavaScript, without changing archive order', () => {
  const order = articles.map(article => article.canonical);
  const html = page(aap);
  expect([...html.querySelectorAll('.blog-related a')].map(link => link.getAttribute('href'))).toEqual([tutorial.canonical, semaphore.canonical]);
  expect(articles.map(article => article.canonical)).toEqual(order);
});
it('prefers a comparison sharing the tool over a broad article and an unrelated comparison', () => {
  const html = page(terraform);
  expect([...html.querySelectorAll('.blog-related a')].map(link => link.getAttribute('href'))).toEqual([semaphore.canonical, ai.canonical]);
});
it('omits an empty reading section when only the current article and drafts are available', () => {
  expect(page(aap, [aap, draft]).querySelector('.blog-related')).toBeNull();
});

it('uses featured then recent published reading when no subject overlaps', () => {
  const current = story('/blog/other-subject', ['Observability']);
  expect([...page(current).querySelectorAll('.blog-related a')].map(link => link.getAttribute('href'))).toEqual([founder.canonical, tutorial.canonical]);
});
