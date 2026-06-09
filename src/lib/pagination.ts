// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import type { JsonApiListResponse, JsonApiResource } from '@/utils/jsonapi';

/**
 * Walk every server page of a JSON:API list endpoint and return the complete item set.
 *
 * Stackweaver's list endpoints paginate with a default page size of 20 and expose
 * `meta.pagination.total-pages`. A page that fetches a single unpaginated response therefore
 * silently shows only the first 20 rows. This helper assembles all of them (page size 100), so
 * the caller can search/filter across the full set and window the display with its own pager.
 *
 * `total` comes from the server's `total-count` (falls back to the assembled length).
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
