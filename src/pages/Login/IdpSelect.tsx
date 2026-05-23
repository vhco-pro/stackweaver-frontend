// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { listIdpProviders, startIdP } from '@/api/auth-client';
import type { IdpProvider } from '@/api/auth-client';
import { useMountEffect } from '@/hooks/useMountEffect';
import LoginLayout from './LoginLayout';
import { toFriendlyError } from '@/lib/auth-errors';
import { getIdpIcon } from './idpIcons';

export default function IdpSelect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authRequestId = searchParams.get('authRequest') ?? '';

  const [providers, setProviders] = useState<IdpProvider[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [startingIdp, setStartingIdp] = useState('');

  useMountEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const result = await listIdpProviders();
        if (!cancelled) { setProviders(result.result ?? []); setLoading(false); }
      } catch (err: unknown) {
        if (!cancelled) { setError(toFriendlyError(err, 'Failed to load providers')); setLoading(false); }
      }
    };
    void fetch();
    return () => { cancelled = true; };
  });

  const handleStart = async (provider: IdpProvider) => {
    setStartingIdp(provider.id);
    setError('');
    try {
      const result = await startIdP(provider.id);
      window.location.assign(result.authUrl);
    } catch (err: unknown) {
      setError(toFriendlyError(err, 'Failed to start login'));
      setStartingIdp('');
    }
  };

  return (
    <LoginLayout title="Sign in with" subtitle="Choose an identity provider">
      <div className="space-y-2">
        {loading && <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
        {providers.map((p) => {
          const Icon = getIdpIcon(p.type, p.name);
          return (
            <Button key={p.id} variant="outline" className="w-full justify-start gap-3" disabled={!!startingIdp} onClick={() => { void handleStart(p); }}>
              {startingIdp === p.id
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Icon className="h-4 w-4 shrink-0" />}
              <span className="truncate">{p.name}</span>
            </Button>
          );
        })}
        {!loading && providers.length === 0 && !error && (
          <p className="text-sm text-center text-muted-foreground">No identity providers configured</p>
        )}
        <Button variant="link" className="w-full text-muted-foreground" onClick={() => { void navigate(`/login/loginname?authRequest=${authRequestId}`); }}>
          Sign in with username instead
        </Button>
      </div>
    </LoginLayout>
  );
}
