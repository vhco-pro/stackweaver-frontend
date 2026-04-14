// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  picture?: string;
  name?: string;
  email?: string;
  size?: 'sm' | 'md';
  className?: string;
}

function getInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return '';
}

const sizeClasses = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
} as const;

const iconSizes = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
} as const;

export function UserAvatar({ picture, name, email, size = 'sm', className }: UserAvatarProps) {
  const sizeClass = sizeClasses[size];
  const initials = getInitials(name, email);

  if (picture) {
    return (
      <img
        src={picture}
        alt=""
        className={cn('rounded-full object-cover shrink-0', sizeClass, className)}
        referrerPolicy="no-referrer"
      />
    );
  }

  if (initials) {
    return (
      <span
        className={cn(
          'rounded-full shrink-0 flex items-center justify-center font-medium',
          'bg-gradient-to-br from-blue-500 to-purple-500 text-white',
          sizeClass,
          className,
        )}
      >
        {initials}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'rounded-full shrink-0 flex items-center justify-center',
        'bg-muted text-muted-foreground',
        sizeClass,
        className,
      )}
    >
      <User className={iconSizes[size]} />
    </span>
  );
}
