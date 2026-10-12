// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * The one syntax highlighter for the app. Import `codeToHtml` from here, through
 * a dynamic `import('@/lib/highlighter')`, never from the `shiki` package entry.
 *
 * The `shiki` entry highlights with Oniguruma compiled to WebAssembly, and the
 * production Content Security Policy (frontend/security-headers.conf) does not
 * allow WebAssembly to be compiled. Every call site used that entry, each caught
 * the resulting error and fell back to plain text, and the Vite dev server's
 * looser policy hid it: production shipped with no highlighting anywhere for
 * three months before the kind harness, the only place the production image
 * runs, happened to look (#870).
 *
 * This module builds the same highlighter on Shiki's JavaScript regex engine,
 * which needs no WebAssembly, so it works under the policy as it stands rather
 * than asking for an exception to it. Languages and themes are still loaded on
 * demand, one chunk each.
 */

import { createBundledHighlighter, createSingletonShorthands } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { bundledLanguages } from 'shiki/langs';
import { bundledThemes } from 'shiki/themes';

const shorthands = createSingletonShorthands(
  createBundledHighlighter({
    langs: bundledLanguages,
    themes: bundledThemes,
    // `forgiving`: a grammar pattern the JavaScript engine cannot compile is
    // skipped, costing that one rule's colouring, instead of failing the block.
    engine: () => createJavaScriptRegexEngine({ forgiving: true }),
  }),
);

/**
 * True when highlighting failed only because the language is not one Shiki
 * bundles (`tree`, `env`, a typo in a fence). That is expected input, and the
 * caller falls back to plain text. Anything else is a defect.
 */
export function isUnknownLanguageError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  // Anchored on "Language": Shiki words an unknown theme the same way, and a
  // theme name comes from our code, not from a document, so that one is a defect.
  return /^Language .* is not included in this bundle/.test(message);
}

/**
 * Highlight `code` to an HTML string. Same options as Shiki's own `codeToHtml`.
 *
 * It still rejects on failure, so callers keep their plain-text fallback, but a
 * failure that is not an unknown language is reported first. The callers'
 * fallbacks are what made the original defect invisible.
 */
export const codeToHtml: typeof shorthands.codeToHtml = async (code, options) => {
  try {
    return await shorthands.codeToHtml(code, options);
  } catch (error) {
    if (!isUnknownLanguageError(error)) {
      console.error('Syntax highlighting failed:', error);
    }
    throw error;
  }
};
