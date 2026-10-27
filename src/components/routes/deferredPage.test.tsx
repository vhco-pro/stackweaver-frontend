// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { deferredPage } from './deferredPage';

describe('deferred page navigation', () => {
  it('shows a new destination loading inside the existing chrome during router transitions', async () => {
    let finish: (value: { default: () => React.JSX.Element }) => void = () => undefined;
    const load = vi.fn(() => new Promise<{ default: () => React.JSX.Element }>((resolve) => { finish = resolve; }));
    const Destination = deferredPage(load);
    function Links() {
      const navigate = useNavigate();
      return <><nav>Navigation</nav><button onClick={() => { void navigate('/next'); }}>Next</button></>;
    }
    render(<MemoryRouter><Links /><Routes><Route path="/" element={<p>Previous page</p>} /><Route path="/next" element={<Destination />} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByText('Next'));
    expect(await screen.findByRole('status')).toHaveTextContent('Loading page');
    expect(screen.getByRole('navigation')).toHaveTextContent('Navigation');
    expect(screen.queryByText('Previous page')).not.toBeInTheDocument();
    await act(async () => { finish({ default: () => <p>Destination</p> }); await Promise.resolve(); });
    expect(await screen.findByText('Destination')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps a loaded page instance when only its URL parameters change', async () => {
    const Destination = deferredPage(() => Promise.resolve({ default: function Counter() {
      const [count, setCount] = useState(0);
      return <button onClick={() => { setCount(count + 1); }}>Count {count}</button>;
    } }));
    function Next() {
      const navigate = useNavigate();
      return <button onClick={() => { void navigate('/items/two'); }}>Next item</button>;
    }
    render(<MemoryRouter initialEntries={['/items/one']}><Next /><Routes><Route path="/items/:id" element={<Destination />} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByText('Count 0'));
    fireEvent.click(screen.getByText('Next item'));
    expect(await screen.findByText('Count 1')).toBeInTheDocument();
  });

  it('shows actionable recovery for a rejected module, and navigation away still works', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Broken = deferredPage(() => Promise.reject<{ default: () => React.JSX.Element }>(new TypeError('Failed to fetch dynamically imported module')));
    function Back() {
      const navigate = useNavigate();
      return <button onClick={() => { void navigate('/'); }}>Home</button>;
    }
    try {
      render(<MemoryRouter initialEntries={['/broken?code=keep&state=keep#anchor']}><Back /><Routes><Route path="/broken" element={<Broken />} /><Route path="/" element={<p>Home page</p>} /></Routes></MemoryRouter>);
      expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
      expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
      fireEvent.click(screen.getByText('Home'));
      await waitFor(() => { expect(screen.getByText('Home page')).toBeInTheDocument(); });
    } finally { errorLog.mockRestore(); }
  });

  it('shares the requested destination load with rendering', async () => {
    const load = vi.fn(() => Promise.resolve({ default: () => <p>Loaded once</p> }));
    const Destination = deferredPage(load);
    await Destination.preload();
    render(<MemoryRouter><Destination /></MemoryRouter>);
    expect(await screen.findByText('Loaded once')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
