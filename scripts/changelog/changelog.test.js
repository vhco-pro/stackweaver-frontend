// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Hook-exported repository selectors override cwd. These tests create foreign
// repositories, so clear selectors in this test process before any fixture Git.
for (const key of Object.keys(process.env)) {
  if (key.startsWith('GIT_')) delete process.env[key];
}

const { candidate, checkCandidates, render, collectRelease, mergeSnapshots, build, checkHistory, resolveChanges } = require('./index.js');

const source = 'a'.repeat(40), tagSha = 'b'.repeat(40), syncSha = 'c'.repeat(40);
const config = { repository: 'michielvha/stackweaver', baseline: source, components: { api: { repository: 'vhco-pro/stackweaver-api', artifact: 'ghcr.io/vhco-pro/stackweaver-api' } } };
const entry = () => ({ id: 'safe-sync', title: 'Failed syncs preserve inventory', area: 'Ansible', kind: 'Fixed', reviewed: true, audience: 'Dynamic inventory operators.', before: 'A failed request could remove hosts.', after: 'A failed request preserves hosts.', action: 'Fix the source error and retry.', details: ['A successful empty result still prunes owned hosts.'], guides: [{ title: 'Dynamic inventories', path: '/docs/user-guides/dynamic-inventories' }], sourceCommits: [source], requiredComponents: ['api'], availability: ['api@1.2.3'] });
const release = () => ({ id: 'api@1.2.3', component: 'api', repository: config.components.api.repository, tag: '1.2.3', tagCommit: tagSha, publishedAt: '2026-10-18T21:00:00Z', url: 'https://github.com/vhco-pro/stackweaver-api/releases/tag/1.2.3', sourceCommit: syncSha, sync: { url: 'https://github.com/vhco-pro/stackweaver-api/pull/1', mergeCommit: tagSha }, workflow: { url: 'https://github.com/vhco-pro/stackweaver-api/actions/runs/1', conclusion: 'success', headSha: tagSha }, artifact: { name: config.components.api.artifact, digest: 'sha256:' + 'd'.repeat(64), provenanceUrl: 'https://github.com/vhco-pro/stackweaver-api/releases/download/1.2.3/provenance.intoto.jsonl' }, includedCommits: [source] });
function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-changelog-'));
  fs.mkdirSync(path.join(root, 'docs/user-guides'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/user-guides/dynamic-inventories.md'), '# Dynamic inventories');
  return root;
}
function fixture() {
  const r = release();
  const api = {
    [`repos/${r.repository}/releases/latest`]: { tag_name: r.tag, html_url: r.url, published_at: r.publishedAt, draft: false, prerelease: false, assets: [{ id: 7, name: 'provenance.intoto.jsonl', browser_download_url: r.artifact.provenanceUrl }] },
    [`repos/${r.repository}/commits/${r.tag}`]: { sha: tagSha },
    [`repos/${r.repository}/commits/${tagSha}/pulls`]: [{ merged_at: r.publishedAt, merge_commit_sha: tagSha, html_url: r.sync.url, body: 'Automated sync from michielvha/stackweaver@ccccccc.' }],
    [`repos/${r.repository}/actions/runs?head_sha=${tagSha}&per_page=100`]: { workflow_runs: [{ path: '.github/workflows/release.yml', status: 'completed', conclusion: 'success', head_sha: tagSha, html_url: r.workflow.url }] },
  };
  const statement = { predicateType: 'https://slsa.dev/provenance/v1', subject: [{ name: r.artifact.name, digest: { sha256: 'd'.repeat(64) } }], predicate: { buildDefinition: { externalParameters: { workflow: { ref: 'refs/tags/1.2.3', repository: 'https://github.com/' + r.repository, path: '.github/workflows/release.yml' } }, resolvedDependencies: [{ uri: 'git+https://github.com/' + r.repository + '@refs/tags/1.2.3', digest: { gitCommit: tagSha } }] }, runDetails: { metadata: { invocationId: r.workflow.url + '/attempts/1' } } } };
  const io = { api: endpoint => structuredClone(api[endpoint]), asset: () => JSON.stringify({ dsseEnvelope: { payload: Buffer.from(JSON.stringify(statement)).toString('base64') } }), resolve: () => syncSha, ancestor: () => true, reverts: () => [] };
  return { api, statement, io };
}

test('candidate policy includes scopes, breaking changes of any type and unknown messages', () => {
  assert.equal(candidate({ sha: source, message: 'feat(ansible): add sync history' }).scope, 'ansible');
  assert.equal(candidate({ sha: source, message: 'docs: update guide' }), null);
  assert.equal(candidate({ sha: source, message: 'chore: build\n\nBREAKING CHANGE: replace configuration' }).breaking, true);
  assert.equal(candidate({ sha: source, message: 'docs(api)!: retire configuration' }).breaking, true);
  assert.equal(candidate({ sha: source, message: 'Merge branch configuration\n\nBREAKING CHANGE: replace setup', parents: [tagSha, syncSha] })?.breaking, true);
  assert.equal(candidate({ sha: source, message: 'Improve authentication' }).type, 'unknown');
});

test('candidate coverage groups source SHAs and stable trailers; uncovered changes fail', () => {
  const changes = [entry()];
  assert.deepEqual(checkCandidates([{ sha: source, message: 'fix(ansible): preserve inventory' }], changes, []), []);
  assert.equal(checkCandidates([{ sha: syncSha, message: 'feat: ship\n\nChangelog: safe-sync' }], changes, []).length, 1, 'published IDs cannot authorize unrelated commits');
  assert.deepEqual(checkCandidates([{ sha: syncSha, message: 'feat: ship\n\nChangelog: safe-sync' }], [{ ...entry(), availability: [] }], []), []);
  assert.equal(checkCandidates([{ sha: syncSha, message: 'fix: change behavior' }], changes, []).length, 1);
  assert.deepEqual(checkCandidates([{ sha: syncSha, message: 'refactor: remove dead code' }], changes, [{ commit: syncSha, reason: 'No reachable behavior changes.' }]), []);
  assert.equal(checkCandidates([{ sha: syncSha, message: 'fix: change behavior\n\nChangelog: missing' }], changes, []).length, 1);
});

test('offline generation is deterministic, links component releases and keeps actions visible', t => {
  const root = workspace(); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const result = render({ config, changes: [entry()], releases: [release()], docsRoot: path.join(root, 'docs') });
  assert.equal(result, render({ config, changes: [entry()], releases: [release()], docsRoot: path.join(root, 'docs') }));
  assert.match(result, /Confirmed available by 2026-10-18/);
  assert.match(result, /API 1\.2\.3/);
  assert.ok(result.indexOf('Fix the source error') < result.indexOf('<details>'));
  assert.match(result, /A successful empty result still prunes/);
  assert.doesNotMatch(result, /Source commit|internal\/|sha256:/);
});

test('pending changes stay unpublished and required component/commit evidence cannot be omitted', t => {
  const root = workspace(); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const draft = { ...entry(), availability: [] };
  assert.doesNotMatch(render({ config, changes: [draft], releases: [], docsRoot: path.join(root, 'docs') }), /Failed syncs preserve/);
  const invalid = { ...release(), includedCommits: [] };
  assert.throws(() => render({ config, changes: [entry()], releases: [invalid], docsRoot: path.join(root, 'docs') }), /inclusion/i);
  assert.throws(() => render({ config, changes: [entry(), entry()], releases: [release()], docsRoot: path.join(root, 'docs') }), /duplicate/i);
});

test('unreviewed entries, missing audience/action, missing artifacts and unsafe/private links fail', t => {
  const root = workspace(); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const args = { config, changes: [entry()], releases: [release()], docsRoot: path.join(root, 'docs') };
  for (const patch of [{ reviewed: false }, { audience: '' }, { action: '' }, { guides: [{ title: 'Internal', path: '/docs/internal/tasks/lessons' }] }, { guides: [{ title: 'Bad', path: 'javascript:alert(1)' }] }]) {
    assert.throws(() => render({ ...args, changes: [{ ...entry(), ...patch }] }));
  }
  assert.throws(() => render({ ...args, releases: [{ ...release(), artifact: null }] }), /artifact/i);
  const html = render({ ...args, changes: [{ ...entry(), title: '<img src=x onerror=alert(1)>' }] });
  assert.doesNotMatch(html, /<img/);
});

test('collector binds source sync, successful workflow and published artifact to the selected tag', async () => {
  const f = fixture();
  const result = await collectRelease('api', config, [entry()], f.io);
  assert.equal(result.tagCommit, tagSha);
  assert.equal(result.sourceCommit, syncSha);
  assert.equal(result.artifact.digest, release().artifact.digest);
  assert.deepEqual(result.includedCommits, [source]);
});

test('collector rejects skipped artifact, failed publication and ambiguous sync provenance', async () => {
  for (const mutation of [
    f => { f.statement.subject = []; },
    f => { f.statement.predicate.buildDefinition.externalParameters.workflow.repository = 'https://github.com/unrelated/repo'; },
    f => { f.statement.predicate.buildDefinition.resolvedDependencies[0].digest.gitCommit = source; },
    f => { f.statement.predicate.runDetails.metadata.invocationId = 'https://github.com/vhco-pro/stackweaver-api/actions/runs/999/attempts/1'; },
    f => { f.statement.predicate.buildDefinition.externalParameters.workflow.ref = 'refs/tags/old'; },
    f => { f.api[`repos/${config.components.api.repository}/actions/runs?head_sha=${tagSha}&per_page=100`].workflow_runs[0].conclusion = 'failure'; },
    f => { f.api[`repos/${config.components.api.repository}/commits/${tagSha}/pulls`] = []; },
    f => { f.api[`repos/${config.components.api.repository}/releases/latest`].prerelease = true; },
  ]) { const f = fixture(); mutation(f); await assert.rejects(() => collectRelease('api', config, [entry()], f.io)); }
});

test('reverted ancestry does not imply availability; reapplication requires reviewed presence evidence', async () => {
  const f = fixture(); f.io.reverts = () => ['e'.repeat(40)];
  const reverted = await collectRelease('api', config, [entry()], f.io);
  assert.deepEqual(reverted.includedCommits, []);
  const reapplied = { ...entry(), presence: [{ release: 'api@1.2.3', reason: 'Reapplied and verified against this source.', evidence: ['core/services/ansible/inventory_sync_notice.go'] }] };
  assert.deepEqual((await collectRelease('api', config, [reapplied], f.io)).includedCommits, [source]);
});

test('refresh merges new observations without rewriting released history', () => {
  assert.deepEqual(mergeSnapshots([release()], [release()]), [release()]);
  assert.throws(() => mergeSnapshots([release()], [{ ...release(), publishedAt: '2026-10-19T21:00:00Z' }]), /immutable/i);
  const extended = { ...release(), includedCommits: [source, syncSha] };
  assert.deepEqual(mergeSnapshots([release()], [extended]), [extended], 'later historical review can add verified inclusion without changing release identity/date');
  assert.throws(() => mergeSnapshots([extended], [release()]), /inclusion/i);
});

test('ordinary checks preserve committed release identity and availability membership', () => {
  const previous = { config, changes: [entry()], releases: [release()] };
  assert.doesNotThrow(() => checkHistory(previous, structuredClone(previous)));
  assert.throws(() => checkHistory(previous, { ...previous, releases: [{ ...release(), publishedAt: '2026-11-01T00:00:00Z' }] }), /immutable/i);
  assert.throws(() => checkHistory(previous, { ...previous, changes: [{ ...entry(), availability: [] }] }), /availability/i);
  assert.throws(() => checkHistory(previous, { ...previous, config: { ...config, baseline: tagSha } }), /baseline/i);
});

test('refresh resolves pending trailers to main SHAs after squash without hand-editing source commits', () => {
  const pending = { ...entry(), sourceCommits: [], draftCommits: [source], availability: [] };
  const resolved = resolveChanges([pending], [{ sha: tagSha, message: 'feat: combined delivery\n\nChangelog: safe-sync' }]);
  assert.deepEqual(resolved[0].sourceCommits, [tagSha]);
  assert.deepEqual(resolveChanges(resolved, [{ sha: tagSha, message: 'feat: combined delivery\n\nChangelog: safe-sync' }]), resolved);
  assert.deepEqual(resolveChanges([entry()], [{ sha: tagSha, message: 'feat: unrelated\n\nChangelog: safe-sync' }]), [entry()], 'released membership cannot be rebound');
});

test('satellite-shaped offline build needs only docs and shipped scripts/data, and joins index/search inputs', t => {
  const root = workspace(); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'scripts/changelog/data'), { recursive: true });
  for (const [file, value] of Object.entries({ config, changes: [entry()], releases: [release()], dispositions: [] })) fs.writeFileSync(path.join(root, 'scripts/changelog/data', file + '.json'), JSON.stringify(value));
  const output = build(root);
  assert.equal(fs.readFileSync(path.join(root, 'docs/changelog.md'), 'utf8'), output);
  assert.ok(!fs.existsSync(path.join(root, '.git')));
  assert.ok(!fs.existsSync(path.join(root, 'backend')));
  assert.match(output, /Stackweaver changelog/);
});

test('candidate check is tested against real full Git messages rather than subjects alone', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-changelog-git-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '-q'); git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-qm', 'chore: baseline');
  const base = git('rev-parse', 'HEAD');
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-qm', 'chore: internal\n\nBREAKING CHANGE: removed required setup');
  const { readCommits } = require('./index.js');
  const commits = readCommits(root, base);
  assert.equal(commits.length, 1);
  assert.equal(checkCandidates(commits, [], []).length, 1);
});

test('structural two-parent merges do not become uncovered unknown changes; actual branch commits still do', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-changelog-merge-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-q', '-b', 'main'); git('commit', '--allow-empty', '-qm', 'chore: baseline'); const base = git('rev-parse', 'HEAD');
  git('checkout', '-qb', 'topic'); git('commit', '--allow-empty', '-qm', 'fix: branch change'); const topic = git('rev-parse', 'HEAD');
  git('checkout', 'main'); git('commit', '--allow-empty', '-qm', 'fix: main change'); const main = git('rev-parse', 'HEAD');
  git('merge', '--no-ff', 'topic', '-m', 'Merge branch topic');
  const { readCommits } = require('./index.js'); const commits = readCommits(root, base);
  assert.equal(commits.length, 3);
  assert.equal(checkCandidates(commits, [], []).length, 2);
  assert.deepEqual(checkCandidates(commits, [], [{ commit: topic, reason: 'Reviewed internal repair.' }, { commit: main, reason: 'Reviewed internal repair.' }]), []);
  assert.equal(candidate({ sha: source, message: 'Merge an authentication change', parents: [] }).type, 'unknown');
});


test('Git fixture tests preserve the enclosing hook repository', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-changelog-hook-canary-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: root, env, encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-q', '-b', 'main');
  git('commit', '--allow-empty', '-qm', 'chore: hook canary');
  const head = git('rev-parse', 'HEAD');
  const refs = git('show-ref');
  delete env.NODE_TEST_CONTEXT;
  const output = execFileSync(process.execPath, ['--test', '--test-name-pattern=candidate check is tested|structural two-parent', __filename], {
    cwd: root,
    env: { ...env, GIT_DIR: path.join(root, '.git'), GIT_WORK_TREE: root, GIT_INDEX_FILE: path.join(root, '.git/index') },
    stdio: 'pipe', encoding: 'utf8',
  });
  assert.match(output, /candidate check is tested/);
  assert.match(output, /structural two-parent merges/);
  assert.equal(git('rev-parse', 'HEAD'), head, 'temporary fixture tests must not commit to the enclosing hook repository');
  assert.equal(git('show-ref'), refs, 'temporary fixture tests must not change the enclosing repository refs');
});

test('independent release refresh retains verified components and leaves incomplete changes unpublished', async t => {
  const root = workspace(); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const f = fixture();
  const cfg = { ...config, components: { ...config.components, runner: { repository: 'vhco-pro/runner', artifact: 'ghcr.io/vhco-pro/runner' } } };
  for (const [endpoint, value] of Object.entries({ ...f.api })) {
    const mirrored = JSON.parse(JSON.stringify(value).replaceAll('stackweaver-api', 'runner'));
    if (endpoint.endsWith('/releases/latest')) mirrored.assets = [];
    f.api[endpoint.replace('stackweaver-api', 'runner')] = mirrored;
  }
  const standalone = { ...entry(), availability: [] };
  const dependent = { ...entry(), id: 'runner-dependent', title: 'Requires both components', requiredComponents: ['api', 'runner'], availability: [] };
  const result = await require('./index.js').refreshReleases(cfg, [standalone, dependent], [], f.io);
  assert.deepEqual(result.failures.map(failure => failure.component), ['runner']);
  assert.match(result.failures[0].message, /Missing published artifact provenance/);
  assert.deepEqual(result.releases.map(release => release.id), ['api@1.2.3']);
  assert.deepEqual(result.changes[0].availability, ['api@1.2.3']);
  assert.deepEqual(result.changes[1].availability, []);
  assert.deepEqual(standalone.availability, [], 'refresh does not mutate reviewed inputs');
  const markdown = render({ config: cfg, ...result, docsRoot: path.join(root, 'docs') });
  assert.match(markdown, /Failed syncs preserve inventory/);
  assert.doesNotMatch(markdown, /Requires both components/);
});

test('release entries lead with user impact and action while preserving historical context', t => {
  const root = workspace(); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const change = entry();
  const markdown = render({ config, changes: [change], releases: [release()], docsRoot: path.join(root, 'docs') });
  const details = markdown.indexOf('<details>');
  assert.ok(markdown.indexOf(change.after) < markdown.indexOf('**Action:**'));
  assert.ok(markdown.indexOf('**Action:**') < details);
  assert.ok(markdown.indexOf(change.before) > details, 'prior behavior remains available as supporting context');
  assert.ok(markdown.includes(change.audience));
  assert.ok(markdown.includes(change.details[0]));
});
