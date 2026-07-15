import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { changeRequestsApi, type ChangeRequest } from '@/api/client';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { ClipboardList, Check, Loader2, Archive, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

/** Formats an ISO timestamp as a short absolute date; falls back to the raw value if unparseable. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function ChangeRequestCard({
  cr,
  onArchive,
  archiving,
}: {
  cr: ChangeRequest;
  onArchive?: (id: string) => void;
  archiving: boolean;
}) {
  const archived = cr.archived_at !== null;
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 dark:bg-black/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-medium truncate ${archived ? 'text-muted-foreground line-through' : ''}`}>
              {cr.subject}
            </span>
            {archived && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground shrink-0">
                archived
              </span>
            )}
          </div>
          {cr.message && (
            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words">{cr.message}</p>
          )}
          <div className="text-xs text-muted-foreground mt-2">
            Filed {formatDate(cr.created_at)}
            {archived && cr.archived_at ? ` · archived ${formatDate(cr.archived_at)}` : ''}
          </div>
        </div>
        {!archived && onArchive && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 shrink-0"
            disabled={archiving}
            onClick={() => { onArchive(cr.id); }}
            aria-label={`Archive change request: ${cr.subject}`}
          >
            {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Archive
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * WorkspaceChangeRequests lists a workspace's change requests: action items an admin filed against it.
 * A team member archives one once the work is done, which is the whole lifecycle (TFE has no other
 * states). Archived requests are collapsed into their own section, matching TFE's separate sorting.
 *
 * Filing happens from the workspace's row menu on the Workspaces list, alongside Edit and Delete,
 * rather than here: this tab is where the owning team reads and closes out requests, not where an
 * admin creates them.
 */
export function WorkspaceChangeRequests({ workspaceId, orgName }: { workspaceId: string; orgName: string }) {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const { canManageWorkspaces } = usePermissions(orgName);

  // One query for everything (the API returns archived only when asked), split client-side. Keeps the
  // archived toggle instant instead of round-tripping.
  const { data: all = [], isLoading } = useQuery({
    queryKey: ['changeRequests', workspaceId],
    queryFn: () => changeRequestsApi.list(workspaceId, true),
    enabled: !!workspaceId,
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => changeRequestsApi.archive(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['changeRequests', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['changeRequests', 'org', orgName] });
      toast.success('Change request archived');
    },
    onError: (e: unknown) => { toast.error(e instanceof Error ? e.message : 'Failed to archive change request'); },
  });

  const open = all.filter(cr => cr.archived_at === null);
  const archived = all.filter(cr => cr.archived_at !== null);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 dark:bg-black/10 backdrop-blur-sm p-6 space-y-6">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-rose-500" />
        <div>
          <h3 className="text-lg font-semibold">Change requests</h3>
          <p className="text-sm text-muted-foreground">
            Action items filed against this workspace. Archive one once the work is done.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No open change requests.
              {canManageWorkspaces && ' File one from this workspace\'s actions menu on the Workspaces list.'}
            </p>
          ) : (
            <div className="space-y-3">
              {open.map(cr => (
                <ChangeRequestCard
                  key={cr.id}
                  cr={cr}
                  onArchive={id => { archiveMutation.mutate(id); }}
                  archiving={archiveMutation.isPending && archiveMutation.variables === cr.id}
                />
              ))}
            </div>
          )}

          {archived.length > 0 && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => { setShowArchived(v => !v); }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                aria-expanded={showArchived}
              >
                {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Archive className="h-4 w-4" />
                Archived ({archived.length})
              </button>
              {showArchived && (
                <div className="space-y-3">
                  {archived.map(cr => (
                    <ChangeRequestCard key={cr.id} cr={cr} archiving={false} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
