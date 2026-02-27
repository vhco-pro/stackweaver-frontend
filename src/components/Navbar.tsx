// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, Menu } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { OrganizationSelector } from '@/components/OrganizationSelector';
import { Link, useLocation } from 'react-router-dom';

interface NavbarProps {
  onMenuClick?: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const { session, logout } = useAuth();
  const location = useLocation();
  
  // Only show organization selector when in org-scoped routes
  const isOrgScopedRoute = location.pathname.startsWith('/app/');

  return (
    <nav className="h-16 border-b border-border/40 bg-white/10 dark:bg-black/10 backdrop-blur-sm">
      <div className="flex h-full items-center justify-between px-6">
        {/* Mobile Logo and Hamburger - only visible on mobile */}
        <div className="md:hidden flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-white/10 dark:hover:bg-black/10 transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img
              src="/logo.png"
              alt="Stackweaver"
              className="h-8 w-8"
            />
            <span className="text-xl font-bold bg-gradient-to-r from-blue-500 via-blue-600 to-purple-500 bg-clip-text text-transparent">
              Stackweaver
            </span>
              </Link>
            </div>
        {/* Right side items - pushed to the right, hidden on mobile (moved to sidebar) */}
        <div className="hidden md:flex items-center space-x-4 ml-auto">
            {isOrgScopedRoute && <OrganizationSelector />}
            {session?.user?.email && (
            <Link
              to="/settings/profile"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
                {session.user.email}
            </Link>
            )}
            <NotificationBell />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { void logout(); }}
            className="flex items-center space-x-2 transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-cyan-500/10 hover:shadow-md hover:shadow-blue-500/10"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
        </div>
      </div>
    </nav>
  );
}

