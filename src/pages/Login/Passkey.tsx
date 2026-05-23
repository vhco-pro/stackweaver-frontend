// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, Fingerprint } from 'lucide-react';
import { updateSession, finalizeAuthRequest } from '@/api/auth-client';
import { toFriendlyError } from '@/lib/auth-errors';
import LoginLayout from './LoginLayout';

/**
 * WebAuthn ↔ Zitadel use base64url (RFC 4648 §5) on the wire — strings
 * containing `-`/`_` instead of `+`/`/` and no padding. The browser
 * WebAuthn API works with `ArrayBuffer`s; conversion happens both ways.
 *
 * Standard `btoa` produces base64 with `+`/`/`/`=`, which Zitadel's
 * grpc-gateway sometimes accepts and sometimes rejects depending on the
 * field type — using base64url consistently avoids that flakiness.
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

export default function Passkey() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authRequestId = searchParams.get('authRequest') ?? '';
  const sessionId = searchParams.get('sessionId') ?? '';
  const loginName = searchParams.get('loginName') ?? '';

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasskeyAuth = async () => {
    if (!sessionId) {
      setError('No session available. Please start over.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Request WebAuthn challenge from Zitadel via proxy
      const challengeResp = await updateSession(sessionId, {
        challenges: {
          webAuthN: {
            domain: window.location.hostname,
            userVerificationRequirement: 'USER_VERIFICATION_REQUIREMENT_REQUIRED',
          },
        },
      });

      // Get the WebAuthn challenge options from the response. Zitadel
      // wraps under `publicKey` (matching the WebAuthn dictionary shape).
      const webAuthNChallenge = challengeResp.challenges?.webAuthN as
        | { publicKeyCredentialRequestOptions?: { publicKey?: Record<string, unknown> } }
        | undefined;
      const requestOptionsRaw = webAuthNChallenge?.publicKeyCredentialRequestOptions?.publicKey;
      if (!requestOptionsRaw) {
        setError('No WebAuthn challenge received from server');
        return;
      }

      // Decode base64url string fields to ArrayBuffers — the browser
      // WebAuthn API rejects raw strings on `challenge` and
      // `allowCredentials[].id` with `Failed to read the 'challenge'
      // property from 'PublicKeyCredentialRequestOptions'`. Zitadel ships
      // these as base64url on the wire.
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

      const credential = (await navigator.credentials.get({
        publicKey: requestOptions,
      })) as PublicKeyCredential | null;

      if (!credential) {
        setError('Passkey authentication was cancelled');
        return;
      }

      const assertionResponse = credential.response as AuthenticatorAssertionResponse;

      // Send the credential back to finalize auth. Encode every byte
      // field as base64url — `btoa` produces standard base64 (`+`/`/`)
      // which Zitadel's grpc-gateway sometimes rejects depending on the
      // field type. base64url is the safe wire shape for WebAuthn.
      const updateResp = await updateSession(sessionId, {
        checks: {
          webAuthN: {
            credentialAssertionData: {
              type: credential.type,
              id: credential.id,
              rawId: bufToB64u(credential.rawId),
              response: {
                clientDataJSON: bufToB64u(assertionResponse.clientDataJSON),
                authenticatorData: bufToB64u(assertionResponse.authenticatorData),
                signature: bufToB64u(assertionResponse.signature),
                userHandle: assertionResponse.userHandle ? bufToB64u(assertionResponse.userHandle) : undefined,
              },
            },
          },
        },
      });

      // Finalize the auth request
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
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Passkey authentication was cancelled or timed out');
      } else {
        // Round 26 Wave 10 (Wave 7 gap): friendly-error mapping.
        setError(toFriendlyError(err, 'Passkey authentication failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginLayout title="Passkey" subtitle={loginName || 'Use your passkey to sign in'}>
      <div className="space-y-4">
        <div className="flex justify-center py-4">
          <Fingerprint className="h-16 w-16 text-muted-foreground" />
        </div>

        <p className="text-sm text-center text-muted-foreground">
          Use your device&apos;s biometric sensor, security key, or other authenticator to sign in.
        </p>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <Button
          className="w-full"
          disabled={loading}
          onClick={() => { void handlePasskeyAuth(); }}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Waiting for passkey...
            </>
          ) : (
            'Sign in with passkey'
          )}
        </Button>

        <Button
          variant="link"
          className="w-full text-muted-foreground"
          onClick={() => { void navigate(`/login/password?authRequest=${authRequestId}&sessionId=${sessionId}&loginName=${loginName}`); }}
        >
          Use password instead
        </Button>
      </div>
    </LoginLayout>
  );
}
