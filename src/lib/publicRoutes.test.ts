// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { describe,it,expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { execPath } from 'node:process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { buildPublicRoutes, pageMetadata, cleanBasePath } from './publicRoutes';
import type { DocsIndex } from '@/components/docs/docsCollection';
const index: DocsIndex={generated:'',tree:[{type:'directory',name:'guides',path:'guides',children:[]}],flat:{'README.md':{type:'file',name:'README.md',path:'README.md',title:'Documentation'},'guides/README.md':{type:'file',name:'README.md',path:'guides/README.md',title:'Guides'},'guides/run.md':{type:'file',name:'run.md',path:'guides/run.md',title:'Run a playbook',description:'Launch and inspect a job.'}}};
describe('one public route catalogue',()=>{
 it('deduplicates README routes, lists actual docs and excludes internal/app URLs',()=>{
  const routes=buildPublicRoutes(index,[]);
  expect(routes.filter(r=>r.path==='/docs/guides')).toHaveLength(1);
  expect(routes.find(r=>r.path==='/docs/guides/run')?.title).toBe('Run a playbook');
  expect(routes.some(r=>r.path.includes('README'))).toBe(false);
  expect(routes.some(r=>/internal|login|auth|dashboard/.test(r.path))).toBe(false);
  expect(new Set(routes.map(r=>r.path)).size).toBe(routes.length);
 });
 it('does not discover draft articles and rejects duplicate metadata',()=>{
  const article={title:'AWX alternatives',description:'A real workflow',canonical:'/compare/awx',author:'Michiel VH',status:'draft' as const,updated:'2026-10-27',topics:['Ansible'],body:'Test'};
  expect(buildPublicRoutes(index,[article]).some(r=>r.path===article.canonical)).toBe(false);
  expect(()=>buildPublicRoutes(index,[{...article,status:'published'}, {...article,status:'published'}])).toThrow(/duplicate/i);
 });
 it.each(['/blog/valid-path', '/blog/v1.2_under-score/', '/blog/a/b/c'])('preserves supported article paths: %s',canonical=>{
  const article={title:'A workflow',description:'A real workflow',canonical,author:'Michiel VH',status:'published' as const,updated:'2026-10-27',topics:[],body:'Test'};
  expect(buildPublicRoutes(index,[article]).find(page=>page.path===canonical)?.kind).toBe('article');
 });
 it.each(['/blog//article', '/blog/article?query', '/blog/article#fragment', '/blog/a\\b', '/blog/a b'])('rejects malformed article paths: %s',canonical=>{
  const article={title:'A workflow',description:'A real workflow',canonical,author:'Michiel VH',status:'published' as const,updated:'2026-10-27',topics:[],body:'Test'};
  expect(()=>buildPublicRoutes(index,[article])).toThrow('Invalid public metadata:');
 });
 it('rejects a long malformed path without stalling the build',()=>{
  // Bound the child process so a regression cannot hang the test worker.
  const moduleUrl=pathToFileURL(resolve('src/lib/publicRoutes.ts')).href;
  const article={title:'A workflow',description:'A real workflow',canonical:'/blog/'+'-'.repeat(64)+'!',author:'Michiel VH',status:'published',updated:'2026-10-27',topics:[],body:'Test'};
  const script=`import { buildPublicRoutes } from ${JSON.stringify(moduleUrl)};
    try { buildPublicRoutes(${JSON.stringify(index)}, [${JSON.stringify(article)}]); process.exitCode=1; }
    catch(error) { if(error instanceof Error && error.message.startsWith('Invalid public metadata:')) process.stdout.write('rejected'); else throw error; }`;
  const result=spawnSync(execPath,['--input-type=module','--eval',script],{encoding:'utf8',timeout:3000});
  expect(result.error).toBeUndefined();
  expect(result.status,result.stderr).toBe(0);
  expect(result.stdout).toBe('rejected');
 },10000);
 it('includes an absolute branded preview image in initial HTML without assuming the founder domain',()=>{
  const page=buildPublicRoutes(index,[]).find(r=>r.path==='/blog')!;
  const html=pageMetadata(page);
  expect(html).toContain('property="og:image" content="__SW_SITE_URL__/logo.png"');
  expect(html).toContain('property="og:image:type" content="image/png"');
  expect(html).toContain('property="og:image:width" content="1024"');
  expect(html).toContain('property="og:image:height" content="1024"');
  expect(html).toContain('property="og:image:alt" content="Stackweaver logo"');
  expect(html).toContain('name="twitter:image" content="__SW_SITE_URL__/logo.png"');
  expect(html).toContain('name="twitter:image:alt" content="Stackweaver logo"');
 });
 it('normalizes supported mounts and rejects traversal/HTML injection',()=>{
  expect(cleanBasePath('/stack/')).toBe('/stack');
  expect(cleanBasePath('')).toBe('');
  for(const input of ['//evil.example','/../x','/x?query','/x"','/x\\y']) expect(()=>cleanBasePath(input)).toThrow();
 });
 it('uses relative same-origin canonicals until trusted deployment identity is configured',()=>{
  const page=buildPublicRoutes(index,[]).find(r=>r.path==='/blog')!;
  const html=pageMetadata(page);
  expect(html).toContain('rel="canonical"');
  expect(html).toContain('__SW_SITE_URL__/blog');
  expect(html).not.toContain('sw.vhco.pro');
  expect(html).not.toContain('FAQPage');
 });
});
