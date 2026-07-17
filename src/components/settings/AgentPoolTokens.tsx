import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agentTokensApi, type AgentToken } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { KeyRound, Copy, Trash2, Loader2, CheckCircle2, Plus } from 'lucide-react';
import { toast } from 'sonner';

/**
 * AgentPoolTokens manages a pool's agent tokens (tfe_agent_token): the credentials an agent presents to
 * register into the pool. Unlike the org/team token singletons a pool may have many, each with a
 * description. An org owner can create (revealing the secret once) and revoke them. Data fetching uses
 * React Query. Rendered inside the expanded Agent Pools row.
 */
export function AgentPoolTokens({ poolId }: { poolId: string }) {
  const queryClient = useQueryClient();
  const [revealed, setRevealed] = useState<AgentToken | null>(null);
  const [description, setDescription] = useState('');

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ['agentTokens', poolId],
    queryFn: () => agentTokensApi.list(poolId),
    enabled: !!poolId,
  });

  const createMutation = useMutation({
    mutationFn: (desc: string) => agentTokensApi.create(poolId, desc),
    onSuccess: (created) => {
      setRevealed(created);
      setDescription('');
      void queryClient.invalidateQueries({ queryKey: ['agentTokens', poolId] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create agent token');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (tokenId: string) => agentTokensApi.delete(tokenId),
    onSuccess: () => {
      toast.success('Agent token revoked');
      void queryClient.invalidateQueries({ queryKey: ['agentTokens', poolId] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke agent token');
    },
  });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Token copied to clipboard');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const create = () => {
    const desc = description.trim();
    if (!desc) {
      toast.error('A description is required');
      return;
    }
    createMutation.mutate(desc);
  };

  const revoke = (t: AgentToken) => {
    if (!confirm(`Revoke agent token "${t.description || t.id}"? Agents using it will stop being able to register.`)) return;
    deleteMutation.mutate(t.id);
  };

  const formatDate = (s?: string) => (s ? new Date(s).toLocaleDateString() : 'Never');

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">Agent tokens</h4>
        <span className="text-xs text-muted-foreground">— credentials agents use to register into this pool</span>
      </div>

      {/* Newly created token - shown once */}
      {revealed?.token && (
        <div className={cn(
          'rounded-xl bg-gradient-to-br from-green-500/20 via-green-500/10 to-transparent',
          'dark:from-green-500/10 dark:via-green-500/5',
          'backdrop-blur-md border border-green-500/30 dark:border-green-500/20 p-4'
        )}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-sm font-semibold text-green-400">Agent token created</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Copy it now — you won't be able to see it again after closing this message.
          </p>
          <div className="flex items-center gap-2 mb-3">
            <code className="flex-1 px-3 py-2 rounded-lg bg-white/5 dark:bg-black/10 border border-white/10 text-xs font-mono break-all">
              {revealed.token}
            </code>
            <Button variant="outline" size="sm" onClick={() => { void copyToClipboard(revealed.token ?? ''); }} className="gap-2">
              <Copy className="h-4 w-4" /> Copy
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setRevealed(null); }} className="w-full">
            I've copied the token
          </Button>
        </div>
      )}

      {/* Create form */}
      <div className="flex items-center gap-2">
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }}
          placeholder="Token description (e.g. production agents)"
          className="h-9 text-sm"
          aria-label="Agent token description"
        />
        <Button size="sm" onClick={create} disabled={createMutation.isPending}
          className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 gap-2 whitespace-nowrap">
          {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New token
        </Button>
      </div>

      {/* Token list */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">No agent tokens yet.</p>
      ) : (
        <ul className="space-y-2">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-4 rounded-lg border border-white/10 dark:border-white/5 bg-white/5 dark:bg-black/10 px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{t.description || '(no description)'}</div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>Created {formatDate(t.created_at)}</span>
                  <span>Last used: {t.last_used_at ? formatDate(t.last_used_at) : 'Never'}</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { revoke(t); }} disabled={deleteMutation.isPending}
                className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-500/10 shrink-0">
                <Trash2 className="h-4 w-4" /> Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
