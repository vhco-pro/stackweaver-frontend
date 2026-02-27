// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { type ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PublicNav } from '@/components/navigation/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { DocsSidebar } from './DocsSidebar';
import { TableOfContents } from './TableOfContents';
import { DocNavigation } from './DocNavigation';

interface DocsLayoutProps {
  children: ReactNode;
}

interface DocsIndex {
  tree: DocTreeNode[];
  flat: Record<string, DocTreeNode>;
  generated: string;
}

interface DocTreeNode {
  type: 'directory' | 'file';
  name: string;
  path: string;
  title?: string;
  description?: string;
  children?: DocTreeNode[];
}

export function DocsLayout({ children }: DocsLayoutProps) {
  const location = useLocation();
  const [index, setIndex] = useState<DocsIndex | null>(null);

  // Load docs index for breadcrumb titles
  useEffect(() => {
    async function loadIndex() {
      try {
        const response = await fetch('/docs-index.json');
        if (!response.ok) throw new Error('Failed to load docs index');
        const data = await response.json() as DocsIndex;
        setIndex(data);
      } catch (error) {
        console.error('Failed to load docs index:', error);
      }
    }

    void loadIndex();
  }, []);

  // Scroll to top when navigating to a new doc (in-content links, sidebar, breadcrumbs, prev/next).
  // Defer with rAF so it runs after React's commit; scroll the main content into view so the doc
  // (below the fixed nav) is at the top of the viewport.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const main = document.querySelector('main');
      if (main) {
        main.scrollIntoView({ block: 'start', behavior: 'auto' });
      } else {
        window.scrollTo(0, 0);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [location.pathname]);

  // Build breadcrumbs from current path - only for subfolders (nested paths)
  const getBreadcrumbs = () => {
    // Get the path after /docs/
    const pathname = location.pathname;
    
    // If we're exactly on /docs or /docs/, don't show breadcrumbs
    if (pathname === '/docs' || pathname === '/docs/') {
      return null;
    }
    
    // Get path segments after /docs/
    const path = pathname.replace('/docs/', '').replace('/docs', '').replace(/\/$/, '');
    const parts = path.split('/').filter(Boolean);
    
    // Only show breadcrumbs if we're in a subfolder (have at least 2 path segments)
    // Single segment paths like "test-syntax-highlighting" are root-level, so no breadcrumbs
    if (parts.length < 2) {
      return null;
    }

    const breadcrumbs: Array<{ path: string; label: string }> = [];

    // Build breadcrumbs for each path segment (excluding "Docs" prefix)
    // Use folder names from path, not README titles
    let currentPath = '';
    for (let i = 0; i < parts.length; i++) {
      currentPath = parts.slice(0, i + 1).join('/');
      
      // Check if this is a directory (has README) or a file
      const readmeNode = index?.flat[`${currentPath}/README.md`];
      const fileNode = index?.flat[`${currentPath}.md`];
      const isDirectory = !!readmeNode;
      const isFile = !!fileNode && !isDirectory;
      
      // For directories, always use the folder name (don't use README title)
      // For files, use the title if available, otherwise format the filename
      let label = parts[i];
      if (isFile && fileNode?.title) {
        // Use file title only for actual files (not directories with READMEs)
        label = fileNode.title;
      } else {
        // Format folder/file name: "platform-features" -> "Platform Features"
        label = label
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
      
      const breadcrumbPath = `/docs/${currentPath}`;
      breadcrumbs.push({ path: breadcrumbPath, label });
    }

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="min-h-screen bg-background">
      {/* Public Navigation */}
      <PublicNav activeLink="docs" />
      
      {/* Main Content Area - Three Column Layout */}
      <div className="pt-32 pb-8 flex">
        {/* Left Sidebar - Docs Navigation Tree */}
        <aside className="hidden lg:block w-64 flex-shrink-0 border-r border-border/40 bg-background/50 sticky top-24 h-[calc(100vh-6rem)] overflow-y-auto">
          <DocsSidebar />
        </aside>
        
        {/* Center - Main Content */}
        <main className="flex-1 min-w-0 px-8 py-4 max-w-4xl mx-auto">
          {/* Breadcrumb Navigation - Only show in subfolders */}
          {breadcrumbs && (
            <div className="mb-6 pb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {breadcrumbs.map((crumb, index) => {
                  const isLast = index === breadcrumbs.length - 1;
                  return (
                    <div key={crumb.path} className="flex items-center gap-2">
                      {index > 0 && <span className="text-muted-foreground/60">&gt;</span>}
                      {isLast ? (
                        <span className="text-foreground font-medium">{crumb.label}</span>
                      ) : (
                        <Link
                          to={crumb.path}
                          className="hover:text-foreground transition-colors"
                        >
                          {crumb.label}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          <div className="markdown-content">
            {children}
          </div>
          
          {/* Previous/Next Navigation */}
          <DocNavigation index={index} />
        </main>
        
        {/* Right Sidebar - Table of Contents */}
        <aside className="hidden xl:block w-64 flex-shrink-0 border-l border-border/40 bg-background/50 sticky top-24 h-[calc(100vh-6rem)] overflow-y-auto">
          <TableOfContents />
        </aside>
      </div>
      
      <Footer />
      
      {/* Mobile Sidebar Toggle - TODO: Add mobile navigation */}
    </div>
  );
}
