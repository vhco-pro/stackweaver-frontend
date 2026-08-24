// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useRef, useState } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { config } from '@/config';
import { useCodePaste } from '@/hooks/useCodePaste';
import LoginLayout from './LoginLayout';
import { GradientButton } from '@/components/ui/gradient-button';
import { toFriendlyError } from '@/lib/auth-errors';

const AUTH_BASE = config.apiUrl.replace(/\/api\/v2\/?$/, '/auth');

/**
 * Register TOTP / enable Email OTP / enable SMS OTP.
 * Calls the actual Zitadel proxy endpoints for TOTP registration and verification.
 */
export default function OtpSet() {
  const { method } = useParams<{ method: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId') ?? '';
  const authRequestId = searchParams.get('authRequest') ?? '';
  const sessionId = searchParams.get('sessionId') ?? '';

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [totpUri, setTotpUri] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [success, setSuccess] = useState(false);

  const isTotp = method === 'totp';
  const methodLabel = isTotp ? 'authenticator app' : method === 'email' ? 'email' : 'SMS';

  const handleSetup = async () => {
    if (!userId) { setError('Missing user information'); return; }
    setLoading(true);
    setError('');
    try {
      if (isTotp) {
        // POST /auth/users/{id}/totp → returns TOTP URI + secret
        const resp = await fetch(`${AUTH_BASE}/users/${userId}/totp`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!resp.ok) throw new Error('Failed to start TOTP setup');
        const data = await resp.json() as { uri?: string; secret?: string };
        setTotpUri(data.uri ?? '');
        setTotpSecret(data.secret ?? '');
      } else {
        // POST /auth/users/{id}/otp_email or otp_sms - enables the method
        const endpoint = method === 'email' ? 'otp-email' : 'otp-sms';
        const resp = await fetch(`${AUTH_BASE}/users/${userId}/${endpoint}`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!resp.ok) throw new Error(`Failed to enable ${methodLabel} OTP`);
        setSuccess(true);
      }
    } catch (err: unknown) {
      setError(toFriendlyError(err, 'Setup failed'));
    } finally {
      setLoading(false);
    }
  };

  const submittingRef = useRef(false);

  const verifyCode = async (raw: string) => {
    const codeValue = raw.trim();
    if (!codeValue) { setError('Enter the verification code'); return; }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError('');
    try {
      // POST /auth/users/{id}/totp/verify
      const resp = await fetch(`${AUTH_BASE}/users/${userId}/totp/verify`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeValue }),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({})) as { message?: string };
        throw new Error(errData.message ?? 'Verification failed');
      }
      setSuccess(true);
    } catch (err: unknown) {
      setError(toFriendlyError(err, 'Verification failed'));
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyCode(code);
  };

  const handlePaste = useCodePaste((pasted) => {
    setCode(pasted);
    void verifyCode(pasted);
  });

  if (success) {
    return (
      <LoginLayout title="Setup complete" subtitle={`${methodLabel} has been configured`}>
        <div className="space-y-4 text-center">
          <p className="text-sm text-green-600 dark:text-green-400">Two-factor authentication is now enabled.</p>
          {authRequestId && (
            <Button className="w-full" onClick={() => { void navigate(`/login/password?authRequest=${authRequestId}&sessionId=${sessionId}&loginName=`); }}>
              Continue signing in
            </Button>
          )}
        </div>
      </LoginLayout>
    );
  }

  return (
    <LoginLayout title={`Set up ${methodLabel}`} subtitle={isTotp ? 'Scan the QR code with your authenticator app' : `We'll send codes to your ${methodLabel}`}>
      {isTotp && !totpUri ? (
        <div className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" disabled={loading} onClick={() => { void handleSetup(); }}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting up...</> : 'Start setup'}
          </Button>
        </div>
      ) : isTotp ? (
        <form onSubmit={(e) => { void handleVerify(e); }} className="space-y-4">
          {totpUri && (
            <div className="p-4 bg-muted rounded-lg text-center space-y-2">
              <p className="text-xs text-muted-foreground font-mono break-all">{totpUri}</p>
              {totpSecret && (
                <p className="text-xs"><span className="text-muted-foreground">Secret: </span><span className="font-mono font-bold">{totpSecret}</span></p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="verify-code">Verification code</Label>
            <Input id="verify-code" type="text" inputMode="numeric" maxLength={6} autoFocus value={code} onChange={(e) => { setCode(e.target.value); }} onPaste={handlePaste} placeholder="000000" disabled={loading} className="text-center text-2xl tracking-widest" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <GradientButton type="submit" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : 'Verify'}
          </GradientButton>
        </form>
      ) : (
        <div className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" disabled={loading} onClick={() => { void handleSetup(); }}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enabling...</> : `Enable ${methodLabel} OTP`}
          </Button>
        </div>
      )}
    </LoginLayout>
  );
}
