// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the two buttons a dialog footer can end in: the gradient ring for a neutral confirm,
// solid red for a destructive one. Solid red appears nowhere else in the app.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './confirm-dialog';

function renderDialog(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="Apply the plan?"
      description="This applies 3 changes."
      confirmLabel="Apply"
      onConfirm={onConfirm}
      {...props}
    />
  );
  return { onConfirm, onOpenChange };
}

describe('ConfirmDialog', () => {
  it('confirms a neutral action with the gradient ring button', () => {
    renderDialog();
    const confirm = screen.getByRole('button', { name: 'Apply' });
    expect(confirm).toHaveClass('gradient-ring-btn');
    expect(confirm).not.toHaveClass('gradient-ring-brand');
    expect(confirm).not.toHaveClass('bg-destructive');
  });

  it('confirms a destructive action with the solid red button', () => {
    renderDialog({ variant: 'destructive', confirmLabel: 'Delete' });
    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect(confirm).toHaveClass('bg-destructive');
    expect(confirm).not.toHaveClass('gradient-ring-btn');
  });

  it('acts only when confirmed', async () => {
    const { onConfirm, onOpenChange } = renderDialog({ variant: 'destructive', confirmLabel: 'Delete' });
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
