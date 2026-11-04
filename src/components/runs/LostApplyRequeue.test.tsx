// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// A run whose apply was lost with its launcher ends with the runner-lost reason and is never
// re-run on its own (#933, decision 16): the run page offers the person the re-queue, which
// applies the saved plan as a new attempt. Nothing else is offered it.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { runsApi } from '@/api/client';
import { LostApplyRequeue } from './LostApplyRequeue';
import { isLostApply } from '@/lib/lostApply';

vi.mock('@/api/client', () => ({ runsApi: { apply: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const lost = 'runner lost during apply: the apply was not retried, because running it twice could change infrastructure twice; re-queue the apply to apply the saved plan as a new attempt';

describe('LostApplyRequeue', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('recognises only a failed run with the runner-lost reason', () => {
    expect(isLostApply({ status: 'failed', error_message: lost })).toBe(true);
    expect(isLostApply({ status: 'failed', error_message: 'Error: apply failed' })).toBe(false);
    expect(isLostApply({ status: 'applying', error_message: lost })).toBe(false);
  });

  it('re-queues the apply and reports it', async () => {
    vi.mocked(runsApi.apply).mockResolvedValue({ data: {} } as never);
    const onRequeued = vi.fn();
    render(<LostApplyRequeue runId="run-1" onRequeued={onRequeued} />);
    await userEvent.click(screen.getByRole('button', { name: 'Re-queue apply' }));
    expect(runsApi.apply).toHaveBeenCalledWith('run-1');
    expect(onRequeued).toHaveBeenCalled();
  });
});
