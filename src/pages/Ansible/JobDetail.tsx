// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ansibleJobsApi,
  ansiblePlaybooksApi,
  ansibleInventoriesApi,
  type AnsibleJob,
  type AnsibleJobEvent,
  type AnsiblePlaybook,
  type AnsibleInventory,
} from '@/api/ansible';
import {
  getAnsibleJobFromJsonApi,
  getAnsiblePlaybookFromJsonApi,
  getAnsibleInventoryFromJsonApi,
  getAnsibleJobEventFromJsonApi,
} from '@/utils/ansible-jsonapi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  RefreshCw,
  XCircle,
  Loader2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Clock,
  Ban,
  Info,
  Server,
  FileCode,
  ChevronDown,
  ChevronUp,
  Cpu,
  HardDrive,
  Monitor,
  Copy,
  Check,
  LayoutGrid,
} from 'lucide-react';
import { RunView } from './run-viewer/RunView';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { HostStatusCount } from '@/components/ansible/HostStatus';
import { ANSIBLE_HOST_STATUSES, type HostStatus } from '@/components/ansible/hostStatus';

// Date formatting helpers
function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

/** The server's own page-size cap for events. */
const EVENTS_PAGE_SIZE = 500;
/**
 * Above this many events the history is fetched in the server's summary
 * projection - a fleet run's full events are megabytes of module output, and
 * the viewer only needs the full one the drawer is showing.
 */
const SUMMARY_ABOVE_EVENTS = 5000;

interface JobEventsData {
  events: AnsibleJobEvent[];
  /** Concatenated raw runner output; empty in summary mode, which omits stdout. */
  output: string;
  /** True when the events were fetched in the reduced projection. */
  summary: boolean;
  /** One fetch has run since the job reached a terminal status. */
  settled: boolean;
}

/** One host's line of the play recap (`v2_playbook_on_stats`). */
interface PlaybookStats {
  ok: number;
  changed: number;
  failures: number;
  skipped: number;
  unreachable: number;
  rescued: number;
  ignored: number;
}

/** The recap's per-host counters, read through the shared status vocabulary. */
function recapCount(stats: PlaybookStats | undefined, status: HostStatus): number {
  if (!stats) return 0;
  switch (status) {
    case 'ok':
      return stats.ok;
    case 'changed':
      return stats.changed;
    case 'failed':
      return stats.failures;
    case 'unreachable':
      return stats.unreachable;
    case 'skipped':
      return stats.skipped;
    case 'rescued':
      return stats.rescued;
    case 'ignored':
      return stats.ignored;
  }
}

export default function JobDetail() {
  const { orgName, jobId } = useParams<{ orgName: string; jobId: string }>();
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const [canceling, setCanceling] = useState(false);
  const [relaunching, setRelaunching] = useState(false);
  const [activeTab, setActiveTab] = useState('run');
  const [showWarnings, setShowWarnings] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorCopied, setErrorCopied] = useState(false);

  const isActive = (status?: string) => ['pending', 'running'].includes(status ?? '');

  // Fetch job details (job + playbook + inventory).
  // While the job is pending/running this refetches every 3s (React Query's
  // refetchInterval, not a hand-rolled setInterval); the playbook and inventory
  // are fetched once and carried forward, so a poll is a single request.
  const jobDetailQuery = useQuery({
    queryKey: ['jobDetail', jobId],
    queryFn: async () => {
      const cached = queryClient.getQueryData<{
        job: AnsibleJob;
        playbook: AnsiblePlaybook | null;
        inventory: AnsibleInventory | null;
      }>(['jobDetail', jobId]);

      const response = await ansibleJobsApi.get(jobId!);
      const jobData = getAnsibleJobFromJsonApi(response.data);

      let playbookData: AnsiblePlaybook | null =
        cached?.playbook && cached.playbook.id === jobData.playbook_id ? cached.playbook : null;
      if (jobData.playbook_id && !playbookData) {
        try {
          const playbookResponse = await ansiblePlaybooksApi.get(jobData.playbook_id);
          playbookData = getAnsiblePlaybookFromJsonApi(playbookResponse.data);
        } catch (err) {
          console.error('Failed to load playbook:', err);
        }
      }

      let inventoryData: AnsibleInventory | null =
        cached?.inventory && cached.inventory.id === jobData.inventory_id ? cached.inventory : null;
      if (jobData.inventory_id && !inventoryData) {
        try {
          const inventoryResponse = await ansibleInventoriesApi.get(jobData.inventory_id);
          inventoryData = getAnsibleInventoryFromJsonApi(inventoryResponse.data);
        } catch (err) {
          console.error('Failed to load inventory:', err);
        }
      }

      return { job: jobData, playbook: playbookData, inventory: inventoryData };
    },
    enabled: !!jobId,
    refetchInterval: (query) => (isActive(query.state.data?.job.status) ? 3000 : false),
  });

  // Fetch the full event history on initial load and derive the output from it.
  // Output is the concatenation of every event's stdout (identical to the
  // server's GetJobOutput), so deriving both the Events tab and the Output pane
  // from the one paginated event stream keeps them consistent and lets the
  // poll below append with `?after=<counter>` without any chance of drift or
  // duplication (a separate full-output endpoint would re-count lines the poll
  // also appends). Paginating also fixes the Events tab being capped at the
  // first 100 events for already-finished jobs.
  //
  // While the job runs, the 3s refetch appends only what is new: the query
  // function reads its own cached result and asks for `?after=<last counter>`,
  // so long runs stay cheap for the browser and the API. One extra fetch runs
  // after the job reaches a terminal status, to pick up events written between
  // the last poll and the status flip. The first event fetch waits for the job
  // status, which is what tells the query whether it needs to poll at all -
  // without it, opening an already-finished job would poll once for nothing.
  //
  // Past SUMMARY_ABOVE_EVENTS the history is fetched in the server's summary
  // projection instead: enough to draw the run, without the stdout and gathered
  // facts that make a fleet-sized job megabytes. The drawer then fetches the one
  // event it is showing in full (`filter[counter]`).
  const jobStatus = jobDetailQuery.data?.job.status;
  const jobRunning = isActive(jobStatus);
  const jobEventsQuery = useQuery({
    queryKey: ['jobEvents', jobId],
    queryFn: async () => {
      const cached = queryClient.getQueryData<JobEventsData>(['jobEvents', jobId]);

      if (cached && cached.events.length > 0) {
        const lastCounter = cached.events.reduce((max, e) => Math.max(max, e.counter), 0);
        const response = await ansibleJobsApi.getEvents(jobId!, { after: lastCounter, summary: cached.summary });
        const freshEvents = (response.data || []).map(getAnsibleJobEventFromJsonApi);
        if (freshEvents.length === 0) {
          return { ...cached, settled: !jobRunning };
        }
        return {
          ...cached,
          events: [...cached.events, ...freshEvents],
          output: cached.output + freshEvents.map((e) => e.stdout || '').join(''),
          settled: !jobRunning,
        };
      }

      // The first page doubles as the size probe: its `total-count` decides
      // whether the rest of the history is worth fetching in full. Only a job
      // over the threshold pays for the probe twice.
      const firstPage = await ansibleJobsApi.getEvents(jobId!, { page: 1, pageSize: EVENTS_PAGE_SIZE });
      const total = firstPage.meta?.pagination?.['total-count'] ?? firstPage.data?.length ?? 0;
      const totalPages = firstPage.meta?.pagination?.['total-pages'] ?? 1;
      const summary = total > SUMMARY_ABOVE_EVENTS;

      const resources = summary
        ? (await ansibleJobsApi.getEvents(jobId!, { page: 1, pageSize: EVENTS_PAGE_SIZE, summary: true })).data ?? []
        : firstPage.data ?? [];
      for (let page = 2; page <= totalPages; page++) {
        const response = await ansibleJobsApi.getEvents(jobId!, { page, pageSize: EVENTS_PAGE_SIZE, summary });
        resources.push(...(response.data ?? []));
      }

      const eventsData = resources.map(getAnsibleJobEventFromJsonApi);
      const outputData = eventsData.map((e) => e.stdout || '').join('');
      return { events: eventsData, output: outputData, summary, settled: !jobRunning };
    },
    enabled: !!jobId && jobStatus !== undefined,
    refetchInterval: (query) => (jobRunning || !query.state.data?.settled ? 3000 : false),
  });

  // A sliced launch is one run to the person who launched it and N jobs to the
  // database. When this job is a slice, its siblings' events are fetched too so
  // the Run tab can show the whole fleet; the merge lives in run-viewer/slices.
  const sliceGroupId = jobDetailQuery.data?.job.slice_group_id;
  const sliceProjectId = jobDetailQuery.data?.job.project_id;
  const siblingSlicesQuery = useQuery({
    queryKey: ['jobSlices', sliceGroupId],
    queryFn: async () => {
      const response = await ansibleJobsApi.listSliceGroup(sliceProjectId!, sliceGroupId!);
      const siblings = (response.data || []).map(getAnsibleJobFromJsonApi).filter((sibling) => sibling.id !== jobId);

      return Promise.all(
        siblings.map(async (sibling) => {
          // Siblings are always fetched in the summary projection: the merged
          // grid only needs their shape, and the drawer fetches the one event
          // it opens from whichever slice owns it.
          const events: AnsibleJobEvent[] = [];
          const first = await ansibleJobsApi.getEvents(sibling.id, { page: 1, pageSize: EVENTS_PAGE_SIZE, summary: true });
          events.push(...(first.data || []).map(getAnsibleJobEventFromJsonApi));
          const totalPages = first.meta?.pagination?.['total-pages'] ?? 1;
          for (let page = 2; page <= totalPages; page++) {
            const res = await ansibleJobsApi.getEvents(sibling.id, { page, pageSize: EVENTS_PAGE_SIZE, summary: true });
            events.push(...(res.data || []).map(getAnsibleJobEventFromJsonApi));
          }
          return { sliceNumber: sibling.slice_number ?? 0, jobId: sibling.id, events };
        }),
      );
    },
    enabled: !!sliceGroupId && !!sliceProjectId,
    staleTime: 30_000,
  });

  // Derive server data from query results
  const loading = jobDetailQuery.isLoading;
  const job = jobDetailQuery.data?.job ?? null;
  const playbook = jobDetailQuery.data?.playbook ?? null;
  const inventory = jobDetailQuery.data?.inventory ?? null;
  // Stable identity so the parsing below (and the run viewer's model) rebuild
  // only when events actually arrive.
  const events = useMemo(() => jobEventsQuery.data?.events ?? [], [jobEventsQuery.data]);
  const output = jobEventsQuery.data?.output ?? '';

  const handleCancel = async () => {
    if (!job) return;

    setCanceling(true);
    try {
      const response = await ansibleJobsApi.cancel(job.id);
      const canceledJob = getAnsibleJobFromJsonApi(response.data);
      queryClient.setQueryData(['jobDetail', jobId], (prev: typeof jobDetailQuery.data) => prev ? { ...prev, job: canceledJob } : prev);
      toast.success('Job canceled successfully');
    } catch (err) {
      console.error('Failed to cancel job:', err);
      toast.error('Failed to cancel job');
    } finally {
      setCanceling(false);
    }
  };

  const handleRelaunch = async () => {
    if (!job) return;

    setRelaunching(true);
    try {
      const response = await ansibleJobsApi.relaunch(job.id);
      const newJob = getAnsibleJobFromJsonApi(response.data);
      toast.success('Job relaunched successfully');
      void Promise.resolve(navigate(`/app/${orgName}/ansible/jobs/${newJob.id}`));
    } catch (err) {
      console.error('Failed to relaunch job:', err);
      toast.error('Failed to relaunch job');
    } finally {
      setRelaunching(false);
    }
  };

  // Parse individual warnings from text
  const parseWarnings = (text: string): { type: 'warning' | 'deprecation'; message: string }[] => {
    const result: { type: 'warning' | 'deprecation'; message: string }[] = [];
    // Match both [WARNING] and [DEPRECATION WARNING] blocks
    const regex = /\[(DEPRECATION )?WARNING\]:\s*([^[\]]+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      result.push({
        type: match[1] ? 'deprecation' : 'warning',
        message: match[2].trim().replace(/\s+/g, ' ')
      });
    }
    return result;
  };

  // Interface for host facts extracted from Gathering Facts
  interface HostFacts {
    hostname: string;
    os: string;
    osVersion: string;
    distribution: string;
    kernel: string;
    architecture: string;
    processor: string;
    processorCores: number;
    memoryTotalMb: number;
    memoryFreeMb: number;
    interfaces: { name: string; ipv4Addresses: string[] }[];
    mounts: { device: string; mount: string; fstype: string; size_total?: number }[];
    uptime?: number;
    virtualization?: string;
    rawFacts?: Record<string, unknown>;
  }

  // Warnings, host facts and the play recap: everything the Details and Host
  // Facts tabs need. The Run tab derives its own model from the same events
  // (see run-viewer/adapter.ts), which is what carries the per-task results.
  const { parsedWarnings, hostFacts, playbookStats } = useMemo(() => {
    const allWarnings: { type: 'warning' | 'deprecation'; message: string }[] = [];
    const hostFactsMap = new Map<string, HostFacts>();
    const statsMap = new Map<string, PlaybookStats>();

    for (const event of events) {
      // Check both stderr and stdout for warnings
      const stderrWarnings = event.stderr ? parseWarnings(event.stderr) : [];
      const stdoutWarnings = event.stdout ? parseWarnings(event.stdout) : [];

      if (stderrWarnings.length > 0 || stdoutWarnings.length > 0) {
        allWarnings.push(...stderrWarnings, ...stdoutWarnings);
      } else {
        // Extract hosts from event_data.hosts (JSONL format)
        const eventHosts = event.event_data?.hosts as Record<string, Record<string, unknown>> | undefined;
        const eventType = event.event_data?._event as string | undefined;
        
        // Extract playbook stats from v2_playbook_on_stats event
        // Note: stats are in event_data.stats, not event_data.hosts!
        if (eventType === 'v2_playbook_on_stats') {
          const eventStats = event.event_data?.stats as Record<string, Record<string, unknown>> | undefined;
          if (eventStats) {
            for (const [hostname, hostResult] of Object.entries(eventStats)) {
              statsMap.set(hostname, {
                ok: Number(hostResult.ok) || 0,
                changed: Number(hostResult.changed) || 0,
                failures: Number(hostResult.failures) || 0,
                skipped: Number(hostResult.skipped) || 0,
                unreachable: Number(hostResult.unreachable) || 0,
                rescued: Number(hostResult.rescued) || 0,
                ignored: Number(hostResult.ignored) || 0
              });
            }
          }
        }
        
        // Extract ansible_facts from Gathering Facts task (v2_runner_on_ok)
        if (event.task === 'Gathering Facts' && eventHosts) {
          for (const [hostname, hostResult] of Object.entries(eventHosts)) {
            const facts = (hostResult)?.ansible_facts as Record<string, unknown> | undefined;
            if (facts) {
              const interfaces: { name: string; ipv4Addresses: string[] }[] = [];
              const allIpsFromFacts: string[] = [];
              
              // First, collect all IP addresses from ansible_all_ipv4_addresses
              if (facts.ansible_all_ipv4_addresses && Array.isArray(facts.ansible_all_ipv4_addresses)) {
                for (const addr of facts.ansible_all_ipv4_addresses) {
                  const addrStr = String(addr);
                  if (addrStr && !allIpsFromFacts.includes(addrStr)) {
                    allIpsFromFacts.push(addrStr);
                  }
                }
              }
              
              // Also get default IPv4 address
              const defaultIpv4 = facts.ansible_default_ipv4 as { address?: string } | undefined;
              if (defaultIpv4?.address && !allIpsFromFacts.includes(defaultIpv4.address)) {
                allIpsFromFacts.push(defaultIpv4.address);
              }
              
              // Extract interfaces and try to map IPs to them
              if (facts.ansible_interfaces && Array.isArray(facts.ansible_interfaces)) {
                const interfaceNames = facts.ansible_interfaces as string[];
                for (const ifaceName of interfaceNames) {
                  const ifaceKey = `ansible_${ifaceName}`;
                  const ifaceData = facts[ifaceKey] as Record<string, unknown> | undefined;
                  const ipv4Addresses: string[] = [];
                  
                  // Extract IPv4 addresses from this interface
                  // Try different possible structures
                  if (ifaceData) {
                    // Structure 1: ipv4 is an array of objects with address property
                    if (ifaceData.ipv4 && Array.isArray(ifaceData.ipv4)) {
                      for (const ipv4 of ifaceData.ipv4 as Array<{ address?: string }>) {
                        if (ipv4.address) {
                          ipv4Addresses.push(ipv4.address);
                        }
                      }
                    }
                    
                    // Structure 2: ipv4_addresses is an array of strings
                    if (ifaceData.ipv4_addresses && Array.isArray(ifaceData.ipv4_addresses)) {
                      for (const addr of ifaceData.ipv4_addresses as string[]) {
                        if (addr && !ipv4Addresses.includes(addr)) {
                          ipv4Addresses.push(addr);
                        }
                      }
                    }
                    
                    // Structure 3: ipv4 is an object with address property
                    if (ifaceData.ipv4 && !Array.isArray(ifaceData.ipv4)) {
                      const ipv4Obj = ifaceData.ipv4 as { address?: string };
                      if (ipv4Obj?.address) {
                        ipv4Addresses.push(ipv4Obj.address);
                      }
                    }
                  }
                  
                  interfaces.push({
                    name: ifaceName,
                    ipv4Addresses
                  });
                }
              }
              
              // If we have IPs but no interfaces, or if interfaces don't have IPs, 
              // add IPs that weren't assigned to any interface
              if (allIpsFromFacts.length > 0) {
                const assignedIps = new Set<string>();
                interfaces.forEach(iface => {
                  iface.ipv4Addresses.forEach(ip => assignedIps.add(ip));
                });
                
                const unassignedIps = allIpsFromFacts.filter(ip => !assignedIps.has(ip));
                if (unassignedIps.length > 0) {
                  // Add unassigned IPs to the first interface that has no IPs, or create a new entry
                  const interfaceWithoutIp = interfaces.find(iface => iface.ipv4Addresses.length === 0);
                  if (interfaceWithoutIp) {
                    interfaceWithoutIp.ipv4Addresses.push(...unassignedIps);
                  } else {
                    interfaces.push({
                      name: 'unknown',
                      ipv4Addresses: unassignedIps
                    });
                  }
                }
              }
              
              // If we still have no interfaces but have IPs, create a generic entry
              if (interfaces.length === 0 && allIpsFromFacts.length > 0) {
                interfaces.push({
                  name: 'unknown',
                  ipv4Addresses: allIpsFromFacts
                });
              }
              
              // Extract mount information
              const mounts: { device: string; mount: string; fstype: string; size_total?: number }[] = [];
              if (facts.ansible_mounts && Array.isArray(facts.ansible_mounts)) {
                for (const mount of facts.ansible_mounts) {
                  const mountData = mount as Record<string, unknown>;
                  mounts.push({
                    device: (mountData.device as string) || 'unknown',
                    mount: (mountData.mount as string) || '/',
                    fstype: (mountData.fstype as string) || 'unknown',
                    size_total: mountData.size_total as number | undefined
                  });
                }
              }
              
              const memoryMb = facts.ansible_memory_mb as { real?: { free?: number } } | undefined;
              hostFactsMap.set(hostname, {
                hostname,
                os: (facts.ansible_system as string | undefined) || (facts.ansible_os_family as string | undefined) || 'Unknown',
                osVersion: (facts.ansible_distribution_version as string | undefined) || '',
                distribution: (facts.ansible_distribution as string | undefined) || (facts.ansible_os_family as string | undefined) || 'Unknown',
                kernel: (facts.ansible_kernel as string | undefined) || '',
                architecture: (facts.ansible_architecture as string | undefined) || (facts.ansible_machine as string | undefined) || '',
                processor: facts.ansible_processor ? 
                  (Array.isArray(facts.ansible_processor) ? (facts.ansible_processor as unknown[])[2] || (facts.ansible_processor as unknown[])[0] : facts.ansible_processor) as string
                  : '',
                processorCores: (facts.ansible_processor_vcpus as number | undefined) || (facts.ansible_processor_cores as number | undefined) || 0,
                memoryTotalMb: (facts.ansible_memtotal_mb as number | undefined) || 0,
                // Use memory_mb.real.free (available memory including buffers/cache) if available,
                // otherwise fall back to memfree_mb (actual free, often very low due to caching)
                memoryFreeMb: memoryMb?.real?.free || (facts.ansible_memfree_mb as number | undefined) || 0,
                interfaces,
                mounts,
                uptime: facts.ansible_uptime_seconds as number | undefined,
                virtualization: facts.ansible_virtualization_type as string | undefined,
                rawFacts: facts
              });
            }
          }
        }
        
      }
    }

    // Deduplicate warnings by message
    const uniqueWarnings = allWarnings.filter((w, i, arr) =>
      arr.findIndex(x => x.message === w.message) === i
    );

    return {
      parsedWarnings: uniqueWarnings,
      hostFacts: hostFactsMap,
      playbookStats: statsMap
    };
  }, [events]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'successful':
        return <CheckCircle className="h-4 w-4" />;
      case 'failed':
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      case 'canceled':
        return <Ban className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'running':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'successful':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'failed':
      case 'error':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'canceled':
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const formatDuration = (startedAt?: string, finishedAt?: string) => {
    if (!startedAt) return '-';
    const start = new Date(startedAt);
    const end = finishedAt ? new Date(finishedAt) : new Date();
    const durationMs = end.getTime() - start.getTime();
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const handleCopyOutput = async () => {
    if (!output) {
      toast.error('No output to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      toast.success('Output copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy output:', err);
      toast.error('Failed to copy output');
    }
  };

  const handleCopyError = async () => {
    if (!job?.error_message) {
      toast.error('No error message to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(job.error_message);
      setErrorCopied(true);
      toast.success('Error message copied to clipboard');
      setTimeout(() => setErrorCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy error message:', err);
      toast.error('Failed to copy error message');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Job not found</h2>
        <p className="text-muted-foreground mb-4">
          The job you're looking for doesn't exist or has been deleted.
        </p>
        <Button onClick={() => { void navigate(`/app/${orgName}/ansible/jobs`); }}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Jobs
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compact Header Bar */}
      <div className="flex items-center justify-between bg-card border rounded-lg px-4 py-3">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to jobs"
            className="h-8 w-8"
            onClick={() => { void navigate(`/app/${orgName}/ansible/jobs`); }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">
              {job.name || `Job ${job.id.slice(0, 8)}`}
            </h1>
            <Badge
              variant="outline"
              className={cn("capitalize", getStatusColor(job.status))}
            >
              {getStatusIcon(job.status)}
              <span className="ml-1">{job.status}</span>
            </Badge>
          </div>
          
          <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground border-l pl-4">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatDuration(job.started_at, job.finished_at)}</span>
            </div>
            {playbook && (
              <button 
                onClick={() => { void navigate(`/app/${orgName}/ansible/playbooks/${playbook.id}`); }}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <FileCode className="h-3.5 w-3.5" />
                <span className="truncate max-w-[150px] underline-offset-2 hover:underline">{playbook.name}</span>
              </button>
            )}
            {!playbook && (
              <div className="flex items-center gap-1.5">
                <FileCode className="h-3.5 w-3.5" />
                <span className="truncate max-w-[150px]">Unknown</span>
              </div>
            )}
            {inventory && (
              <button 
                onClick={() => { void navigate(`/app/${orgName}/ansible/inventories/${inventory.id}`); }}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <Server className="h-3.5 w-3.5" />
                <span className="truncate max-w-[120px] underline-offset-2 hover:underline">{inventory.name}</span>
              </button>
            )}
            {!inventory && (
              <div className="flex items-center gap-1.5">
                <Server className="h-3.5 w-3.5" />
                <span className="truncate max-w-[120px]">Unknown</span>
              </div>
            )}
            {/* Self-hosted runner info */}
            {(job.agent_pool_name || job.runner_name) && (
              <div className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400">
                <Cpu className="h-3.5 w-3.5" />
                <span className="truncate max-w-[150px]">
                  {job.runner_name ? (
                    <>
                      {job.runner_name}
                      {job.agent_pool_name && <span className="text-muted-foreground ml-1">({job.agent_pool_name})</span>}
                    </>
                  ) : (
                    job.agent_pool_name
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {['pending', 'running'].includes(job.status) && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { void handleCancel(); }}
              disabled={canceling}
            >
              {canceling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span className="ml-1.5 hidden sm:inline">Cancel</span>
            </Button>
          )}
          {['successful', 'failed', 'canceled', 'error'].includes(job.status) && (
            <Button size="sm" onClick={() => { void handleRelaunch(); }} disabled={relaunching}>
              {relaunching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-1.5 hidden sm:inline">Relaunch</span>
            </Button>
          )}
        </div>
      </div>

      {/* Failure banner - the job's own error, not any host's */}
      {['failed', 'error'].includes(job.status) && job.error_message && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-red-700 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-medium">Job failed: </span>
            <span className="opacity-90">{job.error_message}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-red-600 hover:bg-red-200/50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/50 dark:hover:text-red-300"
            onClick={() => { void handleCopyError(); }}
            aria-label="Copy error message to clipboard"
            title="Copy error message to clipboard"
          >
            {errorCopied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      )}

      {/* Warnings Banner (collapsible) */}
      {parsedWarnings.length > 0 && (
        <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowWarnings(!showWarnings)}
            className="w-full flex items-center justify-between px-4 py-2 hover:bg-yellow-500/10 transition-colors"
          >
            <div className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium text-sm">
                {parsedWarnings.length} Warning{parsedWarnings.length > 1 ? 's' : ''} / Deprecation{parsedWarnings.length > 1 ? 's' : ''}
              </span>
            </div>
            {showWarnings ? <ChevronUp className="h-4 w-4 text-yellow-600" /> : <ChevronDown className="h-4 w-4 text-yellow-600" />}
          </button>
          {showWarnings && (
            <div className="border-t border-yellow-500/20 px-2 py-2 max-h-48 overflow-y-auto space-y-1">
              {parsedWarnings.map((warning, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-start gap-2 px-2 py-1.5 rounded-sm text-xs ${
                    warning.type === 'deprecation' 
                      ? 'bg-orange-500/10 border border-orange-500/20' 
                      : 'bg-yellow-500/10 border border-yellow-500/20'
                  }`}
                >
                  <span className={`shrink-0 px-1.5 py-0.5 rounded-sm text-[10px] font-medium uppercase ${
                    warning.type === 'deprecation' 
                      ? 'bg-orange-500/20 text-orange-600' 
                      : 'bg-yellow-500/20 text-yellow-600'
                  }`}>
                    {warning.type === 'deprecation' ? 'DEPRECATED' : 'WARNING'}
                  </span>
                  <span className="text-foreground/80">{warning.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Content - Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="run" className="flex items-center gap-1.5">
              <LayoutGrid className="h-4 w-4" />
              Run
              {['pending', 'running'].includes(job.status) && (
                <Loader2 className="h-3 w-3 animate-spin ml-1" />
              )}
            </TabsTrigger>
            <TabsTrigger value="details" className="flex items-center gap-1.5">
              <Info className="h-4 w-4" />
              Details
            </TabsTrigger>
            {hostFacts.size > 0 && (
              <TabsTrigger value="hostfacts" className="flex items-center gap-1.5">
                <Monitor className="h-4 w-4" />
                Host Facts
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="run" className="mt-3">
          <RunView
            events={events}
            siblingSlices={siblingSlicesQuery.data}
            thisSliceNumber={job.slice_number}
            jobId={job.id}
            summaryMode={jobEventsQuery.data?.summary ?? false}
            jobStatus={job.status}
            isLoading={jobEventsQuery.isPending}
            isError={jobEventsQuery.isError}
            onRetry={() => { void jobEventsQuery.refetch(); }}
            rawOutput={output}
            onCopyOutput={() => { void handleCopyOutput(); }}
            outputCopied={copied}
          />
        </TabsContent>

        <TabsContent value="details" className="mt-3">
          <Card>
            <CardContent className="p-4">
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Job ID</dt>
                  <dd className="font-mono text-xs mt-0.5">{job.id}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Created</dt>
                  <dd className="mt-0.5">{formatDateTime(job.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Started</dt>
                  <dd className="mt-0.5">{job.started_at ? formatDateTime(job.started_at) : '-'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Finished</dt>
                  <dd className="mt-0.5">{job.finished_at ? formatDateTime(job.finished_at) : '-'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Playbook</dt>
                  <dd className="mt-0.5">
                    {playbook ? (
                      <button 
                        onClick={() => { void navigate(`/app/${orgName}/ansible/playbooks/${playbook.id}`); }}
                        className="text-primary hover:underline"
                      >
                        {playbook.name}
                      </button>
                    ) : '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Inventory</dt>
                  <dd className="mt-0.5">
                    {inventory ? (
                      <button 
                        onClick={() => { void navigate(`/app/${orgName}/ansible/inventories/${inventory.id}`); }}
                        className="text-primary hover:underline"
                      >
                        {inventory.name}
                      </button>
                    ) : '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Verbosity</dt>
                  <dd className="mt-0.5">{job.verbosity}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Forks</dt>
                  <dd className="mt-0.5">{job.forks}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Become</dt>
                  <dd className="mt-0.5">
                    {job.become ? `Yes (${job.become_user || 'root'})` : 'No'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Agent Pool</dt>
                  <dd className="mt-0.5">
                    {job.agent_pool_name ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Cpu className="h-3.5 w-3.5 text-teal-500" />
                        {job.agent_pool_name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">Default (server-side)</span>
                    )}
                  </dd>
                </div>
                {job.runner_name && (
                  <div>
                    <dt className="text-muted-foreground">Runner</dt>
                    <dd className="mt-0.5">
                      <span className="inline-flex items-center gap-1.5">
                        <Server className="h-3.5 w-3.5 text-blue-500" />
                        {job.runner_name}
                      </span>
                    </dd>
                  </div>
                )}
                {job.limit && (
                  <div>
                    <dt className="text-muted-foreground">Limit</dt>
                    <dd className="font-mono text-xs mt-0.5">{job.limit}</dd>
                  </div>
                )}
                {job.tags && (
                  <div>
                    <dt className="text-muted-foreground">Tags</dt>
                    <dd className="font-mono text-xs mt-0.5">{job.tags}</dd>
                  </div>
                )}
                {job.skip_tags && (
                  <div>
                    <dt className="text-muted-foreground">Skip Tags</dt>
                    <dd className="font-mono text-xs mt-0.5">{job.skip_tags}</dd>
                  </div>
                )}
              </dl>
              
              {job.extra_vars && Object.keys(job.extra_vars).length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <dt className="text-sm text-muted-foreground mb-2">Extra Variables</dt>
                  <pre className="text-xs font-mono p-3 bg-muted rounded-lg overflow-auto max-h-48">
                    {JSON.stringify(job.extra_vars, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Host Facts Tab - Shows system information gathered from each host */}
        <TabsContent value="hostfacts" className="mt-3">
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from(hostFacts.values()).map((facts) => (
              <Card key={facts.hostname} className="overflow-hidden">
                <div className="bg-muted/50 border-b px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{facts.hostname}</span>
                  </div>
                  {playbookStats.has(facts.hostname) && (
                    <div className="flex items-center gap-3 text-xs">
                      {ANSIBLE_HOST_STATUSES.map((status) => (
                        <HostStatusCount
                          key={status}
                          status={status}
                          count={recapCount(playbookStats.get(facts.hostname), status)}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <CardContent className="p-4 space-y-4">
                  {/* OS Information */}
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Operating System</h4>
                    <div className="flex items-center gap-2 text-sm">
                      <Monitor className="h-4 w-4 text-blue-500 shrink-0" />
                      <div>
                        <span className="font-medium">{facts.distribution} {facts.osVersion}</span>
                        <span className="text-muted-foreground text-xs ml-2">
                          {facts.kernel} ({facts.architecture})
                        </span>
                      </div>
                    </div>
                    {facts.virtualization && (
                      <Badge variant="outline" className="mt-2 text-xs">
                        {facts.virtualization}
                      </Badge>
                    )}
                  </div>

                  {/* Hardware - CPU & Memory in a cleaner grid */}
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Hardware</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-purple-500 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium text-sm">{facts.processorCores} vCPUs</div>
                          {facts.processor && (
                            <div className="text-xs text-muted-foreground truncate" title={facts.processor}>
                              {facts.processor}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4 text-orange-500 shrink-0" />
                        <div>
                          <div className="font-medium text-sm">{Math.round(facts.memoryTotalMb / 1024 * 10) / 10} GB RAM</div>
                          {facts.memoryFreeMb > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {Math.round(facts.memoryFreeMb / 1024 * 10) / 10} GB free
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Networks - Interfaces with their IP addresses */}
                  {facts.interfaces.filter(iface => iface.name !== 'lo').length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Networks</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {facts.interfaces
                          .filter(iface => iface.name !== 'lo')
                          .map((iface) => {
                            if (iface.ipv4Addresses.length > 0) {
                              // Show each IP as a separate badge with interface name
                              return iface.ipv4Addresses.map((ip) => (
                                <Badge key={`${iface.name}-${ip}`} variant="secondary" className="font-mono text-xs px-2 py-1">
                                  <span className="text-muted-foreground">{iface.name}</span>
                                  <span className="mx-1.5">:</span>
                                  <span>{ip}</span>
                                </Badge>
                              ));
                            } else {
                              // Interface without IP
                              return (
                                <Badge key={iface.name} variant="outline" className="font-mono text-xs text-muted-foreground px-2 py-1">
                                  {iface.name}
                                </Badge>
                              );
                            }
                          })}
                      </div>
                    </div>
                  )}

                  {/* Storage - Show all mounts in a clean table */}
                  {facts.mounts.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Storage</h4>
                      <details className="text-xs" open={facts.mounts.filter(m => m.size_total && m.size_total > 1024 * 1024 * 1024).length <= 3}>
                        <summary className="text-muted-foreground cursor-pointer hover:text-foreground mb-1">
                          {facts.mounts.length} mount{facts.mounts.length !== 1 ? 's' : ''}
                        </summary>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {facts.mounts
                            .filter(m => m.size_total && m.size_total > 100 * 1024 * 1024) // > 100MB
                            .sort((a, b) => (b.size_total || 0) - (a.size_total || 0))
                            .map((mount) => (
                              <div key={mount.mount} className="flex items-center justify-between text-xs py-0.5">
                                <span className="font-mono text-muted-foreground truncate max-w-[60%]" title={mount.mount}>
                                  {mount.mount}
                                </span>
                                <span className="text-right shrink-0">
                                  {mount.size_total ? `${Math.round(mount.size_total / 1024 / 1024 / 1024)} GB` : ''} 
                                  <span className="text-muted-foreground ml-1">{mount.fstype}</span>
                                </span>
                              </div>
                            ))}
                        </div>
                      </details>
                    </div>
                  )}

                  {/* Uptime */}
                  {facts.uptime && (
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      Uptime: {Math.floor(facts.uptime / 86400)}d {Math.floor((facts.uptime % 86400) / 3600)}h {Math.floor((facts.uptime % 3600) / 60)}m
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          {hostFacts.size === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Monitor className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No host facts available.</p>
                <p className="text-xs mt-1">Facts are collected during the "Gathering Facts" task.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
