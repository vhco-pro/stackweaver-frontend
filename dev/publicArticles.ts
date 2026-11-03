// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { buildPublicRoutes } from '../src/lib/publicRoutes';
import { parseArticles, publishedArticles } from '../src/lib/blog';

export function articleModule(sources: Record<string,string>, preview: boolean, summaries = false) {
  const parsed = parseArticles(sources);
  const selected = preview ? parsed : publishedArticles(parsed);
  const output = summaries ? selected.map(article => ({title:article.title,description:article.description,canonical:article.canonical,author:article.author,status:article.status,published:article.published,featured:article.featured,updated:article.updated,topics:article.topics})) : selected;
  return `export default ${JSON.stringify(output)};`;
}
/** Production bundles never contain draft article bodies, including in source maps. */
export function publicArticlesPlugin(directory: string): Plugin {
  let preview = false;
  const virtual = 'virtual:public-articles';
  const resolved = '\0' + virtual;
  const pagesId='virtual:public-pages';
  const summariesId='virtual:public-article-summaries';
  const indexFile=path.resolve(directory,'../../../public/docs-index.json');
  return {
    name:'public-articles',
    configResolved(config) { preview = config.command==='serve' && !config.isProduction; },
    resolveId(id) { if(id===virtual) return resolved; if(id===pagesId||id===summariesId) return '\0'+id; },
    load(id) {
      if(id!==resolved && id!=='\0'+pagesId && id!=='\0'+summariesId) return;
      const sources: Record<string,string> = {};
      for(const name of readdirSync(directory).filter(name => name.endsWith('.article.md')).sort()) {
        const file=path.join(directory,name); this.addWatchFile(file); sources[name]=readFileSync(file,'utf8');
      }
      if(id==='\0'+pagesId) { this.addWatchFile(indexFile); const index=JSON.parse(readFileSync(indexFile,'utf8')) as Parameters<typeof buildPublicRoutes>[0]; return `export default ${JSON.stringify(buildPublicRoutes(index,parseArticles(sources)))};`; }
      return articleModule(sources,preview,id==='\0'+summariesId);
    },
    handleHotUpdate(context) { if(context.file.startsWith(directory)) { const modules=[resolved,'\0'+pagesId,'\0'+summariesId].flatMap(id=>{const module=context.server.moduleGraph.getModuleById(id);return module?[module]:[];});for(const module of modules) context.server.moduleGraph.invalidateModule(module);return modules;} },
  };
}
