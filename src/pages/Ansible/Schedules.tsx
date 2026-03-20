// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useOrganization } from '@/contexts/OrganizationContext';
import { 
  ansibleSchedulesApi, 
  ansibleJobTemplatesApi,
  type AnsibleSchedule,
  type ScheduleType,
  type ScheduleStatus,
  type CreateScheduleInput,
} from '@/api/ansible';
import { 
  getAnsibleScheduleFromJsonApi,
  getAnsibleJobTemplateFromJsonApi, 
} from '@/utils/ansible-jsonapi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Search,
  MoreVertical,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Calendar,
  Play,
  Pause,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

// Common cron presets
const CRON_PRESETS = [
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at midnight', value: '0 0 * * *' },
  { label: 'Every day at 2 AM', value: '0 2 * * *' },
  { label: 'Every day at 9 AM', value: '0 9 * * *' },
  { label: 'Weekdays at 9 AM', value: '0 9 * * 1-5' },
  { label: 'Every Sunday at midnight', value: '0 0 * * 0' },
  { label: 'First day of month at midnight', value: '0 0 1 * *' },
];

// Timezone options
const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

// Format relative time for next run
function formatNextRun(dateString?: string): string {
  if (!dateString) return 'Not scheduled';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  
  if (diffMs < 0) return 'Overdue';
  
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
  if (diffHours < 24) return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
  if (diffDays < 7) return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  return date.toLocaleDateString();
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

export default function Schedules() {
  const { orgName } = useParams<{ orgName: string }>();
  const { currentOrg } = useOrganization();
  const selectedOrg = orgName || currentOrg?.name || '';

  const { data: queryData, isLoading: loading, refetch: refetchSchedules } = useQuery({
    queryKey: ['schedules', selectedOrg],
    queryFn: async () => {
      const [schedulesRes, templatesRes] = await Promise.all([
        ansibleSchedulesApi.list(selectedOrg),
        ansibleJobTemplatesApi.listByOrganization(selectedOrg),
      ]);
      return {
        schedules: (schedulesRes.data || []).map(getAnsibleScheduleFromJsonApi),
        jobTemplates: (templatesRes.data || []).map(getAnsibleJobTemplateFromJsonApi),
      };
    },
    enabled: !!selectedOrg,
  });

  const schedules = queryData?.schedules ?? [];
  const jobTemplates = queryData?.jobTemplates ?? [];

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ScheduleStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<ScheduleType | 'all'>('all');
  
  // Create schedule state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<CreateScheduleInput>({
    name: '',
    description: '',
    type: 'job_template',
    cron_expression: '0 2 * * *',
    timezone: 'UTC',
  });
  
  // Action states
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!scheduleForm.name.trim()) {
      toast.error('Schedule name is required');
      return;
    }
    if (!scheduleForm.cron_expression.trim()) {
      toast.error('Cron expression is required');
      return;
    }
    if (scheduleForm.type === 'job_template' && !scheduleForm.job_template_id) {
      toast.error('Please select a job template');
      return;
    }

    setCreating(true);
    try {
      const res = await ansibleSchedulesApi.create(selectedOrg, scheduleForm);
      getAnsibleScheduleFromJsonApi(res.data);
      void refetchSchedules();
      setCreateDialogOpen(false);
      setScheduleForm({
        name: '',
        description: '',
        type: 'job_template',
        cron_expression: '0 2 * * *',
        timezone: 'UTC',
      });
      toast.success('Schedule created successfully');
    } catch (err: unknown) {
      console.error('Failed to create schedule:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to create schedule');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (schedule: AnsibleSchedule) => {
    setTogglingId(schedule.id);
    try {
      if (schedule.status === 'enabled') {
        await ansibleSchedulesApi.disable(schedule.id);
        void refetchSchedules();
        toast.success('Schedule disabled');
      } else {
        await ansibleSchedulesApi.enable(schedule.id);
        void refetchSchedules();
        toast.success('Schedule enabled');
      }
    } catch (err: unknown) {
      console.error('Failed to toggle schedule:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to toggle schedule');
    } finally {
      setTogglingId(null);
    }
  };

  const handleRunNow = async (scheduleId: string) => {
    setRunningId(scheduleId);
    try {
      await ansibleSchedulesApi.runNow(scheduleId);
      toast.success('Schedule triggered - job started');
      void refetchSchedules();
    } catch (err: unknown) {
      console.error('Failed to run schedule:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to run schedule');
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async (scheduleId: string) => {
    setDeletingId(scheduleId);
    try {
      await ansibleSchedulesApi.delete(scheduleId);
      void refetchSchedules();
      toast.success('Schedule deleted');
    } catch (err: unknown) {
      console.error('Failed to delete schedule:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete schedule');
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: ScheduleStatus) => {
    if (status === 'enabled') {
      return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Enabled</Badge>;
    }
    return <Badge variant="secondary"><Pause className="h-3 w-3 mr-1" />Disabled</Badge>;
  };

  const getTypeBadge = (type: ScheduleType) => {
    switch (type) {
      case 'job_template':
        return <Badge variant="outline">Job Template</Badge>;
      case 'inventory_source':
        return <Badge variant="outline">Inventory Sync</Badge>;
      case 'playbook_sync':
        return <Badge variant="outline">Playbook Sync</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getLastRunStatusBadge = (status?: string) => {
    if (!status) return null;
    switch (status) {
      case 'successful':
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Success</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'running':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Filter schedules
  const filteredSchedules = schedules.filter((schedule: AnsibleSchedule) => {
    if (statusFilter !== 'all' && schedule.status !== statusFilter) return false;
    if (typeFilter !== 'all' && schedule.type !== typeFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        schedule.name.toLowerCase().includes(query) ||
        schedule.description?.toLowerCase().includes(query) ||
        schedule.cron_expression.includes(query)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schedules</h1>
          <p className="text-muted-foreground">
            Manage scheduled job template runs and inventory syncs
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Schedule</DialogTitle>
              <DialogDescription>
                Set up a recurring schedule to run jobs automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="schedule-name">Name *</Label>
                <Input
                  id="schedule-name"
                  placeholder="nightly-backup"
                  value={scheduleForm.name}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-description">Description</Label>
                <Textarea
                  id="schedule-description"
                  placeholder="Run backup playbook every night"
                  value={scheduleForm.description}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-type">Schedule Type</Label>
                <Select 
                  value={scheduleForm.type} 
                  onValueChange={(value: ScheduleType) => setScheduleForm({ ...scheduleForm, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="job_template">Job Template</SelectItem>
                    <SelectItem value="inventory_source">Inventory Source Sync</SelectItem>
                    <SelectItem value="playbook_sync">Playbook VCS Sync</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {scheduleForm.type === 'job_template' && (
                <div className="space-y-2">
                  <Label htmlFor="schedule-template">Job Template *</Label>
                  <Select 
                    value={scheduleForm.job_template_id || ''} 
                    onValueChange={(value) => setScheduleForm({ ...scheduleForm, job_template_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select job template" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobTemplates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="schedule-cron">Cron Expression *</Label>
                <div className="flex gap-2">
                  <Input
                    id="schedule-cron"
                    placeholder="0 2 * * *"
                    value={scheduleForm.cron_expression}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, cron_expression: e.target.value })}
                    className="flex-1"
                  />
                  <Select 
                    value="" 
                    onValueChange={(value) => setScheduleForm({ ...scheduleForm, cron_expression: value })}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Presets" />
                    </SelectTrigger>
                    <SelectContent>
                      {CRON_PRESETS.map(preset => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Format: minute hour day month weekday (e.g., "0 2 * * *" = every day at 2 AM)
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="schedule-timezone">Timezone</Label>
                <Select 
                  value={scheduleForm.timezone || 'UTC'} 
                  onValueChange={(value) => setScheduleForm({ ...scheduleForm, timezone: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map(tz => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => { void handleCreate(); }} disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Schedules</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schedules.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {schedules.filter(s => s.status === 'enabled').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disabled</CardTitle>
            <Pause className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {schedules.filter(s => s.status === 'disabled').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
            <RefreshCw className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schedules.reduce((sum, s) => sum + s.run_count, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search schedules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ScheduleStatus | 'all')}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="enabled">Enabled</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ScheduleType | 'all')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="job_template">Job Template</SelectItem>
            <SelectItem value="inventory_source">Inventory Sync</SelectItem>
            <SelectItem value="playbook_sync">Playbook Sync</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Schedules Table */}
      {filteredSchedules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No schedules found</h3>
            <p className="text-muted-foreground text-sm mb-4 text-center max-w-md">
              {schedules.length === 0
                ? 'Create a schedule to automatically run job templates on a recurring basis.'
                : 'No schedules match your current filters.'}
            </p>
            {schedules.length === 0 && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Schedule
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Cron</TableHead>
                <TableHead>Next Run</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Runs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSchedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{schedule.name}</div>
                      {schedule.description && (
                        <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {schedule.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getTypeBadge(schedule.type)}</TableCell>
                  <TableCell>
                    <code className="text-sm bg-muted px-1 py-0.5 rounded">
                      {schedule.cron_expression}
                    </code>
                    <div className="text-xs text-muted-foreground">{schedule.timezone}</div>
                  </TableCell>
                  <TableCell>
                    {schedule.status === 'enabled' ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" />
                        {formatNextRun(schedule.next_run_at)}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {schedule.last_run_at ? (
                      <div>
                        <div className="text-sm">{formatRelativeTime(schedule.last_run_at)}</div>
                        {getLastRunStatusBadge(schedule.last_run_status)}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Never</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{schedule.run_count}</span>
                  </TableCell>
                  <TableCell>{getStatusBadge(schedule.status)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => { void handleRunNow(schedule.id); }}
                          disabled={runningId === schedule.id}
                        >
                          {runningId === schedule.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4 mr-2" />
                          )}
                          Run Now
                        </DropdownMenuItem>
                        <DropdownMenuItem
                        onClick={() => { void handleToggleStatus(schedule); }}
                        disabled={togglingId === schedule.id}
                        >
                          {togglingId === schedule.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : schedule.status === 'enabled' ? (
                            <Pause className="h-4 w-4 mr-2" />
                          ) : (
                            <Play className="h-4 w-4 mr-2" />
                          )}
                          {schedule.status === 'enabled' ? 'Disable' : 'Enable'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => { void handleDelete(schedule.id); }}
                          disabled={deletingId === schedule.id}
                        >
                          {deletingId === schedule.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-2" />
                          )}
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
