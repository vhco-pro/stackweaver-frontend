// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, Fingerprint } from 'lucide-react';
import { config } from '@/config';
import LoginLayout from './LoginLayout';
import { toFriendlyError } from '@/lib/auth-errors';

const AUTH_BASE = config.apiUrl.replace(/\/api\/v2\/?$/, '/auth');

/**
 * WebAuthn ↔ Zitadel wire-format helpers — see Passkey.tsx for the
 * full rationale. Zitadel ships base64url strings on the
 * `publicKeyCredentialCreationOptions.challenge` and `user.id` fields;
 * the browser WebAuthn API requires ArrayBuffers. Standard `btoa`
 * produces base64 (`+`/`/`/`=`) which Zitadel's grpc-gateway
 * sometimes rejects, so we use base64url consistently on the return
 * trip too.
 *
 * Wave 14 (2026-05-12): caught when the AC-13 spec drove the page
 * end-to-end for the first time. Previously the SPA passed the raw
 * Zitadel response through `as` cast and the browser threw "Failed
 * to read the 'challenge' property"; same bug as U2f.tsx had.
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

export default function PasskeySet() {
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
      // Step 1: POST /auth/users/{id}/passkeys → get creation options
      const startResp = await fetch(`${AUTH_BASE}/users/${userId}/passkeys`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: window.location.hostname }),
      });
      if (!startResp.ok) throw new Error('Failed to start passkey registration');
      const startData = await startResp.json() as {
        passkeyId?: string;
        publicKeyCredentialCreationOptions?: { publicKey?: Record<string, unknown> };
      };

      const rawOpts = startData.publicKeyCredentialCreationOptions?.publicKey;
      if (!rawOpts || !startData.passkeyId) {
        throw new Error('Invalid registration response from server');
      }

      // Step 2: Browser WebAuthn ceremony — decode base64url string
      // fields to ArrayBuffers (see file-level helper doc).
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
        setError('Passkey registration was cancelled');
        return;
      }

      const attestationResponse = credential.response as AuthenticatorAttestationResponse;

      // Step 3: POST /auth/users/{id}/passkeys/{passkeyId} → verify registration.
      // Use base64url encoding consistently on the return trip (see file note).
      const verifyResp = await fetch(`${AUTH_BASE}/users/${userId}/passkeys/${startData.passkeyId}`, {
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
          passkeyName: `Passkey ${new Date().toLocaleDateString()}`,
        }),
      });
      if (!verifyResp.ok) throw new Error('Failed to verify passkey registration');

      setSuccess(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Passkey registration was cancelled');
      } else {
        setError(toFriendlyError(err, 'Failed to register passkey'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <LoginLayout title="Passkey registered">
        <div className="text-center space-y-4">
          <Fingerprint className="h-16 w-16 text-green-500 mx-auto" />
          <p className="text-sm text-muted-foreground">Your passkey has been registered. You can use it to sign in.</p>
        </div>
      </LoginLayout>
    );
  }

  return (
    <LoginLayout title="Register passkey" subtitle="Add a passkey for passwordless sign-in">
      <div className="space-y-4 text-center">
        <Fingerprint className="h-16 w-16 text-muted-foreground mx-auto" />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" disabled={loading} onClick={() => { void handleRegister(); }}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Waiting...</> : 'Register passkey'}
        </Button>
      </div>
    </LoginLayout>
  );
}
