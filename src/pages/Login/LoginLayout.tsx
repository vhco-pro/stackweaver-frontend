// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { getBrandingSettings, type BrandingSettings } from '@/api/auth-client';
import { selectBrandingOutputs, DEFAULT_LOGO } from './branding';

interface LoginLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export default function LoginLayout({ children, title, subtitle }: LoginLayoutProps) {
  const { theme } = useTheme();

  // Branding fetch via React Query so we get caching, retries, and
  // never block first paint. The auth proxy's settingsCache already
  // serves this with a 1h TTL (see settingsTTL in auth_proxy_cache.go),
  // so the network cost is minimal — most loads hit the proxy's cache.
  // `staleTime: Infinity` here means we won't re-fetch within a session;
  // a logout + new login mounts a fresh component tree anyway.
  //
  // Errors are intentionally swallowed: a degraded Zitadel must NOT
  // crash the login page (F-chaos-3 contract). `useQuery` returns
  // `data: undefined` on error and we fall through to defaults.
  //
  // Round 25 Wave 7 (item 8 / R24-6): `gcTime: 0` on the auth-page
  // branding query so the cache evicts on unmount. Multi-tab on a
  // shared machine: tab A as Alice fetches branding, tab B opens the
  // login page → without gcTime: 0, RQ would briefly serve Alice's
  // branding from in-memory cache during the loading flicker. The
  // login page is transient (visited once per auth flow), so trading
  // an extra fetch on remount for guaranteed freshness is the right
  // call.
  const { data: branding } = useQuery<BrandingSettings>({
    queryKey: ['login-branding'],
    queryFn: getBrandingSettings,
    staleTime: Infinity,
    retry: 1,
    gcTime: 0,
  });

  const { logoUrl } = selectBrandingOutputs(branding, theme === 'dark' ? 'dark' : 'light');

  return (
    <div className={`min-h-screen flex items-center justify-center bg-background ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="w-full max-w-md mx-auto p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src={logoUrl}
              alt="Stackweaver"
              className="h-20 w-20"
              // If a custom logoUrl 404s (org changed branding mid-session),
              // fall back to the default rather than rendering a broken-image
              // icon — same defensive principle as the empty-data fallback.
              onError={(e) => { (e.currentTarget).src = DEFAULT_LOGO; }}
            />
          </div>
          {title && (
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          )}
          {subtitle && (
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
