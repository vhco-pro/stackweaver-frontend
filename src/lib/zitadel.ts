// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The browser's side of sign-in. The SPA holds no OAuth token: the API redeems the sign-in code
// itself and gives the browser an httpOnly session cookie that page script cannot read
// (docs/internal/plans/security/backend-for-frontend-session-plan.md). What is left here is
// asking the API about that session and carrying the CSRF header it requires.

import { config } from '@/config';

// The auth proxy runs on the API server, at /auth/* instead of /api/v2/*.
const authProxyBase = config.apiUrl.replace(/\/api\/v2\/?$/, '/auth');

/**
 * The header every request that rides on the session cookie carries. A browser sends a custom
 * header cross-origin only after a CORS preflight the API answers for its own origins, so its
 * presence proves the SPA made the request.
 */
export const CSRF_HEADER = 'X-Stackweaver-CSRF';
export const csrfHeaders: Record<string, string> = { [CSRF_HEADER]: '1' };

/** The JSON:API error code of a 401 that means the browser has no usable session. */
export const AUTHENTICATION_REQUIRED = 'authentication-required';

/** The signed-in person, as GET /auth/session reports them. */
export interface SessionProfile {
  id: string;
  email: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  expiresAt?: string;
}

interface SessionDocument {
  data?: {
    id?: string;
    attributes?: {
      email?: string;
      name?: string;
      'given-name'?: string;
      'family-name'?: string;
      picture?: string;
      'expires-at'?: string;
    };
  };
}

function profileFrom(doc: SessionDocument): SessionProfile {
  const a = doc.data?.attributes ?? {};
  return {
    id: doc.data?.id ?? '',
    email: a.email ?? '',
    name: a.name || undefined,
    givenName: a['given-name'] || undefined,
    familyName: a['family-name'] || undefined,
    picture: a.picture || undefined,
    expiresAt: a['expires-at'],
  };
}

/** An error from a session endpoint, carrying its HTTP status and the API's detail. */
export class SessionError extends Error {
  readonly status: number;
  /** The JSON:API error `code`, when the API gave one. */
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'SessionError';
    this.status = status;
    this.code = code;
  }
}

/** The API's code for a sign-in refused because the account's email is not verified. */
export const EMAIL_NOT_VERIFIED = 'email-not-verified';

async function sessionError(response: Response): Promise<SessionError> {
  let detail = '';
  let code: string | undefined;
  try {
    const body = await response.json() as { errors?: Array<{ detail?: string; code?: string }> };
    detail = body.errors?.[0]?.detail ?? '';
    code = body.errors?.[0]?.code;
  } catch {
    // Not a JSON:API document; the status says enough.
  }
  return new SessionError(detail || `HTTP ${response.status}`, response.status, code);
}

/**
 * The browser's session, or null when it has none. Anything other than a definite answer (a
 * network error, a 5xx) throws, so a blip is retried rather than taken for a sign-out.
 */
export async function fetchSession(): Promise<SessionProfile | null> {
  const response = await fetch(`${authProxyBase}/session`, { credentials: 'include', headers: csrfHeaders });
  if (response.status === 401) return null;
  if (!response.ok) throw await sessionError(response);
  return profileFrom(await response.json() as SessionDocument);
}

/** Turns the code and state from the sign-in redirect into a session. */
export async function redeemSignIn(code: string, state: string): Promise<SessionProfile> {
  const response = await fetch(`${authProxyBase}/session`, {
    method: 'POST',
    credentials: 'include',
    headers: { ...csrfHeaders, 'Content-Type': 'application/vnd.api+json' },
    body: JSON.stringify({ data: { type: 'sessions', attributes: { code, state } } }),
  });
  if (!response.ok) throw await sessionError(response);
  return profileFrom(await response.json() as SessionDocument);
}

/** Tells the API the person used the page, which extends the session's idle limit. */
export async function touchSession(): Promise<void> {
  const response = await fetch(`${authProxyBase}/session/touch`, { method: 'POST', credentials: 'include', headers: csrfHeaders });
  if (response.status === 401) reportAuthenticationRequired();
}

/** Where the browser posts to sign out. */
export const signOutUrl = `${authProxyBase}/session/end`;

/**
 * Signs the browser out: a top-level form POST, not a fetch, so the API can end the session, clear
 * the cookie and send the browser on through Zitadel's end_session. A form POST carries the page's
 * Origin, which the API checks, so no other page can sign the browser out with a link.
 */
export function signOut(): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = signOutUrl;
  form.style.display = 'none';
  document.body.appendChild(form);
  form.submit();
}

// --- Upgrade from the token-in-browser releases ---

/**
 * The keys the token-era SPA left in the browser: the tokens themselves, the PKCE and OIDC
 * randoms of a sign-in in progress, and the client-id marker. None of them means anything now.
 */
export const TOKEN_ERA_SESSION_KEYS = [
  'zitadel_access_token',
  'zitadel_id_token',
  'zitadel_refresh_token',
  'zitadel_token_expires_at',
  'zitadel_code_verifier',
  'zitadel_oidc_state',
  'zitadel_oidc_nonce',
  'zitadel_oidc_max_age',
];
export const TOKEN_ERA_LOCAL_KEYS = ['zitadel_client_id'];

/**
 * Deletes every token-era key and reports whether a signed-in token-era browser was found (it
 * held an access or refresh token), which is when sign-in starts on its own so the person lands
 * back where they were.
 */
export function sweepTokenEraStorage(): boolean {
  let signedIn = false;
  try {
    signedIn = sessionStorage.getItem('zitadel_access_token') !== null || sessionStorage.getItem('zitadel_refresh_token') !== null;
    for (const key of TOKEN_ERA_SESSION_KEYS) sessionStorage.removeItem(key);
    for (const key of TOKEN_ERA_LOCAL_KEYS) localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable (private windows, blocked site data); nothing to sweep then.
  }
  return signedIn;
}

// --- The signal that the session is gone ---

type Listener = () => void;
const listeners = new Set<Listener>();

/** Calls listener whenever a request finds the browser has no usable session. */
export function onAuthenticationRequired(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Reports that a request was refused because the browser has no usable session. */
export function reportAuthenticationRequired(): void {
  for (const listener of [...listeners]) listener();
}

/**
 * Reads a 401's JSON:API error document and reports whether it came from the API's
 * authentication layer. Only that ends the client-side session; a 401 passed through from a
 * registry or a VCS provider does not.
 */
export function isAuthenticationRequired(body: unknown): boolean {
  const errors = (body as { errors?: Array<{ code?: unknown }> } | null)?.errors;
  return Array.isArray(errors) && errors.some((e) => e?.code === AUTHENTICATION_REQUIRED);
}
