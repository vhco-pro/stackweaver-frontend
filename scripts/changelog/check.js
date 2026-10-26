#!/usr/bin/env node
// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
const path = require('node:path');
const { load, build, checkCandidates, checkHistory, readCommits, git } = require('./index.js');
const root = path.resolve(__dirname, '../..');
try {
  const { config, changes, dispositions } = load(root);
  const current = load(root);
  let previousRef = process.env.CHANGELOG_BASE_SHA;
  if (!previousRef || /^0+$/.test(previousRef)) {
    try { previousRef = git(root, 'merge-base', 'origin/main', 'HEAD'); } catch { previousRef = 'HEAD'; }
    if (previousRef === git(root, 'rev-parse', 'HEAD')) {
      try { previousRef = git(root, 'rev-parse', 'HEAD^'); } catch { /* Initial repository commit. */ }
    }
  }
  let previous;
  try {
    previous = Object.fromEntries(['config', 'changes', 'releases'].map(name => [name, JSON.parse(git(root, 'show', `${previousRef}:scripts/changelog/data/${name}.json`))]));
  } catch (error) {
    // Absence is valid only for initial rollout; malformed existing data must still fail.
    let exists = false;
    try { git(root, 'cat-file', '-e', `${previousRef}:scripts/changelog/data/config.json`); exists = true; } catch { /* Initial rollout. */ }
    if (exists) throw error;
  }
  checkHistory(previous, current);
  for (const release of current.releases) {
    for (const sha of release.includedCommits) git(root, 'merge-base', '--is-ancestor', sha, release.sourceCommit);
  }
  const missing = checkCandidates(readCommits(root, config.baseline), changes, dispositions);
  if (missing.length) throw new Error('Unreviewed changelog candidates:\n' + missing.map(c => `${c.sha.slice(0, 8)} ${c.message.split('\n')[0]}`).join('\n'));
  build(root, true);
  const dirty = git(root, 'status', '--porcelain', '--untracked-files=no');
  console.log('Changelog candidate coverage and generated output passed.');
  if (dirty) console.log('Working-tree edits are present. Review their impact record and future commit message before committing; CI checks the resulting commits.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
