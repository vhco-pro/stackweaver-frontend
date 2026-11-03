// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CookieConsent } from './CookieConsent';

function openBanner() {
  render(<MemoryRouter><CookieConsent /></MemoryRouter>);
  act(() => { vi.advanceTimersByTime(1000); });
}

describe('CookieConsent', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('keeps the delayed banner and privacy link', () => {
    render(<MemoryRouter><CookieConsent /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Accept All' })).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByRole('link', { name: /read the privacy policy/i })).toHaveAttribute('href', '/privacy');
  });

  it('exposes named switches and saves the selected categories', () => {
    openBanner();
    fireEvent.click(screen.getByRole('button', { name: 'Cookie Settings' }));
    expect(screen.getByRole('switch', { name: /necessary/i })).toBeDisabled();
    expect(screen.getByRole('switch', { name: /necessary/i })).toBeChecked();
    fireEvent.click(screen.getByRole('switch', { name: /analytics/i }));
    expect(screen.getByRole('switch', { name: /analytics/i })).toBeChecked();
    expect(screen.getByRole('switch', { name: /marketing/i })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Save Preferences' }));
    expect(JSON.parse(localStorage.getItem('cookie-consent')!)).toEqual({
      necessary: true, analytics: true, marketing: false, timestamp: expect.any(String),
    });
    expect(screen.queryByRole('button', { name: 'Save Preferences' })).not.toBeInTheDocument();
  });

  it.each([
    ['Accept All', true, true],
    ['Necessary', false, false],
  ])('%s preserves the stored consent format', (name, analytics, marketing) => {
    openBanner();
    fireEvent.click(screen.getByRole('button', { name: String(name) }));
    expect(JSON.parse(localStorage.getItem('cookie-consent')!)).toEqual({
      necessary: true, analytics, marketing, timestamp: expect.any(String),
    });
  });

  it('cancels settings and dismisses without saving consent', () => {
    openBanner();
    fireEvent.click(screen.getByRole('button', { name: 'Cookie Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(localStorage.getItem('cookie-consent')).toBeNull();
  });

  it('respects an existing consent choice', () => {
    localStorage.setItem('cookie-consent', JSON.stringify({ necessary: true, analytics: false, marketing: false }));
    openBanner();
    expect(screen.queryByRole('button', { name: 'Accept All' })).not.toBeInTheDocument();
  });
});
