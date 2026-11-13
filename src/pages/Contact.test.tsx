// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Contact from './Contact';

vi.mock('@/components/navigation/PublicNav', () => ({ PublicNav: () => null }));
vi.mock('@/components/ContactChallenge', () => ({
  ContactChallenge: ({ onVerified }: { onVerified: (token: string) => void }) => (
    <button type="button" onClick={() => onVerified(crypto.randomUUID())}>Complete test challenge</button>
  ),
}));

const fetchContact = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchContact);
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('__STACKWEAVER__', { VITE_CONTACT_TURNSTILE_SITE_KEY: 'test-key' });
  const setting = document.createElement('meta');
  setting.name = 'sw-contact-enabled';
  setting.content = '1';
  document.head.append(setting);
});

afterEach(() => {
  document.querySelector('meta[name="sw-contact-enabled"]')?.remove();
  vi.unstubAllGlobals();
  fetchContact.mockReset();
});

function reviewMessage() {
  render(<MemoryRouter><Contact /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test Visitor' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'visitor@example.invalid' } });
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'A test enquiry' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review message' }));
}

function sendWithChallenge() {
  fireEvent.click(screen.getByRole('button', { name: 'Complete test challenge' }));
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
}

function requests(): Array<{ submissionId: string; turnstileToken: string; message: string }> {
  return fetchContact.mock.calls.map(([, init]) => {
    if (typeof init?.body !== 'string') throw new Error('Expected a JSON request body');
    return JSON.parse(init.body);
  });
}

describe('contact delivery recovery', () => {
  it('keeps the ID and gets a fresh challenge if the original request never arrived', async () => {
    fetchContact.mockRejectedValueOnce(new TypeError('Connection lost'))
      .mockResolvedValueOnce(Response.json({ status: 'challenge_invalid' }, { status: 403 }))
      .mockResolvedValueOnce(Response.json({ status: 'accepted' }));
    reviewMessage();
    sendWithChallenge();
    fireEvent.click(await screen.findByRole('button', { name: 'Check status' }));
    await screen.findByText('Complete a new spam check to try sending this message again.');
    expect(screen.getByRole('button', { name: 'Edit message' })).toBeDisabled();
    sendWithChallenge();
    await screen.findByRole('heading', { name: 'Message sent' });
    const [first, check, retry] = requests();
    expect(check).toEqual({ ...first, turnstileToken: '', name: 'Test Visitor', email: 'visitor@example.invalid', topic: '' });
    expect(retry.submissionId).toBe(first.submissionId);
    expect(retry.message).toBe(first.message);
    expect(retry.turnstileToken).not.toBe(first.turnstileToken);
  });

  it('lets the visitor retry a temporary verification outage with the same ID', async () => {
    fetchContact.mockResolvedValueOnce(Response.json({ status: 'verification_unavailable' }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ status: 'accepted' }));
    reviewMessage();
    sendWithChallenge();
    await screen.findByText('Complete a new spam check to try sending this message again.');
    expect(screen.getByRole('button', { name: 'Edit message' })).toBeEnabled();
    sendWithChallenge();
    await screen.findByRole('heading', { name: 'Message sent' });
    const [first, retry] = requests();
    expect(retry.submissionId).toBe(first.submissionId);
    expect(retry.turnstileToken).not.toBe(first.turnstileToken);
  });
});
