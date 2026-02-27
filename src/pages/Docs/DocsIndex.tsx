// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import DocsViewer from './DocsViewer';

/**
 * DocsIndex - Shows the main README.md by default
 * This is essentially the same as DocsViewer but for the root /docs route
 */
export default function DocsIndex() {
  return <DocsViewer />;
}
