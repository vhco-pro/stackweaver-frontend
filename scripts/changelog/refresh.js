#!/usr/bin/env node
// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { load, git, readCommits, refreshReleases, resolveChanges, checkHistory } = require('./index.js');
const root = path.resolve(__dirname, '../..');
function gh(args) { return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 }); }
async function main() {
  const original = load(root);
  const { config, releases } = original;
  const main = JSON.parse(gh(['api', `repos/${config.repository}/commits/main`])).sha;
  const changes = resolveChanges(original.changes, readCommits(root, config.baseline, main));
  const io = {
    api: endpoint => JSON.parse(gh(['api', endpoint])),
    asset: (repo, id) => gh(['api', '-H', 'Accept: application/octet-stream', `repos/${repo}/releases/assets/${id}`]),
    attestation: (repo, artifact, tag) => JSON.parse(gh(['attestation', 'verify', `oci://${artifact}:${tag}`, '--repo', repo,
      '--cert-identity', `https://github.com/${repo}/.github/workflows/release.yml@refs/tags/${tag}`,
      '--cert-oidc-issuer', 'https://token.actions.githubusercontent.com', '--predicate-type', 'https://slsa.dev/provenance/v1', '--format', 'json'])),
    resolve: ref => git(root, 'rev-parse', '--verify', `${ref}^{commit}`),
    ancestor: (base, head) => { try { git(root, 'merge-base', '--is-ancestor', base, head); return true; } catch { return false; } },
    reverts: (sha, head) => readCommits(root, sha, head).filter(c => c.message.toLowerCase().includes('this reverts commit ' + sha.toLowerCase())).map(c => c.sha),
  };
  const result = await refreshReleases(config, changes, releases, io);
  checkHistory(original, { ...original, changes: result.changes, releases: result.releases });
  for (const release of result.releases.filter(r => !releases.some(previous => previous.id === r.id))) {
    console.log(`Verified ${release.id}: source sync, successful publication and artifact digest.`);
  }
  fs.writeFileSync(path.join(__dirname, 'data/releases.json'), JSON.stringify(result.releases, null, 2) + '\n');
  fs.writeFileSync(path.join(__dirname, 'data/changes.json'), JSON.stringify(result.changes, null, 2) + '\n');
  for (const failure of result.failures) console.error(`Unverified ${failure.component}: ${failure.message}`);
  if (result.failures.length) process.exitCode = 1;
  console.log('Updated local source/availability evidence for reviewed records. Review the diff before rebuilding. Changes missing required evidence remain unpublished. No GitHub writes performed.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
