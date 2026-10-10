// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { completeIdP, createSession, finalizeAuthRequest, createUser } from '@/api/auth-client';
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
// id-token claims flat (NOT wrapped under `.User` - that wrapping only
// applies to SAML IdPs, kept here as a fallback). `addHumanUser` is
// Zitadel's pre-shaped suggestion for the auto-register path: profile +
// email + idpLinks ready to POST to `/v2/users/human` - surfaces only when
// the IdP has `autoRegister: true` AND no matching existing user is found,
// so its presence is itself the signal to take the auto-register branch.
interface IdpAddHumanUserSuggestion {
  profile?: { givenName?: string; familyName?: string; displayName?: string; preferredLanguage?: string };
  email?: { email?: string; isVerified?: boolean };
  idpLinks?: { idpId: string; userId: string; userName?: string }[];
}

interface IdpIntentResult {
  // Top-level `userId` is the Zitadel internal user ID - set ONLY when
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
    // Zitadel snowflake - feeding this into createSession blows up
    // with 404 because Zitadel can't resolve it. Kept for diagnostics
    // / linking only; the Branch 1 path uses the top-level `userId`.
    userId?: string;
    userName?: string;
    rawInformation?: IdpRawUser & { User?: IdpRawUser };
  };
  addHumanUser?: IdpAddHumanUserSuggestion;
}

// #598: the intent token is single-use, so its consumption is guarded per
// intentId at module scope rather than with a per-mount ref. A ref is reset by
// a remount, which re-fired completeIdP and let the losing call 400. Each
// entry holds the in-flight run, resolving to an error message or undefined;
// a remounted instance awaits the same run instead of consuming the token again.
const intentRuns = new Map<string, Promise<string | undefined>>();

/**
 * IdP intent handler - consumes the single-use token from the IdP callback.
 *
 * Implements the full 6-branch handler chain per plan D4:
 * 1. User exists and is linked → create session with idpIntent check
 * 2. Auto-linking enabled + email match → auto-link to existing user
 * 3. Auto-registration enabled → create user with idpLinks
 * 4. Manual creation → show pre-filled registration form
 * 5. No user found → account-not-found page
 * 6. Error → failure page
 *
 * CRITICAL: The IdP intent token is SINGLE-USE. Guards against re-render and
 * remount re-calls via the module-scoped intentRuns map. Strips query params via history.replaceState on mount.
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

  useMountEffect(() => {
    // Strip sensitive params from URL immediately (Referer leak prevention)
    window.history.replaceState({}, '', window.location.pathname);

    if (!intentId || !token) {
      setError('Missing identity provider parameters');
      return;
    }

    const providerName = provider ?? 'unknown';

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

    const process = async (): Promise<string | undefined> => {
      try {
        // Consume the single-use IdP intent token
        const intentResult = await completeIdP(intentId, token) as IdpIntentResult;
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
        // outcomes - there's no SPA-side flag that distinguishes them so
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
        // branch - Zitadel's `LoginSettings` proto doesn't surface that
        // field, so the condition was always false and (b) was
        // unreachable. (a) was previously stumbling through Branch 3's
        // createUser path, which happens to upsert when idpLinks point
        // at an existing user - but for case (b) Branch 3 created a
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
          } catch (err) {
            // No matching user, or auto-link refused - fall through to
            // Branch 3 (auto-create with addHumanUser pre-shape).
            console.debug('IdP auto-link attempt failed, falling through to auto-create:', err);
          }
        }

        // Branch 3: Auto-creation. Zitadel returns `addHumanUser` for every identity that is not
        // linked to a user yet. The SPA sends only the intent: the proxy redeems it with Zitadel and
        // builds the user from Zitadel's own suggestion (#829 D5), so nothing the browser sends can
        // change the email, the links or the org. The proxy answers 409 when the email already
        // belongs to an account, which must sign in with its password first (#829 Q13).
        if (intentResult.addHumanUser) {
          try {
            const userResult = await createUser({
              idpIntentId: intentId,
              idpIntentToken: token,
            }) as { userId?: string };

            if (!userResult.userId) throw new Error('User creation returned no ID');

            const sessionResp = await createSession({
              checks: {
                user: { userId: userResult.userId },
                idpIntent: { idpIntentId: intentId, idpIntentToken: token },
              },
            });
            await finalizeAndRedirect(sessionResp.sessionId, sessionResp.sessionToken, authRequestId);
            return;
          } catch (err) {
            if ((err as { code?: number }).code === 409) {
              return 'An account with this email already exists. Sign in with your password first.';
            }
            // Surface the cause: the redirect alone gives users (and bug
            // reports, and E2E traces) nothing to diagnose registration
            // failures with - the API error lands only here.
            console.error('IdP auto-registration failed:', err);
            void navigate(`/login/idp/${providerName}/registration-failed`);
            return;
          }
        }

        // Branch 5: No user found and no data to create from
        void navigate(`/login/idp/${providerName}/account-not-found`);
      } catch (err: unknown) {
        return toFriendlyError(err, 'Identity provider login failed');
      }
    };

    let run = intentRuns.get(intentId);
    if (!run) {
      run = process();
      intentRuns.set(intentId, run);
    }
    void run.then((message) => {
      if (message) setError(message);
    });
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
