// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import * as React from "react"

import { cn } from "@/lib/utils"
import { DEFAULT_EMPTY_MENU_MESSAGE } from "@/components/ui/menu-empty.helpers"

/** The row rendered in place of an empty menu's (missing) entries. */
export function MenuEmptyState({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      role="presentation"
      className={cn("px-2 py-1.5 text-center text-sm text-muted-foreground", className)}
    >
      {children ?? DEFAULT_EMPTY_MENU_MESSAGE}
    </div>
  )
}
