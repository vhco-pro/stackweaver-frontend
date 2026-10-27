// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TourImages } from './TourImages';

async function decode(image: HTMLImageElement) {
  Object.defineProperty(image, 'decode', { configurable: true, value: vi.fn(() => Promise.resolve()) });
  await act(async () => { fireEvent.load(image); await Promise.resolve(); });
}

describe('deferred tour images', () => {
  it('requests only the active and adjacent screenshots initially', () => {
    const { container } = render(<TourImages active={0} theme="light" />);
    expect(container.querySelectorAll('img[src]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-tour-screen]')).toHaveLength(7);
  });

  it('retains the decoded screenshot while a distant selected capture loads', async () => {
    const { container, rerender } = render(<TourImages active={0} theme="light" />);
    const first = container.querySelector<HTMLImageElement>('[data-tour-screen="dashboard"]')!;
    await decode(first);
    rerender(<TourImages active={5} theme="light" />);
    expect(first).toHaveClass('opacity-100');
    expect(screen.getByRole('status')).toHaveTextContent('Loading screenshot');
    const selected = container.querySelector<HTMLImageElement>('[data-tour-screen="job"]')!;
    expect(selected).toHaveAttribute('data-active', 'true');
    await decode(selected);
    await waitFor(() => { expect(selected).toHaveClass('opacity-100'); });
    expect(first).toHaveClass('opacity-0');
    expect(container.querySelectorAll('img[src]').length).toBeLessThan(7);
  });

  it('keeps the initial capture requested when selection changes before its first decode', async () => {
    const { container, rerender } = render(<TourImages active={0} theme="light" />);
    const first = container.querySelector<HTMLImageElement>('[data-tour-screen="dashboard"]')!;
    const source = first.getAttribute('src');
    rerender(<TourImages active={5} theme="light" />);
    expect(first).toHaveAttribute('src', source);
    await decode(first);
    expect(first).toHaveClass('opacity-100');
    expect(screen.getByRole('status')).toHaveTextContent('Loading screenshot');
  });

  it('retains the previous theme until the selected new-theme capture decodes', async () => {
    const { container, rerender } = render(<TourImages active={0} theme="light" />);
    await decode(container.querySelector<HTMLImageElement>('[data-tour-screen="dashboard"]')!);
    rerender(<TourImages active={0} theme="dark" />);
    expect(container.querySelector('[data-tour-retained]')).toHaveAttribute('src', expect.stringContaining('dashboard-light'));
    const target = container.querySelector<HTMLImageElement>('[data-tour-screen="dashboard"]')!;
    expect(target).toHaveAttribute('data-theme', 'dark');
    expect(target).toHaveClass('opacity-0');
    await decode(target);
    await waitFor(() => { expect(target).toHaveClass('opacity-100'); });
  });
});
