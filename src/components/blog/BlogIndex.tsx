// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Search } from 'lucide-react';
import { publishedArticles, type BlogArticle } from '@/lib/blog';
import './blog.css';

export function BlogIndex({ articles, preview = false }: { articles: readonly BlogArticle[]; preview?: boolean }) {
  const [topic, setTopic] = useState('All articles');
  const [search, setSearch] = useState('');
  const available = preview ? articles : publishedArticles(articles);
  const results = available.filter(article => (topic === 'All articles' || article.topics.includes(topic)) &&
    `${article.title} ${article.description} ${article.topics.join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()));
  const clear = () => { setTopic('All articles'); setSearch(''); };
  return <main className="blog-page"><div className="blog-wrap">
    <header className="blog-intro"><p className="blog-kicker">Stackweaver blog{preview && ' / Draft preview'}</p>
      <h1>Practical notes on infrastructure automation.</h1>
      <p>Comparisons, workflows and the decisions behind running Ansible and OpenTofu as a team.</p>
      <p className="blog-availability">Self-hosting is available. A managed service is planned.</p>
    </header>
    <div className="blog-tools"><div className="blog-topics" aria-label="Filter articles by topic">
      {['All articles','Ansible','OpenTofu','Comparisons'].map(item => <button key={item} type="button" aria-pressed={topic===item} onClick={() => setTopic(item)}>{item}</button>)}
    </div><label className="blog-search"><Search aria-hidden="true"/><span className="sr-only">Search articles</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search articles" /></label></div>
    <p className="sr-only" aria-live="polite">{results.length} articles</p>
    {!results.length ? <div className="blog-empty" role="status"><h2>{available.length ? 'No articles match your search.' : 'Articles are being prepared.'}</h2><p>{available.length ? 'Try another topic or search term.' : 'Explore the documentation while we prepare the first articles.'}</p>{available.length > 0 && <button type="button" onClick={clear}>Clear filters</button>}</div> :
      <div className="blog-results">{results.map((article,index) => <Link className={index===0?'blog-featured':'blog-row'} to={article.canonical} key={article.canonical}>
        <div className={`blog-cover ${article.topics.includes('OpenTofu')?'blog-cover-tofu':''}`} aria-hidden="true"><span>Stackweaver / {article.topics[0]}</span><strong>{article.canonical.endsWith('/awx')?'AWX':article.canonical.endsWith('/semaphore')?'Semaphore UI':'Terraform Cloud'}</strong><span>A workflow worth comparing</span></div>
        <div className="blog-card-copy"><p className="blog-kicker">{article.topics.join(' / ')}</p><h2>{article.title} <ArrowUpRight aria-hidden="true" /></h2><p>{article.description}</p><span className="blog-byline">{article.author}{article.status==='draft'?' / Editorial draft':article.published?` / ${article.published}`:''}</span></div>
      </Link>)}</div>}
    <section className="blog-docs-callout"><div><h2>Looking for the how-to?</h2><p>Installation, configuration and product guides live in the docs.</p></div><Link to="/docs">Explore the documentation <ArrowUpRight aria-hidden="true"/></Link></section>
  </div></main>;
}
