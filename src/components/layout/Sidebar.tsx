// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Building2,
  FolderOpen,
  FolderKanban,
  Package,
  BarChart3,
  Settings,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  Activity,
  Server,
  Play,
  FileText,
  Layers,
  Calendar,
  Blocks,
  Workflow,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserAvatar } from '@/components/UserAvatar';

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  children?: NavItem[];
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ isOpen = false, onClose, collapsed = false, onToggleCollapse }: SidebarProps) {
  const location = useLocation();
  const params = useParams();
  const { session, logout } = useAuth();
  const { currentOrg } = useOrganization();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['terraform', 'ansible', 'core']));
  
  // Determine if we're on a global route (dashboard, organizations, settings) or org-scoped route
  const isOrgScopedRoute = location.pathname.startsWith('/app/');
  const isDashboardRoute = location.pathname === '/dashboard';
  const isOrganizationsRoute = location.pathname === '/organizations';
  const isGlobalSettingsRoute = location.pathname === '/settings' || (location.pathname.startsWith('/settings/') && !location.pathname.startsWith('/app/'));
  const isActivitiesRoute = location.pathname === '/activities';

  // Close sidebar when a link is clicked on mobile
  const handleLinkClick = () => {
    if (onClose && window.innerWidth < 768) {
      onClose();
    }
  };


  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    if (path === '/activities') {
      return location.pathname === '/activities';
    }
    if (path === '/organizations') {
      return location.pathname === '/organizations';
    }
    if (path.includes('/workspaces')) {
      return location.pathname.includes('/app/') && location.pathname.includes('/workspaces');
    }
    // Check for org-scoped routes
    if (path.includes('/app/') && currentOrg) {
      const orgScopedPath = path.replace('/app/:orgName', `/app/${currentOrg.name}`);
      return location.pathname.startsWith(orgScopedPath);
    }
    return location.pathname.startsWith(path);
  };


  // Get current organization from URL or context
  const currentOrgName = params.orgName || currentOrg?.name;
  
  // Build contextual navigation sections based on route
  const getNavSections = (): NavSection[] => {
    if (isDashboardRoute || isOrganizationsRoute || isGlobalSettingsRoute || isActivitiesRoute) {
      // Global context: only show Dashboard, Activity Log, Settings
      return [
        {
          id: 'core',
          label: 'Core',
          items: [
            { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
            { label: 'Organizations', icon: Building2, path: '/organizations' },
            { label: 'Activity Log', icon: Activity, path: '/activities' },
            { label: 'Settings', icon: Settings, path: '/settings' },
          ],
        },
      ];
    } else if (isOrgScopedRoute && currentOrgName) {
      // Organization context: show org-scoped items organized by section
      return [
        {
          id: 'terraform',
          label: 'Terraform',
          items: [
            { label: 'Workspaces', icon: FolderOpen, path: `/app/${currentOrgName}/workspaces` },
            { label: 'Registry', icon: Package, path: `/app/${currentOrgName}/registry` },
          ],
        },
        {
          id: 'ansible',
          label: 'Ansible',
          items: [
            { label: 'Inventories', icon: Server, path: `/app/${currentOrgName}/ansible/inventories` },
            { label: 'Playbooks', icon: FileText, path: `/app/${currentOrgName}/ansible/playbooks` },
            { label: 'Job Templates', icon: Layers, path: `/app/${currentOrgName}/ansible/job-templates` },
            { label: 'Workflows', icon: Workflow, path: `/app/${currentOrgName}/ansible/workflows` },
            { label: 'Jobs', icon: Play, path: `/app/${currentOrgName}/ansible/jobs` },
            { label: 'Schedules', icon: Calendar, path: `/app/${currentOrgName}/ansible/schedules` },
            { label: 'Collections', icon: Blocks, path: `/app/${currentOrgName}/ansible/collections` },
          ],
        },
        {
          id: 'core',
          label: 'Core',
          items: [
            { label: 'Projects', icon: FolderKanban, path: `/app/${currentOrgName}/projects` },
            { label: 'Usage', icon: BarChart3, path: `/app/${currentOrgName}/usage` },
            { label: 'Settings', icon: Settings, path: `/app/${currentOrgName}/settings` },
          ],
        },
      ];
    } else {
      // Default: show all items (for backward compatibility)
      const workspacesPath = currentOrgName 
        ? `/app/${currentOrgName}/workspaces`
        : '/dashboard';
      
      return [
        {
          id: 'core',
          label: 'Core',
          items: [
            { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
            { label: 'Workspaces', icon: FolderOpen, path: workspacesPath },
            { label: 'Registry', icon: Package, path: '/registry' },
            { label: 'Usage', icon: BarChart3, path: '/usage' },
            { label: 'Settings', icon: Settings, path: '/settings' },
          ],
        },
      ];
    }
  };

  const navSections = getNavSections();

  const toggleSection = (id: string) => {
    const next = new Set(expandedSections);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedSections(next);
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen border-r border-border/40 bg-gradient-to-br from-background/95 via-background to-background/90 backdrop-blur-xl transition-all duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }       md:translate-x-0 md:static ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex h-full flex-col">
        {/* Logo/Header */}
        <div className={cn("h-16 border-b border-border/40 transition-all duration-300 flex items-center", collapsed ? "px-4" : "px-6")}>
          <Link
            to="/dashboard"
            onClick={handleLinkClick}
            className={cn("group flex items-center transition-all duration-300 hover:opacity-80", collapsed ? "justify-center" : "gap-3")}
          >
            <img
              src="/logo.png"
              alt="Stackweaver"
              className="h-8 w-8 transition-transform duration-300 group-hover:scale-110 shrink-0"
            />
            {!collapsed && (
              <span className="bg-gradient-to-r from-blue-500 via-blue-600 to-purple-500 bg-clip-text text-lg font-bold text-transparent whitespace-nowrap">
                {/* Previous implementation: from-blue-600 via-indigo-500 to-purple-500 */}
                Stackweaver
              </span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-4 overflow-y-auto p-4">
          {navSections.map((section) => (
            <div key={section.id} className="space-y-1">
              {!collapsed && (
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                >
                  <span>{section.label}</span>
                  {expandedSections.has(section.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              )}
              <div
                className={cn(
                  'overflow-hidden transition-[max-height,opacity] duration-300',
                  (collapsed || expandedSections.has(section.id)) ? 'max-h-[640px] opacity-100' : 'max-h-0 opacity-0'
                )}
              >
                {section.items.map((item, index) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  
                  return (
                    <Link
                      key={`${item.path}-${item.label}-${index}`}
                      to={item.path}
                      onClick={handleLinkClick}
                      className={cn(
                        // overflow-hidden keeps the active accent bar clipped inside the pill
                        'group relative flex items-center overflow-hidden rounded-xl text-sm font-medium transition-all duration-300',
                        collapsed ? 'justify-center px-2 py-2.5' : 'space-x-3 px-3 py-2.5',
                        // Previous implementation (blue-to-purple balanced)
                        // 'hover:bg-gradient-to-r hover:from-blue-600/10 hover:via-indigo-500/10 hover:to-purple-500/10',
                        // 'hover:shadow-md hover:shadow-blue-600/10 hover:scale-[1.02]',
                        // active
                        //   ? 'bg-gradient-to-r from-blue-600/15 via-indigo-500/15 to-purple-500/15 text-foreground shadow-lg shadow-blue-600/20 border border-blue-600/30'
                        //   : 'text-muted-foreground hover:text-foreground'
                        // New implementation (blue-dominant with purple accent)
                        'hover:bg-gradient-to-r hover:from-blue-500/10 hover:via-blue-600/10 hover:to-purple-500/10',
                        'hover:shadow-md hover:shadow-blue-500/10 hover:scale-[1.02]',
                        active
                          ? 'bg-gradient-to-r from-blue-500/15 via-blue-600/15 to-purple-500/15 text-foreground shadow-lg shadow-blue-500/20 border border-blue-500/30'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {/* Active accent bar */}
                      {active && (
                        <span className="absolute left-1 top-1.5 bottom-1.5 w-[3px] rounded-full bg-gradient-to-b from-blue-500 via-blue-600 to-purple-500" />
                      )}
                      <Icon className={cn('h-5 w-5 transition-transform duration-300 shrink-0', active && 'scale-110 text-blue-500 dark:text-blue-400')} />
                      {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Mobile User Controls - only visible on mobile/tablet */}
        <div className="md:hidden border-t border-border/40 p-4 space-y-3">
          {session?.user && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <UserAvatar
                picture={session.user.picture}
                name={session.user.name}
                email={session.user.email}
                size="sm"
              />
              {session.user.email}
            </div>
          )}
          <div className="flex items-center justify-between px-3">
            <span className="text-sm text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void logout();
              if (onClose) onClose();
            }}
            className="w-full flex items-center justify-start space-x-2 transition-all duration-300 hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-pink-500/10 hover:shadow-md hover:shadow-purple-500/10"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </Button>
        </div>

        {/* Desktop Collapse Button - at bottom of sidebar */}
        {onToggleCollapse && (
          <div className="hidden md:block border-t border-border/40 p-2">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-10 transition-all duration-300 hover:bg-accent/50 rounded-lg",
                collapsed ? "w-full justify-center" : "w-full flex justify-end pr-2"
              )}
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronRight className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              ) : (
                <ChevronLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              )}
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}

