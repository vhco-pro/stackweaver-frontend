// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Net for the failed-apply render loop (#861). When an apply failed with an error that names
// no resource (a stale saved plan, a state lock, a plan file that cannot be loaded), the viewer
// marked every planned resource failed from an effect that ran after every render and always
// produced a new status map, so the component never stopped rendering and React logged
// "Maximum update depth exceeded" continuously. The per-resource status is now computed from
// the props instead of being written back into state, so the viewer has to settle in a handful
// of commits whatever the logs say. The remaining cases pin the statuses that computation has
// to keep producing.

import { Component, Profiler, type ComponentProps, type ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RunDisplayPreferencesProvider } from '@/contexts/RunDisplayPreferencesContext';
import { ApplyOutputViewer } from './ApplyOutputViewer';

type ViewerProps = ComponentProps<typeof ApplyOutputViewer>;

// A healthy mount commits a handful of times while the remaining effects seed their state.
const SETTLED_COMMITS = 10;
// A runaway viewer never returns control to the test, so the harness unmounts it once it is
// far past React's own nested-update limit (50), which is where React logs the warning.
const RUNAWAY_COMMITS = 120;

// Unmounts the viewer when the commit counter trips, which is what ends a runaway loop.
class Fuse extends Component<{ children: ReactNode }, { blown: boolean }> {
  state = { blown: false };

  static getDerivedStateFromError() {
    return { blown: true };
  }

  render() {
    return this.state.blown ? null : this.props.children;
  }
}

const planOutput = {
  resource_changes: [
    { address: 'terraform_data.first', type: 'terraform_data', name: 'first', change: { actions: ['create'] } },
    { address: 'terraform_data.second', type: 'terraform_data', name: 'second', change: { actions: ['create'] } },
  ],
};

// What OpenTofu prints when the state moved between plan and apply: no "with <address>" line
// and no source location, so the parsed error carries no resource.
const staleSavedPlan = [
  '╷',
  '│ Error: Saved plan is stale',
  '│ ',
  '│ The given plan file can no longer be applied because the state was changed',
  '│ by another operation after the plan was created.',
  '╵',
].join('\n');

const provisionerFailure = [
  'terraform_data.first: Creating...',
  '╷',
  '│ Error: local-exec provisioner error',
  '│ ',
  '│   with terraform_data.first,',
  '│   on main.tf line 2, in resource "terraform_data" "first":',
  '│    2:   provisioner "local-exec" {',
  '│ ',
  '│ Error running command: exit status 1.',
  '╵',
].join('\n');

const successfulApply = [
  'terraform_data.first: Creating...',
  'terraform_data.first: Creation complete after 0s [id=11111111-aaaa]',
  'terraform_data.second: Creating...',
  'terraform_data.second: Creation complete after 0s [id=22222222-bbbb]',
  '',
  'Apply complete! Resources: 2 added, 0 changed, 0 destroyed.',
].join('\n');

function storedState(statuses: Record<string, string>): NonNullable<ViewerProps['applyState']> {
  const resources = Object.entries(statuses).map(([address, status]) => ({ address, status, action: 'create' }));
  return {
    resources,
    summary: {
      additions: resources.filter((r) => r.status === 'completed').length,
      changes: 0,
      destructions: 0,
      failed: resources.filter((r) => r.status === 'failed').length,
    },
  };
}

function setup(props: Partial<ViewerProps>) {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  let commits = 0;
  const onRender = () => {
    commits += 1;
    if (commits > RUNAWAY_COMMITS) {
      throw new Error(`ApplyOutputViewer was still rendering after ${RUNAWAY_COMMITS} commits`);
    }
  };

  render(
    <RunDisplayPreferencesProvider>
      <Fuse>
        <Profiler id="apply-output-viewer" onRender={onRender}>
          <ApplyOutputViewer logs="" planOutput={planOutput} showJsonViewer={false} {...props} />
        </Profiler>
      </Fuse>
    </RunDisplayPreferencesProvider>,
  );

  const updateDepthErrors = consoleError.mock.calls
    .map((args) => String(args[0]))
    .filter((message) => message.includes('Maximum update depth exceeded'));

  return { commits: () => commits, updateDepthErrors };
}

function statuses(): Record<string, string | null> {
  const cards = document.querySelectorAll('[data-resource-address]');
  return Object.fromEntries(
    Array.from(cards).map((card) => [
      card.getAttribute('data-resource-address') ?? '',
      card.getAttribute('data-resource-status'),
    ]),
  );
}

const failedBadge = () => screen.queryByText('Failed')?.parentElement ?? null;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ApplyOutputViewer: an apply that failed without naming a resource', () => {
  it('settles when the stored apply state already has every resource failed', () => {
    const view = setup({
      logs: staleSavedPlan,
      isFailed: true,
      applyState: storedState({ 'terraform_data.first': 'failed', 'terraform_data.second': 'failed' }),
    });

    expect(view.updateDepthErrors).toEqual([]);
    expect(view.commits()).toBeLessThanOrEqual(SETTLED_COMMITS);
    expect(statuses()).toEqual({ 'terraform_data.first': 'failed', 'terraform_data.second': 'failed' });
    expect(failedBadge()).toHaveTextContent('2');
  });

  it('settles and marks every planned resource failed when there is no stored apply state', () => {
    const view = setup({ logs: staleSavedPlan, isFailed: true });

    expect(view.updateDepthErrors).toEqual([]);
    expect(view.commits()).toBeLessThanOrEqual(SETTLED_COMMITS);
    expect(statuses()).toEqual({ 'terraform_data.first': 'failed', 'terraform_data.second': 'failed' });
    expect(failedBadge()).toHaveTextContent('2');
  });

  it('keeps a resource that completed before the error', () => {
    const view = setup({
      logs: staleSavedPlan,
      isFailed: true,
      applyState: storedState({ 'terraform_data.first': 'completed', 'terraform_data.second': 'pending' }),
    });

    expect(view.updateDepthErrors).toEqual([]);
    expect(view.commits()).toBeLessThanOrEqual(SETTLED_COMMITS);
    expect(statuses()).toEqual({ 'terraform_data.first': 'completed', 'terraform_data.second': 'failed' });
    expect(failedBadge()).toHaveTextContent('1');
  });
});

describe('ApplyOutputViewer: the statuses the other outcomes keep', () => {
  it('fails only the resource a resource-specific error names', () => {
    const view = setup({ logs: provisionerFailure, isFailed: true });

    expect(view.commits()).toBeLessThanOrEqual(SETTLED_COMMITS);
    expect(statuses()).toEqual({ 'terraform_data.first': 'failed', 'terraform_data.second': 'pending' });
    expect(failedBadge()).toHaveTextContent('1');
  });

  it('shows a cancelled run as cancelled even when its log carries an error', () => {
    const view = setup({ logs: staleSavedPlan, isCancelled: true });

    expect(view.commits()).toBeLessThanOrEqual(SETTLED_COMMITS);
    expect(statuses()).toEqual({ 'terraform_data.first': 'cancelled', 'terraform_data.second': 'cancelled' });
    expect(failedBadge()).toBeNull();
  });

  it('shows a successful apply as completed with nothing failed', () => {
    const view = setup({ logs: successfulApply });

    expect(view.commits()).toBeLessThanOrEqual(SETTLED_COMMITS);
    expect(statuses()).toEqual({ 'terraform_data.first': 'completed', 'terraform_data.second': 'completed' });
    expect(failedBadge()).toBeNull();
    expect(screen.getByText('Added').parentElement).toHaveTextContent('2');
  });
});
