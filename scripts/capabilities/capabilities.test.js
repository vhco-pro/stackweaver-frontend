// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { refresh, build, check, readSource } = require('./index.js');

const start = '<!-- capabilities:start -->';
const end = '<!-- capabilities:end -->';
const record = (overrides = {}) => ({ id: 'inventory-sync', name: 'Inventory sync', summary: 'Refresh hosts from a cloud source.', area: 'ansible', availability: 'available', evidence: ['core/source.go'], ...overrides });
const guide = (records) => `---\ndescription: Fixture guide\ncapabilities: ${JSON.stringify(records, null, 2)}\n---\n# Guide\n\nAuthored instructions.\n`;
function write(root, relative, value) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
}
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'capabilities-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'scripts/capabilities/config.json', { schema: 1, areas: [{ id: 'ansible', name: 'Ansible' }, { id: 'opentofu', name: 'OpenTofu' }], views: [{ path: 'features/README.md' }, { path: 'features/ansible/README.md', area: 'ansible' }, { path: 'features/opentofu/README.md', area: 'opentofu' }] });
  for (const relative of ['features/README.md', 'features/ansible/README.md', 'features/opentofu/README.md']) write(root, 'docs/' + relative, `---\ndescription: Catalogue\n---\n# Features\n\nAuthored introduction.\n\n${start}\nold generated content\n${end}\n\nAuthored next steps.\n`);
  write(root, 'core/source.go', 'package source\n');
  write(root, 'docs/user-guides/inventory.md', guide([record()]));
  return root;
}
const read = (root, relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const output = (root) => JSON.parse(read(root, 'frontend/public/docs-capabilities.json'));

test('one metadata edit updates canonical and filtered views while preserving narrative', t => {
  const root = fixture(t);
  refresh(root); build(root); check(root);
  const first = read(root, 'docs/features/README.md');
  assert.match(first, /Inventory sync/);
  assert.match(first, /Authored introduction/); assert.match(first, /Authored next steps/);
  assert.doesNotMatch(read(root, 'docs/features/opentofu/README.md'), /Inventory sync/);
  assert.equal(output(root).capabilities.length, 1);
  assert.equal(output(root).capabilities[0].guide, '/docs/user-guides/inventory');
  assert.doesNotMatch(JSON.stringify(output(root)), /source\.go|sha256|evidence/);
  build(root); assert.equal(read(root, 'docs/features/README.md'), first, 'repeated builds are stable');
  write(root, 'docs/user-guides/inventory.md', guide([record({ name: 'Cloud inventories', limitations: 'Syncs execute on the API host.' })]));
  assert.throws(() => build(root), /stale|hash/i);
  refresh(root); build(root);
  for (const view of ['features/README.md', 'features/ansible/README.md']) {
    const text = read(root, 'docs/' + view);
    assert.match(text, /Cloud inventories/); assert.match(text, /Syncs execute on the API host/); assert.doesNotMatch(text, /Inventory sync/);
  }
});

test('add, move and delete require a matching snapshot and derive the new guide URL', t => {
  const root = fixture(t); refresh(root); build(root);
  write(root, 'docs/user-guides/second.md', guide([record({ id: 'second', name: 'Second' })]));
  assert.throws(() => build(root), /snapshot|record/i);
  refresh(root); build(root); assert.equal(output(root).capabilities.length, 2);
  fs.renameSync(path.join(root, 'docs/user-guides/second.md'), path.join(root, 'docs/user-guides/moved.md'));
  assert.throws(() => build(root), /snapshot|guide|hash|stale/i);
  refresh(root); build(root); assert.equal(output(root).capabilities.find(x => x.id === 'second').guide, '/docs/user-guides/moved');
  fs.rmSync(path.join(root, 'docs/user-guides/moved.md'));
  assert.throws(() => build(root), /snapshot|record/i);
  refresh(root); build(root); assert.equal(output(root).capabilities.length, 1);
  write(root, 'docs/user-guides/inventory.md', guide([]));
  refresh(root); build(root); assert.equal(output(root).capabilities.length, 0);
  assert.doesNotMatch(read(root, 'docs/features/README.md'), /Inventory sync/);
});

test('duplicate IDs, malformed metadata, unsupported states and missing evidence block claims', t => {
  const root = fixture(t);
  for (const value of [record({ availability: 'complete' }), record({ availability: 'planned' }), record({ evidence: [] }), record({ evidence: ['core/missing.go'] }), record({ evidence: ['../secret'] }), record({ evidence: ['docs/guide.md'] }), record({ name: '' }), record({ area: 'unknown' }), record({ id: 'Bad ID' }), record({ surprise: true }), record({ summary: '<script>alert(1)</script>' })]) {
    write(root, 'docs/user-guides/inventory.md', guide([value]));
    assert.throws(() => refresh(root), /capabilit|evidence|planned|area|id|name|summary|field/i);
  }
  write(root, 'docs/user-guides/inventory.md', guide([record(), record()]));
  assert.throws(() => refresh(root), /duplicate/i);
  write(root, 'docs/user-guides/inventory.md', '---\ncapabilities: invalid\n---\n# Invalid');
  assert.throws(() => refresh(root), /JSON|array|capabilit/i);
});

test('preview is labelled; private and ignored pages cannot become public capabilities', t => {
  const root = fixture(t);
  write(root, 'docs/user-guides/inventory.md', guide([record({ availability: 'preview' })]));
  write(root, 'docs/internal/hidden.md', guide([record({ id: 'hidden' })]));
  write(root, 'docs/user-guides/hidden-plan.md', guide([record({ id: 'ignored' })]));
  refresh(root); build(root);
  assert.equal(output(root).capabilities.length, 1);
  assert.match(read(root, 'docs/features/README.md'), /Preview/);
  assert.doesNotMatch(read(root, 'docs/features/README.md'), /hidden|ignored/);
});

test('live evidence changes fail monorepo check, offline assembly uses reviewed hashes', t => {
  const root = fixture(t); refresh(root); build(root);
  write(root, 'core/source.go', 'package changed\n');
  assert.throws(() => check(root), /evidence|stale/i);
  build(root);
  refresh(root); build(root); check(root);
  fs.rmSync(path.join(root, 'core'), { recursive: true });
  build(root);
  assert.throws(() => check(root), /evidence/i);
  const snapshot = JSON.parse(read(root, 'docs/.capability-evidence.json'));
  snapshot.records[0].evidence[0].sha256 = 'invalid';
  write(root, 'docs/.capability-evidence.json', snapshot);
  assert.throws(() => build(root), /snapshot|hash|evidence/i);
});

test('missing view targets, invalid markers, stale output and self-changing ownership fail', t => {
  const root = fixture(t); refresh(root); build(root);
  fs.rmSync(path.join(root, 'frontend/public/docs-capabilities.json'));
  check(root); // Public JSON is ephemeral and absent in a fresh CI checkout.
  write(root, 'frontend/public/docs-capabilities.json', '{}');
  assert.throws(() => check(root), /output|stale/i);
  build(root);
  const view = read(root, 'docs/features/README.md');
  write(root, 'docs/features/README.md', view + start);
  assert.throws(() => build(root), /marker|region/i);
  write(root, 'docs/features/README.md', guide([record({ id: 'self' })]) + '\n' + start + '\n' + end);
  assert.throws(() => refresh(root), /view|generated/i);
  fs.rmSync(path.join(root, 'docs/features/README.md'));
  assert.throws(() => build(root), /view|target/i);
});

test('normal satellite build indexes generated views and strips private metadata from public lanes', t => {
  const root = fixture(t); refresh(root);
  const scripts = path.join(root, 'scripts');
  fs.copyFileSync(path.join(__dirname, '../build-docs-index.js'), path.join(scripts, 'build-docs-index.js'));
  fs.copyFileSync(path.join(__dirname, 'index.js'), path.join(scripts, 'capabilities/index.js'));
  fs.mkdirSync(path.join(root, 'frontend'), { recursive: true });
  fs.symlinkSync(path.join(__dirname, '../../frontend/node_modules'), path.join(root, 'frontend/node_modules'));
  fs.rmSync(path.join(root, 'core'), { recursive: true });
  assert.equal(fs.existsSync(path.join(root, '.git')), false);
  execFileSync(process.execPath, [path.join(scripts, 'build-docs-index.js')], { cwd: root, stdio: 'pipe' });
  const index = JSON.parse(read(root, 'frontend/public/docs-index.json'));
  assert.ok(index.flat['features/README.md']);
  assert.ok(index.flat['user-guides/inventory.md']);
  assert.doesNotMatch(read(root, 'frontend/public/docs/user-guides/inventory.md'), /capabilities:|source.go/);
  assert.match(read(root, 'docs/user-guides/inventory.md'), /capabilities:/, 'authored source stays intact');
  for (const relative of ['frontend/public/docs-index.json', 'frontend/public/docs-search-index.json']) assert.doesNotMatch(read(root, relative), /source.go|guideHash|metadataHash|evidence/);
  assert.equal(fs.existsSync(path.join(root, 'frontend/public/docs/.capability-evidence.json')), false);
  const search = JSON.parse(read(root, 'frontend/public/docs-search-index.json'));
  assert.ok(Object.values(search.storedFields).some(x => x.path === 'features/README.md'));
  assert.match(read(root, 'frontend/public/docs/features/ansible/README.md'), /Inventory sync/);
});


test('container filesystem-root sources work while checkout symlink escapes remain blocked', t => {
  const root = fixture(t);
  const file = path.join(root, 'docs/user-guides/inventory.md');
  const filesystemRoot = path.parse(root).root;
  assert.equal(readSource(filesystemRoot, path.relative(filesystemRoot, file), 'guide'), read(root, 'docs/user-guides/inventory.md'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'capabilities-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.writeFileSync(path.join(outside, 'private.md'), 'private contents');
  fs.symlinkSync(path.join(outside, 'private.md'), path.join(root, 'docs/user-guides/escape.md'));
  assert.throws(() => readSource(root, 'docs/user-guides/escape.md', 'guide'), /escapes repository/);
  assert.throws(() => readSource(root, '../private.md', 'guide'), /invalid/);
});
