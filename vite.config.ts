// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss(),
        autoprefixer(),
      ],
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Allow the public hostname so Vite accepts requests via Cloudflare Tunnel / reverse proxy.
    // VITE_ALLOWED_HOST is set in docker-compose.tunnel.yml (e.g. "sw.vhco.pro").
    // Localhost is always allowed by Vite by default.
    allowedHosts: process.env.VITE_ALLOWED_HOST
      ? [process.env.VITE_ALLOWED_HOST]
      : [],
    watch: {
      usePolling: true, // Needed for Docker file watching
    },
  },
})
