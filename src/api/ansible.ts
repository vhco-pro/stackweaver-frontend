// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { apiClient } from './client';
import type { JsonApiResource, JsonApiResponse, JsonApiListResponse } from '@/utils/jsonapi';

// ============================================================================
// Types - These are the FLAT interfaces for use in components after parsing
// ============================================================================

export type CredentialType = 
  | 'ssh' 
  | 'machine-ssh' 
  | 'vcs' 
  | 'vault' 
  | 'aws' 
  | 'azure' 
  | 'gcp' 
  | 'vmware';

export type InventoryType = 'static' | 'dynamic' | 'vcs' | 'constructed';

export type AnsibleJobStatus = 
  | 'pending' 
  | 'running' 
  | 'successful' 
  | 'failed' 
  | 'canceled' 
  | 'error';

// Flat interface types (for use after JSON:API parsing)
export interface AnsibleInventory {
  id: string;
  organization_id: string;
  project_id?: string;
  name: string;
  description?: string;
  type: InventoryType;
  variables?: Record<string, unknown>;
  vcs_connection_id?: string;
  vcs_repository?: string;
  vcs_branch?: string;
  inventory_path?: string;
  last_sync_at?: string;
  last_sync_status?: string;
  last_sync_error?: string;
  last_sync_hosts_discovered?: number;
  last_sync_log?: string;
  // Constructed inventory fields
  source_vars?: string;
  constructed_limit?: string;
  constructed_cache_timeout?: number;
  input_inventories?: { id: string; name: string }[];
  created_at: string;
  updated_at: string;
}

export interface AnsibleInventoryHost {
  id: string;
  inventory_id: string;
  name: string;
  description?: string;
  hostname?: string;
  port?: number;
  variables?: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AnsibleInventoryGroup {
  id: string;
  inventory_id: string;
  parent_id?: string;
  name: string;
  description?: string;
  variables?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AnsibleCredential {
  id: string;
  organization_id: string;
  project_id?: string;
  name: string;
  description?: string;
  type: CredentialType;
  username?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCredentialInput {
  name: string;
  description?: string;
  type: CredentialType;
  project_id?: string;
  username?: string;
  password?: string;
  ssh_private_key?: string;
  ssh_key_passphrase?: string;
  vault_password?: string;
  aws_access_key_id?: string;
  aws_secret_access_key?: string;
  azure_subscription_id?: string;
  azure_tenant_id?: string;
  azure_client_id?: string;
  azure_client_secret?: string;
  gcp_service_account?: string;
  gcp_project?: string;
  vmware_host?: string;
  vmware_username?: string;
  vmware_password?: string;
}

export type UpdateCredentialInput = Partial<CreateCredentialInput> & { project_id?: string };

export interface AnsiblePlaybook {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  vcs_connection_id?: string;
  vcs_repository?: string;
  vcs_branch?: string;
  vcs_provider?: string;
  vcs_account_name?: string;
  playbook_path: string;
  source_mode?: string;
  last_synced_at?: string;
  last_sync_status?: string;
  last_sync_commit?: string;
  last_sync_error?: string;
  cached_commit?: string;
  cached_at?: string;
  cached_size_bytes?: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePlaybookInput {
  name: string;
  description?: string;
  vcs_connection_id?: string;
  vcs_repository?: string;
  vcs_branch?: string;
  playbook_path: string;
  source_mode?: string;
}

export interface AnsibleJobTemplate {
  id: string;
  project_id: string;
  playbook_id: string;
  inventory_id: string;
  credential_id?: string;
  agent_pool_id?: string;
  name: string;
  description?: string;
  extra_vars?: Record<string, unknown>;
  limit?: string;
  tags?: string;
  skip_tags?: string;
  verbosity: number;
  forks: number;
  become: boolean;
  become_user?: string;
  enabled: boolean;
  timeout_seconds: number;
  allow_simultaneous: boolean;
  retention_days?: number | null;
  job_slice_count: number;
  allow_callbacks: boolean;
  launch_on_webhook: boolean;
  host_config_key?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateJobTemplateInput {
  playbook_id: string;
  inventory_id: string;
  credential_id?: string;
  agent_pool_id?: string;
  name: string;
  description?: string;
  extra_vars?: Record<string, unknown>;
  limit?: string;
  tags?: string;
  skip_tags?: string;
  verbosity?: number;
  forks?: number;
  become?: boolean;
  become_user?: string;
  enabled?: boolean;
  timeout_seconds?: number;
  allow_simultaneous?: boolean;
  /** null/undefined = leave unchanged; -1 clears the override (inherit org). */
  retention_days?: number;
  job_slice_count?: number;
  allow_callbacks?: boolean;
  launch_on_webhook?: boolean;
}

export interface AnsibleJob {
  id: string;
  project_id: string;
  playbook_id: string;
  inventory_id: string;
  job_template_id?: string;
  credential_id?: string;
  name: string;
  status: AnsibleJobStatus;
  extra_vars?: Record<string, unknown>;
  limit?: string;
  tags?: string;
  skip_tags?: string;
  verbosity: number;
  forks: number;
  become: boolean;
  become_user?: string;
  hosts_ok: number;
  hosts_changed: number;
  hosts_failed: number;
  hosts_skipped: number;
  hosts_unreachable: number;
  hosts_rescued?: number;
  hosts_ignored?: number;
  has_warnings?: boolean;
  warnings_count?: number;
  started_at?: string;
  finished_at?: string;
  output?: string;
  error_message?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Self-hosted runner info (Phase 3)
  agent_pool_id?: string;
  agent_pool_name?: string;
  runner_id?: string;
  runner_name?: string;
}

export interface CreateJobInput {
  playbook_id: string;
  inventory_id: string;
  credential_id?: string;
  name?: string;
  extra_vars?: Record<string, unknown>;
  limit?: string;
  tags?: string;
  skip_tags?: string;
  verbosity?: number;
  forks?: number;
  become?: boolean;
  become_user?: string;
}

export interface AnsibleJobEvent {
  id: string;
  job_id: string;
  event_type: string;
  event_data?: Record<string, unknown>;
  host?: string;
  task?: string;
  play?: string;
  counter: number;
  stdout?: string;
  stderr?: string;
  changed?: boolean;
  failed?: boolean;
  skipped?: boolean;
  created_at: string;
}

// ============================================================================
// API Functions - Return raw JSON:API format (no parsing)
// Components should use helpers from @/utils/jsonapi to transform data
// ============================================================================

export interface PageParams { page?: number; pageSize?: number }

/** Build a `?page[number]=&page[size]=` query string (plus any extra params), or '' when empty. */
function pageQuery(params?: PageParams, extra?: Record<string, string>): string {
  const qp = new URLSearchParams(extra);
  if (params?.page) qp.append('page[number]', params.page.toString());
  if (params?.pageSize) qp.append('page[size]', params.pageSize.toString());
  const s = qp.toString();
  return s ? `?${s}` : '';
}

// Inventory API
export const ansibleInventoriesApi = {
  list: (organizationName: string, params?: { page?: number; pageSize?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page[number]', params.page.toString());
    if (params?.pageSize) queryParams.append('page[size]', params.pageSize.toString());
    const query = queryParams.toString();
    return apiClient.get<JsonApiListResponse<JsonApiResource>>(
      `/organizations/${organizationName}/ansible/inventories${query ? `?${query}` : ''}`
    );
  },

  get: (id: string) =>
    apiClient.get<JsonApiResponse<JsonApiResource>>(
      `/ansible/inventories/${id}`
    ),

  create: (organizationName: string, data: { name: string; description?: string; type?: InventoryType; variables?: Record<string, unknown>; vcs_connection_id?: string; vcs_repository?: string; vcs_branch?: string; inventory_path?: string; project_id?: string; source_vars?: string; constructed_limit?: string; constructed_cache_timeout?: number; input_inventory_ids?: string[] }) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(
      `/organizations/${organizationName}/ansible/inventories`,
      {
        data: {
          type: 'inventories',
          attributes: {
            name: data.name,
            description: data.description || '',
            'inventory-type': data.type || 'static',
            variables: data.variables || {},
            vcs_repository: data.vcs_repository,
            vcs_branch: data.vcs_branch,
            inventory_path: data.inventory_path,
            ...(data.type === 'constructed' ? {
              'source-vars': data.source_vars || '',
              'constructed-limit': data.constructed_limit || '',
              'constructed-cache-timeout': data.constructed_cache_timeout ?? 0,
              'input-inventory-ids': data.input_inventory_ids || [],
            } : {}),
          },
          relationships: {
            ...(data.vcs_connection_id ? {
              vcs_connection: {
                data: {
                  id: data.vcs_connection_id,
                  type: 'vcs-connections',
                },
              },
            } : {}),
            ...(data.project_id ? {
              project: {
                data: {
                  id: data.project_id,
                  type: 'projects',
                },
              },
            } : {}),
          },
        },
      }
    ),

  update: (id: string, data: Partial<AnsibleInventory> & { input_inventory_ids?: string[] }) =>
    apiClient.patch<JsonApiResponse<JsonApiResource>>(
      `/ansible/inventories/${id}`,
      {
        data: {
          type: 'inventories',
          attributes: {
            name: data.name,
            description: data.description,
            'source-vars': data.source_vars,
            'constructed-limit': data.constructed_limit,
            'constructed-cache-timeout': data.constructed_cache_timeout,
            'input-inventory-ids': data.input_inventory_ids,
          },
          relationships: data.project_id ? {
            project: {
              data: {
                id: data.project_id,
                type: 'projects',
              },
            },
          } : undefined,
        },
      }
    ),

  delete: (id: string, opts?: { force?: boolean }) =>
    apiClient.delete(`/ansible/inventories/${id}${opts?.force ? '?force=true' : ''}`),

  sync: (id: string) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(
      `/ansible/inventories/${id}/actions/sync`
    ),

  exportINI: (id: string) =>
    apiClient.get<{ data: string }>(`/ansible/inventories/${id}/ini`).then(res => res.data),

  exportJSON: (id: string) =>
    apiClient.get<{ data: Record<string, unknown> }>(`/ansible/inventories/${id}/json`).then(res => res.data),
};

// Host API
export const ansibleHostsApi = {
  list: (inventoryId: string, params?: { page?: number; pageSize?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page[number]', params.page.toString());
    if (params?.pageSize) queryParams.append('page[size]', params.pageSize.toString());
    const query = queryParams.toString();
    return apiClient.get<JsonApiListResponse<JsonApiResource>>(
      `/ansible/inventories/${inventoryId}/hosts${query ? `?${query}` : ''}`
    );
  },

  get: (id: string) =>
    apiClient.get<JsonApiResponse<JsonApiResource>>(
      `/ansible/hosts/${id}`
    ),

  create: (inventoryId: string, data: { 
    name: string; 
    description?: string; 
    hostname?: string; 
    port?: number;
    variables?: Record<string, unknown>;
    enabled?: boolean;
    group_ids?: string[];
  }) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(
      `/ansible/inventories/${inventoryId}/hosts`,
      {
        data: {
          type: 'ansible-hosts',
          attributes: {
            name: data.name,
            description: data.description,
            hostname: data.hostname,
            port: data.port,
            variables: data.variables,
            enabled: data.enabled,
          },
        },
      }
    ),

  update: (id: string, data: Partial<AnsibleInventoryHost & { group_ids?: string[] }>) =>
    apiClient.patch<JsonApiResponse<JsonApiResource>>(
      `/ansible/hosts/${id}`,
      {
        data: {
          type: 'ansible-hosts',
          attributes: data,
        },
      }
    ),

  delete: (id: string) =>
    apiClient.delete(`/ansible/hosts/${id}`),
};

// Group API
export const ansibleGroupsApi = {
  list: (inventoryId: string, params?: { page?: number; pageSize?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page[number]', params.page.toString());
    if (params?.pageSize) queryParams.append('page[size]', params.pageSize.toString());
    const query = queryParams.toString();
    return apiClient.get<JsonApiListResponse<JsonApiResource>>(
      `/ansible/inventories/${inventoryId}/groups${query ? `?${query}` : ''}`
    );
  },

  get: (id: string) =>
    apiClient.get<JsonApiResponse<JsonApiResource>>(
      `/ansible/groups/${id}`
    ),

  create: (inventoryId: string, data: { 
    name: string; 
    description?: string; 
    parent_id?: string;
    variables?: Record<string, unknown>;
  }) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(
      `/ansible/inventories/${inventoryId}/groups`,
      {
        data: {
          type: 'ansible-groups',
          attributes: {
            name: data.name,
            description: data.description,
            parent_id: data.parent_id,
            variables: data.variables,
          },
        },
      }
    ),

  update: (id: string, data: Partial<AnsibleInventoryGroup>) =>
    apiClient.patch<JsonApiResponse<JsonApiResource>>(
      `/ansible/groups/${id}`,
      {
        data: {
          type: 'ansible-groups',
          attributes: data,
        },
      }
    ),

  delete: (id: string) =>
    apiClient.delete(`/ansible/groups/${id}`),
};

// Credential API
export const ansibleCredentialsApi = {
  list: (organizationName: string, type?: CredentialType, params?: PageParams) => {
    const query = pageQuery(params, type ? { type } : undefined);
    return apiClient.get<JsonApiListResponse<JsonApiResource>>(
      `/organizations/${organizationName}/ansible/credentials${query}`
    );
  },

  get: (id: string) =>
    apiClient.get<JsonApiResponse<JsonApiResource>>(
      `/ansible/credentials/${id}`
    ),

  create: (organizationName: string, data: CreateCredentialInput) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(
      `/organizations/${organizationName}/ansible/credentials`,
      {
        data: {
          type: 'credentials',
          attributes: {
            name: data.name,
            description: data.description || '',
            'credential-type': data.type,
            username: data.username || '',
            'ssh-private-key': data.ssh_private_key || '',
            'ssh-passphrase': data.ssh_key_passphrase || '',
            password: data.password || '',
            'vault-password': data.vault_password || '',
            'aws-access-key-id': data.aws_access_key_id || '',
            'aws-secret-access-key': data.aws_secret_access_key || '',
            'azure-tenant-id': data.azure_tenant_id || '',
            'azure-client-id': data.azure_client_id || '',
            'azure-client-secret': data.azure_client_secret || '',
            'gcp-service-account': data.gcp_service_account || '',
          },
          relationships: data.project_id ? {
            project: {
              data: {
                id: data.project_id,
                type: 'projects',
              },
            },
          } : undefined,
        },
      }
    ),

  update: (id: string, data: UpdateCredentialInput) => {
    const attributes: Record<string, string | undefined> = {
      name: data.name,
      description: data.description,
    };
    if (data.username !== undefined) {
      attributes.username = data.username;
    }
    if (data.password !== undefined && data.password !== '') {
      attributes.password = data.password;
    }
    return apiClient.patch<JsonApiResponse<JsonApiResource>>(
      `/ansible/credentials/${id}`,
      {
        data: {
          type: 'credentials',
          attributes,
          relationships: data.project_id ? {
            project: {
              data: {
                id: data.project_id,
                type: 'projects',
              },
            },
          } : undefined,
        },
      }
    );
  },

  delete: (id: string) =>
    apiClient.delete(`/ansible/credentials/${id}`),
};

// Playbook API
export const ansiblePlaybooksApi = {
  listByOrganization: (organizationName: string, params?: PageParams) =>
    apiClient.get<JsonApiListResponse<JsonApiResource>>(
      `/organizations/${organizationName}/ansible/playbooks${pageQuery(params)}`
    ),

  list: (projectId: string, params?: PageParams) =>
    apiClient.get<JsonApiListResponse<JsonApiResource>>(
      `/projects/${projectId}/ansible/playbooks${pageQuery(params)}`
    ),

  get: (id: string) =>
    apiClient.get<JsonApiResponse<JsonApiResource>>(
      `/ansible/playbooks/${id}`
    ),

  create: (organizationName: string, data: CreatePlaybookInput & { project_id?: string }) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(
      `/organizations/${organizationName}/ansible/playbooks`,
      {
        data: {
          type: 'ansible-playbooks',
          attributes: {
            name: data.name,
            description: data.description || '',
            'vcs-repository': data.vcs_repository || '',
            'vcs-branch': data.vcs_branch || 'main',
            'playbook-path': data.playbook_path || 'site.yml',
            'source-mode': data.source_mode || 'cached',
          },
          relationships: {
            ...(data.project_id ? {
              project: {
                data: { id: data.project_id, type: 'projects' },
              },
            } : {}),
            ...(data.vcs_connection_id ? {
              'vcs-connection': {
                data: { id: data.vcs_connection_id, type: 'vcs-connections' },
              },
            } : {}),
          },
        },
      }
    ),

  update: (id: string, data: Partial<CreatePlaybookInput>) =>
    apiClient.patch<JsonApiResponse<JsonApiResource>>(
      `/ansible/playbooks/${id}`,
      {
        data: {
          type: 'ansible-playbooks',
          attributes: {
            name: data.name,
            description: data.description,
            'vcs-repository': data.vcs_repository,
            'vcs-branch': data.vcs_branch,
            'playbook-path': data.playbook_path,
            'source-mode': data.source_mode,
          },
          ...(data.vcs_connection_id !== undefined ? {
            relationships: {
              'vcs-connection': data.vcs_connection_id ? {
                data: { id: data.vcs_connection_id, type: 'vcs-connections' },
              } : { data: null },
            },
          } : {}),
        },
      }
    ),

  delete: (id: string) =>
    apiClient.delete(`/ansible/playbooks/${id}`),

  sync: (id: string) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(
      `/ansible/playbooks/${id}/actions/sync`
    ),

  // Lists playbook candidate files in a connected repository, annotated with
  // already-registered playbooks (powers the bulk-import wizard and the job
  // template repository browser).
  listVcsFiles: (organizationName: string, params: {
    vcs_connection_id: string;
    repository: string;
    branch?: string;
    path?: string;
  }) => {
    const query = new URLSearchParams({
      vcs_connection_id: params.vcs_connection_id,
      repository: params.repository,
    });
    if (params.branch) query.set('branch', params.branch);
    if (params.path) query.set('path', params.path);
    return apiClient.get<{ data: PlaybookFileEntry[] }>(
      `/organizations/${organizationName}/ansible/vcs-playbook-files?${query.toString()}`
    );
  },

  bulkImport: (organizationName: string, payload: {
    project_id?: string;
    vcs_connection_id: string;
    repository: string;
    branch?: string;
    source_mode?: string;
    playbooks: { path: string; name?: string }[];
  }) =>
    apiClient.post<{ data: BulkImportResult }>(
      `/organizations/${organizationName}/ansible/playbooks/actions/bulk-import`,
      payload
    ),

  // Returns the playbook registered for (project, connection, repository,
  // branch, path), creating it when absent.
  findOrCreate: (organizationName: string, payload: {
    project_id?: string;
    vcs_connection_id: string;
    repository: string;
    branch?: string;
    path: string;
    name?: string;
    source_mode?: string;
  }) =>
    apiClient.post<JsonApiResponse<JsonApiResource> & { meta?: { created?: boolean } }>(
      `/organizations/${organizationName}/ansible/playbooks/actions/find-or-create`,
      payload
    ),
};

// PlaybookFileEntry is one playbook candidate file from repository discovery.
export interface PlaybookFileEntry {
  path: string;
  name: string;
  registered: boolean;
  playbook_id?: string;
  playbook_name?: string;
}

// BulkImportResult summarizes a bulk-import action.
export interface BulkImportResult {
  results: {
    path: string;
    status: 'created' | 'skipped' | 'failed';
    playbook_id?: string;
    name?: string;
    error?: string;
  }[];
  created: number;
  skipped: number;
  failed: number;
}

// Job Template API
export const ansibleJobTemplatesApi = {
  listByOrganization: (organizationName: string, params?: PageParams) =>
    apiClient.get<JsonApiListResponse<JsonApiResource>>(
      `/organizations/${organizationName}/ansible/job-templates${pageQuery(params)}`
    ),

  list: (projectId: string, params?: PageParams) =>
    apiClient.get<JsonApiListResponse<JsonApiResource>>(
      `/projects/${projectId}/ansible/job-templates${pageQuery(params)}`
    ),

  get: (id: string) =>
    apiClient.get<JsonApiResponse<JsonApiResource>>(
      `/ansible/job-templates/${id}`
    ),

  create: (organizationName: string, data: CreateJobTemplateInput & { project_id?: string }) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(
      `/organizations/${organizationName}/ansible/job-templates`,
      {
        data: {
          type: 'ansible-job-templates',
          attributes: {
            name: data.name,
            description: data.description || '',
            'extra-vars': data.extra_vars || {},
            limit: data.limit || '',
            tags: data.tags || '',
            'skip-tags': data.skip_tags || '',
            verbosity: data.verbosity ?? 0,
            forks: data.forks ?? 5,
            'become-enabled': data.become ?? false,
          },
          relationships: {
            ...(data.project_id ? {
              project: {
                data: { id: data.project_id, type: 'projects' },
              },
            } : {}),
            playbook: {
              data: { id: data.playbook_id, type: 'ansible-playbooks' },
            },
            inventory: {
              data: { id: data.inventory_id, type: 'ansible-inventories' },
            },
            ...(data.credential_id ? {
              credential: {
                data: { id: data.credential_id, type: 'ansible-credentials' },
              },
            } : {}),
            ...(data.agent_pool_id ? {
              'agent-pool': {
                data: { id: data.agent_pool_id, type: 'agent-pools' },
              },
            } : {}),
          },
        },
      }
    ),

  // Multi-credential attachment set (AWX-style: one per type, multiple vaults
  // with distinct vault IDs).
  listCredentials: (id: string) =>
    apiClient.get<{ data: JsonApiResource[] }>(`/ansible/job-templates/${id}/credentials`),

  attachCredential: (id: string, credentialId: string) =>
    apiClient.post<{ data: JsonApiResource }>(`/ansible/job-templates/${id}/credentials`, {
      credential_id: credentialId,
    }),

  detachCredential: (id: string, credentialId: string) =>
    apiClient.delete(`/ansible/job-templates/${id}/credentials/${credentialId}`),

  update: (id: string, data: Partial<CreateJobTemplateInput>) =>
    apiClient.patch<JsonApiResponse<JsonApiResource>>(
      `/ansible/job-templates/${id}`,
      {
        data: {
          type: 'ansible-job-templates',
          attributes: {
            name: data.name,
            description: data.description,
            'extra-vars': data.extra_vars,
            limit: data.limit,
            tags: data.tags,
            'skip-tags': data.skip_tags,
            verbosity: data.verbosity,
            forks: data.forks,
            'become-enabled': data.become,
            enabled: data.enabled,
            'timeout-seconds': data.timeout_seconds,
            'allow-simultaneous': data.allow_simultaneous,
            'retention-days': data.retention_days,
            'job-slice-count': data.job_slice_count,
            'allow-callbacks': data.allow_callbacks,
            'launch-on-webhook': data.launch_on_webhook,
          },
          ...(data.playbook_id !== undefined || data.inventory_id !== undefined || data.credential_id !== undefined || data.agent_pool_id !== undefined ? {
            relationships: {
              ...(data.playbook_id !== undefined ? {
                playbook: {
                  data: { id: data.playbook_id, type: 'ansible-playbooks' },
                },
              } : {}),
              ...(data.inventory_id !== undefined ? {
                inventory: {
                  data: { id: data.inventory_id, type: 'ansible-inventories' },
                },
              } : {}),
              ...(data.credential_id !== undefined ? {
                credential: {
                  data: data.credential_id
                    ? { id: data.credential_id, type: 'ansible-credentials' }
                    : { id: '', type: 'ansible-credentials' },
                },
              } : {}),
              ...(data.agent_pool_id !== undefined ? {
                'agent-pool': {
                  data: data.agent_pool_id
                    ? { id: data.agent_pool_id, type: 'agent-pools' }
                    : { id: '', type: 'agent-pools' },
                },
              } : {}),
            },
          } : {}),
        },
      }
    ),

  delete: (id: string) =>
    apiClient.delete(`/ansible/job-templates/${id}`),

  // Template Variables API
  listVariables: (templateId: string) =>
    apiClient.get<{ data: Array<{ id: string; type: string; attributes: { key: string; value: string; description?: string; category?: string; hcl?: boolean; sensitive: boolean } }> }>(`/ansible/job-templates/${templateId}/vars`).then(res => {
      // Convert JSON:API format to simple Variable-like objects for frontend compatibility
      if (!res.data) return [];
      return res.data.map((item: JsonApiResource) => {
        const attrs = item.attributes as { key?: string; value?: string; description?: string; category?: string; hcl?: boolean; sensitive?: boolean };
        return {
          id: item.id,
          job_template_id: templateId,
          key: attrs?.key || '',
          value: attrs?.value || '',
          description: attrs?.description || '',
          category: attrs?.category || 'env',
          hcl: attrs?.hcl || false,
          encrypted: false, // Legacy field
          sensitive: attrs?.sensitive || false,
          created_at: '',
          updated_at: '',
        };
      });
    }),

  createVariable: (templateId: string, data: {
    key: string;
    value: string;
    description?: string;
    category?: string;
    hcl?: boolean;
    sensitive?: boolean;
  }) =>
    apiClient.post<{ data: { id: string; type: string; attributes: { key: string; value: string; description?: string; category?: string; hcl?: boolean; sensitive: boolean } } }>(`/ansible/job-templates/${templateId}/vars`, {
      data: {
        type: 'vars',
        attributes: {
          key: data.key,
          value: data.value,
          description: data.description || '',
          category: data.category || 'env',
          hcl: data.hcl || false,
          sensitive: data.sensitive || false,
        },
      },
    }).then(res => {
      // Convert JSON:API response to simple Variable-like object
      const attrs = res.data.attributes;
      return {
        id: res.data.id,
        job_template_id: templateId,
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

  updateVariable: (templateId: string, variableId: string, data: {
    key?: string;
    value?: string;
    description?: string;
    category?: string;
    hcl?: boolean;
    sensitive?: boolean;
  }) =>
    apiClient.patch<{ data: { id: string; type: string; attributes: { key: string; value: string; description?: string; category?: string; hcl?: boolean; sensitive: boolean } } }>(`/ansible/job-templates/${templateId}/vars/${variableId}`, {
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
      // Convert JSON:API response to simple Variable-like object
      const attrs = res.data.attributes;
      return {
        id: res.data.id,
        job_template_id: templateId,
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

  deleteVariable: (templateId: string, variableId: string) =>
    apiClient.delete(`/ansible/job-templates/${templateId}/vars/${variableId}`),

  launch: (id: string, overrides?: { 
    extra_vars?: Record<string, unknown>; 
    limit?: string;
    tags?: string;
    skip_tags?: string;
  }) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(
      `/ansible/job-templates/${id}/launch`,
      overrides
    ),
};

// Job API
export const ansibleJobsApi = {
  listByProject: (projectId: string, params?: PageParams) =>
    apiClient.get<JsonApiListResponse<JsonApiResource>>(
      `/projects/${projectId}/ansible/jobs${pageQuery(params)}`
    ),

  listByOrganization: (organizationName: string, params?: PageParams) =>
    apiClient.get<JsonApiListResponse<JsonApiResource>>(
      `/organizations/${organizationName}/ansible/jobs${pageQuery(params)}`
    ),

  getQueue: (organizationName: string, params?: PageParams) =>
    apiClient.get<JsonApiListResponse<JsonApiResource>>(
      `/organizations/${organizationName}/ansible/jobs/queue${pageQuery(params)}`
    ),

  get: (id: string) =>
    apiClient.get<JsonApiResponse<JsonApiResource>>(
      `/ansible/jobs/${id}`
    ),

  launch: (organizationName: string, data: CreateJobInput & { project_id?: string }) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(
      `/organizations/${organizationName}/ansible/jobs`,
      {
        data: {
          type: 'ansible-jobs',
          attributes: {
            name: data.name || '',
            'job-type': 'run',
            'extra-vars': data.extra_vars || {},
            limit: data.limit || '',
            tags: data.tags || '',
            'skip-tags': data.skip_tags || '',
            verbosity: data.verbosity ?? 0,
            forks: data.forks ?? 5,
            'become-enabled': data.become ?? false,
          },
          relationships: {
            ...(data.project_id ? {
              project: {
                data: { id: data.project_id, type: 'projects' },
              },
            } : {}),
            playbook: {
              data: { id: data.playbook_id, type: 'ansible-playbooks' },
            },
            inventory: {
              data: { id: data.inventory_id, type: 'ansible-inventories' },
            },
            ...(data.credential_id ? {
              credential: {
                data: { id: data.credential_id, type: 'ansible-credentials' },
              },
            } : {}),
          },
        },
      }
    ),

  cancel: (id: string) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(
      `/ansible/jobs/${id}/actions/cancel`
    ),

  relaunch: (id: string) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(
      `/ansible/jobs/${id}/actions/relaunch`
    ),

  delete: (id: string) =>
    apiClient.delete(`/ansible/jobs/${id}`),

  getEvents: (id: string, opts?: { after?: number; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (opts?.after !== undefined) qs.set('after', String(opts.after));
    if (opts?.page !== undefined) qs.set('page[number]', String(opts.page));
    if (opts?.pageSize !== undefined) qs.set('page[size]', String(opts.pageSize));
    const q = qs.toString();
    return apiClient.get<JsonApiListResponse<JsonApiResource>>(
      `/ansible/jobs/${id}/events${q ? `?${q}` : ''}`
    );
  },

  getOutput: (id: string) =>
    apiClient.get<{ data: string }>(
      `/ansible/jobs/${id}/output`
    ).then(res => res.data),
};

// ============================================================================
// Inventory Source Types (Dynamic Inventories)
// ============================================================================

export type InventorySourceType = 'aws' | 'azure' | 'gcp' | 'vmware' | 'custom';
export type InventorySourceStatus = 'never_synced' | 'syncing' | 'successful' | 'failed';

export interface AnsibleInventorySource {
  id: string;
  inventory_id: string;
  name: string;
  description?: string;
  type: InventorySourceType;
  credential_id?: string;
  config: Record<string, unknown>;
  update_on_launch: boolean;
  update_cache_timeout: number;
  overwrite: boolean;
  overwrite_vars: boolean;
  verbosity: number;
  group_by_instance_id: boolean;
  group_by_region: boolean;
  group_by_availability_zone: boolean;
  group_by_tag?: string;
  hostname_var: string;
  instance_filters?: string;
  // Schedule settings
  sync_schedule?: string;
  // Sync status
  status: InventorySourceStatus;
  last_sync_at?: string;
  last_sync_error?: string;
  last_sync_log?: string;
  hosts_count: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateInventorySourceInput {
  name: string;
  description?: string;
  type: InventorySourceType;
  credential_id?: string;
  config?: Record<string, unknown>;
  update_on_launch?: boolean;
  update_cache_timeout?: number;
  overwrite?: boolean;
  overwrite_vars?: boolean;
  verbosity?: number;
  group_by_instance_id?: boolean;
  group_by_region?: boolean;
  group_by_availability_zone?: boolean;
  group_by_tag?: string;
  hostname_var?: string;
  instance_filters?: string;
  enabled?: boolean;
  // Schedule
  sync_schedule?: string;
}

// ============================================================================
// Schedule Types
// ============================================================================

export type ScheduleType = 'job_template' | 'inventory_source' | 'playbook_sync' | 'workflow';
export type ScheduleStatus = 'enabled' | 'disabled';

export interface AnsibleSchedule {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  type: ScheduleType;
  status: ScheduleStatus;
  job_template_id?: string;
  inventory_source_id?: string;
  playbook_id?: string;
  cron_expression: string;
  timezone: string;
  start_date_time?: string;
  end_date_time?: string;
  config?: Record<string, unknown>;
  next_run_at?: string;
  last_run_at?: string;
  last_job_id?: string;
  last_run_status?: string;
  run_count: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduleInput {
  name: string;
  description?: string;
  type: ScheduleType;
  job_template_id?: string;
  inventory_source_id?: string;
  playbook_id?: string;
  workflow_id?: string;
  cron_expression: string;
  timezone?: string;
  start_date_time?: string;
  end_date_time?: string;
  config?: Record<string, unknown>;
}

// Inventory Source API
export const ansibleInventorySourcesApi = {
  list: (inventoryId: string, params?: PageParams) =>
    apiClient.get<JsonApiListResponse<JsonApiResource>>(
      `/ansible/inventories/${inventoryId}/sources${pageQuery(params)}`
    ),

  get: (id: string) =>
    apiClient.get<JsonApiResponse<JsonApiResource>>(
      `/ansible/inventory-sources/${id}`
    ),

  create: (inventoryId: string, data: CreateInventorySourceInput) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(
      `/ansible/inventories/${inventoryId}/sources`,
      {
        data: {
          type: 'inventory-sources',
          attributes: {
            name: data.name,
            description: data.description || '',
            'source-type': data.type,
            'credential-id': data.credential_id || null,
            config: data.config || {},
            'update-on-launch': data.update_on_launch ?? true,
            'update-cache-timeout': data.update_cache_timeout ?? 0,
            overwrite: data.overwrite ?? false,
            'overwrite-vars': data.overwrite_vars ?? false,
            verbosity: data.verbosity ?? 0,
            'group-by-instance-id': data.group_by_instance_id ?? false,
            'group-by-region': data.group_by_region ?? true,
            'group-by-availability-zone': data.group_by_availability_zone ?? false,
            'group-by-tag': data.group_by_tag || '',
            'hostname-var': data.hostname_var || 'public_ip',
            'instance-filters': data.instance_filters || '',
            enabled: data.enabled ?? true,
          },
        },
      }
    ),

  update: (id: string, data: Partial<CreateInventorySourceInput>) =>
    apiClient.patch<JsonApiResponse<JsonApiResource>>(
      `/ansible/inventory-sources/${id}`,
      {
        data: {
          type: 'inventory-sources',
          attributes: {
            name: data.name,
            description: data.description,
            'source-type': data.type,
            'credential-id': data.credential_id !== undefined ? (data.credential_id || '') : undefined,
            config: data.config,
            'update-on-launch': data.update_on_launch,
            'update-cache-timeout': data.update_cache_timeout,
            overwrite: data.overwrite,
            'overwrite-vars': data.overwrite_vars,
            verbosity: data.verbosity,
            'group-by-instance-id': data.group_by_instance_id,
            'group-by-region': data.group_by_region,
            'group-by-availability-zone': data.group_by_availability_zone,
            'group-by-tag': data.group_by_tag,
            'hostname-var': data.hostname_var,
            'instance-filters': data.instance_filters,
            'sync-schedule': data.sync_schedule,
            enabled: data.enabled,
          },
        },
      }
    ),

  delete: (id: string) =>
    apiClient.delete(`/ansible/inventory-sources/${id}`),

  sync: (id: string) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(
      `/ansible/inventory-sources/${id}/actions/sync`
    ),
};

// ============================================================================
// Ad Hoc Commands (AWX-style Run Command)
// ============================================================================

export interface RunAdHocCommandInput {
  module: string;
  module_args?: string;
  limit?: string;
  project_id?: string;
  credential_id?: string;
  agent_pool_id?: string;
  verbosity?: number;
  forks?: number;
  become_enabled?: boolean;
  extra_vars?: Record<string, unknown>;
}

export const ansibleAdHocApi = {
  runCommand: (inventoryId: string, data: RunAdHocCommandInput) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(
      `/ansible/inventories/${inventoryId}/actions/run-command`,
      {
        data: {
          type: 'adhoc-commands',
          attributes: {
            module: data.module,
            'module-args': data.module_args || '',
            limit: data.limit || '',
            'project-id': data.project_id || '',
            'credential-id': data.credential_id || '',
            'agent-pool-id': data.agent_pool_id || '',
            verbosity: data.verbosity ?? 0,
            forks: data.forks ?? 5,
            'become-enabled': data.become_enabled ?? false,
            'extra-vars': data.extra_vars || {},
          },
        },
      }
    ),

  listModules: (organizationName: string) =>
    apiClient.get<{ data: { attributes: { modules: string[] } } }>(
      `/organizations/${organizationName}/ansible/adhoc-modules`
    ),
};

// ============================================================================
// Inventory Sync History (sync runs with captured output)
// ============================================================================

export type InventorySyncRunStatus = 'pending' | 'running' | 'successful' | 'failed';

export const ansibleInventorySyncsApi = {
  list: (inventoryId: string, limit = 50) =>
    apiClient.get<JsonApiListResponse<JsonApiResource>>(
      `/ansible/inventories/${inventoryId}/syncs?limit=${limit}`
    ),

  get: (id: string) =>
    apiClient.get<JsonApiResponse<JsonApiResource>>(
      `/ansible/inventory-syncs/${id}`
    ),
};

// Schedule API
export const ansibleSchedulesApi = {
  list: (organizationName: string, params?: PageParams) =>
    apiClient.get<JsonApiListResponse<JsonApiResource>>(
      `/organizations/${organizationName}/ansible/schedules${pageQuery(params)}`
    ),

  get: (id: string) =>
    apiClient.get<JsonApiResponse<JsonApiResource>>(
      `/ansible/schedules/${id}`
    ),

  create: (organizationName: string, data: CreateScheduleInput) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(
      `/organizations/${organizationName}/ansible/schedules`,
      {
        data: {
          type: 'schedules',
          attributes: {
            name: data.name,
            description: data.description || '',
            'schedule-type': data.type,
            'job-template-id': data.job_template_id || null,
            'inventory-source-id': data.inventory_source_id || null,
            'playbook-id': data.playbook_id || null,
            'workflow-id': data.workflow_id || null,
            'cron-expression': data.cron_expression,
            timezone: data.timezone || 'UTC',
            'start-date-time': data.start_date_time || null,
            'end-date-time': data.end_date_time || null,
            config: data.config || {},
          },
        },
      }
    ),

  update: (id: string, data: Partial<CreateScheduleInput>) =>
    apiClient.patch<JsonApiResponse<JsonApiResource>>(
      `/ansible/schedules/${id}`,
      {
        data: {
          type: 'schedules',
          attributes: {
            name: data.name,
            description: data.description,
            'cron-expression': data.cron_expression,
            timezone: data.timezone,
            'start-date-time': data.start_date_time,
            'end-date-time': data.end_date_time,
            config: data.config,
          },
        },
      }
    ),

  delete: (id: string) =>
    apiClient.delete(`/ansible/schedules/${id}`),

  enable: (id: string) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(
      `/ansible/schedules/${id}/actions/enable`
    ),

  disable: (id: string) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(
      `/ansible/schedules/${id}/actions/disable`
    ),

  runNow: (id: string) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(
      `/ansible/schedules/${id}/actions/run-now`
    ),
};

// ============================================================================
// Galaxy Collections API
// ============================================================================

export interface AnsibleCollection {
  id: string;
  name: string;
  namespace: string;
  version: string;
  description?: string;
  source: 'pre-installed' | 'requirements.yml' | 'manual';
}

export const ansibleCollectionsApi = {
  listPreInstalled: () =>
    apiClient.get<JsonApiListResponse<JsonApiResource>>(
      '/ansible/collections/pre-installed'
    ),

  search: (query: string) =>
    apiClient.get<JsonApiListResponse<JsonApiResource>>(
      `/ansible/collections/search?q=${encodeURIComponent(query)}`
    ),

  getJobCollections: (jobId: string) =>
    apiClient.get<JsonApiListResponse<JsonApiResource>>(
      `/ansible/jobs/${jobId}/collections`
    ),
};

// ============================================================================
// Workflow Templates API
// ============================================================================

export type WorkflowNodeType = 'job_template' | 'workflow' | 'inventory_sync' | 'approval';
export type WorkflowEdgeCondition = 'on_success' | 'on_failure' | 'always';

export interface AnsibleWorkflow {
  id: string;
  organization_id: string;
  project_id?: string;
  inventory_id?: string;
  name: string;
  description?: string;
  allow_simultaneous: boolean;
  ask_variables_on_launch: boolean;
  ask_inventory_on_launch: boolean;
  ask_limit_on_launch: boolean;
  extra_vars?: Record<string, unknown>;
  limit?: string;
  survey_enabled: boolean;
  survey_spec?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AnsibleWorkflowNode {
  id: string;
  workflow_id: string;
  job_template_id?: string;
  job_template_name?: string; // included for display
  inventory_id?: string;
  credential_id?: string;
  node_type: WorkflowNodeType;
  identifier: string;
  position_x: number;
  position_y: number;
  extra_vars?: Record<string, unknown>;
  limit?: string;
  tags?: string;
  skip_tags?: string;
  verbosity: number;
  all_parents_must_converge: boolean;
  approval_timeout?: number;
  approval_message?: string;
  created_at: string;
}

export interface AnsibleWorkflowEdge {
  id: string;
  workflow_id: string;
  source_node_id: string;
  target_node_id: string;
  condition: WorkflowEdgeCondition;
  created_at: string;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  project_id?: string;
  inventory_id?: string;
  allow_simultaneous?: boolean;
  ask_variables_on_launch?: boolean;
  ask_inventory_on_launch?: boolean;
  ask_limit_on_launch?: boolean;
  extra_vars?: string;
  limit?: string;
  survey_enabled?: boolean;
}

export interface CreateWorkflowNodeInput {
  job_template_id?: string;
  inventory_id?: string;
  credential_id?: string;
  node_type: WorkflowNodeType;
  identifier?: string;
  position_x: number;
  position_y: number;
  extra_vars?: string;
  limit?: string;
  tags?: string;
  skip_tags?: string;
  verbosity?: number;
  all_parents_must_converge?: boolean;
  approval_timeout?: number;
  approval_message?: string;
}

export interface CreateWorkflowEdgeInput {
  source_node_id: string;
  target_node_id: string;
  condition: WorkflowEdgeCondition;
}

export const ansibleNotificationsApi = {
  list: (orgName: string) =>
    apiClient.get<{ data: JsonApiResource[] }>(`/organizations/${orgName}/ansible/notification-templates`),

  create: (orgName: string, data: {
    name: string;
    description?: string;
    type: 'webhook' | 'email' | 'teams';
    config: Record<string, unknown>;
    secret?: string;
  }) =>
    apiClient.post<{ data: JsonApiResource }>(`/organizations/${orgName}/ansible/notification-templates`, data),

  delete: (id: string) =>
    apiClient.delete(`/ansible/notification-templates/${id}`),

  test: (id: string) =>
    apiClient.post(`/ansible/notification-templates/${id}/test`, {}),

  attach: (orgName: string, data: {
    notification_template_id: string;
    job_template_id?: string;
    workflow_id?: string;
    on_started?: boolean;
    on_success?: boolean;
    on_failure?: boolean;
  }) =>
    apiClient.post<{ data: JsonApiResource }>(`/organizations/${orgName}/ansible/notification-attachments`, data),

  detach: (orgName: string, attachmentId: string) =>
    apiClient.delete(`/organizations/${orgName}/ansible/notification-attachments/${attachmentId}`),

  listForJobTemplate: (jobTemplateId: string) =>
    apiClient.get<{ data: JsonApiResource[] }>(`/ansible/job-templates/${jobTemplateId}/notifications`),
};

export const ansibleWorkflowsApi = {
  // Execution
  launch: (id: string, extraVars?: Record<string, unknown>) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(
      `/ansible/workflows/${id}/launch`,
      extraVars ? { extra_vars: extraVars } : {}
    ),

  listJobs: (id: string) =>
    apiClient.get<{ data: JsonApiResource[]; meta?: { 'total-count'?: number } }>(
      `/ansible/workflows/${id}/jobs`
    ),

  getJob: (workflowJobId: string) =>
    apiClient.get<{ data: JsonApiResource; included?: JsonApiResource[] }>(
      `/ansible/workflow-jobs/${workflowJobId}`
    ),

  approveNode: (nodeJobId: string) =>
    apiClient.post(`/ansible/workflow-node-jobs/${nodeJobId}/approve`, {}),

  denyNode: (nodeJobId: string) =>
    apiClient.post(`/ansible/workflow-node-jobs/${nodeJobId}/deny`, {}),

  list: (orgName: string, params?: { page?: number; pageSize?: number }) => {
    const queryParams = new URLSearchParams();
    queryParams.append('page[number]', (params?.page || 1).toString());
    queryParams.append('page[size]', (params?.pageSize || 20).toString());
    return apiClient.get<JsonApiListResponse<JsonApiResource>>(
      `/organizations/${orgName}/ansible/workflows?${queryParams.toString()}`
    );
  },

  get: (id: string) =>
    apiClient.get<JsonApiResponse<JsonApiResource>>(
      `/ansible/workflows/${id}`
    ),

  create: (orgName: string, data: CreateWorkflowInput) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(
      `/organizations/${orgName}/ansible/workflows`,
      {
        data: {
          type: 'ansible-workflows',
          attributes: {
            name: data.name,
            description: data.description,
            'allow-simultaneous': data.allow_simultaneous || false,
            'ask-variables-on-launch': data.ask_variables_on_launch || false,
            'ask-inventory-on-launch': data.ask_inventory_on_launch || false,
            'ask-limit-on-launch': data.ask_limit_on_launch || false,
            'extra-vars': data.extra_vars || '',
            limit: data.limit || '',
            'survey-enabled': data.survey_enabled || false,
          },
          relationships: {
            project: data.project_id ? { data: { id: data.project_id } } : undefined,
            inventory: data.inventory_id ? { data: { id: data.inventory_id } } : undefined,
          },
        },
      }
    ),

  update: (id: string, data: Partial<CreateWorkflowInput>) =>
    apiClient.patch<JsonApiResponse<JsonApiResource>>(
      `/ansible/workflows/${id}`,
      {
        data: {
          type: 'ansible-workflows',
          attributes: {
            name: data.name,
            description: data.description,
            'allow-simultaneous': data.allow_simultaneous,
            'ask-variables-on-launch': data.ask_variables_on_launch,
            'ask-inventory-on-launch': data.ask_inventory_on_launch,
            'ask-limit-on-launch': data.ask_limit_on_launch,
            'extra-vars': data.extra_vars,
            limit: data.limit,
            'survey-enabled': data.survey_enabled,
          },
        },
      }
    ),

  delete: (id: string) =>
    apiClient.delete(`/ansible/workflows/${id}`),

  // Node operations
  listNodes: (workflowId: string) =>
    apiClient.get<JsonApiListResponse<JsonApiResource>>(
      `/ansible/workflows/${workflowId}/nodes`
    ),

  createNode: (workflowId: string, data: CreateWorkflowNodeInput) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(
      `/ansible/workflows/${workflowId}/nodes`,
      {
        data: {
          type: 'ansible-workflow-nodes',
          attributes: {
            'node-type': data.node_type,
            identifier: data.identifier || '',
            'position-x': data.position_x,
            'position-y': data.position_y,
            'extra-vars': data.extra_vars || '',
            limit: data.limit || '',
            tags: data.tags || '',
            'skip-tags': data.skip_tags || '',
            verbosity: data.verbosity || 0,
            'all-parents-must-converge': data.all_parents_must_converge || false,
            'approval-timeout': data.approval_timeout || 0,
            'approval-message': data.approval_message || '',
          },
          relationships: {
            'job-template': data.job_template_id ? { data: { id: data.job_template_id } } : undefined,
            inventory: data.inventory_id ? { data: { id: data.inventory_id } } : undefined,
            credential: data.credential_id ? { data: { id: data.credential_id } } : undefined,
          },
        },
      }
    ),

  updateNode: (nodeId: string, data: Partial<CreateWorkflowNodeInput>) =>
    apiClient.patch<JsonApiResponse<JsonApiResource>>(
      `/ansible/workflow-nodes/${nodeId}`,
      {
        data: {
          type: 'ansible-workflow-nodes',
          attributes: {
            'position-x': data.position_x,
            'position-y': data.position_y,
            'extra-vars': data.extra_vars,
            limit: data.limit,
            tags: data.tags,
            'skip-tags': data.skip_tags,
            verbosity: data.verbosity,
            'all-parents-must-converge': data.all_parents_must_converge,
          },
        },
      }
    ),

  deleteNode: (nodeId: string) =>
    apiClient.delete(`/ansible/workflow-nodes/${nodeId}`),

  // Edge operations
  listEdges: (workflowId: string) =>
    apiClient.get<JsonApiListResponse<JsonApiResource>>(
      `/ansible/workflows/${workflowId}/edges`
    ),

  createEdge: (workflowId: string, data: CreateWorkflowEdgeInput) =>
    apiClient.post<JsonApiResponse<JsonApiResource>>(
      `/ansible/workflows/${workflowId}/edges`,
      {
        data: {
          type: 'ansible-workflow-edges',
          attributes: {
            condition: data.condition,
          },
          relationships: {
            'source-node': { data: { id: data.source_node_id } },
            'target-node': { data: { id: data.target_node_id } },
          },
        },
      }
    ),

  deleteEdge: (edgeId: string) =>
    apiClient.delete(`/ansible/workflow-edges/${edgeId}`),
};

// Ansible Config API
export interface AnsibleConfig {
  id: string;
  organization_id?: string;
  project_id?: string;
  workspace_id?: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface AnsibleConfigResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      content: string;
      'organization-id'?: string;
      'project-id'?: string;
      'workspace-id'?: string;
      'created-at': string;
      'updated-at': string;
    };
  };
}

export const ansibleConfigApi = {
  // Organization-level
  getByOrganization: (orgName: string) =>
    apiClient.get<AnsibleConfigResponse>(`/organizations/${orgName}/ansible-config?format=simple`),

  upsertByOrganization: (orgName: string, content: string) =>
    apiClient.put<AnsibleConfigResponse>(`/organizations/${orgName}/ansible-config?format=simple`, {
      data: {
        type: 'ansible-configs',
        attributes: { content },
      },
    }),

  deleteByOrganization: (orgName: string) =>
    apiClient.delete(`/organizations/${orgName}/ansible-config`),

  // Project-level
  getByProject: (projectId: string) =>
    apiClient.get<AnsibleConfigResponse>(`/projects/${projectId}/ansible-config?format=simple`),

  upsertByProject: (projectId: string, content: string) =>
    apiClient.put<AnsibleConfigResponse>(`/projects/${projectId}/ansible-config?format=simple`, {
      data: {
        type: 'ansible-configs',
        attributes: { content },
      },
    }),

  deleteByProject: (projectId: string) =>
    apiClient.delete(`/projects/${projectId}/ansible-config`),

  // Get effective config (with priority: workspace > project > org)
  getEffective: (orgName: string, projectId?: string) =>
    apiClient.get<AnsibleConfigResponse>(
      `/organizations/${orgName}/ansible-config/effective?format=simple${projectId ? `&project_id=${projectId}` : ''}`
    ),
};

// Unified Ansible API export
export const ansibleApi = {
  inventories: ansibleInventoriesApi,
  hosts: ansibleHostsApi,
  groups: ansibleGroupsApi,
  credentials: ansibleCredentialsApi,
  playbooks: ansiblePlaybooksApi,
  jobTemplates: ansibleJobTemplatesApi,
  jobs: ansibleJobsApi,
  inventorySources: ansibleInventorySourcesApi,
  schedules: ansibleSchedulesApi,
  collections: ansibleCollectionsApi,
  workflows: ansibleWorkflowsApi,
  config: ansibleConfigApi,
};

export default ansibleApi;
