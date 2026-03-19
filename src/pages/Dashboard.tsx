// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useMountEffect } from '@/hooks/useMountEffect';
import { Link } from 'react-router-dom';
import { 
  FolderKanban, 
  Layers, 
  PlayCircle, 
  CheckCircle2,
  ArrowRight,
  Activity,
  Zap,
  Loader2,
  Building2,
  BookOpen,
  FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dashboardApi, activitiesApi, type Activity as ActivityData, type DashboardStats } from '@/api/client';
import { useActivityNotifications } from '@/hooks/useActivityNotifications';
import { useOrganization } from '@/contexts/OrganizationContext';

interface OrganizationStats {
  id: string;
  name: string;
  description?: string;
  projects: number;
  terraform_workspaces: number;
  ansible_playbooks: number;
  active_terraform_runs: number;
  active_ansible_jobs: number;
  completed_terraform_runs_this_month: number;
  completed_ansible_jobs_this_month: number;
}

interface RecentActivity {
  id: string;
  description: string;
  timestamp: string;
  type?: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [organizationStats, setOrganizationStats] = useState<OrganizationStats[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentOrg } = useOrganization();

  // Enable activity notifications
  useActivityNotifications(true, 30000); // Poll every 30 seconds

  useMountEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Fetch dashboard stats from single endpoint
        const statsRes = await dashboardApi.getStats();
        const dashboardStats = statsRes.data;
        
        setStats(dashboardStats);

        // Transform organization stats from API response
        type OrgStatsFromApi = DashboardStats['organizations'][0];
        const orgStatsArray: OrganizationStats[] = (dashboardStats.organizations || []).map((org: OrgStatsFromApi) => ({
          id: org.id,
          name: org.name,
          description: org.description,
          projects: org.projects,
          terraform_workspaces: org.terraform_workspaces,
          ansible_playbooks: org.ansible_playbooks,
          active_terraform_runs: org.active_terraform_runs,
          active_ansible_jobs: org.active_ansible_jobs,
          completed_terraform_runs_this_month: org.completed_terraform_runs_this_month,
          completed_ansible_jobs_this_month: org.completed_ansible_jobs_this_month,
        }));

        setOrganizationStats(orgStatsArray);

        // Fetch recent activities from the API
        try {
          const activitiesRes = await activitiesApi.getRecent({ limit: 5 });
          const activities = activitiesRes.data || [];
          
            const activityItems: RecentActivity[] = activities.map((activity: ActivityData) => {
            const attrs = activity.attributes;
            const details = attrs.details || {};
            const resourceNameRaw = details.resource_name || attrs.resource_type;
            
            // Format activity description based on action and resource type
            let description = '';
            let resourceNameStr = '';
            if (resourceNameRaw != null) {
              const resourceType = typeof resourceNameRaw;
              if (resourceType === 'object') {
                resourceNameStr = JSON.stringify(resourceNameRaw);
              } else {
                // resourceType is string, number, boolean, or other primitive - safe to stringify
                // eslint-disable-next-line @typescript-eslint/no-base-to-string
                resourceNameStr = String(resourceNameRaw);
              }
            }
            switch (attrs.action) {
              case 'create':
                description = `Created ${String(attrs.resource_type)}${resourceNameStr ? ` "${resourceNameStr}"` : ''}`;
                break;
              case 'update':
                description = `Updated ${String(attrs.resource_type)}${resourceNameStr ? ` "${resourceNameStr}"` : ''}`;
                break;
              case 'delete':
                description = `Deleted ${String(attrs.resource_type)}${resourceNameStr ? ` "${resourceNameStr}"` : ''}`;
                break;
              case 'run_plan':
              case 'run_apply':
              case 'run_destroy': {
                const operationRaw = details.operation || attrs.action;
                // eslint-disable-next-line @typescript-eslint/no-base-to-string
                const operationStr = typeof operationRaw === 'string' ? operationRaw : String(operationRaw);
                // eslint-disable-next-line @typescript-eslint/no-base-to-string
                const statusStr = typeof details.status === 'string' ? details.status : String(details.status || 'started');
                description = `${operationStr} run ${statusStr}${details.workspace_id ? ` for workspace` : ''}`;
                break;
              }
              default:
                description = `${String(attrs.action)} ${String(attrs.resource_type)}${resourceNameStr ? ` "${resourceNameStr}"` : ''}`;
            }
            
            return {
              id: activity.id,
              description,
              timestamp: new Date(attrs.created_at).toLocaleString(),
              type: attrs.resource_type,
            };
          });
          
          setRecentActivity(activityItems);
        } catch (err: unknown) {
          // Silently handle 404 (endpoint might not exist yet) or 401 (not authenticated)
          // Only log other errors
          if (err && typeof err === 'object' && 'status' in err) {
            const status = (err as { status: number }).status;
            if (status !== 404 && status !== 401) {
              console.error('Failed to load activities:', err);
            }
          } else {
            console.error('Failed to load activities:', err);
          }
          // Fallback to empty array if activities fail
          setRecentActivity([]);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchDashboardData();
  });

  // Quick actions - always show all options
  const orgName = currentOrg?.name || organizationStats[0]?.name || '';
  const quickActions = [
    {
      title: 'Organizations',
      description: 'Create and manage organizations',
      icon: Building2,
      link: '/organizations',
      color: 'from-blue-500 to-indigo-500',
    },
    {
      title: 'Workspaces',
      description: 'Manage Terraform workspaces',
      icon: FolderOpen,
      link: orgName ? `/app/${orgName}/workspaces` : '/organizations',
      color: 'from-indigo-500 to-purple-500',
    },
    {
      title: 'Job Templates',
      description: 'Manage Ansible job templates',
      icon: Layers,
      link: orgName ? `/app/${orgName}/ansible/job-templates` : '/organizations',
      color: 'from-purple-500 to-pink-500',
    },
    {
      title: 'Settings',
      description: 'Manage your account settings',
      icon: Activity,
      link: '/settings',
      color: 'from-pink-500 to-rose-500',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
            Welcome back
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Manage your infrastructure with confidence
          </p>
        </div>
        <Link to="/organizations">
          <Button variant="outline" className="flex items-center gap-2 border-gray-300 dark:border-white/20 hover:border-purple-400 dark:hover:border-purple-400">
            <Activity className="h-4 w-4 text-purple-500 dark:text-purple-400" />
            Organizations
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="p-6 rounded-xl bg-white/5 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-white/20 transition-all shadow-sm dark:shadow-purple-500/10 hover:shadow-md dark:hover:shadow-purple-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500 to-violet-500">
              <FolderKanban className="h-6 w-6 text-white" />
            </div>
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            ) : (
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.projects || 0}</span>
            )}
          </div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Projects</h3>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Active infrastructure projects</p>
        </div>

        <div className="p-6 rounded-xl bg-white/5 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 hover:border-violet-300 dark:hover:border-white/20 transition-all shadow-sm dark:shadow-purple-500/10 hover:shadow-md dark:hover:shadow-purple-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500">
              <Layers className="h-6 w-6 text-white" />
            </div>
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            ) : (
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.terraform_workspaces || 0}</span>
            )}
          </div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Terraform Workspaces</h3>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Terraform workspaces</p>
        </div>

        <div className="p-6 rounded-xl bg-white/5 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 hover:border-green-300 dark:hover:border-white/20 transition-all shadow-sm dark:shadow-green-500/10 hover:shadow-md dark:hover:shadow-green-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            ) : (
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.ansible_playbooks || 0}</span>
            )}
          </div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Ansible Playbooks</h3>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Ansible playbooks</p>
        </div>

        <div className="p-6 rounded-xl bg-white/5 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-white/20 transition-all shadow-sm dark:shadow-purple-500/10 hover:shadow-md dark:hover:shadow-purple-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-500">
              <PlayCircle className="h-6 w-6 text-white" />
            </div>
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            ) : (
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{(stats?.active_terraform_runs || 0) + (stats?.active_ansible_jobs || 0)}</span>
            )}
          </div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Active Operations</h3>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {stats ? (
              <>
                {stats.active_terraform_runs || 0} Terraform + {stats.active_ansible_jobs || 0} Ansible
              </>
            ) : (
              'Terraform runs + Ansible jobs'
            )}
          </p>
        </div>

        <div className="p-6 rounded-xl bg-white/5 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-white/20 transition-all shadow-sm dark:shadow-purple-500/10 hover:shadow-md dark:hover:shadow-purple-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
              <CheckCircle2 className="h-6 w-6 text-white" />
            </div>
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            ) : (
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{(stats?.completed_terraform_runs_this_month || 0) + (stats?.completed_ansible_jobs_this_month || 0)}</span>
            )}
          </div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Completed</h3>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {stats ? (
              <>
                {stats.completed_terraform_runs_this_month || 0} Terraform + {stats.completed_ansible_jobs_this_month || 0} Ansible
              </>
            ) : (
              'Successful operations this month'
            )}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
          <Link
                key={action.title}
                to={action.link}
                className="group p-6 rounded-xl bg-white/5 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-white/20 hover:bg-white/10 dark:hover:bg-white/10 transition-all shadow-sm dark:shadow-none hover:shadow-md"
          >
                <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${action.color} mb-4`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">
                  {action.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{action.description}</p>
                <div className="mt-4 flex items-center text-purple-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Get started <ArrowRight className="ml-2 h-4 w-4" />
                </div>
          </Link>
            );
          })}
        </div>
      </div>

      {/* Organizations and Recent Activity - Dynamic Layout */}
      {(() => {
        const hasOrganization = (stats?.organizations?.length || 0) > 0;
        const hasProject = (stats?.projects || 0) > 0;
        const hasWorkspace = (stats?.terraform_workspaces || 0) > 0;
        const hasAnsiblePlaybook = (stats?.ansible_playbooks || 0) > 0;
        const showGettingStarted = !(hasOrganization && hasProject && hasWorkspace && hasAnsiblePlaybook);

        // If Getting Started is hidden, show Organizations and Recent Activity side-by-side
        if (!showGettingStarted) {
          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Organizations */}
              {organizationStats.length > 0 && (
                <div>
                  <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">Organizations</h2>
                  <div className="grid grid-cols-1 gap-6">
                    {organizationStats.map((org) => (
                      <Link
                        key={org.id}
                        to={`/app/${org.name}/workspaces`}
                        className="group p-6 rounded-xl bg-white/5 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-white/20 hover:bg-white/10 dark:hover:bg-white/10 transition-all shadow-sm dark:shadow-none hover:shadow-md"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 group-hover:from-blue-500/30 group-hover:to-indigo-500/30 transition-all duration-300">
                              <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg group-hover:text-primary transition-colors duration-200">
                                {org.name}
                              </h3>
                            </div>
                          </div>
                        </div>

                        {org.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                            {org.description}
                          </p>
                        )}

                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{org.projects}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-500">Projects</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{org.terraform_workspaces}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-500">Terraform Workspaces</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{org.ansible_playbooks}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-500">Ansible Playbooks</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{org.active_terraform_runs + org.active_ansible_jobs}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-500">Active Operations</div>
                          </div>
                        </div>
                        <div className="mb-4 pt-2 border-t border-gray-200 dark:border-white/10">
                          <div className="text-2xl font-bold text-gray-900 dark:text-white">{org.completed_terraform_runs_this_month + org.completed_ansible_jobs_this_month}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-500">Completed This Month</div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-purple-600 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span>View Dashboard</span>
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
                  <Link to="/activities" className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300">
                    View all
                  </Link>
                </div>
                <div className="p-6 rounded-xl bg-white/5 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-sm dark:shadow-none">
                  {recentActivity.length === 0 ? (
                    <div className="text-center py-12">
                      <Activity className="h-12 w-12 text-purple-400/30 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-400 mb-2">No recent activity</p>
                      <p className="text-sm text-gray-500 dark:text-gray-500">
                        Start by creating a project or running a workspace
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {recentActivity.map((activity) => (
                        <div key={activity.id} className="flex items-start gap-4 p-4 rounded-lg bg-white/10 dark:bg-white/5 hover:bg-white/20 dark:hover:bg-white/10 transition-colors border border-gray-200 dark:border-transparent">
                          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-violet-500">
                            <Zap className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-gray-900 dark:text-white">{activity.description}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{activity.timestamp}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }

        // If Getting Started is shown, use the original layout
        return (
          <>
            {/* Organization Cards */}
            {organizationStats.length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">Organizations</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {organizationStats.map((org) => (
                    <Link
                      key={org.id}
                      to={`/app/${org.name}/workspaces`}
                      className="group p-6 rounded-xl bg-white/5 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-white/20 hover:bg-white/10 dark:hover:bg-white/10 transition-all shadow-sm dark:shadow-none hover:shadow-md"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 group-hover:from-blue-500/30 group-hover:to-indigo-500/30 transition-all duration-300">
                            <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg group-hover:text-primary transition-colors duration-200">
                              {org.name}
                            </h3>
                          </div>
                        </div>
                      </div>

                      {org.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                          {org.description}
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div>
                          <div className="text-2xl font-bold text-gray-900 dark:text-white">{org.projects}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-500">Projects</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-gray-900 dark:text-white">{org.terraform_workspaces}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-500">Terraform Workspaces</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-gray-900 dark:text-white">{org.ansible_playbooks}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-500">Ansible Playbooks</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-gray-900 dark:text-white">{org.active_terraform_runs + org.active_ansible_jobs}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-500">Active Operations</div>
                        </div>
                      </div>
                      <div className="mb-4 pt-2 border-t border-gray-200 dark:border-white/10">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{org.completed_terraform_runs_this_month + org.completed_ansible_jobs_this_month}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-500">Completed This Month</div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-purple-600 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>View Dashboard</span>
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Activity and Getting Started */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-xl bg-white/5 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-sm dark:shadow-none">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
                  <Link to="/activities" className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300">
                    View all
                  </Link>
                </div>
                {recentActivity.length === 0 ? (
                  <div className="text-center py-12">
                    <Activity className="h-12 w-12 text-purple-400/30 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 mb-2">No recent activity</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      Start by creating a project or running a workspace
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-4 p-4 rounded-lg bg-white/10 dark:bg-white/5 hover:bg-white/20 dark:hover:bg-white/10 transition-colors border border-gray-200 dark:border-transparent">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-violet-500">
                          <Zap className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-900 dark:text-white">{activity.description}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{activity.timestamp}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Getting Started */}
              <div className="p-6 rounded-xl bg-white/5 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-sm dark:shadow-none">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Getting Started</h2>
                </div>
                <div className="space-y-4">
                  {!hasOrganization && (
                    <div className="p-4 rounded-lg bg-white/10 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center">
                          <span className="text-xs font-semibold text-white">1</span>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Create an Organization</h3>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Set up your first organization to manage projects and workspaces
                          </p>
                          <Link to="/organizations" className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 mt-2 inline-block">
                            Get started →
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                  {hasOrganization && !hasProject && (
                    <div className="p-4 rounded-lg bg-white/10 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
                          <span className="text-xs font-semibold text-white">2</span>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Create Your First Project</h3>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Organize your infrastructure with projects
                          </p>
                          <Link to="/projects" className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 mt-2 inline-block">
                            Create project →
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                  {hasProject && !hasWorkspace && (
                    <div className="p-4 rounded-lg bg-white/10 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center">
                          <span className="text-xs font-semibold text-white">3</span>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Set Up a Workspace</h3>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Configure a workspace to manage your Terraform state
                          </p>
                          <Link 
                            to={organizationStats.length > 0 ? `/app/${organizationStats[0].name}/workspaces` : '/organizations'} 
                            className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 mt-2 inline-block"
                          >
                            Create workspace →
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
