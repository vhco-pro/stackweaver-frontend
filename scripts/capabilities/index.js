#!/usr/bin/env node
// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const START = '<!-- capabilities:start -->';
const END = '<!-- capabilities:end -->';
const SNAPSHOT = 'docs/.capability-evidence.json';
const OUTPUT = 'frontend/public/docs-capabilities.json';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const fail = message => { throw new Error(`Capability catalogue: ${message}`); };
const slug = value => typeof value === 'string' && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function fields(value, allowed, label) {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail(`invalid ${label} fields`);
}
function plain(value, label) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || /[<>\r\n]/.test(value)) fail(`invalid ${label}`);
  return value;
}
function relative(value, label) {
  if (typeof value !== 'string' || !value || value.includes('\\') || path.posix.normalize(value) !== value || value.startsWith('/') || value.split('/').some(x => x === '..' || x === '.')) fail(`invalid ${label} path`);
  return value;
}
function readJSON(root, file) {
  try { return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); }
  catch (error) { fail(`cannot read ${file}: ${error.message}`); }
}
function source(root, relativePath, label) {
  relative(relativePath, label);
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) fail(`missing ${label} ${relativePath}`);
  // Docker builds place scripts/docs/frontend under /; appending a separator to
  // that root produces // and rejects every valid source. Compare resolved paths.
  const resolved = path.relative(fs.realpathSync(root), fs.realpathSync(file));
  if (resolved === '..' || resolved.startsWith('..' + path.sep) || path.isAbsolute(resolved)) fail(`${label} escapes repository: ${relativePath}`);
  return fs.readFileSync(file, 'utf8');
}
function evidencePath(value) {
  relative(value, 'evidence');
  if (!/^(core|backend|frontend\/src|deploy|scripts|runner-images|\.github)\//.test(value)) fail(`evidence must name a code/config file: ${value}`);
  return value;
}

// Only this source-only field uses JSON flow syntax, which is also valid YAML. Other
// frontmatter stays with the host builder's parser. No optional YAML dependency is needed.
function metadata(sourceText) {
  const frontmatter = sourceText.match(/(?:^|\n)---[ \t]*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) return { records: [], strip: sourceText };
  const header = frontmatter[1];
  const keys = [...header.matchAll(/^capabilities:/gm)];
  if (keys.length > 1) fail('duplicate capabilities frontmatter field');
  if (!keys.length) return { records: [], strip: sourceText };
  const field = header.match(/^capabilities:[ \t]*([\s\S]*?)(?=^[a-zA-Z_][a-zA-Z0-9_-]*:|(?![\s\S]))/m);
  let records;
  try { records = JSON.parse(field[1].trim()); }
  catch { fail('capabilities must be a JSON flow array in frontmatter'); }
  if (!Array.isArray(records)) fail('capabilities must be an array');
  const strippedHeader = header.replace(field[0], '').replace(/\n+$/, '');
  const strip = sourceText.replace(frontmatter[0], frontmatter[0].replace(header, strippedHeader));
  return { records, strip };
}
function stripMetadata(content) { return metadata(content).strip; }
function load(root) {
  const config = readJSON(root, 'scripts/capabilities/config.json');
  fields(config, ['schema', 'areas', 'views'], 'config');
  if (config.schema !== 1 || !Array.isArray(config.areas) || !config.areas.length || !Array.isArray(config.views)) fail('invalid config schema');
  const areas = new Set(), views = new Set();
  for (const area of config.areas) {
    fields(area, ['id', 'name'], 'area');
    if (!slug(area.id) || areas.has(area.id)) fail('invalid or duplicate area id');
    plain(area.name, 'area name'); areas.add(area.id);
  }
  for (const view of config.views) {
    fields(view, ['path', 'area'], 'view'); relative(view.path, 'view');
    if (!view.path.endsWith('.md') || views.has(view.path) || (view.area !== undefined && !areas.has(view.area))) fail('invalid or duplicate view');
    views.add(view.path);
  }
  if (config.views.filter(view => view.area === undefined).length !== 1) fail('exactly one canonical view is required');
  return config;
}
function collect(root) {
  const config = load(root);
  // Reuse the same filter as navigation/copy/search, including excluded internal and plan files.
  const docsRoot = path.join(root, 'docs');
  const files = require('../build-docs-index.js').scanDocsDir(docsRoot, docsRoot).mdFiles;
  const publicPaths = new Set(files.map(file => file.relativePath.split(path.sep).join('/')));
  for (const view of config.views) if (!publicPaths.has(view.path)) fail(`view target is not a public guide: ${view.path}`);
  const records = [], ids = new Set();
  for (const file of files.sort((a, b) => a.relativePath < b.relativePath ? -1 : 1)) {
    const guide = file.relativePath.split(path.sep).join('/');
    const text = source(root, 'docs/' + guide, 'guide');
    const parsed = metadata(text);
    if (parsed.records.length && config.views.some(view => view.path === guide)) fail(`generated view cannot own capabilities: ${guide}`);
    for (const item of parsed.records) {
      fields(item, ['id', 'name', 'summary', 'area', 'availability', 'limitations', 'evidence'], 'metadata');
      if (!slug(item.id) || ids.has(item.id)) fail(`invalid or duplicate id: ${item.id}`);
      if (!config.areas.some(area => area.id === item.area)) fail(`unknown area: ${item.area}`);
      if (item.availability === 'planned') fail(`planned capabilities belong in internal planning: ${item.id}`);
      if (!['available', 'preview'].includes(item.availability)) fail(`invalid availability: ${item.id}`);
      if (!Array.isArray(item.evidence) || !item.evidence.length || new Set(item.evidence).size !== item.evidence.length) fail(`missing or duplicate evidence: ${item.id}`);
      const entry = { id: item.id, name: plain(item.name, 'name'), summary: plain(item.summary, 'summary'), area: item.area, availability: item.availability };
      if (item.limitations !== undefined) entry.limitations = plain(item.limitations, 'limitations');
      entry.evidence = item.evidence.map(evidencePath).sort();
      records.push({ ...entry, guide, guideHash: hash(text), metadataHash: hash(JSON.stringify(entry)) });
      ids.add(item.id);
    }
  }
  records.sort((a, b) => a.id < b.id ? -1 : 1);
  return { config, records };
}
function snapshotFor(root, records) {
  return { schema: 1, records: records.map(record => ({ id: record.id, guide: record.guide, guideHash: record.guideHash, metadataHash: record.metadataHash, evidence: record.evidence.map(file => ({ path: file, sha256: hash(source(root, file, 'evidence')) })) })) };
}
function validateSnapshot(root, records, live) {
  const snapshot = readJSON(root, SNAPSHOT);
  fields(snapshot, ['schema', 'records'], 'snapshot');
  if (snapshot.schema !== 1 || !Array.isArray(snapshot.records) || snapshot.records.length !== records.length) fail('snapshot record set is stale');
  const seen = new Set();
  for (const saved of snapshot.records) {
    fields(saved, ['id', 'guide', 'guideHash', 'metadataHash', 'evidence'], 'snapshot record');
    const current = records.find(record => record.id === saved.id);
    if (!current || seen.has(saved.id) || saved.guide !== current.guide || !digest(saved.guideHash) || saved.guideHash !== current.guideHash || !digest(saved.metadataHash) || saved.metadataHash !== current.metadataHash) fail(`stale snapshot guide/metadata hash: ${saved.id}`);
    seen.add(saved.id);
    if (!Array.isArray(saved.evidence) || saved.evidence.length !== current.evidence.length) fail(`invalid snapshot evidence: ${saved.id}`);
    for (let i = 0; i < saved.evidence.length; i++) {
      const evidence = saved.evidence[i];
      fields(evidence, ['path', 'sha256'], 'snapshot evidence');
      if (evidence.path !== current.evidence[i] || !digest(evidence.sha256)) fail(`invalid snapshot evidence hash/path: ${saved.id}`);
      if (live && hash(source(root, evidence.path, 'evidence')) !== evidence.sha256) fail(`stale evidence: ${evidence.path}; review affected claims before refresh`);
    }
  }
}
function guideURL(guide) { return '/docs/' + guide.replace(/(?:^|\/)README\.md$/i, '').replace(/\.md$/, '').replace(/\/$/, ''); }
function escape(value) { return value.replace(/[\\`*_\[\]|]/g, '\\$&'); }
function renderArea(records) {
  if (!records.length) return 'No capabilities are catalogued in this area yet.\n';
  const rows = records.map(record => `| [${escape(record.name)}](${guideURL(record.guide)})${record.availability === 'preview' ? ' **Preview**' : ''} | ${escape(record.summary)}${record.limitations ? ` **Limits:** ${escape(record.limitations)}` : ''} |`);
  return ['| Capability | What you can do |', '|---|---|', ...rows, ''].join('\n');
}
function plans(root, { config, records }) {
  const publicRecords = records.map(({ guideHash, metadataHash, evidence, guide, ...item }) => ({ ...item, guide: guideURL(guide) }));
  const outputs = [[OUTPUT, json({ schema: 1, areas: config.areas, capabilities: publicRecords })]];
  for (const view of config.views) {
    const file = 'docs/' + view.path, text = source(root, file, 'view target');
    if (text.split(START).length !== 2 || text.split(END).length !== 2 || text.indexOf(END) < text.indexOf(START)) fail(`view requires exactly one ordered marker region: ${view.path}`);
    let generated = '';
    for (const area of config.areas.filter(area => !view.area || area.id === view.area)) {
      const entries = records.filter(record => record.area === area.id).sort((a, b) => a.name < b.name ? -1 : 1);
      if (view.area) generated += renderArea(entries);
      else {
        const target = config.views.find(candidate => candidate.area === area.id);
        generated += `<details>\n<summary>${escape(area.name)} (${entries.length})</summary>\n\n`;
        if (target) generated += `[Browse ${escape(area.name)}](${guideURL(target.path)})\n\n`;
        generated += renderArea(entries) + '\n</details>\n\n';
      }
    }
    outputs.push([file, text.slice(0, text.indexOf(START) + START.length) + '\n\n' + generated.trimEnd() + '\n\n' + text.slice(text.indexOf(END))]);
  }
  return outputs;
}
function refresh(root) {
  const { records } = collect(root);
  // Refresh is explicit and monorepo-only; it does not assert that human review occurred.
  fs.writeFileSync(path.join(root, SNAPSHOT), json(snapshotFor(root, records)));
  return records.length;
}
function build(root) {
  const inputs = collect(root); validateSnapshot(root, inputs.records, false);
  const outputs = plans(root, inputs);
  for (const [file, content] of outputs) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), content); }
  return inputs.records.length;
}
function check(root) {
  const inputs = collect(root); validateSnapshot(root, inputs.records, true);
  for (const [file, expected] of plans(root, inputs)) {
    // The dataset is ephemeral, like docs-index.json. A fresh checkout has no public
    // output yet; tracked Markdown regions still must be current before any build.
    if (file === OUTPUT && !fs.existsSync(path.join(root, file))) continue;
    if (!fs.existsSync(path.join(root, file)) || fs.readFileSync(path.join(root, file), 'utf8') !== expected) fail(`stale generated output: ${file}; rebuild docs`);
  }
  return inputs.records.length;
}
module.exports = { collect, refresh, build, check, stripMetadata, readSource: source };
if (require.main === module) {
  try {
    const root = path.join(__dirname, '../..'), command = process.argv[2] || 'check';
    if (!['check', 'refresh', 'build'].includes(command)) fail('use check, refresh or build');
    console.log(`Capability ${command}: ${module.exports[command](root)} verified records`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
