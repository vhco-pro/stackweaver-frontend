// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Copy, Trash2, Calendar, Loader2, CheckCircle2, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { tokensApi, type CreateUserTokenResponse } from '@/api/client';
import { toast } from 'sonner';

// Personal (user-bound) access tokens. These act as the user across every
// organization they belong to and carry no scopes — they are the
// `terraform login` / CLI path. This is a *user* resource, so it lives under
// the user-scoped settings (/settings/tokens), not under any organization.
export default function PersonalAccessTokens() {
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenExpiry, setNewTokenExpiry] = useState('');
  const [creatingToken, setCreatingToken] = useState(false);
  const [deletingToken, setDeletingToken] = useState<string | null>(null);
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<CreateUserTokenResponse | null>(null);

  const { data: userTokens = [], refetch: refetchUserTokens } = useQuery({
    queryKey: ['userTokens'],
    queryFn: () => tokensApi.list(),
  });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Token copied to clipboard');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTokenName.trim()) {
      toast.error('Token description is required');
      return;
    }

    try {
      setCreatingToken(true);
      const data: { description: string; expires_at?: string } = {
        description: newTokenName.trim(),
      };
      if (newTokenExpiry) {
        const selectedDate = new Date(newTokenExpiry);
        selectedDate.setHours(23, 59, 59, 999);
        data.expires_at = selectedDate.toISOString();
      }

      const response = await tokensApi.create(data);
      setNewlyCreatedToken(response);
      await refetchUserTokens();

      setNewTokenName('');
      setNewTokenExpiry('');
      setShowTokenForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create token');
    } finally {
      setCreatingToken(false);
    }
  };

  const handleDeleteToken = async (tokenId: string) => {
    if (!confirm('Are you sure you want to revoke this token? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingToken(tokenId);
      await tokensApi.delete(tokenId);
      toast.success('Token revoked successfully');
      await refetchUserTokens();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke token');
    } finally {
      setDeletingToken(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return formatDate(dateString);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/settings">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/10 dark:hover:bg-black/10 transition-colors"
            aria-label="Back to Settings"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-400 via-fuchsia-400 to-purple-400 bg-clip-text text-transparent mb-2">
                API Tokens
              </h1>
              <p className="text-muted-foreground max-w-2xl">
                Personal tokens act as your user across every organization you belong to and carry no
                scopes. Use them for the CLI and <code className="px-1 py-0.5 rounded-sm bg-muted">terraform login</code>.
                For organization-scoped, permission-limited keys, use an organization's API Keys settings.
              </p>
            </div>
            <div className="relative inline-flex rounded-xl bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-500 p-[2px]">
              <Button
                variant="ghost"
                onClick={() => setShowTokenForm(!showTokenForm)}
                className="bg-white dark:bg-slate-950/80 dark:backdrop-blur-xs text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-950/90 border-0 whitespace-nowrap rounded-[calc(0.75rem-2px)] px-4 py-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Token
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Newly created personal token (only shown once) */}
      {newlyCreatedToken && (
        <div className={cn(
          'rounded-2xl',
          'bg-gradient-to-br from-green-500/20 via-green-500/10 to-transparent',
          'dark:from-green-500/10 dark:via-green-500/5',
          'backdrop-blur-md border border-green-500/30 dark:border-green-500/20',
          'p-6 shadow-lg shadow-green-500/20'
        )}>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <h3 className="text-lg font-semibold text-green-400">Personal Token Created!</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Copy your token now. You won't be able to see it again after closing this message.
          </p>
          <div className="flex items-center gap-2 mb-4">
            <code className="flex-1 px-3 py-2 rounded-lg bg-white/5 dark:bg-black/10 border border-white/10 dark:border-white/5 text-sm font-mono break-all">
              {newlyCreatedToken.token}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void copyToClipboard(newlyCreatedToken.token);
              }}
              className="gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setNewlyCreatedToken(null);
            }}
            className="w-full"
          >
            I've copied the token
          </Button>
        </div>
      )}

      {/* Create personal token form */}
      {showTokenForm && (
        <div className={cn(
          'rounded-2xl',
          'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
          'dark:from-black/10 dark:via-black/5',
          'backdrop-blur-md border border-white/20 dark:border-white/10',
          'p-6 shadow-lg shadow-purple-500/10'
        )}>
          <h3 className="text-lg font-semibold mb-4">Create Personal Token</h3>
          <form onSubmit={(e) => { void handleCreateToken(e); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token-name">Description</Label>
              <Input
                id="token-name"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                placeholder="e.g., My laptop CLI"
                required
                disabled={creatingToken}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token-expiry">Expiry Date (Optional)</Label>
              <Input
                id="token-expiry"
                type="date"
                value={newTokenExpiry}
                onChange={(e) => setNewTokenExpiry(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                disabled={creatingToken}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowTokenForm(false);
                  setNewTokenName('');
                  setNewTokenExpiry('');
                }}
                disabled={creatingToken}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creatingToken}
                className="bg-gradient-to-r from-purple-500 to-fuchsia-500 hover:from-purple-600 hover:to-fuchsia-600"
              >
                {creatingToken ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Token'
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Personal tokens list */}
      {userTokens.length > 0 ? (
        <div className="space-y-4">
          {userTokens.map((token) => {
            const isExpired = token.expires_at && new Date(token.expires_at) < new Date();
            return (
              <div
                key={token.id}
                className={cn(
                  'rounded-2xl',
                  'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
                  'dark:from-black/10 dark:via-black/5',
                  'backdrop-blur-md border border-white/20 dark:border-white/10',
                  'p-6 shadow-lg shadow-purple-500/10',
                  isExpired && 'opacity-60'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-500">
                      <Terminal className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{token.description}</h3>
                        {isExpired && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                            Expired
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Created {formatDate(token.created_at)}
                        </span>
                        {token.expires_at && (
                          <span className={isExpired ? 'text-red-500' : 'text-orange-500'}>
                            Expires {formatDate(token.expires_at)}
                          </span>
                        )}
                        <span>Last used: {formatTimeAgo(token.last_used_at)}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { void handleDeleteToken(token.id); }}
                    disabled={deletingToken === token.id}
                    className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  >
                    {deletingToken === token.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        !showTokenForm && (
          <div className={cn(
            'rounded-2xl',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
            'dark:from-black/10 dark:via-black/5',
            'backdrop-blur-md border border-white/20 dark:border-white/10',
            'p-12 text-center'
          )}>
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 border border-purple-500/30">
                <Terminal className="h-8 w-8 text-purple-500" />
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-2">No API Tokens</h3>
            <p className="text-muted-foreground mb-4">
              Create one for CLI access, or run{' '}
              <code className="px-1 py-0.5 rounded-sm bg-muted">terraform login</code> to generate one.
            </p>
            <Button
              onClick={() => setShowTokenForm(true)}
              className="bg-gradient-to-r from-purple-500 to-fuchsia-500 hover:from-purple-600 hover:to-fuchsia-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Token
            </Button>
          </div>
        )
      )}
    </div>
  );
}
