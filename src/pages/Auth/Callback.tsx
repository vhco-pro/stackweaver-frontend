// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, useRef } from 'react';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { consumeOIDCState, exchangeCodeForTokens, storeTokens } from '@/lib/zitadel';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false);
  const processedCodeRef = useRef<string | null>(null);

  useMountEffect(() => {
    // Prevent multiple executions
    if (processingRef.current) return;

    const handleCallback = async () => {
      const code = searchParams.get('code');
      const stateParam = searchParams.get('state');
      const errorParam = searchParams.get('error');

      // Check if we've already processed this code
      if (code && processedCodeRef.current === code) {
        console.log('Code already processed, redirecting...');
        void Promise.resolve(navigate('/dashboard', { replace: true }));
        return;
      }

      processingRef.current = true;

      if (errorParam) {
        setError(errorParam);
        setTimeout(() => {
          void Promise.resolve(navigate('/auth/login', { replace: true }));
        }, 3000);
        processingRef.current = false;
        return;
      }

      if (!code) {
        setError('No authorization code received');
        setTimeout(() => {
          void Promise.resolve(navigate('/auth/login', { replace: true }));
        }, 3000);
        processingRef.current = false;
        return;
      }

      // OIDC state validation (Round 18). MUST run BEFORE token exchange:
      // an attacker-injected callback (foreign `?code=…&state=…`) would
      // otherwise log the victim into the attacker's session. consumeOIDCState
      // is one-shot - it always clears the stored state, so a successful
      // match cannot be replayed and a mismatch attempt cannot be retried.
      if (!consumeOIDCState(stateParam)) {
        setError('Authentication failed: state mismatch (possible CSRF)');
        // Same redirect-after-timeout pattern as the other error branches.
        setTimeout(() => {
          void Promise.resolve(navigate('/auth/login', { replace: true }));
        }, 3000);
        processingRef.current = false;
        return;
      }

      // Mark this code as being processed
      processedCodeRef.current = code;

      try {
        // Exchange authorization code for tokens
        const tokens = await exchangeCodeForTokens(code);
        
        // Store tokens (synchronous sessionStorage write) and refresh the auth context.
        // AUD-078: the two 100ms "ensure it's stored/set" sleeps that used to bracket these were
        // cargo-cult - storeTokens is synchronous and refresh() is awaited, so nothing races.
        storeTokens(tokens);
        await refresh();

        // If a deep-linked page (e.g. the Terraform CLI /oauth/authorize flow)
        // stashed a return URL before kicking off login, honour it. It is a
        // same-origin app path, so a full-page navigation returns the user
        // exactly where they were, query string intact.
        const returnUrl = sessionStorage.getItem('oauth_return_url');
        if (returnUrl) {
          sessionStorage.removeItem('oauth_return_url');
          // Open-redirect guard: only honour same-origin app URLs.
          try {
            const parsed = new URL(returnUrl, window.location.origin);
            if (parsed.origin === window.location.origin) {
              window.location.href = parsed.toString();
              return;
            }
          } catch {
            // fall through to the default dashboard redirect
          }
        }

        // Redirect to dashboard
        void Promise.resolve(navigate('/dashboard', { replace: true }));
      } catch (err) {
        console.error('Callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
        // Clear the processed code on error so user can retry
        processedCodeRef.current = null;
        setTimeout(() => {
          void Promise.resolve(navigate('/auth/login', { replace: true }));
        }, 3000);
      } finally {
        processingRef.current = false;
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




