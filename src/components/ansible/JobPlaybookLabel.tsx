// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useNavigate } from 'react-router-dom';
import { FileCode } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { JobPlaybookState } from './jobPlaybook';

interface JobPlaybookLabelProps {
  state: JobPlaybookState;
  orgName: string;
  /** `header` is the compact line under the job title; `detail` is the Playbook row of the details card. */
  variant: 'header' | 'detail';
}

/**
 * The playbook a job ran, as the job page shows it: a link while the playbook exists, and the
 * recorded name marked as deleted once it is gone. It never links to a playbook that does not
 * exist.
 */
export function JobPlaybookLabel({ state, orgName, variant }: JobPlaybookLabelProps) {
  const navigate = useNavigate();
  const header = variant === 'header';
  const icon = header ? <FileCode className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null;
  const nameClass = header ? 'truncate max-w-[150px]' : 'break-all';

  if (state.kind === 'linked') {
    return (
      <button
        type="button"
        onClick={() => { void navigate(`/app/${orgName}/ansible/playbooks/${state.id}`); }}
        className={cn(
          header
            ? 'flex items-center gap-1.5 hover:text-foreground transition-colors'
            : 'text-primary hover:underline',
        )}
      >
        {icon}
        <span className={cn(nameClass, header && 'underline-offset-2 hover:underline')}>{state.name}</span>
      </button>
    );
  }

  if (state.kind === 'deleted') {
    return (
      <span
        className={cn('flex items-center gap-1.5', !header && 'flex-wrap')}
        title="The playbook this job ran has been deleted. The job keeps its history."
      >
        {icon}
        <span className={cn(nameClass, 'text-muted-foreground')}>{state.name || 'Deleted playbook'}</span>
        {state.name && (
          <Badge
            variant="outline"
            className="border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[10px] font-medium text-amber-700 dark:text-amber-400"
          >
            Deleted
          </Badge>
        )}
      </span>
    );
  }

  const text = state.kind === 'adhoc' ? 'Ad hoc command' : state.name || 'Unknown';
  return (
    <span className="flex items-center gap-1.5">
      {icon}
      <span className={nameClass}>{text}</span>
    </span>
  );
}
