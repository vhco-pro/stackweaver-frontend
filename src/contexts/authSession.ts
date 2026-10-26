// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// What AuthContext shares with the pages that take part in sign-in, kept out of the component file
// so fast refresh keeps working.

/** The React Query key of the browser session. */
export const SESSION_QUERY_KEY = ['auth', 'session'] as const;

/** The activity touch is sent at most this often, and only after the person used the page. */
export const TOUCH_INTERVAL_MS = 60 * 1000;

/** Where a person returns to after sign-in; Auth/Callback.tsx reads it. */
export const RETURN_URL_KEY = 'oauth_return_url';

/**
 * Starts a sign-in: the API stores the login transaction and names the login UI's auth request,
 * and the browser goes to the login UI with it.
 */
export async function startSignIn(): Promise<void> {
  try {
    const { authorize } = await import('@/api/auth-client');
    const response = await authorize();
    const loginParams = new URLSearchParams({ authRequest: response.authRequest });
    if (response.loginHint) loginParams.set('loginHint', response.loginHint);
    if (response.prompt) loginParams.set('prompt', response.prompt);
    window.location.href = `/login/loginname?${loginParams.toString()}`;
  } catch (error) {
    console.error('auth: starting sign-in failed', error instanceof Error ? error.name : typeof error);
    window.location.href = '/auth/login';
  }
}
