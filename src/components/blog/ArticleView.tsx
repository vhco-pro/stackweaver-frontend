// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { DocAnchorScroll } from '@/components/docs/DocAnchorScroll';
import { MarkdownRenderer } from '@/components/docs/MarkdownRenderer';
import type { BlogArticle } from '@/lib/blog';
import './blog.css';

export function ArticleView({ article, related = [] }: { article: BlogArticle; related?: readonly BlogArticle[] }) {
  const comparison = article.canonical.startsWith('/compare/');
  const headings = [...article.body.matchAll(/^## (.+)$/gm)].map(match => ({title:match[1],id:match[1].toLowerCase().replace(/\s+/g,'-').replace(/[^\w-]/g,'')}));
  return <main className="blog-page"><article className="blog-wrap"><Link to="/blog" className="blog-back"><ArrowLeft aria-hidden="true"/> All articles</Link>
    <header className="blog-article-heading"><p className="blog-kicker">{article.topics.join(' / ')}</p><h1>{article.title}</h1><p>{article.description}</p><div className="blog-byline">By {article.author} / {article.status==='draft'?'Editorial draft':article.published} / Updated {article.updated}</div></header>
    <div className="blog-article-banner" aria-hidden="true"><span>{comparison?'Ansible and OpenTofu':'Infrastructure automation'}</span><strong>{comparison?'Start with the workflow.':'Built around your control.'}</strong><span>Stackweaver / {comparison?'Practical comparisons':'The vision'}</span></div>
    <div className="blog-article-layout"><div className="blog-prose"><MarkdownRenderer content={article.body} docPath="" docsBase="/docs"/><DocAnchorScroll/>
      <div className="blog-related"><p className="blog-kicker">Continue reading</p>{related.filter(other => other.canonical!==article.canonical).slice(0,2).map(other => <Link key={other.canonical} to={other.canonical}>{other.title} <ArrowUpRight aria-hidden="true"/></Link>)}</div>
    </div><aside className="blog-toc" aria-label="Article contents"><p className="blog-kicker">On this page</p><nav>{headings.map(heading => <Link key={heading.id} to={`${article.canonical}#${heading.id}`}>{heading.title}</Link>)}</nav><div className="blog-side-cta"><h2>Your infrastructure.<br/>Your control.</h2><p>Choose SaaS, Docker Compose or Helm.</p><Link to="/docs/get-started">Read the docs <ArrowUpRight aria-hidden="true"/></Link></div></aside></div>
  </article></main>;
}
