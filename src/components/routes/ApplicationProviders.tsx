// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { Outlet } from 'react-router-dom';
import { OrganizationProvider } from '@/contexts/OrganizationContext';

/** Application-only state stays mounted across application routes, outside public pages. */
export default function ApplicationProviders() {
  return <OrganizationProvider><Outlet /></OrganizationProvider>;
}
