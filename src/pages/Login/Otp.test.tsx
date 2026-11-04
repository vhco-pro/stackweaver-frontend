// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
// Each SMS or email challenge makes Zitadel send a new code and void the previous one, so the page
// must ask for exactly one code per visit. React's StrictMode mounts the page twice in development;
// two challenges then raced, and a reader of the newest message could get the voided code.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StrictMode, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { updateSession } from '@/api/auth-client';
import Otp from './Otp';

vi.mock('@/api/auth-client', () => ({
  updateSession: vi.fn(),
  finalizeAuthRequest: vi.fn(),
}));

vi.mock('./LoginLayout', () => ({
  default: ({ title, children }: { title: string; children: ReactNode }) => (
    <div><h1>{title}</h1>{children}</div>
  ),
}));

describe('Otp', () => {
  beforeEach(() => {
    vi.mocked(updateSession).mockReset();
    vi.mocked(updateSession).mockResolvedValue({} as Awaited<ReturnType<typeof updateSession>>);
  });

  it.each(['sms', 'email'])('asks for one %s code under StrictMode and shows the code form', async (method) => {
    render(
      <StrictMode>
        <MemoryRouter initialEntries={[`/login/otp/${method}?sessionId=s1&authRequest=r1`]}>
          <Routes>
            <Route path="/login/otp/:method" element={<Otp />} />
          </Routes>
        </MemoryRouter>
      </StrictMode>,
    );
    expect(await screen.findByRole('button', { name: /verify/i })).toBeInTheDocument();
    expect(updateSession).toHaveBeenCalledTimes(1);
  });
});
