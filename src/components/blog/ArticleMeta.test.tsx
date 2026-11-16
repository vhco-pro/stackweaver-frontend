// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { describe, expect, it } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import { formatArticleDate, readingMinutes } from '@/lib/blog';
import { ArticleMeta, ArticleMetaCompact } from './ArticleMeta';

const base = { author: 'Michiel VH', status: 'published' as const, published: '2026-10-30', updated: '2026-10-30', readingMinutes: 6 };
function facts(article: Parameters<typeof ArticleMeta>[0]['article']) {
  cleanup();
  const { container } = render(<ArticleMeta article={article}/>);
  return Object.fromEntries([...container.querySelectorAll('dt')].map(term => [term.textContent, term.nextElementSibling?.textContent]));
}

describe('article details', () => {
  it('labels the author, publication date and reading time instead of joining them with slashes', () => {
    expect(facts(base)).toEqual({ 'Written by': 'Michiel VH', Published: '30 Oct 2026', 'Reading time': '6 min read' });
    expect(document.querySelector('.blog-meta')?.textContent).not.toContain('/');
  });
  it('shows the updated date only when it differs from the publication date', () => {
    expect(facts({ ...base, updated: '2026-11-12' })).toMatchObject({ Published: '30 Oct 2026', Updated: '12 Nov 2026' });
  });
  it('marks a draft instead of inventing a publication date', () => {
    expect(facts({ ...base, status: 'draft', published: undefined })).toMatchObject({ Status: 'Editorial draft', Updated: '30 Oct 2026' });
  });
  it('keeps machine-readable dates and the calendar day the author wrote', () => {
    cleanup();
    const { container } = render(<ArticleMeta article={base}/>);
    expect(container.querySelector('time')?.getAttribute('dateTime')).toBe('2026-10-30');
    expect(formatArticleDate('2026-01-01')).toBe('1 Jan 2026');
  });
  it('renders the compact card form with initials, date and reading time', () => {
    cleanup();
    const { container } = render(<ArticleMetaCompact article={base}/>);
    const meta = within(container);
    expect(meta.getByText('MV')).toBeTruthy();
    expect(meta.getByText('30 Oct 2026')).toBeTruthy();
    expect(meta.getByText('6 min read')).toBeTruthy();
  });
});

describe('reading time', () => {
  it('counts prose at 220 words a minute and ignores code fences', () => {
    const prose = Array.from({ length: 660 }, () => 'word').join(' ');
    expect(readingMinutes(prose)).toBe(3);
    expect(readingMinutes(`## Title\n\n${prose}\n\n\`\`\`yaml\n${prose}\n\`\`\``)).toBe(3);
    expect(readingMinutes('Short.')).toBe(1);
  });
});
