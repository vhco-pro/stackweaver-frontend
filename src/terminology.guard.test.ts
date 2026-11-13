// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The terminology guard (one-launcher spec, B3, AC25, AC26, AC30). Every user-visible string in the
// frontend uses the standard names: Hosted capacity, Agent pool and Launcher, and never Executor. The
// retired terms and the allowed exceptions are read from the glossary,
// docs/internal/guidelines/terminology.md, so this test holds no list of its own.
//
// It reads every non-test source file under src/ with the TypeScript parser and collects what a user
// sees: JSX text, string literals and templates in JSX expressions, the visible props (placeholder,
// title, aria-label, description and the like), the arguments of toast calls, and the display
// properties of object literals (title, label, description, text, ...), which is how the marketing
// pages and the settings hub hold their copy. Identifiers, import paths, route paths and other string
// arguments are never read. The marketing articles under src/content are read as prose, without their
// code blocks and inline code.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SRC = dirname(fileURLToPath(import.meta.url));
const GLOSSARY = join(SRC, '../../docs/internal/guidelines/terminology.md');

/** The standard names B1 defines; the glossary must carry a row for each. */
const STANDARD_NAMES = ['Hosted capacity', 'Agent pool', 'Launcher', 'Executor', 'Job image', 'Agent token', 'Strict hosted isolation'];

interface Pattern {
  name: string;
  re: RegExp;
}

/** The rows of one glossary table: first cell and the backticked pattern in the second. */
function tableRows(markdown: string, heading: string): { first: string; pattern: string }[] {
  const section = markdown.split(`\n## ${heading}\n`)[1]?.split('\n## ')[0] ?? '';
  const rows: { first: string; pattern: string }[] = [];
  for (const line of section.split('\n')) {
    if (!line.startsWith('|') || /^\|\s*-/.test(line)) continue;
    const cells = line.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
    if (cells.length < 2) continue;
    rows.push({ first: cells[0], pattern: /^`(.+)`$/.exec(cells[1])?.[1] ?? '' });
  }
  return rows.slice(1); // the header row
}

export function loadGlossary(markdown: string): { names: string[]; retired: Pattern[]; exceptions: Pattern[] } {
  const names = tableRows(markdown, 'The standard names').map((r) => r.first);
  const compile = (rows: { first: string; pattern: string }[]) =>
    rows.filter((r) => r.pattern).map((r) => ({ name: r.first, re: new RegExp(r.pattern, 'gi') }));
  return {
    names,
    retired: compile(tableRows(markdown, 'Retired terms')),
    exceptions: compile(tableRows(markdown, 'Allowed exceptions')),
  };
}

const VISIBLE_PROPS = new Set([
  'aria-label', 'aria-description', 'title', 'placeholder', 'description', 'label', 'subtitle', 'alt',
  'tooltip', 'emptyMessage', 'helperText', 'heading', 'text', 'message',
]);
const DISPLAY_KEYS = new Set(['title', 'label', 'description', 'subtitle', 'text', 'placeholder', 'heading', 'hint', 'tooltip', 'message', 'summary', 'caption']);

export interface Finding {
  file: string;
  line: number;
  text: string;
  term: string;
}

/** The literal text of a string-valued expression: literals, templates and the branches of a conditional. */
function literalTexts(node: ts.Node): ts.Node[] {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) return [node];
  if (ts.isConditionalExpression(node)) return [...literalTexts(node.whenTrue), ...literalTexts(node.whenFalse)];
  if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.PlusToken || node.operatorToken.kind === ts.SyntaxKind.BarBarToken || node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)) {
    return [...literalTexts(node.left), ...literalTexts(node.right)];
  }
  if (ts.isParenthesizedExpression(node)) return literalTexts(node.expression);
  return [];
}

function textOf(node: ts.Node): string {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' ');
  if (ts.isJsxText(node)) return node.text;
  return '';
}

function isToastCall(node: ts.CallExpression): boolean {
  const callee = node.expression;
  if (ts.isIdentifier(callee)) return callee.text === 'toast';
  return ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'toast';
}

/** Every user-visible string in a source file, with its line. */
export function visibleStrings(file: string, source: string): { line: number; text: string }[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: { line: number; text: string }[] = [];
  const add = (node: ts.Node) => {
    const text = textOf(node).trim();
    if (text) out.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text });
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) add(node);
    else if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      literalTexts(node.expression).forEach(add);
    } else if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sf);
      if (VISIBLE_PROPS.has(name)) {
        if (ts.isStringLiteral(node.initializer)) add(node.initializer);
        else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) literalTexts(node.initializer.expression).forEach(add);
      }
    } else if (ts.isCallExpression(node) && isToastCall(node)) {
      node.arguments.forEach((a) => literalTexts(a).forEach(add));
    } else if (ts.isPropertyAssignment(node) && DISPLAY_KEYS.has(node.name.getText(sf).replace(/['"]/g, ''))) {
      literalTexts(node.initializer).forEach(add);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** The prose of a Markdown article: no front matter, code blocks, inline code or link targets. */
export function markdownProse(source: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  let fence = false;
  let front = source.startsWith('---');
  source.split('\n').forEach((raw, i) => {
    if (front) {
      if (i > 0 && raw.trim() === '---') front = false;
      else if (/^(title|description|summary):/.test(raw)) out.push({ line: i + 1, text: raw });
      return;
    }
    if (/^\s*(```|~~~)/.test(raw)) { fence = !fence; return; }
    if (fence) return;
    const text = raw.replace(/`[^`]*`/g, '').replace(/\]\([^)]*\)/g, ']');
    if (text.trim()) out.push({ line: i + 1, text });
  });
  return out;
}

export function findRetired(file: string, strings: { line: number; text: string }[], glossary: ReturnType<typeof loadGlossary>): Finding[] {
  const findings: Finding[] = [];
  for (const { line, text } of strings) {
    let cleaned = text;
    for (const e of glossary.exceptions) cleaned = cleaned.replace(e.re, ' ');
    for (const r of glossary.retired) {
      r.re.lastIndex = 0;
      if (r.re.test(cleaned)) {
        findings.push({ file, line, text: text.trim().slice(0, 160), term: r.name });
        break;
      }
    }
  }
  return findings;
}

/** Every non-test source file and marketing article under src/, as paths relative to src/. */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(SRC, dir))) {
    const rel = dir ? `${dir}/${name}` : name;
    if (statSync(join(SRC, rel)).isDirectory()) {
      if (name !== 'node_modules' && name !== 'test') out.push(...walk(rel));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) {
      out.push(rel);
    } else if (rel.startsWith('content/') && name.endsWith('.md')) {
      out.push(rel);
    }
  }
  return out;
}

const glossary = loadGlossary(readFileSync(GLOSSARY, 'utf8'));

function scan(file: string, source: string): Finding[] {
  return findRetired(file, file.endsWith('.md') ? markdownProse(source) : visibleStrings(file, source), glossary);
}

describe('terminology guard', () => {
  it('reads every standard name, a retired list and the exceptions from the glossary', () => {
    for (const name of STANDARD_NAMES) expect(glossary.names, `the glossary has no "${name}" row`).toContain(name);
    expect(glossary.retired.length).toBeGreaterThan(5);
    expect(glossary.exceptions.length).toBeGreaterThan(5);
  });

  it('fails on a retired term in each place a user reads text, and passes the kept names', () => {
    const fixture = [
      "import { toast } from 'sonner';",
      'export const tiles = [{ title: "Self-hosted runners", href: "/settings/runners" }];',
      'export function Page() {',
      '  toast.success("Runner deleted");',
      '  return (<div>',
      '    <h1>Platform runner</h1>',
      '    <input placeholder="Runner description..." />',
      '    <button aria-label={`Delete runner ${name}`} />',
      '    <p>{busy ? "Waiting for the hosted pool" : "Ready"}</p>',
      '    <span title="Hosted capacity">Launchers of your agent pools pull stackweaver-opentofu-runner</span>',
      '    <code>runner:register</code>',
      '  </div>);',
      '}',
    ].join('\n');
    const findings = scan('fixture.tsx', fixture);
    expect(findings.map((f) => f.line)).toEqual([2, 4, 6, 7, 8, 9]);
    expect(findings.find((f) => f.line === 9)?.term).toMatch(/hosted pool/);
  });

  it('reads a marketing article as prose', () => {
    const findings = scan('content/articles/fixture.article.md', '---\ntitle: "Hello"\n---\nRun it on a runner.\n\n```sh\nRUNNER_NAME=x\n```\n');
    expect(findings.map((f) => f.line)).toEqual([4]);
  });

  // The walk reads every source file. It takes under two seconds alone, but the full suite runs
  // beside it in parallel workers, and on a loaded host it passed vitest's 5 s default.
  it('finds no retired term in a user-visible string of the frontend', { timeout: 30_000 }, () => {
    const findings = walk('').flatMap((file) => scan(file, readFileSync(join(SRC, file), 'utf8')));
    expect(findings.map((f) => `${f.file}:${f.line} "${f.text}" uses ${f.term}`)).toEqual([]);
  });
});
