// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { config } from '@/config';

// Zitadel configuration — runtime config (env.js) takes precedence over build-time env vars
export const issuer = config.zitadelIssuer;
export const clientId = config.zitadelClientId;
export const redirectUri = config.zitadelRedirectUri;

// Zitadel OIDC endpoints
export async function getAuthUrl(): Promise<string> {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    code_challenge_method: 'S256',
  });
  
  // Generate code verifier and challenge for PKCE
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  
  // Store code verifier in sessionStorage for later use
  sessionStorage.setItem('zitadel_code_verifier', codeVerifier);
  params.append('code_challenge', codeChallenge);
  
  // Note: If app is in an organization, Zitadel should auto-detect it from the client_id
  // If not, you may need to add: params.append('org', 'org-name-or-id');
  
  return `${issuer}/oauth/v2/authorize?${params.toString()}`;
};

export const getLogoutUrl = () => {
  const params = new URLSearchParams({
    post_logout_redirect_uri: window.location.origin,
  });
  return `${issuer}/oidc/v1/end_session?${params.toString()}`;
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

  const response = await fetch(`${issuer}/oauth/v2/token`, {
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
    try {
      const errorText = await response.text();
      const errorJson = JSON.parse(errorText) as { error_description?: string; error?: string };
      errorMessage = errorJson.error_description || errorJson.error || errorMessage;
      console.error('Token exchange error details:', errorJson);
    } catch {
      const errorText = await response.text().catch(() => 'Unknown error');
      errorMessage = errorText || errorMessage;
    }
    // Clear code verifier on error
    sessionStorage.removeItem('zitadel_code_verifier');
    throw new Error(errorMessage);
  }

  const tokens = await response.json() as { access_token: string; id_token: string; refresh_token?: string; expires_in?: number; token_type?: string };
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
  [key: string]: unknown;
}

// Get user info from access token
export async function getUserInfo(accessToken: string): Promise<UserInfo> {
  const response = await fetch(`${issuer}/oidc/v1/userinfo`, {
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

// Store tokens in localStorage for persistence across browser sessions.
// Also records the clientId so stale tokens from a previous install are
// detected and cleared automatically (see clearTokensIfClientChanged).
export function storeTokens(tokens: { access_token: string; id_token: string; refresh_token?: string; expires_in?: number }) {
  localStorage.setItem('zitadel_access_token', tokens.access_token);
  localStorage.setItem('zitadel_id_token', tokens.id_token);
  localStorage.setItem('zitadel_client_id', clientId);
  if (tokens.refresh_token) {
    localStorage.setItem('zitadel_refresh_token', tokens.refresh_token);
  }
  // Store token expiry time if provided
  if (tokens.expires_in) {
    const expiresAt = Date.now() + (tokens.expires_in * 1000);
    localStorage.setItem('zitadel_token_expires_at', expiresAt.toString());
  }
}

// Clear tokens if the clientId in localStorage does not match the current
// clientId from env.js. This self-heals after a cluster wipe + reinstall
// where a new OIDC app is provisioned with a different clientId.
export function clearTokensIfClientChanged(): boolean {
  const storedClientId = localStorage.getItem('zitadel_client_id');
  if (storedClientId !== null && storedClientId !== clientId) {
    console.warn(`OIDC clientId changed (${storedClientId} → ${clientId}), clearing stale tokens`);
    clearTokens();
    return true;
  }
  return false;
}

// Get stored access token
export function getAccessToken(): string | null {
  return localStorage.getItem('zitadel_access_token');
}

// Get stored refresh token
export function getRefreshToken(): string | null {
  return localStorage.getItem('zitadel_refresh_token');
}

// Check if token is expired or about to expire (within 5 minutes)
export function isTokenExpired(): boolean {
  const expiresAt = localStorage.getItem('zitadel_token_expires_at');
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
    const response = await fetch(`${issuer}/oauth/v2/token`, {
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
      const errorText = await response.text();
      console.error('Token refresh failed:', errorText);
      return null;
    }

    const tokens = await response.json() as { access_token: string; id_token: string; refresh_token?: string; expires_in?: number; token_type?: string };
    // Store the new tokens
    storeTokens(tokens);
    return tokens;
  } catch (error) {
    console.error('Token refresh error:', error);
    return null;
  }
}

// Clear all tokens (localStorage for persistent tokens, sessionStorage for temp values)
export function clearTokens() {
  localStorage.removeItem('zitadel_access_token');
  localStorage.removeItem('zitadel_id_token');
  localStorage.removeItem('zitadel_refresh_token');
  localStorage.removeItem('zitadel_token_expires_at');
  localStorage.removeItem('zitadel_client_id');
  sessionStorage.removeItem('zitadel_code_verifier');
}

