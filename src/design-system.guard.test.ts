// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The design-system guard. The app was standardised twice and drifted back twice, because the
// system lived in prose and in pages to copy from. This test reads the source and fails on the
// old recipes, so they cannot return, and it requires every page file to be classified, so a
// page cannot be missed and a page added later cannot skip the system.
//
// It began as a ratchet, with every violation of the day listed as pending, and the sweep
// emptied those lists and removed them. No file may violate a rule now, and no page may be
// unclassified. The spec is docs/internal/plans/ui/design-system-sweep-plan.md.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { EXEMPT_PAGES, SWEPT_PAGES } from './design-system.inventory';

const SRC = dirname(fileURLToPath(import.meta.url));

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(SRC, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(SRC, rel)).isDirectory()) out.push(...walk(rel));
    else if (name.endsWith('.tsx') && !name.includes('.test.')) out.push(rel);
  }
  return out;
}

// Out of scope for the sweep: the public landing surface with its cookie banner (its design is
// a separate spec), the docs viewer, the shadcn primitives, and the animation primitives.
const OUT_OF_SCOPE = [
  'pages/Landing.tsx',
  'pages/Blog/',
  'components/blog/',
  'pages/Docs/',
  'components/landing/',
  'components/docs/',
  'components/gdpr/',
  'components/navigation/PublicNav.tsx',
  'components/layout/Footer.tsx',
  'components/ui/',
  'components/animate-ui/',
];
// Surfaces that deliberately use the brand ramp (blue, indigo, purple) instead of a page ramp.
const BRAND_SURFACE = ['pages/Login/', 'pages/Auth/', 'pages/Auth.tsx', 'components/auth/'];
// The login flow and the screens outside the application shell, which the sweep did not restyle.
const PUBLIC_OR_LOGIN = [...BRAND_SURFACE, 'pages/OAuthAuthorize.tsx', 'pages/VCS/', 'pages/Privacy.tsx'];

const startsWithAny = (file: string, prefixes: string[]) => prefixes.some((p) => file.startsWith(p));
const FILES = [...walk('pages'), ...walk('components')].filter((f) => !startsWithAny(f, OUT_OF_SCOPE)).sort();
const PAGE_FILES = walk('pages').sort();
const source = new Map<string, string>(FILES.map((f) => [f, readFileSync(join(SRC, f), 'utf8')]));
for (const f of PAGE_FILES) if (!source.has(f)) source.set(f, readFileSync(join(SRC, f), 'utf8'));

// ---- a small JSX reader: enough to find an element's attributes and children reliably ----

interface Tag {
  attrs: string;
  start: number;
  /** Index just past the closing `>` of the opening tag. */
  end: number;
  selfClosing: boolean;
}

/** Reads the opening tag that starts at `start`, skipping `>` inside `{...}` and strings. */
function readTag(src: string, start: number): Tag {
  let i = start + 1;
  while (i < src.length && /[\w.]/.test(src[i])) i++;
  const attrsStart = i;
  let depth = 0;
  let quote = '';
  for (; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) {
      const selfClosing = src[i - 1] === '/';
      return { attrs: src.slice(attrsStart, selfClosing ? i - 1 : i), start, end: i + 1, selfClosing };
    }
  }
  return { attrs: src.slice(attrsStart), start, end: src.length, selfClosing: true };
}

interface Element extends Tag {
  body: string;
  /** Index just past the closing tag. */
  close: number;
}

function elements(src: string, name: string): Element[] {
  const out: Element[] = [];
  const open = new RegExp(`<${name}(?![\\w.])`, 'g');
  for (let m = open.exec(src); m; m = open.exec(src)) {
    const tag = readTag(src, m.index);
    if (tag.selfClosing) {
      out.push({ ...tag, body: '', close: tag.end });
      continue;
    }
    // Find the matching close, counting nested elements of the same name.
    const either = new RegExp(`<(/?)${name}(?![\\w.])`, 'g');
    either.lastIndex = tag.end;
    let depth = 1;
    let close = src.length;
    let bodyEnd = src.length;
    for (let n = either.exec(src); n; n = either.exec(src)) {
      if (n[1]) {
        depth--;
        if (depth === 0) {
          bodyEnd = n.index;
          close = src.indexOf('>', n.index) + 1;
          break;
        }
      } else if (!readTag(src, n.index).selfClosing) depth++;
    }
    out.push({ ...tag, body: src.slice(tag.end, bodyEnd), close });
  }
  return out;
}

const attr = (attrs: string, name: string) => new RegExp(`(?<![\\w-])${name}=`).test(attrs);
const attrIs = (attrs: string, name: string, value: string) => new RegExp(`(?<![\\w-])${name}="${value}"`).test(attrs);
const within = (index: number, ranges: Array<[number, number]>) => ranges.some(([a, b]) => index >= a && index < b);

function dialogRanges(src: string): Array<[number, number]> {
  return ['DialogContent', 'PageDialogContent', 'AlertDialogContent'].flatMap((n) =>
    elements(src, n).map((e): [number, number] => [e.start, e.close])
  );
}

/** The extent of every `.map(...)` call, which is where a list renders its rows. */
function mapRanges(src: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const re = /\.map\(/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    let depth = 1;
    let i = m.index + m[0].length;
    let quote = '';
    for (; i < src.length && depth > 0; i++) {
      const ch = src[i];
      if (quote) {
        if (ch === '\\') i++;
        else if (ch === quote) quote = '';
        continue;
      }
      if (ch === '"' || ch === '`') quote = ch;
      else if (ch === '(') depth++;
      else if (ch === ')') depth--;
    }
    out.push([m.index, i]);
  }
  return out;
}

/** A button that holds only an icon: its children are one self-closing element. */
function holdsOnlyAnIcon(body: string): boolean {
  const b = body.trim();
  // A ternary between two icons, as an expand toggle writes it.
  if (/^\{[^{}]*\?\s*<[A-Z][^<>]*\/>\s*:\s*<[A-Z][^<>]*\/>\s*\}$/.test(b)) return true;
  if (!b.startsWith('<') || !/^<[A-Z]/.test(b)) return false;
  const tag = readTag(b, 0);
  return tag.selfClosing && tag.end === b.length;
}

// ---- the rules: each returns the files that violate it ----

type Rule =
  | 'wrapperRecipe'
  | 'nativeConfirm'
  | 'gradientFill'
  | 'plainFilled'
  | 'iconButton'
  | 'rampNotInherited'
  | 'dialogPrimary'
  | 'solidRedOnPage'
  | 'deleteTrigger'
  | 'rowRing';

const RULES: Record<Rule, (file: string, src: string) => boolean> = {
  // AC1: the hand-rolled gradient wrapper the first sweep spread.
  wrapperRecipe: (_file, src) => src.includes('p-[2px]'),

  // AC9: a browser-native confirm has no styled button, so it cannot follow the rule.
  nativeConfirm: (_file, src) => /(?<![.\w])confirm\(|window\.confirm\(/.test(src),

  // AC2: a solid gradient fill is another superseded recipe. A create or save action is the ring.
  // A gradient that appears only on hover (`hover:bg-gradient-to-r`) is a tint, not a fill.
  gradientFill: (_file, src) => elements(src, 'Button').some((b) => /(?<![\w:-])bg-gradient-to-/.test(b.attrs)),

  // A `Button` with no variant is the solid filled default, which is none of the system's
  // roles: a create, add or save action is a ring, and anything else names its variant.
  plainFilled: (file, src) =>
    !startsWithAny(file, PUBLIC_OR_LOGIN) &&
    elements(src, 'Button').some((b) => !attr(b.attrs, 'variant') && !/(?<![\w-])asChild\b/.test(b.attrs)),

  // AC10: an icon-only button is `ghost`, `size="icon"`, and has an accessible name. A raw
  // `<button>` that holds only an icon needs the name too.
  iconButton: (_file, src) =>
    elements(src, 'Button').some((b) => {
      if (!attrIs(b.attrs, 'size', 'icon') && !holdsOnlyAnIcon(b.body)) return false;
      // With `asChild` the button renders its child, so the name sits on that child.
      const named = attr(b.attrs, 'aria-label') || (/(?<![\w-])asChild\b/.test(b.attrs) && /aria-label=/.test(b.body));
      return !(attrIs(b.attrs, 'size', 'icon') && attrIs(b.attrs, 'variant', 'ghost') && named);
    }) || elements(src, 'button').some((b) => holdsOnlyAnIcon(b.body) && !attr(b.attrs, 'aria-label')),

  // AC3: only `ramp="app"` leaves the ring colours unset on the button, so only then does the
  // page's colour reach it.
  rampNotInherited: (file, src) =>
    !startsWithAny(file, BRAND_SURFACE) && elements(src, 'GradientButton').some((b) => !attrIs(b.attrs, 'ramp', 'app')),

  // AC14: a dialog footer ends in the gradient ring, or in solid red for a destructive confirm.
  dialogPrimary: (_file, src) =>
    elements(src, 'DialogFooter').some((footer) => {
      const buttons = [
        ...elements(footer.body, 'Button').map((b) => ({ ...b, ring: false })),
        ...elements(footer.body, 'GradientButton').map((b) => ({ ...b, ring: true })),
      ].sort((a, b) => a.start - b.start);
      const primaries = buttons.filter(
        (b) => b.ring || !['outline', 'ghost', 'link', 'secondary'].some((v) => attrIs(b.attrs, 'variant', v))
      );
      if (primaries.length === 0) return false; // a footer with only Close or Cancel has no primary
      const last = primaries[primaries.length - 1];
      return !(last.ring || attrIs(last.attrs, 'variant', 'destructive'));
    }),

  // AC8: solid red belongs to the confirm button in a dialog, never to a control on the page.
  // The sign-out screen is itself a confirmation step.
  solidRedOnPage: (file, src) => {
    if (file === 'pages/Login/Logout.tsx') return false;
    const dialogs = dialogRanges(src);
    return elements(src, 'Button').some((b) => attrIs(b.attrs, 'variant', 'destructive') && !within(b.start, dialogs));
  },

  // AC8: every on-page delete trigger carries the one quiet red style.
  deleteTrigger: (_file, src) => {
    const dialogs = dialogRanges(src);
    return elements(src, 'Button').some(
      (b) =>
        /<Trash\d?\b/.test(b.body) &&
        !within(b.start, dialogs) &&
        !/dangerOutline|dangerGhostIcon/.test(b.attrs)
    );
  },

  // AC15: a primary action repeated on every row is the thin secondary ring.
  rowRing: (_file, src) => {
    const maps = mapRanges(src);
    return elements(src, 'GradientButton').some((b) => within(b.start, maps) && !attrIs(b.attrs, 'emphasis', 'secondary'));
  },
};

describe('design-system guard: old recipes', () => {
  it.each(Object.keys(RULES) as Rule[])('%s: no file violates it', (rule) => {
    expect(FILES.filter((f) => RULES[rule](f, source.get(f) as string))).toEqual([]);
  });
});

describe('design-system guard: every page is classified', () => {
  const exemptReason = (file: string) => EXEMPT_PAGES.find((e) => file.startsWith(e.prefix))?.reason;

  it('every file under pages/ is swept, or exempt with a reason', () => {
    const unclassified = PAGE_FILES.filter((f) => !SWEPT_PAGES.includes(f) && !exemptReason(f));
    expect(unclassified).toEqual([]);
  });

  it('the inventory names no file that does not exist', () => {
    expect(SWEPT_PAGES.filter((f) => !PAGE_FILES.includes(f))).toEqual([]);
  });

  it('a swept page uses Page and PageHeader and writes no title block of its own', () => {
    const wrong = SWEPT_PAGES.filter((file) => {
      const src = source.get(file) as string;
      return !/<Page\b/.test(src) || !/<PageHeader\b/.test(src) || /<h1\b/.test(src);
    });
    expect(wrong).toEqual([]);
  });

  it('only an exempt page writes its own title block', () => {
    const stray = PAGE_FILES.filter((f) => /<h1\b/.test(source.get(f) as string) && !exemptReason(f));
    expect(stray).toEqual([]);
  });

  it('the E2E route table covers every swept page', () => {
    const routes = join(SRC, '..', '..', 'e2e', 'tests', 'design-system.routes.ts');
    expect(existsSync(routes), `${relative(SRC, routes)} is missing`).toBe(true);
    const table = readFileSync(routes, 'utf8');
    const covered = new Set([...table.matchAll(/'(pages\/[^']+\.tsx)'/g)].map((m) => m[1]));
    const missing = SWEPT_PAGES.filter((file) => !covered.has(file));
    expect(missing).toEqual([]);
  });
});
