// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { describe,it,expect } from 'vitest';
import { renderPublicPage } from '../entry-public';
import type { DocsIndex } from '@/components/docs/docsCollection';
const docs:DocsIndex={generated:'',tree:[],flat:{'README.md':{type:'file',name:'README.md',path:'README.md',title:'Documentation'}}};
describe('offline public rendering entry',()=>{
 it.each([
  {path:'/',kind:'home' as const,title:'Stackweaver'},
  {path:'/privacy',kind:'privacy' as const,title:'Privacy Policy'},
  {path:'/terms',kind:'terms' as const,title:'Terms of Service'},
 ])('gives $path one main landmark with its heading and keeps site navigation and footer outside',page=>{
  const html=renderPublicPage({...page,description:'Public page'}, {index:docs,content:'',articles:[]});
  const root=document.createElement('div');root.innerHTML=html;
  expect(root.querySelectorAll('main')).toHaveLength(1);
  expect(root.querySelector('main h1')?.textContent).toContain(page.title);
  expect(root.querySelector('main nav, main footer')).toBeNull();
  expect(root.querySelectorAll('nav')).toHaveLength(1);
  expect(root.querySelectorAll('footer')).toHaveLength(1);
 });
 it('renders the approved blog without a session, API or authenticated provider',()=>{
  const html=renderPublicPage({path:'/blog',title:'Blog',description:'Articles',kind:'blog'}, {index:docs,content:'',articles:[]});
  expect(html).toContain('Practical notes on infrastructure automation');
  expect(html).toContain('Articles are being prepared');
 });
 it('keeps documentation procedures and all code-group variants in initial HTML',()=>{
  const content='# Run a playbook\n\nA real operational procedure.\n\n::: code-group\n```bash [Shell]\nansible-playbook site.yml\n```\n```yaml [Inventory]\nall:\n  hosts:\n    example:\n```\n:::\n';
  const html=renderPublicPage({path:'/docs/run',source:'run.md',title:'Run',description:'Procedure',kind:'docs'}, {index:docs,content,articles:[]});
  expect(html).toContain('ansible-playbook site.yml');
  expect(html).toContain('hosts:');
  expect(html).toContain('A real operational procedure');
 });
});
