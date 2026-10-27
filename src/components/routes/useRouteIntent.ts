// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useRoutePreload } from './RoutePreloadContext';
import { unrestrictedConnection } from './navigationConnection';

export function useRouteIntent(to: string) {
  const { preloadPath } = useRoutePreload();
  const { pathname } = useLocation();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancel = () => { clearTimeout(timer.current); timer.current = undefined; };
  useMountEffect(() => cancel);
  const current = to.split(/[?#]/)[0] === pathname;
  const start = () => { cancel(); if (!current) void preloadPath(to); };
  const delayed = () => {
    cancel();
    if (!current && unrestrictedConnection()) timer.current = setTimeout(() => { if (unrestrictedConnection()) start(); }, 75);
  };
  return { onPointerEnter: delayed, onPointerLeave: cancel, onFocus: delayed, onBlur: cancel, onPointerDown: start };
}
