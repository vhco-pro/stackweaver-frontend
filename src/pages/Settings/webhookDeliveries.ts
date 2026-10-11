// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The webhook deliveries table on the Webhooks settings page, as data: the `webhook-events`
// resource the API returns and the row the table renders.

/** One element of `data` from GET /organizations/:name/webhook-events. */
export interface WebhookEventResource {
  id: string;
  type: string;
  attributes: {
    'event-type': string;
    provider: string;
    repository?: string;
    branch?: string;
    commit?: string;
    status: WebhookDelivery['status'];
    'response-code'?: number;
    message?: string;
    'delivered-at': string;
    'processed-at'?: string | null;
  };
}

/** A row of the deliveries table. */
export interface WebhookDelivery {
  id: string;
  event_type: string;
  status: 'success' | 'failed' | 'ignored' | 'pending';
  provider: string;
  repository?: string;
  branch?: string;
  commit?: string;
  delivered_at: string;
  response_code?: number;
  message?: string;
}

/**
 * Maps a `webhook-events` resource to a table row.
 *
 * The attribute names are dash-case on the wire and the row's are not, so this renames them one
 * by one; `flattenResource` in `@/utils/jsonapi` copies attributes without renaming and is not
 * enough here.
 */
export function webhookDeliveryFromJsonApi(resource: WebhookEventResource): WebhookDelivery {
  const attrs = resource.attributes;
  return {
    id: resource.id,
    event_type: attrs['event-type'],
    provider: attrs.provider,
    repository: attrs.repository,
    branch: attrs.branch,
    commit: attrs.commit,
    status: attrs.status,
    response_code: attrs['response-code'],
    message: attrs.message,
    delivered_at: attrs['delivered-at'],
  };
}
