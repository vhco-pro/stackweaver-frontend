// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the standard names on the agent pool select of the job template create dialog (JobTemplates)
// and edit dialog (JobTemplateDetail), which share it (one-launcher spec, B1, AC28): leaving the pool
// unset runs on Hosted capacity, and a pool runs the template on that agent pool's launchers. None
// of the retired labels appears.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AgentPool } from '@/api/client';
import { AgentPoolSelect } from './AgentPoolSelect';

const pool = { id: 'pool-1', name: 'edge-pool' } as AgentPool;
const retired = /built-in runner|server-side|platform runner|platform managed|runner pool/i;

describe('AgentPoolSelect', () => {
  it('names the unset choice Hosted capacity and each pool by name', async () => {
    const onChange = vi.fn();
    render(<AgentPoolSelect id="pool" agentPools={[pool]} value="" onChange={onChange} />);

    const trigger = screen.getByRole('combobox', { name: 'Agent pool (optional)' });
    expect(trigger).toHaveTextContent('Hosted capacity');
    expect(screen.getByText(/agent pool to run on your own launchers/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(retired);

    await userEvent.setup().click(trigger);
    expect(await screen.findByRole('option', { name: 'Hosted capacity' })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('option', { name: 'edge-pool' }));
    expect(onChange).toHaveBeenCalledWith('pool-1');
    expect(document.body.textContent).not.toMatch(retired);
  });

  it('reports Hosted capacity as an empty pool', async () => {
    const onChange = vi.fn();
    render(<AgentPoolSelect id="pool" agentPools={[pool]} value="pool-1" onChange={onChange} />);
    await userEvent.setup().click(screen.getByRole('combobox', { name: 'Agent pool (optional)' }));
    await userEvent.setup().click(await screen.findByRole('option', { name: 'Hosted capacity' }));
    expect(onChange).toHaveBeenCalledWith('');
  });
});
