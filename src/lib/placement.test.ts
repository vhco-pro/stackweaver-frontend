// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, expect, it } from 'vitest';
import { hasPlacement, networkModeLabel, placementFromAttributes, queueReasonText } from './placement';

describe('placementFromAttributes', () => {
  it('reads the wire attributes of a placement record', () => {
    const p = placementFromAttributes({
      attempt: 2,
      driver: 'container',
      'placement-id': 'sw-job-run-1-2',
      image: 'stackweaver-runner:1',
      'image-digest': 'sha256:abc',
      'image-level': 'platform',
      'identity-binding-id': null,
      node: 'host-a',
      'queue-reason': '',
      'queue-cap': null,
      'queue-in-flight': null,
    });
    expect(p).toEqual({
      attempt: 2,
      driver: 'container',
      placement_id: 'sw-job-run-1-2',
      image: 'stackweaver-runner:1',
      image_digest: 'sha256:abc',
      image_level: 'platform',
      identity_binding_id: null,
      node: 'host-a',
      queue_reason: '',
      queue_cap: null,
      queue_in_flight: null,
      queue_position: null,
    });
    expect(hasPlacement(p)).toBe(true);
  });

  it('returns undefined for anything that is not an object', () => {
    expect(placementFromAttributes(undefined)).toBeUndefined();
    expect(placementFromAttributes('x')).toBeUndefined();
  });

  it('treats a record with no driver as not yet placed', () => {
    expect(hasPlacement(placementFromAttributes({ attempt: 0, driver: '' }))).toBe(false);
  });
});

describe('queueReasonText', () => {
  it('names the slots in use while the hosted pool is at its cap', () => {
    const p = placementFromAttributes({ 'queue-reason': 'hosted_capacity_cap', 'queue-cap': 5, 'queue-in-flight': 5 });
    expect(queueReasonText(p)).toBe('Waiting for hosted capacity (5 of 5 slots in use)');
  });

  it('names the place in the queue when the record carries it', () => {
    const p = placementFromAttributes({ 'queue-reason': 'hosted_capacity_cap', 'queue-cap': 2, 'queue-in-flight': 2, 'queue-position': 3 });
    expect(queueReasonText(p)).toBe('Waiting for hosted capacity (2 of 2 slots in use, position 3 in the queue)');
    const q = placementFromAttributes({ 'queue-reason': 'no_hosted_capacity_in_group', 'queue-position': 1 });
    expect(queueReasonText(q)).toBe('Waiting for hosted capacity (no hosted launcher is online, position 1 in the queue)');
  });

  it('says when no hosted launcher of the group is online', () => {
    const p = placementFromAttributes({ 'queue-reason': 'no_hosted_capacity_in_group', 'queue-cap': 0, 'queue-in-flight': 0 });
    expect(queueReasonText(p)).toBe('Waiting for hosted capacity (no hosted launcher is online)');
  });

  it('is empty when the work is not waiting on hosted capacity', () => {
    expect(queueReasonText(placementFromAttributes({ 'queue-reason': '' }))).toBe('');
    expect(queueReasonText(undefined)).toBe('');
  });
});

describe('networkModeLabel', () => {
  it('labels the launcher network modes', () => {
    expect(networkModeLabel('platform')).toBe('Platform (egress only, metadata blocked)');
    expect(networkModeLabel('host-identity')).toBe('Host identity (metadata reachable)');
    expect(networkModeLabel('other')).toBe('other');
    expect(networkModeLabel('')).toBe('-');
  });
});
