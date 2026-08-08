// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DocsSearch } from './DocsSearch';

interface DocTreeNode {
  type: 'directory' | 'file';
  name: string;
  path: string;
  title?: string;
  description?: string;
  status?: string;
  children?: DocTreeNode[];
}

interface DocsIndex {
  tree: DocTreeNode[];
  flat: Record<string, DocTreeNode>;
  generated: string;
}

interface DocsSidebarProps {
  className?: string;
  onNavigate?: () => void;
  docsBase?: string;
  indexFile?: string;
}

const STATUS_COLORS: Record<string, string> = {
  planned:       'bg-blue-500',
  'in-progress': 'bg-amber-500',
  complete:      'bg-emerald-500',
  draft:         'bg-purple-500',
  archived:      'bg-slate-400',
  abandoned:     'bg-red-500',
  superseded:    'bg-orange-500',
  blocked:       'bg-rose-500',
  parked:        'bg-zinc-500',
};

function StatusDot({ status }: { status?: string }) {
  if (!status) return null;
  const color = STATUS_COLORS[status] ?? 'bg-muted-foreground';
  const label = status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ');
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${color}`}
      title={label}
    />
  );
}

function filterTree(nodes: DocTreeNode[], hideCompleted: boolean): DocTreeNode[] {
  if (!hideCompleted) return nodes;
  return nodes
    .map(node => {
      if (node.type === 'file') {
        return node.status === 'complete' ? null : node;
      }
      const children = filterTree(node.children ?? [], hideCompleted);
      if (children.length === 0) return null;
      return { ...node, children };
    })
    .filter((n): n is DocTreeNode => n !== null);
}

export function DocsSidebar({ className, onNavigate, docsBase = '/docs', indexFile = '/docs-index.json' }: DocsSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [index, setIndex] = useState<DocsIndex | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const isInternal = docsBase === '/internal-docs';
  const [hideCompleted, setHideCompleted] = useState(() =>
    isInternal && localStorage.getItem('internal-docs-hide-completed') === 'true'
  );

  useEffect(() => {
    async function loadIndex() {
      try {
        const response = await fetch(indexFile);
        if (!response.ok) throw new Error('Failed to load docs index');
        const data = await response.json() as DocsIndex;
        setIndex(data);
      } catch (error) {
        console.error('Failed to load docs index:', error);
      } finally {
        setLoading(false);
      }
    }

    void loadIndex();
  }, [indexFile]);

  // Auto-expand directories that contain the current path when the location (or
  // the freshly-loaded index) changes. Done as a during-render merge keyed on the
  // previous path (React's blessed pattern) rather than in an effect - it only
  // adds ancestors, so user-toggled expansions are preserved.
  const expandKey = index ? `${docsBase}|${location.pathname}` : null;
  const [prevExpandKey, setPrevExpandKey] = useState<string | null>(null);
  if (expandKey !== null && expandKey !== prevExpandKey) {
    setPrevExpandKey(expandKey);
    const currentPath = location.pathname.replace(new RegExp(`^${docsBase}/?`), '').replace(/\/$/, '') || 'README.md';
    const parts = currentPath.split('/').filter(Boolean);
    // Expand all ancestor directories and the current directory itself
    // (so navigating to a folder via prev/next also opens it)
    setExpandedDirs(prev => {
      const next = new Set(prev);
      for (let i = 0; i < parts.length; i++) {
        next.add(parts.slice(0, i + 1).join('/'));
      }
      return next;
    });
  }

  const toggleDir = (path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const getDocPath = (nodePath: string): string => {
    // Remove .md extension and convert to route path
    const withoutExt = nodePath.replace(/\.md$/, '');
    // If it's the root README, return the base
    if (withoutExt === 'README' || withoutExt === 'README.md') {
      return docsBase;
    }
    // For README in subdirectories, use the directory path as the doc path
    const parts = withoutExt.split('/');
    if (parts[parts.length - 1] === 'README') {
      return `${docsBase}/${parts.slice(0, -1).join('/')}`;
    }
    return `${docsBase}/${withoutExt}`;
  };

  // Check if a directory has a README file (case-insensitive)
  const findReadmeInDir = (children?: DocTreeNode[]): DocTreeNode | null => {
    if (!children) return null;
    return children.find(child => 
      child.type === 'file' && 
      /^README\.md$/i.test(child.name)
    ) || null;
  };

  const isActive = (nodePath: string): boolean => {
    const docPath = getDocPath(nodePath);
    const currentPath = location.pathname.replace(/\/$/, ''); // Remove trailing slash

    // Handle README/index - only match exactly the base, not sub-paths
    if (nodePath === 'README.md') {
      return currentPath === docsBase || currentPath === '';
    }

    // For other docs, match exactly or as a prefix (but not if it's the base path)
    if (docPath === docsBase) {
      return false; // Already handled above
    }

    return currentPath === docPath || currentPath.startsWith(docPath + '/');
  };

  const renderNode = (node: DocTreeNode, level = 0): React.ReactNode => {
    if (node.type === 'directory') {
      const isExpanded = expandedDirs.has(node.path);
      const hasChildren = node.children && node.children.length > 0;
      const readmeFile = findReadmeInDir(node.children);
      const readmePath = readmeFile ? getDocPath(readmeFile.path) : null;
      
      // Filter out README from children if it exists (we'll use it as default)
      const childrenWithoutReadme = node.children?.filter(child => 
        !(child.type === 'file' && /^README\.md$/i.test(child.name))
      ) || [];
      
      // Check if current path matches this directory's README
      const currentPathNorm = location.pathname.replace(/\/$/, '');
      const isReadmeActive = !!readmePath && currentPathNorm === readmePath;
      
      const handleFolderClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        // Only the chevron toggles expand/collapse
        if (target.closest('.chevron-container')) {
          e.preventDefault();
          toggleDir(node.path);
          return;
        }
        // Clicking the folder icon or label: navigate to README when it exists, otherwise toggle
        if (readmePath) {
          e.preventDefault();
          setExpandedDirs(prev => {
            const next = new Set(prev);
            next.add(node.path);
            const parts = node.path.split('/');
            for (let i = 1; i < parts.length; i++) {
              next.add(parts.slice(0, i).join('/'));
            }
            return next;
          });
          onNavigate?.();
          void navigate(readmePath);
        } else {
          toggleDir(node.path);
        }
      };
      
      return (
        <div key={node.path}>
          <button
            onClick={handleFolderClick}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 rounded-md transition-colors',
              'text-muted-foreground dark:text-[#d7dfe9] hover:text-foreground',
              isReadmeActive && 'bg-muted text-foreground font-medium',
              level > 0 && 'pl-6'
            )}
            style={{ paddingLeft: `${0.75 + level * 1.5}rem` }}
          >
            {hasChildren && (
              <div className="chevron-container shrink-0">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            )}
            <div className="folder-icon-container shrink-0">
              {isExpanded ? (
                <FolderOpen className="h-4 w-4" />
              ) : (
                <Folder className="h-4 w-4" />
              )}
            </div>
            <span className="truncate">{node.name}</span>
          </button>
          {isExpanded && hasChildren && (
            <div className="mt-1">
              {childrenWithoutReadme.map(child => renderNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    } else {
      const docPath = getDocPath(node.path);
      const active = isActive(node.path);
      
      return (
        <Link
          key={node.path}
          to={docPath}
          onClick={() => onNavigate?.()}
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors',
            'hover:bg-muted/50 text-muted-foreground dark:text-[#d7dfe9] hover:text-foreground',
            active && 'bg-muted text-foreground font-medium',
            level > 0 && 'pl-6'
          )}
          style={{ paddingLeft: `${0.75 + level * 1.5}rem` }}
          title={node.description || undefined}
        >
          {isInternal && <StatusDot status={node.status} />}
          <FileText className="h-4 w-4 shrink-0" />
          <span className="truncate">{node.title || node.name.replace(/\.md$/, '')}</span>
        </Link>
      );
    }
  };

  if (loading) {
    return (
      <div className={cn('p-4 space-y-2', className)}>
        <div className="h-6 bg-muted/50 rounded-sm animate-pulse" />
        <div className="h-6 bg-muted/50 rounded-sm animate-pulse ml-4" />
        <div className="h-6 bg-muted/50 rounded-sm animate-pulse ml-4" />
      </div>
    );
  }

  if (!index || !index.tree.length) {
    return (
      <div className={cn('p-4 text-sm text-muted-foreground', className)}>
        No documentation available
      </div>
    );
  }

  const visibleTree = filterTree(index.tree, isInternal && hideCompleted);

  return (
    <nav className={cn('p-4 space-y-1', className)}>
      <div className="mb-3">
        <DocsSearch
          docsBase={docsBase}
          searchIndexFile={isInternal ? '/internal-docs-search-index.json' : '/docs-search-index.json'}
        />
      </div>
      {isInternal && (
        <label className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground cursor-pointer select-none mb-1">
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(e) => {
              setHideCompleted(e.target.checked);
              localStorage.setItem('internal-docs-hide-completed', String(e.target.checked));
            }}
            className="rounded-sm border-border"
          />
          Hide completed
        </label>
      )}
      {visibleTree.map(node => renderNode(node))}
    </nav>
  );
}
