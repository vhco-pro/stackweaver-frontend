// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from '../Navbar';
import { PageContainer, type PageWidth } from './PageContainer';

interface LayoutProps {
  children: ReactNode;
  /**
   * How much room the page is allowed to use. Declared per route in `App.tsx`
   * so the tier sits next to the page it governs. See `PageContainer`.
   */
  width?: PageWidth;
}

export function Layout({ children, width }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(() => {
    // Load from localStorage
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });

  const setSidebarCollapsed = (collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    localStorage.setItem('sidebarCollapsed', String(collapsed));
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-xs md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex flex-1 flex-col overflow-hidden relative">
        <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-background via-background/95 to-background/90">
          <PageContainer width={width}>
            {children}
          </PageContainer>
        </main>
      </div>
    </div>
  );
}

