// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// @ts-nocheck
// eslint-disable-next-line no-restricted-imports -- polling + auto-scroll DOM effects
import React, { useEffect, useState, useRef, useMemo } from 'react';
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
import { JsonSyntaxHighlighter } from '@/components/code/JsonSyntaxHighlighter';
import {
  getAnsibleJobFromJsonApi,
  getAnsiblePlaybookFromJsonApi,
  getAnsibleInventoryFromJsonApi,
  getAnsibleJobEventFromJsonApi,
} from '@/utils/ansible-jsonapi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Terminal,
  ListTree,
  Info,
  Server,
  FileCode,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Cpu,
  HardDrive,
  Monitor,
  WifiOff,
  CircleDot,
  EyeOff,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { fetchAllPages } from '@/lib/pagination';

// Date formatting helpers
function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Strip ANSI escape codes from terminal output
// ANSI escape codes are used for terminal formatting (colors, bold, etc.)
// Pattern matches: \x1b[ followed by numbers/semicolons and ending with 'm'
function stripAnsiCodes(text: string): string {
  if (!text) return text;
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

export default function JobDetail() {
  const { orgName, jobId } = useParams<{ orgName: string; jobId: string }>();
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const [canceling, setCanceling] = useState(false);
  const [relaunching, setRelaunching] = useState(false);
  const [activeTab, setActiveTab] = useState('output');
  const outputRef = useRef<HTMLDivElement>(null);

  // Search and filter state
  const [outputSearch, setOutputSearch] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showWarnings, setShowWarnings] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorCopied, setErrorCopied] = useState(false);

  // Fetch job details (job + playbook + inventory)
  const jobDetailQuery = useQuery({
    queryKey: ['jobDetail', jobId],
    queryFn: async () => {
      const response = await ansibleJobsApi.get(jobId!);
      const jobData = getAnsibleJobFromJsonApi(response.data);

      let playbookData: AnsiblePlaybook | null = null;
      if (jobData.playbook_id) {
        try {
          const playbookResponse = await ansiblePlaybooksApi.get(jobData.playbook_id);
          playbookData = getAnsiblePlaybookFromJsonApi(playbookResponse.data);
        } catch (err) {
          console.error('Failed to load playbook:', err);
        }
      }

      let inventoryData: AnsibleInventory | null = null;
      if (jobData.inventory_id) {
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
  });

  // Fetch the full event history on initial load and derive the output from it.
  // Output is the concatenation of every event's stdout (identical to the
  // server's GetJobOutput), so deriving both the Events tab and the Output pane
  // from the one paginated event stream keeps them consistent and lets the
  // poll below append with `?after=<counter>` without any chance of drift or
  // duplication (a separate full-output endpoint would re-count lines the poll
  // also appends). Paginating also fixes the Events tab being capped at the
  // first 100 events for already-finished jobs.
  const jobEventsQuery = useQuery({
    queryKey: ['jobEvents', jobId],
    queryFn: async () => {
      const { items } = await fetchAllPages((page, pageSize) =>
        ansibleJobsApi.getEvents(jobId!, { page, pageSize })
      );
      const eventsData = items.map(getAnsibleJobEventFromJsonApi);
      const outputData = eventsData.map((e) => e.stdout || '').join('');
      return { events: eventsData, output: outputData };
    },
    enabled: !!jobId,
  });

  // Derive server data from query results
  const loading = jobDetailQuery.isLoading;
  const job = jobDetailQuery.data?.job ?? null;
  const playbook = jobDetailQuery.data?.playbook ?? null;
  const inventory = jobDetailQuery.data?.inventory ?? null;
  const events = jobEventsQuery.data?.events ?? [];
  const output = jobEventsQuery.data?.output ?? '';

  // Poll for updates if job is running
  useEffect(() => {
    if (!job || !['pending', 'running'].includes(job.status)) return;

    const interval = setInterval(() => {
      void (async () => {
        try {
          const response = await ansibleJobsApi.get(job.id);
          const updatedJob = getAnsibleJobFromJsonApi(response.data);

          // Update job in the jobDetail query cache
          queryClient.setQueryData(['jobDetail', jobId], (prev: typeof jobDetailQuery.data) => prev ? { ...prev, job: updatedJob } : prev);

          // Incremental live updates: fetch only events newer than the last
          // counter we have and APPEND them (events and their stdout), instead
          // of re-downloading the whole history every poll — keeps long runs
          // cheap for both the browser and the API.
          const cached = queryClient.getQueryData<typeof jobEventsQuery.data>(['jobEvents', jobId]);
          const lastCounter = cached?.events.length
            ? Math.max(...cached.events.map((e) => e.counter))
            : 0;
          const eventsRes = await ansibleJobsApi.getEvents(job.id, { after: lastCounter });
          const freshEvents = (eventsRes.data || []).map(getAnsibleJobEventFromJsonApi);
          if (freshEvents.length > 0) {
            const freshOutput = freshEvents.map((e) => e.stdout || '').join('');
            queryClient.setQueryData(['jobEvents', jobId], (prev: typeof jobEventsQuery.data) => {
              if (!prev) return { events: freshEvents, output: freshOutput };
              return {
                events: [...prev.events, ...freshEvents],
                output: prev.output + freshOutput,
              };
            });
          }

          // When job completes, stop polling
          if (!['pending', 'running'].includes(updatedJob.status)) {
            clearInterval(interval);
          }
        } catch (err) {
          console.error('Failed to poll job status:', err);
        }
      })();
    }, 3000);

    return () => clearInterval(interval);
    // job object is intentionally omitted to avoid recreating interval on every job update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.status]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current && job?.status === 'running') {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, job?.status]);

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

  // Interface for grouped task events
  interface GroupedTask {
    task: string;
    play: string;
    hosts: {
      host: string;
      status: 'ok' | 'changed' | 'failed' | 'skipped' | 'unreachable';
      stdout?: string;
      stderr?: string;
      event: AnsibleJobEvent;
    }[];
    timestamp: string;
    aggregateStatus: 'ok' | 'changed' | 'failed' | 'unreachable' | 'skipped';
  }

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

  // Interface for playbook stats (v2_playbook_on_stats)
  interface PlaybookStats {
    ok: number;
    changed: number;
    failures: number;
    skipped: number;
    unreachable: number;
    rescued: number;
    ignored: number;
  }

  // Separate warnings/deprecations from regular events and extract unique hosts
  const { parsedWarnings, groupedTasks, hostFacts, playbookStats } = useMemo(() => {
    const allWarnings: { type: 'warning' | 'deprecation'; message: string }[] = [];
    const regularEvents: AnsibleJobEvent[] = [];
    const hostsSet = new Set<string>();
    const taskMap = new Map<string, GroupedTask>();
    const hostFactsMap = new Map<string, HostFacts>();
    const statsMap = new Map<string, PlaybookStats>();
    
    for (const event of events) {
      // Check both stderr and stdout for warnings
      const stderrWarnings = event.stderr ? parseWarnings(event.stderr) : [];
      const stdoutWarnings = event.stdout ? parseWarnings(event.stdout) : [];
      
      if (stderrWarnings.length > 0 || stdoutWarnings.length > 0) {
        allWarnings.push(...stderrWarnings, ...stdoutWarnings);
      } else {
        regularEvents.push(event);
        
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
        
        // Only process task-related events (v2_runner_on_ok, v2_runner_on_failed, etc.)
        if (!event.task || !eventType?.includes('runner_on')) {
          continue;
        }
        
        const taskKey = `${event.play || ''}::${event.task}`;
        
        if (!taskMap.has(taskKey)) {
          taskMap.set(taskKey, {
            task: event.task,
            play: event.play || '',
            hosts: [],
            timestamp: event.created_at,
            aggregateStatus: 'ok'
          });
        }
        
        const group = taskMap.get(taskKey)!;
        
        // If we have hosts data in event_data, extract per-host details
        if (eventHosts && Object.keys(eventHosts).length > 0) {
          for (const [hostname, hostResult] of Object.entries(eventHosts)) {
            hostsSet.add(hostname);
            
            // Determine status from host result
            const failed = hostResult.failed === true || eventType?.includes('failed');
            const unreachable = hostResult.unreachable === true || eventType?.includes('unreachable');
            const skipped = hostResult.skipped === true || eventType?.includes('skipped');
            const changed = hostResult.changed === true;
            
            const status: 'ok' | 'changed' | 'failed' | 'skipped' | 'unreachable' = 
              failed ? 'failed' 
              : unreachable ? 'unreachable'
              : skipped ? 'skipped'
              : changed ? 'changed'
              : 'ok';
            
            // Extract output from host result
            let stdout = '';
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            if (hostResult.stdout) stdout = stripAnsiCodes(String(hostResult.stdout));
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            else if (hostResult.msg) stdout = stripAnsiCodes(String(hostResult.msg));
            else if (hostResult.stdout_lines && Array.isArray(hostResult.stdout_lines)) {
              stdout = stripAnsiCodes((hostResult.stdout_lines as string[]).join('\n'));
            }
            
            // For debug tasks, show the msg
            if (hostResult.action === 'ansible.builtin.debug' && hostResult.msg) {
              // eslint-disable-next-line @typescript-eslint/no-base-to-string
              stdout = stripAnsiCodes(String(hostResult.msg));
            }
            
            // Check if host already in group (avoid duplicates from task_start + runner_on events)
            const existingHost = group.hosts.find(h => h.host === hostname);
            if (!existingHost) {
            group.hosts.push({
              host: hostname,
              status,
              stdout,
              // eslint-disable-next-line @typescript-eslint/no-base-to-string
              stderr: hostResult.stderr ? stripAnsiCodes(String(hostResult.stderr)) : undefined,
              event
            });
            } else if (stdout && !existingHost.stdout) {
              // Update existing host entry with output if we didn't have it before
              existingHost.stdout = stdout;
              existingHost.status = status;
            }
            
            // Update aggregate status (failed > unreachable > changed > skipped > ok)
            const statusPriority = { failed: 5, unreachable: 4, changed: 3, skipped: 2, ok: 1 };
            if (statusPriority[status] > statusPriority[group.aggregateStatus]) {
              group.aggregateStatus = status;
            }
          }
        } else if (event.host) {
          // Fallback: use event.host if no hosts in event_data
          hostsSet.add(event.host);
          const status: 'ok' | 'changed' | 'failed' | 'skipped' | 'unreachable' = 
            event.failed ? 'failed' 
            : event.skipped ? 'skipped'
            : event.changed ? 'changed'
            : 'ok';
          
          if (!group.hosts.find(h => h.host === event.host)) {
            group.hosts.push({
              host: event.host,
              status,
              stdout: event.event_data?._parsed_output ? stripAnsiCodes(event.event_data._parsed_output as string) : '',
              stderr: event.stderr ? stripAnsiCodes(event.stderr) : undefined,
              event
            });
          }
        }
      }
    }
    
    // Deduplicate warnings by message
    const uniqueWarnings = allWarnings.filter((w, i, arr) => 
      arr.findIndex(x => x.message === w.message) === i
    );
    
    // Convert task map to array ordered by first event timestamp
    const groupedTasks: GroupedTask[] = Array.from(taskMap.values());
    
    return { 
      parsedWarnings: uniqueWarnings, 
      groupedTasks,
      hostFacts: hostFactsMap,
      playbookStats: statsMap
    };
  }, [events]);

  // Parse output - JSONL format (one JSON object per line)
  // Combine all JSON objects into a single continuous display
  const parsedOutput = useMemo(() => {
    if (!output) return { jsonContent: null, hasPlainText: false };
    
    const jsonObjects: string[] = [];
    const plainLines: string[] = [];
    const allLines = output.split('\n');
    
    for (const line of allLines) {
      const trimmed = line.trim();
      if (!trimmed) {
        // Skip empty lines
        continue;
      }
      
      try {
        // Try to parse as JSON (JSONL format - one JSON object per line)
        const parsed = JSON.parse(trimmed) as unknown;
        // Format nicely with 2-space indent
        const formatted = JSON.stringify(parsed, null, 2);
        jsonObjects.push(formatted);
      } catch {
        // Not JSON, add as plain text (strip ANSI codes)
        plainLines.push(stripAnsiCodes(line));
      }
    }
    
    // Combine all JSON objects into one continuous string
    const jsonContent = jsonObjects.length > 0 ? jsonObjects.join('\n\n') : null;
    
    return {
      jsonContent,
      plainLines: plainLines.length > 0 ? plainLines : null,
      hasPlainText: plainLines.length > 0
    };
  }, [output]);

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

      {/* Compact Stats Bar (only for completed jobs) */}
      {['successful', 'failed'].includes(job.status) && (() => {
        // Aggregate stats from playbookStats (v2_playbook_on_stats) or fall back to job fields
        const aggregatedStats = Array.from(playbookStats.values()).reduce(
          (acc, stats) => ({
            ok: acc.ok + stats.ok,
            changed: acc.changed + stats.changed,
            failures: acc.failures + stats.failures,
            skipped: acc.skipped + stats.skipped,
            unreachable: acc.unreachable + stats.unreachable,
            rescued: acc.rescued + stats.rescued,
            ignored: acc.ignored + stats.ignored,
          }),
          { ok: 0, changed: 0, failures: 0, skipped: 0, unreachable: 0, rescued: 0, ignored: 0 }
        );
        // Use aggregated if we have playbookStats, otherwise fall back to job fields
        const stats = playbookStats.size > 0 ? aggregatedStats : {
          ok: job.hosts_ok,
          changed: job.hosts_changed,
          failures: job.hosts_failed,
          skipped: job.hosts_skipped,
          unreachable: job.hosts_unreachable,
          rescued: job.hosts_rescued || 0,
          ignored: job.hosts_ignored || 0,
        };
        return (
          <div className="flex items-center gap-6 bg-card border rounded-lg px-4 py-2">
            <span className="text-sm text-muted-foreground">Stats:</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 cursor-default" title="OK">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-lg font-bold text-green-600">{stats.ok}</span>
              </div>
              <div className="flex items-center gap-1.5 cursor-default" title="Changed">
                <RefreshCw className="h-4 w-4 text-blue-600" />
                <span className="text-lg font-bold text-blue-600">{stats.changed}</span>
              </div>
              <div className="flex items-center gap-1.5 cursor-default" title="Failed">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-lg font-bold text-red-600">{stats.failures}</span>
              </div>
              <div className="flex items-center gap-1.5 cursor-default" title="Unreachable">
                <WifiOff className="h-4 w-4 text-orange-600" />
                <span className="text-lg font-bold text-orange-600">{stats.unreachable}</span>
              </div>
              <div className="flex items-center gap-1.5 cursor-default" title="Rescued">
                <CircleDot className="h-4 w-4 text-purple-600" />
                <span className="text-lg font-bold text-purple-600">{stats.rescued}</span>
              </div>
              <div className="flex items-center gap-1.5 cursor-default" title="Skipped">
                <Ban className="h-4 w-4 text-gray-400" />
                <span className="text-lg font-bold text-gray-400">{stats.skipped}</span>
              </div>
              <div className="flex items-center gap-1.5 cursor-default" title="Ignored">
                <EyeOff className="h-4 w-4 text-gray-600" />
                <span className="text-lg font-bold text-gray-600">{stats.ignored}</span>
              </div>
            </div>
          </div>
        );
      })()}

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
            <TabsTrigger value="output" className="flex items-center gap-1.5">
              <Terminal className="h-4 w-4" />
              Output
              {['pending', 'running'].includes(job.status) && (
                <Loader2 className="h-3 w-3 animate-spin ml-1" />
              )}
            </TabsTrigger>
            <TabsTrigger value="events" className="flex items-center gap-1.5">
              <ListTree className="h-4 w-4" />
              Events
              {groupedTasks.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {groupedTasks.length}
                </Badge>
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
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {hostFacts.size}
                </Badge>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="output" className="mt-3">
          <Card className="overflow-hidden">
            {/* Search bar for output */}
            <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search output..."
                value={outputSearch}
                onChange={(e) => setOutputSearch(e.target.value)}
                className="h-8 text-sm border-0 bg-transparent focus-visible:ring-0 flex-1"
              />
              {outputSearch && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setOutputSearch('')}
                >
                  Clear
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => { void handleCopyOutput(); }}
                disabled={!output}
                title="Copy output to clipboard"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            <CardContent className="p-0">
              {/* Show error message prominently if job failed */}
              {job.status === 'failed' && job.error_message && (
                <div className="p-3 bg-red-100 border-b border-red-200 dark:bg-red-950 dark:border-red-800">
                  <div className="flex items-start gap-2 text-red-700 dark:text-red-400">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="text-sm flex-1">
                      <span className="font-medium">Job failed: </span>
                      <span className="opacity-90">{job.error_message}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-200/50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/50 shrink-0"
                      onClick={() => { void handleCopyError(); }}
                      title="Copy error message to clipboard"
                    >
                      {errorCopied ? (
                        <Check className="h-4 w-4 text-green-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
              <div
                ref={outputRef as React.RefObject<HTMLDivElement>}
                className="overflow-auto max-h-[calc(100vh-350px)] min-h-[400px]"
              >
                {parsedOutput.jsonContent || parsedOutput.plainLines ? (
                  <div>
                    {parsedOutput.jsonContent && (
                      <JsonSyntaxHighlighter
                        json={parsedOutput.jsonContent}
                        maxHeight="none"
                        className="mb-0"
                      />
                    )}
                    {parsedOutput.plainLines && parsedOutput.plainLines.map((line, idx) => {
                      // Plain text line - show with search highlighting if needed
                      if (outputSearch && line.toLowerCase().includes(outputSearch.toLowerCase())) {
                        const parts = line.split(new RegExp(`(${outputSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
                        return (
                          <div key={idx} className="bg-muted/10 p-4 font-mono text-sm whitespace-pre-wrap">
                            {parts.map((part, partIdx) => 
                              part.toLowerCase() === outputSearch.toLowerCase() ? (
                                <mark key={partIdx} className="bg-yellow-500/50 text-yellow-100 px-0.5 rounded-sm">{part}</mark>
                              ) : (
                                <span key={partIdx}>{part}</span>
                              )
                            )}
                          </div>
                        );
                      }
                      return (
                        <div key={idx} className="bg-muted/10 p-4 font-mono text-sm whitespace-pre-wrap">
                          {line}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-muted/10 p-4 text-muted-foreground">
                    {job.status === 'pending'
                      ? 'Waiting for job to start...'
                      : job.status === 'failed' && job.error_message
                      ? 'Job failed before producing output. See error message above.'
                      : 'No output available'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="mt-3">
          <Card className="overflow-hidden">
            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2 p-2 border-b bg-muted/30">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  className="h-8 text-sm border-0 bg-transparent focus-visible:ring-0"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 w-[130px] text-sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="ok">OK</SelectItem>
                    <SelectItem value="changed">Changed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="skipped">Skipped</SelectItem>
                    <SelectItem value="unreachable">Unreachable</SelectItem>
                  </SelectContent>
                </Select>
                
                {(eventSearch || statusFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => {
                      setEventSearch('');
                      setStatusFilter('all');
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            <CardContent className="p-0 max-h-[calc(100vh-350px)] min-h-[400px] overflow-auto">
              {groupedTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {job.status === 'pending' ? 'Waiting for job to start...' : 
                   job.status === 'running' ? 'Running...' : 'No events recorded'}
                </div>
              ) : (
                <div className="divide-y">
                  {groupedTasks
                    .filter(group => {
                      // Filter by status
                      if (statusFilter !== 'all' && group.aggregateStatus !== statusFilter) {
                        return false;
                      }
                      // Filter by search
                      if (eventSearch) {
                        const searchLower = eventSearch.toLowerCase();
                        return group.task.toLowerCase().includes(searchLower) ||
                               group.play.toLowerCase().includes(searchLower) ||
                               group.hosts.some(h => h.host.toLowerCase().includes(searchLower));
                      }
                      return true;
                    })
                    .map((group, idx) => {
                    const status = group.aggregateStatus;
                    const hostCount: number = group.hosts.length;
                    const okCount = group.hosts.filter(h => h.status === 'ok').length;
                    const changedCount = group.hosts.filter(h => h.status === 'changed').length;
                    const failedCount = group.hosts.filter(h => h.status === 'failed').length;
                    
                    return (
                    <div
                      key={`${group.play}-${group.task}-${idx}`}
                      className={cn(
                        "px-4 py-2.5 hover:bg-muted/50 transition-colors",
                        status === 'failed' && 'bg-red-500/10 dark:bg-red-950/20',
                        status === 'unreachable' && 'bg-red-500/10 dark:bg-orange-950/20',
                        status === 'changed' && 'bg-blue-50 dark:bg-blue-950/10'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {/* Status indicator */}
                        <div>
                          {status === 'ok' && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          {status === 'changed' && (
                            <RefreshCw className="h-4 w-4 text-blue-500" />
                          )}
                          {status === 'failed' && (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                          {status === 'unreachable' && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                          {status === 'skipped' && (
                            <Ban className="h-4 w-4 text-gray-500" />
                          )}
                        </div>
                        
                        {/* Task info */}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate">{group.task}</span>
                          {group.play && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {group.play}
                            </div>
                          )}
                        </div>
                        
                        {/* Host count with status breakdown */}
                        <div className="flex items-center gap-1.5 text-xs shrink-0">
                          <Server className="h-3 w-3 text-muted-foreground" />
                          <span className={cn(
                            "font-medium",
                            status === 'ok' && 'text-green-500',
                            status === 'changed' && 'text-blue-500',
                            status === 'failed' && 'text-red-500',
                            status === 'unreachable' && 'text-orange-500',
                            status === 'skipped' && 'text-gray-500'
                          )}>
                            {hostCount}
                          </span>
                          {/* Show breakdown if mixed statuses */}
                          {hostCount > 1 && (changedCount > 0 || failedCount > 0) && (
                            <span className="text-muted-foreground">
                              ({okCount > 0 && <span className="text-green-500">{okCount}✓</span>}
                              {changedCount > 0 && <span className="text-blue-500 ml-0.5">{changedCount}~</span>}
                              {failedCount > 0 && <span className="text-red-500 ml-0.5">{failedCount}✗</span>})
                            </span>
                          )}
                        </div>
                        
                        
                        {/* Timestamp */}
                        <div className="text-xs text-muted-foreground shrink-0">
                          {formatTime(group.timestamp)}
                        </div>
                      </div>
                      
                      {/* Show output for each host */}
                      <div className="mt-2 ml-7 space-y-1">
                        {group.hosts.map((hostData, hidx): React.ReactElement => {
                          // Type assertion to ensure proper typing
                          const typedHost: GroupedTask['hosts'][0] = hostData;
                          // Try to get result details from the event
                          const hosts = typedHost.event?.event_data?.hosts as Record<string, Record<string, unknown>> | undefined;
                          const hostName: string = String(typedHost.host);
                          const eventResult = hosts?.[hostName];
                          const hasOutput = typedHost.stdout || typedHost.stderr || eventResult?.msg || eventResult?.results;
                          
                          const showHostBadge: boolean = hostCount > 1;
                          const hostStatus: 'ok' | 'changed' | 'failed' | 'skipped' | 'unreachable' = typedHost.status;
                          
                          return (
                          <div key={hidx} className="space-y-1">
                            {/* Show host name if multiple hosts */}
                            {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                            {/* @ts-ignore */}
                            {showHostBadge ? (
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-[10px] h-4 px-1.5",
                                    hostStatus === 'ok' && 'border-green-500/30 text-green-500',
                                    hostStatus === 'changed' && 'border-blue-500/30 text-blue-500',
                                    hostStatus === 'failed' && 'border-red-500/30 text-red-500',
                                    hostStatus === 'skipped' && 'border-gray-500/30 text-gray-500'
                                  )}
                                >
                                  {hostName}
                                </Badge>
                              </div>
                            ) : (null as any as React.ReactNode)}
                            {/* Show output/result if present */}
                            {hasOutput && (
                              <pre className={cn(
                                "text-xs font-mono p-2 rounded-sm max-h-40 overflow-auto whitespace-pre-wrap",
                                hostData.status === 'failed' || hostData.status === 'unreachable' 
                                  ? "bg-red-500/15 text-red-900 dark:bg-red-950/50 dark:text-red-200" 
                                  : hostData.status === 'changed'
                                  ? "bg-blue-50 text-blue-900 dark:bg-blue-950/30 dark:text-blue-100"
                                  : "bg-muted text-foreground/80"
                              )}>
                                {hostData.stderr || hostData.stdout || 
                                  (eventResult?.msg ? stripAnsiCodes(String(eventResult.msg as unknown)) : 
                                  (eventResult?.results ? JSON.stringify(eventResult.results as unknown, null, 2) :
                                  (eventResult ? JSON.stringify(eventResult, null, 2) : '')))}
                              </pre>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
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
                      <div className="flex items-center gap-1" title="OK">
                        <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                        <span className="font-medium text-green-600">{playbookStats.get(facts.hostname)?.ok || 0}</span>
                      </div>
                      <div className="flex items-center gap-1" title="Changed">
                        <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
                        <span className="font-medium text-blue-600">{playbookStats.get(facts.hostname)?.changed || 0}</span>
                      </div>
                      <div className="flex items-center gap-1" title="Failed">
                        <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                        <span className="font-medium text-red-600">{playbookStats.get(facts.hostname)?.failures || 0}</span>
                      </div>
                      <div className="flex items-center gap-1" title="Unreachable">
                        <WifiOff className="h-3.5 w-3.5 text-orange-600" />
                        <span className="font-medium text-orange-600">{playbookStats.get(facts.hostname)?.unreachable || 0}</span>
                      </div>
                      <div className="flex items-center gap-1" title="Rescued">
                        <CircleDot className="h-3.5 w-3.5 text-purple-600" />
                        <span className="font-medium text-purple-600">{playbookStats.get(facts.hostname)?.rescued || 0}</span>
                      </div>
                      <div className="flex items-center gap-1" title="Skipped">
                        <Ban className="h-3.5 w-3.5 text-gray-400" />
                        <span className="font-medium text-gray-400">{playbookStats.get(facts.hostname)?.skipped || 0}</span>
                      </div>
                      <div className="flex items-center gap-1" title="Ignored">
                        <EyeOff className="h-3.5 w-3.5 text-gray-600" />
                        <span className="font-medium text-gray-600">{playbookStats.get(facts.hostname)?.ignored || 0}</span>
                      </div>
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
