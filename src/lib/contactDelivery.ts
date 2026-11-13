// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

export interface ContactDraft {
  name: string;
  email: string;
  topic: string;
  message: string;
}

export type ContactResult = 'accepted' | 'pending' | 'uncertain' | 'limited' | 'invalid' | 'verify_again' | 'unavailable';

export async function sendContact(draft: ContactDraft, submissionId: string, turnstileToken: string): Promise<{ outcome: ContactResult; retryAfter?: number }> {
  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...draft, submissionId, turnstileToken }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.headers.get('Content-Type')?.includes('application/json')) return { outcome: 'uncertain' };
    const result: unknown = await response.json();
    if (typeof result !== 'object' || result === null || !('status' in result)) return { outcome: 'uncertain' };
    if (response.status === 200 && result.status === 'accepted') return { outcome: 'accepted' };
    if (response.status === 202 && result.status === 'pending') return { outcome: 'pending' };
    if ((response.status === 403 && result.status === 'challenge_invalid' && !turnstileToken)
      || (response.status === 503 && result.status === 'verification_unavailable')) {
      return { outcome: 'verify_again' };
    }
    if (response.status === 429 && result.status === 'rate_limited') {
      const seconds = Number(response.headers.get('Retry-After'));
      return { outcome: 'limited', retryAfter: Number.isFinite(seconds) && seconds > 0 ? Math.min(86_400, seconds) : 60 };
    }
    if ([400, 403, 409, 413, 415, 422].includes(response.status)) return { outcome: 'invalid' };
    if (response.status === 503 && result.status === 'unavailable') return { outcome: 'unavailable' };
    return { outcome: 'uncertain' };
  } catch {
    return { outcome: 'uncertain' };
  }
}
