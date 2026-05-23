// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck } from 'lucide-react';
import { updateSession, finalizeAuthRequest } from '@/api/auth-client';
import LoginLayout from './LoginLayout';
import { toFriendlyError } from '@/lib/auth-errors';

/**
 * WebAuthn ↔ Zitadel use base64url (RFC 4648 §5) on the wire — strings
 * containing `-`/`_` instead of `+`/`/` and no padding. The browser
 * WebAuthn API works with `ArrayBuffer`s; conversion happens both ways.
 *
 * Identical to the helpers in Passkey.tsx — kept duplicated here
 * rather than extracted because both files are small and the shared
 * abstraction adds an import hop for no real saving.
 *
 * Wave 14 (2026-05-12): previous version cast the wire shape directly
 * to `PublicKeyCredentialRequestOptions` via `as unknown as` —
 * Chromium rejected the missing ArrayBuffer with "Failed to read the
 * 'challenge' property". Same fix as Passkey.tsx's b64uToBuf /
 * bufToB64u dance.
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

export default function U2f() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authRequestId = searchParams.get('authRequest') ?? '';
  const sessionId = searchParams.get('sessionId') ?? '';

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleU2fAuth = async () => {
    setLoading(true);
    setError('');

    try {
      // Request WebAuthn challenge for U2F second factor
      const challengeResp = await updateSession(sessionId, {
        challenges: {
          webAuthN: {
            domain: window.location.hostname,
            userVerificationRequirement: 'USER_VERIFICATION_REQUIREMENT_DISCOURAGED',
          },
        },
      });

      // Zitadel wraps the WebAuthn challenge under `webAuthN.publicKeyCredentialRequestOptions.publicKey`.
      // Same shape as Passkey.tsx — kept symmetrical so future Zitadel
      // proto changes can be diffed against both files at once.
      const webAuthNChallenge = challengeResp.challenges?.webAuthN as
        | { publicKeyCredentialRequestOptions?: { publicKey?: Record<string, unknown> } }
        | undefined;
      const requestOptionsRaw = webAuthNChallenge?.publicKeyCredentialRequestOptions?.publicKey;
      if (!requestOptionsRaw) {
        setError('No security key challenge received');
        return;
      }

      // Decode base64url string fields to ArrayBuffers — see file-level
      // note on why this is needed.
      const raw = requestOptionsRaw as {
        challenge: string;
        allowCredentials?: { id: string; type: string; transports?: string[] }[];
      };
      const requestOptions = {
        ...raw,
        challenge: b64uToBuf(raw.challenge),
        allowCredentials: raw.allowCredentials?.map((c) => ({
          ...c,
          id: b64uToBuf(c.id),
        })),
      } as unknown as PublicKeyCredentialRequestOptions;

      const credential = await navigator.credentials.get({
        publicKey: requestOptions,
      }) as PublicKeyCredential | null;

      if (!credential) {
        setError('Security key authentication was cancelled');
        return;
      }

      const response = credential.response as AuthenticatorAssertionResponse;
      const updateResp = await updateSession(sessionId, {
        checks: {
          webAuthN: {
            credentialAssertionData: {
              type: credential.type,
              id: credential.id,
              rawId: bufToB64u(credential.rawId),
              response: {
                clientDataJSON: bufToB64u(response.clientDataJSON),
                authenticatorData: bufToB64u(response.authenticatorData),
                signature: bufToB64u(response.signature),
                userHandle: response.userHandle ? bufToB64u(response.userHandle) : undefined,
              },
            },
          },
        },
      });

      if (authRequestId) {
        const finalizeResp = await finalizeAuthRequest({ authRequestId, sessionId, sessionToken: updateResp.sessionToken });
        window.location.href = finalizeResp.callbackUrl;
      } else {
        void navigate('/dashboard');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Security key authentication was cancelled or timed out');
      } else {
        setError(toFriendlyError(err, 'Security key authentication failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginLayout title="Security key" subtitle="Use your security key to verify your identity">
      <div className="space-y-4 text-center">
        <div className="flex justify-center py-4">
          <ShieldCheck className="h-16 w-16 text-muted-foreground" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" disabled={loading} onClick={() => { void handleU2fAuth(); }}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Waiting for security key...</> : 'Verify with security key'}
        </Button>
      </div>
    </LoginLayout>
  );
}
