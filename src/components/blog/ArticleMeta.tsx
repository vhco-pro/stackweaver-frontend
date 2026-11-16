// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import type { ReactNode } from 'react';
import { CalendarDays, Clock, History } from 'lucide-react';
import { formatArticleDate, type BlogArticleSummary } from '@/lib/blog';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

function Avatar({ name }: { name: string }) {
  return <span className="blog-meta-avatar" aria-hidden="true">{initials(name)}</span>;
}

function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return <div className="blog-meta-fact">{icon}<dt>{label}</dt><dd>{children}</dd></div>;
}

type MetaArticle = Pick<BlogArticleSummary, 'author' | 'status' | 'published' | 'updated' | 'readingMinutes'>;

/** The article header's author and dates, as labelled facts instead of a slash-separated line. */
export function ArticleMeta({ article }: { article: MetaArticle }) {
  const draft = article.status === 'draft';
  const updated = !draft && article.published !== undefined && article.updated !== article.published;
  return <dl className="blog-meta" aria-label="Article details">
    <div className="blog-meta-author"><Avatar name={article.author}/><div><dt>Written by</dt><dd>{article.author}</dd></div></div>
    {draft
      ? <Fact icon={<CalendarDays aria-hidden="true"/>} label="Status"><span className="blog-meta-draft">Editorial draft</span></Fact>
      : article.published && <Fact icon={<CalendarDays aria-hidden="true"/>} label="Published"><time dateTime={article.published}>{formatArticleDate(article.published)}</time></Fact>}
    {(updated || draft) && <Fact icon={<History aria-hidden="true"/>} label="Updated"><time dateTime={article.updated}>{formatArticleDate(article.updated)}</time></Fact>}
    {article.readingMinutes !== undefined && <Fact icon={<Clock aria-hidden="true"/>} label="Reading time">{article.readingMinutes} min read</Fact>}
  </dl>;
}

/** Topic kicker: each topic is its own item, separated by a dot drawn in CSS rather than a slash in the text. */
export function ArticleTopics({ topics }: { topics: readonly string[] }) {
  return <p className="blog-kicker blog-topic-list">{topics.map(topic => <span key={topic}>{topic}</span>)}</p>;
}

/** The compact form for article cards: avatar and name, then the date and reading time as icon items. */
export function ArticleMetaCompact({ article }: { article: MetaArticle }) {
  return <span className="blog-meta-compact">
    <span className="blog-meta-compact-author"><Avatar name={article.author}/>{article.author}</span>
    {article.status === 'draft'
      ? <span className="blog-meta-draft">Editorial draft</span>
      : article.published && <span className="blog-meta-compact-item"><CalendarDays aria-hidden="true"/><time dateTime={article.published}>{formatArticleDate(article.published)}</time></span>}
    {article.readingMinutes !== undefined && <span className="blog-meta-compact-item"><Clock aria-hidden="true"/>{article.readingMinutes} min read</span>}
  </span>;
}
