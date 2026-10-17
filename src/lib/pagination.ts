// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import type { JsonApiListResponse, JsonApiResource } from '@/utils/jsonapi';

/**
 * Walk every server page of a JSON:API list endpoint and return the complete item set.
 *
 * A caller that fetches one response and renders it shows only the first page, silently - no
 * error, nothing in the console. This helper assembles all of them (page size 100), so the
 * caller can search/filter across the full set and window the display with its own pager.
 *
 * `total` comes from the server's `total-count` when the block states one, and is the assembled
 * length otherwise.
 *
 * ## The contract this relies on
 *
 * Every JSON:API collection under `/api/v2` states its size in `meta.pagination`, with the six
 * members #756 standardised - `current-page`, `page-size`, `prev-page`, `next-page`,
 * `total-pages`, `total-count`. `TestEveryCollectionStatesItsPagination` (backend) fails if a
 * collection arrives without it.
 *
 * The one member every block states honestly is `next-page`, so that is the member this helper
 * follows, until it is null. A collection the server counts itself states the totals too; a
 * provider pass-through listing (the VCS repositories, projects and branches) cannot, because the
 * provider reports no total, so its `total-pages` and `total-count` are null and its `next-page`
 * is set exactly when the page came back full (#858). Reading `total-pages` would read such a
 * listing as one page.
 *
 * Page *size* is not part of the contract and is not uniform. Collections that genuinely
 * paginate honour `page[size]`; those the handler materialises in full ignore it and answer with
 * one page holding everything and a null `next-page`. Both are honest, and this helper handles
 * both without knowing which it is talking to.
 *
 * A response without a block is read as one page, and a `next-page` that does not move past the
 * page just read ends the walk rather than looping on it.
 */
export async function fetchAllPages(
  fetchPage: (page: number, pageSize: number) => Promise<JsonApiListResponse<JsonApiResource>>,
): Promise<{ items: JsonApiResource[]; total: number }> {
  const pageSize = 100;
  const items: JsonApiResource[] = [];
  let total: number | null = null;
  let page: number | null = 1;
  while (page !== null) {
    const res = await fetchPage(page, pageSize);
    items.push(...(res.data ?? []));
    const block = res.meta?.pagination;
    if (page === 1) total = block?.['total-count'] ?? null;
    const next = block?.['next-page'] ?? null;
    page = next !== null && next > page ? next : null;
  }
  return { items, total: total ?? items.length };
}
