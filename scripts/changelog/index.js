// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SHA = /^[a-f0-9]{40}$/;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REPO = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
const KINDS = new Set(['Added', 'Changed', 'Fixed', 'Performance', 'Removed', 'Security']);
function requireValue(condition, message) { if (!condition) throw new Error(message); }
function text(value, label) { requireValue(typeof value === 'string' && value.trim().length > 0, `Missing ${label}`); return value; }
function unique(values, label) { requireValue(Array.isArray(values) && new Set(values).size === values.length, `Duplicate or invalid ${label}`); }
function escape(value) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}[\]|#!]/g, '\\$&').replace(/\r?\n/g, ' '); }
function git(root, ...args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe', maxBuffer: 20 * 1024 * 1024 }).trim(); }

function candidate(commit) {
  const message = text(commit.message, 'commit message');
  const match = message.split('\n')[0].match(/^([a-z][a-z0-9-]*)(?:\(([^)\n]+)\))?(!)?:[ \t]+(.+)$/);
  const breaking = !!match?.[3] || /^BREAKING[ -]CHANGE:\s/m.test(message);
  if (!breaking && commit.parents?.length > 1 && /^Merge (?:pull request|branch|remote-tracking branch)\b/.test(message)) return null;
  if (!breaking && match && ['docs', 'style', 'test', 'ci', 'chore'].includes(match[1])) return null;
  return { ...commit, type: match?.[1] || 'unknown', scope: match?.[2] || '', breaking, ids: [...message.matchAll(/^Changelog:\s*(.+)$/gm)].flatMap(m => m[1].trim().split(/[,\s]+/)) };
}

function checkCandidates(commits, changes, dispositions) {
  unique(changes.map(c => c.id), 'change IDs');
  const known = new Map(changes.filter(c => c.reviewed === true).map(c => [c.id, c]));
  const internal = new Map(dispositions.filter(d => typeof d.reason === 'string' && d.reason.trim()).map(d => [d.id || d.commit, d]));
  return commits.map(candidate).filter(Boolean).filter(c => {
    if (c.ids.length) return c.ids.some(id => {
      const record = known.get(id);
      return record ? !!record.availability?.length && !record.sourceCommits.includes(c.sha) : !internal.has(id);
    });
    return !changes.some(e => e.reviewed === true && (e.sourceCommits?.includes(c.sha) || (!e.availability.length && e.draftCommits?.includes(c.sha)))) && !internal.has(c.sha);
  });
}

function readCommits(root, baseline, head = 'HEAD') {
  requireValue(SHA.test(baseline), 'Candidate baseline must be a full durable SHA');
  git(root, 'merge-base', '--is-ancestor', baseline, head);
  return git(root, 'log', '--format=%H%x00%P%x00%B%x00%x1e', `${baseline}..${head}`).split('\x1e').filter(s => s.trim()).map(record => {
    const [sha, parents, ...parts] = record.trim().split('\x00');
    return { sha, parents: parents.split(' ').filter(Boolean), message: parts.join('\x00').replace(/\x00+$/, '').trim() };
  });
}

function publicGuide(guide, docsRoot) {
  text(guide.title, 'guide title');
  requireValue(typeof guide.path === 'string' && /^\/docs\/[a-zA-Z0-9_/-]+(?:#[a-zA-Z0-9_-]+)?$/.test(guide.path), 'Unsafe guide link');
  const relative = guide.path.slice('/docs/'.length).split('#')[0];
  requireValue(!relative.toLowerCase().startsWith('internal/') && relative.toLowerCase() !== 'internal', 'Private guide link');
  const targets = [relative + '.md', path.join(relative, 'README.md')].map(p => path.join(docsRoot, p));
  requireValue(targets.some(p => fs.existsSync(p) && fs.realpathSync(p).startsWith(fs.realpathSync(docsRoot) + path.sep)), `Missing public guide ${guide.path}`);
}

function validateRelease(r, config) {
  const component = config.components[r.component];
  requireValue(component && REPO.test(component.repository), 'Unknown component repository');
  requireValue(typeof r.tag === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(r.tag), 'Invalid release tag');
  requireValue(r.id === `${r.component}@${r.tag}` && r.repository === component.repository, 'Inconsistent release identity');
  const prefix = `https://github.com/${r.repository}/`;
  requireValue(r.url === prefix + 'releases/tag/' + r.tag && Number.isFinite(Date.parse(r.publishedAt)), 'Invalid release URL/date');
  requireValue(SHA.test(r.tagCommit) && SHA.test(r.sourceCommit) && SHA.test(r.sync?.mergeCommit), 'Invalid release source SHA');
  requireValue(new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 'pull/[0-9]+$').test(r.sync.url), 'Invalid sync evidence');
  requireValue(r.workflow?.conclusion === 'success' && r.workflow.headSha === r.tagCommit && r.workflow.url.startsWith(prefix + 'actions/runs/'), 'Missing successful release workflow');
  requireValue(r.artifact?.name === component.artifact && /^sha256:[a-f0-9]{64}$/.test(r.artifact?.digest) && r.artifact.provenanceUrl === prefix + `releases/download/${r.tag}/provenance.intoto.jsonl`, 'Missing or inconsistent artifact evidence');
  unique(r.includedCommits, 'included commits');
  requireValue(r.includedCommits.every(s => SHA.test(s)), 'Invalid inclusion SHA');
}

function render({ config, changes, releases, docsRoot }) {
  requireValue(REPO.test(config.repository), 'Invalid monorepo');
  unique(changes.map(c => c.id), 'change IDs'); unique(releases.map(r => r.id), 'release IDs');
  releases.forEach(r => validateRelease(r, config));
  const releaseMap = new Map(releases.map(r => [r.id, r]));
  const published = [];
  for (const c of changes) {
    requireValue(ID.test(c.id), 'Invalid change ID');
    for (const key of ['title', 'area', 'audience', 'before', 'after', 'action']) text(c[key], key);
    requireValue(KINDS.has(c.kind), 'Invalid change kind');
    for (const key of ['sourceCommits', 'requiredComponents', 'availability', 'details', 'guides']) unique(c[key], key);
    requireValue(c.sourceCommits.every(s => SHA.test(s)), 'Invalid source commit');
    requireValue(c.requiredComponents.length > 0 && c.requiredComponents.every(id => config.components[id]), 'Missing required components');
    requireValue(c.guides.length > 0, 'Missing public guide'); c.guides.forEach(g => publicGuide(g, docsRoot));
    c.details.forEach(d => text(d, 'scope detail'));
    requireValue(typeof c.reviewed === 'boolean', 'Missing review state');
    if (!c.availability.length) continue;
    requireValue(c.reviewed, 'Unreviewed published change');
    const available = c.availability.map(id => { const r = releaseMap.get(id); requireValue(r, `Unknown release ${id}`); return r; });
    unique(available.map(r => r.component), 'component availability');
    requireValue(c.sourceCommits.length > 0 && available.length === c.requiredComponents.length && c.requiredComponents.every(id => available.some(r => r.component === id)), 'Incomplete required component availability');
    requireValue(available.every(r => c.sourceCommits.every(sha => r.includedCommits.includes(sha))), `Missing source inclusion evidence for ${c.id}`);
    published.push({ ...c, available, date: available.map(r => r.publishedAt).sort().at(-1).slice(0, 10) });
  }
  published.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const lines = ['---', 'title: "Changelog"', 'description: "Stackweaver changes, affected users and upgrade actions, with confirmed component availability."', 'nav_order: 60', 'covers:', '  - "scripts/changelog/**"', '---', '', '<!-- Generated by scripts/changelog. Edit reviewed inputs, then rebuild documentation. -->', '', '# Stackweaver changelog', '', 'Review changes that affect your deployment and follow the linked guides for current instructions.', 'Component versions identify releases confirmed to include a change. They are not minimum supported versions or a single Stackweaver product version.', ''];
  if (!published.length) lines.push('No reviewed changes have confirmed release availability yet.', '');
  if (published.length) {
    lines.push('## Browse by area', '');
    for (const area of [...new Set(published.map(c => c.area))].sort()) lines.push(`- ${escape(area)}: ` + published.filter(c => c.area === area).map(c => `[${escape(c.title)}](#change-${c.id})`).join(' · '));
    lines.push('');
  }
  let date;
  for (const c of published) {
    if (c.date !== date) { date = c.date; lines.push(`## Confirmed available by ${date}`, ''); }
    lines.push(`<a id="change-${c.id}" style="scroll-margin-top: 7rem"></a>`, '', `### ${escape(c.title)}`, '', `${escape(c.area)} · ${c.kind}`, '', escape(c.audience), '', escape(c.before), '', escape(c.after), '', '**Action:** ' + escape(c.action), '', '**Confirmed in:** ' + c.available.map(r => `[${escape(r.component === 'api' ? 'API' : r.component.replace(/-/g, ' '))} ${escape(r.tag)}](${r.url})`).join(' · '), '');
    if (c.details.length) lines.push('<details>', '<summary>Scope and behavior details</summary>', '', ...c.details.map(d => '- ' + escape(d)), '', '</details>', '');
    lines.push(c.guides.map(g => `[${escape(g.title)}](${g.path})`).join(' · '), '');
  }
  return lines.join('\n');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  return value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
}
function mergeSnapshots(existing, incoming) {
  const result = new Map(existing.map(r => [r.id, r]));
  for (const r of incoming) {
    const previous = result.get(r.id);
    if (previous) {
      const identity = value => { const { includedCommits, ...rest } = value; return canonical(rest); };
      requireValue(JSON.stringify(identity(previous)) === JSON.stringify(identity(r)), `Immutable release observation changed: ${r.id}`);
      requireValue(previous.includedCommits.every(sha => r.includedCommits.includes(sha)), `Existing source inclusion changed: ${r.id}`);
    }
    result.set(r.id, r);
  }
  return [...result.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function checkHistory(previous, current) {
  if (!previous) return;
  requireValue(previous.config.baseline === current.config.baseline && previous.config.repository === current.config.repository, 'Candidate baseline/repository cannot silently change');
  requireValue(previous.releases.every(r => current.releases.some(c => c.id === r.id)), 'Immutable release observation removed');
  mergeSnapshots(previous.releases, current.releases);
  for (const before of previous.changes.filter(c => c.availability.length)) {
    const after = current.changes.find(c => c.id === before.id);
    requireValue(after && JSON.stringify([...before.availability].sort()) === JSON.stringify([...after.availability].sort()), `Published availability changed: ${before.id}`);
    requireValue(after.reviewed && before.sourceCommits.every(s => after.sourceCommits.includes(s)) && JSON.stringify([...before.requiredComponents].sort()) === JSON.stringify([...after.requiredComponents].sort()), `Published source membership changed: ${before.id}`);
  }
}

function resolveChanges(changes, commits) {
  return changes.map(change => {
    if (change.availability.length) return change;
    const linked = commits.map(candidate).filter(Boolean).filter(c => c.ids.includes(change.id)).map(c => c.sha);
    return { ...change, sourceCommits: [...new Set([...change.sourceCommits, ...linked])].sort() };
  });
}

async function collectRelease(componentId, config, changes, io) {
  const component = config.components[componentId];
  requireValue(component && REPO.test(component.repository), 'Invalid component');
  const repo = component.repository, prefix = `repos/${repo}/`;
  const release = await io.api(prefix + 'releases/latest');
  requireValue(release && !release.draft && !release.prerelease && release.published_at, 'No published stable release');
  const commit = await io.api(prefix + 'commits/' + encodeURIComponent(release.tag_name));
  const pulls = await io.api(prefix + `commits/${commit.sha}/pulls`);
  const matches = pulls.map(pr => ({ pr, match: pr.body?.match(new RegExp('Automated sync from ' + config.repository.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '@([a-f0-9]{7,40})\\b')) })).filter(x => x.pr.merged_at && x.match);
  requireValue(matches.length === 1, 'Missing or ambiguous source-sync provenance at release commit');
  const { pr, match } = matches[0];
  requireValue(pr.merge_commit_sha === commit.sha, 'Release tag must identify the verified source-sync merge');
  const sourceCommit = await io.resolve(match[1]);
  const runs = await io.api(prefix + `actions/runs?head_sha=${commit.sha}&per_page=100`);
  const run = runs.workflow_runs.find(r => r.path === '.github/workflows/release.yml' && r.conclusion === 'success' && r.status === 'completed' && r.head_sha === commit.sha);
  requireValue(run, 'No successful publication workflow for released tag');
  const asset = release.assets.find(a => a.name === 'provenance.intoto.jsonl');
  requireValue(asset, 'Missing published artifact provenance');
  const bundles = (await io.asset(repo, asset.id)).trim().split('\n').map(line => JSON.parse(line));
  const subjects = bundles.flatMap(bundle => {
    const envelope = bundle.dsseEnvelope;
    requireValue(envelope?.payload, 'Missing provenance envelope');
    const statement = JSON.parse(Buffer.from(envelope.payload, 'base64').toString('utf8'));
    const definition = statement.predicate?.buildDefinition;
    const workflow = definition?.externalParameters?.workflow;
    const invocation = statement.predicate?.runDetails?.metadata?.invocationId;
    const repositoryUrl = 'https://github.com/' + repo;
    const bound = workflow?.repository === repositoryUrl && workflow.ref === `refs/tags/${release.tag_name}` && workflow.path === '.github/workflows/release.yml'
      && definition.resolvedDependencies?.some(d => d.uri === `git+${repositoryUrl}@refs/tags/${release.tag_name}` && d.digest?.gitCommit === commit.sha)
      && (invocation === run.html_url || new RegExp('^' + run.html_url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/attempts/[0-9]+$').test(invocation));
    return statement.predicateType === 'https://slsa.dev/provenance/v1' && bound ? statement.subject || [] : [];
  }).filter(subject => subject.name === component.artifact && /^[a-f0-9]{64}$/.test(subject.digest?.sha256));
  requireValue(subjects.length === 1, 'Missing or ambiguous published artifact identity');
  const id = `${componentId}@${release.tag_name}`, includedCommits = new Set();
  for (const c of changes.filter(c => c.reviewed && c.requiredComponents.includes(componentId))) {
    for (const sha of c.sourceCommits) {
      if (!await io.ancestor(sha, sourceCommit)) continue;
      const reverts = await io.reverts(sha, sourceCommit);
      const reviewedPresence = c.presence?.some(p => p.release === id && p.reason?.trim() && p.evidence?.length);
      if (reverts.length && !reviewedPresence) continue;
      includedCommits.add(sha);
    }
  }
  const result = { id, component: componentId, repository: repo, tag: release.tag_name, tagCommit: commit.sha, publishedAt: release.published_at, url: release.html_url, sourceCommit, sync: { url: pr.html_url, mergeCommit: pr.merge_commit_sha }, workflow: { url: run.html_url, conclusion: run.conclusion, headSha: run.head_sha }, artifact: { name: subjects[0].name, digest: 'sha256:' + subjects[0].digest.sha256, provenanceUrl: asset.browser_download_url }, includedCommits: [...includedCommits].sort() };
  validateRelease(result, config);
  return result;
}

function load(root) {
  const data = path.join(root, 'scripts/changelog/data');
  return Object.fromEntries(['config', 'changes', 'releases', 'dispositions'].map(name => [name, JSON.parse(fs.readFileSync(path.join(data, name + '.json'), 'utf8'))]));
}
function build(root, check = false) {
  const data = load(root);
  const output = render({ ...data, docsRoot: path.join(root, 'docs') });
  const destination = path.join(root, 'docs/changelog.md');
  if (check) requireValue(fs.existsSync(destination) && fs.readFileSync(destination, 'utf8') === output, 'Generated changelog is stale; rebuild documentation');
  else fs.writeFileSync(destination, output);
  return output;
}
module.exports = { candidate, checkCandidates, readCommits, render, collectRelease, mergeSnapshots, checkHistory, resolveChanges, load, build, git };
