// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GradientButton } from "@/components/ui/gradient-button";
import { Loader2 } from "lucide-react";
import { rampVars, useRamp } from "@/lib/ramps";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  /** Optional extra class for DialogContent (e.g. max-w). Layout/styling stays global. */
  className?: string;
}

/**
 * Shared confirmation dialog. Uses the same Dialog primitives as other modals
 * so confirmations match app popup styling. Buttons/labels vary per use;
 * layout and styling are consistent.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  loading = false,
  className,
}: ConfirmDialogProps) {
  // A dialog renders through a portal, outside the page element that owns the colour, so the
  // ring reads the opening page's ramp from context.
  const ramp = useRamp();
  const handleConfirm = () => {
    void (async () => {
      await onConfirm();
    })();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-lg", className)} style={rampVars(ramp)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          {variant === "destructive" ? (
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirm}
              disabled={loading}
              className={cn(loading && "gap-2")}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmLabel}
            </Button>
          ) : (
            <GradientButton
              type="button"
              ramp="app"
              onClick={handleConfirm}
              disabled={loading}
              className={cn("w-auto px-4 py-2", loading && "gap-2")}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmLabel}
            </GradientButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
