// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { getAccessToken, getUserInfo, getLogoutUrl, clearTokens, clearTokensIfClientChanged, isTokenExpired, refreshAccessToken } from '@/lib/zitadel';
import { useMountEffect } from '@/hooks/useMountEffect';

// Zitadel user session type
export type Session = {
  id: string;
  user: {
    id: string;
    email: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
  };
  access_token?: string;
} | null;

interface AuthContextType {
  session: Session | null;
  loading: boolean;
  logout: () => void;
  refresh: () => Promise<void>;
  login: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * safeErrorSummary returns an opaque, telemetry-safe string for an
 * unknown error value. Round 25 Wave 7 (item 7 / R24-5): the previous
 * implementation passed the full `Error` to console.* - if a fetch
 * `Response` rejection ever included a JSON body containing the
 * invalid token (or if a future Sentry/Datadog browser SDK got
 * wired in), tokens would land in telemetry. Browser extensions
 * reading console output capture them too.
 *
 * The helper extracts only the type tag + HTTP status (when
 * present) so the line is still useful for diagnosing flow-level
 * failures without leaking the underlying request/response detail.
 */
function safeErrorSummary(err: unknown): string {
  if (err instanceof Error) {
    const status = (err as { status?: number }).status;
    if (typeof status === 'number') {
      return `${err.name}(status=${status})`;
    }
    return err.name;
  }
  return typeof err;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSession = async (): Promise<void> => {
    try {
      // If the OIDC clientId changed (e.g. cluster wipe + reinstall), tokens
      // from the old install are invalid. Clear them before doing anything else.
      clearTokensIfClientChanged();

      let accessToken = getAccessToken();
      
      // Check if token is expired and try to refresh
      if (accessToken && isTokenExpired()) {
        console.log('Token expired, attempting refresh...');
        const newTokens = await refreshAccessToken();
        if (newTokens) {
          accessToken = newTokens.access_token;
          console.log('Token refreshed successfully');
        } else {
          console.warn('Token refresh failed, clearing session');
          clearTokens();
          setSession(null);
          setLoading(false);
          return Promise.resolve();
        }
      }
      
      if (accessToken) {
        // Verify token is still valid by fetching user info
        try {
          const userInfo = await getUserInfo(accessToken);
          
          setSession({
            id: userInfo.sub || '',
            user: {
              id: userInfo.sub || '',
              email: userInfo.email || '',
              name: userInfo.name,
              given_name: userInfo.given_name,
              family_name: userInfo.family_name,
              picture: userInfo.picture,
            },
            access_token: accessToken,
          });
        } catch (error) {
          // Round 24 Finding 1 (HIGH): status-code-first matching.
          //
          // The previous implementation substring-matched on
          // `error.message`, so any error wrapping that dropped the
          // status (transport errors, malformed JSON, future SDK
          // updates, Zitadel error variants that don't include the
          // word "Unauthorized") fell into the "keep existing
          // session" branch - a revoked admin's window of access
          // was up to the 5-minute periodic refresh PLUS this
          // graceful-degrade fallback.
          //
          // Now we treat ANY HTTP status with a definite shape
          // (`error.status` set) as authoritative: 4xx → token
          // is bad, clear it. Only fall through to the
          // "keep existing session" branch on transport-shaped
          // errors (no status, e.g. `TypeError: Failed to fetch`)
          // because those genuinely could be a momentary network
          // blip rather than a revoked token.
          const errStatus = (error as { status?: number }).status;
          const isAuthFailure = typeof errStatus === 'number' && errStatus >= 400 && errStatus < 500;
          // Belt-and-braces: keep the substring check so older
          // error-throwing paths that don't carry status still
          // get caught.
          const messageMatchesAuthFail = error instanceof Error && (
            error.message.includes('401') ||
            error.message.includes('Unauthorized') ||
            error.message.includes('invalid token') ||
            error.message.includes('token is not valid') ||
            error.message.includes('token has expired') ||
            error.message.includes('access token invalid')
          );
          const isTokenError = isAuthFailure || messageMatchesAuthFail;
          
          if (isTokenError) {
            // Try to refresh token before giving up
            console.log('Token validation failed, attempting refresh...');
            const newTokens = await refreshAccessToken();
            if (newTokens) {
              // Retry with new token
              try {
                const userInfo = await getUserInfo(newTokens.access_token);
                setSession({
                  id: userInfo.sub || '',
                  user: {
                    id: userInfo.sub || '',
                    email: userInfo.email || '',
                    name: userInfo.name,
                    given_name: userInfo.given_name,
                    family_name: userInfo.family_name,
                    picture: userInfo.picture,
                  },
                  access_token: newTokens.access_token,
                });
              } catch {
                // Still failed, clear tokens
                console.error('Token refresh succeeded but validation still failed');
                clearTokens();
                setSession(null);
              }
            } else {
              // Refresh failed, clear tokens
              console.error('auth: token validation and refresh failed', safeErrorSummary(error));
              clearTokens();
              setSession(null);
            }
          } else {
            // For network or other errors, try to keep existing session if we have one
            // Don't clear tokens on temporary network issues
            console.warn('auth: token validation warning (keeping existing session)', safeErrorSummary(error));
            // If we don't have a session yet, don't set one, but don't clear tokens either
            // This allows the user to retry
          }
        }
      } else {
        setSession(null);
      }
    } catch (error) {
      console.error('auth: session check failed', safeErrorSummary(error));
      // Don't clear session on general errors - might be a temporary issue
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    try {
      // DR-2: Call the proxy's authorize endpoint - it intercepts Zitadel's 302
      // and returns the authRequest ID as JSON. The SPA navigates to the login page.
      const { authorize } = await import('@/api/auth-client');
      const { buildAuthorizeParams } = await import('@/lib/zitadel');

      // Build PKCE params (generates code_verifier + challenge, stores verifier in sessionStorage)
      const params = await buildAuthorizeParams();
      const authParams = Object.fromEntries(params.entries());

      const response = await authorize(authParams);

      // Navigate to the custom login page with the auth request context
      const loginParams = new URLSearchParams({ authRequest: response.authRequest });
      if (response.loginHint) loginParams.set('loginHint', response.loginHint);
      if (response.prompt) loginParams.set('prompt', response.prompt);
      window.location.href = `/login/loginname?${loginParams.toString()}`;
    } catch (error) {
      console.error('auth: login failed', safeErrorSummary(error));
      // Fallback: redirect to login page without auth request
      window.location.href = '/login/loginname';
    }
  };

  const logout = (): void => {
    try {
      clearTokens();
      setSession(null);
      const logoutUrl = getLogoutUrl();
      void (window.location.href = logoutUrl);
    } catch (error) {
      console.error('auth: logout failed', safeErrorSummary(error));
      clearTokens();
      setSession(null);
      window.location.href = '/auth/login';
    }
  };

  useMountEffect(() => {
    // Check session on mount
    void checkSession();

    // Set up periodic session refresh (every 5 minutes)
    const refreshInterval = setInterval(() => {
      void checkSession();
    }, 5 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  });

  const refreshSession = useCallback(async (): Promise<void> => {
    return await checkSession();
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, logout, refresh: refreshSession, login }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    // During HMR, the context tree might re-mount before the provider is ready
    const isHMR = typeof window !== 'undefined' && (
      (window as Window & { __vite_plugin_react_preamble_installed__?: boolean }).__vite_plugin_react_preamble_installed__ ||
      import.meta.hot
    );
    
    if (isHMR) {
      // During HMR, preserve the session from sessionStorage to prevent logout.
      // The AuthProvider will re-mount and call checkSession() to restore the
      // full session - this fallback just keeps API calls working in the meantime.
      const storedToken = sessionStorage.getItem('zitadel_access_token');
      if (storedToken) {
        return {
          session: {
            id: 'hmr-fallback',
            user: { id: 'hmr-fallback', email: '', name: '' },
            access_token: storedToken,
          },
          loading: false,
          logout: () => { clearTokens(); window.location.href = '/auth/login'; return Promise.resolve(); },
          refresh: async () => {},
          login: async () => {},
        };
      }
      return {
        session: null,
        loading: true,
        logout: async () => {},
        refresh: async () => {},
        login: async () => {},
      };
    }
    
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

