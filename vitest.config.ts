// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: false,
    // happy-dom gives component tests (@testing-library/react) a DOM without a real
    // browser. Pure-logic helper tests are unaffected — they just ignore the DOM globals.
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
