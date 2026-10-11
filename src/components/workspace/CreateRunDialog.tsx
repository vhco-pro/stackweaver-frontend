// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { FileText, Loader2, PlayCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Workspace } from '@/api/client';

export type RunOperation = 'plan-only' | 'plan-and-apply' | 'destroy';

/** The three workspace fields the dialog reads. */
export type CreateRunDialogWorkspace = Pick<Workspace, 'name' | 'auto_apply' | 'allow_destroy_plan'>;

interface CreateRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: CreateRunDialogWorkspace;
  /** True while the page is creating the run; every way forward is disabled meanwhile. */
  isCreatingRun: boolean;
  onCreateRun: (operation: RunOperation) => void;
}

/**
 * "Start a new run": Plan & Apply, Plan Only, or Destroy.
 *
 * Plan & Apply and Plan Only start from their choice. Destroy never does. It removes every
 * resource the workspace manages, and on a workspace that applies runs automatically nothing
 * else stands between the click and the removal, so the choice opens a confirmation that asks
 * for the workspace's name and says which of the two will happen. The confirmation is the same
 * typed-name step the delete-workspace, delete-organization and delete-inventory dialogs use.
 *
 * When the workspace does not allow destroy plans the choice is disabled with the reason, so the
 * API's refusal of such a run is never reached from here.
 */
export function CreateRunDialog({ open, onOpenChange, workspace, isCreatingRun, onCreateRun }: CreateRunDialogProps) {
  const [confirmingDestroy, setConfirmingDestroy] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  // Reset whenever the dialog closes, by whatever route: Escape, the overlay, the close button,
  // or the page closing it after the run was created (which sends no event through here). This
  // is React's adjust-state-while-rendering pattern, so a reopened dialog always starts on the
  // three choices with nothing typed, and no effect is needed.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setConfirmingDestroy(false);
      setConfirmName('');
    }
  }

  // The setting is on unless it was turned off; only an explicit false disables the choice.
  const destroyAllowed = workspace.allow_destroy_plan !== false;
  const nameMatches = confirmName === workspace.name;

  const backToChoices = () => {
    setConfirmingDestroy(false);
    setConfirmName('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {confirmingDestroy ? (
          <>
            <DialogHeader>
              <DialogTitle>Start a new run</DialogTitle>
              <DialogDescription>
                Type <strong>{workspace.name}</strong> to confirm.
                <br /><br />
                <span>
                  {workspace.auto_apply
                    ? 'This workspace applies runs automatically, so the destroy will remove all managed resources as soon as its plan finishes.'
                    : 'The destroy will plan first and wait for your confirmation before it removes anything.'}
                </span>
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <Input
                aria-label="Workspace name"
                placeholder={workspace.name}
                value={confirmName}
                onChange={(e) => { setConfirmName(e.target.value); }}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={backToChoices} disabled={isCreatingRun}>
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={() => { onCreateRun('destroy'); }}
                disabled={isCreatingRun || !nameMatches}
              >
                {isCreatingRun && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Queue destroy run
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Start a new run</DialogTitle>
              <DialogDescription>
                Select the run type for this workspace.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <Button
                className="w-full h-auto py-3 px-4 justify-start text-left"
                variant="default"
                onClick={() => { onCreateRun('plan-and-apply'); }}
                disabled={isCreatingRun}
              >
                <PlayCircle className="mr-3 h-5 w-5 shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">Plan & Apply</span>
                  <span className="text-xs opacity-80 font-normal">Plan changes, then confirm to apply</span>
                </div>
              </Button>
              <Button
                className="w-full h-auto py-3 px-4 justify-start text-left"
                variant="outline"
                onClick={() => { onCreateRun('plan-only'); }}
                disabled={isCreatingRun}
              >
                <FileText className="mr-3 h-5 w-5 shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">Plan Only</span>
                  <span className="text-xs text-muted-foreground font-normal">Preview changes without applying</span>
                </div>
              </Button>
              {/* Not allowed is a standing state with a reason to read, not a moment of being busy:
                  it is shown as a muted outline at full opacity, because the default disabled
                  dimming would halve the contrast of the one sentence that explains it. */}
              <Button
                className={cn(
                  'w-full h-auto py-3 px-4 justify-start text-left whitespace-normal',
                  !destroyAllowed && 'text-muted-foreground disabled:opacity-100',
                )}
                variant={destroyAllowed ? 'destructive' : 'outline'}
                onClick={() => { setConfirmingDestroy(true); }}
                disabled={isCreatingRun || !destroyAllowed}
              >
                <Trash2 className="mr-3 h-5 w-5 shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">Destroy</span>
                  <span className={cn('text-xs font-normal', destroyAllowed && 'opacity-80')}>
                    {destroyAllowed
                      ? 'Remove all managed resources'
                      : 'Destroy plans are not allowed on this workspace. Turn on allow-destroy-plan in the workspace settings to queue one.'}
                  </span>
                </div>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
