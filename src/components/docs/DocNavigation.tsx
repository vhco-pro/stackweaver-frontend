// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useLocation, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DocTreeNode {
  type: 'directory' | 'file';
  name: string;
  path: string;
  title?: string;
  description?: string;
  children?: DocTreeNode[];
}

interface DocsIndex {
  tree: DocTreeNode[];
  flat: Record<string, DocTreeNode>;
  generated: string;
}

interface DocNavigationProps {
  index: DocsIndex | null;
}

// Flatten the tree to get all documents in order (depth-first)
function flattenDocsTree(nodes: DocTreeNode[]): Array<{ node: DocTreeNode; docPath: string }> {
  const result: Array<{ node: DocTreeNode; docPath: string }> = [];

  function traverse(nodes: DocTreeNode[], parentPath = '') {
    for (const node of nodes) {
      if (node.type === 'directory') {
        // Check if directory has README - add it first
        const readme = node.children?.find(child => 
          child.type === 'file' && /^README\.md$/i.test(child.name)
        );
        
        if (readme) {
          const docPath = parentPath ? `${parentPath}/${node.name}` : node.name;
          result.push({ node: readme, docPath });
        }
        
        // Then traverse children (excluding README)
        const childrenWithoutReadme = node.children?.filter(child =>
          !(child.type === 'file' && /^README\.md$/i.test(child.name))
        ) || [];
        
        const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
        traverse(childrenWithoutReadme, currentPath);
      } else {
        // Regular file - add it to result
        const docPath = parentPath ? `${parentPath}/${node.name.replace(/\.md$/, '')}` : node.name.replace(/\.md$/, '');
        result.push({ node, docPath });
      }
    }
  }

  traverse(nodes);
  return result;
}

// Get the route path for a document
function getDocRoutePath(docPath: string): string {
  if (!docPath || docPath === 'README') {
    return '/docs';
  }
  return `/docs/${docPath}`;
}

export function DocNavigation({ index }: DocNavigationProps) {
  const location = useLocation();

  if (!index) {
    return null;
  }

  // Flatten all documents
  const allDocs = flattenDocsTree(index.tree);

  // Find current document
  const currentPath = location.pathname.replace(/^\/docs\/?/, '').replace(/\/$/, '') || 'README';
  const currentIndex = allDocs.findIndex(doc => {
    const routePath = getDocRoutePath(doc.docPath);
    const normalizedCurrentPath = currentPath === 'README' ? '/docs' : `/docs/${currentPath}`;
    return routePath === normalizedCurrentPath;
  });

  if (currentIndex === -1) {
    return null;
  }

  const prevDoc = currentIndex > 0 ? allDocs[currentIndex - 1] : null;
  const nextDoc = currentIndex < allDocs.length - 1 ? allDocs[currentIndex + 1] : null;

  // Get label for a document
  const getDocLabel = (doc: { node: DocTreeNode; docPath: string }): string => {
    // If it's a README, use the folder name instead
    if (/^README\.md$/i.test(doc.node.name)) {
      const pathParts = doc.docPath.split('/');
      if (pathParts.length > 0) {
        const folderName = pathParts[pathParts.length - 1];
        // Format folder name: "ansible" -> "Ansible"
        return folderName
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
    }
    
    // Use title if available
    if (doc.node.title) {
      return doc.node.title;
    }
    
    // Format filename: "api-reference" -> "Api Reference"
    const name = doc.node.name.replace(/\.md$/, '');
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (!prevDoc && !nextDoc) {
    return null;
  }

  return (
    <div className="mt-12 pt-8 border-t border-border/40">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Previous */}
        {prevDoc ? (
          <Link
            to={getDocRoutePath(prevDoc.docPath)}
            onClick={() => window.scrollTo(0, 0)}
            className="group flex flex-col justify-between p-4 rounded-lg border border-border/40 bg-background/50 hover:bg-muted/50 hover:border-border transition-colors h-full"
          >
            <div className="text-base font-medium text-foreground group-hover:text-primary transition-colors">
              {getDocLabel(prevDoc)}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-auto pt-4">
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </div>
          </Link>
        ) : (
          <div /> // Empty div to maintain grid layout
        )}

        {/* Next */}
        {nextDoc ? (
          <Link
            to={getDocRoutePath(nextDoc.docPath)}
            onClick={() => window.scrollTo(0, 0)}
            className="group flex flex-col justify-between p-4 rounded-lg border border-border/40 bg-background/50 hover:bg-muted/50 hover:border-border transition-colors h-full text-right"
          >
            <div className="text-base font-medium text-foreground group-hover:text-primary transition-colors">
              {getDocLabel(nextDoc)}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-auto pt-4 justify-end">
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
