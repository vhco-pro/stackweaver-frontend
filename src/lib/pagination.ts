// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import type { JsonApiListResponse, JsonApiResource } from '@/utils/jsonapi';

/**
 * Walk every server page of a JSON:API list endpoint and return the complete item set.
 *
 * A caller that fetches one response and renders it shows only the first page, silently - no
 * error, nothing in the console. This helper assembles all of them (page size 100), so the
 * caller can search/filter across the full set and window the display with its own pager.
 *
 * `total` comes from the server's `total-count` (falls back to the assembled length).
 *
 * ## The contract this relies on
 *
 * Every JSON:API collection under `/api/v2` states its size in `meta.pagination`, with the six
 * members #756 standardised - `current-page`, `page-size`, `prev-page`, `next-page`,
 * `total-pages`, `total-count`. #761 gave the block to the 36 collections that emitted none, and
 * `TestEveryCollectionStatesItsPagination` (backend) fails if a new one arrives without it.
 *
 * Page *size* is not part of that contract and is not uniform. Collections that genuinely
 * paginate honour `page[size]`; those the handler materialises in full ignore it and answer with
 * one page holding everything. Both are honest, and this helper handles both without knowing
 * which it is talking to: it asks for page 1, reads `total-pages`, and stops when it runs out.
 *
 * One endpoint is exempt, with its reason in the backend census test: `/api/v2/activities` keeps
 * an offset-style block by decision in #756. Three top-N views used to sit alongside it -
 * `/activities/recent`, `.../ansible/jobs/queue` and `.../runs/queue` - reporting no total at
 * all; #773 gave them real ones. The `?? 1` fallback below still covers the remaining exemption
 * and any endpoint added without a block, so it is deliberate rather than defensive padding.
 * Do not remove it on the grounds that "every endpoint has pagination now".
 */
export async function fetchAllPages(
  fetchPage: (page: number, pageSize: number) => Promise<JsonApiListResponse<JsonApiResource>>,
): Promise<{ items: JsonApiResource[]; total: number }> {
  const pageSize = 100;
  const first = await fetchPage(1, pageSize);
  const items = [...(first.data ?? [])];
  const total = first.meta?.pagination?.['total-count'] ?? items.length;
  const totalPages = first.meta?.pagination?.['total-pages'] ?? 1;
  for (let page = 2; page <= totalPages; page++) {
    const res = await fetchPage(page, pageSize);
    items.push(...(res.data ?? []));
  }
  return { items, total };
}
