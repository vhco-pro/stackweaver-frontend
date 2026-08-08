// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// The strict production CSP in security-headers.conf pins a SHA-256 of the inline
// theme script in index.html (script-src 'sha256-...'). If that script is edited
// without recomputing the hash, the browser refuses to execute it under CSP and
// the app renders a blank page in production. This test recomputes the hash from
// index.html and fails if security-headers.conf has drifted, so CI catches it
// instead of a user discovering it after deploy.
//
// To fix a failure: recompute the hash and update security-headers.conf:
//   node -e "const {readFileSync}=require('fs');const {createHash}=require('crypto');const h=readFileSync('index.html','utf8').match(/<script>([\\s\\S]*?Apply theme class[\\s\\S]*?)<\\/script>/)[1];console.log('sha256-'+createHash('sha256').update(h).digest('base64'))"

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

test('CSP script-src hash matches the inline theme script in index.html', () => {
  const html = readFileSync(path.join(frontendRoot, 'index.html'), 'utf8')
  const conf = readFileSync(path.join(frontendRoot, 'security-headers.conf'), 'utf8')

  const match = html.match(/<script>([\s\S]*?Apply theme class[\s\S]*?)<\/script>/)
  if (!match) {
    throw new Error('inline theme script (marker "Apply theme class") not found in index.html')
  }

  const hash = 'sha256-' + createHash('sha256').update(match[1], 'utf8').digest('base64')

  expect(
    conf.includes(hash),
    `security-headers.conf CSP is missing the current theme-script hash '${hash}'. ` +
      `The inline theme script in index.html changed - recompute and update the ` +
      `script-src hash in frontend/security-headers.conf.`,
  ).toBe(true)
})
