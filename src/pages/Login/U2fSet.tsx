// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldPlus } from 'lucide-react';
import { config } from '@/config';
import LoginLayout from './LoginLayout';
import { toFriendlyError } from '@/lib/auth-errors';

const AUTH_BASE = config.apiUrl.replace(/\/api\/v2\/?$/, '/auth');

/**
 * WebAuthn ↔ Zitadel wire-format helpers — Zitadel ships base64url
 * strings on `publicKeyCredentialCreationOptions.challenge` and
 * `user.id`; the browser WebAuthn API needs ArrayBuffers, and we
 * reply with base64url consistently because Zitadel's grpc-gateway
 * sometimes rejects standard base64 (`+`/`/`/`=`). Same shape as
 * the helpers in Passkey.tsx / PasskeySet.tsx / U2f.tsx — kept
 * duplicated rather than extracted because each file is small and
 * the shared abstraction adds an import hop. Wave 14 (2026-05-12).
 */
function b64uToBuf(s: string): ArrayBuffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(s.length + ((4 - (s.length % 4)) % 4), '=');
  const bin = atob(padded);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function bufToB64u(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default function U2fSet() {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId') ?? '';

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleRegister = async () => {
    if (!userId) { setError('Missing user information'); return; }
    setLoading(true);
    setError('');
    try {
      // Step 1: POST /auth/users/{id}/u2f → get creation options
      const startResp = await fetch(`${AUTH_BASE}/users/${userId}/u2f`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: window.location.hostname }),
      });
      if (!startResp.ok) throw new Error('Failed to start security key registration');
      const startData = await startResp.json() as {
        u2fId?: string;
        publicKeyCredentialCreationOptions?: { publicKey?: Record<string, unknown> };
      };

      const rawOpts = startData.publicKeyCredentialCreationOptions?.publicKey;
      if (!rawOpts || !startData.u2fId) {
        throw new Error('Invalid registration response from server');
      }

      // Step 2: Browser WebAuthn ceremony (U2F uses presence only, no
      // user verification). Convert base64url string fields to
      // ArrayBuffers — same shape fix as Passkey.tsx / U2f.tsx
      // (Wave 14).
      const opts = rawOpts as {
        challenge: string;
        user: { id: string; name: string; displayName: string };
        excludeCredentials?: { id: string; type: string }[];
      };
      const publicKey = {
        ...opts,
        challenge: b64uToBuf(opts.challenge),
        user: { ...opts.user, id: b64uToBuf(opts.user.id) },
        excludeCredentials: opts.excludeCredentials?.map((c) => ({ ...c, id: b64uToBuf(c.id) })),
      } as unknown as PublicKeyCredentialCreationOptions;

      const credential = await navigator.credentials.create({ publicKey }) as PublicKeyCredential | null;

      if (!credential) {
        setError('Security key registration was cancelled');
        return;
      }

      const attestationResponse = credential.response as AuthenticatorAttestationResponse;

      // Step 3: POST /auth/users/{id}/u2f/{u2fId} → verify registration.
      // base64url on the return trip — Zitadel's grpc-gateway is picky
      // about which fields accept standard vs URL-safe base64.
      const verifyResp = await fetch(`${AUTH_BASE}/users/${userId}/u2f/${startData.u2fId}`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKeyCredential: {
            type: credential.type,
            id: credential.id,
            rawId: bufToB64u(credential.rawId),
            response: {
              clientDataJSON: bufToB64u(attestationResponse.clientDataJSON),
              attestationObject: bufToB64u(attestationResponse.attestationObject),
            },
          },
          tokenName: `Security Key ${new Date().toLocaleDateString()}`,
        }),
      });
      if (!verifyResp.ok) throw new Error('Failed to verify security key registration');

      setSuccess(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Security key registration was cancelled');
      } else {
        setError(toFriendlyError(err, 'Failed to register security key'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <LoginLayout title="Security key registered">
        <div className="text-center space-y-4">
          <ShieldPlus className="h-16 w-16 text-green-500 mx-auto" />
          <p className="text-sm text-muted-foreground">Your security key has been registered for two-factor authentication.</p>
        </div>
      </LoginLayout>
    );
  }

  return (
    <LoginLayout title="Register security key" subtitle="Add a security key for two-factor authentication">
      <div className="space-y-4 text-center">
        <ShieldPlus className="h-16 w-16 text-muted-foreground mx-auto" />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" disabled={loading} onClick={() => { void handleRegister(); }}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Waiting for security key...</> : 'Register security key'}
        </Button>
      </div>
    </LoginLayout>
  );
}
