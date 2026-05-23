// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { verifyMaxAge } from './oidc-helpers';

import { config } from '@/config';

// Zitadel configuration — runtime config (env.js) takes precedence over build-time env vars
export const issuer = config.zitadelIssuer;
export const clientId = config.zitadelClientId;
export const redirectUri = config.zitadelRedirectUri;

// Auth proxy base URL — same server as API, at /auth/* instead of /api/v2/*
const authProxyBase = config.apiUrl.replace(/\/api\/v2\/?$/, '/auth');

// Build OIDC authorize parameters with PKCE + state + nonce.
// Returns a URLSearchParams object (not a full URL) for use with the auth proxy.
// The code_verifier, state, and nonce are all stashed in sessionStorage
// for the matching callback / token-exchange step.
//
// `state` (OIDC §3.1.2.1) is the OIDC equivalent of a CSRF token —
// without verifying it on the callback, an attacker can craft a redirect
// (e.g. an open link with their own `?code=&state=`) that logs the
// victim's browser into the attacker's session. Rounds 18 (state) +
// 19 (nonce) added these alongside the pre-existing PKCE flow.
//
// `nonce` (OIDC §3.1.2.1 / §3.1.3.7) binds the issued ID token to this
// specific auth request. Without verifying the `nonce` claim on the
// returned id_token, an attacker who steals an ID token (cache, proxy
// log, etc.) can splice it into a victim's session.
/**
 * Round 25 Wave 8 (item 2 / F-chaos-4): optional `maxAge` for OIDC
 * `max_age` parameter. When supplied, the SPA stores it in
 * sessionStorage and `exchangeCodeForTokens` verifies that the
 * id_token's `auth_time` claim is within `maxAge + clockSkew` of
 * `now`. Out-of-budget tokens are rejected so the SPA forces a fresh
 * authentication for sensitive flows that need recent re-auth.
 *
 * Stackweaver's primary login flow doesn't drive `max_age` today —
 * this is OIDC §3.1.2.1 compliance + future-proofing for re-auth-on-
 * sensitive-operation patterns.
 */
export interface AuthorizeOpts {
  /** OIDC `max_age` in seconds. */
  maxAge?: number;
}

export async function buildAuthorizeParams(opts: AuthorizeOpts = {}): Promise<URLSearchParams> {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    // offline_access asks Zitadel to issue a refresh_token alongside the
    // access_token; without it, refreshAccessToken()'s grant_type=refresh_token
    // path is unreachable and AuthContext bounces the user to /auth/login on
    // every token expiry.
    scope: 'openid profile email offline_access',
    code_challenge_method: 'S256',
  });

  // Generate code verifier and challenge for PKCE
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Generate state + nonce. Both are 32-byte base64url-encoded random
  // strings — same shape as the code_verifier, plenty of entropy for
  // CSRF / replay defense.
  const state = generateRandomToken();
  const nonce = generateRandomToken();

  // Store all three for the callback to consume. They MUST be one-shot:
  // `consumeOIDCState` clears state on read, `exchangeCodeForTokens`
  // clears nonce on successful validation. Replay of the same callback
  // URL after consumption would surface a missing-state / missing-nonce
  // error rather than silently re-authenticating.
  sessionStorage.setItem('zitadel_code_verifier', codeVerifier);
  sessionStorage.setItem('zitadel_oidc_state', state);
  sessionStorage.setItem('zitadel_oidc_nonce', nonce);

  params.append('code_challenge', codeChallenge);
  params.append('state', state);
  params.append('nonce', nonce);

  // Round 25 Wave 8 (item 2 / F-chaos-4): wire max_age through to
  // Zitadel AND stash it locally so the callback handler can verify
  // auth_time on the returned id_token. Always clear stale max_age
  // from a previous flow so a callback-replay can't satisfy the
  // check by relying on a leftover value.
  sessionStorage.removeItem('zitadel_oidc_max_age');
  if (typeof opts.maxAge === 'number' && opts.maxAge >= 0) {
    params.append('max_age', String(opts.maxAge));
    sessionStorage.setItem('zitadel_oidc_max_age', String(opts.maxAge));
  }

  return params;
}

/**
 * Consume the stored OIDC state and verify it matches the value the
 * authorization server returned on the callback. Always clears the
 * stored state on call (one-shot) so a successful match cannot be
 * replayed and a mismatch attempt cannot be retried.
 *
 * Returns true when the received state matches the stored state.
 * Callers (Callback.tsx) MUST refuse to exchange the code unless this
 * returns true — otherwise the SPA will accept attacker-injected
 * `?code=…&state=…` redirects.
 */
export function consumeOIDCState(receivedState: string | null): boolean {
  const stored = sessionStorage.getItem('zitadel_oidc_state');
  // One-shot: always clear, regardless of match outcome.
  sessionStorage.removeItem('zitadel_oidc_state');
  if (!stored || !receivedState) return false;
  return stored === receivedState;
}

// Generate a 32-byte base64url-encoded random token. Used for state
// and nonce; the code-verifier path uses its own helper that's been
// in place since the original PKCE wiring.
function generateRandomToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Decode the payload of a JWT (base64url middle segment) to a
// claims object. Used by exchangeCodeForTokens for nonce verification.
// NOT a signature-verifying decode — Zitadel's JWKS-verified token
// exchange already proves provenance; this just reads the claims to
// check the nonce binding.
function decodeJWTPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split('.');
  if (parts.length < 2 || !parts[1]) throw new Error('Invalid JWT shape');
  const base64url = parts[1];
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}

// Legacy wrapper — returns a full Zitadel authorize URL.
// Only used as fallback if the proxy is unreachable.
export async function getAuthUrl(): Promise<string> {
  const params = await buildAuthorizeParams();
  return `${issuer}/oauth/v2/authorize?${params.toString()}`;
};

export const getLogoutUrl = () => {
  const params = new URLSearchParams({
    post_logout_redirect_uri: window.location.origin,
  });
  // Include id_token_hint so Zitadel knows which session to terminate
  const idToken = sessionStorage.getItem('zitadel_id_token');
  if (idToken) {
    params.set('id_token_hint', idToken);
  }
  // Route through auth proxy (GET — OIDC RP-Initiated Logout spec)
  return `${authProxyBase}/oidc/end-session?${params.toString()}`;
};

// Generate random code verifier for PKCE
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Generate code challenge from verifier using SHA-256
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string): Promise<{ access_token: string; id_token: string; refresh_token?: string }> {
  const codeVerifier = sessionStorage.getItem('zitadel_code_verifier');
  if (!codeVerifier) {
    throw new Error('Code verifier not found. Please try logging in again.');
  }

  // Route through auth proxy — redirect_uri passed unchanged for PKCE validation
  const response = await fetch(`${authProxyBase}/oidc/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    credentials: 'include',
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    let errorMessage = `Token exchange failed: ${response.status}`;
    const errorText = await response.text().catch(() => '');
    try {
      const errorJson = JSON.parse(errorText) as { error_description?: string; error?: string };
      errorMessage = errorJson.error_description || errorJson.error || errorMessage;
    } catch {
      if (errorText) errorMessage = errorText;
    }
    // Clear code verifier on error
    sessionStorage.removeItem('zitadel_code_verifier');
    throw new Error(errorMessage);
  }

  const tokens = await response.json() as { access_token: string; id_token: string; refresh_token?: string; expires_in?: number; token_type?: string };

  // OIDC §3.1.3.7 step 11: validate the id_token's `nonce` claim
  // matches the value sent on /authorize. The nonce is one-shot —
  // clear after validation regardless of outcome so a re-attempt
  // can't bypass the check by relying on a stale stored value.
  const expectedNonce = sessionStorage.getItem('zitadel_oidc_nonce');
  sessionStorage.removeItem('zitadel_oidc_nonce');
  if (!expectedNonce) {
    sessionStorage.removeItem('zitadel_code_verifier');
    throw new Error('OIDC nonce missing from session — please retry login');
  }
  let claims: Record<string, unknown>;
  try {
    claims = decodeJWTPayload(tokens.id_token);
  } catch {
    sessionStorage.removeItem('zitadel_code_verifier');
    throw new Error('id_token has invalid JWT shape');
  }
  if (claims.nonce !== expectedNonce) {
    sessionStorage.removeItem('zitadel_code_verifier');
    throw new Error('OIDC nonce mismatch — possible token injection');
  }

  // Round 25 Wave 8 (item 2 / F-chaos-4): max_age verification per
  // OIDC §3.1.2.1. When the SPA passed `max_age=N` on /authorize, the
  // returned id_token's `auth_time` claim MUST be within `N + clockSkew`
  // seconds of now. Out-of-budget tokens are rejected so the user is
  // forced to re-authenticate for the sensitive flow that needed
  // recent re-auth. The stored max_age is one-shot: consumed here
  // regardless of outcome so a callback-replay can't bypass the
  // check by relying on a leftover value.
  const storedMaxAge = sessionStorage.getItem('zitadel_oidc_max_age');
  sessionStorage.removeItem('zitadel_oidc_max_age');
  if (storedMaxAge !== null) {
    const maxAge = parseInt(storedMaxAge, 10);
    const verdict = verifyMaxAge(claims.auth_time, maxAge, Math.floor(Date.now() / 1000));
    if (verdict !== 'ok') {
      sessionStorage.removeItem('zitadel_code_verifier');
      throw new Error(verdict);
    }
  }

  sessionStorage.removeItem('zitadel_code_verifier');
  return tokens;
}

// User info type from OIDC userinfo endpoint
export interface UserInfo {
  sub: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  picture?: string;
  [key: string]: unknown;
}

// Get user info from access token
export async function getUserInfo(accessToken: string): Promise<UserInfo> {
  const response = await fetch(`${authProxyBase}/oidc/userinfo`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Failed to get user info: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText) as { error_description?: string; error?: string };
      errorMessage = errorJson.error_description || errorJson.error || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    const error = new Error(errorMessage);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  return await response.json() as UserInfo;
}

// Store tokens in sessionStorage (DR-1: migrated from localStorage).
// sessionStorage survives page refresh and Vite HMR but clears on tab close,
// shrinking the XSS blast radius vs localStorage.
// Also records the clientId in localStorage (not a credential — self-heal marker).
export function storeTokens(tokens: { access_token: string; id_token: string; refresh_token?: string; expires_in?: number }) {
  sessionStorage.setItem('zitadel_access_token', tokens.access_token);
  sessionStorage.setItem('zitadel_id_token', tokens.id_token);
  // clientId stays in localStorage — used by clearTokensIfClientChanged for
  // cluster-wipe self-heal detection (not a credential)
  localStorage.setItem('zitadel_client_id', clientId);
  if (tokens.refresh_token) {
    sessionStorage.setItem('zitadel_refresh_token', tokens.refresh_token);
  }
  // Store token expiry time if provided
  if (tokens.expires_in) {
    const expiresAt = Date.now() + (tokens.expires_in * 1000);
    sessionStorage.setItem('zitadel_token_expires_at', expiresAt.toString());
  }
}

// Clear tokens if the clientId in localStorage does not match the current
// clientId from env.js. This self-heals after a cluster wipe + reinstall
// where a new OIDC app is provisioned with a different clientId.
//
// Round 25 Wave 7 (item 7 / R24-5): the previous log line interpolated
// the actual clientId values, which are sensitive operator identifiers
// that shouldn't reach the browser console / extensions / future
// telemetry SDKs. Drop the values; the breadcrumb that the transition
// happened is enough for debugging.
export function clearTokensIfClientChanged(): boolean {
  const storedClientId = localStorage.getItem('zitadel_client_id');
  if (storedClientId !== null && storedClientId !== clientId) {
    console.warn('zitadel: OIDC clientId changed, clearing stale tokens');
    clearTokens();
    return true;
  }
  return false;
}

// Get stored access token
export function getAccessToken(): string | null {
  return sessionStorage.getItem('zitadel_access_token');
}

// Get stored refresh token
export function getRefreshToken(): string | null {
  return sessionStorage.getItem('zitadel_refresh_token');
}

// Check if token is expired or about to expire (within 5 minutes)
export function isTokenExpired(): boolean {
  const expiresAt = sessionStorage.getItem('zitadel_token_expires_at');
  if (!expiresAt) {
    // No expiry stored, assume not expired but try to validate
    return false;
  }
  // Token is "expired" if it expires within 5 minutes
  const fiveMinutes = 5 * 60 * 1000;
  return Date.now() > (parseInt(expiresAt, 10) - fiveMinutes);
}

// Refresh the access token using the refresh token
export async function refreshAccessToken(): Promise<{ access_token: string; id_token: string; refresh_token?: string; expires_in?: number } | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    console.warn('No refresh token available');
    return null;
  }

  try {
    // Route through auth proxy
    const response = await fetch(`${authProxyBase}/oidc/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      credentials: 'include',
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      // Round 25 Wave 7 (item 7 / R24-5): don't log the response body
      // — Zitadel's error responses can include the offending token
      // value or other request-shaped data we don't want in the
      // console. The status alone is enough to diagnose.
      console.error(`zitadel: token refresh failed (status=${response.status})`);
      return null;
    }

    const tokens = await response.json() as { access_token: string; id_token: string; refresh_token?: string; expires_in?: number; token_type?: string };
    // Store the new tokens
    storeTokens(tokens);
    return tokens;
  } catch (error) {
    // Round 25 Wave 7 (item 7 / R24-5): never log the full Error
    // object — type tag + status (when present) is enough.
    const status = (error as { status?: number }).status;
    const tag = error instanceof Error ? error.name : typeof error;
    console.error(`zitadel: token refresh error (${tag}${typeof status === 'number' ? `, status=${status}` : ''})`);
    return null;
  }
}

// Clear all tokens (sessionStorage for credentials, localStorage for self-heal marker).
// Also clears any in-flight PKCE / state / nonce so a logout-then-relogin
// can't trip over leftover authorize-time randoms.
export function clearTokens() {
  sessionStorage.removeItem('zitadel_access_token');
  sessionStorage.removeItem('zitadel_id_token');
  sessionStorage.removeItem('zitadel_refresh_token');
  sessionStorage.removeItem('zitadel_token_expires_at');
  sessionStorage.removeItem('zitadel_code_verifier');
  sessionStorage.removeItem('zitadel_oidc_state');
  sessionStorage.removeItem('zitadel_oidc_nonce');
  localStorage.removeItem('zitadel_client_id');
}

