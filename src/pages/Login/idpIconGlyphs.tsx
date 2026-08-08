// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Brand-faithful IdP glyph components for the Login UI. Each accepts a
// `className` so callers can size/colour it. Resolved by getIdpIcon in
// ./idpIcons. Kept in a components-only module so React Fast Refresh works.

export interface IconProps {
    className?: string;
}

// Google - the canonical 4-colour G. Blue arc + yellow + red +
// green segments per Google's brand guidelines. Theme-invariant
// (Google's G must always render in its 4 brand colours, never
// monochrome - that's a Google brand-asset requirement for
// federated-login buttons).
export function GoogleIcon({ className }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
    );
}

// Microsoft 4-tile logo (used for Azure AD / Entra ID). Brand colours
// per Microsoft's brand-asset guidelines: red top-left, green top-
// right, blue bottom-left, yellow bottom-right. These are the
// canonical hex values Microsoft publishes for the Windows logo.
export function MicrosoftIcon({ className }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <path fill="#F25022" d="M11.4 11.4H0V0h11.4z" />
            <path fill="#7FBA00" d="M24 11.4H12.6V0H24z" />
            <path fill="#00A4EF" d="M11.4 24H0V12.6h11.4z" />
            <path fill="#FFB900" d="M24 24H12.6V12.6H24z" />
        </svg>
    );
}

// Apple logo glyph. Apple's brand is monochrome and the colour is
// context-dependent (black on light backgrounds, white on dark);
// `currentColor` is the right choice here - the button's text-colour
// is already theme-aware so the logo follows.
export function AppleIcon({ className }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
        </svg>
    );
}

// GitHub Octocat - Octocat is monochrome by brand definition.
// `currentColor` lets the button's text colour drive the rendering
// (black on light, white on dark) which is exactly how GitHub
// renders its own "Sign in" CTAs.
export function GitHubIcon({ className }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
            <path d="M12 .3a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.04c-3.34.73-4.04-1.41-4.04-1.41-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.31-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.49 11.49 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.87.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.81 5.63-5.49 5.93.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .3" />
        </svg>
    );
}

// GitLab tanuki - the brand-faithful 3-tone fox logo. GitLab brand
// colours per their press kit: bright orange (#FC6D26), darker
// orange (#E24329), and burnt orange (#FCA326). Renders well on
// both light + dark backgrounds.
export function GitLabIcon({ className }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <path fill="#E24329" d="M23.6 9.59 23.57 9.5l-3.27-8.53a.85.85 0 0 0-.84-.55.84.84 0 0 0-.79.55l-2.21 6.76H7.55L5.35.97a.84.84 0 0 0-.79-.55.85.85 0 0 0-.84.55L.46 9.5l-.03.09a6.06 6.06 0 0 0 2.01 7L2.46 16.6l3.04 2.27 1.5 1.14 3.06 2.31a.99.99 0 0 0 1.2 0l3.06-2.31 1.5-1.14 3.04-2.27.02-.02a6.06 6.06 0 0 0 1.72-6.99z" />
            <path fill="#FC6D26" d="M23.6 9.59 23.57 9.5a11 11 0 0 0-4.39 1.98L12 16.97c2.51 1.9 4.7 3.55 4.7 3.55l3.04-2.27.02-.02a6.06 6.06 0 0 0 1.84-8.64z" />
            <path fill="#FCA326" d="M7.32 20.52 8.82 21.66a.99.99 0 0 0 1.2 0L12 16.97 7.32 20.52z" />
            <path fill="#FC6D26" d="M4.85 11.48A11 11 0 0 0 .46 9.5l-.03.09a6.06 6.06 0 0 0 1.84 8.64l.02.02 3.04 2.27s2.18-1.65 4.69-3.55l-5.17-5.49z" />
        </svg>
    );
}

// Okta "O" mark - Okta brand blue (#007DC1). The notched-O is
// Okta's primary logo; keep it monochrome blue to read clearly at
// 16px button size.
export function OktaIcon({ className }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <path fill="#007DC1" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.25c-2.34 0-4.25-1.91-4.25-4.25S9.66 7.75 12 7.75s4.25 1.91 4.25 4.25S14.34 16.25 12 16.25z" />
        </svg>
    );
}

// Auth0 - orange A-with-circle, Auth0 brand orange (#EB5424).
export function Auth0Icon({ className }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <path fill="#EB5424" d="M19.62 2.5h-7.62l2.36 7.24h7.62l-6.16 4.48 2.36 7.28-6.18-4.5-6.16 4.5 2.34-7.28L2 9.74h7.6L12 2.5z" />
        </svg>
    );
}

// AWS Cognito - AWS orange (#FF9900) cloud + lock combo. AWS
// doesn't ship a dedicated Cognito mark; this stand-in stays in the
// AWS family colour so it reads as "an AWS service" at a glance.
export function CognitoIcon({ className }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <path fill="#FF9900" d="M19.5 11.5c-.32 0-.64.04-.95.12C17.94 8.78 15.21 6.5 12 6.5c-3.31 0-6.07 2.42-6.5 5.61C3.13 12.49 1.5 14.33 1.5 16.5c0 2.49 2.01 4.5 4.5 4.5h13c1.93 0 3.5-1.57 3.5-3.5 0-1.71-1.24-3.13-2.87-3.42-.05-.86-.34-1.66-.78-2.36-.45-.7-1.05-1.28-1.74-1.72.13-.51.39-1.5.39-1.5z" />
        </svg>
    );
}
