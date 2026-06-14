// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Characterization net for getIdpIcon's dispatch, extracted into a pure (non-component)
// module so the idpIcons file stops mixing component + non-component exports
// (react-refresh/only-export-components → error, #360). The glyph components now live
// in ./idpIconGlyphs; this pins the type/name → glyph resolution that callers rely on.

import { describe, it, expect } from 'vitest';
import { KeyRound } from 'lucide-react';
import { getIdpIcon } from './idpIcons';
import {
  GoogleIcon, GitHubIcon, GitLabIcon, MicrosoftIcon, AppleIcon,
  OktaIcon, Auth0Icon, CognitoIcon,
} from './idpIconGlyphs';

describe('getIdpIcon', () => {
  it('matches known vendors by type across Zitadel enum shapes', () => {
    // v4, v3, and bare prefixes all normalise to the same glyph.
    expect(getIdpIcon('IDENTITY_PROVIDER_TYPE_AZURE_AD')).toBe(MicrosoftIcon);
    expect(getIdpIcon('IDP_TYPE_AZURE_AD')).toBe(MicrosoftIcon);
    expect(getIdpIcon('AZURE_AD')).toBe(MicrosoftIcon);
    expect(getIdpIcon('GOOGLE')).toBe(GoogleIcon);
    expect(getIdpIcon('GITHUB')).toBe(GitHubIcon);
    expect(getIdpIcon('GITHUB_ES')).toBe(GitHubIcon);
    expect(getIdpIcon('GITLAB_SELF_HOSTED')).toBe(GitLabIcon);
    expect(getIdpIcon('APPLE')).toBe(AppleIcon);
  });

  it('falls back to name matching for generic OIDC providers', () => {
    expect(getIdpIcon('IDENTITY_PROVIDER_TYPE_OIDC', 'Okta Prod')).toBe(OktaIcon);
    expect(getIdpIcon('OIDC', 'auth0-tenant')).toBe(Auth0Icon);
    expect(getIdpIcon('OIDC', 'AWS Cognito')).toBe(CognitoIcon);
    expect(getIdpIcon('OIDC', 'corp-google-workspace')).toBe(GoogleIcon);
  });

  it('type match takes precedence over name match', () => {
    expect(getIdpIcon('GITHUB', 'okta')).toBe(GitHubIcon);
  });

  it('falls back to the generic key icon for unknown IdPs', () => {
    expect(getIdpIcon('OIDC')).toBe(KeyRound);
    expect(getIdpIcon('SOMETHING_ELSE', 'unrecognised vendor')).toBe(KeyRound);
  });
});
