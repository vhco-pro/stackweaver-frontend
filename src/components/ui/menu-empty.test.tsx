// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins the shared empty state for the menu primitives: an empty list must say
// so instead of opening onto a blank popover, and a menu that does have
// something to pick must never show the message.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { isMenuEmpty } from './menu-empty.helpers';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from './dropdown-menu';

const SELECT_SHAPE = {
  items: [SelectItem],
  groups: [SelectGroup],
  decorations: [SelectLabel, SelectSeparator],
};

describe('isMenuEmpty', () => {
  it('treats no children as empty', () => {
    expect(isMenuEmpty(undefined, SELECT_SHAPE)).toBe(true);
    expect(isMenuEmpty(null, SELECT_SHAPE)).toBe(true);
    expect(isMenuEmpty([], SELECT_SHAPE)).toBe(true);
  });

  it('treats a list that mapped to nothing as empty', () => {
    const options: string[] = [];
    expect(
      isMenuEmpty(
        options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>),
        SELECT_SHAPE
      )
    ).toBe(true);
  });

  it('does not count labels and separators as something to pick', () => {
    expect(
      isMenuEmpty(
        <>
          <SelectLabel>Regions</SelectLabel>
          <SelectSeparator />
        </>,
        SELECT_SHAPE
      )
    ).toBe(true);
  });

  it('treats an empty group as empty but a filled one as not', () => {
    expect(isMenuEmpty(<SelectGroup>{[]}</SelectGroup>, SELECT_SHAPE)).toBe(true);
    expect(
      isMenuEmpty(
        <SelectGroup>
          <SelectItem value="a">A</SelectItem>
        </SelectGroup>,
        SELECT_SHAPE
      )
    ).toBe(false);
  });

  it('sees items behind a false condition and a fragment', () => {
    const show = false;
    expect(isMenuEmpty(<>{show && <SelectItem value="a">A</SelectItem>}</>, SELECT_SHAPE)).toBe(true);
    expect(isMenuEmpty(<><SelectItem value="a">A</SelectItem></>, SELECT_SHAPE)).toBe(false);
  });

  it('leaves unrecognised content alone rather than calling the menu empty', () => {
    // A call site with its own search box and empty state must keep it, so
    // anything the primitives do not know about counts as content.
    expect(isMenuEmpty(<div>custom content</div>, SELECT_SHAPE)).toBe(false);
  });
});

describe('SelectContent', () => {
  it('says the list is empty instead of rendering an empty popover', () => {
    render(
      <Select defaultOpen>
        <SelectTrigger><SelectValue placeholder="Pick one" /></SelectTrigger>
        <SelectContent>{[].map((o) => <SelectItem key={o} value={o} />)}</SelectContent>
      </Select>
    );

    expect(screen.getByText('No options available')).toBeInTheDocument();
  });

  it('uses the call site wording when given one', () => {
    render(
      <Select defaultOpen>
        <SelectTrigger><SelectValue placeholder="Pick one" /></SelectTrigger>
        <SelectContent emptyMessage="No workspaces available">{[]}</SelectContent>
      </Select>
    );

    expect(screen.getByText('No workspaces available')).toBeInTheDocument();
  });

  it('stays out of the way when there are options', () => {
    render(
      <Select defaultOpen>
        <SelectTrigger><SelectValue placeholder="Pick one" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
        </SelectContent>
      </Select>
    );

    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.queryByText('No options available')).not.toBeInTheDocument();
  });
});

describe('DropdownMenuContent', () => {
  it('says the menu is empty when every entry was filtered out', () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent emptyMessage="No actions available">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          {[].map((a) => <DropdownMenuItem key={a}>{a}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
    );

    expect(screen.getByText('No actions available')).toBeInTheDocument();
  });

  it('stays out of the way when there are entries', () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.queryByText('No options available')).not.toBeInTheDocument();
  });
});
