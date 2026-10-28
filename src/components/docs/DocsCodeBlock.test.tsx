// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DocsCodeBlock } from './DocsCodeBlock';

it('renders outside application providers and delegates copying without changing source bytes', () => {
  const source = 'resource "terraform_data" "example" {\n  input = "<staging>"\n}\n';
  const onCopy = vi.fn();
  const { container, rerender } = render(<DocsCodeBlock language="hcl" copied={false} onCopy={onCopy}><pre><code>{source}</code></pre></DocsCodeBlock>);
  expect(container.querySelector('pre')?.textContent).toBe(source);
  expect(screen.getByText('hcl')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
  expect(onCopy).toHaveBeenCalledOnce();
  rerender(<DocsCodeBlock language="hcl" copied onCopy={onCopy}><pre><code>{source}</code></pre></DocsCodeBlock>);
  expect(screen.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(container.querySelector('pre')?.textContent).toBe(source);
});

it('preserves highlighted children and permits an unlabeled plain text fence', () => {
  const { container } = render(<DocsCodeBlock><pre><code><span style={{ color: '#123456' }}>echo</span>{' hello\n'}</code></pre></DocsCodeBlock>);
  expect(container.querySelector('pre span')).toHaveStyle({ color: '#123456' });
  expect(container.querySelector('pre')?.textContent).toBe('echo hello\n');
  expect(screen.getByRole('button', { name: 'Copy code' })).toHaveAttribute('type', 'button');
});
