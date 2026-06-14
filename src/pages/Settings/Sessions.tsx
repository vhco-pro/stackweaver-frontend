// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useMountEffect } from '@/hooks/useMountEffect';
import { Link } from 'react-router-dom';
import { ArrowLeft, Monitor, Trash2, Shield, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { settingsApi, type Session } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';

export default function SessionsSettings() {
  useAuth(); // Suppress unused currentSession warning
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success] = useState<string | null>(null);
  void success; // Suppress unused variable warning

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await settingsApi.listSessions();
      setSessions(response.sessions || []);
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
    if (!confirm('Are you sure you want to revoke this session? You will be logged out from that device.')) {
      return;
    }

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

  // Use is_current field from backend instead of client-side detection

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
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent mb-2">
            Active Sessions
          </h1>
          <p className="text-muted-foreground">
            Manage your active sessions and devices
          </p>
        </div>
      </div>

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
            <div className={cn(
              'rounded-2xl',
              'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
              'dark:from-black/10 dark:via-black/5',
              'backdrop-blur-md border border-white/20 dark:border-white/10',
              'p-8 shadow-lg shadow-blue-500/10 text-center'
            )}>
              <Monitor className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No active sessions found</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  'rounded-2xl',
                  'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
                  'dark:from-black/10 dark:via-black/5',
                  'backdrop-blur-md border border-white/20 dark:border-white/10',
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
                    onClick={() => { void handleRevoke(session.id); }}
                    disabled={revoking === session.id}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/20"
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
        'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
        'dark:from-black/10 dark:via-black/5',
        'backdrop-blur-md border border-white/20 dark:border-white/10',
        'p-6 shadow-lg shadow-blue-500/10'
      )}>
        <h3 className="font-semibold mb-2">About Active Sessions</h3>
        <p className="text-sm text-muted-foreground">
          Active sessions are devices and browsers where you're currently logged in. 
          You can revoke any session to log out from that device. If you revoke your current session, 
          you'll be logged out immediately.
        </p>
      </div>
    </div>
  );
}

