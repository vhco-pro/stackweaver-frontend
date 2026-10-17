// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// fetchAllPages walks a collection by its `next-page` member. A collection the server counts
// itself states every member of the block; a provider pass-through listing (the VCS repositories,
// projects and branches) states `next-page` and leaves `total-pages` and `total-count` null,
// because the provider reports no total. Both must come back whole.

import { describe, expect, it, vi } from 'vitest';
import type { JsonApiListResponse, JsonApiResource } from '@/utils/jsonapi';
import { fetchAllPages } from './pagination';

type Block = NonNullable<NonNullable<JsonApiListResponse['meta']>['pagination']>;

function rows(from: number, n: number): JsonApiResource[] {
  return Array.from({ length: n }, (_, i) => ({ id: String(from + i), type: 'things', attributes: {} }));
}

function page(data: JsonApiResource[], pagination: Block): JsonApiListResponse {
  return { data, meta: { pagination } };
}

// The block NewProviderPageMeta writes: totals null, next-page set only when the page was full.
function providerBlock(current: number, size: number, next: number | null): Block {
  return {
    'current-page': current,
    'page-size': size,
    'prev-page': current > 1 ? current - 1 : null,
    'next-page': next,
    'total-pages': null,
    'total-count': null,
  };
}

// The block NewPaginationMeta writes: every member stated.
function countedBlock(current: number, size: number, totalCount: number): Block {
  const totalPages = Math.max(1, Math.ceil(totalCount / size));
  return {
    'current-page': current,
    'page-size': size,
    'prev-page': current > 1 ? current - 1 : null,
    'next-page': current < totalPages ? current + 1 : null,
    'total-pages': totalPages,
    'total-count': totalCount,
  };
}

describe('fetchAllPages', () => {
  it('follows next-page through a provider listing whose totals are null', async () => {
    const pages: Record<number, JsonApiListResponse> = {
      1: page(rows(0, 100), providerBlock(1, 100, 2)),
      2: page(rows(100, 100), providerBlock(2, 100, 3)),
      3: page(rows(200, 7), providerBlock(3, 100, null)),
    };
    const fetchPage = vi.fn((n: number) => Promise.resolve(pages[n]));

    const { items, total } = await fetchAllPages(fetchPage);

    expect(fetchPage.mock.calls.map(([n]) => n)).toEqual([1, 2, 3]);
    expect(items).toHaveLength(207);
    expect(items[206].id).toBe('206');
    // No total-count to read, so the total is what was assembled.
    expect(total).toBe(207);
  });

  it('stops after a provider page whose next-page is null', async () => {
    const fetchPage = vi.fn(() => Promise.resolve(page(rows(0, 3), providerBlock(1, 100, null))));

    const { items, total } = await fetchAllPages(fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(items).toHaveLength(3);
    expect(total).toBe(3);
  });

  it('follows next-page through a counted collection and reports its total-count', async () => {
    const pages: Record<number, JsonApiListResponse> = {
      1: page(rows(0, 100), countedBlock(1, 100, 150)),
      2: page(rows(100, 50), countedBlock(2, 100, 150)),
    };
    const fetchPage = vi.fn((n: number) => Promise.resolve(pages[n]));

    const { items, total } = await fetchAllPages(fetchPage);

    expect(fetchPage.mock.calls.map(([n]) => n)).toEqual([1, 2]);
    expect(items).toHaveLength(150);
    expect(total).toBe(150);
  });

  it('reads one page from a collection the handler materialises in full', async () => {
    // NewFullPageMeta: one page holding everything, page-size the row count, next-page null.
    const fetchPage = vi.fn(() => Promise.resolve(page(rows(0, 240), countedBlock(1, 240, 240))));

    const { items, total } = await fetchAllPages(fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(items).toHaveLength(240);
    expect(total).toBe(240);
  });

  it('reads one page when the response carries no pagination block', async () => {
    const fetchPage = vi.fn(() => Promise.resolve({ data: rows(0, 4) } as JsonApiListResponse));

    const { items, total } = await fetchAllPages(fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(items).toHaveLength(4);
    expect(total).toBe(4);
  });

  it('stops when next-page does not advance', async () => {
    // Every page names page 2 as the next: from page 2 that is the page just read, and following
    // it would loop forever.
    const fetchPage = vi.fn((n: number) => Promise.resolve(page(rows(n * 10, 10), providerBlock(n, 10, 2))));

    const { items } = await fetchAllPages(fetchPage);

    expect(fetchPage.mock.calls.map(([n]) => n)).toEqual([1, 2]);
    expect(items).toHaveLength(20);
  });
});
