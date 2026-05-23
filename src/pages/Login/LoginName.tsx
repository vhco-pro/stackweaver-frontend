// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { createSession, listIdpProviders, startIdP, getLoginSettings } from '@/api/auth-client';
import type { IdpProvider, LoginSettings } from '@/api/auth-client';
import { useMountEffect } from '@/hooks/useMountEffect';
import LoginLayout from './LoginLayout';
import { GradientButton } from './GradientButton';
import { toFriendlyError } from '@/lib/auth-errors';
import { getIdpIcon } from './idpIcons';

export default function LoginName() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authRequestId = searchParams.get('authRequest') ?? '';
  const loginHint = searchParams.get('loginHint') ?? '';
  // OIDC `prompt` parameter (D2 row 1-4). Honored at mount: `create` and
  // `select_account` redirect to a different SPA page; `login` suppresses
  // the loginHint auto-submit so the user always re-authenticates; `none`
  // renders an error since reaching this page means Zitadel didn't have a
  // live session to silent-renew with.
  const prompt = searchParams.get('prompt') ?? '';

  const [loginName, setLoginName] = useState(loginHint);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [idpProviders, setIdpProviders] = useState<IdpProvider[]>([]);
  const [idpLoading, setIdpLoading] = useState(false);
  const [settings, setSettings] = useState<LoginSettings | null>(null);
  const autoSubmittedRef = useRef(false);
  // Derived rather than state — `useMountEffect` doesn't re-run on
  // searchParams changes, so a state flag would stick after the
  // fall-through "Sign in" CTA navigates back without the prompt.
  const showPromptNoneError = prompt === 'none';

  // Fetch login settings and IdP providers on mount
  useMountEffect(() => {
    let cancelled = false;

    // Prompt-based routing happens before any settings fetch — the
    // destination pages do their own settings load, so don't waste a
    // round-trip here just to immediately navigate away.
    if (prompt === 'create') {
      const params = new URLSearchParams();
      if (authRequestId) params.set('authRequest', authRequestId);
      if (loginHint) params.set('loginHint', loginHint);
      void navigate(`/login/register${params.toString() ? `?${params.toString()}` : ''}`, { replace: true });
      return () => { cancelled = true; };
    }
    if (prompt === 'select_account') {
      const params = new URLSearchParams();
      if (authRequestId) params.set('authRequest', authRequestId);
      void navigate(`/login/accounts${params.toString() ? `?${params.toString()}` : ''}`, { replace: true });
      return () => { cancelled = true; };
    }
    if (prompt === 'none') {
      // Zitadel only redirects to the login UI for `prompt=none` when it
      // can't silent-renew (no session, expired, MFA required, etc.).
      // The failure UI is rendered directly from the URL (`prompt === 'none'`)
      // so a fall-through navigation back to /login/loginname without the
      // prompt re-renders the form. Skip settings/IdP fetches here because
      // we never render the form on this branch.
      return () => { cancelled = true; };
    }

    const init = async () => {
      // Fetch settings and providers in parallel
      const [settingsResult, providersResult] = await Promise.allSettled([
        getLoginSettings(),
        listIdpProviders(),
      ]);

      if (cancelled) return;

      if (settingsResult.status === 'fulfilled') {
        setSettings(settingsResult.value);
      }
      if (providersResult.status === 'fulfilled') {
        setIdpProviders(providersResult.value.result ?? []);
      }

      // Auto-submit if login_hint is provided (AC-27).
      // `prompt=login` suppresses the auto-submit even when loginHint is
      // present — the OIDC spec requires re-authentication and silently
      // walking past the loginname step would defeat that intent.
      if (loginHint && !autoSubmittedRef.current && prompt !== 'login') {
        autoSubmittedRef.current = true;
        await doSubmit(loginHint, settingsResult.status === 'fulfilled' ? settingsResult.value : null);
      }
    };

    void init();
    return () => { cancelled = true; };
  });

  const doSubmit = async (name: string, currentSettings: LoginSettings | null) => {
    if (loading) return; // Guard against double-submit race
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your username or email');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const createResp = await createSession({
        checks: {
          user: { loginName: trimmed },
        },
      });

      // Navigate to password page with session context
      const params = new URLSearchParams({
        authRequest: authRequestId,
        sessionId: createResp.sessionId,
        loginName: trimmed,
      });
      void navigate(`/login/password?${params.toString()}`);
    } catch (err: unknown) {
      const authErr = err as Error & { code?: number };

      // AC-35: Anti-enumeration — when ignoreUnknownUsernames is enabled,
      // route to password page regardless of whether the user exists.
      // This prevents attackers from distinguishing valid vs invalid usernames.
      const ignoreUnknown = currentSettings?.ignoreUnknownUsernames ?? settings?.ignoreUnknownUsernames;
      if (ignoreUnknown && (authErr.code === 404 || authErr.code === 400)) {
        const params = new URLSearchParams({
          authRequest: authRequestId,
          loginName: trimmed,
        });
        void navigate(`/login/password?${params.toString()}`);
        return;
      }

      // User not found and anti-enumeration is off — show error
      if (authErr.code === 404) {
        setError('User not found');
      } else if (authErr.message && /User\.NotActive|SESSION-Gj4ko/i.test(authErr.message)) {
        // Zitadel returns `Errors.User.NotActive (SESSION-Gj4ko)` for locked
        // and disabled users. The raw error is meaningless to end users —
        // friendly-map to a generic blocked-account message. Same shape
        // covers locked and disabled because the createSession path doesn't
        // distinguish them.
        setError('This account is locked or has been disabled. Contact your administrator.');
      } else {
        // Round 26 Wave 10 (Wave 7 gap): friendly-error mapping —
        // raw `authErr.message` would leak Zitadel internal-code
        // shapes (`COMMAND-…`, `INSTANCE-…`) into the SPA banner.
        setError(toFriendlyError(err, 'An error occurred. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await doSubmit(loginName, settings);
  };

  const handleIdpLogin = async (provider: IdpProvider) => {
    setIdpLoading(true);
    setError('');
    try {
      // Store auth request ID so IdpProcess can retrieve it after the redirect
      if (authRequestId) {
        sessionStorage.setItem('pending_auth_request', authRequestId);
      }
      const result = await startIdP(provider.id);
      window.location.assign(result.authUrl);
    } catch (err: unknown) {
      setError(toFriendlyError(err, 'Failed to start identity provider login'));
      setIdpLoading(false);
    }
  };

  // Determine what to show based on login settings
  const showRegister = settings?.allowRegister !== false;
  const showPasswordReset = settings?.hidePasswordReset !== true;

  // `prompt=none` reached the SPA — Zitadel couldn't silent-renew. Render
  // the failure mode rather than the form. The `Sign in` action drops the
  // prompt and falls through to the normal flow on the same auth request.
  if (showPromptNoneError) {
    const retryParams = new URLSearchParams();
    if (authRequestId) retryParams.set('authRequest', authRequestId);
    if (loginHint) retryParams.set('loginHint', loginHint);
    return (
      <LoginLayout title="Sign-in required" subtitle="No active session was found for silent sign-in">
        <p className="text-sm text-muted-foreground" data-testid="prompt-none-error">
          The identity provider requested a silent sign-in (<code>prompt=none</code>),
          but no active session is available.
        </p>
        <GradientButton
          type="button"
          onClick={() => { void navigate(`/login/loginname${retryParams.toString() ? `?${retryParams.toString()}` : ''}`, { replace: true }); }}
        >
          Sign in
        </GradientButton>
      </LoginLayout>
    );
  }

  return (
    <LoginLayout title="Sign in" subtitle="Enter your username or email to continue">
      <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="loginName">Username or Email</Label>
          <Input
            id="loginName"
            name="loginName"
            type="text"
            autoComplete="username"
            autoFocus
            value={loginName}
            onChange={(e) => { setLoginName(e.target.value); }}
            placeholder="user@example.com"
            disabled={loading}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <GradientButton type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            'Continue'
          )}
        </GradientButton>

        <div className="flex justify-between text-sm">
          {showRegister && (
            <Button
              variant="link"
              className="p-0 h-auto text-muted-foreground"
              onClick={() => { void navigate(`/login/register?authRequest=${authRequestId}`); }}
            >
              Create account
            </Button>
          )}
          {showPasswordReset && (
            <Button
              variant="link"
              className="p-0 h-auto text-muted-foreground"
              onClick={() => { void navigate(`/login/password-reset?authRequest=${authRequestId}`); }}
            >
              Forgot password?
            </Button>
          )}
        </div>
      </form>

      {idpProviders.length > 0 && (
        <>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <div className="space-y-2">
            {idpProviders.map((provider) => {
              const Icon = getIdpIcon(provider.type, provider.name);
              return (
                <Button
                  key={provider.id}
                  variant="outline"
                  className="w-full justify-start gap-3"
                  disabled={idpLoading}
                  onClick={() => { void handleIdpLogin(provider); }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{provider.name}</span>
                </Button>
              );
            })}
          </div>
        </>
      )}
    </LoginLayout>
  );
}
