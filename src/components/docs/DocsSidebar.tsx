// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen } from 'lucide-react';
import { BrandIcon } from '@/components/brand/BrandIcon';
import { brandById } from '@/lib/brands';
import { cn } from '@/lib/utils';
import { docLabel, resolveCollection, sidebarOptions, useDocsIndex, useCompletedFilter, type BrandLogoPolicy, type DocsCollection } from './docsCollection';
import { DocsSearch } from './DocsSearch';
import type { DocTreeNode } from './docsTypes';

interface DocsSidebarProps {
  className?: string;
  collection?: DocsCollection;
  showSearch?: boolean;
  onNavigate?: () => void;
  docsBase?: string;
  indexFile?: string;
  /** Desktop pane collapse button, retained when homepage search lives in main. */
  headerAction?: React.ReactNode;
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

/** A brand page shows its logo when the collection's policy allows it; every other page keeps the document icon. */
function NavIcon({ icon, policy }: { icon?: string; policy?: BrandLogoPolicy }) {
  const brand = brandById(icon, policy);
  return brand ? <BrandIcon brand={brand} className="h-4 w-4 text-base" /> : <FileText className="h-4 w-4 shrink-0" />;
}

export function DocsSidebar({ className, onNavigate, docsBase: legacyBase, indexFile: legacyIndex, collection: explicitCollection, showSearch = true, headerAction }: DocsSidebarProps) {
  const collection = resolveCollection({ collection: explicitCollection, docsBase: legacyBase, indexFile: legacyIndex });
  const { docsBase } = collection;
  const location = useLocation();
  const navigate = useNavigate();
  const { data: index, isPending: loading } = useDocsIndex(collection);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const isInternal = !!collection.statusFilter;
  const options = sidebarOptions(collection);
  // A folder is labelled by its README title, a page by its own title, unless the collection shows names.
  const folderLabel = (node: DocTreeNode, readme: DocTreeNode | null) => options.labels === 'names' ? node.name
    : readme?.title && readme.title !== 'README' ? readme.title : docLabel(node);
  const pageLabel = (node: DocTreeNode) => options.labels === 'names' ? node.title || node.name.replace(/\.md$/, '') : docLabel(node);
  const [hideCompleted, setHideCompleted] = useCompletedFilter(collection);

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
      const readmeFile = findReadmeInDir(node.children);
      const readmePath = readmeFile ? getDocPath(readmeFile.path) : null;
      
      // Filter out README from children if it exists (we'll use it as default)
      const childrenWithoutReadme = node.children?.filter(child => 
        !(child.type === 'file' && /^README\.md$/i.test(child.name))
      ) || [];

      // A directory whose only child is its own README is a PAGE, not a folder.
      // Expandability is decided on what is LEFT after the README is filtered out, not on the
      // raw child count - otherwise the chevron offers to expand a folder into nothing, which
      // is what docs/api-reference, features/dashboard and .../kubernetes/kustomize all did.
      const hasChildren = childrenWithoutReadme.length > 0;
      
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
      
      // Nothing to expand and a README to show: render it exactly as a page, so the sidebar
      // stops promising a level of navigation that does not exist.
      if (!hasChildren && readmePath) {
        const leafActive = location.pathname.replace(/\/$/, '') === readmePath;
        return (
          <Link
            key={node.path}
            to={readmePath}
            onClick={() => onNavigate?.()}
            className={cn(
              'flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors',
              'hover:bg-muted/50 text-muted-foreground dark:text-[#d7dfe9] hover:text-foreground',
              leafActive && 'docs-nav-tint text-foreground font-medium',
              level > 0 && 'pl-6'
            )}
            style={{ paddingLeft: `${0.75 + level * 1.5}rem` }}
            title={readmeFile?.description || undefined}
          >
            {isInternal && <StatusDot status={readmeFile?.status} />}
            {options.icons && <NavIcon icon={readmeFile?.icon ?? node.icon} policy={collection.brandLogos} />}
            <span className="truncate">{folderLabel(node, readmeFile)}</span>
          </Link>
        );
      }

      const chevron = (
        <div className="chevron-container shrink-0">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      );
      return (
        <div key={node.path}>
          <button
            onClick={handleFolderClick}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 rounded-md transition-colors',
              'text-muted-foreground dark:text-[#d7dfe9] hover:text-foreground',
              isReadmeActive && 'docs-nav-tint text-foreground font-medium',
              level > 0 && 'pl-6'
            )}
            style={{ paddingLeft: `${0.75 + level * 1.5}rem` }}
          >
            {/* With icons the chevron leads the row; a text-only sidebar puts it at the end, so folders
                and pages share one left edge. */}
            {hasChildren && options.icons && chevron}
            {options.icons && <div className="folder-icon-container shrink-0">
              {brandById(node.icon, collection.brandLogos) ? <NavIcon icon={node.icon} policy={collection.brandLogos} /> : isExpanded ? (
                <FolderOpen className="h-4 w-4" />
              ) : (
                <Folder className="h-4 w-4" />
              )}
            </div>}
            <span className="truncate text-left">{folderLabel(node, readmeFile)}</span>
            {hasChildren && !options.icons && <span className="ml-auto flex">{chevron}</span>}
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
            active && 'docs-nav-tint text-foreground font-medium',
            level > 0 && 'pl-6'
          )}
          style={{ paddingLeft: `${0.75 + level * 1.5}rem` }}
          title={node.description || undefined}
        >
          {isInternal && <StatusDot status={node.status} />}
          {options.icons && <NavIcon icon={node.icon} policy={collection.brandLogos} />}
          <span className="truncate">{pageLabel(node)}</span>
        </Link>
      );
    }
  };

  const renderSection = (node: DocTreeNode) => {
    const readme = findReadmeInDir(node.children);
    const readmePath = readme ? getDocPath(readme.path) : null;
    const active = !!readmePath && location.pathname.replace(/\/$/, '') === readmePath;
    const label = folderLabel(node, readme);
    const labelClass = cn('docs-nav-section block px-3 pb-1 pt-5 text-xs font-semibold uppercase tracking-[0.12em] text-foreground/80', active && 'text-foreground');
    return (
      <div key={node.path}>
        {readmePath
          ? <Link to={readmePath} onClick={() => onNavigate?.()} className={cn(labelClass, 'hover:text-foreground')} aria-current={active ? 'page' : undefined}>{label}</Link>
          : <p className={labelClass}>{label}</p>}
        <div className="space-y-1">
          {(node.children ?? []).filter(child => !(child.type === 'file' && /^README\.md$/i.test(child.name))).map(child => renderNode(child, 0))}
        </div>
      </div>
    );
  };

  const renderBody = () => {
    if (loading) {
      return (
        <div className="space-y-2">
          <div className="h-6 bg-muted/50 rounded-sm animate-pulse" />
          <div className="h-6 bg-muted/50 rounded-sm animate-pulse ml-4" />
          <div className="h-6 bg-muted/50 rounded-sm animate-pulse ml-4" />
        </div>
      );
    }

    if (!index || !index.tree.length) {
      return <p className="text-sm text-muted-foreground">No documentation available</p>;
    }

    return (
      <div className="space-y-1">
        {isInternal && (
          <label className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground cursor-pointer select-none mb-1">
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={(e) => {
                setHideCompleted(e.target.checked);
              }}
              className="rounded-sm border-border"
            />
            Hide completed
          </label>
        )}
        {filterTree(index.tree, isInternal && hideCompleted).map(node => options.sections && node.type === 'directory' ? renderSection(node) : renderNode(node))}
      </div>
    );
  };

  return (
    <nav className={cn('px-4 pb-4', !showSearch && !headerAction && 'pt-4', className)}>
      {/* Keep the pane action reachable even when search lives on the homepage. */}
      {(showSearch || headerAction) && <div className="sticky top-0 z-10 -mx-4 flex items-center gap-2 bg-background px-4 pb-3 pt-4">
        {headerAction}
        {showSearch && <div className="min-w-0 flex-1">
          <DocsSearch
            docsBase={docsBase}
            searchIndexFile={collection.searchIndexFile}
          />
        </div>}
      </div>}
      {renderBody()}
    </nav>
  );
}
