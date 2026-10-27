// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { Outlet, useMatch } from 'react-router-dom';
import { PublicNav } from '@/components/navigation/PublicNav';

/** Keep navigation and its open menu mounted while documentation destinations load. */
export function DocsShell() {
  const explorer = useMatch('/docs/api-reference/explorer');
  return <>{!explorer && <PublicNav activeLink="docs" />}<Outlet /></>;
}
