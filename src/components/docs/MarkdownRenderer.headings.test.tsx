// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { DocsEnvironmentContext } from './DocsEnvironment';
import { MarkdownRenderer } from './MarkdownRenderer';

vi.mock('mermaid', () => ({ default: { initialize: vi.fn(), run: vi.fn() } }));

function staticDocument(content: string, brandLogos?: 'permitted' | 'all' | 'none') {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(<MemoryRouter initialEntries={['/docs/user-guides/sso/okta']}><ThemeProvider><DocsEnvironmentContext.Provider value={{ basePath: '', staticRender: true }}><MarkdownRenderer content={content} docPath="user-guides/sso/okta" brandLogos={brandLogos} /></DocsEnvironmentContext.Provider></ThemeProvider></MemoryRouter>);
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

it('puts a brand logo in front of a heading that starts with the brand, keeping its anchor and text', () => {
  const result = staticDocument('## Docker Compose\n\n### Kubernetes / Helm\n\n### Kubernetes-only variables\n\n## Step 5: Configure Stackweaver', 'all');
  const headings = [...result.querySelectorAll('h2,h3')];
  expect(headings.map(heading => heading.querySelector('.brand-icon')?.getAttribute('data-brand') ?? null)).toEqual(['docker', 'kubernetes', null, null]);
  expect(headings.map(heading => [heading.id, heading.textContent])).toEqual([
    ['docker-compose', 'Docker Compose'],
    ['kubernetes--helm', 'Kubernetes / Helm'],
    ['kubernetes-only-variables', 'Kubernetes-only variables'],
    ['step-5-configure-stackweaver', 'Step 5: Configure Stackweaver'],
  ]);
  expect(result.querySelector('.brand-icon')).toHaveAttribute('aria-hidden', 'true');
});

it('gives the page title the brand named by the icon frontmatter, and honours heading_icons: false', () => {
  const titled = staticDocument('---\nicon: okta\n---\n# Set up Okta SSO\n\n## Before you start', 'all');
  expect(titled.querySelector('h1 .brand-icon')).toHaveAttribute('data-brand', 'okta');
  expect(titled.querySelector('h2 .brand-icon')).toBeNull();
  const optedOut = staticDocument('---\nheading_icons: false\n---\n# Stackweaver changelog\n\n### Ansible image includes fixes', 'all');
  expect(optedOut.querySelector('.brand-icon')).toBeNull();
});

it('shows only permitted logos by default, so a public page never carries a restricted one', () => {
  const result = staticDocument('---\nicon: okta\n---\n# Set up Okta SSO\n\n## Docker Compose\n\n## Azure DevOps Integration\n\n## Microsoft Entra ID');
  expect([...result.querySelectorAll('.brand-icon')].map(icon => icon.getAttribute('data-brand'))).toEqual(['okta', 'azure-devops', 'microsoft-entra']);
  expect(staticDocument('## Azure', 'none').querySelector('.brand-icon')).toBeNull();
});
