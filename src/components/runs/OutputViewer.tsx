// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useMemo, useState, useEffect } from 'react';
import {
  Plus,
  Minus,
  ArrowRight,
  CheckCircle2,
  Package,
  FileText,
  ChevronRight,
  ChevronDown,
  Search,
  Filter,
  RotateCw,
  Copy,
  ArrowLeftRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { JsonViewer } from './JsonViewer';
import { ResourceDiffView } from './ResourceDiffView';
import { ProviderIcon } from './ProviderIcon';
import { TerminalOutput } from './TerminalOutput';
import { useRunDisplayPreferences } from '@/contexts/RunDisplayPreferencesContext';
import { Checkbox } from '@/components/ui/checkbox';
import { JsonSyntaxHighlighter } from '@/components/code/JsonSyntaxHighlighter';

interface OutputViewerProps {
  data: Record<string, unknown>;
  showJsonViewer?: boolean;
  title?: string; // Optional title (defaults to "Terraform Plan" for plan output)
  logs?: string; // Optional raw logs for terminal view (plan phase output)
  runId?: string; // Run ID for localStorage persistence
}

interface ResourceChange {
  address: string;
  type: string;
  name: string;
  mode: string;
  provider_name?: string;
  change: {
    actions: string[];
    before: unknown;
    after: unknown;
    after_unknown?: Record<string, unknown>;
    before_sensitive?: boolean;
    after_sensitive?: Record<string, unknown>;
  };
}

interface OutputChange {
  name: string;
  action: string; // 'create' | 'update' | 'delete' | 'no-op'
  before: unknown;
  after: unknown;
}

interface PlanSummary {
  add: number;
  change: number;
  destroy: number;
  replace: number;
  total: number; // Total number of changes (sum of all change types)
  resourceCount: number; // Total number of resources being changed
  outputChanges: number; // Number of output changes
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
      return <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    case 'delete':
      return <Minus className="h-4 w-4" />;
    case 'replace':
      // Use RotateCw icon for replace/recreate operations
      return <RotateCw className="h-4 w-4" />;
    default:
      return <Package className="h-4 w-4" />;
  }
}

function formatAction(actions: string[]): string {
  // Check if it's a replace (both delete and create)
  const hasReplace = actions.includes('delete') && actions.includes('create');
  if (hasReplace) {
    return 'Replace';
  }
  if (actions.length === 1) {
    return actions[0].charAt(0).toUpperCase() + actions[0].slice(1);
  }
  return actions.map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(' + ');
}

function ResourceChangeCard({ resource }: { resource: ResourceChange }) {
  const [showDetails, setShowDetails] = useState(false);
  const { preferences } = useRunDisplayPreferences();

  const actions = resource.change?.actions || [];
  const isDataSource = resource.mode === 'data';
  
  // Determine primary action for color coding:
  // - If actions include both delete and create, it's a replace (orange)
  // - If actions include update, it's a change (blue)
  // - Otherwise use the first action
  const hasReplace = actions.includes('delete') && actions.includes('create');
  const hasUpdate = actions.includes('update');
  const primaryAction = hasReplace ? 'replace' : hasUpdate ? 'update' : (actions[0] || 'unknown');
  const hasChanges = resource.change?.before !== null || resource.change?.after !== null;
  const isCreate = actions.includes('create') && !hasReplace;
  const isDelete = actions.includes('delete') && !hasReplace;

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden hover:border-primary/50 transition-colors",
        hasChanges && "cursor-pointer"
      )}
      onClick={() => hasChanges && setShowDetails(!showDetails)}
    >
      <div className={cn(
        "px-4 transition-all",
        showDetails && hasChanges ? "py-4" : "py-3"
      )}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {/* Provider Icon */}
              <ProviderIcon providerName={resource.provider_name} resourceType={resource.type} className="h-4 w-4" />

              {/* Data Source Icon or Action Badge with Icon */}
              {isDataSource ? (
                <span className="px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 text-gray-600 dark:text-gray-400 bg-gray-500/10">
                  <ArrowLeftRight className="h-4 w-4" />
                </span>
              ) : (
                <span className={cn(
                  "px-2 py-1 rounded-md text-xs font-medium flex items-center",
                  preferences.showActionText ? "gap-1" : "justify-center",
                  getActionColor(primaryAction)
                )}>
                  {getActionIcon(primaryAction)}
                  {preferences.showActionText && formatAction(actions)}
                </span>
              )}

              {/* Resource Address */}
              <span className="text-sm font-mono text-muted-foreground truncate">
                {resource.address}
              </span>
            </div>
          </div>
          {(hasChanges || (isDataSource && resource.change?.after !== null && resource.change?.after !== undefined)) && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void navigator.clipboard.writeText(resource.address).then(() => {
                    toast.success(`Copied resource address: ${resource.address}`);
                  }).catch((err) => {
                    console.error('Failed to copy to clipboard:', err);
                    toast.error('Failed to copy to clipboard');
                  });
                }}
                className="p-1 hover:bg-muted rounded transition-colors"
                title={`Copy resource address: ${resource.address}`}
              >
                <Copy className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetails(!showDetails);
                }}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                {showDetails ? <ChevronDown className="h-4 w-4 rotate-180 transition-transform" /> : <ChevronDown className="h-4 w-4 transition-transform" />}
              </button>
            </div>
          )}
        </div>

        {showDetails && (hasChanges || (isDataSource && resource.change?.after !== null && resource.change?.after !== undefined)) && (
          isDataSource ? (
            <div className="mt-4 border-t pt-4">
              {/* Match ResourceDiffView styling: bg-muted/30, text-sm, max-h-[500px] */}
              <div className="bg-muted/30 border rounded-md overflow-hidden">
                <div className="p-4 overflow-auto max-h-[500px] relative">
                  <JsonSyntaxHighlighter 
                    json={JSON.stringify(resource.change?.after || {}, null, 2)} 
                    maxHeight="none"
                    className="text-sm bg-transparent p-0"
                  />
                </div>
              </div>
            </div>
          ) : (
            <ResourceDiffView
              before={resource.change?.before}
              after={resource.change?.after}
              afterUnknown={resource.change?.after_unknown}
              isCreate={isCreate}
              isDelete={isDelete}
              resourceAddress={resource.address}
            />
          )
        )}
      </div>
    </div>
  );
}

function OutputChangeCard({ output }: { output: OutputChange }) {
  const [showDetails, setShowDetails] = useState(false);
  const { preferences } = useRunDisplayPreferences();

  const hasValues = output.before !== null || output.after !== null;

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden hover:border-primary/50 transition-colors",
        hasValues && "cursor-pointer"
      )}
      onClick={() => hasValues && setShowDetails(!showDetails)}
    >
      <div className={cn(
        "px-4 transition-all",
        showDetails && hasValues ? "py-4" : "py-3"
      )}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {/* Provider Icon - outputs are Terraform-level, use terraform icon */}
              <ProviderIcon providerName="terraform" className="h-4 w-4" />

              {/* Action Badge with Icon */}
              <span className={cn(
                "px-2 py-1 rounded-md text-xs font-medium flex items-center",
                preferences.showActionText ? "gap-1" : "justify-center",
                getActionColor(output.action)
              )}>
                {getActionIcon(output.action)}
                {preferences.showActionText && (output.action.charAt(0).toUpperCase() + output.action.slice(1))}
              </span>

              {/* Output Address */}
              <span className="text-sm font-mono text-muted-foreground truncate">
                output.{output.name}
              </span>
            </div>
          </div>
          {hasValues && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void navigator.clipboard.writeText(`output.${output.name}`).then(() => {
                    toast.success(`Copied output name: output.${output.name}`);
                  }).catch((err: unknown) => {
                    console.error('Failed to copy to clipboard:', err);
                    toast.error('Failed to copy to clipboard');
                  });
                }}
                className="p-1 hover:bg-muted rounded transition-colors"
                title={`Copy output name: output.${output.name}`}
              >
                <Copy className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetails(!showDetails);
                }}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                {showDetails ? <ChevronDown className="h-4 w-4 rotate-180 transition-transform" /> : <ChevronDown className="h-4 w-4 transition-transform" />}
              </button>
            </div>
          )}
        </div>

        {showDetails && hasValues && (
          <div className="mt-4 border-t pt-4">
            <div className="bg-muted/30 border rounded-md overflow-hidden">
              <div className="p-4 overflow-auto max-h-[500px] space-y-3">
                {output.action === 'create' ? (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Value</div>
                    <JsonSyntaxHighlighter
                      json={JSON.stringify(output.after ?? null, null, 2)}
                      maxHeight="none"
                      className="text-sm bg-transparent p-0"
                    />
                  </div>
                ) : output.action === 'delete' ? (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Previous Value</div>
                    <JsonSyntaxHighlighter
                      json={JSON.stringify(output.before ?? null, null, 2)}
                      maxHeight="none"
                      className="text-sm bg-transparent p-0"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="text-xs font-medium text-red-500 mb-1 flex items-center gap-1">
                        <Minus className="h-3 w-3" /> Before
                      </div>
                      <JsonSyntaxHighlighter
                        json={JSON.stringify(output.before ?? null, null, 2)}
                        maxHeight="none"
                        className="text-sm bg-transparent p-0"
                      />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-green-500 mb-1 flex items-center gap-1">
                        <Plus className="h-3 w-3" /> After
                      </div>
                      <JsonSyntaxHighlighter
                        json={JSON.stringify(output.after ?? null, null, 2)}
                        maxHeight="none"
                        className="text-sm bg-transparent p-0"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function OutputViewer({ data, showJsonViewer = true, title = "Terraform Plan", logs, runId }: OutputViewerProps) {
  const [viewMode] = useState<'readable' | 'json'>('readable');
  
  // Load UI state from localStorage on mount (per-run basis)
  const getStoredUIState = (): { rawOutputView: 'plan' | 'terminal' | 'json'; rawOutputExpanded: boolean } => {
    if (!runId) return { rawOutputView: 'plan', rawOutputExpanded: false };
    try {
      const stored = localStorage.getItem(`run-${runId}-plan-ui-state`);
      if (stored) {
        const parsed = JSON.parse(stored) as { rawOutputView?: 'plan' | 'terminal' | 'json'; rawOutputExpanded?: boolean };
        return {
          rawOutputView: parsed.rawOutputView ?? 'plan',
          rawOutputExpanded: parsed.rawOutputExpanded ?? false,
        };
      }
    } catch (error) {
      console.error('Failed to load UI state from localStorage:', error);
    }
    return { rawOutputView: 'plan', rawOutputExpanded: false };
  };

  const storedUIState = getStoredUIState();
  const [rawOutputView, setRawOutputView] = useState<'plan' | 'terminal' | 'json'>(storedUIState.rawOutputView);
  const [rawOutputExpanded, setRawOutputExpanded] = useState(storedUIState.rawOutputExpanded);
  const [addressFilter, setAddressFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [showDataSources, setShowDataSources] = useState(false);
  const { preferences } = useRunDisplayPreferences();

  // Persist UI state to localStorage when it changes
  useEffect(() => {
    if (!runId) return;
    try {
      localStorage.setItem(`run-${runId}-plan-ui-state`, JSON.stringify({
        rawOutputView,
        rawOutputExpanded,
      }));
    } catch (error) {
      console.error('Failed to save UI state to localStorage:', error);
    }
  }, [rawOutputView, rawOutputExpanded, runId]);

  const summary = useMemo<PlanSummary>(() => {
    const resourceChanges = (data.resource_changes as ResourceChange[]) || [];
    const summary: PlanSummary = {
      add: 0,
      change: 0,
      destroy: 0,
      replace: 0,
      total: 0, // Will be calculated as sum of all changes
      resourceCount: resourceChanges.length, // Number of resources
      outputChanges: 0, // Will be calculated from output_changes
    };

    resourceChanges.forEach((resource) => {
      if (resource.change && Array.isArray(resource.change.actions)) {
        const actions = resource.change.actions;
        // Check if this is a replace (both delete and create)
        const hasReplace = actions.includes('delete') && actions.includes('create');

        if (hasReplace) {
          // Count as replace, not as separate add and destroy
          summary.replace++;
        } else {
          // Count individual actions
          actions.forEach((action) => {
            if (action === 'create') summary.add++;
            else if (action === 'update') summary.change++;
            else if (action === 'delete') summary.destroy++;
            else if (action === 'replace') summary.replace++;
          });
        }
      }
    });

    // Total changes is the sum of all change types (not the number of resources)
    summary.total = summary.add + summary.change + summary.destroy + summary.replace;

    // Count output changes
    const outputChangesMap = data.output_changes as Record<string, { actions: string[] }> | undefined;
    if (outputChangesMap && typeof outputChangesMap === 'object') {
      Object.values(outputChangesMap).forEach((change) => {
        if (change && Array.isArray(change.actions)) {
          const hasNonNoOp = change.actions.some((a: string) => a !== 'no-op');
          if (hasNonNoOp) {
            summary.outputChanges++;
          }
        }
      });
    }

    return summary;
  }, [data]);

  // Parse output changes for display
  const outputChanges = useMemo<OutputChange[]>(() => {
    const outputChangesMap = data.output_changes as Record<string, { actions: string[]; before: unknown; after: unknown }> | undefined;
    if (!outputChangesMap || typeof outputChangesMap !== 'object') return [];

    const changes: OutputChange[] = [];
    Object.entries(outputChangesMap).forEach(([name, change]) => {
      if (change && Array.isArray(change.actions)) {
        const nonNoOp = change.actions.find((a: string) => a !== 'no-op');
        if (nonNoOp) {
          changes.push({
            name,
            action: nonNoOp,
            before: change.before,
            after: change.after,
          });
        }
      }
    });
    return changes.sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const resourceChanges = useMemo(() => {
    // Terraform 1.2+ format: resource_changes might be missing when there are no changes
    // Extract data sources from configuration.root_module.resources when needed
    let changes = data.resource_changes;
    
    // Helper function to traverse modules and collect all resources with their full addresses
    type ModuleStructure = {
      address?: string;
      resources?: Array<{ address: string; [key: string]: unknown }>;
      child_modules?: Array<ModuleStructure & { address?: string }>;
    };
    
    const collectResourcesFromModule = (
      module: ModuleStructure
    ): Array<{ address: string; [key: string]: unknown }> => {
      const resources: Array<{ address: string; [key: string]: unknown }> = [];
      
      // Add resources from this module
      // Terraform plan output already includes full addresses (e.g., "module.proxmox_test.data.proxmox_virtual_environment_version.version")
      if (module.resources && Array.isArray(module.resources)) {
        resources.push(...module.resources);
      }
      
      // Traverse child modules recursively
      if (module.child_modules && Array.isArray(module.child_modules)) {
        module.child_modules.forEach((childModule) => {
          if (childModule && typeof childModule === 'object') {
            resources.push(...collectResourcesFromModule(childModule as ModuleStructure));
          }
        });
      }
      
      return resources;
    };
    
    // When data sources are requested, extract from configuration (including from modules)
    // This ensures data sources in modules are also found
    if (showDataSources) {
      console.log('[OutputViewer] showDataSources enabled, extracting data sources...');
      console.log('[OutputViewer] Full data structure:', data);
      console.log('[OutputViewer] resource_changes:', data.resource_changes);
      console.log('[OutputViewer] planned_values:', data.planned_values);
      console.log('[OutputViewer] prior_state:', data.prior_state);
      
      const configuration = data.configuration as { root_module?: { 
        resources?: Array<{
          address: string;
          mode: string;
          type: string;
          name: string;
          provider_config_key?: string;
        }>;
        child_modules?: Array<{
          address?: string;
          resources?: Array<{
            address: string;
            mode: string;
            type: string;
            name: string;
            provider_config_key?: string;
          }>;
          child_modules?: Array<unknown>;
        }>;
      } } | undefined;
      
      console.log('[OutputViewer] configuration:', configuration);
      console.log('[OutputViewer] configuration.root_module:', configuration?.root_module);
      console.log('[OutputViewer] configuration.root_module keys:', configuration?.root_module ? Object.keys(configuration.root_module) : 'none');
      console.log('[OutputViewer] configuration.root_module?.child_modules:', configuration?.root_module?.child_modules);
      console.log('[OutputViewer] configuration.root_module?.resources:', configuration?.root_module?.resources);
      
      // Check if data sources are already in resource_changes
      if (Array.isArray(data.resource_changes)) {
        const dataSourcesInChanges = (data.resource_changes as ResourceChange[]).filter(r => r.mode === 'data');
        console.log('[OutputViewer] Data sources already in resource_changes:', dataSourcesInChanges.length, dataSourcesInChanges.map(ds => ds.address));
      }
      
      // Inspect planned_values structure
      console.log('[OutputViewer] planned_values.root_module:', (data.planned_values as { root_module?: unknown })?.root_module);
      console.log('[OutputViewer] planned_values.root_module keys:', (data.planned_values as { root_module?: { [key: string]: unknown } })?.root_module ? Object.keys((data.planned_values as { root_module: { [key: string]: unknown } }).root_module) : 'none');
      console.log('[OutputViewer] planned_values.root_module.child_modules:', (data.planned_values as { root_module?: { child_modules?: unknown[] } })?.root_module?.child_modules);
      
      // Deep inspect child_modules structure
      const childModules = (data.planned_values as { root_module?: { child_modules?: Array<{ address?: string; resources?: Array<{ address?: string; mode?: string; [key: string]: unknown }> }> } })?.root_module?.child_modules;
      if (childModules) {
        childModules.forEach((childModule, idx) => {
          console.log(`[OutputViewer] child_modules[${idx}]:`, {
            address: childModule.address,
            hasResources: 'resources' in childModule,
            resourcesCount: Array.isArray(childModule.resources) ? childModule.resources.length : 0,
          });
          if (Array.isArray(childModule.resources)) {
            childModule.resources.forEach((resource, rIdx) => {
              console.log(`[OutputViewer] child_modules[${idx}].resources[${rIdx}]:`, {
                address: resource.address,
                mode: resource.mode,
                keys: Object.keys(resource),
              });
            });
          }
        });
      }
      
      // Inspect prior_state structure
      console.log('[OutputViewer] prior_state.values:', (data.prior_state as { values?: unknown })?.values);
      console.log('[OutputViewer] prior_state.values.root_module:', (data.prior_state as { values?: { root_module?: unknown } })?.values?.root_module);
      if ((data.prior_state as { values?: { root_module?: { [key: string]: unknown } } })?.values?.root_module) {
        console.log('[OutputViewer] prior_state.values.root_module keys:', Object.keys((data.prior_state as { values: { root_module: { [key: string]: unknown } } }).values.root_module));
      }
      
      // Also check prior_state and planned_values for data source values
      const priorState = data.prior_state as { values?: { 
        root_module?: { 
          resources?: Array<{
            address: string;
            mode: string;
            values?: Record<string, unknown>;
          }>;
          child_modules?: Array<{
            address?: string;
            resources?: Array<{
              address: string;
              mode: string;
              values?: Record<string, unknown>;
            }>;
            child_modules?: Array<unknown>;
          }>;
        } 
      } } | undefined;
      
      const plannedValues = data.planned_values as { 
        root_module?: { 
          resources?: Array<{
            address: string;
            mode: string;
            values?: Record<string, unknown>;
          }>;
          child_modules?: Array<{
            address?: string;
            resources?: Array<{
              address: string;
              mode: string;
              values?: Record<string, unknown>;
            }>;
            child_modules?: Array<unknown>;
          }>;
        } 
      } | undefined;
      
      // NOTE: Terraform plan output structure:
      // - configuration.root_module: Contains module_calls, outputs, variables (NO resources)
      // - planned_values.root_module: Contains child_modules with resources (including data sources)
      // - prior_state.values.root_module: Contains child_modules with resources (including data sources)
      // Data sources are found in planned_values/prior_state, NOT in configuration
      
      // Collect all resources from planned_values and prior_state (these contain actual resource data)
      const plannedResources = plannedValues?.root_module ? collectResourcesFromModule(plannedValues.root_module as ModuleStructure) : [];
      const priorResources = priorState?.values?.root_module ? collectResourcesFromModule(priorState.values.root_module as ModuleStructure) : [];
      
      // Configuration doesn't have resources, but we can use it to get resource metadata if needed
      // For now, we'll extract from planned_values/prior_state which have the actual resource instances
      
      console.log('[OutputViewer] plannedResources collected:', plannedResources.length, plannedResources);
      console.log('[OutputViewer] priorResources collected:', priorResources.length, priorResources);
      plannedResources.forEach((r, i) => {
        console.log(`[OutputViewer] plannedResources[${i}]:`, {
          address: r.address,
          mode: (r as { mode?: string }).mode,
          hasMode: 'mode' in r,
          keys: Object.keys(r),
        });
      });
      priorResources.forEach((r, i) => {
        console.log(`[OutputViewer] priorResources[${i}]:`, {
          address: r.address,
          mode: (r as { mode?: string }).mode,
          hasMode: 'mode' in r,
          keys: Object.keys(r),
        });
      });
      
      // Extract data sources from both planned_values AND prior_state
      // Data sources might be in prior_state if they were read in a previous run but not changing in current plan
      // Data sources can be identified by:
      // 1. mode === 'data' property, OR
      // 2. address starting with 'data.' or containing '.data.'
      const allResources = [...plannedResources, ...priorResources.filter(pr => 
        !plannedResources.some(pl => pl.address === pr.address)
      )]; // Merge, avoiding duplicates
      
      const dataSources = allResources
        .filter(r => {
          const resourceMode = (r as { mode?: string }).mode;
          const address = r.address || '';
          // Check both mode property and address pattern
          const isDataByMode = resourceMode === 'data';
          const isDataByAddress = address.includes('.data.') || address.startsWith('data.');
          const isData = isDataByMode || isDataByAddress;
          if (isData) {
            console.log('[OutputViewer] Found data source:', {
              address,
              mode: resourceMode,
              isDataByMode,
              isDataByAddress,
              full: r,
            });
          }
          return isData;
        })
        .map(r => {
          // Find the actual values from prior_state or planned_values
          const priorResource = priorResources.find(pr => pr.address === r.address) as { values?: Record<string, unknown> } | undefined;
          const plannedResource = plannedResources.find(pr => pr.address === r.address) as { values?: Record<string, unknown> } | undefined;
          const values = plannedResource?.values || priorResource?.values;
          
          // Extract type and name from address (format: "module.x.data.type.name" or "data.type.name")
          const addressParts = r.address.split('.');
          let type = '';
          let name = '';
          if (addressParts.length >= 2) {
            // Find the "data" keyword and extract type/name after it
            const dataIndex = addressParts.indexOf('data');
            if (dataIndex >= 0 && dataIndex + 2 < addressParts.length) {
              type = addressParts[dataIndex + 1] || '';
              name = addressParts[dataIndex + 2] || '';
            }
          }
          
          return {
            address: r.address,
            mode: (r as { mode?: string }).mode || 'data',
            type: (r as { type?: string }).type || type,
            name: (r as { name?: string }).name || name,
            provider_name: (r as { provider_config_key?: string }).provider_config_key ? `registry.terraform.io/${(r as { provider_config_key?: string }).provider_config_key}` : undefined,
            change: {
              actions: ['read'] as string[],
              before: priorResource?.values || null,
              after: values || null,
              after_unknown: {},
              before_sensitive: false,
              after_sensitive: {},
            },
          } as ResourceChange;
        });
      
      console.log('[OutputViewer] dataSources found:', dataSources.length, dataSources.map(ds => ds.address));
      console.log('[OutputViewer] existing changes:', Array.isArray(changes) ? (changes as ResourceChange[]).length : 'not array', Array.isArray(changes) ? (changes as ResourceChange[]).map(r => r.address) : changes);
      
      if (dataSources.length > 0) {
        // If resource_changes exists, merge data sources with it
        // Otherwise, use only data sources
        if (Array.isArray(changes)) {
          // Merge: combine resource_changes with extracted data sources, avoiding duplicates
          const existingAddresses = new Set((changes as ResourceChange[]).map(r => r.address));
          console.log('[OutputViewer] existingAddresses:', Array.from(existingAddresses));
          const newDataSources = dataSources.filter(ds => !existingAddresses.has(ds.address));
          console.log('[OutputViewer] newDataSources to add:', newDataSources.length, newDataSources.map(ds => ds.address));
          changes = [...(changes as ResourceChange[]), ...newDataSources];
          console.log('[OutputViewer] merged changes length:', Array.isArray(changes) ? changes.length : 0);
        } else {
          changes = dataSources;
          console.log('[OutputViewer] using only dataSources:', Array.isArray(changes) ? changes.length : 0);
        }
      } else {
        console.log('[OutputViewer] No data sources found in configuration');
      }
    }
    
    if (!changes || !Array.isArray(changes)) {
      console.log('[OutputViewer] No changes array, returning empty');
      return [];
    }
    
    console.log('[OutputViewer] Before filtering, changes length:', Array.isArray(changes) ? changes.length : 0, 'showDataSources:', showDataSources);
    
    // Filter resources: show data sources when enabled, filter out no-op managed resources
    const changesArray = Array.isArray(changes) ? (changes as ResourceChange[]) : [];
    let filtered = changesArray.filter((resource) => {
      const isDataSource = resource.mode === 'data';
      
      // Data sources: only show if checkbox is enabled
      if (isDataSource) {
        console.log('[OutputViewer] Data source in filter:', resource.address, 'showDataSources:', showDataSources);
        return showDataSources;
      }
      
      // Managed resources: filter out no-op resources
      const actions = resource.change?.actions || [];
      if (actions.length === 0 || actions.every(a => a === 'no-op')) {
        return false;
      }
      
      return true;
    });

    // Apply address filter
    if (addressFilter.trim()) {
      filtered = filtered.filter((resource) =>
        resource.address.toLowerCase().includes(addressFilter.toLowerCase())
      );
    }

    // Apply action filter (only for non-data sources)
    if (actionFilter) {
      filtered = filtered.filter((resource) => {
        const isDataSource = resource.mode === 'data';
        // Don't filter data sources by action
        if (isDataSource) return true;
        
        const actions = resource.change?.actions || [];
        const hasReplace = actions.includes('delete') && actions.includes('create');
        if (actionFilter === 'replace') return hasReplace;
        if (actionFilter === 'create') return actions.includes('create') && !hasReplace;
        if (actionFilter === 'update') return actions.includes('update');
        if (actionFilter === 'delete') return actions.includes('delete') && !hasReplace;
        return true;
      });
    }

    console.log('[OutputViewer] Final filtered resources:', filtered.length, filtered.map(r => ({ address: r.address, mode: r.mode })));
    return filtered;
  }, [data, addressFilter, actionFilter, showDataSources]);

  const hasChanges = summary.total > 0 || summary.outputChanges > 0;

  return (
    <div className="space-y-6">

      {viewMode === 'readable' ? (
        <>
          {/* Summary - Compact horizontal layout */}
          <div className="flex flex-wrap items-center gap-3">
            {preferences.showTotalChangesBadge && (
              <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-background">
                <span className="text-xl font-bold text-foreground">{summary.total}</span>
                <span className="text-sm text-muted-foreground">Total Changes</span>
              </div>
            )}
            {summary.add > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-green-500/10 border-green-500/20">
                <Plus className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-xl font-bold text-green-600 dark:text-green-400">{summary.add}</span>
                <span className="text-sm text-muted-foreground">To Add</span>
              </div>
            )}
            {summary.change > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-blue-500/10 border-blue-500/20">
                <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{summary.change}</span>
                <span className="text-sm text-muted-foreground">To Change</span>
              </div>
            )}
            {summary.destroy > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-red-500/10 border-red-500/20">
                <Minus className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span className="text-xl font-bold text-red-600 dark:text-red-400">{summary.destroy}</span>
                <span className="text-sm text-muted-foreground">To Destroy</span>
              </div>
            )}
            {summary.replace > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-orange-500/10 border-orange-500/20">
                <RotateCw className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <span className="text-xl font-bold text-orange-600 dark:text-orange-400">{summary.replace}</span>
                <span className="text-sm text-muted-foreground">To Replace</span>
              </div>
            )}
            {summary.outputChanges > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-purple-500/10 border-purple-500/20">
                <ArrowLeftRight className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span className="text-xl font-bold text-purple-600 dark:text-purple-400">{summary.outputChanges}</span>
                <span className="text-sm text-muted-foreground">Output{summary.outputChanges !== 1 ? 's' : ''} to Change</span>
              </div>
            )}
          </div>

          {/* Resource Changes */}
          <div className="space-y-4">
            {/* Filters - Always show filters and checkbox */}
            <div className="flex flex-wrap items-center gap-3">
              {hasChanges && (
                <>
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      id="plan-address-filter"
                      name="plan-address-filter"
                      placeholder="Filter resources by address..."
                      value={addressFilter}
                      onChange={(e) => setAddressFilter(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <select
                      id="plan-action-filter"
                      name="plan-action-filter"
                      value={actionFilter || ''}
                      onChange={(e) => setActionFilter(e.target.value || null)}
                      className="pl-9 pr-8 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
                    >
                      <option value="">Filter by action</option>
                      <option value="create">Create</option>
                      <option value="update">Update</option>
                      <option value="delete">Delete</option>
                      <option value="replace">Replace</option>
                    </select>
                  </div>
                </>
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="show-data-sources"
                  checked={showDataSources}
                  onCheckedChange={(checked) => setShowDataSources(checked === true)}
                />
                <label
                  htmlFor="show-data-sources"
                  className="text-sm text-muted-foreground cursor-pointer select-none"
                >
                  Show data sources
                </label>
              </div>
            </div>

            {/* Resource list or no changes message */}
            {hasChanges || (showDataSources && resourceChanges.length > 0) ? (
              <div className="space-y-3">
                {resourceChanges.length > 0 ? (
                  resourceChanges.map((resource, idx) => (
                    <ResourceChangeCard key={`${resource.address}-${idx}`} resource={resource} />
                  ))
                ) : summary.total === 0 && summary.outputChanges > 0 ? null : (
                  <div className="border rounded-lg p-8 text-center text-muted-foreground">
                    <p>No resources match the current filters.</p>
                  </div>
                )}

                {/* Output Changes Section */}
                {outputChanges.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <ArrowLeftRight className="h-4 w-4" />
                      Changes to Outputs
                    </h3>
                    {outputChanges.map((output) => (
                      <OutputChangeCard key={output.name} output={output} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="border rounded-lg p-8 text-center text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No changes detected</p>
                <p className="text-sm mt-1">This plan would make no changes to your infrastructure.</p>
              </div>
            )}
          </div>

          {/* View Raw Output Toggle - Same styling as apply outputs */}
          {showJsonViewer && (
            <div className="border-t pt-4">
              <button
                onClick={() => setRawOutputExpanded(!rawOutputExpanded)}
                className="w-full flex items-center justify-between p-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  View Raw Output
                </span>
                {rawOutputExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              {rawOutputExpanded && (
                <div className="mt-3 space-y-3">
                  {/* Three tabs: Plan (JSON), Terminal, JSON (JSONL) */}
                  <div className="flex items-center gap-2 border-b pb-2">
                    <button
                      onClick={() => setRawOutputView('plan')}
                      className={cn(
                        "px-3 py-1.5 text-sm rounded-md transition-colors",
                        rawOutputView === 'plan'
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      )}
                    >
                      Plan
                    </button>
                    {logs && (
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
                    )}
                    {logs && (
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
                    )}
                  </div>
                  {/* Show content based on selected tab */}
                  {rawOutputView === 'plan' ? (
                    <JsonViewer
                      data={data}
                      title=""
                      defaultExpanded={true}
                      maxHeight="600px"
                      showControls={true}
                    />
                  ) : rawOutputView === 'terminal' && logs ? (
                    <TerminalOutput content={logs} isStreaming={false} />
                  ) : rawOutputView === 'json' && logs ? (
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
                  ) : null}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <JsonViewer
          data={data}
          title={`${title} (JSON)`}
          defaultExpanded={true}
          maxHeight="800px"
          showControls={true}
        />
      )}
    </div>
  );
}

