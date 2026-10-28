// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { Children, isValidElement, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Outlet, matchRoutes, useRoutes, type RouteObject } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrganizationProvider, useOrganization } from '@/contexts/OrganizationContext';
import { appRoutes } from './appRoutes';
import contract from './test/route-contract.json';

// Captured from 3d97c58d before refactoring. Preserve public paths, wrapper order and width.
const auth = vi.hoisted<{ session: object | null; loading: boolean }>(() => ({ session: { user: { id: 'person' } }, loading: false }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/api/client', () => ({ organizationsApi: { list: vi.fn(() => Promise.resolve({ data: [{ id: 'org-acme', name: 'acme' }] })) } }));
vi.mock('./pages/Landing', () => ({ default: function Landing() { return <p>Landing</p>; } }));
vi.mock('@/components/routes/deferredPage', () => ({ deferredPage: (_loader: unknown, name: string) => {
  function Deferred({ children, width }: { children?: ReactNode; width?: string }) {
    if (name === 'ApplicationProviders') return <OrganizationProvider><Outlet /></OrganizationProvider>;
    if (name === 'Layout') return <LayoutProbe width={width}>{children}</LayoutProbe>;
    if (name === 'OrganizationGuard') return <GuardProbe>{children}</GuardProbe>;
    return <p>{name}</p>;
  }
  Deferred.displayName = name;
  return Deferred;
} }));

function LayoutProbe({ children, width }: { children: ReactNode; width?: string }) {
  const { organizations } = useOrganization();
  return <main data-testid="layout" data-width={width ?? 'default'} data-orgs={organizations.length}>{children}</main>;
}
function GuardProbe({ children }: { children: ReactNode }) { useOrganization(); return children; }
function View() { return useRoutes(appRoutes); }

function wrappers(node: ReactNode): Array<{ name: string; width?: string }> {
  const result: Array<{ name: string; width?: string }> = [];
  Children.forEach(node, (child) => {
    if (!isValidElement<{ children?: ReactNode; width?: string }>(child)) return;
    const component = child.type as { displayName?: string; name?: string };
    result.push({ name: component.displayName ?? component.name ?? String(child.type), ...(child.props.width ? { width: child.props.width } : {}) });
    result.push(...wrappers(child.props.children));
  });
  return result;
}
function flatten(routes: RouteObject[]): RouteObject[] { return routes.flatMap(r => [r, ...flatten(r.children ?? [])]); }
const concrete = (path: string) => path.replace(/:(\w+)/g, (_, name: string) => /org|organization|^name$/i.test(name) ? 'acme' : 'example');

describe('route contract and provider placement', () => {
  afterEach(() => { auth.session = { user: { id: 'person' } }; localStorage.clear(); });

  it('preserves every existing route in order, including guards and layout widths', () => {
    const added=new Set(['/ansible','/blog','/compare/:slug','/blog/:slug','*']);
    const all=flatten(appRoutes).filter(r=>r.path).map(r=>({path:r.path,wrappers:wrappers(r.element)}));
    // Preserve the captured private/public contract while adding the reviewed public routes.
    expect(all.filter(route=>!added.has(route.path!))).toEqual(contract);
    expect(all.filter(route=>added.has(route.path!))).toEqual([
      {path:'/ansible',wrappers:[{name:'AnsiblePublic'}]},
      {path:'/blog',wrappers:[{name:'Blog'}]},
      {path:'/compare/:slug',wrappers:[{name:'BlogArticle'}]},
      {path:'/blog/:slug',wrappers:[{name:'BlogArticle'}]},
      {path:'*',wrappers:[{name:'PublicNotFound'}]},
    ]);
  });

  it('matches the protected organization run route before its legacy duplicate', () => {
    const route = matchRoutes(appRoutes, '/app/acme/example/runs/example')?.at(-1)?.route;
    expect(route?.path).toBe('/app/:orgName/:workspaceName/runs/:runId');
    expect(wrappers(route?.element).map(w => w.name)).toContain('OrganizationGuard');
  });

  it('keeps the terraform-versions redirect outside ProtectedRoute', () => {
    const route = matchRoutes(appRoutes, '/app/acme/settings/terraform-versions')?.at(-1)?.route;
    expect(wrappers(route?.element).map(w => w.name)).toEqual(['Navigate']);
  });

  for (const route of contract.filter(r => r.wrappers.some(w => w.name === 'Layout'))) {
    it(`provides organization state for ${route.path}`, () => {
      const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
      client.setQueryData(['organizations'], [{ id: 'org-acme', name: 'acme' }]);
      render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[concrete(route.path)]}><View /></MemoryRouter></QueryClientProvider>);
      expect(screen.getByTestId('layout')).toHaveAttribute('data-orgs', '1');
      client.clear();
    });
  }

  it('preserves basename and the requested return destination for unauthenticated deep links', () => {
    auth.session = null;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter basename="/prefix" initialEntries={['/prefix/app/acme/workspaces/example?tab=runs#output']}><View /></MemoryRouter></QueryClientProvider>);
    expect(sessionStorage.getItem('oauth_return_url')).toBe('/app/acme/workspaces/example?tab=runs#output');
    expect(screen.getByText('Auth')).toBeInTheDocument();
    client.clear();
  });
});
