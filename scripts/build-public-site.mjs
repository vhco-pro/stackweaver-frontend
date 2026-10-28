// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { build } from 'vite';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';
import { parseArticles, publishedArticles } from '../src/lib/blog.ts';
import { buildPublicRoutes, pageMetadata, escapeHtml } from '../src/lib/publicRoutes.ts';
import { publicDocument } from './public-document.mjs';
import { siteSettings } from './site-settings.mjs';

const frontend=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dist=join(frontend,'dist'), ssr=join(frontend,'.public-build');
const index=JSON.parse(readFileSync(join(dist,'docs-index.json'),'utf8'));
const sourceDir=join(frontend,'src/content/articles');
const sources=Object.fromEntries(readdirSync(sourceDir).filter(name=>name.endsWith('.article.md')).map(name=>[name,readFileSync(join(sourceDir,name),'utf8')]));
const articles=publishedArticles(parseArticles(sources));
const pages=buildPublicRoutes(index,articles);
await build({root:frontend,configFile:join(frontend,'vite.config.ts'),build:{ssr:'src/entry-public.tsx',outDir:ssr,emptyOutDir:true,manifest:false,minify:false}});
// Reject accidental session services in the static graph, not merely failed API requests.
const serverSource=readFileSync(join(ssr,'entry-public.js'),'utf8');
if(/SESSION_RECHECK_MS|SESSION_QUERY_KEY|class ApiClient|function AuthProvider|function ApplicationProviders/.test(serverSource)) throw new Error('Public rendering imported authenticated application services');
const { renderPublicPage,renderPublicNotFound }=await import(pathToFileURL(join(ssr,'entry-public.js')).href);
const template=readFileSync(join(dist,'index.html'),'utf8');
writeFileSync(join(dist,'app-shell.html'),template.replace('<head>','<head>\n<base href="__SW_BASE_PATH__/"><meta name="sw-public-site-url" content="__SW_SITE_URL__">'));
const manifest=JSON.parse(readFileSync(join(dist,'.vite/manifest.json'),'utf8'));
const modules={home:'src/main.tsx',blog:'src/pages/Blog/Index.tsx',article:'src/pages/Blog/Article.tsx',ansible:'src/pages/Blog/Ansible.tsx',docs:'src/pages/Docs/DocsViewer.tsx','docs-index':'src/pages/Docs/DocsIndex.tsx',privacy:'src/pages/Privacy.tsx',terms:'src/pages/Terms.tsx'};
function styles(key,seen=new Set()) {
 if(!key||seen.has(key)) return [];seen.add(key); const chunk=manifest[key]; if(!chunk) return [];
 return [...(chunk.css??[]),...(chunk.imports??[]).flatMap(next=>styles(next,seen))];
}
function html(content,head,kind) {
 const css=[...new Set(styles(modules[kind]??modules.blog))].map(path=>`<link rel="stylesheet" href="__SW_BASE_PATH__/${escapeHtml(path)}">`).join('\n');
 content=content.replace(/(href|src)="\/(?!\/)/g,'$1="__SW_BASE_PATH__/');
 const fallback='<noscript><style>html{background:#f8fafc!important} [style*="opacity:0"]{opacity:1!important} [style*="visibility:hidden"]{visibility:visible!important} [data-stage]{height:auto!important}</style></noscript>';
 return publicDocument(template,{content,head,styles:css,fallback});
}
const files={};
const docsRoot=join(dist,'docs');
function collectAssets(dir) {
 for(const name of readdirSync(dir,{withFileTypes:true})) {
  const file=join(dir,name.name);
  if(name.isDirectory()) collectAssets(file);
  else if(name.name.endsWith('.explorer.json')||name.name.endsWith('.snippet.json')) {
   const key='/docs/'+file.slice(docsRoot.length+1).replaceAll('\\','/');
   files[key]=readFileSync(file,'utf8');
   if(name.name.endsWith('.explorer.json')) {
    const explorer=JSON.parse(files[key]); const root=file.slice(0,-'.explorer.json'.length);
    for(const entry of explorer.files) files[key.slice(0,-'.explorer.json'.length)+'/'+entry.path]=readFileSync(join(root,entry.path),'utf8');
   }
  }
 }
}
collectAssets(docsRoot);
const output=join(dist,'_site'); rmSync(output,{recursive:true,force:true}); mkdirSync(output,{recursive:true});
const originalFetch=globalThis.fetch;
globalThis.fetch=()=>{throw new Error('Public HTML rendering must not call a live API or network service');};
try {
 for(const page of pages) {
  const content=page.source?readFileSync(join(docsRoot,page.source),'utf8'):'';
  const markup=renderPublicPage(page,{index,content,articles,files});
  if(!markup.includes('<h1')||markup.includes('<!--$!-->')) throw new Error(`Incomplete public output: ${page.path}`);
  const target=join(output,page.path==='/'?'index.html':page.path.slice(1)+'.html'); mkdirSync(dirname(target),{recursive:true});
  writeFileSync(target,html(markup,pageMetadata(page),page.kind));
 }
 writeFileSync(join(dist,'404.html'),html(renderPublicNotFound(),'<title>Page not found | Stackweaver</title><meta name="robots" content="noindex" data-sw-meta>','blog'));
} finally {globalThis.fetch=originalFetch;}
const sitemap='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+pages.map(page=>`<url><loc>__SW_SITE_URL__${escapeHtml(page.path)}</loc>${page.kind==='article'&&page.updated?`<lastmod>${page.updated}</lastmod>`:''}</url>`).join('\n')+'\n</urlset>\n';
writeFileSync(join(dist,'sitemap.xml'),sitemap);
writeFileSync(join(dist,'robots.txt'),'User-agent: *\nAllow: /\n__SW_SITEMAP_LINE__\n');
// Parse declarations without importing appRoutes or executing application providers.
const registry=ts.createSourceFile('appRoutes.tsx',readFileSync(join(frontend,'src/appRoutes.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const routes=[];const visit=node=>{if(ts.isJsxAttribute(node)&&node.name.text==='path'&&node.initializer&&ts.isStringLiteral(node.initializer)) routes.push(node.initializer.text);ts.forEachChild(node,visit);};visit(registry);
const reserved=new Set(['/', '/landing','/privacy','/terms','/ansible','/blog','/blog/:slug','/compare/:slug','/docs','/docs/*','/internal-docs','/internal-docs/*','*']);
const regex=routes.filter(path=>!reserved.has(path)).map(path=>{ const wildcard=path.endsWith('/*'); const value=wildcard?path.slice(0,-2):path; const pattern=value.split('/').map(segment=>segment.startsWith(':')?'[^/]+':segment.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('/'); return pattern+(wildcard?'(?:/.*)?':''); });
const aliases={...JSON.parse(readFileSync(join(dist,'docs-redirects.json'),'utf8'))};
for(const page of pages) if(page.source&&/(?:^|\/)readme\.md$/i.test(page.source)) aliases[page.source.slice(0,-3)]=page.path.replace(/^\/docs\/?/,'');
const redirects=Object.entries(aliases).map(([from,to])=>`location = /docs/${from} { return 308 $sw_base_path/docs${to?'/'+to:''}$is_args$args; }`).join('\n');
writeFileSync(join(ssr,'public-private-routes.conf'),`# Derived from appRoutes JSX declarations and public docs aliases.\n${redirects}\nlocation ~ ^(?:${[...new Set(regex)].join('|')})/?$ {\n set $sw_noindex "noindex, nofollow";\n try_files /app-shell.html =404;\n}\n`);
writeFileSync(join(ssr,'public-site-settings.conf'),siteSettings({}));
writeFileSync(join(dist,'public-pages.json'),JSON.stringify(pages.map(({path,title,description})=>({path,title,description})))+'\n');
console.log(`Public site: ${pages.length} documents, ${articles.length} published articles; no live API/session or Semrush key required.`);
