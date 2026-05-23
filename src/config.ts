// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Runtime configuration loader.
 *
 * In production (Kubernetes/nginx), env.js sets window.__STACKWEAVER__ with
 * the correct values for the deployment. In development (Vite dev server),
 * env.js doesn't exist and we fall back to import.meta.env.VITE_* variables.
 *
 * This lets you build a single generic Docker image and configure it at
 * deploy time via environment variables / Helm values.
 */

interface RuntimeConfig {
  VITE_API_URL?: string;
  VITE_ZITADEL_ISSUER?: string;
  VITE_ZITADEL_CLIENT_ID?: string;
  VITE_ZITADEL_REDIRECT_URI?: string;
  VITE_BASE_PATH?: string;
  // Custom-login-ui UX flag. When "true", OTP/verification forms auto-submit
  // as soon as the user pastes a full-length code — a homelab convenience
  // that pairs with STACKWEAVER_NOTIFICATION_MODE=return_code on the backend.
  VITE_STACKWEAVER_AUTO_SUBMIT_CODE?: string;
}

declare global {
  interface Window {
    __STACKWEAVER__?: RuntimeConfig;
  }
}

function getConfig(key: keyof RuntimeConfig, fallback: string): string {
  // Runtime config from env.js takes precedence
  const runtime = window.__STACKWEAVER__?.[key];
  if (runtime !== undefined && runtime !== '') {
    return String(runtime);
  }
  // Fall back to Vite build-time env vars
  const buildTime = import.meta.env[key] as string | undefined;
  if (buildTime !== undefined && buildTime !== '') {
    return String(buildTime);
  }
  return fallback;
}

export const config = {
  apiUrl: getConfig('VITE_API_URL', 'http://localhost:8022/api/v2'),
  zitadelIssuer: getConfig('VITE_ZITADEL_ISSUER', 'http://localhost:8080'),
  zitadelClientId: getConfig('VITE_ZITADEL_CLIENT_ID', ''),
  zitadelRedirectUri: getConfig('VITE_ZITADEL_REDIRECT_URI', 'http://localhost:5173/auth/callback'),
  basePath: getConfig('VITE_BASE_PATH', ''),
  autoSubmitCode: getConfig('VITE_STACKWEAVER_AUTO_SUBMIT_CODE', 'false') === 'true',
};
