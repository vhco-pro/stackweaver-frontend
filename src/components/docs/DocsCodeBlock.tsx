// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import type { ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';

export interface DocsCodeBlockProps {
  language?: string;
  copied?: boolean;
  onCopy?: () => void | Promise<void>;
  children: ReactNode;
}

/** Docs-owned presentation. Hosts supply highlighting, copy behavior and theme. */
export function DocsCodeBlock({ language, copied = false, onCopy, children }: DocsCodeBlockProps) {
  return (
    <div className="shiki-wrapper docs-code-block" data-language={language}>
      <div className="docs-code-header">
        {language && <span className="docs-code-language">{language}</span>}
        <button type="button" className="docs-code-copy" data-copy-code onClick={() => { void onCopy?.(); }}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          <span aria-live="polite">{copied ? 'Copied' : 'Copy code'}</span>
        </button>
      </div>
      {children}
    </div>
  );
}
