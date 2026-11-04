// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The run placement resources of an organization: run images, the identity bindings of its pools,
// and the effective settings of a launching object, each the client of its /api/v2 route.

import { apiClient } from './client';
import type { JsonApiResource } from '@/utils/jsonapi';

/** The engine a run image serves. */
export type RunImageKind = 'tofu' | 'ansible';

/** A run image: an image the organization's jobs of one engine may run in. */
export interface RunImage {
  id: string;
  name: string;
  kind: RunImageKind;
  image: string;
  digest: string;
  registry_credential_id: string | null;
  description: string;
  created_at: string;
  updated_at: string;
}

/** The writable attributes of a run image. A null registry credential pulls without one. */
export interface RunImageInput {
  name?: string;
  kind?: RunImageKind;
  image?: string;
  digest?: string;
  registry_credential_id?: string | null;
  description?: string;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function optionalId(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null;
}

export function runImageFromJsonApi(item: JsonApiResource): RunImage {
  const a = item.attributes ?? {};
  return {
    id: item.id,
    name: str(a['name']),
    kind: a['kind'] === 'ansible' ? 'ansible' : 'tofu',
    image: str(a['image']),
    digest: str(a['digest']),
    registry_credential_id: optionalId(a['registry-credential-id']),
    description: str(a['description']),
    created_at: str(a['created-at']),
    updated_at: str(a['updated-at']),
  };
}

function runImageAttributes(input: RunImageInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.name !== undefined) out['name'] = input.name;
  if (input.kind !== undefined) out['kind'] = input.kind;
  if (input.image !== undefined) out['image'] = input.image;
  if (input.digest !== undefined) out['digest'] = input.digest;
  // The API reads an empty string as "pull without a credential".
  if (input.registry_credential_id !== undefined) out['registry-credential-id'] = input.registry_credential_id ?? '';
  if (input.description !== undefined) out['description'] = input.description;
  return out;
}

export const runImagesApi = {
  list: (organizationName: string): Promise<RunImage[]> =>
    apiClient
      .get<{ data: JsonApiResource[] }>(`/organizations/${encodeURIComponent(organizationName)}/run-images?page%5Bsize%5D=100`)
      .then(res => (res.data ?? []).map(runImageFromJsonApi)),
  create: (organizationName: string, input: RunImageInput): Promise<RunImage> =>
    apiClient
      .post<{ data: JsonApiResource }>(`/organizations/${encodeURIComponent(organizationName)}/run-images`, {
        data: { type: 'run-images', attributes: runImageAttributes(input) },
      })
      .then(res => runImageFromJsonApi(res.data)),
  update: (id: string, input: RunImageInput): Promise<RunImage> =>
    apiClient
      .patch<{ data: JsonApiResource }>(`/run-images/${encodeURIComponent(id)}`, {
        data: { type: 'run-images', id, attributes: runImageAttributes(input) },
      })
      .then(res => runImageFromJsonApi(res.data)),
  delete: (id: string) => apiClient.delete(`/run-images/${encodeURIComponent(id)}`),
};

/** How a binding gives a job its cloud identity. */
export type IdentityMechanism = 'aws-irsa' | 'aws-pod-identity' | 'gcp-workload-identity' | 'azure-workload-identity';

/** An identity binding: a cloud identity one pool offers its jobs. */
export interface IdentityBinding {
  id: string;
  agent_pool_id: string;
  name: string;
  mechanism: string;
  service_account: string;
  annotations: Record<string, string>;
  per_job_sa: boolean;
  reference: boolean;
  declared_externally: boolean;
  external_manager: string;
  object_present: boolean | null;
  reported_at: string | null;
  created_at: string;
}

/** The writable attributes of an identity binding. */
export interface IdentityBindingInput {
  name?: string;
  mechanism?: string;
  service_account?: string;
  annotations?: Record<string, string>;
  per_job_sa?: boolean;
  reference?: boolean;
}

export function identityBindingFromJsonApi(item: JsonApiResource): IdentityBinding {
  const a = item.attributes ?? {};
  const pool: unknown = item.relationships?.['agent-pool']?.data;
  const annotations: Record<string, string> = {};
  const raw: unknown = a['annotations'];
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'string') annotations[k] = v;
    }
  }
  return {
    id: item.id,
    agent_pool_id: pool && typeof pool === 'object' && 'id' in pool && typeof pool.id === 'string' ? pool.id : '',
    name: str(a['name']),
    mechanism: str(a['mechanism']),
    service_account: str(a['service-account']),
    annotations,
    per_job_sa: a['per-job-sa'] === true,
    reference: a['reference'] === true,
    declared_externally: a['declared-externally'] === true,
    external_manager: str(a['external-manager']),
    object_present: typeof a['object-present'] === 'boolean' ? a['object-present'] : null,
    reported_at: typeof a['reported-at'] === 'string' ? a['reported-at'] : null,
    created_at: str(a['created-at']),
  };
}

function identityBindingAttributes(input: IdentityBindingInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.name !== undefined) out['name'] = input.name;
  if (input.mechanism !== undefined) out['mechanism'] = input.mechanism;
  if (input.service_account !== undefined) out['service-account'] = input.service_account;
  if (input.annotations !== undefined) out['annotations'] = input.annotations;
  if (input.per_job_sa !== undefined) out['per-job-sa'] = input.per_job_sa;
  if (input.reference !== undefined) out['reference'] = input.reference;
  return out;
}

export const identityBindingsApi = {
  list: (poolId: string): Promise<IdentityBinding[]> =>
    apiClient
      .get<{ data: JsonApiResource[] }>(`/agent-pools/${encodeURIComponent(poolId)}/identity-bindings`)
      .then(res => (res.data ?? []).map(identityBindingFromJsonApi)),
  create: (poolId: string, input: IdentityBindingInput): Promise<IdentityBinding> =>
    apiClient
      .post<{ data: JsonApiResource }>(`/agent-pools/${encodeURIComponent(poolId)}/identity-bindings`, {
        data: { type: 'identity-bindings', attributes: identityBindingAttributes(input) },
      })
      .then(res => identityBindingFromJsonApi(res.data)),
  update: (id: string, input: IdentityBindingInput): Promise<IdentityBinding> =>
    apiClient
      .patch<{ data: JsonApiResource }>(`/identity-bindings/${encodeURIComponent(id)}`, {
        data: { type: 'identity-bindings', id, attributes: identityBindingAttributes(input) },
      })
      .then(res => identityBindingFromJsonApi(res.data)),
  delete: (id: string) => apiClient.delete(`/identity-bindings/${encodeURIComponent(id)}`),
};

/** A registry pull Secret one pool's job pods pull images of one registry with (#933, D8). */
export interface PullSecret {
  id: string;
  agent_pool_id: string;
  name: string;
  secret_name: string;
  registry: string;
  registry_credential_id: string | null;
  reference: boolean;
  declared_externally: boolean;
  external_manager: string;
  object_present: boolean | null;
  reported_at: string | null;
  created_at: string;
}

/** The writable attributes of a pull Secret. */
export interface PullSecretInput {
  name?: string;
  secret_name?: string;
  registry?: string;
  registry_credential_id?: string | null;
  reference?: boolean;
}

export function pullSecretFromJsonApi(item: JsonApiResource): PullSecret {
  const a = item.attributes ?? {};
  const pool: unknown = item.relationships?.['agent-pool']?.data;
  return {
    id: item.id,
    agent_pool_id: pool && typeof pool === 'object' && 'id' in pool && typeof pool.id === 'string' ? pool.id : '',
    name: str(a['name']),
    secret_name: str(a['secret-name']),
    registry: str(a['registry']),
    registry_credential_id: typeof a['registry-credential-id'] === 'string' ? a['registry-credential-id'] : null,
    reference: a['reference'] === true,
    declared_externally: a['declared-externally'] === true,
    external_manager: str(a['external-manager']),
    object_present: typeof a['object-present'] === 'boolean' ? a['object-present'] : null,
    reported_at: typeof a['reported-at'] === 'string' ? a['reported-at'] : null,
    created_at: str(a['created-at']),
  };
}

function pullSecretAttributes(input: PullSecretInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.name !== undefined) out['name'] = input.name;
  if (input.secret_name !== undefined) out['secret-name'] = input.secret_name;
  if (input.registry !== undefined) out['registry'] = input.registry;
  if (input.registry_credential_id !== undefined) out['registry-credential-id'] = input.registry_credential_id ?? '';
  if (input.reference !== undefined) out['reference'] = input.reference;
  return out;
}

export const pullSecretsApi = {
  list: (poolId: string): Promise<PullSecret[]> =>
    apiClient
      .get<{ data: JsonApiResource[] }>(`/agent-pools/${encodeURIComponent(poolId)}/pull-secrets`)
      .then(res => (res.data ?? []).map(pullSecretFromJsonApi)),
  create: (poolId: string, input: PullSecretInput): Promise<PullSecret> =>
    apiClient
      .post<{ data: JsonApiResource }>(`/agent-pools/${encodeURIComponent(poolId)}/pull-secrets`, {
        data: { type: 'pull-secrets', attributes: pullSecretAttributes(input) },
      })
      .then(res => pullSecretFromJsonApi(res.data)),
  update: (id: string, input: PullSecretInput): Promise<PullSecret> =>
    apiClient
      .patch<{ data: JsonApiResource }>(`/pull-secrets/${encodeURIComponent(id)}`, {
        data: { type: 'pull-secrets', id, attributes: pullSecretAttributes(input) },
      })
      .then(res => pullSecretFromJsonApi(res.data)),
  delete: (id: string) => apiClient.delete(`/pull-secrets/${encodeURIComponent(id)}`),
};

/** A level of the level rule a setting resolved at. */
export type SettingLevel = 'workspace' | 'job-template' | 'inventory-source' | 'project' | 'organization' | 'deployment';

/** One resolved setting and the level it came from; level is null when nothing sets it. */
export interface EffectiveSetting<T> {
  value: T;
  level: SettingLevel | null;
}

/** The resolved multi-level settings of a workspace, job template or inventory source. */
export interface EffectiveSettings {
  execution_mode?: EffectiveSetting<string>;
  agent_pool_id?: EffectiveSetting<string | null>;
  tofu_version?: EffectiveSetting<string>;
  run_timeout?: EffectiveSetting<number>;
  run_image_id?: EffectiveSetting<string | null>;
  identity_binding_id?: EffectiveSetting<string | null>;
}

const LEVELS: readonly SettingLevel[] = ['workspace', 'job-template', 'inventory-source', 'project', 'organization', 'deployment'];

function setting<T>(raw: unknown, read: (v: unknown) => T): EffectiveSetting<T> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as { value?: unknown; level?: unknown };
  const level = LEVELS.find(l => l === r.level) ?? null;
  return { value: read(r.value), level };
}

export function effectiveSettingsFromJsonApi(item: JsonApiResource): EffectiveSettings {
  const a = item.attributes ?? {};
  return {
    execution_mode: setting(a['execution-mode'], str),
    agent_pool_id: setting(a['agent-pool-id'], optionalId),
    tofu_version: setting(a['tofu-version'], str),
    run_timeout: setting(a['run-timeout'], v => (typeof v === 'number' ? v : 0)),
    run_image_id: setting(a['run-image-id'], optionalId),
    identity_binding_id: setting(a['identity-binding-id'], optionalId),
  };
}

/** The launching objects that have effective settings. */
export type LaunchingObject = 'workspace' | 'job-template' | 'inventory-source';

const EFFECTIVE_PATHS: Record<LaunchingObject, (id: string) => string> = {
  workspace: id => `/workspaces/${encodeURIComponent(id)}/effective-settings`,
  'job-template': id => `/ansible/job-templates/${encodeURIComponent(id)}/effective-settings`,
  'inventory-source': id => `/ansible/inventory-sources/${encodeURIComponent(id)}/effective-settings`,
};

export const effectiveSettingsApi = {
  get: (object: LaunchingObject, id: string): Promise<EffectiveSettings> =>
    apiClient.get<{ data: JsonApiResource }>(EFFECTIVE_PATHS[object](id)).then(res => effectiveSettingsFromJsonApi(res.data)),
};
