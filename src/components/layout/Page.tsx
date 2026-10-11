// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { DialogContent } from '@/components/ui/dialog';
import { RampContext, rampVars, useRamp, type RampName } from '@/lib/ramps';
import { cn } from '@/lib/utils';

interface PageProps {
  /**
   * The page's colour ramp. Pages outside Settings leave it at `app`; a Settings page passes
   * its topic. See `lib/ramps.ts`.
   */
  ramp?: RampName;
  /** Extra classes for the root element, which already carries the standard vertical rhythm. */
  className?: string;
  children: ReactNode;
}

/**
 * The root element of a page, and the owner of its colour.
 *
 * It sets the three ring properties `.gradient-ring-btn` reads, so every `GradientButton`
 * inside it (passing `ramp="app"`, which leaves those properties unset on the button) takes
 * the page's colour by inheritance. It also provides the ramp through context, which is how
 * `PageHeader` picks its title gradient and how a dialog, rendered through a portal outside
 * this element, gets the same colour - see {@link PageDialogContent}.
 *
 * A header cannot do this job: a component can only style its own subtree, and the
 * empty-state card is the header's sibling.
 */
export function Page({ ramp = 'app', className, children }: PageProps) {
  return (
    <RampContext.Provider value={ramp}>
      <div className={cn('space-y-6', className)} style={rampVars(ramp)} data-ramp={ramp}>
        {children}
      </div>
    </RampContext.Provider>
  );
}

/**
 * `DialogContent` that carries the opening page's ramp. Custom properties do not cross a
 * portal, so a dialog opened from a Settings page would otherwise fall back to the app colours.
 */
export function PageDialogContent({ style, ...props }: ComponentPropsWithoutRef<typeof DialogContent>) {
  const ramp = useRamp();
  return <DialogContent style={{ ...rampVars(ramp), ...style }} {...props} />;
}
