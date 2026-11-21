// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PlacementRecord, QueueReasonNotice } from './PlacementRecord';
import { placementFromAttributes } from '@/lib/placement';

const placed = placementFromAttributes({
  attempt: 1,
  driver: 'container',
  'placement-id': 'sw-job-run-abc-1',
  image: 'stackweaver-runner:slot-3',
  'image-digest': 'sha256:feed',
  'image-level': 'platform',
  'identity-binding-id': null,
  node: 'host-a',
});

describe('PlacementRecord', () => {
  it('is a compact chip that opens the placement of the latest attempt', () => {
    render(<PlacementRecord placement={placed} runnerName="launcher-1" />);
    const chip = screen.getByTestId('placement-record');
    expect(chip.textContent).toBe('launcher-1');
    expect(chip.getAttribute('aria-label')).toBe('Placement: attempt 1 on the container driver');
    expect(screen.queryByText('sw-job-run-abc-1')).toBeNull();

    fireEvent.click(chip);
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Attempt 1 on the container driver');
    expect(screen.getByText('sw-job-run-abc-1')).toBeTruthy();
    expect(screen.getByText('stackweaver-runner:slot-3@sha256:feed')).toBeTruthy();
    expect(screen.getByText('Platform default')).toBeTruthy();
    expect(screen.getByText('Platform token')).toBeTruthy();
    expect(screen.getByText('host-a')).toBeTruthy();
  });

  it('names the driver when the launcher is unknown', () => {
    render(<PlacementRecord placement={placed} />);
    expect(screen.getByTestId('placement-record').textContent).toBe('container driver');
  });

  it('shows only the launcher before the work is placed', () => {
    render(<PlacementRecord placement={placementFromAttributes({ attempt: 0, driver: '' })} runnerName="launcher-1" />);
    expect(screen.queryByTestId('placement-record')).toBeNull();
    expect(screen.getByText('launcher-1')).toBeTruthy();
  });

  it('renders nothing before the work is placed and without a launcher', () => {
    const { container } = render(<PlacementRecord placement={placementFromAttributes({ attempt: 0, driver: '' })} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('QueueReasonNotice', () => {
  it('names the slots in use while waiting on the cap', () => {
    render(<QueueReasonNotice placement={placementFromAttributes({ 'queue-reason': 'hosted_capacity_cap', 'queue-cap': 5, 'queue-in-flight': 3 })} />);
    expect(screen.getByRole('status').textContent).toBe('Waiting for hosted capacity (3 of 5 slots in use)');
  });

  it('renders nothing when the work is not waiting', () => {
    const { container } = render(<QueueReasonNotice placement={placed} />);
    expect(container.innerHTML).toBe('');
  });
});
