// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { DocsEnvironmentContext } from './DocsEnvironment';
import { MarkdownRenderer } from './MarkdownRenderer';

vi.mock('mermaid', () => ({ default: { initialize: vi.fn(), run: vi.fn() } }));

function staticDocument(content: string) {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(<MemoryRouter initialEntries={['/docs/user-guides/sso/okta']}><ThemeProvider><DocsEnvironmentContext.Provider value={{ basePath: '', staticRender: true }}><MarkdownRenderer content={content} docPath="user-guides/sso/okta" /></DocsEnvironmentContext.Provider></ThemeProvider></MemoryRouter>);
  return container;
}

it('renders the Okta groups-scope link target before JavaScript or the table of contents runs', () => {
  const result = staticDocument('### 4a. Add a `groups` scope\n\nFollow [Step 4a](#4a-add-a-groups-scope).');
  expect(result.querySelector('h3')).toHaveAttribute('id', '4a-add-a-groups-scope');
  expect(result.querySelector('a')).toHaveAttribute('href', '/docs/user-guides/sso/okta#4a-add-a-groups-scope');
});

it('keeps formatted heading text in anchors at every heading level without changing plain anchors', () => {
  const result = staticDocument('# Release **notes** for `OpenTofu`\n\n## Step 4: Existing heading\n\n### Add a `groups` scope\n\n#### Read the [API guide](/docs)\n\n##### **Check _nested_ formatting**\n\n###### Run `hello` again');
  expect([...result.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(heading => heading.id)).toEqual([
    'release-notes-for-opentofu',
    'step-4-existing-heading',
    'add-a-groups-scope',
    'read-the-api-guide',
    'check-nested-formatting',
    'run-hello-again',
  ]);
});
