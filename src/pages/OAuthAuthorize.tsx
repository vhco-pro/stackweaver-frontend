// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, SquareTerminal } from 'lucide-react';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useAuth } from '@/contexts/AuthContext';
import { fetchSession } from '@/lib/zitadel';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';

// OAuthAuthorize is the SPA authorization page for the Terraform CLI login.v1
// flow (advertised as `authz: "/oauth/authorize"` in /.well-known/terraform.json).
//
// `terraform login <host>` opens the system browser here with the OAuth2
// authorization-code + PKCE query parameters and binds a loopback listener.
// The authorization code is minted from the signed-in browser: this page calls
// POST /api/v2/oauth/authorize with the browser's session cookie and
// then redirects the browser to Terraform's loopback `redirect_uri` carrying
// the one-time code. Terraform exchanges that code for an API token at the
// public token endpoint.
//
// The session cookie is shared by every tab, so any page could open this one in a signed-in
// browser. Nothing is minted until the person confirms here, after seeing which account the CLI
// signs in as and where its code goes; Cancel answers the CLI with access_denied.
//
// If the user is not yet authenticated, the page stashes its own URL and kicks
// off the normal login flow; the OIDC callback returns the user here.

interface MintCodeResponse {
  code: string;
  state: string;
}

interface AuthorizeRequest {
  clientId: string | null;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string;
}

type Phase =
  | { kind: 'checking' }
  | { kind: 'consent'; email: string; request: AuthorizeRequest }
  | { kind: 'authorizing' }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

const RETURN_URL_KEY = 'oauth_return_url';

/** The loopback ports `terraform login` may listen on, as advertised in /.well-known/terraform.json. */
const LOOPBACK_MIN_PORT = 10000;
const LOOPBACK_MAX_PORT = 10010;

/**
 * The CLI's loopback listener, or null when redirectUri is anything else. The page navigates to
 * this address on Authorize and on Cancel, so it is checked here exactly as the API checks it
 * (validLoopbackRedirect): an http URL on localhost or 127.0.0.1 and an advertised port. Anything
 * else, a javascript: URL or another host, would let a link run script in this origin or send the
 * browser anywhere.
 */
function loopbackListener(redirectUri: string): URL | null {
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' || (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1')) return null;
  const port = Number(url.port);
  if (!Number.isInteger(port) || port < LOOPBACK_MIN_PORT || port > LOOPBACK_MAX_PORT) return null;
  return url;
}

/** The loopback listener's host and port, as the person sees where the code goes. */
function listenerOf(redirectUri: string): string {
  return loopbackListener(redirectUri)?.host ?? redirectUri;
}

export default function OAuthAuthorize() {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' });

  useMountEffect(() => {
    const responseType = searchParams.get('response_type');
    const redirectUri = searchParams.get('redirect_uri');
    const codeChallenge = searchParams.get('code_challenge');
    const codeChallengeMethod = searchParams.get('code_challenge_method');

    const run = async () => {
      if (
        !redirectUri ||
        loopbackListener(redirectUri) === null ||
        !codeChallenge ||
        codeChallengeMethod !== 'S256' ||
        responseType !== 'code'
      ) {
        setPhase({ kind: 'error', message: 'Invalid or unsupported authorization request' });
        return;
      }

      // The browser's session is its cookie, shared by every tab, so a tab opened by
      // `terraform login` in a signed-in browser needs no sign-in. Without one, start the
      // sign-in round-trip and return here.
      let email: string | null;
      try {
        email = (await fetchSession())?.email ?? null;
      } catch {
        setPhase({ kind: 'error', message: 'Could not reach Stackweaver to check your sign-in; try again' });
        return;
      }
      if (email === null) {
        sessionStorage.setItem(RETURN_URL_KEY, window.location.href);
        await login();
        return;
      }

      setPhase({
        kind: 'consent',
        email,
        request: {
          clientId: searchParams.get('client_id'),
          redirectUri,
          codeChallenge,
          codeChallengeMethod,
          state: searchParams.get('state') ?? '',
        },
      });
    };

    void run();
  });

  const authorize = async (request: AuthorizeRequest) => {
    setPhase({ kind: 'authorizing' });
    try {
      const res = await apiClient.post<MintCodeResponse>('/oauth/authorize', {
        client_id: request.clientId,
        redirect_uri: request.redirectUri,
        code_challenge: request.codeChallenge,
        code_challenge_method: request.codeChallengeMethod,
        state: request.state,
      });

      // Hand the one-time code back to Terraform's loopback listener.
      const url = loopbackListener(request.redirectUri);
      if (url === null) throw new Error('Invalid or unsupported authorization request');
      url.searchParams.set('code', res.code);
      if (request.state) url.searchParams.set('state', request.state);
      window.location.assign(url.toString());
    } catch (err) {
      setPhase({ kind: 'error', message: err instanceof Error ? err.message : 'Failed to authorize Terraform CLI' });
    }
  };

  const cancel = (request: AuthorizeRequest) => {
    setPhase({ kind: 'cancelled' });
    // RFC 6749 4.1.2.1: tell the waiting CLI the person declined, so it stops waiting. Only the
    // loopback listener is ever navigated to; the consent step is not shown for anything else.
    const url = loopbackListener(request.redirectUri);
    if (url === null) return;
    url.searchParams.set('error', 'access_denied');
    if (request.state) url.searchParams.set('state', request.state);
    window.location.assign(url.toString());
  };

  if (phase.kind === 'error' || phase.kind === 'cancelled') {
    const cancelled = phase.kind === 'cancelled';
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full space-y-4 p-8 text-center">
          <h2 className={cancelled ? 'text-2xl font-bold' : 'text-2xl font-bold text-destructive'}>
            {cancelled ? 'Authorization cancelled' : 'Authorization Error'}
          </h2>
          {!cancelled && <p className="text-muted-foreground">{phase.message}</p>}
          <p className="text-sm text-muted-foreground">
            You can close this window and return to your terminal.
          </p>
        </div>
      </div>
    );
  }

  if (phase.kind === 'consent') {
    const { email, request } = phase;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full space-y-6 rounded-2xl border border-border bg-card p-8 shadow-lg">
          <div className="flex flex-col items-center gap-3 text-center">
            <SquareTerminal className="h-10 w-10 text-primary" aria-hidden="true" />
            <h1 className="text-2xl font-semibold">Authorize Terraform CLI</h1>
            <p className="text-muted-foreground">
              A Terraform command line on this computer asks to sign in to Stackweaver as{' '}
              <span className="font-medium text-foreground">{email}</span>. It receives an API token
              that can do anything your account can.
            </p>
          </div>
          <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
            The token is handed to the program listening on{' '}
            <span className="font-mono text-foreground">{listenerOf(request.redirectUri)}</span>.
            Authorize only if you just ran <span className="font-mono">terraform login</span>.
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" className="min-h-11" onClick={() => { cancel(request); }}>
              Cancel
            </Button>
            <Button className="min-h-11" onClick={() => { void authorize(request); }}>
              Authorize
            </Button>
          </div>
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
          {phase.kind === 'authorizing'
            ? 'Completing sign-in for the Terraform command line. This window will redirect automatically.'
            : 'Checking your sign-in.'}
        </p>
      </div>
    </div>
  );
}
