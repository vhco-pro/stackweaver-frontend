// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { PublicSessionContext } from './PublicSessionContext';
import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchSession,
  onAuthenticationRequired,
  signOut,
  sweepTokenEraStorage,
  touchSession,
  type SessionProfile,
} from '@/lib/zitadel';
import { useMountEffect } from '@/hooks/useMountEffect';
import { RETURN_URL_KEY, SESSION_QUERY_KEY, TOUCH_INTERVAL_MS, startSignIn } from './authSession';

// The signed-in person. The browser holds no token: its credential is the httpOnly session cookie
// the API set at sign-in, which page script cannot read.
type Session = {
  id: string;
  user: {
    id: string;
    email: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
  };
} | null;

interface AuthContextType {
  session: Session | null;
  loading: boolean;
  logout: () => void;
  refresh: () => Promise<void>;
  login: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** How often the session is read again, so a session ended elsewhere shows here. */
const SESSION_RECHECK_MS = 5 * 60 * 1000;

/** The input that counts as the person using the page. Polling and timers do not. */
const ACTIVITY_EVENTS = ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart'] as const;

function toSession(profile: SessionProfile | null): Session {
  if (!profile) return null;
  return {
    id: profile.id,
    user: {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      given_name: profile.givenName,
      family_name: profile.familyName,
      picture: profile.picture,
    },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // A browser coming from a token-in-browser release still holds its tokens. They are deleted
  // before any query runs, and when the browser was signed in, sign-in starts on its own and
  // returns to this page. Render-time initializer: it runs once, before the first request.
  const [upgradedFromTokens] = useState(() => {
    const signedIn = sweepTokenEraStorage();
    if (signedIn && !window.location.pathname.startsWith('/auth/') && !window.location.pathname.startsWith('/login/')) {
      try {
        sessionStorage.setItem(RETURN_URL_KEY, `${window.location.pathname}${window.location.search}${window.location.hash}`);
      } catch {
        // Without storage the person lands on the dashboard instead; nothing else changes.
      }
    }
    return signedIn;
  });

  // The upgrade's automatic sign-in runs once, when the first session read says there is none.
  const upgradeSignInPending = useRef(upgradedFromTokens);
  const query = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async () => {
      const profile = await fetchSession();
      if (!profile && upgradeSignInPending.current) {
        upgradeSignInPending.current = false;
        void startSignIn();
      }
      return profile;
    },
    refetchInterval: SESSION_RECHECK_MS,
    // A failed read (not a 401, which is an answer) is retried; the person stays signed in meanwhile.
    retry: 3,
    staleTime: 60 * 1000,
  });
  const session = toSession(query.data ?? null);
  const loading = query.isPending;

  const lastTouch = useRef(0);

  useMountEffect(() => {
    // Any request that finds the session gone signs this browser out; ProtectedRoute then sends
    // the person to sign-in and remembers where they were.
    const stopListening = onAuthenticationRequired(() => {
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
    });

    // The activity touch: input on the page extends the session's idle limit, at most once a
    // minute. Background polling never does, so a forgotten tab is signed out on time.
    const onActivity = (): void => {
      if (!queryClient.getQueryData(SESSION_QUERY_KEY)) return;
      const now = Date.now();
      if (now - lastTouch.current < TOUCH_INTERVAL_MS) return;
      lastTouch.current = now;
      void touchSession().catch(() => { /* a failed touch is retried by the next input */ });
    };
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, onActivity, { passive: true });

    return () => {
      stopListening();
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, onActivity);
    };
  });

  const login = useCallback(async (): Promise<void> => {
    await startSignIn();
  }, []);

  const logout = useCallback((): void => {
    queryClient.setQueryData(SESSION_QUERY_KEY, null);
    // A form POST, not a fetch: the API ends the session and its Zitadel session, clears the
    // cookie, and sends the browser through Zitadel's end_session.
    signOut();
  }, [queryClient]);

  const refresh = useCallback(async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ session, loading, logout, refresh, login }}>
      <PublicSessionContext.Provider value={!!session}>{children}</PublicSessionContext.Provider>
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    // During Vite HMR the tree can re-mount before the provider is back; report "loading" until
    // it is, rather than throwing. The session itself is the cookie, so nothing is lost.
    if (import.meta.hot) {
      return { session: null, loading: true, logout: () => {}, refresh: async () => {}, login: async () => {} };
    }
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
