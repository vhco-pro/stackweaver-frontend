import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agentTokensApi, type AgentToken } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { KeyRound, Copy, Trash2, Loader2, CheckCircle2, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_GRACE_HOURS, GRACE_OPTIONS, expiryStatus } from './agentTokenRotation';

// A secret shown once: a freshly created token, or the replacement minted by a rotation (which also
// says when the token it replaced stops working).
interface RevealedToken {
  token: AgentToken;
  rotated: boolean;
  previousExpiresAt?: string;
}

/**
 * AgentPoolTokens manages a pool's agent tokens (tfe_agent_token): the credentials an agent presents to
 * register into the pool. Unlike the org/team token singletons a pool may have many, each with a
 * description. An org owner can create (revealing the secret once), rotate (a replacement is revealed
 * once and the old token keeps working for a grace window) and revoke them. Data fetching uses React
 * Query. Rendered inside the expanded Agent Pools row.
 */
export function AgentPoolTokens({ poolId }: { poolId: string }) {
  const queryClient = useQueryClient();
  const [revealed, setRevealed] = useState<RevealedToken | null>(null);
  const [description, setDescription] = useState('');
  const [rotating, setRotating] = useState<AgentToken | null>(null);
  const [graceHours, setGraceHours] = useState(DEFAULT_GRACE_HOURS);

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ['agentTokens', poolId],
    queryFn: () => agentTokensApi.list(poolId),
    enabled: !!poolId,
  });

  const createMutation = useMutation({
    mutationFn: (desc: string) => agentTokensApi.create(poolId, desc),
    onSuccess: (created) => {
      setRevealed({ token: created, rotated: false });
      setDescription('');
      void queryClient.invalidateQueries({ queryKey: ['agentTokens', poolId] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create agent token');
    },
  });

  const rotateMutation = useMutation({
    mutationFn: ({ tokenId, hours }: { tokenId: string; hours: number }) => agentTokensApi.rotate(tokenId, hours),
    onSuccess: (result) => {
      setRevealed({ token: result.token, rotated: true, previousExpiresAt: result.previousExpiresAt });
      setRotating(null);
      void queryClient.invalidateQueries({ queryKey: ['agentTokens', poolId] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to rotate agent token');
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

  const openRotate = (t: AgentToken) => {
    setGraceHours(DEFAULT_GRACE_HOURS);
    setRotating(t);
  };

  const formatDate = (s?: string) => (s ? new Date(s).toLocaleDateString() : 'Never');
  const formatDateTime = (s?: string) => (s ? new Date(s).toLocaleString() : '');

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">Agent tokens</h4>
        <span className="text-xs text-muted-foreground">- credentials agents use to register into this pool</span>
      </div>

      {/* Newly created or rotated token - shown once */}
      {revealed?.token.token && (
        <div className={cn(
          'rounded-xl bg-gradient-to-br from-green-500/20 via-green-500/10 to-transparent',
          'dark:from-green-500/10 dark:via-green-500/5',
          'backdrop-blur-md border border-green-500/30 dark:border-green-500/20 p-4'
        )}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-sm font-semibold text-green-600 dark:text-green-400">
              {revealed.rotated ? 'Agent token rotated' : 'Agent token created'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Copy it now - you won't be able to see it again after closing this message.
            {revealed.rotated && (
              revealed.previousExpiresAt
                ? ` The previous token keeps working until ${formatDateTime(revealed.previousExpiresAt)}; update your agents before then.`
                : ' The previous token has been retired.'
            )}
          </p>
          <div className="flex items-center gap-2 mb-3">
            <code className="flex-1 px-3 py-2 rounded-lg bg-slate-900/5 dark:bg-black/10 border border-slate-900/10 dark:border-white/10 text-xs font-mono break-all">
              {revealed.token.token}
            </code>
            <Button variant="outline" size="sm" onClick={() => { void copyToClipboard(revealed.token.token ?? ''); }} className="gap-2">
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
          {tokens.map((t) => {
            const expiry = expiryStatus(t.expired_at);
            return (
              <li key={t.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-900/10 dark:border-white/5 bg-slate-900/[0.03] dark:bg-black/10 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{t.description || '(no description)'}</div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>Created {formatDate(t.created_at)}</span>
                    <span>Last used: {t.last_used_at ? formatDate(t.last_used_at) : 'Never'}</span>
                    {expiry && (
                      <span className={expiry.expired ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}>
                        {expiry.expired ? 'Expired' : 'Rotated, expires'} {expiry.at.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => { openRotate(t); }} disabled={rotateMutation.isPending}
                    className="gap-1.5" aria-label={`Rotate agent token ${t.description || t.id}`}>
                    <RefreshCw className="h-4 w-4" /> Rotate
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { revoke(t); }} disabled={deleteMutation.isPending}
                    className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" /> Revoke
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Rotate confirmation */}
      <Dialog open={!!rotating} onOpenChange={(open) => { if (!open) setRotating(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate agent token</DialogTitle>
            <DialogDescription>
              A new token for &quot;{rotating?.description || rotating?.id}&quot; is created and shown once. The current
              token keeps working for the grace period so running agents can be switched over, then stops working.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="agent-token-grace">Grace period for the current token</Label>
            <Select value={String(graceHours)} onValueChange={(v) => { setGraceHours(Number(v)); }}>
              <SelectTrigger id="agent-token-grace">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRACE_OPTIONS.map((o) => (
                  <SelectItem key={o.hours} value={String(o.hours)}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRotating(null); }}>Cancel</Button>
            <Button
              onClick={() => { if (rotating) rotateMutation.mutate({ tokenId: rotating.id, hours: graceHours }); }}
              disabled={rotateMutation.isPending}
            >
              {rotateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Rotate token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
