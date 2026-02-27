// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  Activity, 
  Zap, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  PlayCircle,
  FolderKanban,
  Layers,
  Users,
  Filter,
  FileText,
  Play,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { activitiesApi, organizationsApi, workspacesApi, runsApi, projectsApi, type Activity as ActivityData, type Run } from '@/api/client';
import { getRunFromJsonApi, type JsonApiResource } from '@/utils/jsonapi';
import { 
  ansibleJobsApi, 
  ansiblePlaybooksApi, 
  ansibleJobTemplatesApi, 
  ansibleInventoriesApi,
  type AnsibleJob,
} from '@/api/ansible';
import { getAnsibleJobFromJsonApi } from '@/utils/ansible-jsonapi';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link } from 'react-router-dom';

type TimeRange = '7d' | '30d' | '90d' | 'all';

interface RunStats {
  total: number;
  completed: number;
  failed: number;
  running: number;
  pending: number;
  canceled: number;
  successRate: number;
  avgDuration: number;
}

interface ActivityStats {
  total: number;
  byType: Record<string, number>;
  byAction: Record<string, number>;
  byResource: Record<string, number>;
}

interface TimeSeriesData {
  date: string;
  runs: number;
  activities: number;
  completed: number;
  failed: number;
  ansibleJobs?: number;
  ansibleCompleted?: number;
  ansibleFailed?: number;
}

interface AnsibleStats {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  runningJobs: number;
  pendingJobs: number;
  canceledJobs: number;
  successRate: number;
  avgDuration: number;
  totalPlaybooks: number;
  totalJobTemplates: number;
  totalInventories: number;
}

export default function Usage() {
  const { orgName } = useParams<{ orgName: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [selectedOrg, setSelectedOrg] = useState<string>(orgName || 'all');
  
  const [stats, setStats] = useState({
    totalRuns: 0,
    totalActivities: 0,
    totalOrganizations: 0,
    totalProjects: 0,
    totalWorkspaces: 0,
    totalAnsibleJobs: 0,
    totalAnsiblePlaybooks: 0,
    totalAnsibleJobTemplates: 0,
    totalAnsibleInventories: 0,
  });

  const [runStats, setRunStats] = useState<RunStats>({
    total: 0,
    completed: 0,
    failed: 0,
    running: 0,
    pending: 0,
    canceled: 0,
    successRate: 0,
    avgDuration: 0,
  });

  const [activityStats, setActivityStats] = useState<ActivityStats>({
    total: 0,
    byType: {},
    byAction: {},
    byResource: {},
  });

  const [timeSeries, setTimeSeries] = useState<TimeSeriesData[]>([]);
  const [runsByOrg, setRunsByOrg] = useState<Array<{ name: string; count: number; success: number; failed: number }>>([]);
  const [recentRuns, setRecentRuns] = useState<Run[]>([]);
  const [organizations, setOrganizations] = useState<Array<{ name: string; id: string }>>([]);
  
  const [ansibleStats, setAnsibleStats] = useState<AnsibleStats>({
    totalJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    runningJobs: 0,
    pendingJobs: 0,
    canceledJobs: 0,
    successRate: 0,
    avgDuration: 0,
    totalPlaybooks: 0,
    totalJobTemplates: 0,
    totalInventories: 0,
  });
  const [recentAnsibleJobs, setRecentAnsibleJobs] = useState<AnsibleJob[]>([]);

  const getDateRange = (range: TimeRange): Date => {
    const now = new Date();
    switch (range) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return new Date(0);
    }
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const calculateTimeSeries = (runs: Run[], activities: ActivityData[], ansibleJobs: AnsibleJob[], startDate: Date) => {
    const dataMap = new Map<string, TimeSeriesData>();
    const now = new Date();
    
    // Initialize all days in range
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      dataMap.set(dateStr, { date: dateStr, runs: 0, activities: 0, completed: 0, failed: 0, ansibleJobs: 0, ansibleCompleted: 0, ansibleFailed: 0 });
    }

    // Process runs
    runs.forEach(run => {
      const runDate = new Date(run.created_at);
      if (runDate >= startDate) {
        const dateStr = runDate.toISOString().split('T')[0];
        const existing = dataMap.get(dateStr) || { date: dateStr, runs: 0, activities: 0, completed: 0, failed: 0, ansibleJobs: 0, ansibleCompleted: 0, ansibleFailed: 0 };
        existing.runs++;
        const isCompleted = run.status === 'completed' || run.status === 'applied';
        const isPlanOnlyCompleted = (run.plan_only || run.operation === 'plan-only') && run.status === 'planned';
        if (isCompleted || isPlanOnlyCompleted) existing.completed++;
        if (run.status === 'failed') existing.failed++;
        dataMap.set(dateStr, existing);
      }
    });

    // Process activities
    activities.forEach(activity => {
      const activityDate = new Date(activity.attributes.created_at);
      if (activityDate >= startDate) {
        const dateStr = activityDate.toISOString().split('T')[0];
        const existing = dataMap.get(dateStr) || { date: dateStr, runs: 0, activities: 0, completed: 0, failed: 0, ansibleJobs: 0, ansibleCompleted: 0, ansibleFailed: 0 };
        existing.activities++;
        dataMap.set(dateStr, existing);
      }
    });

    // Process Ansible jobs
    ansibleJobs.forEach(job => {
      const jobDate = new Date(job.created_at);
      if (jobDate >= startDate) {
        const dateStr = jobDate.toISOString().split('T')[0];
        const existing = dataMap.get(dateStr) || { date: dateStr, runs: 0, activities: 0, completed: 0, failed: 0, ansibleJobs: 0, ansibleCompleted: 0, ansibleFailed: 0 };
        existing.ansibleJobs = (existing.ansibleJobs || 0) + 1;
        if (job.status === 'successful') existing.ansibleCompleted = (existing.ansibleCompleted || 0) + 1;
        if (job.status === 'failed' || job.status === 'error') existing.ansibleFailed = (existing.ansibleFailed || 0) + 1;
        dataMap.set(dateStr, existing);
      }
    });

    return Array.from(dataMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  };

  // Update selectedOrg when URL param changes
  useEffect(() => {
    if (orgName && orgName !== selectedOrg) {
      setSelectedOrg(orgName);
    } else if (!orgName && selectedOrg !== 'all') {
      // If no org in URL, redirect to first org or show all
      void organizationsApi.list()
        .then((res) => {
          const orgs = res.data || [];
          setOrganizations(orgs.map(org => ({ name: org.name, id: org.id })));
          if (orgs.length > 0) {
            void Promise.resolve(navigate(`/app/${orgs[0].name}/usage`, { replace: true }));
            setSelectedOrg(orgs[0].name);
          } else {
            setSelectedOrg('all');
          }
        })
        .catch((err) => {
          console.error('Failed to load organizations:', err);
          setSelectedOrg('all');
        });
    }
  }, [orgName, navigate, selectedOrg]);

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      setLoading(true);
      try {
        const startDate = getDateRange(timeRange);
        
        // Fetch all organizations
        const orgsRes = await organizationsApi.list();
        const allOrgs = orgsRes.data || [];
        setOrganizations(allOrgs.map(org => ({ name: org.name, id: org.id })));
        
        // If no org selected or 'all', use all orgs, otherwise filter by selected org
        const orgsToProcess = !selectedOrg || selectedOrg === 'all'
          ? allOrgs 
          : allOrgs.filter(org => org.name === selectedOrg);

        // Fetch activities
        let allActivities: ActivityData[] = [];
        try {
          const activitiesRes = await activitiesApi.list({ limit: 1000 });
          allActivities = (activitiesRes.data || []).filter(a => 
            new Date(a.attributes.created_at) >= startDate
          );
        } catch (err: unknown) {
          if (err && typeof err === 'object' && 'status' in err) {
            const status = (err as { status: number }).status;
            if (status !== 404 && status !== 401) {
              console.error('Failed to load activities:', err);
            }
          } else {
            console.error('Failed to load activities:', err);
          }
        }

        // Fetch all runs, projects, and workspaces
        const allRuns: Run[] = [];
        let totalProjects = 0;
        let totalWorkspaces = 0;
        const orgRunCounts: Record<string, { count: number; success: number; failed: number }> = {};

        await Promise.all(
          orgsToProcess.map(async (org) => {
            try {
              const projectsRes = await projectsApi.list(org.name);
              const projects = projectsRes.data || [];
              totalProjects += projects.length;

              const workspacesRes = await workspacesApi.list(org.name);
              const workspaces = workspacesRes.data || [];
              totalWorkspaces += workspaces.length;

              orgRunCounts[org.name] = { count: 0, success: 0, failed: 0 };

              await Promise.all(
                workspaces.map(async (workspace) => {
                  try {
                    const runsRes = await runsApi.list(workspace.id);
                    const runs = (runsRes?.data || []).map((resource: JsonApiResource) => getRunFromJsonApi(resource))
                      .filter(r => new Date(r.created_at) >= startDate)
                      .map(run => ({
                        ...run,
                        workspace_name: workspace.name,
                        organization_name: org.name,
                      }));
                    allRuns.push(...runs);
                    orgRunCounts[org.name].count += runs.length;
                    runs.forEach(run => {
                      // Count plan-only runs with 'planned' status as successful
                      const isCompleted = run.status === 'completed' || run.status === 'applied';
                      const isPlanOnlyCompleted = (run.plan_only || run.operation === 'plan-only') && run.status === 'planned';
                      if (isCompleted || isPlanOnlyCompleted) orgRunCounts[org.name].success++;
                      if (run.status === 'failed') orgRunCounts[org.name].failed++;
                    });
                  } catch (err) {
                    console.error(`Failed to load runs for workspace ${workspace.id}:`, err);
                  }
                })
              );
            } catch (err) {
              console.error(`Failed to load data for organization ${org.name}:`, err);
            }
          })
        );

        // Calculate run statistics
        // Plan-only runs with 'planned' status are considered completed (plan completed successfully)
        const completedRuns = allRuns.filter(r => {
          const isCompleted = r.status === 'completed' || r.status === 'applied';
          const isPlanOnlyCompleted = (r.plan_only || r.operation === 'plan-only') && r.status === 'planned';
          return isCompleted || isPlanOnlyCompleted;
        });
        const failedRuns = allRuns.filter(r => r.status === 'failed');
        const runningRuns = allRuns.filter(r => r.status === 'running' || r.status === 'planning' || r.status === 'applying');
        // Exclude plan-only runs with 'planned' status from pending (they're completed)
        const pendingRuns = allRuns.filter(r => {
          const isPendingStatus = r.status === 'pending' || r.status === 'planned';
          const isPlanOnlyCompleted = (r.plan_only || r.operation === 'plan-only') && r.status === 'planned';
          return isPendingStatus && !isPlanOnlyCompleted;
        });
        const canceledRuns = allRuns.filter(r => r.status === 'canceled');

        // Calculate average duration
        const durations = completedRuns
          .filter(r => r.started_at && r.completed_at)
          .map(r => {
            const start = new Date(r.started_at!).getTime();
            const end = new Date(r.completed_at!).getTime();
            return (end - start) / 1000; // seconds
          });
        const avgDuration = durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : 0;

        const successRate = allRuns.length > 0 && (completedRuns.length + failedRuns.length) > 0
          ? (completedRuns.length / (completedRuns.length + failedRuns.length)) * 100
          : 0;

        setRunStats({
          total: allRuns.length,
          completed: completedRuns.length,
          failed: failedRuns.length,
          running: runningRuns.length,
          pending: pendingRuns.length,
          canceled: canceledRuns.length,
          successRate: Math.round(successRate * 10) / 10,
          avgDuration,
        });

        // Calculate activity statistics
        const byType: Record<string, number> = {};
        const byAction: Record<string, number> = {};
        const byResource: Record<string, number> = {};

        allActivities.forEach(activity => {
          const type = activity.attributes.resource_type || 'unknown';
          const action = activity.attributes.action || 'unknown';
          const resource = activity.attributes.resource_type || 'unknown';

          byType[type] = (byType[type] || 0) + 1;
          byAction[action] = (byAction[action] || 0) + 1;
          byResource[resource] = (byResource[resource] || 0) + 1;
        });

        setActivityStats({
          total: allActivities.length,
          byType,
          byAction,
          byResource,
        });

        // Note: Removed runsByOperation as it's not useful

        // Calculate runs by organization
        const orgRuns = Object.entries(orgRunCounts).map(([name, counts]) => ({
          name,
          count: counts.count,
          success: counts.success,
          failed: counts.failed,
        })).sort((a, b) => b.count - a.count);
        setRunsByOrg(orgRuns);

        // Get recent runs
        const recent = allRuns
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 10);
        setRecentRuns(recent);

        // Fetch Ansible data
        const allAnsibleJobs: AnsibleJob[] = [];
        let totalPlaybooks = 0;
        let totalJobTemplates = 0;
        let totalInventories = 0;

        await Promise.all(
          orgsToProcess.map(async (org) => {
            try {
              // Fetch Ansible jobs
              try {
                const jobsRes = await ansibleJobsApi.listByOrganization(org.name);
                const jobs = (jobsRes.data || []).map(getAnsibleJobFromJsonApi).filter(j => 
                  new Date(j.created_at) >= startDate
                );
                allAnsibleJobs.push(...jobs);
              } catch (err) {
                console.error(`Failed to load Ansible jobs for ${org.name}:`, err);
              }

              // Fetch playbooks
              try {
                const playbooksRes = await ansiblePlaybooksApi.listByOrganization(org.name);
                totalPlaybooks += (playbooksRes.data || []).length;
              } catch (err) {
                console.error(`Failed to load playbooks for ${org.name}:`, err);
              }

              // Fetch job templates
              try {
                const templatesRes = await ansibleJobTemplatesApi.listByOrganization(org.name);
                totalJobTemplates += (templatesRes.data || []).length;
              } catch (err) {
                console.error(`Failed to load job templates for ${org.name}:`, err);
              }

              // Fetch inventories
              try {
                const inventoriesRes = await ansibleInventoriesApi.list(org.name);
                totalInventories += (inventoriesRes.data || []).length;
              } catch (err) {
                console.error(`Failed to load inventories for ${org.name}:`, err);
              }
            } catch (err) {
              console.error(`Failed to load Ansible data for organization ${org.name}:`, err);
            }
          })
        );

        // Calculate Ansible job statistics
        const completedJobs = allAnsibleJobs.filter(j => j.status === 'successful');
        const failedJobs = allAnsibleJobs.filter(j => j.status === 'failed' || j.status === 'error');
        const runningJobs = allAnsibleJobs.filter(j => j.status === 'running');
        const pendingJobs = allAnsibleJobs.filter(j => j.status === 'pending');
        const canceledJobs = allAnsibleJobs.filter(j => j.status === 'canceled');

        // Calculate average duration for Ansible jobs
        const jobDurations = completedJobs
          .filter(j => j.started_at && j.finished_at)
          .map(j => {
            const start = new Date(j.started_at!).getTime();
            const end = new Date(j.finished_at!).getTime();
            return (end - start) / 1000; // seconds
          });
        const avgJobDuration = jobDurations.length > 0
          ? jobDurations.reduce((a, b) => a + b, 0) / jobDurations.length
          : 0;

        const jobSuccessRate = allAnsibleJobs.length > 0
          ? (completedJobs.length / (completedJobs.length + failedJobs.length)) * 100
          : 0;

        setAnsibleStats({
          totalJobs: allAnsibleJobs.length,
          completedJobs: completedJobs.length,
          failedJobs: failedJobs.length,
          runningJobs: runningJobs.length,
          pendingJobs: pendingJobs.length,
          canceledJobs: canceledJobs.length,
          successRate: Math.round(jobSuccessRate * 10) / 10,
          avgDuration: avgJobDuration,
          totalPlaybooks,
          totalJobTemplates,
          totalInventories,
        });

        // Get recent Ansible jobs
        const recentAnsible = allAnsibleJobs
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 10);
        setRecentAnsibleJobs(recentAnsible);

        // Calculate time series (includes Ansible jobs)
        const series = calculateTimeSeries(allRuns, allActivities, allAnsibleJobs, startDate);
        setTimeSeries(series);

        // Set overall stats
        setStats({
          totalRuns: allRuns.length,
          totalActivities: allActivities.length,
          totalOrganizations: allOrgs.length,
          totalProjects,
          totalWorkspaces,
          totalAnsibleJobs: allAnsibleJobs.length,
          totalAnsiblePlaybooks: totalPlaybooks,
          totalAnsibleJobTemplates: totalJobTemplates,
          totalAnsibleInventories: totalInventories,
        });
      } catch (err) {
        console.error('Failed to load analytics data:', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchAnalyticsData();
  }, [timeRange, selectedOrg]);

  const SimpleBarChart = ({ data, maxValue, color = 'purple' }: { data: TimeSeriesData[], maxValue: number, color?: string }) => {
    const maxHeight = 200;
    return (
      <div className="flex items-end justify-between gap-1 h-[220px">
        {data.map((item, idx) => {
          const height = maxValue > 0 ? (item.runs / maxValue) * maxHeight : 0;
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
              <div 
                className={cn(
                  "w-full rounded-t transition-all hover:opacity-80",
                  color === 'purple' && "bg-gradient-to-t from-purple-500 to-purple-400",
                  color === 'blue' && "bg-gradient-to-t from-blue-500 to-blue-400",
                  color === 'green' && "bg-gradient-to-t from-green-500 to-green-400",
                  color === 'red' && "bg-gradient-to-t from-red-500 to-red-400",
                )}
                style={{ height: `${Math.max(height, 2)}px` }}
                title={`${item.date}: ${item.runs} runs`}
              />
              {idx % Math.ceil(data.length / 7) === 0 && (
                <span className="text-xs text-muted-foreground transform -rotate-45 origin-top-left whitespace-nowrap">
                  {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const PieChartSegment = ({ label, value, total, color }: { label: string; value: number; total: number; color: string }) => {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    const radius = 32;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    
    return (
      <div className="flex items-center gap-3">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80" preserveAspectRatio="xMidYMid meet">
            <circle
              cx="40"
              cy="40"
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-gray-200 dark:text-gray-800"
            />
            <circle
              cx="40"
              cy="40"
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={color}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-semibold">{Math.round(percentage)}%</span>
          </div>
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{value} runs</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent">
            Usage & Analytics
          </h1>
          <p className="text-muted-foreground text-lg">
            Comprehensive overview of your infrastructure activities and performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select 
            value={selectedOrg} 
            onValueChange={(orgName) => {
              if (orgName === 'all') {
                // For 'all', we could navigate to a global usage page or stay on current org
                // For now, let's keep it scoped to the current org if available
                setSelectedOrg(orgName || 'all');
              } else {
                void navigate(`/app/${orgName}/usage`, { replace: true });
                setSelectedOrg(orgName);
              }
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Organizations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Organizations</SelectItem>
              {organizations.map(org => (
                <SelectItem key={org.id} value={org.name}>{org.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Runs', value: stats.totalRuns, icon: Activity, gradient: 'from-purple-500 to-indigo-500' },
          { label: 'Activities', value: stats.totalActivities, icon: Zap, gradient: 'from-indigo-500 to-blue-500' },
          { label: 'Organizations', value: stats.totalOrganizations, icon: FolderKanban, gradient: 'from-blue-500 to-cyan-500' },
          { label: 'Projects', value: stats.totalProjects, icon: Layers, gradient: 'from-cyan-500 to-blue-500' },
          { label: 'Workspaces', value: stats.totalWorkspaces, icon: Users, gradient: 'from-purple-500 to-pink-500' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={cn(
                'rounded-xl',
                'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
                'dark:from-black/10 dark:via-black/5',
                'backdrop-blur-md border border-white/20 dark:border-white/10',
                'p-4 shadow-lg shadow-purple-500/10'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={cn('p-2 rounded-lg bg-gradient-to-br', stat.gradient)}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
              </div>
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <p className="text-2xl font-bold">{stat.value.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Ansible Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Ansible Jobs', value: stats.totalAnsibleJobs, icon: Play, gradient: 'from-green-500 to-emerald-500' },
          { label: 'Playbooks', value: stats.totalAnsiblePlaybooks, icon: FileText, gradient: 'from-purple-500 to-violet-500' },
          { label: 'Job Templates', value: stats.totalAnsibleJobTemplates, icon: Layers, gradient: 'from-blue-500 to-indigo-500' },
          { label: 'Inventories', value: stats.totalAnsibleInventories, icon: List, gradient: 'from-orange-500 to-red-500' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={cn(
                'rounded-xl',
                'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
                'dark:from-black/10 dark:via-black/5',
                'backdrop-blur-md border border-white/20 dark:border-white/10',
                'p-4 shadow-lg shadow-green-500/10'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={cn('p-2 rounded-lg bg-gradient-to-br', stat.gradient)}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
              </div>
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <p className="text-2xl font-bold">{stat.value.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Ansible Job Runs Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
            Ansible Job Runs
          </h2>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ansible Job Status Breakdown */}
          <div className={cn(
            'rounded-xl',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
            'dark:from-black/10 dark:via-black/5',
            'backdrop-blur-md border border-white/20 dark:border-white/10',
            'p-6 shadow-lg shadow-green-500/10'
          )}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Play className="h-5 w-5 text-green-400" />
              Job Status
            </h3>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-green-500" />
            </div>
          ) : (
            <div className="space-y-4">
              <PieChartSegment
                label="Successful"
                value={ansibleStats.completedJobs}
                total={ansibleStats.totalJobs}
                color="text-green-500"
              />
              <PieChartSegment
                label="Failed"
                value={ansibleStats.failedJobs}
                total={ansibleStats.totalJobs}
                color="text-red-500"
              />
              <PieChartSegment
                label="Running"
                value={ansibleStats.runningJobs}
                total={ansibleStats.totalJobs}
                color="text-blue-500"
              />
              <PieChartSegment
                label="Pending"
                value={ansibleStats.pendingJobs}
                total={ansibleStats.totalJobs}
                color="text-yellow-500"
              />
              {ansibleStats.canceledJobs > 0 && (
                <PieChartSegment
                  label="Cancelled"
                  value={ansibleStats.canceledJobs}
                  total={ansibleStats.totalJobs}
                  color="text-gray-500"
                />
              )}
            </div>
          )}
        </div>

          {/* Ansible Job Performance Metrics */}
          <div className={cn(
            'rounded-xl',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
            'dark:from-black/10 dark:via-black/5',
            'backdrop-blur-md border border-white/20 dark:border-white/10',
            'p-6 shadow-lg shadow-green-500/10'
          )}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              Performance Metrics
            </h3>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Success Rate</span>
                  <span className="text-2xl font-bold text-green-500">{ansibleStats.successRate}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-green-500 to-green-400 h-3 rounded-full transition-all"
                    style={{ width: `${ansibleStats.successRate}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Average Duration</span>
                  <span className="text-xl font-bold">{formatDuration(ansibleStats.avgDuration)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Based on {ansibleStats.completedJobs} completed jobs
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total Jobs</p>
                  <p className="text-2xl font-bold">{ansibleStats.totalJobs}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Successful</p>
                  <p className="text-2xl font-bold text-green-500">{ansibleStats.completedJobs}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Failed</p>
                  <p className="text-2xl font-bold text-red-500">{ansibleStats.failedJobs}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Running</p>
                  <p className="text-2xl font-bold text-blue-500">{ansibleStats.runningJobs}</p>
                </div>
              </div>
            </div>
          )}
        </div>

          {/* Ansible Resources Summary */}
          <div className={cn(
            'rounded-xl',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
            'dark:from-black/10 dark:via-black/5',
            'backdrop-blur-md border border-white/20 dark:border-white/10',
            'p-6 shadow-lg shadow-green-500/10'
          )}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-violet-400" />
              Resources
            </h3>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Playbooks</span>
                <span className="text-2xl font-bold">{ansibleStats.totalPlaybooks}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Job Templates</span>
                <span className="text-2xl font-bold">{ansibleStats.totalJobTemplates}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Inventories</span>
                <span className="text-2xl font-bold">{ansibleStats.totalInventories}</span>
              </div>
            </div>
          )}
        </div>
        </div>

        {/* Recent Ansible Jobs */}
        {selectedOrg && (
          <div className={cn(
            'rounded-xl',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
            'dark:from-black/10 dark:via-black/5',
            'backdrop-blur-md border border-white/20 dark:border-white/10',
            'p-6 shadow-lg shadow-green-500/10'
          )}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Play className="h-5 w-5 text-green-400" />
                Recent Ansible Jobs
              </h3>
              {selectedOrg !== 'all' && (
                <Link to={`/app/${selectedOrg}/ansible/jobs`}>
                  <Button variant="ghost" size="sm">
                    View all jobs
                  </Button>
                </Link>
              )}
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-green-500" />
              </div>
            ) : recentAnsibleJobs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No Ansible jobs found for selected time range</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentAnsibleJobs.map((job) => {
                  const statusColors = {
                    successful: 'text-green-500 bg-green-500/10 border-green-500/20',
                    failed: 'text-red-500 bg-red-500/10 border-red-500/20',
                    error: 'text-red-500 bg-red-500/10 border-red-500/20',
                    running: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
                    pending: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
                    canceled: 'text-gray-500 bg-gray-500/10 border-gray-500/20',
                  };
                  const StatusIcon = job.status === 'successful' ? CheckCircle2 :
                                    job.status === 'failed' || job.status === 'error' ? XCircle :
                                    job.status === 'running' ? Loader2 :
                                    Clock;
                  const duration = job.started_at && job.finished_at 
                    ? (new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 1000
                    : null;
                  return (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-white/5 dark:bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          'p-2 rounded-lg border',
                          statusColors[job.status] || statusColors.pending
                        )}>
                          <StatusIcon className={cn('h-4 w-4', job.status === 'running' && 'animate-spin')} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {job.name || `Job ${job.id.slice(0, 8)}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(job.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={cn(
                          'text-xs px-2 py-1 rounded-full border capitalize',
                          statusColors[job.status] || statusColors.pending
                        )}>
                          {job.status}
                        </span>
                        {duration !== null && (
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(duration)}
                          </span>
                        )}
                        {selectedOrg !== 'all' && (
                          <Link to={`/app/${selectedOrg}/ansible/jobs/${job.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Terraform Workspace Runs Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            Terraform Workspace Runs
          </h2>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Run Status Breakdown */}
          <div className={cn(
            'rounded-xl',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
            'dark:from-black/10 dark:via-black/5',
            'backdrop-blur-md border border-white/20 dark:border-white/10',
            'p-6 shadow-lg shadow-purple-500/10'
          )}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-purple-400" />
              Run Status
            </h3>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            </div>
          ) : (
            <div className="space-y-4">
              <PieChartSegment
                label="Completed"
                value={runStats.completed}
                total={runStats.total}
                color="text-green-500"
              />
              <PieChartSegment
                label="Failed"
                value={runStats.failed}
                total={runStats.total}
                color="text-red-500"
              />
              <PieChartSegment
                label="Running"
                value={runStats.running}
                total={runStats.total}
                color="text-blue-500"
              />
              <PieChartSegment
                label="Pending"
                value={runStats.pending}
                total={runStats.total}
                color="text-yellow-500"
              />
              {runStats.canceled > 0 && (
                <PieChartSegment
                  label="Cancelled"
                  value={runStats.canceled}
                  total={runStats.total}
                  color="text-gray-500"
                />
              )}
            </div>
          )}
        </div>

          {/* Run Performance Metrics */}
          <div className={cn(
            'rounded-xl',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
            'dark:from-black/10 dark:via-black/5',
            'backdrop-blur-md border border-white/20 dark:border-white/10',
            'p-6 shadow-lg shadow-purple-500/10'
          )}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-400" />
              Performance Metrics
            </h3>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Success Rate</span>
                  <span className="text-2xl font-bold text-green-500">{runStats.successRate}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-green-500 to-green-400 h-3 rounded-full transition-all"
                    style={{ width: `${runStats.successRate}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Average Duration</span>
                  <span className="text-xl font-bold">{formatDuration(runStats.avgDuration)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Based on {runStats.completed} completed runs
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total Runs</p>
                  <p className="text-2xl font-bold">{runStats.total}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Completed</p>
                  <p className="text-2xl font-bold text-green-500">{runStats.completed}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Failed</p>
                  <p className="text-2xl font-bold text-red-500">{runStats.failed}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Running</p>
                  <p className="text-2xl font-bold text-blue-500">{runStats.running}</p>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>

        {/* Terraform Runs Over Time */}
        <div className={cn(
          'rounded-xl',
          'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
          'dark:from-black/10 dark:via-black/5',
          'backdrop-blur-md border border-white/20 dark:border-white/10',
          'p-6 shadow-lg shadow-purple-500/10'
        )}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-400" />
            Runs Over Time
          </h3>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            </div>
          ) : timeSeries.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>No data available for selected time range</p>
            </div>
          ) : (
            <SimpleBarChart 
              data={timeSeries} 
              maxValue={Math.max(...timeSeries.map(d => d.runs), 1)}
              color="purple"
            />
          )}
        </div>

        {/* Activity Trends */}
        <div className={cn(
          'rounded-xl',
          'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
          'dark:from-black/10 dark:via-black/5',
          'backdrop-blur-md border border-white/20 dark:border-white/10',
          'p-6 shadow-lg shadow-purple-500/10'
        )}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-indigo-400" />
            Activity Trends
          </h3>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
          ) : timeSeries.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>No data available for selected time range</p>
            </div>
          ) : (
            <SimpleBarChart 
              data={timeSeries.map(d => ({ ...d, runs: d.activities }))} 
              maxValue={Math.max(...timeSeries.map(d => d.activities), 1)}
              color="blue"
            />
          )}
        </div>
      </div>

      {/* General Activity Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity by Type */}
        <div className={cn(
          'rounded-xl',
          'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
          'dark:from-black/10 dark:via-black/5',
          'backdrop-blur-md border border-white/20 dark:border-white/10',
          'p-6 shadow-lg shadow-purple-500/10'
        )}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Filter className="h-5 w-5 text-cyan-400" />
            Activity by Resource Type
          </h3>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
            </div>
          ) : Object.keys(activityStats.byType).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No activity data available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(activityStats.byType)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([type, count]) => {
                  const percentage = activityStats.total > 0 ? (count / activityStats.total) * 100 : 0;
                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium capitalize">{type}</span>
                        <span className="text-sm font-bold">{count}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Activity by Action */}
        <div className={cn(
          'rounded-xl',
          'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
          'dark:from-black/10 dark:via-black/5',
          'backdrop-blur-md border border-white/20 dark:border-white/10',
          'p-6 shadow-lg shadow-purple-500/10'
        )}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-pink-400" />
            Activity by Action
          </h3>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
            </div>
          ) : Object.keys(activityStats.byAction).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No activity data available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(activityStats.byAction)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([action, count]) => {
                  const percentage = activityStats.total > 0 ? (count / activityStats.total) * 100 : 0;
                  return (
                    <div key={action}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium capitalize">{action.replace(/_/g, ' ')}</span>
                        <span className="text-sm font-bold">{count}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-pink-500 to-purple-500 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Workspace Runs by Organization */}
        <div className={cn(
            'rounded-xl',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
            'dark:from-black/10 dark:via-black/5',
            'backdrop-blur-md border border-white/20 dark:border-white/10',
            'p-6 shadow-lg shadow-purple-500/10'
          )}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-violet-400" />
              Runs by Organization
            </h3>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          </div>
        ) : runsByOrg.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No workspace runs found for selected time range</p>
          </div>
        ) : (
          <div className="space-y-4">
            {runsByOrg.map((org) => {
              const maxRuns = Math.max(...runsByOrg.map(o => o.count), 1);
              const successRate = org.count > 0 ? (org.success / (org.success + org.failed)) * 100 : 0;
              return (
                <div key={org.name}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/app/${org.name}/workspaces`}
                        className="text-sm font-medium hover:text-purple-400 transition-colors"
                      >
                        {org.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        ({org.count} runs)
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1 text-green-500">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{org.success}</span>
                      </div>
                      <div className="flex items-center gap-1 text-red-500">
                        <XCircle className="h-3.5 w-3.5" />
                        <span>{org.failed}</span>
                      </div>
                      <span className="text-muted-foreground">{Math.round(successRate)}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-violet-500 to-purple-500 h-3 rounded-full transition-all"
                      style={{ width: `${(org.count / maxRuns) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>

        {/* Recent Workspace Runs */}
        <div className={cn(
            'rounded-xl',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
            'dark:from-black/10 dark:via-black/5',
            'backdrop-blur-md border border-white/20 dark:border-white/10',
            'p-6 shadow-lg shadow-purple-500/10'
          )}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-400" />
                Recent Workspace Runs
              </h3>
              {selectedOrg !== 'all' && (
                <Link to={`/app/${selectedOrg}/workspaces`}>
                  <Button variant="ghost" size="sm">
                    View all workspaces
                  </Button>
                </Link>
              )}
            </div>
        {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : recentRuns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No workspace runs found for selected time range</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentRuns.map((run) => {
                const statusColors: Record<string, string> = {
                  completed: 'text-green-500 bg-green-500/10 border-green-500/20',
                  applied: 'text-green-500 bg-green-500/10 border-green-500/20',
                  failed: 'text-red-500 bg-red-500/10 border-red-500/20',
                  running: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
                  planning: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
                  applying: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
                  pending: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
                  planned: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
                  canceled: 'text-gray-500 bg-gray-500/10 border-gray-500/20',
                };
                const StatusIcon = (run.status === 'completed' || run.status === 'applied') ? CheckCircle2 :
                                  run.status === 'failed' ? XCircle :
                                  (run.status === 'running' || run.status === 'planning' || run.status === 'applying') ? Loader2 :
                                  Clock;
                const isRunning = run.status === 'running' || run.status === 'planning' || run.status === 'applying';
                const orgName = (run as Run & { organization_name?: string; workspace_name?: string }).organization_name || selectedOrg;
                const workspaceName = (run as Run & { organization_name?: string; workspace_name?: string }).workspace_name;
                const runLink = orgName && workspaceName ? `/app/${orgName}/workspaces/${workspaceName}/runs/${run.id}` : null;
                
                return (
                  <div
                    key={run.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-white/5 dark:bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        'p-2 rounded-lg border',
                        statusColors[run.status] || statusColors.pending
                      )}>
                        <StatusIcon className={cn('h-4 w-4', isRunning && 'animate-spin')} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {workspaceName ? (
                            runLink ? (
                              <Link to={runLink} className="hover:underline">
                                {workspaceName} - {run.operation.replace(/-/g, ' ')}
                              </Link>
                            ) : (
                              <span>{workspaceName} - {run.operation.replace(/-/g, ' ')}</span>
                            )
                          ) : (
                            <span className="capitalize">{run.operation.replace(/-/g, ' ')} run</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(run.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        'text-xs px-2 py-1 rounded-full border capitalize',
                        statusColors[run.status] || statusColors.pending
                      )}>
                        {run.status}
                      </span>
                      {run.completed_at && run.started_at && (
                        <span className="text-xs text-muted-foreground">
                          {formatDuration((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}
                        </span>
                      )}
                      {runLink && (
                        <Link to={runLink}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
