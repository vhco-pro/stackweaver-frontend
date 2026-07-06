// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'

// Security response headers for the dev + preview servers. Real deployments serve
// the built SPA via nginx with the full, strict header set (frontend/nginx.conf +
// frontend/security-headers.conf); this only affects the dev server, which also
// fronts the public demo (sw.vhco.pro). The non-CSP headers mirror nginx exactly.
// The CSP is deliberately RELAXED here — the Vite dev server injects inline module
// scripts, uses eval (React Fast Refresh) + WebAssembly (shiki) and a websocket for
// HMR, all of which a strict script-src/connect-src would break. connect-src stays
// permissive so the demo's split-host API (a different origin than the frontend)
// and the HMR socket both work.
const securityHeaders: Record<string, string> = {
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '0',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: ws: wss:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; '),
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Round 25 Wave 7 (item 7 / R24-5): strip `console.*` from production
  // builds so any auth-flow logging that slipped past the safe-summary
  // helpers doesn't reach the browser console / extension capture /
  // future Sentry-style telemetry. Dev keeps console for local
  // debugging. Cast through `unknown` because Vite's ESBuildOptions
  // type narrows the esbuild surface and doesn't expose `drop`, even
  // though esbuild itself honours it at build time.
  esbuild: (mode === 'production' ? { drop: ['console', 'debugger'] } : undefined) as never,
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Allow the public hostname so Vite accepts requests via Cloudflare Tunnel / reverse proxy.
    // VITE_ALLOWED_HOST is set in docker-compose.tunnel.yml (e.g. "sw.vhco.pro").
    // Localhost is always allowed by Vite by default.
    allowedHosts: [
      ...(process.env.VITE_ALLOWED_HOST ? [process.env.VITE_ALLOWED_HOST] : []),
      'sw.vhco.pro',
    ],
    headers: securityHeaders,
    watch: {
      usePolling: true, // Needed for Docker file watching
    },
  },
  preview: {
    headers: securityHeaders,
  },
}))
