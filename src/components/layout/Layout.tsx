// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, useEffect, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from '../Navbar';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Load from localStorage
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });

  useEffect(() => {
    // Save to localStorage when collapsed state changes
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

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
          <div className="w-full px-6 py-8 flex justify-center">
            <div className="w-full max-w-7xl">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

