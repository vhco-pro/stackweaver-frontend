// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Key, Plus, Copy, Trash2, Calendar, Loader2, CheckCircle2, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GradientButton } from '@/components/ui/gradient-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Page } from '@/components/layout/Page';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageEmptyState } from '@/components/layout/PageEmptyState';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { dangerGhostIcon } from '@/lib/surfaces';
import { tokensApi, type CreateUserTokenResponse } from '@/api/client';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { toast } from 'sonner';

// Personal (user-bound) access tokens. These act as the user across every
// organization they belong to and carry no scopes - they are the
// `terraform login` / CLI path. This is a *user* resource, so it lives under
// the user-scoped settings (/settings/tokens), not under any organization.
export default function PersonalAccessTokens() {
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenExpiry, setNewTokenExpiry] = useState('');
  // Only a platform administrator is offered a `platform:admin` token; the API refuses anyone else.
  const [newTokenPlatformAdmin, setNewTokenPlatformAdmin] = useState(false);
  const { isSiteAdmin } = usePlatformAdmin();
  const [creatingToken, setCreatingToken] = useState(false);
  const [deletingToken, setDeletingToken] = useState<string | null>(null);
  // The token waiting on the revoke confirmation dialog.
  const [pendingRevokeTokenId, setPendingRevokeTokenId] = useState<string | null>(null);
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<CreateUserTokenResponse | null>(null);

  const { data: userTokens = [], isLoading: loading, isError: loadFailed, refetch: refetchUserTokens } = useQuery({
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
      const data: { description: string; expires_at?: string; platform_admin?: boolean } = {
        description: newTokenName.trim(),
      };
      if (isSiteAdmin && newTokenPlatformAdmin) {
        data.platform_admin = true;
      }
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
      setNewTokenPlatformAdmin(false);
      setShowTokenForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create token');
    } finally {
      setCreatingToken(false);
    }
  };

  const handleDeleteToken = async (tokenId: string) => {
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

  // Runs only from the confirmation dialog. The dialog closes first, so the row's own spinner
  // shows the revoke in progress.
  const confirmRevokeToken = async () => {
    const tokenId = pendingRevokeTokenId;
    if (!tokenId) return;
    setPendingRevokeTokenId(null);
    await handleDeleteToken(tokenId);
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

  // Defined once and handed to both the header and the empty-state card: the header does not
  // render it while there is nothing to list, so the action never appears twice.
  const createTokenAction = (
    <GradientButton ramp="app" onClick={() => setShowTokenForm(!showTokenForm)} className="w-auto px-4 py-2">
      <Plus className="h-4 w-4 mr-2" />
      Create Token
    </GradientButton>
  );
  // The empty-state card is hidden while the create form is open, so the header keeps the
  // action then: it is the only control that toggles the form.
  const listState = loading
    ? 'loading'
    : loadFailed
      ? 'error'
      : userTokens.length === 0 && !showTokenForm
        ? 'empty'
        : 'ready';

  return (
    <Page ramp="personalTokens" className="space-y-8">
      {/* Header */}
      <PageHeader
        icon={Key}
        title="API Tokens"
        subtitle={
          <p className="max-w-2xl">
            Personal tokens act as your user across every organization you belong to and carry no
            scopes. Use them for the CLI and <code className="px-1 py-0.5 rounded-sm bg-muted">terraform login</code>.
            For organization-scoped, permission-limited keys, use an organization's API Keys settings.
            A platform admin token, which only platform administrators can create, may also call the
            install-wide admin API.
          </p>
        }
        backTo={{ to: '/settings', label: 'Back to Settings' }}
        action={createTokenAction}
        listState={listState}
      />

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
          'bg-gradient-to-br from-white/90 via-white/75 to-white/60 dark:from-black/10 dark:via-black/5 dark:to-transparent',
          'backdrop-blur-md border border-gray-300/80 dark:border-white/10',
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
            {isSiteAdmin && (
              <div className="flex items-start gap-3">
                <Checkbox
                  id="token-platform-admin"
                  checked={newTokenPlatformAdmin}
                  onCheckedChange={(checked) => { setNewTokenPlatformAdmin(checked === true); }}
                  disabled={creatingToken}
                  className="mt-0.5"
                />
                <Label htmlFor="token-platform-admin" className="font-normal leading-snug">
                  Platform admin: this token may call the install-wide admin API
                </Label>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowTokenForm(false);
                  setNewTokenName('');
                  setNewTokenExpiry('');
                  setNewTokenPlatformAdmin(false);
                }}
                disabled={creatingToken}
              >
                Cancel
              </Button>
              <GradientButton
                ramp="app"
                emphasis="secondary"
                type="submit"
                disabled={creatingToken}
                className="w-auto px-4 py-2"
              >
                {creatingToken ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Token'
                )}
              </GradientButton>
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
                  'bg-gradient-to-br from-white/90 via-white/75 to-white/60 dark:from-black/10 dark:via-black/5 dark:to-transparent',
                  'backdrop-blur-md border border-gray-300/80 dark:border-white/10',
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
                        {token.platform_admin && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-700 dark:text-pink-300 border border-pink-500/30">
                            Platform admin
                          </span>
                        )}
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
                    size="icon"
                    aria-label={`Revoke token ${token.description}`}
                    onClick={() => { setPendingRevokeTokenId(token.id); }}
                    disabled={deletingToken === token.id}
                    className={cn(dangerGhostIcon, 'h-9 w-9')}
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
        !loading && !showTokenForm && (
          <PageEmptyState
            icon={Terminal}
            title="No API Tokens"
            description={
              <>
                Create one for CLI access, or run{' '}
                <code className="px-1 py-0.5 rounded-sm bg-muted">terraform login</code> to generate one.
              </>
            }
            action={loadFailed ? undefined : createTokenAction}
          />
        )
      )}

      <ConfirmDialog
        open={pendingRevokeTokenId !== null}
        onOpenChange={(open) => { if (!open) setPendingRevokeTokenId(null); }}
        title="Revoke token?"
        description="Are you sure you want to revoke this token? This action cannot be undone."
        confirmLabel="Revoke"
        variant="destructive"
        onConfirm={confirmRevokeToken}
      />
    </Page>
  );
}
