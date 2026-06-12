// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ansibleWorkflowsApi } from '@/api/ansible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle, ChevronLeft, Clock, Loader2, ThumbsDown, ThumbsUp, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface WorkflowRun {
  id: string;
  name: string;
  status: string;
  started_at?: string;
  finished_at?: string;
}

interface WorkflowNodeRun {
  id: string;
  status: string;
  node_type: string;
  identifier: string;
  job_id?: string;
  denied: boolean;
}

interface WorkflowRunsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
  workflowName: string;
  orgName: string;
  canExecute: boolean;
}

function statusBadge(status: string) {
  switch (status) {
    case 'successful':
      return <Badge variant="secondary" className="gap-1"><CheckCircle className="h-3 w-3" />successful</Badge>;
    case 'failed':
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />failed</Badge>;
    case 'running':
      return <Badge variant="outline" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />running</Badge>;
    case 'skipped':
      return <Badge variant="outline">skipped</Badge>;
    default:
      return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{status}</Badge>;
  }
}

/**
 * Run history for a workflow: list of runs, drill-down into one run's node
 * statuses, and approve/deny actions for approval gates. Polls while open so
 * progression is visible live.
 */
export function WorkflowRunsDialog({ open, onOpenChange, workflowId, workflowName, orgName, canExecute }: WorkflowRunsDialogProps) {
  const queryClient = useQueryClient();
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);

  const runsKey = ['workflowRuns', workflowId];
  const { data: runs = [], isLoading } = useQuery({
    queryKey: runsKey,
    queryFn: async () => {
      const res = await ansibleWorkflowsApi.listJobs(workflowId);
      return (res.data || []).map((r): WorkflowRun => ({
        id: r.id,
        name: (r.attributes?.name as string) || '',
        status: (r.attributes?.status as string) || '',
        started_at: r.attributes?.['started-at'] as string | undefined,
        finished_at: r.attributes?.['finished-at'] as string | undefined,
      }));
    },
    enabled: open && !!workflowId,
    refetchInterval: open ? 5000 : false,
  });

  const nodesKey = ['workflowRunNodes', selectedRun];
  const { data: nodeRuns = [] } = useQuery({
    queryKey: nodesKey,
    queryFn: async () => {
      const res = await ansibleWorkflowsApi.getJob(selectedRun!);
      return (res.included || []).map((n): WorkflowNodeRun => {
        const rel = n.relationships?.job as { data?: { id?: string } } | undefined;
        return {
          id: n.id,
          status: (n.attributes?.status as string) || '',
          node_type: (n.attributes?.['node-type'] as string) || '',
          identifier: (n.attributes?.identifier as string) || '',
          job_id: rel?.data?.id,
          denied: Boolean(n.attributes?.denied),
        };
      });
    },
    enabled: open && !!selectedRun,
    refetchInterval: open && selectedRun ? 5000 : false,
  });

  const decide = async (nodeJobId: string, approve: boolean) => {
    setDeciding(true);
    try {
      if (approve) {
        await ansibleWorkflowsApi.approveNode(nodeJobId);
      } else {
        await ansibleWorkflowsApi.denyNode(nodeJobId);
      }
      toast.success(approve ? 'Node approved' : 'Node denied');
      void queryClient.invalidateQueries({ queryKey: nodesKey });
      void queryClient.invalidateQueries({ queryKey: runsKey });
    } catch (err: unknown) {
      console.error('Approval decision failed:', err);
      toast.error(err instanceof Error ? err.message : 'Decision failed');
    } finally {
      setDeciding(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setSelectedRun(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {selectedRun ? (
              <button type="button" className="flex items-center gap-1 hover:underline" onClick={() => { setSelectedRun(null); }}>
                <ChevronLeft className="h-4 w-4" />
                Runs of {workflowName}
              </button>
            ) : (
              `Runs of ${workflowName}`
            )}
          </DialogTitle>
          <DialogDescription>
            {selectedRun ? 'Node progression for this run.' : 'Recent runs of this workflow.'}
          </DialogDescription>
        </DialogHeader>

        {!selectedRun ? (
          isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading runs...
            </div>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No runs yet.</p>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  className="w-full flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/50 text-left"
                  onClick={() => { setSelectedRun(run.id); }}
                >
                  <span className="truncate font-medium">{run.name}</span>
                  {statusBadge(run.status)}
                </button>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-2">
            {nodeRuns.map((node) => (
              <div key={node.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate font-medium">{node.identifier || node.node_type}</span>
                  <Badge variant="outline">{node.node_type}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {node.job_id && (
                    <Link to={`/app/${orgName}/ansible/jobs/${node.job_id}`} className="text-xs underline text-muted-foreground">
                      job output
                    </Link>
                  )}
                  {statusBadge(node.status)}
                  {canExecute && node.node_type === 'approval' && node.status === 'running' && (
                    <>
                      <Button size="sm" variant="outline" disabled={deciding} onClick={() => { void decide(node.id, true); }}>
                        <ThumbsUp className="h-3 w-3 mr-1" />
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" disabled={deciding} onClick={() => { void decide(node.id, false); }}>
                        <ThumbsDown className="h-3 w-3 mr-1" />
                        Deny
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
