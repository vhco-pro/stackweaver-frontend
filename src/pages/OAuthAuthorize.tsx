// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useAuth } from '@/contexts/AuthContext';
import { getAccessToken } from '@/lib/zitadel';
import { apiClient } from '@/api/client';

// OAuthAuthorize is the SPA authorization page for the Terraform CLI login.v1
// flow (advertised as `authz: "/oauth/authorize"` in /.well-known/terraform.json).
//
// `terraform login <host>` opens the system browser here with the OAuth2
// authorization-code + PKCE query parameters and binds a loopback listener.
// Because the SPA session lives in sessionStorage (per-tab) and the backend
// only accepts a Bearer token, the authorization code MUST be minted from the
// browser: this page calls the Bearer-authed POST /api/v2/oauth/authorize and
// then redirects the browser to Terraform's loopback `redirect_uri` carrying
// the one-time code. Terraform exchanges that code for an API token at the
// public token endpoint.
//
// If the user is not yet authenticated, the page stashes its own URL and kicks
// off the normal login flow; the OIDC callback returns the user here.

interface MintCodeResponse {
  code: string;
  state: string;
}

const RETURN_URL_KEY = 'oauth_return_url';

export default function OAuthAuthorize() {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useMountEffect(() => {
    const responseType = searchParams.get('response_type');
    const clientId = searchParams.get('client_id');
    const redirectUri = searchParams.get('redirect_uri');
    const codeChallenge = searchParams.get('code_challenge');
    const codeChallengeMethod = searchParams.get('code_challenge_method');
    const state = searchParams.get('state') ?? '';

    const run = async () => {
      if (
        !redirectUri ||
        !codeChallenge ||
        codeChallengeMethod !== 'S256' ||
        responseType !== 'code'
      ) {
        setError('Invalid or unsupported authorization request');
        return;
      }

      // The SPA session lives in sessionStorage. A fresh browser tab opened by
      // `terraform login` has none — start the login round-trip and return here.
      if (!getAccessToken()) {
        sessionStorage.setItem(RETURN_URL_KEY, window.location.href);
        await login();
        return;
      }

      try {
        const res = await apiClient.post<MintCodeResponse>('/oauth/authorize', {
          client_id: clientId,
          redirect_uri: redirectUri,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
          state,
        });

        // Hand the one-time code back to Terraform's loopback listener.
        const url = new URL(redirectUri);
        url.searchParams.set('code', res.code);
        if (state) url.searchParams.set('state', state);
        window.location.assign(url.toString());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to authorize Terraform CLI');
      }
    };

    void run();
  });

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full space-y-4 p-8 text-center">
          <h2 className="text-2xl font-bold text-destructive">Authorization Error</h2>
          <p className="text-muted-foreground">{error}</p>
          <p className="text-sm text-muted-foreground">
            You can close this window and return to your terminal.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full space-y-4 p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <h2 className="text-xl font-semibold">Authorizing Terraform CLI</h2>
        <p className="text-muted-foreground">
          Completing sign-in for the Terraform command line. This window will redirect automatically.
        </p>
      </div>
    </div>
  );
}
