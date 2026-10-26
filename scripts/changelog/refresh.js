#!/usr/bin/env node
// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { load, git, readCommits, collectRelease, mergeSnapshots, resolveChanges, checkHistory } = require('./index.js');
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
    resolve: ref => git(root, 'rev-parse', '--verify', `${ref}^{commit}`),
    ancestor: (base, head) => { try { git(root, 'merge-base', '--is-ancestor', base, head); return true; } catch { return false; } },
    reverts: (sha, head) => readCommits(root, sha, head).filter(c => c.message.toLowerCase().includes('this reverts commit ' + sha.toLowerCase())).map(c => c.sha),
  };
  const observed = [];
  for (const id of Object.keys(config.components)) {
    observed.push(await collectRelease(id, config, changes, io));
    console.log(`Verified ${observed.at(-1).id}: source sync, successful publication and artifact digest.`);
  }
  const merged = mergeSnapshots(releases, observed);
  for (const change of changes.filter(c => c.reviewed && !c.availability.length && c.sourceCommits.length)) {
    const available = change.requiredComponents.map(id => merged.filter(r => r.component === id && change.sourceCommits.every(sha => r.includedCommits.includes(sha))).sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))[0]);
    if (available.every(Boolean)) change.availability = available.map(r => r.id);
  }
  checkHistory(original, { ...original, changes, releases: merged });
  fs.writeFileSync(path.join(__dirname, 'data/releases.json'), JSON.stringify(merged, null, 2) + '\n');
  fs.writeFileSync(path.join(__dirname, 'data/changes.json'), JSON.stringify(changes, null, 2) + '\n');
  console.log('Updated local source/availability evidence for reviewed records. Review the diff before rebuilding. No GitHub writes performed.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
