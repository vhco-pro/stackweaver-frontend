// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ErrorDisplay } from './ErrorDisplay';

describe('ErrorDisplay with a platform error', () => {
  it('shows an error that is not an OpenTofu diagnostic as it was given', () => {
    const message = 'the job could not be placed: the job image ghcr.io/opentofu/opentofu:1.10 runs as root, which this pool does not allow';
    render(<ErrorDisplay logs={message} title="Plan Error" />);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByText(/Unable to parse error details/)).not.toBeInTheDocument();
  });

  it('keeps every line of a multi-line platform error', () => {
    render(<ErrorDisplay logs={'runner lost: the launcher stopped answering\nthe run can be queued again'} title="Apply Error" />);
    expect(screen.getByText(/runner lost: the launcher stopped answering/)).toBeInTheDocument();
    expect(screen.getByText(/the run can be queued again/)).toBeInTheDocument();
  });

  it('falls back to the download hint only when there is nothing to show', () => {
    render(<ErrorDisplay logs="   " title="Plan Error" />);
    expect(screen.getByText(/Unable to parse error details/)).toBeInTheDocument();
  });
});
