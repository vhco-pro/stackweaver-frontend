// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { Link, useLocation } from 'react-router-dom';
import articles from 'virtual:public-articles';
import { ArticleView } from '@/components/blog/ArticleView';
import { PublicNav } from '@/components/navigation/PublicNav';
import { Footer } from '@/components/layout/Footer';
export default function Article() {
 const location=useLocation();
 const article=articles.find(item => item.canonical===location.pathname);
 return <><PublicNav activeLink="blog"/>{article?<ArticleView article={article} related={articles}/>:<main className="blog-page blog-wrap"><h1>Article not found</h1><p>This article is not available.</p><Link to="/blog">Browse articles</Link></main>}<Footer/></>;
}
