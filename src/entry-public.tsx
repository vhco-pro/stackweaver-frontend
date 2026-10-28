// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { renderToString } from 'react-dom/server';
import { StaticRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { DocsEnvironmentContext } from '@/components/docs/DocsEnvironment';
import { PublicNav } from '@/components/navigation/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { BlogIndex } from '@/components/blog/BlogIndex';
import { ArticleView } from '@/components/blog/ArticleView';
import DocsIndexPage from '@/pages/Docs/DocsIndex';
import DocsViewer from '@/pages/Docs/DocsViewer';
import { PublicNotFound } from '@/components/blog/PublicNotFound';
import Landing from '@/pages/Landing';
import Privacy from '@/pages/Privacy';
import Terms from '@/pages/Terms';
import type { DocsIndex } from '@/components/docs/docsCollection';
import type { PublicPage } from '@/lib/publicRoutes';
import type { BlogArticle } from '@/lib/blog';
import { AnsiblePage } from '@/components/blog/AnsiblePage';

export interface PublicRenderInput { index:DocsIndex; content:string; articles:BlogArticle[]; files?:Record<string,string> }
export function renderPublicPage(page:PublicPage,input:PublicRenderInput):string {
 const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
 client.setQueryData(['docs-index','public','/docs','/docs-index.json'],input.index);
 client.setQueryData(['docs-redirects','/docs'],{});
 client.setQueryData(['docs-overview-introduction','public','/docs-index.json','/docs'],input.content);
 const docPath=page.path.replace(/^\/docs\/?/,'')||'README';
 client.setQueryData(['doc','public','/docs-index.json','/docs',docPath,page.path],{content:input.content,isDirectoryPage:page.folder!==undefined});
 const article=input.articles.find(article=>article.canonical===page.path);
 const body=page.kind==='home'?<Landing/>:page.kind==='privacy'?<Privacy/>:page.kind==='terms'?<Terms/>:page.kind==='blog'?<BlogIndex articles={input.articles}/>:page.kind==='article'&&article?<ArticleView article={article} related={input.articles}/>:page.kind==='ansible'?<AnsiblePage/>:page.path==='/docs'?<DocsIndexPage/>:page.kind==='docs-index'&&!page.source?<DocsIndexPage folderPath={page.folder}/>:<Routes><Route path="/docs/*" element={<DocsViewer/>}/></Routes>;
 try {
  return renderToString(<StaticRouter location={page.path}><QueryClientProvider client={client}><ThemeProvider><DocsEnvironmentContext.Provider value={{basePath:'',staticRender:true,files:input.files}}>{page.kind!=='home'&&<PublicNav activeLink={page.kind==='docs'||page.kind==='docs-index'?'docs':'blog'}/>} {body}{!['home','docs','docs-index'].includes(page.kind)&&<Footer/>}</DocsEnvironmentContext.Provider></ThemeProvider></QueryClientProvider></StaticRouter>);
 } finally { client.clear(); }
}

export function renderPublicNotFound():string { return renderToString(<StaticRouter location="/404"><ThemeProvider><PublicNotFound/></ThemeProvider></StaticRouter>); }
