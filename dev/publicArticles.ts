// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { buildPublicRoutes } from '../src/lib/publicRoutes';
import { parseArticles, publishedArticles } from '../src/lib/blog';

export function articleModule(sources: Record<string,string>, preview: boolean) {
  const parsed = parseArticles(sources);
  return `export default ${JSON.stringify(preview ? parsed : publishedArticles(parsed))};`;
}
/** Production bundles never contain draft article bodies, including in source maps. */
export function publicArticlesPlugin(directory: string): Plugin {
  let preview = false;
  const virtual = 'virtual:public-articles';
  const resolved = '\0' + virtual;
  const pagesId='virtual:public-pages';
  const indexFile=path.resolve(directory,'../../../public/docs-index.json');
  return {
    name:'public-articles',
    configResolved(config) { preview = config.command==='serve' && !config.isProduction; },
    resolveId(id) { if(id===virtual) return resolved; if(id===pagesId) return '\0'+pagesId; },
    load(id) {
      if(id!==resolved && id!=='\0'+pagesId) return;
      const sources: Record<string,string> = {};
      for(const name of readdirSync(directory).filter(name => name.endsWith('.article.md')).sort()) {
        const file=path.join(directory,name); this.addWatchFile(file); sources[name]=readFileSync(file,'utf8');
      }
      if(id==='\0'+pagesId) { this.addWatchFile(indexFile); const index=JSON.parse(readFileSync(indexFile,'utf8')) as Parameters<typeof buildPublicRoutes>[0]; return `export default ${JSON.stringify(buildPublicRoutes(index,parseArticles(sources)))};`; }
      return articleModule(sources,preview);
    },
    handleHotUpdate(context) { if(context.file.startsWith(directory)) { const modules=[resolved,'\0'+pagesId].flatMap(id=>{const module=context.server.moduleGraph.getModuleById(id);return module?[module]:[];});for(const module of modules) context.server.moduleGraph.invalidateModule(module);return modules;} },
  };
}
