// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, expect, it } from 'vitest';
import { mermaidConfig, withBrandGradient } from './mermaidTheme';

describe('mermaidConfig', () => {
  it('gives the gradient border a solid fallback colour', () => {
    expect(mermaidConfig('dark').themeCSS).toMatch(/stroke:url\(#sw-mermaid-gradient\) #[0-9a-f]{6}!important/);
  });

  it('keeps strict sanitization in both modes', () => {
    expect(mermaidConfig('dark').securityLevel).toBe('strict');
    expect(mermaidConfig('light').securityLevel).toBe('strict');
  });

  it('uses the base theme so the house palette is honoured', () => {
    expect(mermaidConfig('dark').theme).toBe('base');
  });

  it('pairs light and dark with different surfaces and text', () => {
    const dark = mermaidConfig('dark').themeVariables;
    const light = mermaidConfig('light').themeVariables;
    expect(dark?.darkMode).toBe(true);
    expect(light?.darkMode).toBe(false);
    expect(dark?.primaryColor).not.toBe(light?.primaryColor);
    expect(dark?.primaryTextColor).not.toBe(light?.primaryTextColor);
  });
});

describe('withBrandGradient', () => {
  const svg = '<svg id="m1" viewBox="0 0 10 10"><style>.node rect{stroke:url(#sw-mermaid-gradient)!important}</style><g/></svg>';

  it('injects one gradient definition right after the opening svg tag', () => {
    const out = withBrandGradient(svg, 'm1');
    expect(out.match(/<linearGradient/g)).toHaveLength(1);
    expect(out.startsWith('<svg id="m1" viewBox="0 0 10 10"><defs><linearGradient id="sw-mermaid-gradient-m1"')).toBe(true);
  });

  it('points the theme CSS at the per-diagram gradient id', () => {
    const out = withBrandGradient(svg, 'm1');
    expect(out).toContain('stroke:url(#sw-mermaid-gradient-m1)');
    expect(out).not.toContain('url(#sw-mermaid-gradient)');
  });

  it('rewrites the reference when Mermaid quotes it', () => {
    const quoted = svg.replace('url(#sw-mermaid-gradient)', 'url("#sw-mermaid-gradient")');
    const out = withBrandGradient(quoted, 'm1');
    expect(out).toContain('stroke:url("#sw-mermaid-gradient-m1")');
    expect(out).not.toContain('url("#sw-mermaid-gradient")');
  });

  it('gives two diagrams distinct gradient ids', () => {
    expect(withBrandGradient(svg, 'a')).toContain('id="sw-mermaid-gradient-a"');
    expect(withBrandGradient(svg, 'b')).toContain('id="sw-mermaid-gradient-b"');
  });
});
