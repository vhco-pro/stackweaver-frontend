// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { describe,it,expect,vi,afterEach } from 'vitest';
import { render,cleanup } from '@testing-library/react';
import { PageMetadata } from './PageMetadata';
vi.mock('virtual:public-pages',()=>({default:[{path:'/blog',title:'Articles',description:'Practical articles',kind:'blog'},{path:'/privacy',title:'Privacy',description:'Privacy choices',kind:'privacy'}]}));
afterEach(()=>{cleanup();document.head.querySelectorAll('[data-sw-meta],meta[name="sw-public-site-url"]').forEach(el=>el.remove());});
describe('metadata across public/private navigation',()=>{
 it('preserves the operator canonical origin on a noncanonical access host',()=>{
  const config=document.createElement('meta');config.name='sw-public-site-url';config.content='https://canonical.customer.example/stack';document.head.append(config);
  const {rerender}=render(<PageMetadata key="blog" path="/blog"/>);
  expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe('https://canonical.customer.example/stack/blog');
  rerender(<PageMetadata key="privacy" path="/privacy"/>);
  expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe('https://canonical.customer.example/stack/privacy');
  expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
  expect(document.title).toBe('Privacy | Stackweaver');
  rerender(<PageMetadata key="login" path="/login"/>);
  expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  expect(document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toContain('noindex');
 });
});
