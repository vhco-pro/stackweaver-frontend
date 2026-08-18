// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import * as React from "react"

/**
 * Shared empty state for the menu-shaped primitives (Select, DropdownMenu).
 *
 * A dropdown whose list came back empty used to open onto a blank popover,
 * which reads as a broken control rather than "there is nothing to pick".
 * `SelectContent` and `DropdownMenuContent` detect that case themselves and
 * render {@link MenuEmptyState}, so every call site inherits the behaviour
 * without repeating a `length === 0` check.
 */

/** Fallback wording when a call site does not pass its own `emptyMessage`. */
export const DEFAULT_EMPTY_MENU_MESSAGE = "No options available"

/**
 * The element types a menu's children can be made of, so emptiness can be
 * judged without knowing which primitive is asking.
 */
export interface MenuContentShape {
  /** Selectable entries. One of these means the menu has something to offer. */
  items: readonly unknown[]
  /** Wrappers that only group entries; their children are inspected too. */
  groups: readonly unknown[]
  /** Chrome that cannot be picked on its own (labels, separators, scroll buttons). */
  decorations: readonly unknown[]
}

function hasContent(node: React.ReactNode, shape: MenuContentShape): boolean {
  let found = false

  React.Children.forEach(node, (child) => {
    if (found || child === null || child === undefined || typeof child === "boolean") return

    if (typeof child === "string" || typeof child === "number") {
      // Bare text inside a menu was put there on purpose, so it counts.
      found = String(child).trim() !== ""
      return
    }

    if (!React.isValidElement(child)) return

    const type = child.type as unknown
    if (shape.decorations.includes(type)) return
    if (shape.items.includes(type)) {
      found = true
      return
    }
    if (type === React.Fragment || shape.groups.includes(type)) {
      found = hasContent((child.props as { children?: React.ReactNode }).children, shape)
      return
    }

    // Anything unrecognised - a custom option component, or a wrapper that
    // brings its own empty state - counts as content. Saying nothing is far
    // better than claiming a menu is empty when it is not.
    found = true
  })

  return found
}

/**
 * Whether `children` leave the user with nothing to pick: no entries, and no
 * unrecognised content that might render entries of its own. Labels,
 * separators and empty groups do not count as something to pick.
 */
export function isMenuEmpty(children: React.ReactNode, shape: MenuContentShape): boolean {
  return !hasContent(children, shape)
}
