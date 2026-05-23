// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'

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
    watch: {
      usePolling: true, // Needed for Docker file watching
    },
  },
}))
