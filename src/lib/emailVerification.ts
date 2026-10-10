// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/** The userinfo fields the verified-email check reads. */
export interface EmailClaims {
  email?: string;
  email_verified?: unknown;
}

/**
 * True when the account has an email that Zitadel has not verified (#829 D5). Such an account
 * does not reach the platform: the API answers 403. Zitadel omits `email_verified` when it is
 * false, so only an explicit `true` counts. Accounts without an email (machine users) are not
 * subject to the check.
 */
export function needsEmailVerification(info: EmailClaims): boolean {
  return Boolean(info.email) && info.email_verified !== true;
}

/** Where an unverified account is sent instead of the app. */
export function verifyEmailRequiredPath(email: string): string {
  return `/login/verify-email-required?email=${encodeURIComponent(email)}`;
}
