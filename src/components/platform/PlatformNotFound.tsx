// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { SearchX } from 'lucide-react';
import { PageEmptyState } from '@/components/layout/PageEmptyState';

/**
 * What a platform page shows when its admin route answered 404: the person is not a platform
 * administrator. It says no more than a missing page would, and the page shows no data.
 */
export function PlatformNotFound() {
  return (
    <PageEmptyState
      icon={SearchX}
      title="Page not found"
      description="This page does not exist, or it is only available to the platform administrators of this installation."
    />
  );
}
