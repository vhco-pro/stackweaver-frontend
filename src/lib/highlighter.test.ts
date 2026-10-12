// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The shared highlighter (#870) must work where WebAssembly cannot be compiled,
// because that is what the production Content Security Policy enforces. The
// original defect was a highlighter that needed it, a fallback that hid the
// failure, and a dev server whose policy allowed it.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { codeToHtml, isUnknownLanguageError } from './highlighter';

/** Make every way of compiling WebAssembly fail, as the production policy does. */
function forbidWebAssembly() {
  const blocked = () => {
    throw new Error('WebAssembly is blocked by the Content Security Policy');
  };
  vi.stubGlobal('WebAssembly', {
    instantiate: blocked,
    instantiateStreaming: blocked,
    compile: blocked,
    compileStreaming: blocked,
    Module: blocked,
    Instance: blocked,
  });
}

describe('highlighter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('highlights with WebAssembly forbidden', async () => {
    forbidWebAssembly();
    const html = await codeToHtml('resource "tfe_workspace" "production" {\n  name = "production"\n}\n', {
      lang: 'hcl',
      theme: 'github-dark',
    });
    expect(html).toContain('<pre class="shiki');
    // More than one colour means tokens were classified, not just wrapped.
    const colours = new Set(html.match(/color:#[0-9A-Fa-f]{3,8}/g));
    expect(colours.size).toBeGreaterThan(1);
  });

  // Every language a fenced block under docs/ uses and Shiki bundles. A grammar
  // the JavaScript engine could not run would surface here, not on a deployment.
  it.each([
    'bash', 'css', 'diff', 'dockerfile', 'go', 'hcl', 'html', 'ini', 'java', 'javascript', 'js',
    'json', 'jsonc', 'jsx', 'makefile', 'markdown', 'mermaid', 'nginx', 'powershell', 'protobuf',
    'python', 'regex', 'rust', 'sql', 'terraform', 'toml', 'ts', 'tsx', 'typescript', 'yaml',
  ])('highlights %s', async (lang) => {
    forbidWebAssembly();
    const html = await codeToHtml('key = "value" # note\nfunc main() { return 1 }\n- item: true\n', {
      lang,
      theme: 'github-light',
    });
    expect(html).toContain('<pre class="shiki');
  });

  it('supports the dual-theme form the animated code block uses', async () => {
    const html = await codeToHtml('const a = 1', {
      lang: 'ts',
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: 'dark',
    });
    expect(html).toContain('--shiki-light');
  });

  it('rejects an unknown language quietly, so the caller can fall back to plain text', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure: unknown = await codeToHtml('a', { lang: 'tree', theme: 'github-dark' }).catch((e: unknown) => e);
    expect(isUnknownLanguageError(failure)).toBe(true);
    expect(report).not.toHaveBeenCalled();
  });

  it('reports any other failure before rejecting, instead of leaving it to a silent fallback', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure: unknown = await codeToHtml('a', { lang: 'ts', theme: 'no-such-theme' }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(Error);
    expect(isUnknownLanguageError(failure)).toBe(false);
    expect(report).toHaveBeenCalledWith('Syntax highlighting failed:', failure);
  });
});
