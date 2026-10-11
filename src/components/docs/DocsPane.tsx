// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  type PaneConfig,
  type PaneState,
  type PaneStorage,
  loadPaneState,
  savePaneState,
  widthFromDrag,
  widthFromKey,
} from './docsPanes';

function browserStorage(): PaneStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    // Accessing localStorage throws when storage is disabled.
    return undefined;
  }
}

/**
 * Width + collapsed state for one docs pane, persisted to localStorage. Writes
 * happen on discrete user actions (toggle, key press, drag end), never per
 * pointer-move, so a drag does not hammer storage.
 */
function useDocsPane(config: PaneConfig) {
  const [state, setState] = useState<PaneState>(() => loadPaneState(browserStorage(), config));
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; width: number } | null>(null);

  const commit = useCallback(
    (next: PaneState) => {
      setState(next);
      savePaneState(browserStorage(), config, next);
    },
    [config],
  );

  /**
   * Flip the collapsed state and return the new value. The update is flushed
   * before returning so the caller can move focus to a button that only exists
   * (or is only visible) in the new state.
   */
  const toggleCollapsed = (): boolean => {
    const collapsed = !state.collapsed;
    flushSync(() => {
      commit({ ...state, collapsed });
    });
    return collapsed;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Prevent text selection while dragging; capture keeps the moves coming
    // even when the pointer leaves the thin handle.
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, width: state.width };
    setDragging(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start) return;
    const width = widthFromDrag(start.width, start.x, e.clientX, config);
    setState((prev) => (prev.width === width ? prev : { ...prev, width }));
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start) return;
    dragStart.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    commit({ ...state, width: widthFromDrag(start.width, start.x, e.clientX, config) });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const width = widthFromKey(e.key, e.shiftKey, state.width, config);
    if (width === null) return;
    e.preventDefault();
    commit({ ...state, width });
  };

  /** Double-click on the handle restores the default width. */
  const onDoubleClick = () => {
    commit({ ...state, width: config.defaultWidth });
  };

  return {
    ...state,
    dragging,
    toggleCollapsed,
    handleProps: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, onKeyDown, onDoubleClick },
  };
}

interface DocsPaneProps {
  config: PaneConfig;
  /** DOM id of the aside; the content region and separator derive theirs from it. */
  id: string;
  /** Human name used in the landmark and control labels, e.g. "navigation sidebar". */
  label: string;
  /** Breakpoint visibility, e.g. `hidden lg:flex`. Below it the mobile Sheet takes over. */
  className?: string;
  /**
   * Renders the pane body. It receives the collapse button so the body can seat
   * it in its own header row (beside the search box, beside "On this page")
   * instead of the pane spending a row of its own on one icon.
   */
  children: (collapseButton: ReactNode) => ReactNode;
}

// 36px visual, 44px hit area: the ::before extends the target without making
// the button taller than the search box and heading it shares a row with.
const TOGGLE_BUTTON_CLASS =
  "relative h-9 w-9 shrink-0 rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground before:absolute before:-inset-1 before:content-['']";

/**
 * A desktop docs pane (sidebar or table of contents) that can be resized by
 * dragging or with the keyboard, and collapsed to a slim rail. The pane keeps
 * its content mounted while collapsed so tree expansion and scroll-spy state
 * survive a collapse/expand round trip.
 *
 * The pane only owns its own width. The centre column is `flex-1`, so whatever
 * a pane gives up by narrowing or collapsing goes straight to the content.
 */
export function DocsPane({ config, id, label, className, children }: DocsPaneProps) {
  const pane = useDocsPane(config);
  const isLeft = config.side === 'left';
  const contentId = `${id}-content`;

  const CollapseIcon = isLeft ? PanelLeftClose : PanelRightClose;
  const ExpandIcon = isLeft ? PanelLeftOpen : PanelRightOpen;

  // Collapsing hides the button that was just pressed and reveals its
  // counterpart (the rail's expand button, or the header's collapse button), so
  // focus is handed across rather than dropped to <body>.
  const collapseButtonRef = useRef<HTMLButtonElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const toggle = () => {
    const collapsed = pane.toggleCollapsed();
    (collapsed ? expandButtonRef : collapseButtonRef).current?.focus();
  };

  const collapseButton = (
    <Button
      ref={collapseButtonRef}
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={`Collapse ${label}`}
      aria-expanded
      aria-controls={contentId}
      className={TOGGLE_BUTTON_CLASS}
    >
      <CollapseIcon className="h-4 w-4" />
    </Button>
  );

  return (
    <aside
      id={id}
      aria-label={label}
      data-collapsed={pane.collapsed ? 'true' : 'false'}
      style={pane.collapsed ? undefined : { width: pane.width }}
      className={cn(
        'relative shrink-0 flex-col sticky top-24 h-[calc(100vh-6rem)] border-border/40 bg-background/50',
        isLeft ? 'border-r' : 'border-l',
        pane.collapsed && 'w-12',
        // Animate collapse/expand, but follow the pointer 1:1 while dragging.
        !pane.dragging && 'transition-[width] duration-300 ease-out',
        className,
      )}
    >
      {/* The rail. Its top padding matches the header rows, so the expand button
          lands where the collapse button was and toggling needs no pointer travel. */}
      {pane.collapsed && (
        <div className="flex shrink-0 justify-center pt-4">
          <Button
            ref={expandButtonRef}
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={`Expand ${label}`}
            aria-expanded={false}
            aria-controls={contentId}
            className={TOGGLE_BUTTON_CLASS}
          >
            <ExpandIcon className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div id={contentId} hidden={pane.collapsed} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {children(collapseButton)}
      </div>

      {!pane.collapsed && (
        <div
          role="separator"
          tabIndex={0}
          aria-label={`Resize ${label}`}
          aria-controls={id}
          aria-orientation="vertical"
          aria-valuenow={pane.width}
          aria-valuemin={config.minWidth}
          aria-valuemax={config.maxWidth}
          title="Drag to resize, double-click to reset"
          {...pane.handleProps}
          className={cn(
            'group absolute inset-y-0 z-10 w-3 cursor-col-resize touch-none select-none outline-none',
            isLeft ? '-right-1.5' : '-left-1.5',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full transition-colors duration-200',
              'group-hover:bg-primary/40 group-focus-visible:bg-primary',
              pane.dragging ? 'bg-primary' : 'bg-transparent',
            )}
          />
        </div>
      )}
    </aside>
  );
}
