// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, User } from 'lucide-react';
import { searchSessions, createSession, finalizeAuthRequest } from '@/api/auth-client';
import { useMountEffect } from '@/hooks/useMountEffect';
import LoginLayout from './LoginLayout';
import { toFriendlyError } from '@/lib/auth-errors';

interface SessionInfo {
  id: string;
  loginName: string;
  displayName: string;
}

/**
 * Account picker for multiple sessions.
 * Searches for active sessions via the proxy and displays them for selection.
 */
export default function Accounts() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authRequestId = searchParams.get('authRequest') ?? '';

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState('');
  const [error, setError] = useState('');

  useMountEffect(() => {
    let cancelled = false;
    const fetchSessions = async () => {
      try {
        // Search for all active sessions (the proxy scopes this via the session cookie)
        // Backend scopes this to the caller's cookie sessions — client-supplied
        // filters are ignored, so we just pass an empty body.
        const result = await searchSessions({}) as { sessions?: Array<{ id: string; factors?: { user?: { loginName?: string; displayName?: string } } }> };

        if (cancelled) return;

        const parsed: SessionInfo[] = (result.sessions ?? []).map(s => ({
          id: s.id,
          loginName: s.factors?.user?.loginName ?? '',
          displayName: s.factors?.user?.displayName ?? '',
        }));
        setSessions(parsed);
      } catch {
        // Session search failed — show empty list with option to sign in
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchSessions();
    return () => { cancelled = true; };
  });

  const handleSelectSession = async (session: SessionInfo) => {
    setSelecting(session.id);
    setError('');
    try {
      // Create a new session for this user and finalize
      const sessionResp = await createSession({
        checks: { user: { loginName: session.loginName } },
      });

      if (authRequestId) {
        const finalizeResp = await finalizeAuthRequest({
          authRequestId,
          sessionId: sessionResp.sessionId,
          sessionToken: sessionResp.sessionToken,
        });
        window.location.href = finalizeResp.callbackUrl;
      } else {
        void navigate('/dashboard');
      }
    } catch (err: unknown) {
      setError(toFriendlyError(err, 'Failed to select account'));
      // Fall back to password page for this user
      void navigate(`/login/password?authRequest=${authRequestId}&loginName=${session.loginName}`);
    } finally {
      setSelecting('');
    }
  };

  return (
    <LoginLayout title="Choose an account" subtitle="Select an account to continue">
      <div className="space-y-2">
        {loading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && <p className="text-sm text-destructive text-center">{error}</p>}

        {sessions.map((session) => (
          <Button
            key={session.id}
            variant="outline"
            className="w-full justify-start gap-3"
            disabled={!!selecting}
            onClick={() => { void handleSelectSession(session); }}
          >
            {selecting === session.id ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <User className="h-5 w-5 text-muted-foreground" />
            )}
            <div className="text-left">
              <div className="text-sm font-medium">{session.displayName || session.loginName}</div>
              {session.displayName && <div className="text-xs text-muted-foreground">{session.loginName}</div>}
            </div>
          </Button>
        ))}

        {!loading && sessions.length === 0 && (
          <p className="text-xs text-center text-muted-foreground py-2">No active sessions found</p>
        )}

        <Button
          variant="outline"
          className="w-full justify-start gap-3"
          onClick={() => { void navigate(`/login/loginname?authRequest=${authRequestId}`); }}
        >
          <Plus className="h-5 w-5 text-muted-foreground" />
          Use a different account
        </Button>
      </div>
    </LoginLayout>
  );
}
