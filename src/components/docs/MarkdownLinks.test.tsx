// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { MarkdownRenderer } from './MarkdownRenderer';

describe('overview context links', () => {
  it('preserves external Markdown URLs and resolves internal fragments without .md', () => {
    render(<MemoryRouter><MarkdownRenderer docPath="user-guides/vcs" isDirectoryPage content={'[Policy](https://github.com/vhco-pro/.github/blob/main/SECURITY.md)\n\n[Setup](./azure-devops.md#terraform-setup-declarative)\n\n[Authentication](../authentication/README.md#verify-browser-sign-in)'} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Policy' })).toHaveAttribute('href', 'https://github.com/vhco-pro/.github/blob/main/SECURITY.md');
    expect(screen.getByRole('link', { name: 'Setup' })).toHaveAttribute('href', '/docs/user-guides/vcs/azure-devops#terraform-setup-declarative');
    expect(screen.getByRole('link', { name: 'Authentication' })).toHaveAttribute('href', '/docs/user-guides/authentication#verify-browser-sign-in');
  });
});
