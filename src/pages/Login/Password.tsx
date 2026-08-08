// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { createSession, updateSession, finalizeAuthRequest, getSession, getLoginSettings, getUserAuthMethods, getUser } from '@/api/auth-client';
import { toFriendlyError } from '@/lib/auth-errors';
import LoginLayout from './LoginLayout';
import { GradientButton } from './GradientButton';

/**
 * Checks session factors + login settings to determine if any forced flow
 * must be completed before finalizing the auth request (D7).
 *
 * Returns a redirect path if a forced flow is needed, or null if the
 * session can be finalized immediately.
 */
async function checkForcedFlows(
  sessionId: string,
  authRequestId: string,
  sessionToken?: string,
): Promise<string | null> {
  // Fetch session first so we can resolve the user's org and ask Zitadel
  // for the org-scoped login policy. Without org scoping, the SPA reads
  // the instance default - orgs with stricter overrides (forceMfa,
  // allowRegister=false, etc.) would be silently bypassed.
  const sessionData = await getSession(sessionId);
  const session = sessionData as {
    session?: {
      factors?: Record<string, unknown> & {
        user?: { id?: string; organizationId?: string };
      };
    };
  };
  const factors = session?.session?.factors ?? {};
  const userFactor = factors.user;
  const userId = userFactor?.id ?? '';
  const orgId = userFactor?.organizationId ?? '';

  const settings = await getLoginSettings(orgId || undefined);
  const params = `authRequest=${authRequestId}&sessionId=${sessionId}`;
  const userParams = `${params}&userId=${userId}`;

  // Check 1: Password change required (F19)
  //
  // Zitadel does NOT include this signal in the session response - the
  // GET /v2/sessions/{id} factors object exposes only verifiedAt
  // timestamps, not the user's `passwordChangeRequired` flag. The
  // flag lives on the user record itself: GET /v2/users/{id} →
  // `user.human.passwordChangeRequired`. The proxy exposes that via
  // `GET /auth/users/:id`, gated by the Round 17 cross-user check
  // (you can only read your own record), so this self-read is safe.
  //
  // We check this FIRST - before MFA / authenticator routing - so a
  // user with both forced rotation AND no MFA enrolled lands on the
  // password-change page rather than getting kicked into MFA setup
  // with a stale password they're about to rotate. Zitadel's hosted
  // login UI orders the same way.
  //
  // The fetch is best-effort: a transient failure here would block
  // login entirely, so on error we fall through to the rest of
  // checkForcedFlows. The worst case of an under-prompt is the user
  // sees Zitadel reject finalize with a clear error; over-prompt
  // (forced rotation when not actually required) requires an
  // affirmative true from the proxy - much harder to fake.
  if (userId) {
    try {
      const userRecord = await getUser(userId);
      if (userRecord.user?.human?.passwordChangeRequired) {
        const tokenParam = sessionToken ? `&sessionToken=${encodeURIComponent(sessionToken)}` : '';
        return `/login/password/change?${userParams}${tokenParam}`;
      }

      // Check 1b: Email verification required (D7 row, AC-53).
      //
      // If the user record has an email and Zitadel says it's not
      // verified, gate finalize on verify-email completion. This is
      // a sibling check to F19 - same `getUser` round-trip, same
      // skip-on-error contract. Routes to `/login/verify?forced=true`
      // so Verify.tsx knows to re-finalize the auth request after
      // the code is submitted (vs the default registration flow
      // which bounces through /login/verify/success → /login/loginname).
      //
      // We DON'T trigger a re-send here - the user already received
      // their verification code via Zitadel's onboarding email
      // (`EMAIL_VERIFICATION=true` mode) and is just being prompted
      // to actually enter it before further access. A re-send button
      // on /login/verify can be added later if operators ask.
      const human = userRecord.user?.human;
      const email = human?.email?.email ?? '';
      // Zitadel omits `isVerified` from the response when false - only
      // includes the field when true (proto3 default-elision). Treating
      // absence as "verified" silently disables the gate, so the
      // default must be `false` to match the wire encoding.
      const isVerified = human?.email?.isVerified === true;
      if (email && !isVerified) {
        const emailParam = encodeURIComponent(email);
        const tokenParam = sessionToken ? `&sessionToken=${encodeURIComponent(sessionToken)}` : '';
        return `/login/verify?${userParams}&email=${emailParam}&forced=true${tokenParam}`;
      }
    } catch {
      // Swallow - see comment above. Honest users with a working
      // proxy never hit this branch; the failure mode is transient.
    }
  }

  // Check 2: MFA required but not satisfied. Two routes share this branch:
  //
  //   (a) Org policy enforces MFA (`forceMfa`) AND the user has none enrolled
  //       → /login/mfa/set?force=true to walk them through enrollment.
  //   (b) The user has at least one second-factor enrolled (regardless of
  //       org policy) → prompt for the factor they have. Skipping this when
  //       policy doesn't enforce MFA but the user has TOTP would silently
  //       finalize with only password verified - the user's stated MFA
  //       preference would never gate login. Found via F4 against a
  //       tunnel-deployed stack.
  //
  // The factor-enrollment lookup is gated on having a userId (which we
  // always do post-loginname; createSession surfaces it on the session) so
  // we don't issue a needless round-trip on the rare error path where the
  // session lacks a user factor.
  const hasPassword = !!factors.password;
  const hasTotp = !!factors.totp;
  const hasWebAuthN = !!factors.webAuthN;
  const hasOtpSms = !!factors.otpSms;
  const hasOtpEmail = !!factors.otpEmail;
  const hasSecondFactor = hasTotp || hasWebAuthN || hasOtpSms || hasOtpEmail;

  if (hasPassword && !hasSecondFactor && userId) {
    let enrolledMethods: string[] = [];
    try {
      const auth = await getUserAuthMethods(userId);
      enrolledMethods = auth.authMethodTypes ?? [];
    } catch {
      // Auth-methods lookup failed - fall through to the policy gate below
      // so we still honor `forceMfa: true` even if the per-user check is
      // unavailable. Better to over-prompt for MFA than under-prompt.
    }

    const hasEnrolledTotp = enrolledMethods.includes('AUTHENTICATION_METHOD_TYPE_TOTP');
    const hasEnrolledPasskey = enrolledMethods.includes('AUTHENTICATION_METHOD_TYPE_PASSKEY');
    const hasEnrolledU2F = enrolledMethods.includes('AUTHENTICATION_METHOD_TYPE_U2F');
    const hasEnrolledOtpEmail = enrolledMethods.includes('AUTHENTICATION_METHOD_TYPE_OTP_EMAIL');
    const hasEnrolledOtpSms = enrolledMethods.includes('AUTHENTICATION_METHOD_TYPE_OTP_SMS');
    const enrolledCount =
      Number(hasEnrolledTotp) +
      Number(hasEnrolledPasskey) +
      Number(hasEnrolledU2F) +
      Number(hasEnrolledOtpEmail) +
      Number(hasEnrolledOtpSms);

    if (enrolledCount > 1) {
      // Multiple factors - let the user pick which one to use this session.
      return `/login/mfa?${userParams}`;
    }
    if (hasEnrolledTotp) return `/login/otp/totp?${params}`;
    if (hasEnrolledPasskey) return `/login/passkey?${params}`;
    if (hasEnrolledU2F) return `/login/u2f?${params}`;
    if (hasEnrolledOtpEmail) return `/login/otp/email?${params}`;
    if (hasEnrolledOtpSms) return `/login/otp/sms?${params}`;

    // No enrolled second factor - only force enrollment when policy
    // requires MFA. Without policy enforcement, allow finalize on
    // password alone (matches pre-fix behavior).
    if (settings.forceMfa || settings.forceMfaLocalOnly) {
      return `/login/mfa/set?${userParams}&force=true`;
    }
  }

  return null;
}

export default function Password() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authRequestId = searchParams.get('authRequest') ?? '';
  const sessionId = searchParams.get('sessionId') ?? '';
  const loginName = searchParams.get('loginName') ?? '';

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let currentSessionId = sessionId;

      // If we don't have a session yet (anti-enumeration route), create one now
      if (!currentSessionId) {
        const createResp = await createSession({
          checks: {
            user: { loginName },
          },
        });
        currentSessionId = createResp.sessionId;
      }

      // Update session with password check
      const updateResp = await updateSession(currentSessionId, {
        checks: {
          password: { password },
        },
      });

      // C18 + F19: Check forced flows before finalizing.
      // Pass the freshly-rotated sessionToken so the password-change
      // page (F19) can re-finalize without re-asking for the password.
      const forcedRedirect = await checkForcedFlows(currentSessionId, authRequestId, updateResp.sessionToken);
      if (forcedRedirect) {
        void navigate(forcedRedirect);
        return;
      }

      // All checks passed - finalize the auth request
      if (authRequestId) {
        const finalizeResp = await finalizeAuthRequest({
          authRequestId,
          sessionId: currentSessionId,
          sessionToken: updateResp.sessionToken,
        });

        window.location.href = finalizeResp.callbackUrl;
      } else {
        void navigate('/dashboard');
      }
    } catch (err: unknown) {
      const authErr = err as Error & { code?: number };
      // Wrong-password / wrong-loginName: the proxy normalises both real
      // and decoy rejections to gRPC code 7 (FailedPrecondition) with
      // the canonical message "Password is invalid (COMMAND-…)" - see
      // `buildDecoyPasswordInvalidResponse` in auth_proxy.go and the
      // F-sec-7 anti-enumeration contract. Match by message regex
      // rather than HTTP status because the SPA receives Zitadel's
      // gRPC code in the body, not the HTTP code (which would be 400
      // or 401 depending on the Zitadel version). The original code
      // (`authErr.code === 400 || 401 || 403`) never fired against a
      // real proxy and Wave 14 found wrong-password silently fell
      // through to the generic "An error occurred" friendly-error.
      const isInvalidCredentials =
        /password is invalid|invalid credentials|invalid.*password/i.test(authErr.message ?? '') ||
        authErr.code === 400 || authErr.code === 401 || authErr.code === 403;
      if (isInvalidCredentials) {
        setError('Invalid username or password');
      } else {
        // Round 26 Wave 10 (Wave 7 gap): route through toFriendlyError
        // so Zitadel internal-code shapes (`COMMAND-3n77z`,
        // `INSTANCE-x6Gh3`, etc.) don't leak into the user-facing
        // banner. Wave 7's mass-replacement missed this file because
        // the type assertion `as Error & { code?: number }` differs
        // from the bare `as Error` pattern the sed targeted.
        setError(toFriendlyError(err, 'An error occurred. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginLayout title="Enter password" subtitle={loginName || undefined}>
      <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => { setPassword(e.target.value); }}
            placeholder="Enter your password"
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
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </GradientButton>

        <div className="flex justify-between text-sm">
          <Button
            variant="link"
            className="p-0 h-auto text-muted-foreground"
            onClick={() => { void navigate(`/login/loginname?authRequest=${authRequestId}`); }}
          >
            Use a different account
          </Button>
          <Button
            variant="link"
            className="p-0 h-auto text-muted-foreground"
            onClick={() => { void navigate(`/login/password-reset?authRequest=${authRequestId}`); }}
          >
            Forgot password?
          </Button>
        </div>
      </form>
    </LoginLayout>
  );
}
