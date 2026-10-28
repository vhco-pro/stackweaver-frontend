// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BlogIndex } from './BlogIndex';
import type { BlogArticle } from '@/lib/blog';

const articles: BlogArticle[] = [
  {title:'AWX alternatives',description:'Evaluate an Ansible controller',canonical:'/compare/awx',author:'Michiel VH',status:'published',published:'2026-10-27',updated:'2026-10-27',topics:['Ansible','Comparisons'],body:'## A real task\nRun a playbook.'},
  {title:'Terraform Cloud alternatives',description:'OpenTofu state and automation',canonical:'/compare/terraform-cloud',author:'Michiel VH',status:'published',published:'2026-10-27',updated:'2026-10-27',topics:['OpenTofu','Comparisons'],body:'State.'},
];
function open(input=articles) { cleanup(); render(<MemoryRouter><BlogIndex articles={input} /></MemoryRouter>); }
describe('approved blog index', () => {
 it('exposes canonical comparison destinations without duplicate blog URLs', () => {
  open();
  expect(screen.getByRole('heading',{name:'Practical notes on infrastructure automation.'})).toBeTruthy();
  expect(screen.getByRole('link',{name:/AWX alternatives/}).getAttribute('href')).toBe('/compare/awx');
  expect(screen.getByRole('link',{name:/Terraform Cloud alternatives/}).getAttribute('href')).toBe('/compare/terraform-cloud');
  expect(screen.getByText(/managed service is planned/)).toBeTruthy();
 });
 it('combines topic and search, announces empty results and clears filters', () => {
  open();
  fireEvent.click(screen.getByRole('button',{name:'OpenTofu'}));
  expect(screen.queryByRole('link',{name:/AWX alternatives/})).toBeNull();
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'no matching topic'}});
  expect(screen.getByRole('status').textContent).toContain('No articles');
  fireEvent.click(screen.getByRole('button',{name:'Clear filters'}));
  expect(screen.getByRole('link',{name:/AWX alternatives/})).toBeTruthy();
 });
 it('excludes drafts and has an honest empty archive', () => {
  open([{...articles[0],status:'draft'}]);
  expect(screen.queryByRole('link',{name:/AWX alternatives/})).toBeNull();
  expect(screen.getByRole('status').textContent).toContain('Articles are being prepared');
 });
});
