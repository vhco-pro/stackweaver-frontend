// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, User } from 'lucide-react';
import { searchSessions } from '@/api/auth-client';
import { useMountEffect } from '@/hooks/useMountEffect';
import LoginLayout from './LoginLayout';

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

  useMountEffect(() => {
    let cancelled = false;
    const fetchSessions = async () => {
      try {
        // Search for all active sessions (the proxy scopes this via the session cookie)
        // Backend scopes this to the caller's cookie sessions - client-supplied
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
        // Session search failed - show empty list with option to sign in
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchSessions();
    return () => { cancelled = true; };
  });

  const handleSelectSession = (session: SessionInfo) => {
    // Picking an account re-authenticates it on the password page: the sign-in is finished only
    // on a session that verifies a credential, never on the listed session's prior state. The
    // password page carries the login name so the user does not retype it.
    const params = new URLSearchParams({ authRequest: authRequestId, loginName: session.loginName });
    void navigate(`/login/password?${params.toString()}`);
  };

  return (
    <LoginLayout title="Choose an account" subtitle="Select an account to continue">
      <div className="space-y-2">
        {loading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {sessions.map((session) => (
          <Button
            key={session.id}
            variant="outline"
            className="w-full justify-start gap-3"
            onClick={() => { handleSelectSession(session); }}
          >
            <User className="h-5 w-5 text-muted-foreground" />
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
