// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Unauthenticated API client for /auth/* endpoints.
 *
 * Unlike client.ts (which requires a Bearer token for JSON:API /api/v2/* calls),
 * this client talks to the auth proxy endpoints that handle the login flow.
 * Requests use `credentials: 'include'` so the httpOnly session cookie is sent
 * automatically by the browser (see plan D6 cross-port dev note).
 *
 * Responses use Zitadel's v2 API shape (protobuf-JSON), NOT JSON:API.
 */

import { config } from '@/config';

// The auth proxy runs on the same API server, just at /auth/* instead of /api/v2/*
const AUTH_BASE_URL = config.apiUrl.replace(/\/api\/v2\/?$/, '/auth');

// --- Types ---

export interface AuthorizeResponse {
  authRequest: string;
  loginHint?: string;
  prompt?: string;
  scope?: string;
  organization?: string;
  organizationId?: string;
  organizationDomain?: string;
}

export interface SessionResponse {
  sessionId: string;
  sessionToken: string;
  details?: {
    sequence?: string;
    changeDate?: string;
    resourceOwner?: string;
  };
  challenges?: {
    webAuthN?: {
      publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptionsJSON;
    };
    otpEmail?: string;
    otpSms?: string;
  };
}

// WebAuthn types from the Web Authentication API
interface PublicKeyCredentialRequestOptionsJSON {
  challenge: string;
  timeout?: number;
  rpId?: string;
  allowCredentials?: Array<{
    type: string;
    id: string;
    transports?: string[];
  }>;
  userVerification?: string;
}

export interface FinalizeResponse {
  callbackUrl: string;
}

export interface LoginSettings {
  allowUsernamePassword?: boolean;
  allowRegister?: boolean;
  allowExternalIdp?: boolean;
  forceMfa?: boolean;
  forceMfaLocalOnly?: boolean;
  passwordless?: boolean;
  hidePasswordReset?: boolean;
  ignoreUnknownUsernames?: boolean;
  allowDomainDiscovery?: boolean;
  allowAutoLinking?: boolean;
  autoRegister?: boolean;
  defaultRedirectUri?: string;
  passwordCheckLifetime?: string;
  externalLoginCheckLifetime?: string;
  mfaInitSkipLifetime?: string;
  secondFactorCheckLifetime?: string;
  multiFactorCheckLifetime?: string;
  secondFactors?: string[];
  multiFactors?: string[];
  disableLoginWithEmail?: boolean;
  disableLoginWithPhone?: boolean;
}

export interface BrandingSettings {
  lightTheme?: {
    primaryColor?: string;
    warnColor?: string;
    backgroundColor?: string;
    fontColor?: string;
    logoUrl?: string;
    iconUrl?: string;
  };
  darkTheme?: {
    primaryColor?: string;
    warnColor?: string;
    backgroundColor?: string;
    fontColor?: string;
    logoUrl?: string;
    iconUrl?: string;
  };
  hideLoginNameSuffix?: boolean;
  disableWatermark?: boolean;
}

export interface PasswordComplexitySettings {
  minLength?: number;
  hasUppercase?: boolean;
  hasLowercase?: boolean;
  hasNumber?: boolean;
  hasSymbol?: boolean;
}

export interface IdpProvider {
  id: string;
  name: string;
  type: string;
}

export interface AuthError {
  code: number;
  message: string;
}

// --- Client functions ---

async function authFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${AUTH_BASE_URL}${path}`;
  const method = options.method?.toUpperCase() ?? 'GET';
  // Only set Content-Type on methods that have a body - avoids unnecessary CORS preflight on GET
  const headers: HeadersInit = method === 'GET' || method === 'HEAD'
    ? { ...options.headers }
    : { 'Content-Type': 'application/json', ...options.headers };

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    let authError: AuthError;
    try {
      authError = await response.json() as AuthError;
    } catch {
      authError = { code: response.status, message: response.statusText };
    }
    const err = new Error(authError.message);
    (err as Error & { code?: number }).code = authError.code;
    throw err;
  }

  return response.json() as Promise<T>;
}

async function authFetchRaw(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${AUTH_BASE_URL}${path}`;
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

// --- OIDC endpoints ---

export async function authorize(params: Record<string, string>): Promise<AuthorizeResponse> {
  const query = new URLSearchParams(params).toString();
  return authFetch<AuthorizeResponse>(`/oidc/authorize?${query}`);
}

export async function tokenExchange(formData: URLSearchParams): Promise<{
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in?: number;
}> {
  const url = `${AUTH_BASE_URL}/oidc/token`;
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${errorText}`);
  }

  return response.json() as Promise<{
    access_token: string;
    id_token: string;
    refresh_token?: string;
    expires_in?: number;
  }>;
}

export async function endSession(params: Record<string, string>): Promise<void> {
  const url = `${AUTH_BASE_URL}/oidc/end-session`;
  await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
}

// --- Auth request endpoints ---

export async function getAuthRequest(id: string): Promise<unknown> {
  return authFetch(`/oidc/auth-requests/${id}`);
}

export async function finalizeAuthRequest(body: {
  authRequestId: string;
  sessionId: string;
  sessionToken?: string;
}): Promise<FinalizeResponse> {
  return authFetch<FinalizeResponse>('/oidc/finalize', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// --- Session endpoints ---

export async function createSession(body: Record<string, unknown>): Promise<SessionResponse> {
  return authFetch<SessionResponse>('/sessions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateSession(
  sessionId: string,
  body: Record<string, unknown>
): Promise<SessionResponse> {
  return authFetch<SessionResponse>(`/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await authFetchRaw(`/sessions/${sessionId}`, { method: 'DELETE' });
}

// --- IdP endpoints ---

export async function startIdP(idpId: string): Promise<{ authUrl: string }> {
  return authFetch<{ authUrl: string }>('/idp/start', {
    method: 'POST',
    body: JSON.stringify({ idpId }),
  });
}

export async function completeIdP(intentId: string, token: string): Promise<unknown> {
  return authFetch(`/idp/complete/${intentId}`, {
    method: 'POST',
    body: JSON.stringify({ idpIntentToken: token }),
  });
}

export async function listIdpProviders(): Promise<{ result: IdpProvider[] }> {
  return authFetch<{ result: IdpProvider[] }>('/idp/providers');
}

// --- User management endpoints ---

// UserRecord captures the subset of `GET /v2/users/{id}` that the
// SPA actually consumes. Zitadel returns a much richer object -
// pin to the fields we use so a future Zitadel addition doesn't
// silently change the SPA's interpretation.
export interface UserRecord {
  user?: {
    userId: string;
    state?: string;
    username?: string;
    preferredLoginName?: string;
    human?: {
      passwordChangeRequired?: boolean;
      passwordChanged?: string;
      profile?: {
        givenName?: string;
        familyName?: string;
        displayName?: string;
      };
      email?: {
        email?: string;
        isVerified?: boolean;
      };
    };
  };
}

export async function getUser(userId: string): Promise<UserRecord> {
  return authFetch<UserRecord>(`/users/${userId}`);
}

export async function createUser(body: Record<string, unknown>): Promise<unknown> {
  return authFetch('/users', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function requestPasswordReset(userId: string): Promise<unknown> {
  return authFetch(`/users/${userId}/password-reset`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function changePassword(
  userId: string,
  body: Record<string, unknown>
): Promise<unknown> {
  return authFetch(`/users/${userId}/password`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// --- Settings endpoints ---

export async function getLoginSettings(orgId?: string): Promise<LoginSettings> {
  // Org context matters for `forceMfa`, `allowRegister`,
  // `allowDomainDiscovery`, `ignoreUnknownUsernames` etc - orgs with their
  // own login-policy override would otherwise be invisible to the SPA and
  // the instance default would silently win. Passed as `?ctx.orgId=<id>`
  // (Zitadel's canonical settings-context query param). The auth proxy's
  // settings cache keys per-orgId so this doesn't undermine A7-cache.
  const path = orgId ? `/settings/login?ctx.orgId=${encodeURIComponent(orgId)}` : '/settings/login';
  return authFetch<LoginSettings>(path);
}

export async function getBrandingSettings(): Promise<BrandingSettings> {
  return authFetch<BrandingSettings>('/settings/branding');
}

export async function getPasswordComplexitySettings(): Promise<PasswordComplexitySettings> {
  return authFetch<PasswordComplexitySettings>('/settings/password-complexity');
}

export async function getLegalSettings(): Promise<unknown> {
  return authFetch('/settings/legal');
}

export async function getPasswordExpirySettings(): Promise<unknown> {
  return authFetch('/settings/password-expiry');
}

export async function getLockoutSettings(): Promise<unknown> {
  return authFetch('/settings/lockout');
}

export async function getSecuritySettings(): Promise<unknown> {
  return authFetch('/settings/security');
}

// --- User auth-method query ---

/**
 * Zitadel's enumeration of enrolled authentication factors. The SPA's
 * password page reads this after the password check to decide whether
 * to route the user to a second-factor prompt - a TOTP-enrolled user
 * who lands on /dashboard with only password verified silently breaks
 * user-level MFA enforcement.
 */
export type AuthenticationMethodType =
  | 'AUTHENTICATION_METHOD_TYPE_UNSPECIFIED'
  | 'AUTHENTICATION_METHOD_TYPE_PASSWORD'
  | 'AUTHENTICATION_METHOD_TYPE_PASSKEY'
  | 'AUTHENTICATION_METHOD_TYPE_IDP'
  | 'AUTHENTICATION_METHOD_TYPE_TOTP'
  | 'AUTHENTICATION_METHOD_TYPE_U2F'
  | 'AUTHENTICATION_METHOD_TYPE_OTP_SMS'
  | 'AUTHENTICATION_METHOD_TYPE_OTP_EMAIL';

export interface AuthMethodsResponse {
  authMethodTypes?: AuthenticationMethodType[];
}

export async function getUserAuthMethods(userId: string): Promise<AuthMethodsResponse> {
  return authFetch<AuthMethodsResponse>(`/users/${userId}/authentication_methods`);
}

// --- Session query endpoints ---

export async function getSession(sessionId: string): Promise<unknown> {
  return authFetch(`/sessions/${sessionId}`);
}

export async function searchSessions(body: Record<string, unknown>): Promise<unknown> {
  return authFetch('/sessions/search', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
