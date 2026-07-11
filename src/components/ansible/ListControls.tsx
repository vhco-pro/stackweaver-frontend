// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface ListControlOption {
  value: string;
  label: string;
}

interface ListSortControlProps {
  value: string;
  order: 'asc' | 'desc';
  options: ListControlOption[];
  onValueChange: (value: string) => void;
  onOrderChange: (order: 'asc' | 'desc') => void;
  className?: string;
}

/**
 * Reusable sort control: a key Select plus an asc/desc toggle. Shared across the
 * Ansible list pages so sorting looks and behaves identically everywhere.
 */
export function ListSortControl({
  value,
  order,
  options,
  onValueChange,
  onOrderChange,
  className,
}: ListSortControlProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-[170px]" aria-label="Sort by">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        aria-label={order === 'asc' ? 'Sort ascending' : 'Sort descending'}
        onClick={() => onOrderChange(order === 'asc' ? 'desc' : 'asc')}
        title={order === 'asc' ? 'Ascending' : 'Descending'}
      >
        {order === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
      </Button>
    </div>
  );
}

interface ListFilterSelectProps {
  value: string;
  options: ListControlOption[];
  onValueChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Reusable filter Select for the list pages (status / type). Option `value`
 * 'all' is treated as the unfiltered default by callers.
 */
export function ListFilterSelect({
  value,
  options,
  onValueChange,
  ariaLabel,
  className,
}: ListFilterSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn('w-[150px]', className)} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
