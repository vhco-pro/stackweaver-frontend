// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Run, Workspace } from '@/api/client';
import { RunSourceDisplay } from './RunSourceDisplay';

const run = (fields: Partial<Run>) => ({ id: 'run-1', ...fields }) as Run;
const workspace = { vcs_provider: 'github', vcs_repository: 'acme/network' } as Workspace;

describe('RunSourceDisplay', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('names the trigger in one chip', () => {
    render(<RunSourceDisplay run={run({ 'configuration-version-source': 'tfe-cli' })} />);
    const chip = screen.getByTitle('Triggered via CLI');
    expect(chip.textContent).toBe('via CLI');
  });

  it('falls back to the run source without a configuration version', () => {
    render(<RunSourceDisplay run={run({ source: 'tfe-ui' })} />);
    expect(screen.getByTitle('Triggered via UI').textContent).toBe('via UI');
  });

  it('renders nothing when the trigger is unknown', () => {
    const { container } = render(<RunSourceDisplay run={run({})} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the pull request, branch, commit and committer of a VCS run as separate chips', () => {
    render(
      <RunSourceDisplay
        run={run({
          'configuration-version-source': 'tfe-vcs',
          'pr-number': 42,
          'source-branch': 'feat/network-tags',
          'commit-hash': '7f3c9a1e0b2d4c6f',
          committer: 'alex.devries',
        })}
        workspace={workspace}
      />,
    );
    expect(screen.getByTitle('Triggered via VCS').textContent).toBe('via VCS');
    expect(screen.getByTitle('Open pull request #42').textContent).toBe('#42');
    expect(screen.getByTitle('Open branch feat/network-tags').textContent).toBe('feat/network-tags');
    expect(screen.getByTitle('Open commit 7f3c9a1').textContent).toBe('7f3c9a1');
    expect(screen.getByTitle('Committer').textContent).toBe('alex.devries');
  });

  it('opens a linked chip in a new tab without following the surrounding card link', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const onCardClick = vi.fn();
    render(
      <div onClick={onCardClick}>
        <RunSourceDisplay run={run({ 'configuration-version-source': 'tfe-vcs', 'pr-number': 42 })} workspace={workspace} />
      </div>,
    );
    fireEvent.click(screen.getByTitle('Open pull request #42'));
    expect(open).toHaveBeenCalledWith('https://github.com/acme/network/pull/42', '_blank', 'noopener,noreferrer');
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it('keeps VCS facts static when the workspace has no repository to link to', () => {
    render(<RunSourceDisplay run={run({ 'configuration-version-source': 'tfe-vcs', 'commit-hash': '7f3c9a1e0b2d' })} />);
    const chip = screen.getByTitle('Commit 7f3c9a1');
    expect(chip.tagName).toBe('SPAN');
  });
});
