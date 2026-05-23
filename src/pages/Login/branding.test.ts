// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { selectBrandingOutputs, DEFAULT_LOGO } from './branding';
import type { BrandingSettings } from '@/api/auth-client';

// LoginLayout integrates Zitadel's `getBrandingSettings` per the
// Zitadel Custom Login UI guide (in-scope per custom-login-ui plan,
// previously deferred from A-hardening). The render path is a thin
// shell over `selectBrandingOutputs` — testing the pure selector
// gives full coverage of the precedence rules without spinning up a
// React/DOM environment (matches the project pattern in
// useCodePaste.test.ts).
//
// Per-theme block precedence:
//   1. The current theme's logoUrl, if set
//   2. The OTHER theme's logoUrl as a fallback (some orgs only
//      configure one)
//   3. The Stackweaver default (`/logo.png`)
//
// Watermark removed 2026-05-09 — Stackweaver login is obviously
// Stackweaver; the redundant "Powered by Stackweaver" was dropped.

describe('selectBrandingOutputs', () => {
  it('returns defaults when branding is undefined (degraded Zitadel / no fetch yet)', () => {
    const got = selectBrandingOutputs(undefined, 'light');
    expect(got.logoUrl).toBe(DEFAULT_LOGO);
  });

  it('returns defaults when branding is empty object (no themes configured)', () => {
    const got = selectBrandingOutputs({}, 'dark');
    expect(got.logoUrl).toBe(DEFAULT_LOGO);
  });

  it('uses the current theme block when both themes are configured', () => {
    const branding: BrandingSettings = {
      lightTheme: { logoUrl: 'https://cdn.example/light.png' },
      darkTheme: { logoUrl: 'https://cdn.example/dark.png' },
    };
    expect(selectBrandingOutputs(branding, 'light').logoUrl).toBe('https://cdn.example/light.png');
    expect(selectBrandingOutputs(branding, 'dark').logoUrl).toBe('https://cdn.example/dark.png');
  });

  it('falls back to the OTHER theme when current is unset (single-theme org)', () => {
    const lightOnly: BrandingSettings = {
      lightTheme: { logoUrl: 'https://cdn.example/light.png' },
    };
    expect(selectBrandingOutputs(lightOnly, 'dark').logoUrl).toBe('https://cdn.example/light.png');

    const darkOnly: BrandingSettings = {
      darkTheme: { logoUrl: 'https://cdn.example/dark.png' },
    };
    expect(selectBrandingOutputs(darkOnly, 'light').logoUrl).toBe('https://cdn.example/dark.png');
  });

  it('falls back to default when both themes are present but neither has a logoUrl', () => {
    const branding: BrandingSettings = {
      lightTheme: { primaryColor: '#ff0000' },
      darkTheme: { primaryColor: '#00ff00' },
    };
    expect(selectBrandingOutputs(branding, 'light').logoUrl).toBe(DEFAULT_LOGO);
    expect(selectBrandingOutputs(branding, 'dark').logoUrl).toBe(DEFAULT_LOGO);
  });

  it('treats empty-string logoUrl as unset (Zitadel returns "" for cleared fields)', () => {
    const branding: BrandingSettings = {
      lightTheme: { logoUrl: '' },
      darkTheme: { logoUrl: 'https://cdn.example/dark.png' },
    };
    // Light theme has empty string → falls through to dark theme.
    expect(selectBrandingOutputs(branding, 'light').logoUrl).toBe('https://cdn.example/dark.png');
  });
});
