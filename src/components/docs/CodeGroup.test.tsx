// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Net for CodeGroup's preserve-manual-memoization fix: `codeBlocks` is now memoized
// so the `activeCodeText` useMemo has a stable dependency. Pins the observable
// contract that depends on codeBlocks — tab extraction, labels, and switching.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeGroup } from './CodeGroup';

// Highlighting is async + irrelevant to the tab structure under test; stub it.
vi.mock('shiki', () => ({ codeToHtml: vi.fn().mockResolvedValue('<pre>highlighted</pre>') }));

describe('CodeGroup', () => {
  it('renders one tab per code block with its language label and switches active tab', async () => {
    const user = userEvent.setup();
    render(
      <CodeGroup languages={['Bash', 'YAML']}>
        <code className="language-bash">echo hi</code>
        <code className="language-yaml">key: value</code>
      </CodeGroup>,
    );

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveTextContent('Bash');
    expect(tabs[1]).toHaveTextContent('YAML');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

    await user.click(tabs[1]);
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
  });

  it('renders children directly when no language- code blocks are present', () => {
    render(
      <CodeGroup>
        <p>not a code block</p>
      </CodeGroup>,
    );
    expect(screen.getByText('not a code block')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });
});
