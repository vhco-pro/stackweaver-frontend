// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { KeyRound, type LucideIcon } from 'lucide-react';
import {
  type IconProps,
  GoogleIcon,
  MicrosoftIcon,
  AppleIcon,
  GitHubIcon,
  GitLabIcon,
  OktaIcon,
  Auth0Icon,
  CognitoIcon,
} from './idpIconGlyphs';

/**
 * IdP-type → icon mapping for the Login UI.
 *
 * Zitadel's IdpProvider response carries a `type` field, but the
 * concrete enum-string changes between Zitadel versions:
 *   - v4:   `IDENTITY_PROVIDER_TYPE_AZURE_AD`
 *   - v3:   `IDP_TYPE_AZURE_AD`
 *   - bare: `AZURE_AD`
 * We normalise by stripping known prefixes before matching so the
 * dispatch survives a Zitadel upgrade.
 *
 * Many real-world IdPs (Okta, Auth0, AWS Cognito, ...) come back
 * with the generic type `IDENTITY_PROVIDER_TYPE_OIDC` because Zitadel
 * doesn't have a dedicated provider template for them — they're
 * provisioned via `AddGenericOIDCProvider`. The type alone can't
 * distinguish vendor in that case, so we fall back to matching the
 * provider's `name` (case-insensitive substring) against a known-
 * vendor list. The operator names their IdP "Okta" in `OIDC_IDP_NAME`
 * (or whatever — sso.env is the source of truth) and we render the
 * matching glyph.
 *
 * Wave 14 colour upgrade (2026-05-12): the original monochrome
 * `currentColor` glyphs rendered as the same washed-out grey/white
 * regardless of brand — looked cheap and unprofessional next to a
 * real "Sign in with Microsoft" button. We now ship brand-faithful
 * multi-colour SVGs (Microsoft's 4-tile in red/green/blue/yellow,
 * Google's 4-colour G, Okta's blue O, etc.) with hardcoded fills.
 * These read well on both light AND dark backgrounds — verified
 * against the actual login-page contexts.
 *
 * GitHub stays monochrome because the GitHub brand itself is
 * monochrome (the Octocat is grayscale). We use `currentColor` for
 * GitHub so it adapts to the surrounding text colour. For the rest,
 * the brand colours are explicit and theme-invariant.
 *
 * Anything that doesn't match a vendor falls back to the generic
 * key-round icon, mirroring Zitadel's hosted-UI "generic IdP" icon.
 */

// Bare-suffix vendor-type → component lookup. Anything in this map
// matches by the Zitadel `type` field after we strip known prefixes
// (see `normalizeType`).
const VENDOR_BY_TYPE: Record<string, LucideIcon | ((props: IconProps) => React.JSX.Element)> = {
    GOOGLE: GoogleIcon,
    GITHUB: GitHubIcon,
    GITHUB_ES: GitHubIcon,
    GITLAB: GitLabIcon,
    GITLAB_SELF_HOSTED: GitLabIcon,
    AZURE_AD: MicrosoftIcon,
    APPLE: AppleIcon,
};

// Name-fallback for vendors that come back as the generic OIDC type
// (Zitadel doesn't ship dedicated provider templates for these, so
// operators provision them via `AddGenericOIDCProvider` and name them
// in `sso.env`). Case-insensitive substring match — "Okta", "OKTA",
// "okta-prod" all hit `OktaIcon`.
const VENDOR_BY_NAME: { match: RegExp; icon: LucideIcon | ((props: IconProps) => React.JSX.Element) }[] = [
    { match: /okta/i, icon: OktaIcon },
    { match: /auth0/i, icon: Auth0Icon },
    { match: /cognito|amazon|aws/i, icon: CognitoIcon },
    { match: /google|workspace/i, icon: GoogleIcon },
    { match: /microsoft|azure|entra/i, icon: MicrosoftIcon },
    { match: /github/i, icon: GitHubIcon },
    { match: /gitlab/i, icon: GitLabIcon },
    { match: /apple/i, icon: AppleIcon },
];

// Strip known Zitadel type-enum prefixes so the same lookup matches
// `IDENTITY_PROVIDER_TYPE_AZURE_AD` (v4), `IDP_TYPE_AZURE_AD` (v3),
// and the bare `AZURE_AD`. Returns the bare suffix uppercased.
function normalizeType(type: string): string {
    const up = type.toUpperCase();
    for (const prefix of ['IDENTITY_PROVIDER_TYPE_', 'IDP_TYPE_']) {
        if (up.startsWith(prefix)) {
            return up.slice(prefix.length);
        }
    }
    return up;
}

/**
 * getIdpIcon returns the React component to render for the given
 * Zitadel IdP. Dispatch order:
 *   1. Vendor-by-type (Google, GitHub, GitLab, Azure AD, Apple)
 *      — type-string is normalised across Zitadel v3 / v4 / bare
 *      enum shapes.
 *   2. Vendor-by-name (Okta, Auth0, AWS Cognito, ...) — only
 *      consulted when type didn't match a known vendor template
 *      (so the operator naming their generic-OIDC IdP "Okta" gets
 *      the Okta glyph).
 *   3. Generic key-round icon — fall-through for truly unknown IdPs.
 *
 * Both Lucide and inline SVG components accept a `className` prop so
 * callers can size/colour them consistently.
 */
export function getIdpIcon(type: string, name?: string): LucideIcon | ((props: IconProps) => React.JSX.Element) {
    const bare = normalizeType(type);
    if (VENDOR_BY_TYPE[bare]) {
        return VENDOR_BY_TYPE[bare];
    }
    if (name) {
        for (const entry of VENDOR_BY_NAME) {
            if (entry.match.test(name)) {
                return entry.icon;
            }
        }
    }
    return KeyRound;
}
