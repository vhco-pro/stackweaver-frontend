// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, type ReactNode, forwardRef, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  collapsible?: boolean;
  className?: string;
  onToggle?: (expanded: boolean) => void;
}

/**
 * CollapsibleSection component wraps content in a collapsible section
 * Used for Plan Phase and Apply Phase sections in run detail page
 */
export const CollapsibleSection = forwardRef<HTMLDivElement, CollapsibleSectionProps>(({
  title,
  children,
  defaultExpanded = true,
  collapsible = true,
  className,
  onToggle,
}, ref) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Sync expanded state with defaultExpanded prop when it changes
  // This ensures the section expands when run status changes (e.g., planning → planned)
  useEffect(() => {
    if (defaultExpanded !== undefined && expanded !== defaultExpanded) {
      // Use setTimeout to avoid setState during render
      const timer = setTimeout(() => setExpanded(defaultExpanded), 0);
      return () => clearTimeout(timer);
    }
  }, [defaultExpanded, expanded]);

  const handleToggle = () => {
    if (!collapsible) return;
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    onToggle?.(newExpanded);
  };

  return (
    <div ref={ref} className={cn('border rounded-lg overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={handleToggle}
        disabled={!collapsible}
        className={cn(
          'w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors',
          !collapsible && 'cursor-default'
        )}
      >
        <h2 className="text-xl font-semibold">{title}</h2>
        {collapsible && (
          <div className="flex items-center">
            {expanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
});

