// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, useRef } from 'react';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { EMAIL_NOT_VERIFIED, fetchSession, redeemSignIn, SessionError } from '@/lib/zitadel';
import { RETURN_URL_KEY, SESSION_QUERY_KEY } from '@/contexts/authSession';
import { verifyEmailRequiredPath } from '@/lib/emailVerification';
import { Loader2 } from 'lucide-react';

/**
 * takeReturnUrl reads and clears the page the person was on before sign-in, when it is on this
 * origin (an open-redirect guard), or answers null.
 */
function takeReturnUrl(): string | null {
  let stored: string | null;
  try {
    stored = sessionStorage.getItem(RETURN_URL_KEY);
    sessionStorage.removeItem(RETURN_URL_KEY);
  } catch {
    return null;
  }
  if (!stored) return null;
  try {
    const parsed = new URL(stored, window.location.origin);
    return parsed.origin === window.location.origin ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/**
 * The page Zitadel's sign-in redirect lands on, with the code and state. The API redeems them
 * (POST /auth/session) as the confidential client, checks that this browser started the sign-in,
 * and sets the session cookie. The page holds no token at any point.
 */
export default function Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const failWith = (message: string): void => {
    setError(message);
    setTimeout(() => { void Promise.resolve(navigate('/auth/login', { replace: true })); }, 3000);
  };

  const finish = (): void => {
    const returnUrl = takeReturnUrl();
    if (returnUrl) {
      // A full navigation, so the page starts with the new session.
      window.location.href = returnUrl;
      return;
    }
    void Promise.resolve(navigate('/dashboard', { replace: true }));
  };

  useMountEffect(() => {
    if (started.current) return;
    started.current = true;

    const handleCallback = async (): Promise<void> => {
      const errorParam = searchParams.get('error');
      if (errorParam) {
        failWith(errorParam);
        return;
      }

      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        if (!code || !state) {
          failWith('No authorization code received');
          return;
        }
        // The API redeems the code and replaces whatever session this browser held, so a browser
        // signing in again, as the same person or another, ends with the new session only.
        let profile;
        try {
          profile = await redeemSignIn(code, state);
        } catch (err) {
          // A refused redemption (a reload of this page, or a code another tab of this browser
          // already used) leaves the browser's session as it was; when it has one, go on with it.
          if (err instanceof SessionError && err.status === 400) {
            const existing = await fetchSession().catch(() => null);
            if (existing) {
              queryClient.setQueryData(SESSION_QUERY_KEY, existing);
              finish();
              return;
            }
          }
          throw err;
        }
        queryClient.setQueryData(SESSION_QUERY_KEY, profile);
        finish();
      } catch (err) {
        // #829 D5: an account whose email is not verified is refused at sign-in; send it to the
        // page that explains what to do. Any other refusal (an untrusted origin, a proxy that drops
        // the CSRF header) is shown as the error it is.
        if (err instanceof SessionError && err.code === EMAIL_NOT_VERIFIED) {
          window.location.assign(verifyEmailRequiredPath(''));
          return;
        }
        console.error('auth: completing sign-in failed', err instanceof SessionError ? `status=${err.status}` : err instanceof Error ? err.name : typeof err);
        failWith(err instanceof Error ? err.message : 'Authentication failed');
      }
    };

    void handleCallback();
  });

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full space-y-4 p-8 text-center">
          <div className="text-destructive">
            <h2 className="text-2xl font-bold mb-2">Authentication Error</h2>
            <p className="text-muted-foreground">{error}</p>
            <p className="text-sm text-muted-foreground mt-4">
              Redirecting to login...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Completing authentication...</p>
      </div>
    </div>
  );
}
