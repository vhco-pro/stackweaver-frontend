// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { completeIdP, createSession, finalizeAuthRequest, getLoginSettings, createUser } from '@/api/auth-client';
import { useMountEffect } from '@/hooks/useMountEffect';
import LoginLayout from './LoginLayout';
import { toFriendlyError } from '@/lib/auth-errors';

interface IdpRawUser {
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  sub?: string;
}

// Zitadel v4's `idp_intents/{id}` response. `rawInformation` is the OIDC
// id-token claims flat (NOT wrapped under `.User` — that wrapping only
// applies to SAML IdPs, kept here as a fallback). `addHumanUser` is
// Zitadel's pre-shaped suggestion for the auto-register path: profile +
// email + idpLinks ready to POST to `/v2/users/human` — surfaces only when
// the IdP has `autoRegister: true` AND no matching existing user is found,
// so its presence is itself the signal to take the auto-register branch.
interface IdpAddHumanUserSuggestion {
  profile?: { givenName?: string; familyName?: string; displayName?: string; preferredLanguage?: string };
  email?: { email?: string; isVerified?: boolean };
  idpLinks?: { idpId: string; userId: string; userName?: string }[];
}

interface IdpIntentResult {
  // Top-level `userId` is the Zitadel internal user ID — set ONLY when
  // the IdP login resolved to a pre-existing local user (linked or
  // auto-linked by email). Use this for the Branch 1 createSession
  // check, NOT `idpInformation.userId` (which is the IDP-side sub
  // claim regardless of link status). Verified empirically against
  // Zitadel v4 + a linked user 2026-05-10 (Wave 14 fix).
  userId?: string;
  idpInformation?: {
    oauth?: { accessToken?: string; idToken?: string };
    idpId?: string;
    // IDP-side identifier (the OIDC `sub` for OIDC IdPs). NEVER a
    // Zitadel snowflake — feeding this into createSession blows up
    // with 404 because Zitadel can't resolve it. Kept for diagnostics
    // / linking only; the Branch 1 path uses the top-level `userId`.
    userId?: string;
    userName?: string;
    rawInformation?: IdpRawUser & { User?: IdpRawUser };
  };
  addHumanUser?: IdpAddHumanUserSuggestion;
}

/**
 * IdP intent handler — consumes the single-use token from the IdP callback.
 *
 * Implements the full 6-branch handler chain per plan D4:
 * 1. User exists and is linked → create session with idpIntent check
 * 2. Auto-linking enabled + email match → auto-link to existing user
 * 3. Auto-registration enabled → create user with idpLinks
 * 4. Manual creation → show pre-filled registration form
 * 5. No user found → account-not-found page
 * 6. Error → failure page
 *
 * CRITICAL: The IdP intent token is SINGLE-USE. Guards against re-render re-call
 * via consumedRef. Strips query params via history.replaceState on mount.
 */
export default function IdpProcess() {
  const { provider } = useParams<{ provider: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const intentId = searchParams.get('id') ?? '';
  const token = searchParams.get('token') ?? '';
  // Round 25 Wave 7 (item 11 / R24-10): the previous implementation
  // also read `?user=<id>` from the URL and fed it directly into
  // `createSession({checks:{user:{userId}}})`. Zitadel-side enforces
  // "intent must match user" so the attack (craft `?user=<victim>`)
  // is gated by Zitadel's check, but the SPA blindly trusting a query
  // param is fragile defense-in-depth. We now resolve userId server-
  // side from the `completeIdP` response (`idpInformation.userId`)
  // which the proxy already returns. The query param is no longer
  // consumed.

  const [error, setError] = useState('');
  const consumedRef = useRef(false);

  useMountEffect(() => {
    // Strip sensitive params from URL immediately (Referer leak prevention)
    window.history.replaceState({}, '', window.location.pathname);

    if (consumedRef.current) return;
    consumedRef.current = true;

    if (!intentId || !token) {
      setError('Missing identity provider parameters');
      return;
    }

    const providerName = provider ?? 'unknown';

    // Zitadel's projection (the read-model behind `userId` lookups) lags
    // behind a fresh `createUser` write by a few hundred ms under load —
    // empirically up to ~1s during a full Playwright suite run when
    // projection workers are saturated. Branch 3 / Branch 4 below do a
    // `createSession({user: {userId: <just-created-id>}})` microseconds
    // after `createUser` returns, so they race the projection and get
    // a 404 ("User could not be found"). Retry on 404 with exponential
    // backoff. Caught Wave 14 root-causing F3's flake (see
    // custom-login-ui-plan.md Wave 14 note).
    const createSessionWithProjectionRetry = async (
      body: Parameters<typeof createSession>[0],
      maxAttempts = 4,
    ): Promise<Awaited<ReturnType<typeof createSession>>> => {
      let attempt = 0;
      let lastErr: unknown;
      while (attempt < maxAttempts) {
        try {
          return await createSession(body);
        } catch (err) {
          const code = (err as Error & { code?: number }).code;
          // 404 = "User could not be found" — the projection-lag case.
          // Anything else is a real error; rethrow immediately.
          if (code !== 404) throw err;
          lastErr = err;
          // Backoff: 150ms, 300ms, 600ms — total ~1s budget across 4 tries.
          await new Promise((r) => setTimeout(r, 150 * Math.pow(2, attempt)));
          attempt++;
        }
      }
      throw lastErr;
    };

    const finalizeAndRedirect = async (sessionId: string, sessionToken: string, authReqId: string) => {
      if (authReqId) {
        const resp = await finalizeAuthRequest({ authRequestId: authReqId, sessionId, sessionToken });
        sessionStorage.removeItem('pending_auth_request');
        window.location.href = resp.callbackUrl;
      } else {
        sessionStorage.removeItem('pending_auth_request');
        void navigate('/dashboard');
      }
    };

    const process = async () => {
      try {
        // Consume the single-use IdP intent token
        const intentResult = await completeIdP(intentId, token) as IdpIntentResult;
        const settings = await getLoginSettings();
        const authRequestId = sessionStorage.getItem('pending_auth_request') ?? '';

        const idpInfo = intentResult.idpInformation;
        // OIDC: claims flat on rawInformation. SAML wraps under .User.
        // Take whichever has data so the same code path covers both.
        const rawUser: IdpRawUser | undefined =
          idpInfo?.rawInformation?.User ?? idpInfo?.rawInformation;

        // Branch 1: User ID resolved server-side → user exists and
        // is linked. Round 25 Wave 7 (item 11 / R24-10): the userId
        // comes from the proxy's completeIdP response (Zitadel-
        // validated), NOT from the browser URL.
        //
        // Wave 14 (2026-05-10): the FIELD changed. For linked users
        // Zitadel v4 sets the Zitadel-internal user ID at the top
        // level of the intentResult (`intentResult.userId`) and
        // simultaneously sets `idpInformation.userId` to the IDP-side
        // sub claim (e.g. the OIDC `sub`). The original code read
        // `idpInformation.userId` and crashed Branch 1 with 404
        // because Zitadel can't resolve the IDP sub via
        // `createSession({checks:{user:{userId}}})`. Read the
        // top-level field instead. For unlinked users the top-level
        // `userId` is unset → resolvedUserId empty → Branch 1 skipped
        // → fall through to Branch 2 / 3 / 4 / 5.
        const resolvedUserId = intentResult.userId ?? '';
        if (resolvedUserId) {
          const sessionResp = await createSession({
            checks: {
              user: { userId: resolvedUserId },
              idpIntent: { idpIntentId: intentId, idpIntentToken: token },
            },
          });
          await finalizeAndRedirect(sessionResp.sessionId, sessionResp.sessionToken, authRequestId);
          return;
        }

        // Branch 2: try logging in by email + idpIntent BEFORE attempting
        // auto-create. This single path covers two distinct Zitadel
        // outcomes — there's no SPA-side flag that distinguishes them so
        // we just try and fall through on failure:
        //
        //   (a) User already exists AND has an IdP link to this sub
        //       (F11 territory). Zitadel finds them via the idpIntent
        //       check, session created, done.
        //   (b) User already exists (email match) but is unlinked, AND
        //       the IdP has `autoLinking: AUTO_LINKING_OPTION_EMAIL`
        //       (F12 territory). Zitadel's idpIntent check auto-creates
        //       the link as a side-effect, session created, done.
        //
        // The previous gate (`settings.allowAutoLinking`) was a dead
        // branch — Zitadel's `LoginSettings` proto doesn't surface that
        // field, so the condition was always false and (b) was
        // unreachable. (a) was previously stumbling through Branch 3's
        // createUser path, which happens to upsert when idpLinks point
        // at an existing user — but for case (b) Branch 3 created a
        // *duplicate* user with the same email (caught by F12's
        // sub-comparison assertion). This change makes both cases
        // first-class and keeps F3 (no email match) working via the
        // catch-fall-through.
        if (rawUser?.email) {
          try {
            const sessionResp = await createSession({
              checks: {
                user: { loginName: rawUser.email },
                idpIntent: { idpIntentId: intentId, idpIntentToken: token },
              },
            });
            await finalizeAndRedirect(sessionResp.sessionId, sessionResp.sessionToken, authRequestId);
            return;
          } catch {
            // No matching user, or auto-link refused — fall through to
            // Branch 3 (auto-create with addHumanUser pre-shape).
          }
        }

        // Branch 3: Auto-creation. Triggered by either (a) Zitadel's
        // pre-shaped `addHumanUser` block (set when the IdP has
        // `autoRegister: true` and the IdP-side claims carry enough to
        // create a user — so its presence IS the signal), or (b) the SPA-
        // level `settings.autoRegister` fallback for IdPs that don't
        // pre-shape. Prefer (a) because it carries the idpLinks Zitadel
        // wants — using SPA-rebuilt links risks shape mismatches.
        const suggestion = intentResult.addHumanUser;
        if (suggestion) {
          try {
            // Zitadel's IDPLink.userName is required (1-200 runes) but
            // omitted from the pre-shape on some IdP types. Fall back to
            // the rawInformation `name`/`email` on each link without one.
            const idpLinks = (suggestion.idpLinks ?? []).map((link) => ({
              ...link,
              userName: link.userName && link.userName.length > 0
                ? link.userName
                : rawUser?.name ?? rawUser?.email ?? link.userId,
            }));
            const userResult = await createUser({
              profile: {
                givenName: suggestion.profile?.givenName ?? '',
                familyName: suggestion.profile?.familyName ?? '',
              },
              email: {
                email: suggestion.email?.email ?? '',
                isVerified: suggestion.email?.isVerified ?? false,
              },
              idpLinks,
            }) as { userId?: string };

            if (!userResult.userId) throw new Error('User creation returned no ID');

            const sessionResp = await createSessionWithProjectionRetry({
              checks: {
                user: { userId: userResult.userId },
                idpIntent: { idpIntentId: intentId, idpIntentToken: token },
              },
            });
            await finalizeAndRedirect(sessionResp.sessionId, sessionResp.sessionToken, authRequestId);
            return;
          } catch {
            void navigate(`/login/idp/${providerName}/registration-failed`);
            return;
          }
        }

        if (settings.autoRegister && rawUser) {
          try {
            const userResult = await createUser({
              profile: {
                givenName: rawUser.given_name ?? rawUser.name ?? '',
                familyName: rawUser.family_name ?? '',
              },
              email: {
                email: rawUser.email ?? '',
                isVerified: rawUser.email_verified ?? false,
              },
              idpLinks: [{
                idpId: idpInfo?.idpId ?? '',
                userId: rawUser.sub ?? '',
                userName: rawUser.name ?? rawUser.email ?? '',
              }],
            }) as { userId?: string };

            if (!userResult.userId) throw new Error('User creation returned no ID');

            const sessionResp = await createSessionWithProjectionRetry({
              checks: {
                user: { userId: userResult.userId },
                idpIntent: { idpIntentId: intentId, idpIntentToken: token },
              },
            });
            await finalizeAndRedirect(sessionResp.sessionId, sessionResp.sessionToken, authRequestId);
            return;
          } catch {
            void navigate(`/login/idp/${providerName}/registration-failed`);
            return;
          }
        }

        // Branch 4: Manual creation — show pre-filled registration form
        if (rawUser?.email) {
          const params = new URLSearchParams({
            email: rawUser.email ?? '',
            firstName: rawUser.given_name ?? '',
            lastName: rawUser.family_name ?? '',
          });
          void navigate(`/login/idp/${providerName}/complete-registration?${params.toString()}`);
          return;
        }

        // Branch 5: No user found and no data to create from
        void navigate(`/login/idp/${providerName}/account-not-found`);
      } catch (err: unknown) {
        setError(toFriendlyError(err, 'Identity provider login failed'));
      }
    };

    void process();
  });

  if (error) {
    return (
      <LoginLayout title="Login failed">
        <p className="text-sm text-destructive text-center">{error}</p>
      </LoginLayout>
    );
  }

  return (
    <LoginLayout title="Signing in...">
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </LoginLayout>
  );
}
