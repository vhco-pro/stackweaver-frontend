// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useRoutePreload } from '@/components/routes/RoutePreloadContext';
import { navigationConnection, unrestrictedConnection } from '@/components/routes/navigationConnection';

export const WARMUP_PATTERNS = ['/app/:orgName/workspaces', '/app/:orgName/ansible/playbooks', '/app/:orgName/ansible/job-templates'] as const;

/** Shared imports outlive dashboard mounts; queued browser work does not. */
export function createNavigationWarmupCoordinator() {
  const attempted = new Set<string>();
  const listeners = new Set<() => void>();
  let pending: Promise<void> | undefined;
  return {
    next: () => pending ? undefined : WARMUP_PATTERNS.find(pattern => !attempted.has(pattern)),
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start(pattern: string, preload: (pattern: string) => Promise<void>) {
      if (pending || attempted.has(pattern)) return;
      attempted.add(pattern);
      pending = Promise.resolve().then(() => preload(pattern)).catch(() => undefined).then(() => {
        pending = undefined;
        for (const listener of listeners) listener();
      });
    },
  };
}
const documentWarmup = createNavigationWarmupCoordinator();

export function useNavigationWarmup(coordinator = documentWarmup) {
  const client = useQueryClient();
  const { session } = useAuth();
  const authenticated = !!session;
  const { preloadPattern } = useRoutePreload();
  useEffect(() => {
    if (!authenticated) return;
    let mounted = true, ready = false;
    let queued: { id: number; idle: boolean } | undefined;
    const connection = navigationConnection();
    const cancel = () => {
      if (!queued) return;
      if (queued.idle) window.cancelIdleCallback(queued.id);
      else window.clearTimeout(queued.id);
      queued = undefined;
    };
    const eligible = () => document.visibilityState !== 'hidden' && unrestrictedConnection();
    const hasOrganizations = () => {
      const stats = client.getQueryData<{ organizations?: unknown[] }>(['dashboard', 'stats']);
      return (stats?.organizations?.length ?? 0) > 0 || (client.getQueryData<unknown[]>(['organizations'])?.length ?? 0) > 0;
    };
    const evaluate = () => {
      if (!mounted) return;
      const fetching = client.isFetching() !== 0;
      const stats = client.getQueryState(['dashboard', 'stats']);
      if (!ready && stats && stats.status !== 'pending' && !fetching) ready = true;
      const pattern = coordinator.next();
      if (!ready || fetching || !eligible() || !hasOrganizations() || !pattern) { cancel(); return; }
      if (queued) return;
      const step = () => {
        queued = undefined;
        // Conditions can change between scheduling and the browser granting idle time.
        if (!mounted || !eligible() || client.isFetching() !== 0 || !hasOrganizations()) return;
        coordinator.start(pattern, preloadPattern);
      };
      queued = typeof window.requestIdleCallback === 'function'
        ? { id: window.requestIdleCallback(step), idle: true }
        : { id: window.setTimeout(step, 2000), idle: false };
    };
    const unsubscribeQueries = client.getQueryCache().subscribe(evaluate);
    const unsubscribeImports = coordinator.subscribe(evaluate);
    document.addEventListener('visibilitychange', evaluate);
    window.addEventListener('online', evaluate);
    window.addEventListener('offline', evaluate);
    connection?.addEventListener('change', evaluate);
    evaluate();
    return () => {
      mounted = false; cancel(); unsubscribeQueries(); unsubscribeImports();
      document.removeEventListener('visibilitychange', evaluate);
      window.removeEventListener('online', evaluate);
      window.removeEventListener('offline', evaluate);
      connection?.removeEventListener('change', evaluate);
    };
  }, [client, coordinator, preloadPattern, authenticated]);
}
