// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import type { DocsIndex, DocTreeNode } from '../components/docs/docsTypes';
import type { BlogArticle } from './blog';
export interface PublicPage {
 path:string; title:string; description:string;
 kind:'home'|'blog'|'article'|'docs'|'docs-index'|'ansible'|'privacy'|'terms';
 source?:string; folder?:string; updated?:string; author?:string; published?:string;
}
export function cleanBasePath(value:string):string {
 if(value===''||value==='/') return '';
 const normalized=value.replace(/\/$/,'');
 if(!/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+$/.test(normalized)) throw new Error('Invalid public base path');
 return normalized;
}
export const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function buildPublicRoutes(index:DocsIndex, articles:readonly BlogArticle[]):PublicPage[] {
 const pages:PublicPage[]=[
  {path:'/',kind:'home',title:'Ansible and OpenTofu automation',description:'Run Ansible playbooks and OpenTofu infrastructure workflows with Stackweaver. Self-host today; a managed service is planned.'},
  {path:'/ansible',kind:'ansible',title:'Ansible automation with a web interface',description:'Launch repository playbooks, manage inventories and credentials, schedule jobs and inspect host-by-task output with Stackweaver.'},
  {path:'/blog',kind:'blog',title:'Practical infrastructure automation articles',description:'Workflow comparisons and practical notes on Ansible, OpenTofu and running infrastructure automation as a team.'},
  {path:'/privacy',kind:'privacy',title:'Privacy Policy',description:'How Stackweaver handles personal data, authentication and your privacy choices.'},
  {path:'/terms',kind:'terms',title:'Terms of Service',description:'Terms for using Stackweaver and its related services.'},
 ];
 const docs=new Map<string,PublicPage>();
 const label=(path:string)=>path.split('/').at(-1)!.replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
 function directories(nodes:DocTreeNode[]) {
  for(const node of nodes) if(node.type==='directory') {
   docs.set('/docs/'+node.path,{path:'/docs/'+node.path,kind:'docs-index',folder:node.path,title:label(node.path),description:`Browse ${label(node.path).toLowerCase()} documentation for Stackweaver.`});
   directories(node.children??[]);
  }
 }
 directories(index.tree);
 for(const [source,node] of Object.entries(index.flat)) {
  if(!source.endsWith('.md')) continue;
  if(source.includes('..')||source.startsWith('/')||source.includes('\\')||source.startsWith('internal/')) throw new Error(`Invalid public document source: ${source}`);
  const folder=/^README\.md$/i.test(source)?'':/\/README\.md$/i.test(source)?source.replace(/\/README\.md$/i,''):undefined;
  const path=folder!==undefined?'/docs'+(folder?'/'+folder:''):'/docs/'+source.slice(0,-3);
  const title=node.title&&node.title!=='README'?node.title:folder?label(folder):label(source.slice(0,-3));
  docs.set(path,{path,kind:folder!==undefined&&node.layout==='overview'?'docs-index':'docs',source,folder,title,description:node.description||`${title}: Stackweaver documentation and operational guidance.`});
 }
 if(!docs.has('/docs')) throw new Error('Public documentation must have a root README');
 pages.push(...docs.values());
 for(const article of articles) if(article.status==='published') pages.push({path:article.canonical,title:article.title,description:article.description,kind:'article',updated:article.updated,author:article.author,published:article.published});
 const seen=new Set<string>();
 for(const page of pages) {
  if(seen.has(page.path)) throw new Error(`Duplicate public route: ${page.path}`);
  seen.add(page.path);
  if(!page.title.trim()||!page.description.trim()||!/^\/(?:[a-zA-Z0-9_.-]+\/?)*$/.test(page.path)) throw new Error(`Invalid public metadata: ${page.path}`);
 }
 return pages.sort((a,b)=>a.path.localeCompare(b.path));
}
export function pageStructuredData(page:PublicPage,siteUrl:string):Record<string,unknown>|null {
 if(page.kind==='home') return {'@context':'https://schema.org','@type':'SoftwareApplication',name:'Stackweaver',applicationCategory:'DeveloperApplication',url:siteUrl+'/',license:'https://github.com/vhco-pro/stackweaver-api/blob/main/LICENSE',creator:{'@type':'Organization',name:'VH & Co BV'}};
 if(page.kind==='article') return {'@context':'https://schema.org','@type':'Article',headline:page.title,description:page.description,url:siteUrl+page.path,author:{'@type':'Person',name:page.author},...(page.published?{datePublished:page.published}:{}),...(page.updated?{dateModified:page.updated}:{})};
 return null;
}
export function pageMetadata(page:PublicPage):string {
 const title=escapeHtml(`${page.title} | Stackweaver`),description=escapeHtml(page.description),url='__SW_SITE_URL__'+page.path;
 const entity=pageStructuredData(page,'__SW_SITE_URL__');
 return `<title>${title}</title>\n<meta name="description" content="${description}" data-sw-meta>\n<link rel="canonical" href="${escapeHtml(url)}" data-sw-meta>\n<meta property="og:title" content="${title}" data-sw-meta>\n<meta property="og:description" content="${description}" data-sw-meta>\n<meta property="og:type" content="${page.kind==='article'?'article':'website'}" data-sw-meta>\n<meta property="og:url" content="${escapeHtml(url)}" data-sw-meta>\n<meta name="twitter:card" content="summary" data-sw-meta>${entity?`\n<script type="application/ld+json" data-sw-meta>${JSON.stringify(entity).replace(/</g,'\\u003c')}</script>`:''}`;
}
