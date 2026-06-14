// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { type ReactNode, useState, useEffect, useLayoutEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicNav } from '@/components/navigation/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { DocsSidebar } from './DocsSidebar';
import { TableOfContents } from './TableOfContents';
import { DocNavigation } from './DocNavigation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface DocsLayoutProps {
  children: ReactNode;
  docsBase?: string;
  indexFile?: string;
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

export function DocsLayout({ children, docsBase = '/docs', indexFile = '/docs-index.json' }: DocsLayoutProps) {
  const location = useLocation();
  const [index, setIndex] = useState<DocsIndex | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  // Load docs index for breadcrumb titles
  useEffect(() => {
    async function loadIndex() {
      try {
        const response = await fetch(indexFile);
        if (!response.ok) throw new Error('Failed to load docs index');
        const data = await response.json() as DocsIndex;
        setIndex(data);
      } catch (error) {
        console.error('Failed to load docs index:', error);
      }
    }

    void loadIndex();
  }, [indexFile]);

  // Scroll to top when navigating to a new doc (sidebar, breadcrumbs, prev/next, in-content links).
  // useLayoutEffect runs synchronously before paint to avoid scroll flicker.
  // location.key changes on every navigation, even to the same URL.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.key]);

  // Close mobile drawers on navigation. Done as a during-render reset keyed on the
  // previous location (React's blessed pattern) rather than in an effect.
  const [prevLocationKey, setPrevLocationKey] = useState(location.key);
  if (location.key !== prevLocationKey) {
    setPrevLocationKey(location.key);
    setMobileSidebarOpen(false);
    setMobileTocOpen(false);
  }

  // Build breadcrumbs from current path - only for subfolders (nested paths)
  const getBreadcrumbs = () => {
    // Get the path after /docs/
    const pathname = location.pathname;
    
    // If we're exactly on the docs base, don't show breadcrumbs
    if (pathname === docsBase || pathname === `${docsBase}/`) {
      return null;
    }

    // Get path segments after the base
    const path = pathname.replace(new RegExp(`^${docsBase}/?`), '').replace(/\/$/, '');
    const parts = path.split('/').filter(Boolean);
    
    // Only show breadcrumbs if we're in a subfolder (have at least 2 path segments)
    // Single segment paths like "test-syntax-highlighting" are root-level, so no breadcrumbs
    if (parts.length < 2) {
      return null;
    }

    const breadcrumbs: Array<{ path: string; label: string }> = [];

    // Build breadcrumbs for each path segment (excluding "Docs" prefix)
    // Use folder names from path, not README titles
    for (let i = 0; i < parts.length; i++) {
      const currentPath = parts.slice(0, i + 1).join('/');

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
      
      const breadcrumbPath = `${docsBase}/${currentPath}`;
      breadcrumbs.push({ path: breadcrumbPath, label });
    }

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="min-h-screen bg-background">
      {/* Public Navigation */}
      <PublicNav activeLink="docs" />
      
      {/* Mobile Navigation Bar - visible below lg breakpoint */}
      <div className="lg:hidden fixed top-[6.5rem] left-0 right-0 z-30 bg-background/95 backdrop-blur-xs border-b border-border/40 px-4 py-2 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMobileSidebarOpen(true)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <Menu className="h-4 w-4" />
          <span className="text-sm">Navigation</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMobileTocOpen(true)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <List className="h-4 w-4" />
          <span className="text-sm">On this page</span>
        </Button>
      </div>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-[280px] p-0 bg-background">
          <SheetHeader className="px-4 pt-6 pb-2">
            <SheetTitle className="text-sm font-semibold">Documentation</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto h-[calc(100vh-4rem)]">
            <DocsSidebar docsBase={docsBase} indexFile={indexFile} onNavigate={() => setMobileSidebarOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile Table of Contents Sheet */}
      <Sheet open={mobileTocOpen} onOpenChange={setMobileTocOpen}>
        <SheetContent side="right" className="w-[280px] p-0 bg-background">
          <SheetHeader className="px-4 pt-6 pb-2">
            <SheetTitle className="text-sm font-semibold">On this page</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto h-[calc(100vh-4rem)]">
            <TableOfContents key={location.pathname} />
          </div>
        </SheetContent>
      </Sheet>
      
      {/* Main Content Area - Three Column Layout */}
      <div className="pt-32 pb-8 flex">
        
        {/* Left Sidebar - Docs Navigation Tree (desktop only) */}
        <aside className="hidden lg:block w-[18%] min-w-56 max-w-72 shrink-0 border-r border-border/40 bg-background/50 sticky top-24 h-[calc(100vh-6rem)] overflow-y-auto">
          <DocsSidebar docsBase={docsBase} indexFile={indexFile} />
        </aside>
        
        {/* Center - Main Content */}
        <main className="flex-1 min-w-0 px-4 md:px-8 py-4 pt-12 lg:pt-4 max-w-4xl mx-auto">
          {/* Breadcrumb Navigation - Only show in subfolders */}
          {breadcrumbs && (
            <div className="mb-6 pb-4 overflow-x-auto">
              <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
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
          <DocNavigation index={index} docsBase={docsBase} />
        </main>
        
        {/* Right Sidebar - Table of Contents (desktop only) */}
        <aside className="hidden xl:block w-64 shrink-0 border-l border-border/40 bg-background/50 sticky top-24 h-[calc(100vh-6rem)] overflow-y-auto">
          <TableOfContents />
        </aside>
      </div>
      
      <Footer />
    </div>
  );
}
