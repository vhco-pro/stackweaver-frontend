// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { MarkdownRenderer } from './MarkdownRenderer';

vi.mock('mermaid', () => ({ default: { initialize: vi.fn(), run: vi.fn() } }));

// Content a module author or repository owner controls, such as a registry module README.
const hostile = [
  '# Module',
  '',
  '<script>window.__swInjected = true;</script>',
  '',
  '<img src="https://example.com/x.png" onerror="window.__swInjected = true" alt="logo">',
  '',
  '<a href="javascript:window.__swInjected=true">click me</a>',
  '',
  '[markdown link](javascript:window.__swInjected=true)',
  '',
  '<iframe src="https://example.com"></iframe>',
  '',
  '<form action="https://example.com"><input name="password"></form>',
  '',
  '<div onclick="window.__swInjected = true" style="position:fixed;inset:0">overlay</div>',
].join('\n');

function renderMarkdown(content: string, trustedHtml?: boolean) {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <MarkdownRenderer content={content} trustedHtml={trustedHtml} />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

function eventHandlerAttributes(root: Element): string[] {
  return [...root.querySelectorAll('*')].flatMap(element =>
    element.getAttributeNames().filter(name => name.toLowerCase().startsWith('on')),
  );
}

describe('MarkdownRenderer with untrusted content', () => {
  it('renders script, event-handler and javascript: payloads inert by default', () => {
    const { container } = renderMarkdown(hostile);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('form')).toBeNull();
    // GitHub's allow-list keeps only the disabled checkbox a task list renders.
    for (const input of container.querySelectorAll('input')) {
      expect(input).toHaveAttribute('type', 'checkbox');
      expect(input).toBeDisabled();
    }
    expect(eventHandlerAttributes(container)).toEqual([]);
    for (const anchor of container.querySelectorAll('a')) {
      expect(anchor.getAttribute('href') ?? '').not.toMatch(/^\s*javascript:/i);
    }
    expect(container.querySelector('[style]')).toBeNull();
    expect((window as { __swInjected?: boolean }).__swInjected).toBeUndefined();
    expect(screen.getByText('overlay')).toBeInTheDocument();
  });

  it('keeps the HTML a GitHub README commonly uses', () => {
    const readme = [
      '<details>',
      '<summary>Inputs</summary>',
      '',
      '| Name | Type |',
      '|------|------|',
      '| region | string |',
      '',
      '</details>',
      '',
      '<p align="center"><img src="https://example.com/logo.png" alt="Logo" width="120"></p>',
      '',
      'Press <kbd>Ctrl</kbd> then read <a href="https://example.com/docs">the docs</a>.',
      '',
      '```hcl',
      'module "x" {}',
      '```',
    ].join('\n');
    const { container } = renderMarkdown(readme);
    expect(screen.getByText('Inputs').closest('summary')?.closest('details')).not.toBeNull();
    expect(container.querySelector('table')).toHaveTextContent('region');
    expect(container.querySelector('img[alt="Logo"]')).toHaveAttribute('src', 'https://example.com/logo.png');
    expect(container.querySelector('kbd')).toHaveTextContent('Ctrl');
    expect(screen.getByText('the docs').closest('a')).toHaveAttribute('href', 'https://example.com/docs');
    expect(container.querySelector('pre')).toHaveTextContent('module "x" {}');
  });
});

describe('MarkdownRenderer with trusted bundled docs', () => {
  it('keeps raw layout HTML the product docs rely on', () => {
    const { container } = renderMarkdown('<div class="docs-hero" style="text-align:center">Welcome</div>', true);
    const hero = container.querySelector('div.docs-hero');
    expect(hero).toHaveTextContent('Welcome');
    expect(hero).toHaveAttribute('style');
  });
});
