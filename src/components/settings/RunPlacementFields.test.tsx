// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The inherited-value hint names the level a setting comes from, and stays away when the object
// sets the value itself (#933, D0, D15).

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InheritedHint } from './RunPlacementFields';
import { bindingsForPool } from '@/lib/runPlacement';
import { formatSeconds } from '@/lib/runPlacement';

describe('InheritedHint', () => {
  it('names the level and value an object inherits', () => {
    render(<InheritedHint setting={{ value: 5400, level: 'project' }} ownLevel="workspace" describe={formatSeconds} testId="hint" />);
    expect(screen.getByTestId('hint')).toHaveTextContent('Inherited from the project: 1h 30m');
  });

  it('calls the deployment level the platform default', () => {
    render(<InheritedHint setting={{ value: 7200, level: 'deployment' }} ownLevel="job-template" describe={formatSeconds} testId="hint" />);
    expect(screen.getByTestId('hint')).toHaveTextContent('Inherited from the platform default: 2h');
  });

  it('shows nothing when the object sets the value itself', () => {
    const { container } = render(<InheritedHint setting={{ value: 60, level: 'workspace' }} ownLevel="workspace" describe={formatSeconds} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('bindingsForPool', () => {
  const opt = (id: string, pool: string) => ({ binding: { id, name: id, agent_pool_id: pool }, poolName: pool });
  const options = [opt('a', 'pool-1'), opt('b', 'pool-2'), opt('c', 'pool-1')];

  it('offers only the bindings of the pool the object runs on', () => {
    expect(bindingsForPool(options, 'pool-1').map(o => o.binding.id)).toEqual(['a', 'c']);
  });

  it('offers every binding while the pool is not chosen here (inherited)', () => {
    expect(bindingsForPool(options, undefined)).toHaveLength(3);
  });
});
