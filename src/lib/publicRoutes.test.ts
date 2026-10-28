// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { describe,it,expect } from 'vitest';
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
