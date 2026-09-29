// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the rotate action on the agent token row: it confirms in a dialog, rotates with the default
// grace window, reveals the replacement once, and says when the old token stops working.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { agentTokensApi } from '@/api/client';
import { AgentPoolTokens } from './AgentPoolTokens';

vi.mock('@/api/client', () => ({
  agentTokensApi: {
    list: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    rotate: vi.fn(),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderTokens() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AgentPoolTokens poolId="pool-1" />
    </QueryClientProvider>,
  );
}

describe('AgentPoolTokens rotate', () => {
  beforeEach(() => {
    vi.mocked(agentTokensApi.list).mockResolvedValue([
      { id: 'at-1', description: 'prod agents', created_at: '2026-09-01T00:00:00Z' },
    ]);
    vi.mocked(agentTokensApi.rotate).mockResolvedValue({
      token: { id: 'at-2', description: 'prod agents', token: 'tfe-newsecret' },
      rotatedFrom: 'at-1',
      previousExpiresAt: '2026-09-30T12:00:00Z',
    });
  });

  it('rotates with the default grace window and reveals the new token once', async () => {
    const user = userEvent.setup();
    renderTokens();

    await user.click(await screen.findByRole('button', { name: /rotate agent token prod agents/i }));
    expect(screen.getByRole('dialog', { name: /rotate agent token/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^rotate token$/i }));

    expect(agentTokensApi.rotate).toHaveBeenCalledWith('at-1', 24);
    expect(await screen.findByText('tfe-newsecret')).toBeInTheDocument();
    expect(screen.getByText('Agent token rotated')).toBeInTheDocument();
    expect(screen.getByText(/previous token keeps working until/i)).toBeInTheDocument();
  });

  it('shows when a rotated token expires', async () => {
    vi.mocked(agentTokensApi.list).mockResolvedValue([
      { id: 'at-1', description: 'old agents', expired_at: '2999-01-01T00:00:00Z' },
    ]);
    renderTokens();
    expect(await screen.findByText(/rotated, expires/i)).toBeInTheDocument();
  });
});
