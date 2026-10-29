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
  expect(screen.getByText(/Available as SaaS, or self-hosted with Docker Compose or Helm/)).toBeTruthy();
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
 it('leads with the featured story without mutating input or disguising it as a comparison', () => {
  const founder: BlogArticle = {...articles[0], title:"Why I'm building Stackweaver", canonical:'/blog/why-i-built-stackweaver', topics:['Stackweaver','Vision'], featured:true};
  const input = [...articles, founder];
  open(input);
  const story = screen.getByRole('link',{name:/Why I'm building/});
  expect(story.className).toBe('blog-featured');
  expect(story.textContent).not.toContain('Terraform Cloud');
  expect(input[0]).toBe(articles[0]);
  fireEvent.click(screen.getByRole('button',{name:'Vision'}));
  expect(screen.queryByRole('link',{name:/AWX alternatives/})).toBeNull();
  expect(screen.getByRole('link',{name:/Why I'm building/})).toBeTruthy();
 });
 it('keeps featured drafts out of public discovery but includes them in editorial preview', () => {
  const founder: BlogArticle = {...articles[0], title:'Founder vision', canonical:'/blog/vision', status:'draft', featured:true};
  open([...articles,founder]);
  expect(screen.queryByRole('link',{name:/Founder vision/})).toBeNull();
  expect(screen.getByRole('link',{name:/AWX alternatives/}).className).toBe('blog-featured');
  cleanup();
  render(<MemoryRouter><BlogIndex articles={[...articles,founder]} preview /></MemoryRouter>);
  expect(screen.getByRole('link',{name:/Founder vision/}).className).toBe('blog-featured');
 });
 it('excludes drafts and has an honest empty archive', () => {
  open([{...articles[0],status:'draft'}]);
  expect(screen.queryByRole('link',{name:/AWX alternatives/})).toBeNull();
  expect(screen.getByRole('status').textContent).toContain('Articles are being prepared');
 });
});
