// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * JSON:API Utility Functions
 * 
 * These utilities help work with JSON:API format responses from the backend.
 * The backend returns data in JSON:API format with { data, type, attributes, relationships } structure.
 */

import type { Run } from '@/api/client';

export interface JsonApiResource {
  id: string;
  type: string;
   
  attributes: Record<string, any>; // Intentional: JSON:API spec allows any attribute types
  relationships?: Record<string, JsonApiRelationship>;
  links?: Record<string, string>;
}

export interface JsonApiRelationship {
  data: JsonApiResourceIdentifier | JsonApiResourceIdentifier[];
  links?: Record<string, string>;
}

export interface JsonApiResourceIdentifier {
  id: string;
  type: string;
}

export interface JsonApiResponse<T extends JsonApiResource | JsonApiResource[] = JsonApiResource> {
  data: T;
  meta?: {
    pagination?: {
      page: number;
      per_page: number;
      total: number;
      'current-page'?: number;
      'page-size'?: number;
      'total-count'?: number;
      'total-pages'?: number;
    };
  };
  included?: JsonApiResource[];
  links?: Record<string, string>;
}

// Alias for list responses
export type JsonApiListResponse<T extends JsonApiResource = JsonApiResource> = JsonApiResponse<T[]>;

/**
 * Extract attributes from a JSON:API resource
 */
 
export function getAttributes(resource: JsonApiResource): Record<string, any> {
  return resource.attributes || {};
}

/**
 * Get a specific attribute from a JSON:API resource
 */
 
export function getAttribute<T = any>(resource: JsonApiResource, name: string, defaultValue?: T): T | undefined {
  return (resource.attributes?.[name] as T) ?? defaultValue;
}

/**
 * Helper functions for common JSON:API patterns
 * These extract attributes using kebab-case keys (as used by the backend)
 */

/**
 * Get run status from JSON:API resource
 * Returns the status as-is from the backend (American spelling: "canceled")
 */
export function getRunStatus(resource: JsonApiResource): string {
  return getAttribute<string>(resource, 'status', 'pending') || 'pending';
}

/**
 * Get run operation from JSON:API resource
 */
export function getRunOperation(resource: JsonApiResource): 'plan' | 'apply' | 'destroy' {
  const isDestroy = getAttribute<boolean>(resource, 'is-destroy', false);
  if (isDestroy) return 'destroy';
  return (getAttribute<string>(resource, 'operation', 'plan') as 'plan' | 'apply') || 'plan';
}

/**
 * Get run workspace_id from JSON:API relationship
 */
export function getRunWorkspaceId(resource: JsonApiResource): string {
  const workspaceRel = getRelationship(resource, 'workspace');
  return workspaceRel?.id || '';
}

/**
 * Get run configuration_version_id from JSON:API relationship
 */
export function getRunConfigurationVersionId(resource: JsonApiResource): string | undefined {
  const configVersionRel = getRelationship(resource, 'configuration-version');
  return configVersionRel?.id;
}

/**
 * Create a flat Run object from JSON:API resource (for backward compatibility during migration)
 * This matches the existing Run interface structure
 */
export function getRunFromJsonApi(resource: JsonApiResource): Run {
  const run: Run = {
    id: resource.id,
    workspace_id: getRunWorkspaceId(resource),
    created_by: getAttribute<string>(resource, 'created-by'),
    status: getRunStatus(resource) as Run['status'],
    operation: getRunOperation(resource),
    plan_output: getAttribute<Record<string, unknown>>(resource, 'plan-output'),
    error_message: getAttribute<string>(resource, 'error-message'),
    started_at: getAttribute<string>(resource, 'started-at') ?? undefined,
    completed_at: getAttribute<string>(resource, 'completed-at') ?? undefined,
    created_at: getAttribute<string>(resource, 'created-at', '') ?? '',
    updated_at: getAttribute<string>(resource, 'updated-at', '') ?? '',
    plan_only: getAttribute<boolean>(resource, 'plan-only', false),
    source: getAttribute<string>(resource, 'source'),
    configuration_version_id: getRunConfigurationVersionId(resource),
    'configuration-version-source': getAttribute<string>(resource, 'configuration-version-source'),
    'commit-hash': getAttribute<string>(resource, 'commit-hash'),
    committer: getAttribute<string>(resource, 'committer'),
    'pr-number': getAttribute<number>(resource, 'pr-number'),
    'source-branch': getAttribute<string>(resource, 'source-branch'),
    permissions: getAttribute<Record<string, boolean>>(resource, 'permissions'),
    'status-timestamps': getAttribute<Record<string, string>>(resource, 'status-timestamps'),
  };
  
  // Add has-changes separately using bracket notation to avoid TypeScript error
  const hasChanges = getAttribute<boolean>(resource, 'has-changes', undefined);
  if (hasChanges !== undefined) {
    (run as unknown as Record<string, unknown>)['has-changes'] = hasChanges;
  }

  // Self-hosted runner info
  const agentPoolId = getAttribute<string>(resource, 'agent-pool-id');
  const agentPoolName = getAttribute<string>(resource, 'agent-pool-name');
  const runnerId = getAttribute<string>(resource, 'runner-id');
  const runnerName = getAttribute<string>(resource, 'runner-name');
  if (agentPoolId) run.agent_pool_id = agentPoolId;
  if (agentPoolName) run.agent_pool_name = agentPoolName;
  if (runnerId) run.runner_id = runnerId;
  if (runnerName) run.runner_name = runnerName;
  
  return run;
}

/**
 * Extract relationship from a JSON:API resource
 * Returns the resource identifier or null if not found
 */
export function getRelationship(
  resource: JsonApiResource,
  name: string
): JsonApiResourceIdentifier | null {
  const relationship = resource.relationships?.[name];
  if (!relationship) return null;
  
  if (Array.isArray(relationship.data)) {
    // For to-many relationships, return first one (or null if empty)
    return relationship.data.length > 0 ? relationship.data[0] : null;
  }
  
  return relationship.data || null;
}

/**
 * Extract relationship array from a JSON:API resource
 * Returns an array of resource identifiers
 */
export function getRelationships(
  resource: JsonApiResource,
  name: string
): JsonApiResourceIdentifier[] {
  const relationship = resource.relationships?.[name];
  if (!relationship) return [];
  
  if (Array.isArray(relationship.data)) {
    return relationship.data;
  }
  
  return relationship.data ? [relationship.data] : [];
}

/**
 * Find an included resource by type and id
 */
export function findIncluded(
  included: JsonApiResource[] | undefined,
  type: string,
  id: string
): JsonApiResource | null {
  if (!included) return null;
  
  return included.find(resource => resource.type === type && resource.id === id) || null;
}

/**
 * Resolve a relationship by finding the included resource
 * Returns the full resource if found in included, otherwise returns just the identifier
 */
export function resolveRelationship(
  resource: JsonApiResource,
  relationshipName: string,
  included?: JsonApiResource[]
): JsonApiResource | JsonApiResourceIdentifier | null {
  const relationship = getRelationship(resource, relationshipName);
  if (!relationship) return null;
  
  // Try to find in included resources
  if (included) {
    const resolved = findIncluded(included, relationship.type, relationship.id);
    if (resolved) return resolved;
  }
  
  return relationship;
}

/**
 * Resolve multiple relationships
 */
export function resolveRelationships(
  resource: JsonApiResource,
  relationshipName: string,
  included?: JsonApiResource[]
): (JsonApiResource | JsonApiResourceIdentifier)[] {
  const relationships = getRelationships(resource, relationshipName);
  
  return relationships.map(rel => {
    if (included) {
      const resolved = findIncluded(included, rel.type, rel.id);
      if (resolved) return resolved;
    }
    return rel;
  });
}

/**
 * Transform a JSON:API resource to a flat object structure
 * This is useful when you need to work with the data in a simpler format
 */
 
export function flattenResource(resource: JsonApiResource): any {
   
  const flattened: any = {
    id: resource.id,
    ...resource.attributes,
  };
  
  // Optionally flatten relationships as _id fields
  if (resource.relationships) {
    Object.keys(resource.relationships).forEach(relName => {
      const rel = resource.relationships![relName];
      if (Array.isArray(rel.data)) {
        flattened[`${relName}_ids`] = rel.data.map(r => r.id);
      } else if (rel.data) {
        flattened[`${relName}_id`] = rel.data.id;
      }
    });
  }
  
  return flattened;
}

/**
 * Transform a JSON:API response array to flat objects
 */
 
export function flattenResources(resources: JsonApiResource[]): any[] {
  return resources.map(flattenResource);
}

/**
 * Check if a response is a JSON:API format response
 */
 
export function isJsonApiResponse(response: any): response is JsonApiResponse<JsonApiResource | JsonApiResource[]> {
  return (
    response &&
    typeof response === 'object' &&
    'data' in response &&
    (Array.isArray(response.data) || 
     (response.data && typeof response.data === 'object' && 'type' in response.data))
  );
}

/**
 * Normalize a JSON:API response to ensure consistent structure
 */
export function normalizeJsonApiResponse<T extends JsonApiResource | JsonApiResource[]>(
   
  response: any
): JsonApiResponse<T> {
  if (!isJsonApiResponse(response)) {
    throw new Error('Response is not in JSON:API format');
  }
  
  return {
    data: response.data as T,
    meta: response.meta,
    included: response.included,
    links: response.links,
  };
}
