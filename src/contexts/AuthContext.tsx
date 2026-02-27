// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getAccessToken, getUserInfo, getLogoutUrl, clearTokens, isTokenExpired, refreshAccessToken } from '@/lib/zitadel';

// Zitadel user session type
export type Session = {
  id: string;
  user: {
    id: string;
    email: string;
    name?: string;
    given_name?: string;
    family_name?: string;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSession = async (): Promise<void> => {
    try {
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
            },
            access_token: accessToken,
          });
        } catch (error) {
          // Check if it's a token validation error
          const isTokenError = error instanceof Error && (
            error.message.includes('401') || 
            error.message.includes('Unauthorized') ||
            error.message.includes('invalid token') ||
            error.message.includes('token is not valid') ||
            error.message.includes('token has expired') ||
            error.message.includes('access token invalid') ||
            (error as Error & { status?: number }).status === 401
          );
          
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
              console.error('Token validation and refresh failed:', error);
              clearTokens();
              setSession(null);
            }
          } else {
            // For network or other errors, try to keep existing session if we have one
            // Don't clear tokens on temporary network issues
            console.warn('Token validation warning (keeping existing session):', error);
            // If we don't have a session yet, don't set one, but don't clear tokens either
            // This allows the user to retry
          }
        }
      } else {
        setSession(null);
      }
    } catch (error) {
      console.error('Session check failed:', error);
      // Don't clear session on general errors - might be a temporary issue
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    try {
      const { getAuthUrl } = await import('@/lib/zitadel');
      const authUrl = await getAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const logout = (): void => {
    try {
      clearTokens();
      setSession(null);
      const logoutUrl = getLogoutUrl();
      void (window.location.href = logoutUrl);
    } catch (error) {
      console.error('Logout failed:', error);
      clearTokens();
      setSession(null);
      window.location.href = '/auth/login';
    }
  };

  useEffect(() => {
    // Check session on mount
    void checkSession();

    // Set up periodic session refresh (every 5 minutes)
    const refreshInterval = setInterval(() => {
      void checkSession();
    }, 5 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, []);

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
      // Return a safe fallback during HMR to prevent crashes
      console.warn('useAuth: Context undefined during HMR, returning fallback');
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

