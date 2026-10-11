// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, expect, it } from 'vitest';
import { webhookDeliveryFromJsonApi, type WebhookEventResource } from './webhookDeliveries';

// One element of `data` as GET /organizations/:name/webhook-events returns it.
const resource: WebhookEventResource = {
  id: '6d3f0a1e-0000-4000-8000-000000000001',
  type: 'webhook-events',
  attributes: {
    'event-type': 'push',
    provider: 'github',
    repository: 'acme/infra',
    branch: 'main',
    commit: 'c0ffee1',
    status: 'success',
    'response-code': 200,
    message: '2 workspace(s) triggered: network, compute',
    'delivered-at': '2026-10-11T09:30:00Z',
    'processed-at': '2026-10-11T09:30:01Z',
  },
};

describe('webhookDeliveryFromJsonApi', () => {
  it('maps the dash-case attributes of a webhook-events resource to a table row', () => {
    expect(webhookDeliveryFromJsonApi(resource)).toEqual({
      id: '6d3f0a1e-0000-4000-8000-000000000001',
      event_type: 'push',
      provider: 'github',
      repository: 'acme/infra',
      branch: 'main',
      commit: 'c0ffee1',
      status: 'success',
      response_code: 200,
      message: '2 workspace(s) triggered: network, compute',
      delivered_at: '2026-10-11T09:30:00Z',
    });
  });

  it('takes the id from the resource, not from an attribute', () => {
    const row = webhookDeliveryFromJsonApi({ ...resource, id: 'evt-2' });
    expect(row.id).toBe('evt-2');
  });

  it('keeps empty optional attributes empty, so the table renders its placeholder', () => {
    // A ping delivery has no repository, branch or commit; the API sends empty strings.
    const row = webhookDeliveryFromJsonApi({
      ...resource,
      attributes: {
        'event-type': 'ping',
        provider: 'github',
        repository: '',
        branch: '',
        commit: '',
        status: 'ignored',
        'response-code': 200,
        message: '',
        'delivered-at': '2026-10-11T09:31:00Z',
        'processed-at': null,
      },
    });
    expect(row.event_type).toBe('ping');
    expect(row.status).toBe('ignored');
    expect(row.repository).toBe('');
    expect(row.branch).toBe('');
    expect(row.message).toBe('');
  });

  it('does not read the snake_case keys of a flat row', () => {
    // A flat row has no `attributes`; mapping one must not silently produce a usable delivery.
    const flat = {
      id: 'evt-3',
      type: 'webhook-events',
      event_type: 'push',
      delivered_at: '2026-10-11T09:30:00Z',
      attributes: {},
    } as unknown as WebhookEventResource;
    const row = webhookDeliveryFromJsonApi(flat);
    expect(row.event_type).toBeUndefined();
    expect(row.delivered_at).toBeUndefined();
  });
});
