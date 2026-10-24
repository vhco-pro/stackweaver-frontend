// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * The install-wide admin routes answer 404 to anyone who is not a platform administrator
 * (TFE's "not an administrator" answer), so a platform page reads a 404 as "not for you".
 */
export function isNotFound(err: unknown): boolean {
  return (err as { status?: number } | null)?.status === 404;
}

/** React Query's `retry` for an admin route: a 404 is an answer, not a failure worth retrying. */
export function retryUnlessNotFound(failureCount: number, err: unknown): boolean {
  return !isNotFound(err) && failureCount < 2;
}
