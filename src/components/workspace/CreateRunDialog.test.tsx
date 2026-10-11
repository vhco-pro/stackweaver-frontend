// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The new-run dialog (#844, AC14 and AC15).
//
// A destroy removes every resource the workspace manages, and on a workspace that applies runs
// automatically nothing stands between the click and the removal. So the dialog never queues a
// destroy from a single click: it asks for the workspace's name first, says what will happen,
// and refuses the choice outright when the workspace does not allow destroy plans.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateRunDialog, type CreateRunDialogWorkspace } from './CreateRunDialog';

const manual: CreateRunDialogWorkspace = { name: 'network-prod', auto_apply: false, allow_destroy_plan: true };
const autoApply: CreateRunDialogWorkspace = { name: 'network-prod', auto_apply: true, allow_destroy_plan: true };
const destroyOff: CreateRunDialogWorkspace = { name: 'network-prod', auto_apply: false, allow_destroy_plan: false };

function setup(workspace: CreateRunDialogWorkspace = manual, isCreatingRun = false) {
  const onCreateRun = vi.fn();
  const onOpenChange = vi.fn();
  const props = { onOpenChange, workspace, onCreateRun };
  const view = render(<CreateRunDialog open isCreatingRun={isCreatingRun} {...props} />);
  const rerender = (next: { open?: boolean; isCreatingRun?: boolean }) => {
    view.rerender(
      <CreateRunDialog open={next.open ?? true} isCreatingRun={next.isCreatingRun ?? false} {...props} />,
    );
  };
  return { user: userEvent.setup(), onCreateRun, onOpenChange, rerender };
}

const dialog = () => within(screen.getByRole('dialog'));
const destroyChoice = () => dialog().getByRole('button', { name: /^Destroy/ });
const queueButton = () => dialog().getByRole('button', { name: 'Queue destroy run' });
const nameInput = () => dialog().getByRole('textbox', { name: 'Workspace name' });

describe('CreateRunDialog: the three choices', () => {
  it('offers Plan & Apply, Plan Only and Destroy', () => {
    setup();
    expect(dialog().getByRole('button', { name: /^Plan & Apply/ })).toBeEnabled();
    expect(dialog().getByRole('button', { name: /^Plan Only/ })).toBeEnabled();
    expect(destroyChoice()).toBeEnabled();
    expect(dialog().queryByRole('textbox')).toBeNull();
  });

  it('starts a plan-and-apply or a plan-only run straight from its choice', async () => {
    const { user, onCreateRun } = setup();

    await user.click(dialog().getByRole('button', { name: /^Plan & Apply/ }));
    await user.click(dialog().getByRole('button', { name: /^Plan Only/ }));

    expect(onCreateRun.mock.calls).toEqual([['plan-and-apply'], ['plan-only']]);
  });

  it('disables every choice while a run is being created', () => {
    setup(manual, true);
    expect(dialog().getByRole('button', { name: /^Plan & Apply/ })).toBeDisabled();
    expect(dialog().getByRole('button', { name: /^Plan Only/ })).toBeDisabled();
    expect(destroyChoice()).toBeDisabled();
  });
});

describe('CreateRunDialog: confirming a destroy (AC14)', () => {
  it('does not queue a destroy from the choice itself: it asks for the workspace name', async () => {
    const { user, onCreateRun } = setup();

    await user.click(destroyChoice());

    expect(onCreateRun).not.toHaveBeenCalled();
    expect(dialog().getByText('network-prod', { selector: 'strong' })).toBeInTheDocument();
    expect(dialog().getByText(/to confirm\./)).toBeInTheDocument();
    expect(nameInput()).toHaveAttribute('placeholder', 'network-prod');
    expect(nameInput()).toHaveFocus();
    expect(queueButton()).toBeDisabled();
    // The three choices are gone: the only ways on are Back and the queue button.
    expect(dialog().queryByRole('button', { name: /^Plan Only/ })).toBeNull();
  });

  it('says the destroy waits for a confirmation when the workspace does not auto-apply', async () => {
    const { user } = setup(manual);
    await user.click(destroyChoice());
    expect(dialog().getByText(
      'The destroy will plan first and wait for your confirmation before it removes anything.',
    )).toBeInTheDocument();
  });

  it('says the destroy removes resources as soon as its plan finishes on an auto-apply workspace', async () => {
    const { user } = setup(autoApply);
    await user.click(destroyChoice());
    expect(dialog().getByText(
      'This workspace applies runs automatically, so the destroy will remove all managed resources as soon as its plan finishes.',
    )).toBeInTheDocument();
  });

  it.each([
    ['a prefix', 'network-pro'],
    ['another case', 'Network-Prod'],
    ['a trailing space', 'network-prod '],
    ['another workspace', 'network-staging'],
  ])('keeps the queue button disabled for %s', async (_label, typed) => {
    const { user, onCreateRun } = setup();
    await user.click(destroyChoice());

    await user.type(nameInput(), typed);

    expect(queueButton()).toBeDisabled();
    await user.click(queueButton());
    expect(onCreateRun).not.toHaveBeenCalled();
  });

  it('enables the queue button for the exact name and queues one destroy', async () => {
    const { user, onCreateRun } = setup(autoApply);
    await user.click(destroyChoice());

    await user.type(nameInput(), 'network-prod');
    expect(queueButton()).toBeEnabled();
    await user.click(queueButton());

    expect(onCreateRun).toHaveBeenCalledTimes(1);
    expect(onCreateRun).toHaveBeenCalledWith('destroy');
  });

  it('disables the queue button and Back, and shows progress, while the run is being created', async () => {
    const { user, rerender } = setup();
    await user.click(destroyChoice());
    await user.type(nameInput(), 'network-prod');

    rerender({ isCreatingRun: true });

    expect(queueButton()).toBeDisabled();
    expect(dialog().getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(queueButton().querySelector('.animate-spin')).not.toBeNull();
  });

  it('stays on the confirmation with the button enabled again when creating the run fails', async () => {
    const { user, rerender } = setup();
    await user.click(destroyChoice());
    await user.type(nameInput(), 'network-prod');

    // The page reports the failure and clears its busy flag; the dialog stays open.
    rerender({ isCreatingRun: true });
    rerender({ isCreatingRun: false });

    expect(nameInput()).toHaveValue('network-prod');
    expect(queueButton()).toBeEnabled();
  });

  it('Back returns to the three choices and discards the typed name', async () => {
    const { user, onCreateRun } = setup();
    await user.click(destroyChoice());
    await user.type(nameInput(), 'network-prod');

    await user.click(dialog().getByRole('button', { name: 'Back' }));

    expect(dialog().getByRole('button', { name: /^Plan Only/ })).toBeInTheDocument();
    expect(dialog().queryByRole('textbox')).toBeNull();

    await user.click(destroyChoice());
    expect(nameInput()).toHaveValue('');
    expect(queueButton()).toBeDisabled();
    expect(onCreateRun).not.toHaveBeenCalled();
  });

  it('closing the dialog discards the typed name, and the next opening starts on the choices', async () => {
    const { user, onOpenChange, rerender } = setup();
    await user.click(destroyChoice());
    await user.type(nameInput(), 'network-prod');

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender({ open: false });
    rerender({ open: true });

    expect(dialog().getByRole('button', { name: /^Plan Only/ })).toBeInTheDocument();
    expect(dialog().queryByRole('textbox')).toBeNull();
    await user.click(destroyChoice());
    expect(nameInput()).toHaveValue('');
  });

  it('starts on the choices again after the page closes the dialog on success', async () => {
    const { user, rerender } = setup();
    await user.click(destroyChoice());
    await user.type(nameInput(), 'network-prod');
    await user.click(queueButton());

    // The page closes the dialog itself once the run exists; no close event comes from inside.
    rerender({ open: false });
    rerender({ open: true });

    expect(dialog().queryByRole('textbox')).toBeNull();
    expect(destroyChoice()).toBeEnabled();
  });
});

describe('CreateRunDialog: a workspace that does not allow destroy plans (AC15)', () => {
  it('disables the Destroy choice and explains why', () => {
    setup(destroyOff);

    expect(destroyChoice()).toBeDisabled();
    expect(dialog().getByText(
      'Destroy plans are not allowed on this workspace. Turn on allow-destroy-plan in the workspace settings to queue one.',
    )).toBeInTheDocument();
    expect(dialog().queryByText('Remove all managed resources')).toBeNull();
  });

  it('sends nothing and opens no confirmation when the disabled choice is clicked', async () => {
    const { user, onCreateRun } = setup(destroyOff);

    await user.click(destroyChoice());

    expect(onCreateRun).not.toHaveBeenCalled();
    expect(dialog().queryByRole('textbox')).toBeNull();
  });

  it('leaves Plan & Apply and Plan Only working', async () => {
    const { user, onCreateRun } = setup(destroyOff);

    await user.click(dialog().getByRole('button', { name: /^Plan & Apply/ }));
    await user.click(dialog().getByRole('button', { name: /^Plan Only/ }));

    expect(onCreateRun.mock.calls).toEqual([['plan-and-apply'], ['plan-only']]);
  });

  it('treats a workspace that does not report the setting as allowing destroy plans', () => {
    // The setting is on unless it was turned off, and the API always sends it.
    setup({ name: 'network-prod', auto_apply: false });
    expect(destroyChoice()).toBeEnabled();
    expect(dialog().getByText('Remove all managed resources')).toBeInTheDocument();
  });
});
