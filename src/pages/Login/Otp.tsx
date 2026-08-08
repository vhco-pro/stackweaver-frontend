// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useRef, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { updateSession, finalizeAuthRequest } from '@/api/auth-client';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useCodePaste } from '@/hooks/useCodePaste';
import LoginLayout from './LoginLayout';
import ReturnCodePanel from './ReturnCodePanel';
import { GradientButton } from './GradientButton';
import { toFriendlyError } from '@/lib/auth-errors';

/**
 * Single OTP page handling TOTP / Email / SMS via :method route param.
 *
 * For TOTP: user already has the code from their authenticator app - just show the input.
 * For Email/SMS: must first trigger a challenge via updateSession to make Zitadel send the code,
 * then show the input for the user to enter the received code.
 */
export default function Otp() {
  const { method } = useParams<{ method: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authRequestId = searchParams.get('authRequest') ?? '';
  const sessionId = searchParams.get('sessionId') ?? '';

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [challengeSent, setChallengeSent] = useState(method === 'totp'); // TOTP doesn't need challenge
  const [returnedCode, setReturnedCode] = useState(''); // For return_code mode

  const isTotp = method === 'totp';
  const methodLabel = isTotp ? 'authenticator app' : method === 'email' ? 'email' : 'SMS';

  // For Email/SMS OTP: trigger the challenge on mount to send the code
  useMountEffect(() => {
    if (isTotp || !sessionId) return; // TOTP doesn't need a challenge trigger

    let cancelled = false;
    const triggerChallenge = async () => {
      try {
        const challengeKey = method === 'email' ? 'otpEmail' : 'otpSms';
        // Zitadel v4 changed the OTP challenge oneof shape: `returnCode`
        // is no longer a boolean, it's an empty message (`{}`). v3 and
        // earlier accepted `returnCode: true` - sending that to v4 now
        // produces `proto: syntax error (line 1:NN): unexpected token true`.
        // Caught Wave 14 (2026-05-11) when wiring up F16 email-OTP.
        // The proxy strips this field in `email` notification mode so
        // Zitadel sends via SMTP; in `return_code` mode it forwards as-is.
        const resp = await updateSession(sessionId, {
          challenges: {
            [challengeKey]: { returnCode: {} },
          },
        });

        if (cancelled) return;

        // In return_code mode, Zitadel returns the code in the response
        const challenges = resp.challenges as Record<string, string> | undefined;
        if (challenges) {
          const codeValue = challenges[challengeKey === 'otpEmail' ? 'otpEmail' : 'otpSms'];
          if (codeValue) setReturnedCode(codeValue);
        }

        setChallengeSent(true);
      } catch (err: unknown) {
        if (!cancelled) setError((err as Error).message || `Failed to send ${methodLabel} code`);
      }
    };
    void triggerChallenge();
    return () => { cancelled = true; };
  });

  // Guard against the paste-autosubmit path and the manual-click path both
  // racing for the same finalize call (e.g. user pastes AND clicks Verify).
  const submittingRef = useRef(false);

  const submitCode = async (raw: string) => {
    const codeValue = raw.trim();
    if (!codeValue) {
      setError('Please enter the verification code');
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError('');

    try {
      const checkKey = isTotp ? 'totp' : method === 'email' ? 'otpEmail' : 'otpSms';
      const updateResp = await updateSession(sessionId, {
        checks: {
          [checkKey]: { code: codeValue },
        },
      });

      if (authRequestId) {
        const finalizeResp = await finalizeAuthRequest({
          authRequestId,
          sessionId,
          sessionToken: updateResp.sessionToken,
        });
        window.location.href = finalizeResp.callbackUrl;
      } else {
        void navigate('/dashboard');
      }
    } catch (err: unknown) {
      setError(toFriendlyError(err, 'Invalid verification code'));
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitCode(code);
  };

  const handlePaste = useCodePaste((pasted) => {
    setCode(pasted);
    void submitCode(pasted);
  });

  return (
    <LoginLayout title="Verification code" subtitle={`Enter the code from your ${methodLabel}`}>
      {!challengeSent ? (
        <div className="space-y-4">
          {error ? (
            <>
              <p className="text-sm text-destructive text-center">{error}</p>
              <p className="text-sm text-muted-foreground text-center">
                Go back to <button type="button" className="underline" onClick={() => { void navigate(`/login/loginname?authRequest=${authRequestId}`); }}>sign in</button> and try again.
              </p>
            </>
          ) : (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Sending code to your {methodLabel}...</span>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          <ReturnCodePanel code={returnedCode} label="verification code" />

          <div className="space-y-2">
            <Label htmlFor="otp-code">Code</Label>
            <Input
              id="otp-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              // TOTP is always 6 digits (RFC 6238); Zitadel v4's
              // Email + SMS OTP defaults to 8 digits. Allow up to 8
              // and let Zitadel reject bad codes - capping at 6
              // silently truncated Wave 14's email-OTP flow because
              // `02171500` got pasted as `021715` and "code expired"
              // was the only signal back to the user.
              maxLength={isTotp ? 6 : 8}
              value={code}
              onChange={(e) => { setCode(e.target.value); }}
              onPaste={handlePaste}
              placeholder={isTotp ? '000000' : '00000000'}
              disabled={loading}
              className="text-center text-2xl tracking-widest"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <GradientButton type="submit" disabled={loading}>
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>
            ) : (
              'Verify'
            )}
          </GradientButton>
        </form>
      )}
    </LoginLayout>
  );
}
