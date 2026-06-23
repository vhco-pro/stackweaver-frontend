// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { type JsonApiResource, type JsonApiResponse, type JsonApiResourceIdentifier, getRelationship, getRelationships } from '@/utils/jsonapi';

// Note: This file contains intentional uses of 'any' when accessing JsonApiResource.attributes
// which is intentionally typed as Record<string, any> for JSON:API flexibility.
// ESLint disable comments are added inline where necessary.

import { config } from '@/config';

const API_BASE_URL = config.apiUrl;

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const REQUEST_TIMEOUT = 30000; // 30 seconds

// API Client using native fetch with retry logic
class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isNetworkError(error: unknown): boolean {
    if (error instanceof TypeError) {
      const message = error.message.toLowerCase();
      return message.includes('network') || 
             message.includes('fetch') || 
             message.includes('failed to fetch') ||
             message.includes('networkerror');
    }
    return false;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    // Get Zitadel access token
    const { getAccessToken } = await import('@/lib/zitadel');
    const accessToken = getAccessToken();
    
    if (!accessToken) {
      console.warn('No access token found - user may not be logged in');
    }
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      ...options.headers,
    };

    const config: RequestInit = {
      ...options,
      headers,
      credentials: 'include', // Send cookies
    };

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Create an AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
        
        const response = await fetch(url, {
          ...config,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        // Handle 401 unauthorized - don't auto-redirect, let AuthContext handle it
        if (response.status === 401) {
          const errorData = await response.json().catch(() => ({}));
          const error = new Error(errorData.error || 'Unauthorized');
          (error as Error & { status?: number }).status = 401;
          throw error;
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          // Handle v2 error format: { errors: [{ detail: "...", ... }] }
          const errorMessage = errorData.errors?.[0]?.detail || errorData.error || `HTTP error! status: ${response.status}`;
          const error = new Error(errorMessage);
          (error as Error & { status?: number }).status = response.status;
          throw error;
        }

        // 204 No Content: no body to parse (e.g. DELETE module, DELETE version)
        if (response.status === 204) {
          return {} as T;
        }

        // Handle empty responses
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const text = await response.text();
          if (!text.trim()) {
            return {} as T;
          }
          return JSON.parse(text) as T;
        }

        return {} as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry on 401 errors (authentication issues)
        if ((lastError as Error & { status?: number }).status === 401) {
          throw lastError;
        }
        
        // Only retry on network errors or timeouts
        const isRetryable = this.isNetworkError(error) || 
                           (error instanceof DOMException && error.name === 'AbortError');
        
        if (isRetryable && attempt < MAX_RETRIES - 1) {
          const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          console.warn(`Network error on ${endpoint}, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`);
          await this.delay(retryDelay);
          continue;
        }
        
        throw lastError;
      }
    }
    
    throw lastError || new Error('Request failed after retries');
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

// Types
export interface Organization {
  id: string;
  name: string;
  description?: string;
  default_terraform_version?: string;
  ansible_job_retention_days?: number;
  ansible_adhoc_modules?: string;
  created_at: string;
  updated_at: string;
}

// Admin: Terraform Versions
export interface TerraformVersionAttributes {
  version: string;
  url: string;
  sha: string;
  deprecated: boolean;
  'deprecated-reason': string | null;
  official: boolean;
  enabled: boolean;
  beta: boolean;
  usage: number;
  'created-at': string;
}

export interface TerraformVersionResource {
  id: string;
  type: string;
  attributes: TerraformVersionAttributes;
}

// Public: list enabled terraform versions (any authenticated user)
export const terraformVersionsApi = {
  listEnabled: () =>
    apiClient.get<{ data: TerraformVersionResource[] }>('/terraform-versions'),
};

// Admin: manage terraform versions (owners team only)
export const adminTerraformVersionsApi = {
  list: (params?: { page?: number; pageSize?: number; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page[number]', String(params.page));
    if (params?.pageSize) query.set('page[size]', String(params.pageSize));
    if (params?.search) query.set('search[version]', params.search);
    const qs = query.toString();
    return apiClient.get<{ data: TerraformVersionResource[]; meta: { pagination: { 'current-page': number; 'page-size': number; 'total-pages': number; 'total-count': number } } }>(`/admin/terraform-versions${qs ? '?' + qs : ''}`);
  },
  get: (id: string) =>
    apiClient.get<{ data: TerraformVersionResource }>(`/admin/terraform-versions/${id}`).then(res => res.data),
  create: (data: { version: string; url?: string; sha?: string; enabled?: boolean; beta?: boolean }) =>
    apiClient.post<{ data: TerraformVersionResource }>('/admin/terraform-versions', {
      data: { type: 'terraform-versions', attributes: data },
    }).then(res => res.data),
  update: (id: string, data: Partial<{ version: string; enabled: boolean; deprecated: boolean; 'deprecated-reason': string; beta: boolean }>) =>
    apiClient.patch<{ data: TerraformVersionResource }>(`/admin/terraform-versions/${id}`, {
      data: { type: 'terraform-versions', attributes: data },
    }).then(res => res.data),
  delete: (id: string) =>
    apiClient.delete(`/admin/terraform-versions/${id}`),
};

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  vcs_connection_id?: string;
  vcs_provider?: string;
  vcs_repository?: string;
  vcs_branch?: string;
  vcs_account_name?: string;
  terraform_version?: string;
  working_directory?: string;
  auto_queue_runs?: boolean;
  auto_apply?: boolean;
  execution_mode?: string;
  agent_pool_id?: string;
  agent_pool_name?: string;
  locked?: boolean;
  locked_by?: string;
  locked_at?: string;
  locked_reason?: string;
  force_delete?: boolean; // TFE: allows deletion even with active infrastructure
  run_timeout?: number; // Custom extension: timeout in seconds (default: 7200 = 2 hours)
  created_at: string;
  updated_at: string;
  latest_run?: {
    id: string;
    status: string;
    operation: string;
    is_destroy: boolean;
    plan_only: boolean;
    has_changes: boolean;
    created_at: string;
    completed_at?: string;
  };
}

export interface VCSConnection {
  id: string;
  organization_id: string;
  provider: 'github' | 'gitlab' | 'bitbucket' | 'azure_devops';
  account_name: string;
  account_type: 'organization' | 'user';
  installation_id?: string;
  token_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Run {
  id: string;
  workspace_id: string;
  created_by?: string;
  // TFE-compatible statuses: pending, planning, planned, applying, applied, failed, canceled
  // Legacy: running, completed (for backward compatibility)
  status: 'pending' | 'planning' | 'planned' | 'applying' | 'applied' | 'failed' | 'canceled' | 'running' | 'completed';
  // TFE-compatible operations: plan-only, plan-and-apply, destroy
  // Legacy: plan, apply (for backward compatibility)
  operation: 'plan-only' | 'plan-and-apply' | 'destroy' | 'plan' | 'apply';
  plan_output?: Record<string, unknown>;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  plan_only?: boolean; // TFE-compatible: Indicates if run is plan-only (cannot be applied)
  source?: string; // TFE-compatible: "tfe-api", "tfe-ui", "tfe-configuration-version" (TFE only has these 3 sources)
  configuration_version_id?: string; // Configuration version ID (for linking plan and apply runs)
  'configuration-version-source'?: string; // "tfe-vcs", "tfe-cli", "tfe-ui", "tfe-api" - indicates how config version was created
  'commit-hash'?: string; // Git commit hash (for VCS-triggered runs)
  committer?: string; // Committer email/name (for VCS-triggered runs)
  'pr-number'?: number; // Pull request number (for PR-triggered speculative runs)
  'source-branch'?: string; // Source/head branch of the PR (for PR-triggered speculative runs)
  permissions?: {
    'can-apply'?: boolean; // TFE-compatible: Only true if run can be applied
    'can-cancel'?: boolean;
    'can-discard'?: boolean;
    'can-force-execute'?: boolean;
    'can-force-cancel'?: boolean;
  };
  'status-timestamps'?: {
    'planning-at'?: string;
    'planned-at'?: string;
    'applying-at'?: string;
    'applied-at'?: string;
  };
  'has-changes'?: boolean; // TFE-compatible: Indicates if plan has changes
  // Self-hosted runner info (Phase 3)
  agent_pool_id?: string;
  agent_pool_name?: string;
  runner_id?: string;
  runner_name?: string;
}

export interface Variable {
  id: string;
  workspace_id: string;
  key: string;
  value: string;
  description?: string; // TFE-compatible: description field
  category?: string; // TFE-compatible: "terraform" or "env"
  hcl?: boolean; // TFE-compatible: whether value is HCL code
  encrypted: boolean; // Legacy field
  sensitive: boolean;
  created_at: string;
  updated_at: string;
}

// API functions (v2 - uses names instead of IDs)
function organizationFromJsonApi(item: JsonApiResource): Organization {
  // TFE uses organization name as id; attributes use kebab-case
  const name = (item.attributes?.['name'] ?? item.id) as string;
  return {
    id: (item.id ?? name),
    name,
    description: item.attributes?.description,
    default_terraform_version: (item.attributes?.['default-terraform-version'] ?? undefined) as string | undefined,
    ansible_job_retention_days: (item.attributes?.['ansible-job-retention-days'] ?? undefined) as number | undefined,
    ansible_adhoc_modules: (item.attributes?.['ansible-adhoc-modules'] ?? undefined) as string | undefined,
    created_at: (item.attributes?.['created-at'] ?? '') as string,
    updated_at: (item.attributes?.['updated-at'] ?? '') as string,
  };
}

export const organizationsApi = {
  list: () => apiClient.get<{ data: Organization[]; meta: { pagination: { page: number; per_page: number; total: number } } }>('/organizations'),
  get: (name: string) =>
    apiClient
      .get<{ data: JsonApiResource }>(`/organizations/${name}`)
      .then(res => organizationFromJsonApi(res.data)),
  create: (data: { name: string; description?: string }) =>
    apiClient
      .post<{ data: JsonApiResource }>('/organizations', data)
      .then(res => organizationFromJsonApi(res.data)),
  update: (name: string, data: Record<string, unknown>) =>
    apiClient
      .patch<{ data: JsonApiResource }>(`/organizations/${name}`, data)
      .then(res => organizationFromJsonApi(res.data)),
  delete: (name: string) => apiClient.delete(`/organizations/${name}`),
};

export const projectsApi = {
  list: (organizationName: string) =>
    apiClient.get<{ data: JsonApiResource[]; meta: { pagination: { page: number; per_page: number; total: number } } }>(`/organizations/${organizationName}/projects`).then(res => {
      // Parse JSON:API format to flat Project objects
      return {
        data: (res.data || []).map((item: JsonApiResource) => {
          const orgRel = getRelationship(item, 'organization');
          const project: Project = {
            id: item.id,
            organization_id: orgRel?.id || '',
            name: item.attributes?.name || '',
            description: item.attributes?.description,
            created_at: item.attributes?.['created-at'] || '',
            updated_at: item.attributes?.['updated-at'] || '',
          };
          return project;
        }),
        meta: res.meta,
      };
    }),
  get: (organizationName: string, projectName: string) =>
    apiClient.get<{ data: JsonApiResource }>(`/organizations/${organizationName}/projects/${projectName}`).then(res => {
      // Parse JSON:API format to flat Project object
      const item = res.data;
      const orgRel = getRelationship(item, 'organization');
      const project: Project = {
        id: item.id,
        organization_id: orgRel?.id || '',
        name: item.attributes?.name || '',
        description: item.attributes?.description,
        created_at: item.attributes?.['created-at'] || '',
        updated_at: item.attributes?.['updated-at'] || '',
      };
      return project;
    }),
  create: (organizationName: string, data: { name: string; description?: string }) =>
    apiClient.post<{ data: JsonApiResource }>(`/organizations/${organizationName}/projects`, {
      data: {
        type: 'projects',
        attributes: {
          name: data.name,
          description: data.description,
        },
      },
    }).then(res => {
      // Parse JSON:API format to flat Project object
      const item = res.data;
      const orgRel = getRelationship(item, 'organization');
      const project: Project = {
        id: item.id,
        organization_id: orgRel?.id || '',
        name: item.attributes?.name || '',
        description: item.attributes?.description,
        created_at: item.attributes?.['created-at'] || '',
        updated_at: item.attributes?.['updated-at'] || '',
      };
      return project;
    }),
  update: (organizationName: string, projectName: string, data: { name?: string; description?: string }) =>
    apiClient.patch<{ data: JsonApiResource }>(`/organizations/${organizationName}/projects/${projectName}`, {
      data: {
        type: 'projects',
        attributes: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
        },
      },
    }).then(res => {
      // Parse JSON:API format to flat Project object
      const item = res.data;
      const orgRel = getRelationship(item, 'organization');
      const project: Project = {
        id: item.id,
        organization_id: orgRel?.id || '',
        name: item.attributes?.name || '',
        description: item.attributes?.description,
        created_at: item.attributes?.['created-at'] || '',
        updated_at: item.attributes?.['updated-at'] || '',
      };
      return project;
    }),
  delete: (organizationName: string, projectName: string) =>
    apiClient.delete(`/organizations/${organizationName}/projects/${projectName}`),
};

// Parse a workspace JSON:API resource into the flat Workspace interface.
// Maps kebab-case JSON:API attributes to snake_case TypeScript fields.
 
function workspaceFromJsonApi(item: JsonApiResource, included?: JsonApiResource[]): Workspace {
  const attrs = item.attributes || {};
   
  const vcsRepo = attrs['vcs-repo'] as Record<string, any> | null | undefined;
  const projectRel = getRelationship(item, 'project');
  const agentPoolRel = getRelationship(item, 'agent-pool');
  const lockedByRel = getRelationship(item, 'locked-by');
  const currentRunRel = getRelationship(item, 'current-run');

  // Map TFE service-provider to our vcs_provider field
  let vcsProvider: string | undefined;
  if (vcsRepo) {
    const sp = String(vcsRepo['service-provider'] || '');
    switch (sp) {
      case 'github': vcsProvider = 'github'; break;
      case 'ado_services': vcsProvider = 'azure_devops'; break;
      case 'gitlab_hosted': vcsProvider = 'gitlab'; break;
      case 'bitbucket_hosted': vcsProvider = 'bitbucket'; break;
      default: if (sp) vcsProvider = sp;
    }
  }

  const workspace: Workspace = {
    id: item.id,
    project_id: projectRel?.id || '',
    name: String(attrs['name'] || ''),
    description: attrs['description'] ? String(attrs['description']) : undefined,
    vcs_connection_id: attrs['vcs-connection-id'] ? String(attrs['vcs-connection-id']) : undefined,
    vcs_provider: vcsProvider,
    vcs_repository: vcsRepo ? String(vcsRepo['identifier'] || '') : undefined,
    vcs_branch: vcsRepo ? String(vcsRepo['branch'] || '') : undefined,
    vcs_account_name: attrs['vcs-account-name'] ? String(attrs['vcs-account-name']) : undefined,
    terraform_version: attrs['terraform-version'] ? String(attrs['terraform-version']) : undefined,
    working_directory: attrs['working-directory'] ? String(attrs['working-directory']) : undefined,
    auto_queue_runs: attrs['auto-queue-runs'] as boolean | undefined,
    auto_apply: attrs['auto-apply'] as boolean | undefined,
    execution_mode: attrs['execution-mode'] ? String(attrs['execution-mode']) : undefined,
    agent_pool_id: agentPoolRel?.id || undefined,
    agent_pool_name: attrs['agent-pool-name'] ? String(attrs['agent-pool-name']) : undefined,
    locked: (attrs['locked'] as boolean) ?? false,
    locked_by: lockedByRel?.id || undefined,
    locked_at: attrs['locked-at'] ? String(attrs['locked-at']) : undefined,
    locked_reason: attrs['locked-reason'] ? String(attrs['locked-reason']) : undefined,
    force_delete: attrs['force-delete'] as boolean | undefined,
    run_timeout: attrs['run-timeout'] as number | undefined,
    created_at: String(attrs['created-at'] || ''),
    updated_at: String(attrs['updated-at'] || ''),
  };

  // Resolve latest_run from included resources if current-run relationship exists
  if (currentRunRel && included) {
    const runResource = included.find(r => r.id === currentRunRel.id && r.type === 'runs');
    if (runResource) {
      const runAttrs = runResource.attributes || {};
      workspace.latest_run = {
        id: runResource.id,
        status: String(runAttrs['status'] || ''),
        operation: String(runAttrs['operation'] || ''),
        is_destroy: (runAttrs['is-destroy'] as boolean) ?? false,
        plan_only: (runAttrs['plan-only'] as boolean) ?? false,
        has_changes: (runAttrs['has-changes'] as boolean) ?? false,
        created_at: String(runAttrs['created-at'] || ''),
        completed_at: runAttrs['completed-at'] ? String(runAttrs['completed-at']) : undefined,
      };
    }
  }

  return workspace;
}

export const workspacesApi = {
  // TFE-compatible endpoints — always JSON:API format
  list: (organizationName: string) =>
    apiClient.get<{ data: JsonApiResource[]; meta: { pagination: { page: number; per_page: number; total: number } }; included?: JsonApiResource[] }>(`/organizations/${organizationName}/workspaces`).then(res => ({
      data: (res.data || []).map((item: JsonApiResource) => workspaceFromJsonApi(item, res.included)),
      meta: res.meta,
    })),
  get: (organizationName: string, workspaceName: string) =>
    apiClient.get<{ data: JsonApiResource }>(`/organizations/${organizationName}/workspaces/${workspaceName}`).then(res => workspaceFromJsonApi(res.data)),
  create: (organizationName: string, data: {
    name: string;
    description?: string;
    project_id?: string;
    vcs_connection_id?: string;
    vcs_repository?: string;
    vcs_branch?: string;
    working_directory?: string;
    terraform_version?: string;
    auto_queue_runs?: boolean;
    auto_apply?: boolean;
    execution_mode?: string;
    agent_pool_id?: string;
    'run-timeout'?: number; // Custom extension: timeout in seconds
  }) =>
    apiClient.post<{ data: JsonApiResource }>(`/organizations/${organizationName}/workspaces`, {
      data: {
        type: 'workspaces',
        attributes: {
          name: data.name,
          description: data.description,
          'project-id': data.project_id,
          'vcs-connection-id': data.vcs_connection_id,
          'vcs-repository': data.vcs_repository,
          'vcs-branch': data.vcs_branch,
          'working-directory': data.working_directory,
          'terraform-version': data.terraform_version,
          'auto-queue-runs': data.auto_queue_runs,
          'auto-apply': data.auto_apply,
          'execution-mode': data.execution_mode,
          'agent-pool-id': data.agent_pool_id || undefined,
          'run-timeout': data['run-timeout'],
        },
      },
    }).then(res => workspaceFromJsonApi(res.data)),
  update: (organizationName: string, workspaceName: string, data: {
    name?: string;
    description?: string;
    vcs_connection_id?: string | null;
    vcs_repository?: string;
    vcs_branch?: string;
    working_directory?: string;
    terraform_version?: string;
    auto_queue_runs?: boolean;
    auto_apply?: boolean;
    execution_mode?: string;
    agent_pool_id?: string | null;
    force_delete?: boolean;
    'run-timeout'?: number;
  }) =>
    apiClient.patch<{ data: JsonApiResource }>(`/organizations/${organizationName}/workspaces/${workspaceName}`, {
      data: {
        type: 'workspaces',
        attributes: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.vcs_connection_id !== undefined && { 'vcs-connection-id': data.vcs_connection_id }),
          ...(data.vcs_repository !== undefined && { 'vcs-repository': data.vcs_repository }),
          ...(data.vcs_branch !== undefined && { 'vcs-branch': data.vcs_branch }),
          ...(data.terraform_version !== undefined && { 'terraform-version': data.terraform_version }),
          ...(data.working_directory !== undefined && { 'working-directory': data.working_directory }),
          ...(data.auto_queue_runs !== undefined && { 'auto-queue-runs': data.auto_queue_runs }),
          ...(data.auto_apply !== undefined && { 'auto-apply': data.auto_apply }),
          ...(data.execution_mode !== undefined && { 'execution-mode': data.execution_mode }),
          ...(data.agent_pool_id !== undefined && { 'agent-pool-id': data.agent_pool_id }),
          ...(data.force_delete !== undefined && { 'force-delete': data.force_delete }),
          ...(data['run-timeout'] !== undefined && { 'run-timeout': data['run-timeout'] }),
        },
      },
    }).then(res => workspaceFromJsonApi(res.data)),
  delete: (organizationName: string, workspaceName: string, force?: boolean) =>
    apiClient.delete(`/organizations/${organizationName}/workspaces/${workspaceName}${force ? '?force=true' : ''}`),
  // Internal API (using UUIDs)
  getById: (id: string) =>
    apiClient.get<{ data: JsonApiResource }>(`/terraform/workspaces/${id}`).then(res => workspaceFromJsonApi(res.data)),
  // Workspace actions (TFE-compatible)
  lock: (workspaceId: string, reason?: string) =>
    apiClient.post<{ data: JsonApiResource }>(`/workspaces/${workspaceId}/actions/lock`, reason ? { reason } : {}).then(res => workspaceFromJsonApi(res.data)),
  unlock: (workspaceId: string) =>
    apiClient.post<{ data: JsonApiResource }>(`/workspaces/${workspaceId}/actions/unlock`).then(res => workspaceFromJsonApi(res.data)),
  forceUnlock: (workspaceId: string) =>
    apiClient.post<{ data: JsonApiResource }>(`/workspaces/${workspaceId}/actions/force-unlock`).then(res => workspaceFromJsonApi(res.data)),
};

// Agent Pools (TFE-compatible). See SELF_HOSTED_RUNNERS_DESIGN.md and AGENT_POOLS_IMPLEMENTATION_PLAN.md.
export interface AgentPool {
  id: string;
  name: string;
  organization_scoped: boolean;
  agent_count: number;
  created_at: string;
  allowed_workspace_ids: string[];
  allowed_project_ids: string[];
  excluded_workspace_ids: string[];
}

function agentPoolFromJsonApi(item: JsonApiResource): AgentPool {
  const allowedWorkspaces = getRelationships(item, 'allowed-workspaces');
  const allowedProjects = getRelationships(item, 'allowed-projects');
  const excludedWorkspaces = getRelationships(item, 'excluded-workspaces');
  return {
    id: item.id,
    name: (item.attributes?.['name'] as string) ?? '',
    organization_scoped: (item.attributes?.['organization-scoped'] as boolean) ?? true,
    agent_count: (item.attributes?.['agent-count'] as number) ?? 0,
    created_at: (item.attributes?.['created-at'] as string) ?? '',
    allowed_workspace_ids: allowedWorkspaces.map(r => r.id),
    allowed_project_ids: allowedProjects.map(r => r.id),
    excluded_workspace_ids: excludedWorkspaces.map(r => r.id),
  };
}

export const agentPoolsApi = {
  list: (organizationName: string, opts?: { page?: number; pageSize?: number; q?: string; sort?: string }) => {
    const params = new URLSearchParams();
    if (opts?.page != null) params.append('page[number]', String(opts.page));
    if (opts?.pageSize != null) params.append('page[size]', String(opts.pageSize));
    if (opts?.q) params.append('q', opts.q);
    if (opts?.sort) params.append('sort', opts.sort);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient
      .get<{ data: JsonApiResource[]; meta: { pagination: { 'current-page': number; 'page-size': number; 'total-count': number } } }>(
        `/organizations/${organizationName}/agent-pools${query}`
      )
      .then(res => ({
        data: (res.data || []).map((item: JsonApiResource) => agentPoolFromJsonApi(item)),
        meta: res.meta,
      }));
  },
  create: (
    organizationName: string,
    data: {
      name: string;
      organization_scoped?: boolean;
      allowed_workspace_ids?: string[];
      allowed_project_ids?: string[];
      excluded_workspace_ids?: string[];
    }
  ) => {
    const body: {
      data: {
        type: string;
        attributes: { name: string; 'organization-scoped'?: boolean };
        relationships?: Record<string, { data: Array<{ id: string; type: string }> }>;
      };
    } = {
      data: {
        type: 'agent-pools',
        attributes: {
          name: data.name,
          ...(data.organization_scoped !== undefined && { 'organization-scoped': data.organization_scoped }),
        },
      },
    };
    const rels: Record<string, { data: Array<{ id: string; type: string }> }> = {};
    if (data.allowed_workspace_ids?.length) rels['allowed-workspaces'] = { data: data.allowed_workspace_ids.map(id => ({ id, type: 'workspaces' })) };
    if (data.allowed_project_ids?.length) rels['allowed-projects'] = { data: data.allowed_project_ids.map(id => ({ id, type: 'projects' })) };
    if (data.excluded_workspace_ids?.length) rels['excluded-workspaces'] = { data: data.excluded_workspace_ids.map(id => ({ id, type: 'workspaces' })) };
    if (Object.keys(rels).length > 0) body.data.relationships = rels;
    return apiClient.post<{ data: JsonApiResource }>(`/organizations/${organizationName}/agent-pools`, body).then(res => agentPoolFromJsonApi(res.data));
  },
  get: (id: string) =>
    apiClient.get<{ data: JsonApiResource }>(`/agent-pools/${id}`).then(res => agentPoolFromJsonApi(res.data)),
  update: (
    id: string,
    data: {
      name?: string;
      organization_scoped?: boolean;
      allowed_workspace_ids?: string[];
      allowed_project_ids?: string[];
      excluded_workspace_ids?: string[];
    }
  ) => {
    const body: { data: { type: string; id: string; attributes?: Record<string, unknown>; relationships?: Record<string, { data: Array<{ id: string; type: string }> }> } } = {
      data: { type: 'agent-pools', id },
    };
    if (data.name !== undefined || data.organization_scoped !== undefined) {
      body.data.attributes = {};
      if (data.name !== undefined) body.data.attributes.name = data.name;
      if (data.organization_scoped !== undefined) body.data.attributes['organization-scoped'] = data.organization_scoped;
    }
    if (
      data.allowed_workspace_ids !== undefined ||
      data.allowed_project_ids !== undefined ||
      data.excluded_workspace_ids !== undefined
    ) {
      body.data.relationships = {};
      if (data.allowed_workspace_ids !== undefined) {
        body.data.relationships['allowed-workspaces'] = { data: data.allowed_workspace_ids.map(i => ({ id: i, type: 'workspaces' })) };
      }
      if (data.allowed_project_ids !== undefined) {
        body.data.relationships['allowed-projects'] = { data: data.allowed_project_ids.map(i => ({ id: i, type: 'projects' })) };
      }
      if (data.excluded_workspace_ids !== undefined) {
        body.data.relationships['excluded-workspaces'] = { data: data.excluded_workspace_ids.map(i => ({ id: i, type: 'workspaces' })) };
      }
    }
    return apiClient.patch<{ data: JsonApiResource }>(`/agent-pools/${id}`, body).then(res => agentPoolFromJsonApi(res.data));
  },
  delete: (id: string) => apiClient.delete(`/agent-pools/${id}`),
  listAgents: (id: string) =>
    apiClient.get<{ data: unknown[]; meta: { pagination: { 'current-page': number; 'page-size': number; 'total-count': number } } }>(`/agent-pools/${id}/agents`),
};

// ======================
// Runners (Self-Hosted)
// ======================

export interface RunnerJobHistory {
  id: string;
  job_type: string;
  job_id: string;
  workspace_id: string;
  workspace_name: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number;
}

export interface Runner {
  id: string;
  name: string;
  description: string;
  agent_pool_id: string;
  agent_pool_name?: string;
  runner_type: 'terraform' | 'ansible' | 'combined';
  status: 'online' | 'offline' | 'busy' | 'error';
  hostname: string;
  ip_address: string;
  os_type: string;
  os_version: string;
  agent_version: string;
  labels: string[];
  terraform_version: string;
  ansible_version: string;
  available_collections: string[];
  max_concurrent_jobs: number;
  current_jobs: number;
  last_heartbeat_at: string | null;
  registered_at: string;
  created_at: string;
  recent_jobs?: RunnerJobHistory[];
}

function runnerFromJsonApi(item: JsonApiResource): Runner {
  const attrs = item.attributes || {};
  return {
    id: item.id,
    name: String(attrs['name'] || ''),
    description: String(attrs['description'] || ''),
    agent_pool_id: String(attrs['agent-pool-id'] || ''),
    agent_pool_name: attrs['agent-pool-name'] ? String(attrs['agent-pool-name']) : undefined,
    runner_type: (attrs['runner-type'] as Runner['runner_type']) || 'combined',
    status: (attrs['status'] as Runner['status']) || 'offline',
    hostname: String(attrs['hostname'] || ''),
    ip_address: String(attrs['ip-address'] || ''),
    os_type: String(attrs['os-type'] || ''),
    os_version: String(attrs['os-version'] || ''),
    agent_version: String(attrs['agent-version'] || ''),
    labels: Array.isArray(attrs['labels']) ? (attrs['labels'] as string[]) : [],
    terraform_version: String(attrs['terraform-version'] || ''),
    ansible_version: String(attrs['ansible-version'] || ''),
    available_collections: Array.isArray(attrs['available-collections']) ? (attrs['available-collections'] as string[]) : [],
    max_concurrent_jobs: Number(attrs['max-concurrent-jobs']) || 1,
    current_jobs: Number(attrs['current-jobs']) || 0,
    last_heartbeat_at: attrs['last-heartbeat-at'] ? String(attrs['last-heartbeat-at']) : null,
    registered_at: String(attrs['registered-at'] || ''),
    created_at: String(attrs['created-at'] || attrs['registered-at'] || ''),
    recent_jobs: Array.isArray(attrs['recent_jobs']) ? (attrs['recent_jobs'] as RunnerJobHistory[]) : undefined,
  };
}

export const runnersApi = {
  list: (organizationName: string, opts?: { page?: number; pageSize?: number; q?: string; sort?: string; agentPoolId?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (opts?.page != null) params.append('page[number]', String(opts.page));
    if (opts?.pageSize != null) params.append('page[size]', String(opts.pageSize));
    if (opts?.q) params.append('q', opts.q);
    if (opts?.sort) params.append('sort', opts.sort);
    if (opts?.agentPoolId) params.append('filter[agent_pool_id]', opts.agentPoolId);
    if (opts?.status) params.append('filter[status]', opts.status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient
      .get<{ data: JsonApiResource[]; meta: { pagination: { 'current-page': number; 'page-size': number; 'total-count': number; 'total-pages': number } } }>(
        `/organizations/${organizationName}/runners${query}`
      )
      .then(res => ({
        data: (res.data || []).map((item: JsonApiResource) => runnerFromJsonApi(item)),
        meta: res.meta,
      }));
  },
  get: (id: string) =>
    apiClient.get<{ data: JsonApiResource }>(`/runners/${id}`).then(res => runnerFromJsonApi(res.data)),
  update: (id: string, data: { description?: string; labels?: string[] }) => {
    const body = {
      data: {
        type: 'runners',
        id,
        attributes: {} as Record<string, unknown>,
      },
    };
    if (data.description !== undefined) body.data.attributes.description = data.description;
    if (data.labels !== undefined) body.data.attributes.labels = data.labels;
    return apiClient.patch<{ data: JsonApiResource }>(`/runners/${id}`, body).then(res => runnerFromJsonApi(res.data));
  },
  delete: (id: string) => apiClient.delete(`/runners/${id}`),
  getStats: (organizationName: string) =>
    apiClient.get<{ data: { type: string; attributes: { total: number; online: number; offline: number } } }>(`/organizations/${organizationName}/runners/stats`)
      .then(res => res.data.attributes),
};

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  private: boolean;
  default_branch: string;
  url: string;
  clone_url: string;
  ssh_url: string;
}

export interface Branch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface VCSProject {
  id: string;
  name: string;
}

// Azure OIDC Configurations (TFE-compatible)
// Manages keyless authentication from Terraform runs to Azure via OIDC workload identity.
export interface AzureOIDCConfiguration {
  id: string;
  client_id: string;
  subscription_id: string;
  tenant_id: string;
  organization_name: string;
}

function azureOIDCConfigFromJsonApi(item: JsonApiResource): AzureOIDCConfiguration {
  const attrs = item.attributes || {};
  const orgRel = item.relationships?.['organization'] as { data?: { id?: string } } | undefined;
  return {
    id: item.id,
    client_id: String(attrs['client-id'] || ''),
    subscription_id: String(attrs['subscription-id'] || ''),
    tenant_id: String(attrs['tenant-id'] || ''),
    organization_name: orgRel?.data?.id ?? '',
  };
}

export const azureOIDCConfigApi = {
  list: (organizationName: string) =>
    apiClient
      .get<{ data: JsonApiResource[] }>(`/organizations/${organizationName}/oidc-configurations`)
      .then(res => ({
        data: (res.data || []).map((item: JsonApiResource) => azureOIDCConfigFromJsonApi(item)),
      })),

  create: (organizationName: string, data: { client_id: string; subscription_id: string; tenant_id: string }) => {
    const body = {
      data: {
        type: 'azure-oidc-configurations',
        attributes: {
          'client-id': data.client_id,
          'subscription-id': data.subscription_id,
          'tenant-id': data.tenant_id,
        },
      },
    };
    return apiClient
      .post<{ data: JsonApiResource }>(`/organizations/${organizationName}/oidc-configurations`, body)
      .then(res => azureOIDCConfigFromJsonApi(res.data));
  },

  get: (id: string) =>
    apiClient
      .get<{ data: JsonApiResource }>(`/oidc-configurations/${id}`)
      .then(res => azureOIDCConfigFromJsonApi(res.data)),

  update: (id: string, data: { client_id?: string; subscription_id?: string; tenant_id?: string }) => {
    const attrs: Record<string, string> = {};
    if (data.client_id !== undefined) attrs['client-id'] = data.client_id;
    if (data.subscription_id !== undefined) attrs['subscription-id'] = data.subscription_id;
    if (data.tenant_id !== undefined) attrs['tenant-id'] = data.tenant_id;
    const body = {
      data: {
        type: 'azure-oidc-configurations',
        attributes: attrs,
      },
    };
    return apiClient
      .patch<{ data: JsonApiResource }>(`/oidc-configurations/${id}`, body)
      .then(res => azureOIDCConfigFromJsonApi(res.data));
  },

  delete: (id: string) =>
    apiClient.delete(`/oidc-configurations/${id}`),
};

export const vcsConnectionsApi = {
  list: (organizationName: string) =>
    apiClient.get<{ data: Array<{ id: string; type: string; attributes: Omit<VCSConnection, 'id'>; relationships?: Record<string, unknown> }> }>(`/organizations/${organizationName}/vcs-connections`).then(res => {
      // Transform JSON:API format to flat structure and return all connections (no deduplication)
      return (res.data || []).map((item: { id: string; type: string; attributes: Omit<VCSConnection, 'id'>; relationships?: Record<string, unknown> }) => {
        const { ...attributes } = item.attributes;
        return {
          id: item.id,
          // usage of organization_id from attributes will be overwritten if present
          ...attributes, 
          organization_id: (item.relationships?.organization as any)?.data?.id || '',
        };
      });
    }),
  initiateInstallation: (organizationName: string) =>
    apiClient.get<{ data: { install_url: string } }>(`/organizations/${organizationName}/vcs-connections/github/install`).then(res => res.data),
  initiateInstallationWithRedirect: (organizationName: string, redirectUrl: string) =>
    apiClient.get<{ data: { install_url: string } }>(
      `/organizations/${organizationName}/vcs-connections/github/install?redirect=${encodeURIComponent(redirectUrl)}&return=${encodeURIComponent(window.location.pathname + window.location.search)}`
    ).then(res => res.data),
  createConnectionFromInstallation: (organizationName: string, installationId: string) =>
    apiClient.post<{ data: JsonApiResource }>(
      `/organizations/${organizationName}/vcs-connections/github/installations/${installationId}`,
      {}
    ).then(res => res.data),
  get: (id: string) =>
    apiClient.get<{ data: VCSConnection }>(`/vcs-connections/${id}`).then(res => res.data),
  create: (organizationName: string, data: {
    provider: 'github' | 'gitlab' | 'bitbucket' | 'azure_devops';
    access_token: string;
    refresh_token?: string;
    token_expires_at?: string;
    account_name: string;
    account_type: 'organization' | 'user';
    installation_id?: string;
  }) =>
    apiClient.post<{ data: VCSConnection }>(`/organizations/${organizationName}/vcs-connections`, data).then(res => res.data),
  delete: (id: string) =>
    apiClient.delete(`/vcs-connections/${id}`),
  listRepositories: (id: string, page?: number, perPage?: number, project?: string) => {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (perPage) params.append('per_page', perPage.toString());
    if (project) params.append('project', project);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<{ data: Repository[]; meta: { pagination: { page: number; per_page: number } } }>(`/vcs-connections/${id}/repositories${query}`).then(res => res.data);
  },
  listAllRepositories: async (id: string, project?: string): Promise<Repository[]> => {
    const perPage = 100;
    let page = 1;
    const allRepos: Repository[] = [];
    while (true) {
      const res = await vcsConnectionsApi.listRepositories(id, page, perPage, project);
      const repos = res || [];
      allRepos.push(...repos);
      if (repos.length < perPage) break;
      page++;
    }
    return allRepos;
  },
  // Lists projects for a VCS connection. Only Azure DevOps has a project layer;
  // other providers return 501, so callers should guard by provider.
  listProjects: (id: string) =>
    apiClient.get<{ data: VCSProject[]; meta: { pagination: { page: number; per_page: number } } }>(`/vcs-connections/${id}/projects`).then(res => res.data),
  listBranches: (id: string, owner: string, repo: string, page?: number, perPage?: number) => {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (perPage) params.append('per_page', perPage.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<{ data: Branch[]; meta: { pagination: { page: number; per_page: number } } }>(`/vcs-connections/${id}/repositories/${owner}/${repo}/branches${query}`).then(res => res.data);
  },
  getFileContent: (id: string, owner: string, repo: string, path: string, ref?: string) => {
    const params = new URLSearchParams();
    if (ref) params.append('ref', ref);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<{ data: { content: string; path: string; ref: string } }>(`/vcs-connections/${id}/repositories/${owner}/${repo}/contents/${path}${query}`).then(res => res.data);
  },
  listYamlFiles: (id: string, owner: string, repo: string, ref?: string) => {
    const params = new URLSearchParams();
    if (ref) params.append('ref', ref);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<{ data: string[] }>(`/vcs-connections/${id}/repositories/${owner}/${repo}/yaml-files${query}`).then(res => res.data);
  },
  listInventoryFiles: (id: string, owner: string, repo: string, ref?: string) => {
    const params = new URLSearchParams();
    if (ref) params.append('ref', ref);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<{ data: string[] }>(`/vcs-connections/${id}/repositories/${owner}/${repo}/inventory-files${query}`).then(res => res.data);
  },
  // Azure DevOps OAuth2 flow
  initiateAzureDevOpsInstallation: (organizationName: string, adoOrg: string, returnPath: string) =>
    apiClient.get<{ data: { auth_url: string } }>(
      `/organizations/${organizationName}/vcs-connections/azure-devops/install?ado_org=${encodeURIComponent(adoOrg)}&return=${encodeURIComponent(returnPath)}`
    ).then(res => res.data),
  completeAzureDevOpsInstallation: (code: string, state: string) =>
    apiClient.post<{ data: JsonApiResource }>(
      `/vcs-connections/azure-devops/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
      {}
    ).then(res => res.data),
};

export interface StateVersion {
  id: string;
  workspace_id: string;
  run_id?: string; // Link to the run that created this state version
  version: number;
  serial?: number;
  lineage?: string;
  commit_hash?: string; // Git commit hash that triggered this state version
  committer?: string; // Committer email/name
  created_at: string;
}

// Terraform Enterprise frames run logs with STX (0x02) start-of-text and ETX (0x03)
// end-of-text control characters. The terraform CLI consumes them to detect the stream
// boundaries, but they must not be rendered in the web UI, so strip them from log text
// returned to frontend callers.
// eslint-disable-next-line no-control-regex -- STX/ETX are intentional control chars
const stripLogMarkers = (text: string): string => text.replace(/[\x02\x03]/g, '');

const ETX_BYTE = 0x03;

// A windowed chunk of a run log, returned by the log endpoints for incremental polling.
export interface LogChunk {
  // Display text for this chunk, with the STX/ETX framing markers stripped out.
  text: string;
  // Number of **raw** bytes consumed (markers included). Add to the running offset and
  // pass it back as `?offset=` on the next poll. Must be bytes, not `text.length` — the
  // server slices the log by byte position (TFE-compatible), markers are real bytes, and
  // terraform output contains multi-byte UTF-8, so a JS string length would drift.
  bytes: number;
  // True once the ETX end-of-text marker has been seen — the phase stream is complete and
  // polling can stop. Mirrors go-tfe's LogReader, which uses ETX to detect end-of-stream.
  done: boolean;
}

// Turn the raw bytes of a log response into a LogChunk: count raw bytes for offset
// accounting (the offset is byte-based and markers are real bytes, so this must be the
// buffer length, not the decoded string length), detect the trailing ETX end-of-stream
// marker, and strip framing markers from the displayed text. Pure/synchronous so the
// byte-accounting + marker logic can be unit-tested without a Response.
export const parseLogChunk = (buf: Uint8Array): LogChunk => {
  const done = buf.length > 0 && buf[buf.length - 1] === ETX_BYTE;
  const text = stripLogMarkers(new TextDecoder().decode(buf));
  return { text, bytes: buf.length, done };
};

// Read a log response as a LogChunk for incremental polling.
const readLogChunk = async (response: Response): Promise<LogChunk> =>
  parseLogChunk(new Uint8Array(await response.arrayBuffer()));

export const runsApi = {
  // TFE-compatible: List runs by workspace ID
  // Returns JSON:API format directly - pages should use helper functions
  list: (workspaceId: string) =>
    apiClient.get<JsonApiResponse<JsonApiResource[]>>(`/workspaces/${workspaceId}/runs`),
  
  // TFE-compatible: Get run by ID (not workspace-scoped)
  // Returns JSON:API format directly - pages should use helper functions
  get: (id: string) =>
    apiClient.get<JsonApiResponse<JsonApiResource>>(`/runs/${id}`),
  // TFE-compatible: Create run (not workspace-scoped in URL, but workspace in body)
  create: (data: { 
    workspace_id: string;
    configuration_version_id?: string;
    operation?: 'plan-only' | 'plan-and-apply' | 'destroy';
    auto_apply_after_plan?: boolean; // TFE: auto-apply after plan (from workspace.auto_apply)
  }) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(`/runs`, {
      // Send both JSON:API format and legacy format for the operation
      // The backend checks req.Operation first (legacy field), then falls back to JSON:API attrs
      operation: data.operation || 'plan-only',
      auto_apply_after_plan: data.auto_apply_after_plan || false,
      data: {
        type: 'runs',
        attributes: {
          'is-destroy': data.operation === 'destroy',
          'auto-apply-after-plan': data.auto_apply_after_plan || false,
        },
        relationships: {
          workspace: {
            data: {
              type: 'workspaces',
              id: data.workspace_id,
            },
          },
          ...(data.configuration_version_id && {
            'configuration-version': {
              data: {
                type: 'configuration-versions',
                id: data.configuration_version_id,
              },
            },
          }),
        },
      },
      // Legacy format support
      workspace_id: data.workspace_id,
      configuration_version_id: data.configuration_version_id,
      // Only send operation if explicitly provided
      // If auto_apply_after_plan is true, backend determines operation from that flag (plan-and-apply)
      // If auto_apply_after_plan is false/undefined, backend defaults to plan-only
      // So we only need to send operation for destroy or explicit plan
      ...(data.operation ? { operation: data.operation } : {}),
    }),
  
  // Returns JSON:API format directly - pages should use helper functions
  // TFE-compatible: Cancel run
  // TFE returns 202 Accepted with no body, so we need to fetch the run after cancelling
  // Returns JSON:API format directly - pages should use helper functions
  cancel: (id: string) =>
    apiClient.post(`/runs/${id}/actions/cancel`, {}).then(() => {
      // TFE returns 202 with no body, so fetch the updated run
      return runsApi.get(id);
    }),
  // TFE-compatible: Apply run
  // Returns JSON:API format directly - pages should use helper functions
  apply: (id: string) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(`/runs/${id}/actions/apply`, {}),
  
  // TFE-compatible: Discard run
  // Returns JSON:API format directly - pages should use helper functions
  discard: (id: string) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(`/runs/${id}/actions/discard`, {}),
  // Get run outputs from state (TFE-aligned). 404 when run has no state version.
  getOutputs: (id: string) =>
    apiClient.get<{ data: Array<{ id?: string; type?: string; attributes: { name: string; value: unknown; type?: string; sensitive?: boolean } }> }>(`/runs/${id}/outputs`).then(res => {
      const items = res.data || [];
      return items.map((item) => {
        const a = item.attributes || {};
        return { key: a.name, value: a.value, type: a.type, sensitive: a.sensitive };
      });
    }),

  // TFE-compatible: Get plan output for a run
  getPlan: (id: string) =>
    apiClient.get<{ data: JsonApiResource }>(`/runs/${id}/plan`).then(res => {
      // Plan response has attributes with plan data
      // Extract plan-json from attributes (contains the actual Terraform plan JSON)
      const attributes = res.data?.attributes || {};
      return attributes['plan-json'] || attributes;
    }),
  // TFE-compatible: Get apply output for a run
  // GET /api/v2/applies/:id
  getApply: (id: string) =>
    apiClient.get<{ data: JsonApiResource }>(`/applies/${id}`).then(res => {
      // Apply response has attributes with apply data
      return res.data?.attributes || {};
    }),
  // TFE-compatible: Get run logs (returns plain text)
  // Supports offset/limit for incremental streaming
  // Supports phase parameter to explicitly request plan or apply logs
  // NOTE: This is the generic endpoint (backward compatible)
  // For explicit phase logs, use getPlanLogs() or getApplyLogs()
  getLogs: async (id: string, options?: { offset?: number; limit?: number; phase?: 'plan' | 'apply' }): Promise<LogChunk> => {
    const url = new URL(`${API_BASE_URL}/runs/${id}/logs`);
    if (options?.offset !== undefined) {
      url.searchParams.append('offset', options.offset.toString());
    }
    if (options?.limit !== undefined) {
      url.searchParams.append('limit', options.limit.toString());
    }
    if (options?.phase !== undefined) {
      url.searchParams.append('phase', options.phase);
    }
    
    const { getAccessToken } = await import('@/lib/zitadel');
    const accessToken = getAccessToken();
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'text/plain',
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch logs: ${response.statusText}`);
    }
    
    return readLogChunk(response);
  },
  // Get plan logs explicitly (always returns plan logs or empty)
  // GET /api/v2/runs/:id/logs/plan
  getPlanLogs: async (id: string, options?: { offset?: number; limit?: number }): Promise<LogChunk> => {
    const url = new URL(`${API_BASE_URL}/runs/${id}/logs/plan`);
    if (options?.offset !== undefined) {
      url.searchParams.append('offset', options.offset.toString());
    }
    if (options?.limit !== undefined) {
      url.searchParams.append('limit', options.limit.toString());
    }
    
    const { getAccessToken } = await import('@/lib/zitadel');
    const accessToken = getAccessToken();
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'text/plain',
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch plan logs: ${response.statusText}`);
    }
    
    return readLogChunk(response);
  },
  // Get apply logs explicitly (always returns apply logs or empty)
  // GET /api/v2/runs/:id/logs/apply
  getApplyLogs: async (id: string, options?: { offset?: number; limit?: number }): Promise<LogChunk> => {
    const url = new URL(`${API_BASE_URL}/runs/${id}/logs/apply`);
    if (options?.offset !== undefined) {
      url.searchParams.append('offset', options.offset.toString());
    }
    if (options?.limit !== undefined) {
      url.searchParams.append('limit', options.limit.toString());
    }
    
    const { getAccessToken } = await import('@/lib/zitadel');
    const accessToken = getAccessToken();
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'text/plain',
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch apply logs: ${response.statusText}`);
    }
    
    return readLogChunk(response);
  },
  // Legacy: Update run status (internal API)
  updateStatus: (workspaceId: string, id: string, data: {
    status: string;
    error_message?: string;
    plan_output?: Record<string, unknown>;
  }) =>
    apiClient.patch<Run>(`/workspaces/${workspaceId}/runs/${id}/status`, data),
};

// Materialized state outputs/resources (State Storage Rework) — served from dedicated
// tables, so the workspace tabs/counts no longer parse the raw state blob.
export interface StateVersionOutput {
  name: string;
  value: unknown;
  type?: string;
  sensitive: boolean;
}

export interface StateVersionResource {
  address: string;
  mode: 'managed' | 'data';
  type: string;
  name: string;
  provider?: string;
  module?: string;
  instanceCount: number;
}

export const stateVersionsApi = {
  list: (workspaceId: string) =>
    apiClient.get<{ data: StateVersion[] }>(`/workspaces/${workspaceId}/state-versions`).then(res => res.data || []),
  get: (id: string) =>
    apiClient.get<{ data: { id: string; type: string; attributes: StateVersion } }>(`/state-versions/${id}`).then(res => {
      // Handle JSON:API format - extract attributes and merge with id
      const data = res.data;
      return { ...data.attributes, id: data.id };
    }),
  create: (workspaceId: string, data: { state_data: Record<string, unknown> }) =>
    apiClient.post<{ data: StateVersion }>(`/workspaces/${workspaceId}/state-versions`, data).then(res => res.data),
  removeResource: (workspaceId: string, address: string) =>
    apiClient.post<{ data: { message: string } }>(`/workspaces/${workspaceId}/state-versions/remove-resource`, { address }).then(res => res.data),
  delete: (id: string) =>
    apiClient.delete<void>(`/state-versions/${id}`),
  // Raw Terraform state JSON for a version, via the TFE hosted-state-download-url target
  // (object storage). Used by the state viewer/diff/download — the inline state_data blob
  // is being removed from API responses (State Storage Rework).
  getRawState: (id: string) =>
    apiClient.get<Record<string, unknown>>(`/state-versions/${id}/download`),
  // Current (latest) state version outputs, from the materialized table.
  currentOutputs: (workspaceId: string) =>
    apiClient.get<{ data: Array<{ id: string; attributes: { name: string; value: unknown; type?: string; sensitive?: boolean } }> }>(`/workspaces/${workspaceId}/current-state-version-outputs`).then(res =>
      (res.data || []).map<StateVersionOutput>(item => ({
        name: item.attributes.name,
        value: item.attributes.value,
        type: item.attributes.type,
        sensitive: item.attributes.sensitive ?? false,
      }))),
  // Current (latest) state version resources, from the materialized table. mode filters managed|data.
  currentResources: (workspaceId: string, mode?: 'managed' | 'data') =>
    apiClient.get<{ data: Array<{ id: string; attributes: { address: string; mode: string; type: string; name: string; provider?: string; module?: string; 'instance-count'?: number } }> }>(
      `/workspaces/${workspaceId}/current-state-version-resources${mode ? `?mode=${mode}` : ''}`,
    ).then(res =>
      (res.data || []).map<StateVersionResource>(item => ({
        address: item.attributes.address,
        mode: item.attributes.mode === 'data' ? 'data' : 'managed',
        type: item.attributes.type,
        name: item.attributes.name,
        provider: item.attributes.provider,
        module: item.attributes.module,
        instanceCount: item.attributes['instance-count'] ?? 1,
      }))),
};

export interface VariableSet {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  scope: 'organization' | 'workspace';
  priority?: boolean; // TFE priority field - when true, overrides other variables
  variables?: VariableSetVariable[];
  projects?: Project[];
  workspaces?: Workspace[];
  created_at: string;
  updated_at: string;
}

export interface VariableSetVariable {
  id: string;
  variable_set_id: string;
  key: string;
  value: string;
  description?: string; // TFE-compatible: description field
  category?: string; // TFE-compatible: "terraform" or "env"
  hcl?: boolean; // TFE-compatible: whether value is HCL code
  sensitive: boolean;
  encrypted: boolean; // Legacy field
  created_at: string;
  updated_at: string;
}

export const variablesApi = {
  // TFE-compatible: List variables returns JSON:API format
  // Reference: https://developer.hashicorp.com/terraform/enterprise/api-docs/workspace-variables#list-variables
  // TFE spec: GET /api/v2/workspaces/:workspace_id/vars
  list: (workspaceId: string) =>
    apiClient.get<{ data: Array<{ id: string; type: string; attributes: Variable }> }>(`/workspaces/${workspaceId}/vars`).then(res => {
      // Convert JSON:API format to simple Variable objects for frontend compatibility
      if (!res.data) return [];
      return res.data.map((item: JsonApiResource) => ({
        id: item.id,
        workspace_id: workspaceId,
        key: item.attributes?.key || '',
        value: item.attributes?.value || '',
        description: item.attributes?.description || '',
        category: item.attributes?.category || 'terraform',
        hcl: item.attributes?.hcl || false,
        encrypted: false, // Legacy field
        sensitive: item.attributes?.sensitive || false,
        created_at: '',
        updated_at: '',
      }));
    }),
  // TFE-compatible: Create variable using JSON:API format
  // Reference: https://developer.hashicorp.com/terraform/enterprise/api-docs/workspace-variables#create-a-variable
  // TFE spec: POST /api/v2/workspaces/:workspace_id/vars
  create: (workspaceId: string, data: {
    key: string;
    value: string;
    description?: string;
    category?: string;
    hcl?: boolean;
    sensitive?: boolean;
  }) =>
    apiClient.post<{ data: { id: string; type: string; attributes: Variable } }>(`/workspaces/${workspaceId}/vars`, {
      data: {
        type: 'vars',
        attributes: {
          key: data.key,
          value: data.value,
          description: data.description || '',
          category: data.category || 'terraform',
          hcl: data.hcl || false,
          sensitive: data.sensitive || false,
        },
      },
    }).then(res => {
      // Convert JSON:API response to simple Variable object
      const attrs = res.data.attributes;
      return {
        id: res.data.id,
        workspace_id: workspaceId,
        key: attrs.key,
        value: attrs.value,
        description: attrs.description,
        category: attrs.category,
        hcl: attrs.hcl,
        encrypted: false,
        sensitive: attrs.sensitive,
        created_at: '',
        updated_at: '',
      };
    }),
  // TFE-compatible: Update variable using JSON:API format
  // Reference: https://developer.hashicorp.com/terraform/enterprise/api-docs/workspace-variables#update-variables
  // TFE spec: PATCH /api/v2/workspaces/:workspace_id/vars/:variable_id
  update: (workspaceId: string, variableId: string, data: {
    key?: string;
    value?: string;
    description?: string;
    category?: string;
    hcl?: boolean;
    sensitive?: boolean;
  }) =>
    apiClient.patch<{ data: { id: string; type: string; attributes: Variable } }>(`/workspaces/${workspaceId}/vars/${variableId}`, {
      data: {
        id: variableId,
        type: 'vars',
        attributes: {
          ...(data.key && { key: data.key }),
          ...(data.value && { value: data.value }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.category && { category: data.category }),
          ...(data.hcl !== undefined && { hcl: data.hcl }),
          ...(data.sensitive !== undefined && { sensitive: data.sensitive }),
        },
      },
    }).then(res => {
      // Convert JSON:API response to simple Variable object
      const attrs = res.data.attributes;
      return {
        id: res.data.id,
        workspace_id: workspaceId,
        key: attrs.key,
        value: attrs.value,
        description: attrs.description,
        category: attrs.category,
        hcl: attrs.hcl,
        encrypted: false,
        sensitive: attrs.sensitive,
        created_at: '',
        updated_at: '',
      };
    }),
  // TFE spec: DELETE /api/v2/workspaces/:workspace_id/vars/:variable_id
  delete: (workspaceId: string, variableId: string) =>
    apiClient.delete(`/workspaces/${workspaceId}/vars/${variableId}`),
  // Get platform variable keys (StackWeaver-specific endpoint for frontend warnings)
  // GET /api/v2/workspaces/:id/platform-variables
  getPlatformVariableKeys: (workspaceId: string) =>
    apiClient.get<{ data: string[] }>(`/workspaces/${workspaceId}/platform-variables`).then(res => res.data || []),
};

export const variableSetsApi = {
  // TFE-compatible: List variable sets
  // TFE spec: GET /api/v2/organizations/:organization_name/varsets
  // Reference: https://developer.hashicorp.com/terraform/enterprise/api-docs/variable-sets#list-variable-sets
  list: (organizationName: string) => {
    type VariableSetListResponse = JsonApiResource & {
      relationships?: {
        vars?: { data: Array<{ id: string; type: string; attributes: { key: string; value: string; sensitive: boolean; category: string; hcl: boolean; description?: string } }> };
        projects?: { data: Array<{ id: string; type: string; attributes: { name: string; description?: string } }> };
        workspaces?: { data: Array<{ id: string; type: string; attributes: { name: string; description?: string } }> };
      };
    };
    return apiClient.get<{ data: Array<VariableSetListResponse> }>(`/organizations/${organizationName}/varsets`).then(res => {
      // Parse JSON:API response to VariableSet format
      return (res.data || []).map((item: VariableSetListResponse) => {
        const variableSet: VariableSet = {
          id: item.id,
          organization_id: '', // Will be set from organization context
          name: item.attributes?.name || '',
          description: item.attributes?.description || '',
          // TFE uses "global" instead of "scope"
          scope: (item.attributes?.global ? 'organization' : 'workspace'),
          priority: item.attributes?.priority || false, // TFE priority field
          variables: [],
          projects: [],
          workspaces: [],
          created_at: item.attributes?.created_at || '',
          updated_at: item.attributes?.updated_at || '',
        };

        // Parse relationships
        if (item.relationships) {
          // TFE uses "vars" not "variables" in relationships
          if (item.relationships.vars?.data) {
            variableSet.variables = (item.relationships.vars.data as unknown as JsonApiResource[]).map((v: JsonApiResource) => ({
              id: v.id,
              variable_set_id: item.id,
              key: v.attributes?.key || '',
              value: v.attributes?.value || '',
              sensitive: v.attributes?.sensitive || false,
              encrypted: false, // Legacy field
              category: v.attributes?.category || 'terraform',
              hcl: v.attributes?.hcl || false,
              description: v.attributes?.description || '',
              created_at: '',
              updated_at: '',
            }));
          }
          if (item.relationships.projects?.data) {
            variableSet.projects = item.relationships.projects.data.map((p) => {
              const project: Project = {
                id: p.id,
                organization_id: '', // Will be set from context
                name: p.attributes?.name || '',
                description: p.attributes?.description || '',
                created_at: '',
                updated_at: '',
              };
              return project;
            });
          }
          if (item.relationships.workspaces?.data) {
            variableSet.workspaces = item.relationships.workspaces.data.map((w) => {
              const workspace: Workspace = {
                id: w.id,
                name: w.attributes?.name || '',
                description: w.attributes?.description || '',
                project_id: '',
                vcs_repository: '',
                vcs_branch: '',
                execution_mode: '',
                auto_apply: false,
                created_at: '',
                updated_at: '',
              };
              return workspace;
            });
          }
        }
        return variableSet;
      });
    });
  },
  get: (_organizationName: string, id: string) => {
    type VariableSetResponse = JsonApiResource & {
      relationships?: {
        vars?: { data: Array<{ id: string; type: string; attributes: { key: string; value: string; sensitive: boolean; encrypted: boolean; category: string; description?: string; hcl?: boolean } }> };
        projects?: { data: Array<{ id: string; type: string; attributes: { name: string; description?: string } }> };
        workspaces?: { data: Array<{ id: string; type: string; attributes: { name: string; description?: string } }> };
      };
    };
    // TFE spec: GET /api/v2/varsets/:varset_id
    return apiClient.get<{ data: VariableSetResponse }>(`/varsets/${id}`).then(res => {
      const item = res.data;
      // Parse JSON:API response to VariableSet format
      const variableSet: VariableSet = {
        id: item.id,
        organization_id: '', // Will be set from organization context
        name: item.attributes?.name || '',
        description: item.attributes?.description || '',
        // TFE uses "global" instead of "scope"
        scope: (item.attributes?.global ? 'organization' : 'workspace'),
        priority: item.attributes?.priority || false, // TFE priority field
        variables: [],
        projects: [],
        workspaces: [],
        created_at: item.attributes?.created_at || '',
        updated_at: item.attributes?.updated_at || '',
      };

      // Parse relationships if present
      if (item.relationships) {
        // TFE uses "vars" not "variables" in relationships
        if (item.relationships.vars?.data) {
            variableSet.variables = (item.relationships.vars.data as unknown as JsonApiResource[]).map((v: JsonApiResource) => ({
              id: v.id,
              variable_set_id: item.id,
              key: v.attributes?.key || '',
              value: v.attributes?.value || '',
              description: v.attributes?.description || '',
              category: v.attributes?.category || 'terraform',
              hcl: v.attributes?.hcl || false,
              sensitive: v.attributes?.sensitive || false,
              encrypted: false, // Legacy field
              created_at: '',
              updated_at: '',
            }));
        }
        if (item.relationships.projects?.data) {
          variableSet.projects = item.relationships.projects.data.map((p) => {
            const project: Project = {
              id: p.id,
              organization_id: '', // Will be set from context
              name: p.attributes?.name || '',
              description: p.attributes?.description || '',
              created_at: '',
              updated_at: '',
            };
            return project;
          });
        }
        if (item.relationships.workspaces?.data) {
          variableSet.workspaces = item.relationships.workspaces.data.map((w) => {
            const workspace: Workspace = {
              id: w.id,
              name: w.attributes?.name || '',
              description: w.attributes?.description || '',
              project_id: '',
              vcs_repository: '',
              vcs_branch: '',
              execution_mode: '',
              auto_apply: false,
              created_at: '',
              updated_at: '',
            };
            return workspace;
          });
        }
      }
      return variableSet;
    });
  },
  create: (organizationName: string, data: {
    name: string;
    description?: string;
    scope: 'organization' | 'workspace';
    priority?: boolean;
    parentType?: 'organizations' | 'projects';
    parentId?: string;
  }) => {
    // TFE spec: POST /api/v2/organizations/:organization_name/varsets
    // Parent is inferred from context: creating from org settings = org-owned
    // If parentType is not provided, default to organization-owned
    const parentType = data.parentType || 'organizations';
    const parentId = data.parentId || organizationName;
    
    return apiClient.post<{ data: VariableSet }>(`/organizations/${organizationName}/varsets`, {
      data: {
        type: 'varsets', // TFE uses "varsets" not "variable-sets"
        attributes: {
          name: data.name,
          description: data.description || '',
          global: data.scope === 'organization', // TFE uses "global" instead of "scope"
          priority: data.priority || false, // TFE priority field
        },
        relationships: {
          parent: {
            data: {
              type: parentType,
              id: parentId,
            },
          },
        },
      },
    }).then(res => res.data);
  },
  update: (_organizationName: string, id: string, data: {
    name?: string;
    description?: string;
    scope?: 'organization' | 'workspace';
    priority?: boolean;
    parentType?: 'organizations' | 'projects';
    parentId?: string;
  }) =>
    // TFE spec: PATCH /api/v2/varsets/:varset_id
    // Note: Parent cannot be changed in TFE - it's inferred from creation context
    // Only send parent if explicitly provided (for future project settings support)
    apiClient.patch<{ data: VariableSet }>(`/varsets/${id}`, {
      data: {
        type: 'varsets', // TFE uses "varsets" not "variable-sets"
        attributes: {
          ...(data.name && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.scope && { global: data.scope === 'organization' }), // TFE uses "global" instead of "scope"
          ...(data.priority !== undefined && { priority: data.priority }),
        },
        // Only include parent relationship if explicitly provided (for future project settings)
        // In TFE, parent cannot be changed after creation
        ...(data.parentType && data.parentId ? {
          relationships: {
            parent: {
              data: {
                type: data.parentType,
                id: data.parentId,
              },
            },
          },
        } : {}),
      },
    }).then(res => res.data),
  delete: (_organizationName: string, id: string) =>
    // TFE spec: DELETE /api/v2/varsets/:varset_id
    apiClient.delete(`/varsets/${id}`),
  assignWorkspace: (_organizationName: string, variableSetId: string, workspaceId: string) =>
    // TFE spec: POST /api/v2/varsets/:varset_id/relationships/workspaces
    apiClient.post(`/varsets/${variableSetId}/relationships/workspaces`, {
      data: [
        {
          type: 'workspaces',
          id: workspaceId,
        },
      ],
    }),
  unassignWorkspace: (_organizationName: string, variableSetId: string, workspaceId: string) =>
    // TFE spec: DELETE /api/v2/varsets/:varset_id/relationships/workspaces
    apiClient.delete(`/varsets/${variableSetId}/relationships/workspaces`, {
      data: [
        {
          type: 'workspaces',
          id: workspaceId,
        },
      ],
    }),
  assignProject: (_organizationName: string, variableSetId: string, projectId: string) =>
    // TFE spec: POST /api/v2/varsets/:varset_id/relationships/projects
    apiClient.post(`/varsets/${variableSetId}/relationships/projects`, {
      data: [
        {
          type: 'projects',
          id: projectId,
        },
      ],
    }),
  unassignProject: (_organizationName: string, variableSetId: string, projectId: string) =>
    // TFE spec: DELETE /api/v2/varsets/:varset_id/relationships/projects
    apiClient.delete(`/varsets/${variableSetId}/relationships/projects`, {
      data: [
        {
          type: 'projects',
          id: projectId,
        },
      ],
    }),
  // List variable sets that apply to a job template (inherited from project)
  listByJobTemplate: (jobTemplateId: string) => {
    type VariableSetListResponse = JsonApiResource & {
      attributes?: {
        name?: string;
        description?: string;
        global?: boolean;
        priority?: boolean;
        'updated-at'?: string;
        'var-count'?: number;
        'workspace-count'?: number;
        'project-count'?: number;
      };
    };
    return apiClient.get<{ data: Array<VariableSetListResponse> }>(`/ansible/job-templates/${jobTemplateId}/variable-sets`).then(res => {
      return (res.data || []).map((item: VariableSetListResponse) => ({
        id: item.id,
        organization_id: '',
        name: item.attributes?.name || '',
        description: item.attributes?.description || '',
        scope: item.attributes?.global ? 'organization' : 'workspace',
        priority: item.attributes?.priority || false,
        variables: [],
        projects: [],
        workspaces: [],
        created_at: '',
        updated_at: item.attributes?.['updated-at'] || '',
      }));
    });
  },
  // Variable Set Variables
  listVariables: (_organizationName: string, variableSetId: string) =>
    // TFE spec: GET /api/v2/varsets/:varset_id/relationships/vars
    apiClient.get<{ data: Array<{ id: string; type: string; attributes: VariableSetVariable }> }>(`/varsets/${variableSetId}/relationships/vars`).then(res => {
      // Convert JSON:API format to simple VariableSetVariable objects
      if (!res.data) return [];
      return res.data.map((item: JsonApiResource) => ({
        id: item.id,
        variable_set_id: variableSetId,
        key: item.attributes?.key || '',
        value: item.attributes?.value || '',
        description: item.attributes?.description || '',
        category: item.attributes?.category || 'terraform',
        hcl: item.attributes?.hcl || false,
        sensitive: item.attributes?.sensitive || false,
        encrypted: false, // Legacy field
        created_at: item.attributes?.['created-at'] || '',
        updated_at: item.attributes?.['updated-at'] || '',
      }));
    }),
  createVariable: (_organizationName: string, variableSetId: string, data: {
    key: string;
    value: string;
    sensitive?: boolean;
    encrypted?: boolean;
    category?: string;
    description?: string;
    hcl?: boolean;
  }) =>
    // TFE spec: POST /api/v2/varsets/:varset_id/relationships/vars
    apiClient.post<{ data: { id: string; type: string; attributes: VariableSetVariable } }>(`/varsets/${variableSetId}/relationships/vars`, {
      data: {
        type: 'vars', // TFE uses "vars" not "variable-set-variables"
        attributes: {
          key: data.key,
          value: data.value,
          description: data.description || '',
          category: data.category || 'terraform',
          hcl: data.hcl || false,
          sensitive: data.sensitive || false,
        },
      },
    }).then(res => {
      // Convert JSON:API response to simple VariableSetVariable object
      const attrs = res.data.attributes;
      return {
        id: res.data.id,
        variable_set_id: variableSetId,
        key: attrs.key,
        value: attrs.value,
        description: attrs.description,
        category: attrs.category,
        hcl: attrs.hcl,
        sensitive: attrs.sensitive,
        encrypted: false,
        created_at: '',
        updated_at: '',
      };
    }),
  updateVariable: (_organizationName: string, variableSetId: string, variableId: string, data: {
    key?: string;
    value?: string;
    sensitive?: boolean;
    encrypted?: boolean;
    category?: string;
    description?: string;
    hcl?: boolean;
  }) =>
    // TFE spec: PATCH /api/v2/varsets/:varset_id/relationships/vars/:var_id
    apiClient.patch<{ data: { id: string; type: string; attributes: VariableSetVariable } }>(`/varsets/${variableSetId}/relationships/vars/${variableId}`, {
      data: {
        type: 'vars', // TFE uses "vars" not "variable-set-variables"
        attributes: {
          ...(data.key && { key: data.key }),
          ...(data.value && { value: data.value }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.category && { category: data.category }),
          ...(data.hcl !== undefined && { hcl: data.hcl }),
          ...(data.sensitive !== undefined && { sensitive: data.sensitive }),
        },
      },
    }).then(res => {
      // Convert JSON:API response to simple VariableSetVariable object
      const attrs = res.data.attributes;
      return {
        id: res.data.id,
        variable_set_id: variableSetId,
        key: attrs.key,
        value: attrs.value,
        description: attrs.description,
        category: attrs.category,
        hcl: attrs.hcl,
        sensitive: attrs.sensitive,
        encrypted: false,
        created_at: '',
        updated_at: '',
      };
    }),
  deleteVariable: (_organizationName: string, variableSetId: string, variableId: string) =>
    // TFE spec: DELETE /api/v2/varsets/:varset_id/relationships/vars/:var_id
    apiClient.delete(`/varsets/${variableSetId}/relationships/vars/${variableId}`),
};

export const twoFactorApi = {
  getStatus: () => apiClient.get<{ enabled: boolean }>('/settings/2fa/status'),
  start: () => apiClient.post<{ secret: string; url: string }>('/settings/2fa/start'),
  verify: (code: string) => apiClient.post<{ message: string }>('/settings/2fa/verify', { code }),
  remove: () => apiClient.delete<{ message: string }>('/settings/2fa'),
  listDevices: () => apiClient.get<{ devices: MFADevice[] }>('/settings/mfa-devices'),
};

export interface MFADevice {
  type: 'TOTP' | 'U2F' | 'OTP_SMS' | 'OTP_EMAIL' | 'PASSKEY';
  name: string;
  id?: string;
  state: string;
}

export interface OrganizationMembership {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'admin' | 'member' | 'viewer';
  status?: 'active' | 'invited';
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
  teams?: Array<{
    id: string;
    name: string;
    description?: string;
    visibility?: string;
  }>;
}

export interface Team {
  id: string;
  organization_id: string;
  name: string;
  visibility: 'organization' | 'secret';
  'allow-member-token-management'?: boolean;
  'sso-team-id'?: string | null;
  'organization-access'?: Record<string, boolean>;
  'users-count'?: number;
  permissions?: Record<string, boolean>;
  created_at: string;
  updated_at: string;
  'organization-memberships'?: OrganizationMembership[];
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  username: string;
  bio: string;
  company: string;
  location: string;
  avatar?: string;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  user_agent: string;
  ip_address?: string;
  creation_date: string;
  expiration_date: string;
  factors: string[];
  is_current?: boolean;
}

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes?: string[];
  organization_id?: string;
  project_id?: string;
  expires_at?: string;
  last_used_at?: string;
  created_at: string;
}

export interface CreateApiKeyResponse {
  id: string;
  name: string;
  key: string; // Only shown once during creation
  key_prefix: string;
  scopes?: string[];
  organization_id?: string;
  project_id?: string;
  expires_at?: string;
  created_at: string;
}

export const settingsApi = {
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post<{ message: string }>('/settings/password', {
      current_password: currentPassword,
      new_password: newPassword,
    }),
  getProfile: () => apiClient.get<UserProfile>('/settings/profile'),
  updateProfile: (data: Partial<UserProfile>) =>
    apiClient.patch<{ message: string; profile: UserProfile }>('/settings/profile', data),
  listSessions: () => apiClient.get<{ sessions: Session[] }>('/settings/sessions'),
  revokeSession: (sessionId: string) =>
    apiClient.delete<{ message: string }>(`/settings/sessions/${sessionId}`),
  // API Keys
  listApiKeys: () => apiClient.get<{ api_keys: ApiKey[] }>('/settings/api-keys'),
  createApiKey: (data: { name: string; scopes?: string[]; expires_at?: string }) =>
    apiClient.post<CreateApiKeyResponse>('/settings/api-keys', data),
  deleteApiKey: (id: string) =>
    apiClient.delete<{ message: string }>(`/settings/api-keys/${id}`),
};

// Personal (user-bound) tokens — the `terraform login` / personal access
// token. These are minted at /api/v2/tokens (kind="user"): they act as the
// user across all of their organization memberships and carry no scopes. This
// is a deliberately separate surface from the scoped, org-bound API keys above.
export interface UserToken {
  id: string;
  description: string;
  last_used_at?: string;
  expires_at?: string;
  created_at: string;
}

export interface CreateUserTokenResponse {
  id: string;
  token: string; // Only shown once during creation
  description: string;
  expires_at?: string;
  created_at: string;
}

interface UserTokenResource {
  id: string;
  type: string;
  attributes: {
    token?: string;
    description: string;
    last_used_at?: string;
    expires_at?: string;
    created_at: string;
  };
}

export const tokensApi = {
  list: async (): Promise<UserToken[]> => {
    const response = await apiClient.get<{ data: UserTokenResource[] }>('/tokens');
    return (response.data || []).map((t) => ({
      id: t.id,
      description: t.attributes.description,
      last_used_at: t.attributes.last_used_at,
      expires_at: t.attributes.expires_at,
      created_at: t.attributes.created_at,
    }));
  },
  create: async (data: { description: string; expires_at?: string }): Promise<CreateUserTokenResponse> => {
    const response = await apiClient.post<{ data: UserTokenResource }>('/tokens', data);
    return {
      id: response.data.id,
      token: response.data.attributes.token ?? '',
      description: response.data.attributes.description,
      expires_at: response.data.attributes.expires_at,
      created_at: response.data.attributes.created_at,
    };
  },
  delete: (id: string) => apiClient.delete<void>(`/tokens/${id}`),
};

// Activity Types
export interface Activity {
  id: string;
  type: string;
  attributes: {
    action: string;
    resource_type: string;
    resource_id?: string;
    details?: Record<string, unknown>;
    user_id?: string;
    organization_id?: string;
    project_id?: string;
    workspace_id?: string;
    created_at: string;
  };
}

export const activitiesApi = {
  list: (params?: {
    limit?: number;
    offset?: number;
    user_id?: string;
    organization_id?: string;
    workspace_id?: string;
    action?: string;
    resource_type?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.user_id) queryParams.append('user_id', params.user_id);
    if (params?.organization_id) queryParams.append('organization_id', params.organization_id);
    if (params?.workspace_id) queryParams.append('workspace_id', params.workspace_id);
    if (params?.action) queryParams.append('action', params.action);
    if (params?.resource_type) queryParams.append('resource_type', params.resource_type);
    
    const query = queryParams.toString();
    return apiClient.get<{ data: Activity[]; meta: { pagination: { total: number; limit: number; offset: number } } }>(
      `/activities${query ? `?${query}` : ''}`
    );
  },
  getRecent: (params?: { limit?: number; organization_id?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.organization_id) queryParams.append('organization_id', params.organization_id);
    
    const query = queryParams.toString();
    return apiClient.get<{ data: Activity[] }>(`/activities/recent${query ? `?${query}` : ''}`);
  },
};

// Dashboard Types
export interface DashboardStats {
  projects: number;
  terraform_workspaces: number;
  ansible_playbooks: number;
  active_terraform_runs: number;
  active_ansible_jobs: number;
  completed_terraform_runs_this_month: number;
  completed_ansible_jobs_this_month: number;
  organizations: Array<{
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
  }>;
}

// Dashboard API
export const dashboardApi = {
  getStats: () =>
    apiClient.get<JsonApiResponse<JsonApiResource>>('/dashboard/stats').then(res => {
      // Extract attributes from JSON:API format
      const attributes = (res.data)?.attributes || {};
      return {
        data: attributes as DashboardStats,
      };
    }),
};

// Registry Types
export interface Module {
  id: string;
  organization_id: string;
  name: string;
  provider: string;
  description?: string;
  source?: string;
  verified: boolean;
  vcs_connection_id?: string;
  vcs_provider?: string;
  vcs_account_name?: string;
  vcs_repository?: string;
  auto_publish_tags: boolean;
  latest_version?: string;
  published_at?: string;
  downloads?: number;
  created_at: string;
  updated_at: string;
}

export interface ModuleVersion {
  id: string;
  module_id: string;
  version: string;
  source?: string;
  readme?: string;
  published_at: string;
  downloads: number;
  tarball_path?: string;
  tarball_size?: number;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  dependencies?: unknown[];
  resources?: unknown[];
  submodules?: unknown[];
  created_at: string;
  updated_at: string;
}

export interface Provider {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProviderVersion {
  id: string;
  provider_id: string;
  version: string;
  published_at: string;
  downloads: number;
  platforms?: ProviderPlatform[];
  created_at: string;
  updated_at: string;
}

export interface ProviderPlatform {
  id: string;
  provider_version_id: string;
  os: string;
  arch: string;
  filename: string;
  shasum: string;
  binary_path?: string;
  binary_size?: number;
  created_at: string;
  updated_at: string;
}

// Registry API functions
export const registryApi = {
  // Module Management
  modules: {
    list: (organizationName: string) =>
      apiClient.get<{ data: Array<{ id: string; type: string; attributes: Omit<Module, 'id'> }> }>(
        `/organizations/${organizationName}/registry/modules`
      ).then(res => {
        return (res.data || []).map((item: JsonApiResource) => ({
          id: item.id,
          organization_id: '',
          ...item.attributes,
        })) as Module[];
      }),
    get: (organizationName: string, moduleName: string, provider: string) =>
      apiClient.get<{ data: { id: string; type: string; attributes: Omit<Module, 'id'> } }>(
        `/organizations/${organizationName}/registry/modules/${moduleName}/${provider}`
      ).then(res => ({
        id: res.data.id,
        ...res.data.attributes,
        organization_id: '',
      })) as Promise<Module>,
    getVersions: (organizationName: string, moduleName: string, provider: string) =>
      apiClient.get<{ data: Array<{ id: string; type: string; attributes: Omit<ModuleVersion, 'id'> }> }>(
        `/organizations/${organizationName}/registry/modules/${moduleName}/${provider}/versions`
      ).then(res => {
        return (res.data || []).map((item: JsonApiResource) => ({
          id: item.id,
          module_id: '',
          ...item.attributes,
        })) as ModuleVersion[];
      }),
    create: (organizationName: string, data: {
      name: string;
      provider: string;
      description?: string;
      vcs_connection_id?: string;
      vcs_repository?: string;
      auto_publish_tags?: boolean;
    }) =>
      apiClient.post<{ data: { id: string; type: string; attributes: Omit<Module, 'id'> } }>(
        `/organizations/${organizationName}/registry/modules`,
        data
      ).then(res => ({
        id: res.data.id,
        ...res.data.attributes,
        organization_id: '',
      })) as Promise<Module>,
    delete: (organizationName: string, moduleName: string, provider: string) =>
      apiClient.delete(`/organizations/${organizationName}/registry/modules/${moduleName}/${provider}`),
    deleteVersion: (organizationName: string, moduleName: string, provider: string, version: string) =>
      apiClient.delete(`/organizations/${organizationName}/registry/modules/${moduleName}/${provider}/versions/${version}`),
    deleteAll: (organizationName: string) =>
      apiClient.delete(`/organizations/${organizationName}/registry/modules`),
    publishVersion: async (organizationName: string, moduleName: string, provider: string, version: string, file: File) => {
      const formData = new FormData();
      formData.append('version', version);
      formData.append('file', file);

      const url = `${API_BASE_URL}/organizations/${organizationName}/registry/modules/${moduleName}/${provider}/versions`;
      const { getAccessToken } = await import('@/lib/zitadel');
      const accessToken = getAccessToken();

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.errors?.[0]?.detail || errorData.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    },
  },
  // Provider Management
  providers: {
    list: (organizationName: string) =>
      apiClient.get<{ data: Array<{ id: string; type: string; attributes: Omit<Provider, 'id'> }> }>(
        `/organizations/${organizationName}/registry/providers`
      ).then(res => {
        return (res.data || []).map((item: JsonApiResource) => ({
          id: item.id,
          organization_id: '',
          ...item.attributes,
        })) as Provider[];
      }),
    get: (organizationName: string, providerName: string) =>
      apiClient.get<{ data: { id: string; type: string; attributes: Omit<Provider, 'id'> } }>(
        `/organizations/${organizationName}/registry/providers/${providerName}`
      ).then(res => ({
        id: res.data.id,
        ...res.data.attributes,
        organization_id: '',
      })) as Promise<Provider>,
    create: (organizationName: string, data: {
      name: string;
      description?: string;
    }) =>
      apiClient.post<{ data: { id: string; type: string; attributes: Omit<Provider, 'id'> } }>(
        `/organizations/${organizationName}/registry/providers`,
        data
      ).then(res => ({
        id: res.data.id,
        ...res.data.attributes,
        organization_id: '',
      })) as Promise<Provider>,
    publishPlatform: async (organizationName: string, providerName: string, version: string, os: string, arch: string, file: File) => {
      const formData = new FormData();
      formData.append('os', os);
      formData.append('arch', arch);
      formData.append('file', file);

      const url = `${API_BASE_URL}/organizations/${organizationName}/registry/providers/${providerName}/versions/${version}/platforms`;
      const { getAccessToken } = await import('@/lib/zitadel');
      const accessToken = getAccessToken();

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.errors?.[0]?.detail || errorData.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    },
  },
};

// Organization Memberships API (TFE-compatible)
export const organizationMembershipsApi = {
  list: (organizationName: string) =>
    apiClient.get<{ data: JsonApiResource[]; included?: JsonApiResource[]; meta?: { pagination: { page: number; per_page: number; total: number } } }>(`/organizations/${organizationName}/organization-memberships`).then(res => {
      // Parse JSON:API format - match user data from included array
      const userMap = new Map<string, JsonApiResource>();
      if (res.included) {
        res.included.forEach((item: JsonApiResource) => {
          if (item.type === 'users') {
            userMap.set(item.id, item);
          }
        });
      }

      // Build team map from included array
      const teamMap = new Map<string, JsonApiResource>();
      if (res.included) {
        res.included.forEach((item: JsonApiResource) => {
          if (item.type === 'teams') {
            teamMap.set(item.id, item);
          }
        });
      }

      return {
        data: (res.data || []).map((item: JsonApiResource) => {
          const userRel = getRelationship(item, 'user');
          const user = userRel?.id ? userMap.get(userRel.id) : undefined;
          
          // Parse teams from relationships using getRelationships helper
          const teamsRel = getRelationships(item, 'teams');
          const teams: Array<{ id: string; name: string; description?: string; visibility?: string }> = [];
          teamsRel.forEach((teamRef: JsonApiResourceIdentifier) => {
            const team = teamMap.get(teamRef.id);
            if (team) {
              teams.push({
                id: team.id,
                name: team.attributes?.name || '',
                description: team.attributes?.description,
                visibility: team.attributes?.visibility,
              });
            }
          });
          
          return {
            id: item.id,
            organization_id: getRelationship(item, 'organization')?.id || '',
            user_id: getRelationship(item, 'user')?.id || '',
            role: item.attributes?.role || 'viewer',
            status: (item.attributes?.status as 'active' | 'invited') || 'active',
            created_at: item.attributes?.['created-at'] || '',
            updated_at: item.attributes?.['updated-at'] || '',
            user: user ? {
              id: user.id,
              email: user.attributes?.email || '',
              name: user.attributes?.name || '',
            } : undefined,
            teams: teams.length > 0 ? teams : undefined,
          };
        }),
        meta: res.meta,
      };
    }),
  create: (organizationName: string, data: { email: string; role?: 'admin' | 'member' | 'viewer' }) =>
    apiClient.post<{ data: JsonApiResource }>(`/organizations/${organizationName}/organization-memberships`, {
      data: {
        type: 'organization-memberships',
        attributes: {
          email: data.email,
          // Role is deprecated - backend ignores it, permissions come from team memberships
          ...(data.role && { role: data.role }),
        },
      },
    }).then(res => {
      const item = res.data;
      return {
        id: item.id,
        organization_id: getRelationship(item, 'organization')?.id || '',
        user_id: getRelationship(item, 'user')?.id || '',
        role: item.attributes?.role || 'viewer',
        created_at: item.attributes?.['created-at'] || '',
        updated_at: item.attributes?.['updated-at'] || '',
      };
    }),
  get: (id: string) =>
    apiClient.get<{ data: JsonApiResource; included?: JsonApiResource[] }>(`/organization-memberships/${id}`).then(res => {
      const item = res.data;
      // Parse user from included array if present
      const userRel = getRelationship(item, 'user');
      let user: { id: string; email: string; name?: string } | undefined;
      if (userRel?.id && res.included) {
        const userResource = res.included.find((inc: JsonApiResource) => inc.type === 'users' && inc.id === userRel.id);
        if (userResource) {
          user = {
            id: userResource.id,
            email: userResource.attributes?.email || '',
            name: userResource.attributes?.name,
          };
        }
      }
      
      return {
        id: item.id,
        organization_id: getRelationship(item, 'organization')?.id || '',
        user_id: getRelationship(item, 'user')?.id || '',
        role: item.attributes?.role || 'viewer',
        status: (item.attributes?.status as 'active' | 'invited') || 'active',
        created_at: item.attributes?.['created-at'] || '',
        updated_at: item.attributes?.['updated-at'] || '',
        user,
      };
    }),
  update: (id: string, data: { role: 'admin' | 'member' | 'viewer' }) =>
    apiClient.patch<{ data: JsonApiResource; included?: JsonApiResource[] }>(`/organization-memberships/${id}`, {
      data: {
        type: 'organization-memberships',
        id: id,
        attributes: {
          role: data.role,
        },
      },
    }).then(res => {
      const item = res.data;
      const userRel = getRelationship(item, 'user');
      let user: { id: string; email: string; name?: string } | undefined;
      if (userRel?.id && res.included) {
        const userResource = res.included.find((inc: JsonApiResource) => inc.type === 'users' && inc.id === userRel.id);
        if (userResource) {
          user = {
            id: userResource.id,
            email: userResource.attributes?.email || '',
            name: userResource.attributes?.name,
          };
        }
      }
      return {
        id: item.id,
        organization_id: getRelationship(item, 'organization')?.id || '',
        user_id: getRelationship(item, 'user')?.id || '',
        role: item.attributes?.role || 'viewer',
        status: (item.attributes?.status as 'active' | 'invited') || 'active',
        created_at: item.attributes?.['created-at'] || '',
        updated_at: item.attributes?.['updated-at'] || '',
        user,
      };
    }),
  delete: (id: string) => apiClient.delete(`/organization-memberships/${id}`),
};

// Teams API (TFE-compatible)
export const teamsApi = {
  list: (organizationName: string) =>
    apiClient.get<{ data: JsonApiResource[]; meta?: { pagination: { page: number; per_page: number; total: number } } }>(`/organizations/${organizationName}/teams`).then(res => {
      // Parse JSON:API format to flat Team objects
      return {
        data: (res.data || []).map((item: JsonApiResource) => {
          const team: Team = {
            id: item.id,
            organization_id: getRelationship(item, 'organization')?.id || '',
            name: item.attributes?.name || '',
            visibility: item.attributes?.visibility || 'secret',
            'allow-member-token-management': item.attributes?.['allow-member-token-management'],
            'sso-team-id': item.attributes?.['sso-team-id'],
            'organization-access': item.attributes?.['organization-access'],
            'users-count': item.attributes?.['users-count'],
            permissions: item.attributes?.permissions,
            created_at: item.attributes?.['created-at'] || '',
            updated_at: item.attributes?.['updated-at'] || '',
          };
          return team;
        }),
        meta: res.meta,
      };
    }),
  get: (id: string, includeMembers?: boolean) => {
    const include = includeMembers ? '?include=organization-memberships' : '';
    return apiClient.get<{ data: JsonApiResource; included?: JsonApiResource[] }>(`/teams/${id}${include}`).then(res => {
      const item = res.data;
      const team: Team = {
        id: item.id,
        organization_id: getRelationship(item, 'organization')?.id || '',
        name: item.attributes?.name || '',
        visibility: item.attributes?.visibility || 'secret',
        'allow-member-token-management': item.attributes?.['allow-member-token-management'],
        'sso-team-id': item.attributes?.['sso-team-id'],
        'organization-access': item.attributes?.['organization-access'],
        'users-count': item.attributes?.['users-count'],
        permissions: item.attributes?.permissions,
        created_at: item.attributes?.['created-at'] || '',
        updated_at: item.attributes?.['updated-at'] || '',
      };

      // Parse included organization memberships if present
      if (includeMembers && res.included) {
        // Build user map from included array
        const userMap = new Map<string, JsonApiResource>();
        res.included.forEach((inc: JsonApiResource) => {
          if (inc.type === 'users') {
            userMap.set(inc.id, inc);
          }
        });

        team['organization-memberships'] = res.included
          .filter((inc: JsonApiResource) => inc.type === 'organization-memberships')
          .map((inc: JsonApiResource) => {
            const userRel = getRelationship(inc, 'user');
            const user = userRel?.id ? userMap.get(userRel.id) : undefined;
            
            return {
              id: inc.id,
              organization_id: getRelationship(inc, 'organization')?.id || '',
              user_id: getRelationship(inc, 'user')?.id || '',
              role: inc.attributes?.role || 'viewer',
              created_at: inc.attributes?.['created-at'] || '',
              updated_at: inc.attributes?.['updated-at'] || '',
              user: user ? {
                id: user.id,
                email: user.attributes?.email || '',
                name: user.attributes?.name || '',
              } : undefined,
            };
          });
      }

      return team;
    });
  },
  create: (organizationName: string, data: {
    name: string;
    visibility?: 'organization' | 'secret';
    'allow-member-token-management'?: boolean;
    'sso-team-id'?: string | null;
    'organization-access'?: Record<string, boolean>;
  }) =>
    apiClient.post<{ data: JsonApiResource }>(`/organizations/${organizationName}/teams`, {
      data: {
        type: 'teams',
        attributes: {
          name: data.name,
          visibility: data.visibility || 'secret',
          ...(data['allow-member-token-management'] !== undefined && { 'allow-member-token-management': data['allow-member-token-management'] }),
          ...(data['sso-team-id'] !== undefined && { 'sso-team-id': data['sso-team-id'] }),
          ...(data['organization-access'] !== undefined && { 'organization-access': data['organization-access'] }),
        },
      },
    }).then(res => {
      const item = res.data;
      return {
        id: item.id,
        organization_id: getRelationship(item, 'organization')?.id || '',
        name: item.attributes?.name || '',
        visibility: item.attributes?.visibility || 'secret',
        'allow-member-token-management': item.attributes?.['allow-member-token-management'],
        'sso-team-id': item.attributes?.['sso-team-id'],
        'organization-access': item.attributes?.['organization-access'],
        created_at: item.attributes?.['created-at'] || '',
        updated_at: item.attributes?.['updated-at'] || '',
      };
    }),
  update: (id: string, data: {
    name?: string;
    visibility?: 'organization' | 'secret';
    'allow-member-token-management'?: boolean;
    'sso-team-id'?: string | null;
    'organization-access'?: Record<string, boolean>;
  }) =>
    apiClient.patch<{ data: JsonApiResource }>(`/teams/${id}`, {
      data: {
        type: 'teams',
        id: id,
        attributes: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.visibility !== undefined && { visibility: data.visibility }),
          ...(data['allow-member-token-management'] !== undefined && { 'allow-member-token-management': data['allow-member-token-management'] }),
          ...(data['sso-team-id'] !== undefined && { 'sso-team-id': data['sso-team-id'] }),
          ...(data['organization-access'] !== undefined && { 'organization-access': data['organization-access'] }),
        },
      },
    }).then(res => {
      const item = res.data;
      return {
        id: item.id,
        organization_id: getRelationship(item, 'organization')?.id || '',
        name: item.attributes?.name || '',
        visibility: item.attributes?.visibility || 'secret',
        'allow-member-token-management': item.attributes?.['allow-member-token-management'],
        'sso-team-id': item.attributes?.['sso-team-id'],
        'organization-access': item.attributes?.['organization-access'],
        created_at: item.attributes?.['created-at'] || '',
        updated_at: item.attributes?.['updated-at'] || '',
      };
    }),
  delete: (id: string) => apiClient.delete(`/teams/${id}`),
  // Team Organization Memberships (TFE-compatible)
  listOrganizationMemberships: (teamId: string) =>
    apiClient.get<{ data: JsonApiResource[]; included?: JsonApiResource[] }>(`/teams/${teamId}/relationships/organization-memberships`).then(res => {
      // Parse JSON:API format to flat OrganizationMembership objects
      // Match user data from included array
      const userMap = new Map<string, JsonApiResource>();
      if (res.included) {
        res.included.forEach((item: JsonApiResource) => {
          if (item.type === 'users') {
            userMap.set(item.id, item);
          }
        });
      }

      return {
        data: (res.data || []).map((item: JsonApiResource) => {
          const userRel = getRelationship(item, 'user');
          const user = userRel?.id ? userMap.get(userRel.id) : undefined;
          
          return {
            id: item.id,
            organization_id: getRelationship(item, 'organization')?.id || '',
            user_id: getRelationship(item, 'user')?.id || '',
            role: item.attributes?.role || 'viewer',
            created_at: item.attributes?.['created-at'] || '',
            updated_at: item.attributes?.['updated-at'] || '',
            user: user ? {
              id: user.id,
              email: user.attributes?.email || '',
              name: user.attributes?.name || '',
            } : undefined,
          };
        }),
      };
    }),
  addOrganizationMemberships: (teamId: string, membershipIds: string[]) =>
    apiClient.post(`/teams/${teamId}/relationships/organization-memberships`, {
      data: membershipIds.map(id => ({ type: 'organization-memberships', id })),
    }),
  removeOrganizationMemberships: (teamId: string, membershipIds: string[]) =>
    apiClient.delete(`/teams/${teamId}/relationships/organization-memberships`, {
      data: membershipIds.map(id => ({ type: 'organization-memberships', id })),
    }),
};

// Team Project Access API (TFE-compatible)
export interface TeamProjectAccess {
  id: string;
  team_id: string;
  project_id: string;
  access?: 'admin' | 'maintain' | 'write' | 'read' | 'custom';
  project_settings?: string;
  project_teams?: string;
  project_variable_sets?: string;
  workspace_runs?: string;
  workspace_sentinel_mocks?: string;
  workspace_state_versions?: string;
  workspace_variables?: string;
  workspace_create?: boolean;
  workspace_locking?: boolean;
  workspace_move?: boolean;
  workspace_delete?: boolean;
  workspace_run_tasks?: boolean;
  created_at: string;
  updated_at: string;
}

export const teamProjectAccessApi = {
  list: (projectId?: string) => {
    const filter = projectId ? `?filter[project][id]=${projectId}` : '';
    return apiClient.get<{ data: JsonApiResource[]; included?: JsonApiResource[] }>(`/team-projects${filter}`).then(res => {
      return {
        data: (res.data || []).map((item: JsonApiResource) => {
          const attrs = item.attributes || {};
          const projectAccess = attrs['project-access'];
          const workspaceAccess = attrs['workspace-access'];
          return {
            id: item.id,
            team_id: getRelationship(item, 'team')?.id || '',
            project_id: getRelationship(item, 'project')?.id || '',
            access: attrs.access,
            project_settings: projectAccess?.settings,
            project_teams: projectAccess?.teams,
            project_variable_sets: projectAccess?.['variable-sets'],
            workspace_runs: workspaceAccess?.runs,
            workspace_sentinel_mocks: workspaceAccess?.['sentinel-mocks'],
            workspace_state_versions: workspaceAccess?.['state-versions'],
            workspace_variables: workspaceAccess?.variables,
            workspace_create: workspaceAccess?.create,
            workspace_locking: workspaceAccess?.locking,
            workspace_move: workspaceAccess?.move,
            workspace_delete: workspaceAccess?.delete,
            workspace_run_tasks: workspaceAccess?.['run-tasks'],
            created_at: attrs['created-at'] || '',
            updated_at: attrs['updated-at'] || '',
          };
        }),
      };
    });
  },
  create: (teamId: string, projectId: string, access: 'admin' | 'maintain' | 'write' | 'read' | 'custom', customPermissions?: {
    'project-access'?: {
      settings?: string;
      teams?: string;
      'variable-sets'?: string;
    };
    'workspace-access'?: {
      runs?: string;
      'sentinel-mocks'?: string;
      'state-versions'?: string;
      variables?: string;
      create?: boolean;
      locking?: boolean;
      move?: boolean;
      delete?: boolean;
      'run-tasks'?: boolean;
    };
  }) =>
    apiClient.post<{ data: JsonApiResource }>(`/team-projects`, {
      data: {
        type: 'team-projects',
        attributes: {
          access,
          ...(customPermissions?.['project-access'] && { 'project-access': customPermissions['project-access'] }),
          ...(customPermissions?.['workspace-access'] && { 'workspace-access': customPermissions['workspace-access'] }),
        },
        relationships: {
          team: { data: { type: 'teams', id: teamId } },
          project: { data: { type: 'projects', id: projectId } },
        },
      },
    }),
  update: (id: string, access?: 'admin' | 'maintain' | 'write' | 'read' | 'custom', customPermissions?: {
    'project-access'?: {
      settings?: string;
      teams?: string;
      'variable-sets'?: string;
    };
    'workspace-access'?: {
      runs?: string;
      'sentinel-mocks'?: string;
      'state-versions'?: string;
      variables?: string;
      create?: boolean;
      locking?: boolean;
      move?: boolean;
      delete?: boolean;
      'run-tasks'?: boolean;
    };
  }) =>
    apiClient.patch<{ data: JsonApiResource }>(`/team-projects/${id}`, {
      data: {
        type: 'team-projects',
        id,
        attributes: {
          ...(access !== undefined && { access }),
          ...(customPermissions?.['project-access'] && { 'project-access': customPermissions['project-access'] }),
          ...(customPermissions?.['workspace-access'] && { 'workspace-access': customPermissions['workspace-access'] }),
        },
      },
    }),
  delete: (id: string) => apiClient.delete(`/team-projects/${id}`),
};

// Team Workspace Access API (TFE-compatible)
export interface TeamWorkspaceAccess {
  id: string;
  team_id: string;
  workspace_id: string;
  access?: 'admin' | 'read' | 'plan' | 'write';
  runs?: string;
  variables?: string;
  state_versions?: string;
  sentinel_mocks?: string;
  workspace_locking?: boolean;
  run_tasks?: boolean;
  created_at: string;
  updated_at: string;
}

export const teamWorkspaceAccessApi = {
  list: (workspaceId?: string) => {
    const filter = workspaceId ? `?filter[workspace][id]=${workspaceId}` : '';
    return apiClient.get<{ data: JsonApiResource[]; included?: JsonApiResource[] }>(`/team-workspaces${filter}`).then(res => {
      return {
        data: (res.data || []).map((item: JsonApiResource) => {
          const attrs = item.attributes || {};
          return {
            id: item.id,
            team_id: getRelationship(item, 'team')?.id || '',
            workspace_id: getRelationship(item, 'workspace')?.id || '',
            access: attrs.access,
            runs: attrs.runs,
            variables: attrs.variables,
            state_versions: attrs['state-versions'],
            sentinel_mocks: attrs['sentinel-mocks'],
            workspace_locking: attrs['workspace-locking'],
            run_tasks: attrs['run-tasks'],
            created_at: attrs['created-at'] || '',
            updated_at: attrs['updated-at'] || '',
          };
        }),
      };
    });
  },
  create: (teamId: string, workspaceId: string, access: 'admin' | 'read' | 'plan' | 'write') =>
    apiClient.post<{ data: JsonApiResource }>(`/team-workspaces`, {
      data: {
        type: 'team-workspaces',
        attributes: {
          access,
        },
        relationships: {
          team: { data: { type: 'teams', id: teamId } },
          workspace: { data: { type: 'workspaces', id: workspaceId } },
        },
      },
    }),
  update: (id: string, access: 'admin' | 'read' | 'plan' | 'write') =>
    apiClient.patch<{ data: JsonApiResource }>(`/team-workspaces/${id}`, {
      data: {
        type: 'team-workspaces',
        id,
        attributes: {
          access,
        },
      },
    }),
  delete: (id: string) => apiClient.delete(`/team-workspaces/${id}`),
};

// Effective Permissions API
// Returns the union of all permissions from all teams the authenticated user is a member of
export interface EffectivePermissions {
  // Ansible fine-grained
  'ansible:playbook:read': boolean;
  'ansible:playbook:write': boolean;
  'ansible:inventory:read': boolean;
  'ansible:inventory:write': boolean;
  'ansible:credential:read': boolean;
  'ansible:credential:write': boolean;
  'ansible:job-template:read': boolean;
  'ansible:job-template:write': boolean;
  'ansible:job:read': boolean;
  'ansible:job:execute': boolean;
  'ansible:schedule:read': boolean;
  'ansible:schedule:write': boolean;
  // Org-level
  'org:manage-ansible': boolean;
  'org:read-ansible': boolean;
  'org:manage-projects': boolean;
  'org:read-projects': boolean;
  'org:manage-workspaces': boolean;
  'org:read-workspaces': boolean;
  'org:manage-teams': boolean;
  'org:manage-membership': boolean;
  'org:manage-agent-pools': boolean;
  [key: string]: boolean;
}

export const permissionsApi = {
  getEffective: async (orgName: string): Promise<EffectivePermissions> => {
    const response = await apiClient.get<{ data: { attributes: EffectivePermissions } }>(
      `/organizations/${orgName}/effective-permissions`
    );
    return response.data.attributes;
  },
};
