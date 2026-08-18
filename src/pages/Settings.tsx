// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { User, Bell, Shield, Key, Globe, ArrowRight, GitBranch, Layers, Monitor, KeyRound, KeySquare, Webhook, Users, Cpu, Server, FileText, Tag, Cloud, ClipboardList, Zap, type LucideIcon } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface SettingsSection {
  title: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  path: string;
}

// Global/user-scoped settings (shown on /settings)
const userSettingsSections: SettingsSection[] = [
  {
    title: 'Profile',
    description: 'Manage your personal information and preferences',
    icon: User,
    gradient: 'from-violet-500 to-indigo-500',
    path: '/settings/profile',
  },
  {
    title: 'Notifications',
    description: 'Configure email and in-app notification preferences',
    icon: Bell,
    gradient: 'from-indigo-500 to-blue-500',
    path: '/settings/notifications',
  },
  {
    title: 'Security',
    description: 'Manage authentication and security settings',
    icon: Shield,
    gradient: 'from-blue-500 to-cyan-500',
    path: '/settings/security',
  },
  {
    title: 'Active Sessions',
    description: 'View and manage your active sessions and devices',
    icon: Monitor,
    gradient: 'from-cyan-500 to-blue-500',
    path: '/settings/sessions',
  },
  {
    title: 'API Tokens',
    description: 'Create personal access tokens for the CLI and terraform login',
    icon: Key,
    gradient: 'from-purple-500 to-fuchsia-500',
    path: '/settings/tokens',
  },
  {
    title: 'Preferences',
    description: 'Customize your workspace and display preferences',
    icon: Globe,
    gradient: 'from-indigo-500 to-violet-500',
    path: '/settings/preferences',
  },
];

// Organization-scoped settings (shown on /app/:orgName/settings)
const orgSettingsSections: SettingsSection[] = [
  {
    title: 'Users & Teams',
    description: 'Manage organization members and teams',
    icon: Users,
    gradient: 'from-green-500 to-emerald-500',
    path: '/app/:orgName/settings/users', // Will be replaced with actual orgName
  },
  {
    title: 'VCS Connections',
    description: 'Manage version control provider connections',
    icon: GitBranch,
    gradient: 'from-blue-500 to-indigo-500',
    path: '/app/:orgName/settings/vcs-connections', // Will be replaced with actual orgName
  },
  {
    title: 'OIDC Configurations',
    description: 'Manage keyless authentication to cloud providers via OIDC workload identity',
    icon: Cloud,
    gradient: 'from-sky-500 to-blue-500',
    path: '/app/:orgName/settings/oidc', // Will be replaced with actual orgName
  },
  {
    title: 'Webhooks',
    description: 'Configure webhook endpoints for automatic syncing',
    icon: Webhook,
    gradient: 'from-purple-500 to-indigo-500',
    path: '/app/:orgName/settings/webhooks', // Will be replaced with actual orgName
  },
  {
    title: 'Variables',
    description: 'Manage organization-wide, project-scoped, and workspace-scoped variables',
    icon: Layers,
    gradient: 'from-purple-500 to-pink-500',
    path: '/app/:orgName/settings/variable-sets', // Will be replaced with actual orgName
  },
  {
    title: 'Credentials',
    description: 'Manage Ansible credentials for SSH, vault, and cloud providers',
    icon: KeyRound,
    gradient: 'from-amber-500 to-orange-500',
    path: '/app/:orgName/settings/credentials', // Will be replaced with actual orgName
  },
  {
    title: 'API Keys',
    description: 'Create and manage API keys for programmatic access',
    icon: Key,
    gradient: 'from-blue-500 to-indigo-500',
    path: '/app/:orgName/settings/api-keys', // Will be replaced with actual orgName
  },
  {
    title: 'Organization Token',
    description: 'A single org-admin API token for CI and automation (tfe_organization_token)',
    icon: KeySquare,
    gradient: 'from-cyan-500 to-blue-500',
    path: '/app/:orgName/settings/authentication-token', // Will be replaced with actual orgName
  },
  {
    title: 'OpenTofu Versions',
    description: 'Manage available OpenTofu versions for workspace runs',
    icon: Tag,
    gradient: 'from-purple-500 to-violet-500',
    path: '/app/:orgName/settings/terraform-versions',
  },
  {
    title: 'Agent Pools',
    description: 'Manage agent pools for self-hosted runners (TFE-compatible)',
    icon: Cpu,
    gradient: 'from-teal-500 to-cyan-500',
    path: '/app/:orgName/settings/agent-pools',
  },
  {
    title: 'Runners',
    description: 'View and manage self-hosted runners for OpenTofu and Ansible',
    icon: Server,
    gradient: 'from-purple-500 to-pink-500',
    path: '/app/:orgName/settings/runners',
  },
  {
    title: 'Change Requests',
    description: 'Triage open action items filed against workspaces in this organization',
    icon: ClipboardList,
    gradient: 'from-rose-500 to-orange-500',
    path: '/app/:orgName/settings/change-requests',
  },
  {
    title: 'Run Tasks',
    description: 'External services that validate runs at stage boundaries',
    icon: Zap,
    gradient: 'from-amber-500 to-orange-500',
    path: '/app/:orgName/settings/run-tasks',
  },
  {
    title: 'Ansible Configuration',
    description: 'Manage ansible.cfg settings for organization and projects',
    icon: FileText,
    gradient: 'from-orange-500 to-amber-500',
    path: '/app/:orgName/settings/ansible-config',
  },
];

export default function Settings() {
  const { orgName } = useParams<{ orgName?: string }>();
  const { session } = useAuth();

  // Determine if we're in org context or global context
  const isOrgSettings = !!orgName;

  // Change requests gate on org:manage-workspaces, matching the backend. Read from the effective
  // permissions hook rather than adding another 403 probe like the queries below: the hook already
  // fetches the whole permission map in one call, and the probes predate it.
  const { canManageWorkspaces } = usePermissions(orgName);

  // Check permissions via React Query
  const { data: hasManageMembershipAccess = null } = useQuery<boolean | null>({
    queryKey: ['perm-membership', orgName, session?.user?.email],
    queryFn: async () => {
      try {
        const { organizationMembershipsApi } = await import('@/api/client');
        await organizationMembershipsApi.list(orgName!);
        return true;
      } catch (err: unknown) {
        const s = (err as Error & { status?: number })?.status;
        return s === 403 ? false : null;
      }
    },
    enabled: isOrgSettings && !!orgName && !!session?.user?.email,
    retry: false,
  });

  const { data: hasAdminAccess = null } = useQuery<boolean | null>({
    queryKey: ['perm-admin', orgName, session?.user?.email],
    queryFn: async () => {
      try {
        const { adminTerraformVersionsApi } = await import('@/api/client');
        await adminTerraformVersionsApi.list({ pageSize: 1 });
        return true;
      } catch {
        return false;
      }
    },
    enabled: isOrgSettings && !!orgName && !!session?.user?.email,
    retry: false,
  });

  const { data: hasManageAgentPoolsAccess = null } = useQuery<boolean | null>({
    queryKey: ['perm-agent-pools', orgName, session?.user?.email],
    queryFn: async () => {
      try {
        const { agentPoolsApi } = await import('@/api/client');
        await agentPoolsApi.list(orgName!);
        return true;
      } catch (err: unknown) {
        const s = (err as Error & { status?: number })?.status;
        return s === 403 ? false : null;
      }
    },
    enabled: isOrgSettings && !!orgName && !!session?.user?.email,
    retry: false,
  });

  // Get the appropriate settings sections, filtering by permissions
  const settingsSections: SettingsSection[] = isOrgSettings
    ? orgSettingsSections
        .filter((section: SettingsSection) => {
          if (section.title === 'Users & Teams') return hasManageMembershipAccess !== false;
          if (section.title === 'OpenTofu Versions') return hasAdminAccess !== false;
          if (section.title === 'Agent Pools') return hasManageAgentPoolsAccess !== false;
          if (section.title === 'Runners') return hasManageAgentPoolsAccess !== false;
          if (section.title === 'Change Requests') return canManageWorkspaces;
          if (section.title === 'Run Tasks') return canManageWorkspaces;
          return true;
        })
        .map((section: SettingsSection) => ({
          ...section,
          path: section.path.replace(':orgName', orgName || ''),
        }))
    : userSettingsSections;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-violet-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent mb-2">
          Settings
        </h1>
        <p className="text-muted-foreground">
          {isOrgSettings 
            ? 'Manage organization settings and configuration'
            : 'Manage your account settings and preferences'}
        </p>
      </div>

      {/* Settings Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-6">
        {settingsSections.map((section: SettingsSection) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.title}
              to={section.path}
              className={cn(
                'group relative overflow-hidden rounded-2xl text-left',
                'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
                'dark:from-black/10 dark:via-black/5',
                'backdrop-blur-md border border-white/20 dark:border-white/10',
                'p-6 shadow-lg shadow-purple-500/10',
                'transition-all duration-300',
                'hover:shadow-xl hover:shadow-purple-500/20 hover:scale-[1.02]',
                'hover:border-purple-500/30',
                'focus:outline-hidden focus:ring-2 focus:ring-purple-500/50'
              )}
            >
              <div className={cn(
                'flex h-12 w-12 items-center justify-center rounded-xl mb-4',
                `bg-gradient-to-br ${section.gradient}`,
                'shadow-lg group-hover:scale-110 transition-transform duration-300'
              )}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors duration-200">
                {section.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {section.description}
              </p>
              <div className="mt-4 flex items-center text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <span>Configure</span>
                <ArrowRight className="ml-2 h-3 w-3" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

