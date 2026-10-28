// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { describe,it,expect } from 'vitest';
import { render,screen,cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DocsEnvironmentContext } from './DocsEnvironment';
import { MarkdownRenderer } from './MarkdownRenderer';
describe('portable document mount adapter',()=>{
 it('keeps copied and new-tab document links within the mount',()=>{
  cleanup();render(<MemoryRouter basename="/stack" initialEntries={['/stack/docs/guide']}><DocsEnvironmentContext.Provider value={{basePath:'/stack',staticRender:false}}><MarkdownRenderer content={'[Other guide](./other.md)\n\n[Section](#step)\n\n[External](//example.com/docs)'} docPath="guide"/></DocsEnvironmentContext.Provider></MemoryRouter>);
  expect(screen.getByRole('link',{name:'Other guide'}).getAttribute('href')).toBe('/stack/docs/other');
  expect(screen.getByRole('link',{name:'Section'}).getAttribute('href')).toBe('/stack/docs/guide#step');
  expect(screen.getByRole('link',{name:'External'}).getAttribute('href')).toBe('//example.com/docs');
 });
});
