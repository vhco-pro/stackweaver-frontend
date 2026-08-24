// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { Layers, LayoutDashboard, GitPullRequest, Play, Server, type LucideIcon } from 'lucide-react';
import { useInterval } from '@/hooks/useInterval';

// Tour definition + state for the landing hero. Kept apart from HeroTour.tsx so that file only
// exports components (react-refresh rule).

export type TourPaneId = 'overview' | 'resources' | 'gitops' | 'ansible' | 'fleet';

export interface TourPane {
  id: TourPaneId;
  label: string;
  icon: LucideIcon;
}

export const TOUR_PANES: TourPane[] = [
  { id: 'overview', label: 'Single pane of glass', icon: LayoutDashboard },
  { id: 'resources', label: 'Visualize resources', icon: Layers },
  { id: 'gitops', label: 'GitOps workflows', icon: GitPullRequest },
  { id: 'ansible', label: 'Ansible at scale', icon: Play },
  { id: 'fleet', label: 'Runners & fleet', icon: Server },
];

export const TOUR_INTERVAL_MS = 7000;

// ---- state hook: auto-advance until the visitor interacts --------------------------------------

export function useHeroTour() {
  const [pane, setPane] = useState<TourPaneId>('overview');
  const [pinned, setPinned] = useState(false); // a deliberate click stops the carousel for good
  const [hovering, setHovering] = useState(false);

  useInterval(
    () => {
      setPane((current) => {
        const idx = TOUR_PANES.findIndex((p) => p.id === current);
        return TOUR_PANES[(idx + 1) % TOUR_PANES.length].id;
      });
    },
    pinned || hovering ? null : TOUR_INTERVAL_MS
  );

  const select = (id: TourPaneId) => {
    setPane(id);
    setPinned(true);
  };

  return { pane, select, setHovering };
}
