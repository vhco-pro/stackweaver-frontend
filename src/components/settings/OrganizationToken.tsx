import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationsApi, type OrgToken } from '@/api/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { KeyRound, Copy, Trash2, Calendar, Loader2, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * OrganizationToken manages an organization's single API token (tfe_organization_token): a powerful,
 * org-admin automation credential. It shows the token metadata (created / last used / expiry), lets an
 * org owner generate or regenerate it, and reveals the secret value exactly once. Data fetching uses
 * React Query. Mirrors the show-once pattern of the API Keys page.
 */
export function OrganizationToken({ orgName }: { orgName: string }) {
  const queryClient = useQueryClient();
  const [revealed, setRevealed] = useState<OrgToken | null>(null);

  const { data: token, isLoading } = useQuery({
    queryKey: ['orgToken', orgName],
    queryFn: () => organizationsApi.getToken(orgName),
    enabled: !!orgName,
  });

  const createMutation = useMutation({
    mutationFn: () => organizationsApi.createToken(orgName),
    onSuccess: (created) => {
      setRevealed(created);
      void queryClient.invalidateQueries({ queryKey: ['orgToken', orgName] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to generate organization token');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => organizationsApi.deleteToken(orgName),
    onSuccess: () => {
      setRevealed(null);
      toast.success('Organization token revoked');
      void queryClient.invalidateQueries({ queryKey: ['orgToken', orgName] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke organization token');
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

  const regenerate = () => {
    if (token && !confirm('Regenerate the organization token? The current token will stop working immediately.')) return;
    createMutation.mutate();
  };

  const revoke = () => {
    if (!confirm('Revoke the organization token? Any automation using it will stop working immediately.')) return;
    deleteMutation.mutate();
  };

  const formatDate = (s?: string) => (s ? new Date(s).toLocaleDateString() : 'Never');

  return (
    <div className="space-y-4">
      {/* Newly generated token - shown once */}
      {revealed?.token && (
        <div className={cn(
          'rounded-2xl bg-gradient-to-br from-green-500/20 via-green-500/10 to-transparent',
          'dark:from-green-500/10 dark:via-green-500/5',
          'backdrop-blur-md border border-green-500/30 dark:border-green-500/20 p-6 shadow-lg shadow-green-500/20'
        )}>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <h3 className="text-lg font-semibold text-green-400">Organization token generated</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Copy it now - you won't be able to see it again after closing this message.
          </p>
          <div className="flex items-center gap-2 mb-4">
            <code className="flex-1 px-3 py-2 rounded-lg bg-white/5 dark:bg-black/10 border border-white/10 text-sm font-mono break-all">
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

      {/* Current token state */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : token ? (
        <div className={cn(
          'rounded-2xl bg-gradient-to-br from-white/10 via-white/5 to-transparent',
          'dark:from-black/10 dark:via-black/5',
          'backdrop-blur-md border border-white/20 dark:border-white/10 p-6 shadow-lg shadow-purple-500/10'
        )}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500">
                <KeyRound className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="font-semibold">Active</div>
                <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Created {formatDate(token.created_at)}</span>
                  <span>Last used: {token.last_used_at ? formatDate(token.last_used_at) : 'Never'}</span>
                  {token.expired_at && <span className="text-orange-500">Expires {formatDate(token.expired_at)}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={regenerate} disabled={createMutation.isPending} className="gap-2">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Regenerate
              </Button>
              <Button variant="ghost" size="sm" onClick={revoke} disabled={deleteMutation.isPending} className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-500/10">
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Revoke
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className={cn(
          'rounded-2xl bg-gradient-to-br from-white/10 via-white/5 to-transparent',
          'dark:from-black/10 dark:via-black/5',
          'backdrop-blur-md border border-white/20 dark:border-white/10 p-6 flex items-center justify-between gap-4'
        )}>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            No organization token yet.
          </div>
          <Button onClick={() => { createMutation.mutate(); }} disabled={createMutation.isPending}
            className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 gap-2">
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Generate token
          </Button>
        </div>
      )}
    </div>
  );
}
