// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
export interface DocTreeNode {
  type: 'directory' | 'file';
  name: string;
  path: string;
  title?: string;
  description?: string;
  status?: string;
  nav_order?: number;
  layout?: 'overview';
  children?: DocTreeNode[];
}
export interface DocsIndex {
  tree: DocTreeNode[];
  flat: Record<string, DocTreeNode>;
  generated: string;
}
