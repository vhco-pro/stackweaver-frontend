// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the first load of a list page: while the list is still loading the page already shows
// its title block, with a skeleton holding the primary action's place, so only the body changes
// when the data arrives.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { projectsApi } from '@/api/client';
import Projects from './Projects';

vi.mock('@/api/client', () => ({
  projectsApi: {
    list: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/acme/projects']}>
        <Routes>
          <Route path="/app/:orgName/projects" element={<Projects />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Projects first load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the header with an action skeleton while the list is loading', () => {
    // A request that never settles keeps the query pending for the whole test.
    vi.mocked(projectsApi.list).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText('Loading projects...')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByTestId('page-header-action-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New Project' })).not.toBeInTheDocument();
  });
});
