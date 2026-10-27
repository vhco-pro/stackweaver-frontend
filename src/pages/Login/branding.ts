// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pure branding selectors for LoginLayout - extracted from
// LoginLayout.tsx so vitest can pin the precedence rules without a
// React/DOM environment (matches the project pattern; see
// useCodePaste.test.ts which sits alongside its pure helper file).

import { defaultLogo } from '@/lib/brandAssets';
import type { BrandingSettings } from '@/api/auth-client';

// Default Stackweaver branding - used while the upstream branding
// fetch is in flight, when the fetch fails (degraded Zitadel), and
// as the fallback when the org has no custom branding configured.
export const DEFAULT_LOGO = defaultLogo;

/**
 * Pure selector for the per-theme branding outputs the LoginLayout
 * renders.
 *
 * Precedence:
 *   1. The current theme's logoUrl, if set
 *   2. The OTHER theme's logoUrl as a fallback (some orgs only
 *      configure one)
 *   3. The Stackweaver default (the bundled logo)
 *
 * Watermark removed 2026-05-09 - it's a Stackweaver-branded login
 * page, the watermark was redundant. The `disableWatermark` field on
 * `BrandingSettings` is now ignored.
 */
export function selectBrandingOutputs(
  branding: BrandingSettings | undefined,
  theme: 'light' | 'dark',
): { logoUrl: string } {
  const themeBlock = theme === 'dark' ? branding?.darkTheme : branding?.lightTheme;
  const fallbackBlock = theme === 'dark' ? branding?.lightTheme : branding?.darkTheme;
  const logoUrl = themeBlock?.logoUrl || fallbackBlock?.logoUrl || DEFAULT_LOGO;
  return { logoUrl };
}
