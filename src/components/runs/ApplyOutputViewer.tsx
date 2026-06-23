// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useMemo, useState, useEffect, useRef } from 'react';
import { resolveTerminalResourceStatus, type ResourceStatus } from './applyResourceStatus';
import {
  Plus,
  Minus,
  ArrowRight,
  CheckCircle2,
  Package,
  FileText,
  ChevronRight,
  ChevronDown,
  XCircle,
  Search,
  Filter,
  RotateCw,
  Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { JsonViewer } from './JsonViewer';
import { TerminalOutput } from './TerminalOutput';
import { ProviderIcon } from './ProviderIcon';
import { useRunDisplayPreferences } from '@/contexts/RunDisplayPreferencesContext';

interface ApplyOutputViewerProps {
  logs: string;
  showJsonViewer?: boolean;
  planOutput?: Record<string, unknown>; // Plan output to show staged resources
  isApplying?: boolean; // Whether apply is currently running (to show all resources as applying initially)
  isCancelled?: boolean; // Whether apply was cancelled (marks applying resources as cancelled)
  isFailed?: boolean; // Whether apply has failed (marks applying resources as failed)
  applyState?: {
    resources?: Array<{
      address: string;
      status: string;
      resource_id?: string;
      created_at?: string;
      action: string;
      error_message?: string;
      details?: string;
    }>;
    summary?: {
      additions: number;
      changes: number;
      destructions: number;
      failed: number;
    };
  } | null; // Stored apply state from backend (for reload persistence)
  runId?: string; // Run ID for localStorage persistence
  /** Outputs from state (GET /runs/:id/outputs). When set, used instead of parsing the apply log. */
  runOutputs?: Array<{ key: string; value: unknown; type?: string; sensitive?: boolean }>;
  /** True only for destroy runs; used to fix streaming when backend has no apply state (e.g. self-hosted). */
  isDestroyRun?: boolean;
}

interface AppliedResource {
  address: string;
  action: 'create' | 'update' | 'delete' | 'replace';
  id?: string;
  details?: string;
  errorMessage?: string; // Error message if status is failed
  status: ResourceStatus; // Status for interactive display
  type?: string; // Resource type from plan
}

interface PlannedResource {
  address: string;
  type: string;
  name: string;
  actions: string[];
}

interface ApplySummary {
  add: number;
  change: number;
  destroy: number;
  replace: number;
  failed: number;
  total: number;
}

function getActionColor(action: string): string {
  switch (action) {
    case 'create':
      return 'text-green-600 dark:text-green-400 bg-green-500/10';
    case 'update':
      return 'text-blue-600 dark:text-blue-400 bg-blue-500/10';
    case 'delete':
      return 'text-red-600 dark:text-red-400 bg-red-500/10';
    case 'replace':
      return 'text-orange-600 dark:text-orange-400 bg-orange-500/10';
    default:
      return 'text-gray-600 dark:text-gray-400 bg-gray-500/10';
  }
}

function getActionIcon(action: string) {
  switch (action) {
    case 'create':
      return <Plus className="h-4 w-4" />;
    case 'update':
      return <ArrowRight className="h-4 w-4" />;
    case 'delete':
      return <Minus className="h-4 w-4" />;
    case 'replace':
      return <RotateCw className="h-4 w-4" />;
    default:
      return <Package className="h-4 w-4" />;
  }
}

function formatAction(action: string): string {
  return action.charAt(0).toUpperCase() + action.slice(1);
}

function AppliedResourceCard({ resource }: { resource: AppliedResource }) {
  const [expanded, setExpanded] = useState(false);
  const { preferences } = useRunDisplayPreferences();

  // Determine status indicator - blue spinning circle for applying, green checkmark for completed
  // The action badge keeps its original color (green for create, red for delete, etc.)
  const statusIndicator = useMemo(() => {
    switch (resource.status) {
      case 'applying':
        return (
          <div className="relative h-4 w-4">
            <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          </div>
        );
      case 'completed':
        // Always show green checkmark for successfully completed resources
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        // Show grey X icon for cancelled resources (consistent with cancelled phases)
        return <XCircle className="h-4 w-4 text-gray-400" />;
      case 'pending':
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
    }
  }, [resource.status]);

  return (
    <div
      // Stable hooks for tests/automation to assert the per-resource rendered status
      // (the box color/icon) deterministically, since that status is parsed client-side
      // from the apply log and is the surface where bugs like the never-resolving
      // "applying" spinner on a cancelled run show up.
      data-resource-address={resource.address}
      data-resource-status={resource.status}
      className={cn(
        "border rounded-lg overflow-hidden hover:border-primary/50 transition-colors",
        resource.status === 'applying' && "border-blue-500/30 bg-blue-500/5",
        resource.status === 'completed' && "border-green-500/30 bg-green-500/5",
        resource.status === 'failed' && "border-red-500/30 bg-red-500/5",
        resource.status === 'cancelled' && "border-gray-400 bg-gray-400/5",
        (resource.details || resource.errorMessage) && "cursor-pointer"
      )}
      onClick={() => (resource.details || resource.errorMessage) && setExpanded(!expanded)}
    >
      <div className={cn(
        "px-4 transition-all",
        expanded || resource.id ? "py-4" : "py-3"
      )}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {/* Provider Icon */}
              <ProviderIcon providerName={resource.address.split('.')[0]} resourceType={resource.type} className="h-4 w-4" />

              {/* Action badge - always shown so users can see what action is being attempted */}
              <span className={cn(
                "px-2 py-1 rounded-md text-xs font-medium flex items-center",
                preferences.showActionText ? "gap-1" : "justify-center",
                getActionColor(resource.action)
              )}>
                {getActionIcon(resource.action)}
                {preferences.showActionText && formatAction(resource.action)}
              </span>
              <span className="text-sm font-mono text-muted-foreground truncate">
                {resource.address}
              </span>
            </div>
            {resource.id && (
              <div className="text-sm text-muted-foreground mt-1">
                ID: <span className="font-mono">{resource.id}</span>
              </div>
            )}
            {resource.errorMessage && expanded && (
              <div className="mt-2 text-xs font-mono bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-2 rounded-sm whitespace-pre-wrap">
                Error: {resource.errorMessage}
              </div>
            )}
            {resource.details && expanded && (
              <div className="mt-2 text-xs text-muted-foreground font-mono bg-muted/30 p-2 rounded-sm">
                {resource.details}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                void navigator.clipboard.writeText(resource.address);
                toast.success(`Copied resource address: ${resource.address}`);
              }}
              className="p-1 hover:bg-muted rounded-sm transition-colors"
              title={`Copy resource address: ${resource.address}`}
            >
              <Copy className="h-4 w-4 text-muted-foreground" />
            </button>
            {/* Status indicator */}
            {statusIndicator}
            {(resource.details || resource.errorMessage) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                {expanded ? <ChevronDown className="h-4 w-4 rotate-180 transition-transform" /> : <ChevronDown className="h-4 w-4 transition-transform" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { parseTerraformErrors } from '@/utils/terraformErrorParser';

/**
 * Finds a matching planned resource address for an error resource address.
 * Handles cases where error messages contain partial addresses (without module prefixes)
 * that need to be matched to full resource addresses.
 * 
 * @param errorResource - Resource address from error message (may be partial)
 * @param plannedResources - List of all planned resource addresses
 * @returns Matching planned resource address, or undefined if no match found
 */
function findMatchingResourceAddress(
  errorResource: string,
  plannedResources: PlannedResource[]
): string | undefined {
  // Clean up error resource (remove backticks, trim)
  const cleanErrorResource = errorResource.replace(/[`'"]/g, '').trim();
  
  // Try exact match first
  const exactMatch = plannedResources.find(p => p.address === cleanErrorResource);
  if (exactMatch) {
    return exactMatch.address;
  }
  
  // Try suffix matching: error resource is a suffix of planned resource
  // This handles cases like:
  //   error: "proxmox_virtual_environment_download_file.test_iso"
  //   planned: "module.proxmox_test.proxmox_virtual_environment_download_file.test_iso"
  const suffixMatch = plannedResources.find(p => {
    const planned = p.address;
    // Match if planned ends with the error resource, preceded by a dot or exactly equal
    // Prefer dot-separated match to avoid false positives (e.g., "resource" matching "my_resource")
    return planned === cleanErrorResource || 
           planned.endsWith(`.${cleanErrorResource}`);
  });
  if (suffixMatch) {
    return suffixMatch.address;
  }
  
  // Try matching by resource type and name (last two parts)
  // Error might be just "type.name" while planned is "module.path.type.name"
  const errorParts = cleanErrorResource.split('.');
  if (errorParts.length >= 2) {
    const errorType = errorParts[errorParts.length - 2];
    const errorName = errorParts[errorParts.length - 1];
    const typeNameMatch = plannedResources.find(p => {
      const parts = p.address.split('.');
      return parts.length >= 2 && 
             parts[parts.length - 2] === errorType && 
             parts[parts.length - 1] === errorName;
    });
    if (typeNameMatch) {
      return typeNameMatch.address;
    }
  }
  
  return undefined;
}

export function ApplyOutputViewer({ logs, showJsonViewer = true, planOutput, isApplying = false, isCancelled = false, isFailed = false, applyState = null, runId, runOutputs, isDestroyRun = false }: ApplyOutputViewerProps) {
  // Load UI state from localStorage on mount (per-run basis)
  // Default to 'terminal' view for apply phase (faster loading than JSON)
  const getStoredUIState = (): { jsonExpanded: boolean; rawOutputView: 'json' | 'terminal' } => {
    if (!runId) return { jsonExpanded: false, rawOutputView: 'terminal' };
    try {
      const stored = localStorage.getItem(`run-${runId}-apply-ui-state`);
      if (stored) {
        const parsed = JSON.parse(stored) as { jsonExpanded?: boolean; rawOutputView?: 'json' | 'terminal' };
        return {
          jsonExpanded: parsed.jsonExpanded ?? false,
          rawOutputView: parsed.rawOutputView ?? 'terminal',
        };
      }
    } catch (error) {
      console.error('Failed to load UI state from localStorage:', error);
    }
    return { jsonExpanded: false, rawOutputView: 'terminal' };
  };

  const storedUIState = getStoredUIState();
  const [jsonExpanded, setJsonExpanded] = useState(storedUIState.jsonExpanded);
  const [rawOutputView, setRawOutputView] = useState<'json' | 'terminal'>(storedUIState.rawOutputView);
  const [addressFilter, setAddressFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const { preferences } = useRunDisplayPreferences();

  // Persist UI state to localStorage when it changes
  useEffect(() => {
    if (!runId) return;
    try {
      localStorage.setItem(`run-${runId}-apply-ui-state`, JSON.stringify({
        jsonExpanded,
        rawOutputView,
      }));
    } catch (error) {
      console.error('Failed to save UI state to localStorage:', error);
    }
  }, [jsonExpanded, rawOutputView, runId]);

  // State for resources and statuses (incremental parsing)
  const [resources, setResources] = useState<AppliedResource[]>([]);
  const [resourceStatuses, setResourceStatuses] = useState<Map<string, 'pending' | 'applying' | 'completed' | 'failed' | 'cancelled'>>(new Map());
  const [summary, setSummary] = useState<ApplySummary>({
    add: 0,
    change: 0,
    destroy: 0,
    replace: 0,
    failed: 0,
    total: 0,
  });

  // Track last parsed log length for incremental parsing
  const lastParsedLengthRef = useRef<number>(0);
  // Track destroyed resources that might be replaced (for replace detection)
  const destroyedResourcesRef = useRef<Set<string>>(new Set());
  // Track if we've found the summary line
  const summaryLineRef = useRef<{ added: number; changed: number; destroyed: number } | null>(null);

  // Check if logs contain errors
  const errorParseResult = parseTerraformErrors(logs || '');

  // Extract planned resources from plan output
  const plannedResources = useMemo<PlannedResource[]>(() => {
    if (!planOutput) return [];
    const resourceChanges = (planOutput.resource_changes as Array<{
      address: string;
      type: string;
      name: string;
      change: { actions: string[] };
    }>) || [];

    return resourceChanges
      .filter(resource => {
        const actions = resource.change?.actions || [];
        // Filter out no-op resources
        return actions.length > 0 && !actions.every(a => a === 'no-op');
      })
      .map(resource => ({
        address: resource.address,
        type: resource.type,
        name: resource.name,
        actions: resource.change?.actions || [],
      }));
  }, [planOutput]);

  // Strip ANSI escape codes from logs
  const cleanedLogs = useMemo(() => {
    if (!logs || logs.trim().length === 0) return '';
    // eslint-disable-next-line no-control-regex
    return logs.replace(/\x1b\[[0-9;]*m/g, '');
  }, [logs]);

  // Parse outputs from apply logs
  // Terraform outputs can be in format:
  //   key = value
  //   key = {
  //     field = value
  //   }
  // Or JSON format when using -json flag
  const outputs = useMemo(() => {
    if (!cleanedLogs || cleanedLogs.trim().length === 0) return [];

    const lines = cleanedLogs.split('\n');
    const parsedOutputs: Array<{ key: string; value: unknown; type?: unknown; sensitive?: boolean }> = [];
    let inOutputsSection = false;
    let currentOutput: { key: string; valueLines: string[] } | null = null;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Detect start of outputs section
      if (trimmed === 'Outputs:' || trimmed.match(/^Outputs:\s*$/)) {
        inOutputsSection = true;
        continue;
      }

      if (!inOutputsSection) continue;

      // Parse output lines: "key = value" or multiline values
      if (trimmed.includes('=') && !currentOutput) {
        const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*=\s*(.*)$/);
        if (match) {
          const key = match[1];
          const value = match[2].trim();

          // Check if value is a JSON object/array starting on same line, or a function call with brackets
          // This handles cases like: tolist([...]), toset({...}), etc.
          const hasOpenBracket = value.includes('[') || value.includes('{');
          const hasCloseBracket = value.includes(']') || value.includes('}');
          const hasFunctionCall = /\w+\s*\(/.test(value); // Matches function calls like "tolist(", "toset("
          
          if ((value === '{' || value === '[' || value.startsWith('{') || value.startsWith('[')) ||
              (hasFunctionCall && hasOpenBracket && !hasCloseBracket)) {
            // Multiline value - track brace depth
            currentOutput = { key, valueLines: [line] };
            braceDepth = (value.match(/\{/g) || []).length - (value.match(/\}/g) || []).length;
            braceDepth += (value.match(/\[/g) || []).length - (value.match(/\]/g) || []).length;
            // Also track parentheses for function calls like tolist(...)
            braceDepth += (value.match(/\(/g) || []).length - (value.match(/\)/g) || []).length;
          } else if (value && value !== '') {
            // Single line value - try to parse as JSON first, otherwise use as string
            let parsedValue: unknown = value;
            try {
              // Try parsing as JSON
              parsedValue = JSON.parse(value);
            } catch {
              // Not JSON, remove quotes if present
              if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                parsedValue = value.slice(1, -1);
              }
            }
            parsedOutputs.push({ key, value: parsedValue });
          } else {
            // Empty value, might be multiline starting on next line
            currentOutput = { key, valueLines: [line] };
            braceDepth = 0;
          }
        }
      } else if (currentOutput) {
        // Continuation of multiline value
        currentOutput.valueLines.push(line);

        // Track brace depth (including parentheses for function calls)
        braceDepth += (trimmed.match(/\{/g) || []).length - (trimmed.match(/\}/g) || []).length;
        braceDepth += (trimmed.match(/\[/g) || []).length - (trimmed.match(/\]/g) || []).length;
        braceDepth += (trimmed.match(/\(/g) || []).length - (trimmed.match(/\)/g) || []).length;

        // If we've closed all braces and parentheses, parse the value
        if (braceDepth <= 0 && (trimmed === '}' || trimmed === ']' || trimmed === ')' || trimmed.endsWith('}') || trimmed.endsWith(']') || trimmed.endsWith(')'))) {
          const valueText = currentOutput.valueLines.join('\n');
          // Extract just the value part (after =)
          const valueMatch = valueText.match(/=\s*(.+)$/s);
          if (valueMatch) {
            const valueStr = valueMatch[1].trim();
            let parsedValue: unknown;
            try {
              // First try as JSON
              parsedValue = JSON.parse(valueStr);
            } catch {
              // Not JSON, convert HCL format to JSON
              // HCL format uses newlines: { key = "value"\n key2 = "value2" }
              const hclToJson = (hcl: string): unknown => {
                let cleaned = hcl.trim();
                if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
                  cleaned = cleaned.slice(1, -1).trim();
                }
                if (!cleaned) return hcl; // Return original if empty

                const result: Record<string, unknown> = {};
                // HCL uses newlines to separate key-value pairs, not commas
                const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));

                for (const line of lines) {
                  const match = line.match(/^(\w+)\s*=\s*(.+)$/);
                  if (match) {
                    const key = match[1];
                    let val = match[2].trim();

                    // Remove quotes
                    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                      val = val.slice(1, -1);
                    } else if (val === 'true') {
                      result[key] = true;
                      continue;
                    } else if (val === 'false') {
                      result[key] = false;
                      continue;
                    } else if (!isNaN(Number(val)) && val.trim() !== '' && !val.includes('.')) {
                      result[key] = parseInt(val, 10);
                      continue;
                    } else if (!isNaN(Number(val)) && val.includes('.')) {
                      result[key] = parseFloat(val);
                      continue;
                    }

                    // If value looks like nested object, recurse
                    if (val.startsWith('{')) {
                      result[key] = hclToJson(val);
                    } else {
                      result[key] = val;
                    }
                  }
                }

                // If we couldn't parse anything, return the original HCL string instead of empty object
                if (Object.keys(result).length === 0) {
                  return valueStr; // Return original string if parsing failed
                }
                return result;
              };

              try {
                parsedValue = hclToJson(valueStr);
                // If parsing returned a string (meaning it failed), keep it as string
                // If it returned empty object, also keep original string
                if (typeof parsedValue === 'string' || (typeof parsedValue === 'object' && parsedValue !== null && Object.keys(parsedValue).length === 0)) {
                  parsedValue = valueStr;
                }
              } catch {
                parsedValue = valueStr;
              }
            }
            parsedOutputs.push({ key: currentOutput.key, value: parsedValue });
          }
          currentOutput = null;
          braceDepth = 0;
        }
      } else if (trimmed === '' && parsedOutputs.length > 0 && !currentOutput) {
        // Empty line after outputs - might be end of section
        let nextNonEmpty = i + 1;
        while (nextNonEmpty < lines.length && lines[nextNonEmpty].trim() === '') {
          nextNonEmpty++;
        }
        if (nextNonEmpty < lines.length && !lines[nextNonEmpty].trim().includes('=') && !lines[nextNonEmpty].trim().startsWith('{')) {
          break;
        }
      }
    }

    // Save any remaining output
    if (currentOutput) {
      const valueText = currentOutput.valueLines.join('\n');
      const valueMatch = valueText.match(/=\s*(.+)$/s);
      if (valueMatch) {
        const valueStr = valueMatch[1].trim();
        let parsedValue: unknown;

        try {
          parsedValue = JSON.parse(valueStr);
        } catch {
          // Convert HCL format to JSON
          // HCL format uses newlines: { key = "value"\n key2 = "value2" }
          const hclToJson = (hcl: string): unknown => {
            let cleaned = hcl.trim();
            if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
              cleaned = cleaned.slice(1, -1).trim();
            }
            if (!cleaned) return {};

            const result: Record<string, unknown> = {};
            // HCL uses newlines to separate key-value pairs
            const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));

            for (const line of lines) {
              const match = line.match(/^(\w+)\s*=\s*(.+)$/);
              if (match) {
                const key = match[1];
                let val = match[2].trim();
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                  val = val.slice(1, -1);
                } else if (val === 'true') {
                  result[key] = true;
                  continue;
                } else if (val === 'false') {
                  result[key] = false;
                  continue;
                } else if (!isNaN(Number(val)) && val.trim() !== '' && !val.includes('.')) {
                  result[key] = parseInt(val, 10);
                  continue;
                } else if (!isNaN(Number(val)) && val.includes('.')) {
                  result[key] = parseFloat(val);
                  continue;
                }
                if (val.startsWith('{')) {
                  result[key] = hclToJson(val);
                } else {
                  result[key] = val;
                }
              }
            }
            return Object.keys(result).length > 0 ? result : hcl;
          };

          try {
            parsedValue = hclToJson(valueStr);
          } catch {
            parsedValue = valueStr;
          }
        }
        parsedOutputs.push({ key: currentOutput.key, value: parsedValue });
      }
    }

    return parsedOutputs;
  }, [cleanedLogs]);

  // Prefer runOutputs from state (GET /runs/:id/outputs) when available; otherwise use parsed apply log
  const outputsToShow = runOutputs !== undefined ? runOutputs : outputs;

  // Incremental parsing implementation - replaces useMemo with useEffect hooks
  // This provides ~1000x performance improvement by only parsing new lines

  // Step 0: Initialize from stored state on reload (if available)
  // This happens before incremental parsing to restore state from backend
  const storedStateInitializedRef = useRef(false);

  // Reset stored-state init when run changes so we don't show a previous run's "all applied" state
  useEffect(() => {
    if (runId) storedStateInitializedRef.current = false;
  }, [runId]);

  useEffect(() => {
    // Only initialize once when stored state is available and not already initialized
    // Destroy runs only: when backend has no apply state (e.g. self-hosted), skip so log parsing runs
    if (applyState?.resources && !storedStateInitializedRef.current && !isApplying) {
      if (isDestroyRun && applyState.resources.length === 0) {
        // Do not init from empty stored state; let Step 2 parse logs and populate statuses
        return;
      }
      storedStateInitializedRef.current = true;
      
      // Convert stored resources to AppliedResource format
      const storedResources: AppliedResource[] = applyState.resources.map(res => ({
        address: res.address,
        action: res.action as 'create' | 'update' | 'delete' | 'replace',
        id: res.resource_id,
        details: res.details,
        errorMessage: res.error_message,
        status: res.status as 'pending' | 'applying' | 'completed' | 'failed' | 'cancelled',
      }));

      // Initialize resource statuses from stored state.
      // Never default to 'completed' for missing/empty status: only treat explicit res.status === 'completed' as completed.
      // This prevents "all applied" when applyState arrives before run status (isCancelled) or when backend omits status.
      const statusMap = new Map<string, 'pending' | 'applying' | 'completed' | 'failed' | 'cancelled'>();
      storedResources.forEach(res => {
        const raw = res.status;
        const status = raw === 'completed'
          ? 'completed'
          : (isCancelled ? 'cancelled' : (raw || 'pending'));
        statusMap.set(res.address, status);
      });

      // Ensure ALL planned resources are in the status map, even if not in stored state
      // This handles cases where resources were never started (cancelled early)
      // They should be marked as cancelled if the run was cancelled
      plannedResources.forEach(planned => {
        if (!statusMap.has(planned.address)) {
          // Resource not in stored state - mark as cancelled if run was cancelled, otherwise pending
          statusMap.set(planned.address, isCancelled ? 'cancelled' : 'pending');
        }
      });

      // Build complete resources array: stored resources + missing planned resources
      const allResources: AppliedResource[] = [...storedResources];
      plannedResources.forEach(planned => {
        if (!storedResources.find(r => r.address === planned.address)) {
          // Resource not in stored state - add it with appropriate status
          const hasReplace = planned.actions.includes('delete') && planned.actions.includes('create');
          const hasUpdate = planned.actions.includes('update');
          const action: 'create' | 'update' | 'delete' | 'replace' =
            hasReplace ? 'replace' :
              hasUpdate ? 'update' :
                planned.actions.includes('create') ? 'create' :
                  planned.actions.includes('delete') ? 'delete' :
                    'create';
          
          allResources.push({
            address: planned.address,
            action,
            type: planned.type,
            status: statusMap.get(planned.address) || (isCancelled ? 'cancelled' : 'pending'),
          });
        }
      });

      // Initialize resources from complete list
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResources(allResources);
       
      setResourceStatuses(statusMap);

      // Initialize summary from stored state
      if (applyState.summary) {
        setSummary({
          add: applyState.summary.additions,
          change: applyState.summary.changes,
          destroy: applyState.summary.destructions,
          replace: 0, // Replace count not in summary, will be calculated
          failed: applyState.summary.failed,
          total: allResources.length, // Use all resources count, not just stored
        });
      }

      // Set lastParsedLength to logs length to prevent re-parsing stored state
      lastParsedLengthRef.current = cleanedLogs.length;
    }
  }, [applyState, isApplying, cleanedLogs.length, plannedResources, isCancelled, isDestroyRun]);

  // Step 1: Initialize status map from planned resources
  useEffect(() => {
    if (storedStateInitializedRef.current && applyState?.resources) {
      // Already initialized from stored state, skip
      return;
    }

    if (plannedResources.length === 0) return;

    const initialStatus = isApplying ? 'applying' : 'pending';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResourceStatuses(prev => {
      const newMap = new Map(prev);
      plannedResources.forEach(planned => {
        if (!newMap.has(planned.address)) {
          newMap.set(planned.address, initialStatus);
        }
      });
      return newMap;
    });

    // Reset parsing state when planned resources change (new run)
    // Only reset if not initialized from stored state
    if (!storedStateInitializedRef.current) {
      lastParsedLengthRef.current = 0;
      destroyedResourcesRef.current = new Set();
      summaryLineRef.current = null;
       
      setResources([]);
       
      setSummary({
        add: 0,
        change: 0,
        destroy: 0,
        replace: 0,
        failed: 0,
        total: 0,
      });
    }
  }, [plannedResources, isApplying, applyState]);

  // Step 2: Incremental log parsing
  useEffect(() => {
    // If we have stored state and phase is complete (not applying), skip incremental parsing
    // Stored state is already loaded in Step 0
    if (storedStateInitializedRef.current && !isApplying) {
      return;
    }

    if (!cleanedLogs || cleanedLogs.trim().length === 0) {
      if (lastParsedLengthRef.current === 0) return;
      lastParsedLengthRef.current = 0;
      return;
    }

    // Detect log reset (shorter than before) - new run started
    if (cleanedLogs.length < lastParsedLengthRef.current) {
      lastParsedLengthRef.current = 0;
      destroyedResourcesRef.current = new Set();
      summaryLineRef.current = null;
       
      setResources([]);
       
      setSummary({
        add: 0,
        change: 0,
        destroy: 0,
        replace: 0,
        failed: 0,
        total: 0,
      });
      // Re-initialize statuses from planned resources
      const initialStatus = isApplying ? 'applying' : 'pending';
      
      setResourceStatuses(() => {
        const newMap = new Map();
        plannedResources.forEach(planned => {
          newMap.set(planned.address, initialStatus);
        });
        return newMap;
      });
    }

    // Only parse new lines
    const previousLength = lastParsedLengthRef.current;
    if (previousLength >= cleanedLogs.length) return;

    const previousText = cleanedLogs.substring(0, previousLength);
    const previousLines = previousText.split('\n').length;
    const allLines = cleanedLogs.split('\n');
    const newLines = allLines.slice(previousLines);

    if (newLines.length === 0) return;

     
    setResourceStatuses(prevStatuses => {
      const newStatuses = new Map(prevStatuses);
      const resourcesToAdd: AppliedResource[] = [];

      for (let i = 0; i < newLines.length; i++) {
        const line = newLines[i].trim();
        if (!line) continue;

        // Match resource creation starting - mark as applying
        const creatingMatch = line.match(/^([\w._-]+):\s+Creating/);
        if (creatingMatch) {
          const address = creatingMatch[1];
          newStatuses.set(address, 'applying');
          continue;
        }

        // Match resource creation complete - mark as completed
        const createMatch = line.match(/^([\w._-]+):\s+Creation complete after .*?(?:\[id=([^\]]+)\])?/);
        if (createMatch) {
          const address = createMatch[1];
          const id = createMatch[2] || undefined;
          newStatuses.set(address, 'completed');

          // Check if this resource was destroyed first (replace operation)
          const wasDestroyed = destroyedResourcesRef.current.has(address);
          const action: 'create' | 'replace' = wasDestroyed ? 'replace' : 'create';
          
          if (wasDestroyed) {
            destroyedResourcesRef.current.delete(address);
          }

          // Add to resources to add (duplicate check happens in setResources)
          resourcesToAdd.push({
            address,
            action,
            id,
            details: line,
            status: 'completed',
          });
          continue;
        }

        // Match resource modification starting - mark as applying
        const modifyingMatch = line.match(/^([\w._-]+):\s+Modifying/);
        if (modifyingMatch) {
          const address = modifyingMatch[1];
          newStatuses.set(address, 'applying');
          continue;
        }

        // Match resource modification/update complete - mark as completed
        const modifyMatch = line.match(/^([\w._-]+):\s+Modifications? complete after .*?(?:\[id=([^\]]+)\])?/);
        if (modifyMatch) {
          const address = modifyMatch[1];
          const id = modifyMatch[2] || undefined;
          newStatuses.set(address, 'completed');

          // Check if this resource was destroyed first (replace operation)
          const wasDestroyed = destroyedResourcesRef.current.has(address);
          const action: 'update' | 'replace' = wasDestroyed ? 'replace' : 'update';
          
          if (wasDestroyed) {
            destroyedResourcesRef.current.delete(address);
          }

          // Add to resources to add (duplicate check happens in setResources)
          resourcesToAdd.push({
            address,
            action,
            id,
            details: line,
            status: 'completed',
          });
          continue;
        }

        // Match resource destruction starting - mark as applying (same as Creating for apply)
        const destroyingMatch = line.match(/^([\w._-]+):\s+Destroying/);
        if (destroyingMatch) {
          const address = destroyingMatch[1];
          newStatuses.set(address, 'applying');
          // Add resource with applying state so it appears immediately (sequential destroy updates)
          resourcesToAdd.push({
            address,
            action: 'delete',
            details: line,
            status: 'applying',
          });
          continue;
        }

        // Match resource destruction complete - mark as completed
        const destroyMatch = line.match(/^([\w._-]+):\s+Destruction complete after/);
        if (destroyMatch) {
          const address = destroyMatch[1];
          newStatuses.set(address, 'completed');
          // Track this as a potential replace (will be removed if we see creation)
          destroyedResourcesRef.current.add(address);
          // Add to resourcesToAdd so setResources updates or adds with status completed
          const destroyLine = allLines.find(l => {
            const t = l.trim();
            return t.match(new RegExp(`^${address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s+Destruction complete`));
          });
          resourcesToAdd.push({
            address,
            action: 'delete',
            details: destroyLine?.trim(),
            status: 'completed',
          });
          continue;
        }

        // Match final summary line
        const summaryMatch = line.match(/Apply complete! Resources: (\d+) added, (\d+) changed, (\d+) destroyed/);
        if (summaryMatch) {
          summaryLineRef.current = {
            added: parseInt(summaryMatch[1], 10),
            changed: parseInt(summaryMatch[2], 10),
            destroyed: parseInt(summaryMatch[3], 10),
          };
          continue;
        }
      }

      // Update resources state (use functional update to avoid dependency on resources)
      setResources(prevResources => {
        const updated = [...prevResources];
        
        // Add new resources (check for duplicates)
        resourcesToAdd.forEach(newResource => {
          // Check if resource with same address and action already exists
          const existingIndex = updated.findIndex(r => r.address === newResource.address && r.action === newResource.action);
          if (existingIndex < 0) {
            // Also check if there's a conflicting action (e.g., replace vs create)
            const conflictingIndex = updated.findIndex(r => r.address === newResource.address && r.action !== newResource.action);
            if (conflictingIndex >= 0) {
              // Replace the conflicting entry (e.g., replace a create with replace)
              updated[conflictingIndex] = newResource;
            } else {
              updated.push(newResource);
            }
          } else {
            // Update existing entry
            updated[existingIndex] = { ...updated[existingIndex], ...newResource };
          }
        });

        // Handle resources that were destroyed but not recreated (true deletes)
        // Check resources that are still in destroyedResourcesRef
        destroyedResourcesRef.current.forEach(address => {
          // Check if we've seen a creation for this address in the new batch or existing resources
          const wasRecreated = resourcesToAdd.some(r => r.address === address && (r.action === 'create' || r.action === 'replace')) ||
            updated.some(r => r.address === address && (r.action === 'create' || r.action === 'replace'));
          
          if (!wasRecreated) {
            // Check if we already have it as delete
            const existingDelete = updated.findIndex(r => r.address === address && r.action === 'delete');
            if (existingDelete < 0) {
              // Find the destruction line to get details
              const destroyLine = allLines.find(l => {
                const trimmed = l.trim();
                return trimmed.match(new RegExp(`^${address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s+Destruction complete`));
              });
              updated.push({
                address,
                action: 'delete',
                details: destroyLine?.trim(),
                status: 'completed',
              });
            }
          } else {
            // Was recreated, remove from destroyedResourcesRef
            destroyedResourcesRef.current.delete(address);
            // Remove any delete entry if present
            const deleteIndex = updated.findIndex(r => r.address === address && r.action === 'delete');
            if (deleteIndex >= 0) {
              updated.splice(deleteIndex, 1);
            }
          }
        });

        return updated;
      });

      lastParsedLengthRef.current = cleanedLogs.length;
      return newStatuses;
    });
  }, [cleanedLogs, plannedResources, isApplying]);

  // Step 3: Recalculate summary when resources change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSummary(() => {
      // Only count resources that have completed (status === 'completed')
      // Summary badges should only show counts after resources complete, not while applying
      const completedResources = resources.filter(r => r.status === 'completed');
      
      const actualReplaces = completedResources.filter(r => r.action === 'replace').length;
      const actualAdds = completedResources.filter(r => r.action === 'create').length;
      const actualChanges = completedResources.filter(r => r.action === 'update').length;
      const actualDestroys = completedResources.filter(r => r.action === 'delete').length;
      const failedCount = Array.from(resourceStatuses.values()).filter(s => s === 'failed').length;
      
      return {
        add: actualAdds,
        change: actualChanges,
        destroy: actualDestroys,
        replace: actualReplaces,
        failed: failedCount,
        total: actualAdds + actualChanges + actualDestroys + actualReplaces,
      };
    });
  }, [resources, resourceStatuses]);

  // Step 4: Handle cancellation
  // Mark ALL non-completed resources as cancelled (pending, applying, and wrongly-marked failed).
  // When run was cancelled, in-progress resources are cancelled not failed; preserve that after refresh.
  useEffect(() => {
    if (!isCancelled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResourceStatuses(prev => {
      const newStatuses = new Map(prev);
      let changed = false;
      newStatuses.forEach((status, address) => {
        // Only 'completed' stays; everything else (pending, applying, failed) -> cancelled
        if (status !== 'completed') {
          newStatuses.set(address, 'cancelled');
          changed = true;
        }
      });
      // Also mark any planned resources that aren't in the status map yet
      plannedResources.forEach(planned => {
        if (!newStatuses.has(planned.address)) {
          newStatuses.set(planned.address, 'cancelled');
          changed = true;
        }
      });
      return changed ? newStatuses : prev;
    });
  }, [isCancelled, plannedResources]);

  // Step 5: Handle errors
  // This runs even when stored state is loaded to ensure errors are properly marked
  // When run was cancelled, do NOT overwrite with failed - logs may contain "context canceled" etc.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResourceStatuses(prev => {
      if (isCancelled) return prev; // Preserve cancelled state; don't mark as failed from parsed errors
      const newStatuses = new Map(prev);
      let changed = false;
      
      // If stored state has failed resources, ensure they're marked as failed
      if (applyState?.resources) {
        applyState.resources.forEach(res => {
          if (res.status === 'failed' && newStatuses.get(res.address) !== 'failed') {
            newStatuses.set(res.address, 'failed');
            changed = true;
          }
        });
      }
      
      // Handle specific resource errors from parsed errors
      if (errorParseResult.errors.length > 0) {
        errorParseResult.errors.forEach(error => {
          if (error.resource) {
            const matchingAddress = findMatchingResourceAddress(error.resource, plannedResources);
            const targetAddress = matchingAddress || error.resource;
            if (!newStatuses.has(targetAddress) || newStatuses.get(targetAddress) !== 'failed') {
              newStatuses.set(targetAddress, 'failed');
              changed = true;
            }
          }
        });
      }
      
      // If apply has failed overall, mark all applying resources as failed
      // This handles cases where errors don't have specific resource addresses (e.g., provider errors)
      // Only mark resources that were actively being applied (not pending ones that never started)
      if (isFailed) {
        newStatuses.forEach((status, address) => {
          if (status === 'applying') {
            newStatuses.set(address, 'failed');
            changed = true;
          }
        });
        // If we have errors but no specific resource matches, mark all planned resources as failed
        // This handles provider/initialization errors that affect all resources
        if (errorParseResult.errors.length > 0) {
          const hasResourceErrors = errorParseResult.errors.some(e => e.resource);
          if (!hasResourceErrors) {
            // No specific resource errors - likely a provider/initialization error affecting all resources
            plannedResources.forEach(planned => {
              const currentStatus = newStatuses.get(planned.address);
              // Only mark as failed if not already completed (completed resources succeeded before the error)
              if (currentStatus !== 'completed') {
                newStatuses.set(planned.address, 'failed');
                changed = true;
              }
            });
          }
        }
      }
      
      return changed ? newStatuses : prev;
    });
  }, [errorParseResult, plannedResources, isFailed, applyState, isCancelled]);

  // Backfill missing resources that started but didn't complete
  // Also update statuses for existing resources while preserving IDs and other data
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResources(prevResources => {
      const updated = [...prevResources];
      let changed = false;

      resourceStatuses.forEach((status, address) => {
        const existingResource = updated.find(r => r.address === address);
        if (!existingResource) {
          // Resource doesn't exist yet - create it
          // Determine action from logs
          let action: 'create' | 'update' | 'delete' | 'replace' = 'update';
          if (cleanedLogs.includes(`${address}: Creating`)) action = 'create';
          else if (cleanedLogs.includes(`${address}: Destroying`)) action = 'delete';

          updated.push({
            address,
            action,
            status,
          });
          changed = true;
        } else if (existingResource.status !== status) {
          // Resource exists but status changed - update status while preserving all other data (ID, details, etc.)
          updated[updated.indexOf(existingResource)] = {
            ...existingResource,
            status, // Update status but preserve ID, details, errorMessage, etc.
          };
          changed = true;
        }
      });

      return changed ? updated : prevResources;
    });
  }, [resourceStatuses, cleanedLogs]);

  const hasChanges = summary.total > 0;

  // Calculate total resources: use plannedResources.length if available, otherwise use summary.total
  const totalResources = plannedResources.length > 0 ? plannedResources.length : summary.total;

  return (
    <div className="space-y-6">

      {/* Summary - Compact horizontal layout */}
      <div className="flex flex-wrap items-center gap-3 pt-4">
        {preferences.showTotalChangesBadge && (
          <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-background">
            <span className="text-xl font-bold text-foreground">{totalResources}</span>
            <span className="text-sm text-muted-foreground">Total Resources</span>
          </div>
        )}
        {summary.add > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-green-500/10 border-green-500/20">
            <Plus className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-xl font-bold text-green-600 dark:text-green-400">{summary.add}</span>
            <span className="text-sm text-muted-foreground">Added</span>
          </div>
        )}
        {summary.change > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-blue-500/10 border-blue-500/20">
            <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{summary.change}</span>
            <span className="text-sm text-muted-foreground">Changed</span>
          </div>
        )}
        {summary.destroy > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-red-500/10 border-red-500/20">
            <Minus className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span className="text-xl font-bold text-red-600 dark:text-red-400">{summary.destroy}</span>
            <span className="text-sm text-muted-foreground">Destroyed</span>
          </div>
        )}
        {summary.replace > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-orange-500/10 border-orange-500/20">
            <RotateCw className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <span className="text-xl font-bold text-orange-600 dark:text-orange-400">{summary.replace}</span>
            <span className="text-sm text-muted-foreground">Replaced</span>
          </div>
        )}
        {summary.failed > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-red-500/10 border-red-500/20">
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span className="text-xl font-bold text-red-600 dark:text-red-400">{summary.failed}</span>
            <span className="text-sm text-muted-foreground">Failed</span>
          </div>
        )}
      </div>

      {/* Applied Resources - Show all planned resources with their status */}
      {plannedResources.length > 0 ? (
        <div className="space-y-4">
          <h4 className="text-md font-semibold flex items-center gap-2">
            <Package className="h-4 w-4" />
            Resources ({plannedResources.filter((planned) => {
              // Apply address filter
              if (addressFilter.trim() && !planned.address.toLowerCase().includes(addressFilter.toLowerCase())) {
                return false;
              }
              // Apply action filter
              if (actionFilter) {
                const hasReplace = planned.actions.includes('delete') && planned.actions.includes('create');
                if (actionFilter === 'replace') return hasReplace;
                if (actionFilter === 'create') return planned.actions.includes('create') && !hasReplace;
                if (actionFilter === 'update') return planned.actions.includes('update');
                if (actionFilter === 'delete') return planned.actions.includes('delete') && !hasReplace;
              }
              return true;
            }).length})
          </h4>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                id="apply-address-filter"
                name="apply-address-filter"
                placeholder="Filter resources by address..."
                value={addressFilter}
                onChange={(e) => setAddressFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background focus:outline-hidden focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <select
                id="apply-action-filter"
                name="apply-action-filter"
                value={actionFilter || ''}
                onChange={(e) => setActionFilter(e.target.value || null)}
                className="pl-9 pr-8 py-2 text-sm border rounded-md bg-background focus:outline-hidden focus:ring-2 focus:ring-primary appearance-none"
              >
                <option value="">Filter by action</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="replace">Replace</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {plannedResources
              .filter((planned) => {
                // Apply address filter
                if (addressFilter.trim() && !planned.address.toLowerCase().includes(addressFilter.toLowerCase())) {
                  return false;
                }
                // Apply action filter
                if (actionFilter) {
                  const hasReplace = planned.actions.includes('delete') && planned.actions.includes('create');
                  if (actionFilter === 'replace') return hasReplace;
                  if (actionFilter === 'create') return planned.actions.includes('create') && !hasReplace;
                  if (actionFilter === 'update') return planned.actions.includes('update');
                  if (actionFilter === 'delete') return planned.actions.includes('delete') && !hasReplace;
                }
                return true;
              })
              .map((planned) => {
                // Find if this resource has been applied
                const appliedResource = resources.find(r => r.address === planned.address);
                // Get status from status map (updated from logs) - this is the source of truth
                // Status map is updated in real-time as logs are parsed
                const statusFromMap = resourceStatuses.get(planned.address);
                // Priority: status map (from logs) > applied resource status > pending
                const rawStatus = statusFromMap || (appliedResource?.status && appliedResource.status !== 'pending' ? appliedResource.status : 'pending');
                // Terminal-run override so a resource can't spin/idle forever after the run ends.
                const status = resolveTerminalResourceStatus(rawStatus, { isCancelled, isFailed });

                // Determine action from planned actions
                const hasReplace = planned.actions.includes('delete') && planned.actions.includes('create');
                const hasUpdate = planned.actions.includes('update');
                const action: 'create' | 'update' | 'delete' | 'replace' =
                  hasReplace ? 'replace' :
                    hasUpdate ? 'update' :
                      planned.actions.includes('create') ? 'create' :
                        planned.actions.includes('delete') ? 'delete' :
                          'create'; // fallback

                // Check for error details in parsed errors
                // Use fuzzy matching to handle module prefix mismatches in error messages
                const resourceError = errorParseResult.errors.find(e => {
                  if (!e.resource) return false;
                  // Try exact match first
                  if (e.resource === planned.address) return true;
                  // Try fuzzy matching
                  const matchingAddress = findMatchingResourceAddress(e.resource, [planned]);
                  return matchingAddress === planned.address;
                });
                const errorMessage = resourceError ? resourceError.message : undefined;

                const resource: AppliedResource = {
                  address: planned.address,
                  action,
                  type: planned.type,
                  status: status,
                  id: appliedResource?.id,
                  details: appliedResource?.details,
                  errorMessage: errorMessage,
                };

                return (
                  <AppliedResourceCard key={planned.address} resource={resource} />
                );
              })}
          </div>
        </div>
      ) : hasChanges ? (
        <div className="space-y-4">
          <h4 className="text-md font-semibold flex items-center gap-2">
            <Package className="h-4 w-4" />
            Applied Resources ({totalResources})
          </h4>
          <div className="space-y-3">
            {resources.map((resource, idx) => {
              // Same terminal-run override as the planned-resource view.
              const status = resolveTerminalResourceStatus(resource.status, { isCancelled, isFailed });
              return (
                <AppliedResourceCard key={`${resource.address}-${idx}`} resource={{ ...resource, status }} />
              );
            })}
          </div>
        </div>
      ) : (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No resources were modified</p>
          <p className="text-sm mt-1">This apply made no changes to your infrastructure.</p>
        </div>
      )}

      {/* Outputs Section - Show after resources */}
      {outputsToShow.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-md font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Outputs ({outputsToShow.length})
          </h4>
          <div className="space-y-3">
            {outputsToShow.map((output) => {
              // Format value for display
              let displayValue: string;
              if (output.sensitive) {
                displayValue = '***';
              } else if (output.value === null || output.value === undefined) {
                displayValue = 'null';
              } else if (typeof output.value === 'object' && output.value !== null) {
                // Already parsed object - stringify it
                displayValue = JSON.stringify(output.value, null, 2);
              } else if (typeof output.value === 'string') {
                // String value - check if it's a stringified object/HCL that needs parsing
                const strValue = output.value;
                // Check if it looks like HCL format (contains "key = value" pattern)
                if (strValue.includes('=') && (strValue.includes('{') || strValue.trim().startsWith('{'))) {
                  // Try to parse as HCL and convert to JSON
                  try {
                    // Remove outer quotes if present
                    let cleaned = strValue.trim();
                    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
                      cleaned = cleaned.slice(1, -1);
                    }
                    // Unescape newlines
                    cleaned = cleaned.replace(/\\n/g, '\n');

                    // Try parsing as JSON first
                    try {
                      const parsed: unknown = JSON.parse(cleaned);
                      displayValue = JSON.stringify(parsed, null, 2);
                    } catch {
                      // Not JSON, try HCL parsing
                      const hclToJson = (hcl: string): unknown => {
                        let hclCleaned = hcl.trim();
                        if (hclCleaned.startsWith('{') && hclCleaned.endsWith('}')) {
                          hclCleaned = hclCleaned.slice(1, -1).trim();
                        }
                        if (!hclCleaned) return {};

                        const result: Record<string, unknown> = {};
                        const lines = hclCleaned.split('\n').map(l => l.trim()).filter(l => l);

                        for (const line of lines) {
                          const match = line.match(/^(\w+)\s*=\s*(.+)$/);
                          if (match) {
                            const key = match[1];
                            let val = match[2].trim();
                            // Remove quotes
                            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                              val = val.slice(1, -1);
                            }
                            result[key] = val;
                          }
                        }
                        // If we couldn't parse anything, return the original string instead of empty object
                        if (Object.keys(result).length === 0) {
                          return cleaned;
                        }
                        return result;
                      };

                      const parsed = hclToJson(cleaned);
                      // If parsing resulted in empty object or string, use the original
                      if (typeof parsed === 'string') {
                        displayValue = parsed;
                      } else if (typeof parsed === 'object' && parsed !== null && Object.keys(parsed).length === 0) {
                        displayValue = cleaned;
                      } else {
                        displayValue = JSON.stringify(parsed, null, 2);
                      }
                    }
                  } catch {
                    // If all parsing fails, just show the string
                    displayValue = strValue;
                  }
                } else {
                  // Plain string value
                  displayValue = strValue;
                }
              } else {
                // Primitive value (number, boolean) or other types
                const value = output.value;
                if (value === null) {
                  displayValue = 'null';
                } else if (value === undefined) {
                  displayValue = 'undefined';
                } else if (typeof value === 'object') {
                  // Objects (including arrays)
                  displayValue = JSON.stringify(value, null, 2);
                } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                  displayValue = String(value);
                } else if (typeof value === 'symbol') {
                  displayValue = value.toString();
                } else if (typeof value === 'function') {
                  displayValue = value.toString();
                } else {
                  // Fallback - should never reach here, but handle gracefully
                  // At this point, value cannot be an object (already checked above)
                  // TypeScript doesn't know this, so we use a type assertion
                  const safeValue = value as string | number | boolean | null | undefined;
                  displayValue = safeValue === null || safeValue === undefined
                    ? String(safeValue)
                    : String(safeValue);
                }
              }

              return (
                <div key={output.key} className="border rounded-lg p-4 bg-background hover:border-primary/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          {output.key}
                        </span>
                        {output.sensitive && (
                          <span className="text-xs px-2 py-0.5 rounded-sm bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                            Sensitive
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-mono text-foreground bg-muted/30 p-2 rounded-sm whitespace-pre-wrap break-all">
                        {displayValue}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Raw Output Viewer Toggle - Same styling as plan outputs with toggle buttons */}
      {showJsonViewer && (
        <div className="border-t pt-4">
          <button
            onClick={() => setJsonExpanded(!jsonExpanded)}
            className="w-full flex items-center justify-between p-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
          >
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              View Raw Output
            </span>
            {jsonExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {jsonExpanded && (
            <div className="mt-3 space-y-3">
              {/* Toggle buttons for JSON vs Terminal view - Terminal first */}
              {/* Always show toggle buttons, even if logs are empty */}
              <div className="flex items-center gap-2 border-b pb-2">
                <button
                  onClick={() => setRawOutputView('terminal')}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-md transition-colors",
                    rawOutputView === 'terminal'
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  )}
                >
                  Terminal
                </button>
                <button
                  onClick={() => setRawOutputView('json')}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-md transition-colors",
                    rawOutputView === 'json'
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  )}
                >
                  JSON
                </button>
              </div>
              {/* Show JSON or Terminal view based on selection */}
              {rawOutputView === 'terminal' && logs && logs.trim().length > 0 ? (
                <TerminalOutput content={logs} isStreaming={false} />
              ) : rawOutputView === 'json' && logs && logs.trim().length > 0 ? (
                (() => {
                  // Extract only JSON objects from JSONL format (skip plain text lines)
                  const lines = logs.split('\n');
                  const jsonObjects: unknown[] = [];
                  for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    try {
                      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                      const parsed = JSON.parse(trimmed);
                      jsonObjects.push(parsed);
                    } catch {
                      // Skip plain text lines - only show JSON objects in JSON tab
                      continue;
                    }
                  }
                  // Pass array of JSON objects to JsonViewer
                  // This will render as a JSON array, showing only structured logs (no plain text section)
                  return (
                    <JsonViewer
                      data={jsonObjects}
                      title=""
                      defaultExpanded={true}
                      maxHeight="600px"
                      showControls={true}
                    />
                  );
                })()
              ) : (
                // Show message when no raw output is available (e.g., cancelled before streaming)
                <div className="border rounded-lg p-8 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No raw output was generated</p>
                  <p className="text-sm mt-1">
                    {isCancelled 
                      ? "The run was cancelled before any output could be generated."
                      : "No output logs are available for this apply phase."}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

