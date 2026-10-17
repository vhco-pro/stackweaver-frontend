// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useMountEffect } from '@/hooks/useMountEffect';
import { Monitor, Trash2, Shield, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Page } from '@/components/layout/Page';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageEmptyState } from '@/components/layout/PageEmptyState';
import { cn } from '@/lib/utils';
import { dangerOutline } from '@/lib/surfaces';
import { settingsApi, type Session } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';

export default function SessionsSettings() {
  useAuth(); // Suppress unused currentSession warning
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  // The session waiting on the confirmation dialog. Nothing is revoked until it is confirmed.
  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success] = useState<string | null>(null);
  void success; // Suppress unused variable warning

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      setSessions(await settingsApi.listSessions());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  useMountEffect(() => {
    void loadSessions();
  });

  const handleRevoke = async (sessionId: string) => {
    try {
      setRevoking(sessionId);
      setError(null);
      await settingsApi.revokeSession(sessionId);
      // Success is handled by reloading sessions
      // Reload sessions to update the list
      await loadSessions();
      // If we revoked the current session, we'll be logged out automatically
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to revoke session';
      setError(errorMessage);
      console.error('Failed to revoke session:', err);
    } finally {
      setRevoking(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const confirmRevoke = async () => {
    const sessionId = pendingRevoke;
    setPendingRevoke(null);
    if (!sessionId) return;
    await handleRevoke(sessionId);
  };

  // Use is_current field from backend instead of client-side detection

  const listState = loading ? 'loading' : error ? 'error' : sessions.length === 0 ? 'empty' : 'ready';

  return (
    <Page ramp="account" className="space-y-8">
      <PageHeader
        icon={Monitor}
        title="Active Sessions"
        subtitle="Manage your active sessions and devices"
        backTo={{ to: '/settings', label: 'Back to Settings' }}
        listState={listState}
      />

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-green-400">
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading sessions...</div>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <PageEmptyState icon={Monitor} title="No active sessions found" />
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  'rounded-2xl',
                  'bg-gradient-to-br from-white/90 via-white/75 to-white/60 dark:from-black/10 dark:via-black/5 dark:to-transparent',
                  'backdrop-blur-md border border-gray-300/80 dark:border-white/10',
                  'p-6 shadow-lg shadow-blue-500/10',
                  session.is_current && 'ring-2 ring-blue-500/50'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                        <Monitor className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">
                            {session.user_agent}
                          </h3>
                          {session.is_current && (
                            <span className="px-2 py-1 text-xs rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
                              Current
                            </span>
                          )}
                        </div>
                        {session.factors && session.factors.length > 0 && (
                          <div className="flex items-center gap-2 mt-1">
                            <Shield className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {session.factors.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-3">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Created: {formatDate(session.creation_date)}</span>
                      </div>
                      {session.expiration_date && (
                        <div>
                          <span>Expires: {formatDate(session.expiration_date)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setPendingRevoke(session.id); }}
                    disabled={revoking === session.id}
                    className={dangerOutline}
                  >
                    {revoking === session.id ? (
                      'Revoking...'
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Revoke
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div className={cn(
        'rounded-2xl',
        'bg-gradient-to-br from-white/90 via-white/75 to-white/60 dark:from-black/10 dark:via-black/5 dark:to-transparent',
        'backdrop-blur-md border border-gray-300/80 dark:border-white/10',
        'p-6 shadow-lg shadow-blue-500/10'
      )}>
        <h3 className="font-semibold mb-2">About Active Sessions</h3>
        <p className="text-sm text-muted-foreground">
          Active sessions are devices and browsers where you're currently logged in. 
          You can revoke any session to log out from that device. If you revoke your current session, 
          you'll be logged out immediately.
        </p>
      </div>

      <ConfirmDialog
        open={pendingRevoke !== null}
        onOpenChange={(open) => { if (!open) setPendingRevoke(null); }}
        title="Revoke session?"
        description="Are you sure you want to revoke this session? You will be logged out from that device."
        confirmLabel="Revoke"
        variant="destructive"
        onConfirm={confirmRevoke}
      />
    </Page>
  );
}

