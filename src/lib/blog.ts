// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { parseDocument } from 'yaml';

export interface BlogArticle {
  title: string;
  description: string;
  canonical: string;
  author: string;
  status: 'draft' | 'published';
  published?: string;
  featured?: boolean;
  updated: string;
  topics: string[];
  body: string;
}

export type BlogArticleSummary = Omit<BlogArticle, 'body'>;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(meta: Record<string, unknown>, field: string, source: string): string {
  const value = meta[field];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${source}: ${field} must be a nonempty string`);
  return value.trim();
}

function date(meta: Record<string, unknown>, field: string, source: string): string {
  const value = text(meta, field, source);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${source}: ${field} must be a valid YYYY-MM-DD date`);
  }
  return value;
}

/** Parse repository-owned Markdown. Content is preserved; publication is a separate selection. */
export function parseArticles(sources: Record<string, string>): BlogArticle[] {
  const paths = new Set<string>();
  return Object.entries(sources).map(([source, markdown]) => {
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
    if (!frontmatter) throw new Error(`${source}: article frontmatter is required`);
    const document = parseDocument(frontmatter[1], { uniqueKeys: true, version: '1.2' });
    if (document.errors.length || document.warnings.length) throw new Error(`${source}: invalid article metadata`);
    const metadata: unknown = document.toJS({ maxAliasCount: 0 });
    if (!record(metadata)) throw new Error(`${source}: article metadata must be a mapping`);
    const canonical = text(metadata, 'canonical', source);
    if (!/^\/(?:compare|blog)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(canonical)) {
      throw new Error(`${source}: canonical must be a clean /compare/<slug> or /blog/<slug> path`);
    }
    if (paths.has(canonical)) throw new Error(`${source}: duplicate canonical destination ${canonical}`);
    paths.add(canonical);
    const status = text(metadata, 'status', source);
    if (status !== 'draft' && status !== 'published') throw new Error(`${source}: status must be draft or published`);
    if (metadata.featured !== undefined && typeof metadata.featured !== 'boolean') {
      throw new Error(`${source}: featured must be a boolean`);
    }
    const topics = metadata.topics;
    if (!Array.isArray(topics) || !topics.length || !topics.every((topic: unknown) => typeof topic === 'string' && topic.trim())) {
      throw new Error(`${source}: topics must be a nonempty list of strings`);
    }
    const published = status === 'published' || metadata.published !== undefined
      ? date(metadata, 'published', source)
      : undefined;
    const updated = date(metadata, 'updated', source);
    if (published && updated < published) throw new Error(`${source}: updated cannot precede published`);
    const body = markdown.slice(frontmatter[0].length);
    if (!body.trim()) throw new Error(`${source}: article body is required`);
    return {
      title: text(metadata, 'title', source),
      description: text(metadata, 'description', source),
      canonical,
      author: text(metadata, 'author', source),
      status,
      published,
      featured: metadata.featured,
      updated,
      topics: [...new Set((topics as string[]).map(topic => topic.trim()))],
      body,
    };
  });
}

export function publishedArticles<T extends Pick<BlogArticle, 'status'>>(articles: readonly T[]): T[] {
  return articles.filter(article => article.status === 'published');
}

/** Subject matches lead; generic format labels do not make two articles related. */
export function relatedArticles(article: BlogArticleSummary, candidates: readonly BlogArticleSummary[]): BlogArticleSummary[] {
  const formats = new Set(['comparisons', 'tutorial']);
  const topics = article.topics.map(topic => topic.toLowerCase());
  const subjects = new Set(topics.filter(topic => !formats.has(topic)));
  const primarySubject = topics.find(topic => !formats.has(topic));
  const relevance = (candidate: BlogArticleSummary) => {
    const candidateTopics = candidate.topics.map(topic => topic.toLowerCase());
    const shared = candidateTopics.filter(topic => subjects.has(topic)).length;
    return {
      primary: Number(primarySubject !== undefined && candidateTopics.find(topic => !formats.has(topic)) === primarySubject),
      shared,
      format: shared ? candidateTopics.filter(topic => formats.has(topic) && topics.includes(topic)).length : 0,
    };
  };
  return publishedArticles(candidates).filter(candidate => candidate.canonical !== article.canonical)
    .sort((a, b) => {
      const left = relevance(a), right = relevance(b);
      return right.primary - left.primary || right.shared - left.shared ||
        Number(b.featured === true) - Number(a.featured === true) ||
        (b.published ?? b.updated).localeCompare(a.published ?? a.updated) ||
        right.format - left.format || a.canonical.localeCompare(b.canonical);
    })
    .slice(0, 2);
}
