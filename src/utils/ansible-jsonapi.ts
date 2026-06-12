// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Ansible JSON:API Helper Functions
 * 
 * These transform JSON:API resources to flat objects for backward compatibility.
 * Separated from jsonapi.ts to avoid circular dependency with ansible.ts
 */

import type {
  AnsibleJob,
  AnsibleJobStatus,
  AnsiblePlaybook,
  AnsibleInventory,
  AnsibleCredential,
  AnsibleJobTemplate,
  AnsibleInventoryHost,
  AnsibleInventoryGroup,
  AnsibleJobEvent,
  AnsibleInventorySource,
  AnsibleSchedule,
  AnsibleWorkflow,
  InventoryType,
  CredentialType,
  InventorySourceType,
  InventorySourceStatus,
  ScheduleType,
  ScheduleStatus,
} from '@/api/ansible';

import type { JsonApiResource } from './jsonapi';
import { getAttribute, getRelationship } from './jsonapi';

/**
 * Transform JSON:API resource to flat AnsibleJob object
 */
export function getAnsibleJobFromJsonApi(resource: JsonApiResource): AnsibleJob {
  return {
    id: resource.id,
    project_id: getRelationship(resource, 'project')?.id || '',
    playbook_id: getRelationship(resource, 'playbook')?.id || '',
    inventory_id: getRelationship(resource, 'inventory')?.id || '',
    job_template_id: getRelationship(resource, 'template')?.id,
    credential_id: getRelationship(resource, 'credential')?.id,
    name: getAttribute<string>(resource, 'name', '') || '',
    status: (getAttribute<string>(resource, 'status', 'pending') || 'pending') as AnsibleJobStatus,
    extra_vars: getAttribute<Record<string, unknown>>(resource, 'extra-vars'),
    limit: getAttribute<string>(resource, 'limit'),
    tags: getAttribute<string>(resource, 'tags'),
    skip_tags: getAttribute<string>(resource, 'skip-tags'),
    verbosity: getAttribute<number>(resource, 'verbosity', 0) || 0,
    forks: getAttribute<number>(resource, 'forks', 5) || 5,
    become: getAttribute<boolean>(resource, 'become-enabled', false) || false,
    become_user: getAttribute<string>(resource, 'become-user'),
    hosts_ok: getAttribute<number>(resource, 'hosts-ok', 0) || 0,
    hosts_changed: getAttribute<number>(resource, 'hosts-changed', 0) || 0,
    hosts_failed: getAttribute<number>(resource, 'hosts-failed', 0) || 0,
    hosts_skipped: getAttribute<number>(resource, 'hosts-skipped', 0) || 0,
    hosts_unreachable: getAttribute<number>(resource, 'hosts-unreachable', 0) || 0,
    hosts_rescued: getAttribute<number>(resource, 'hosts-rescued'),
    hosts_ignored: getAttribute<number>(resource, 'hosts-ignored'),
    has_warnings: getAttribute<boolean>(resource, 'has-warnings'),
    warnings_count: getAttribute<number>(resource, 'warnings-count'),
    started_at: getAttribute<string>(resource, 'started-at'),
    finished_at: getAttribute<string>(resource, 'finished-at'),
    output: getAttribute<string>(resource, 'output'),
    error_message: getAttribute<string>(resource, 'error-message'),
    created_by: getRelationship(resource, 'created-by')?.id,
    created_at: getAttribute<string>(resource, 'created-at', '') || '',
    updated_at: getAttribute<string>(resource, 'updated-at', '') || '',
    agent_pool_id: getRelationship(resource, 'agent-pool')?.id,
    agent_pool_name: getAttribute<string>(resource, 'agent-pool-name'),
    runner_id: getRelationship(resource, 'runner')?.id,
    runner_name: getAttribute<string>(resource, 'runner-name'),
  };
}

/**
 * Transform JSON:API resource to flat AnsiblePlaybook object
 */
export function getAnsiblePlaybookFromJsonApi(resource: JsonApiResource): AnsiblePlaybook {
  return {
    id: resource.id,
    project_id: getRelationship(resource, 'project')?.id || '',
    name: getAttribute<string>(resource, 'name', '') || '',
    description: getAttribute<string>(resource, 'description'),
    vcs_connection_id: getRelationship(resource, 'vcs-connection')?.id,
    vcs_repository: getAttribute<string>(resource, 'vcs-repository'),
    vcs_branch: getAttribute<string>(resource, 'vcs-branch'),
    vcs_provider: getAttribute<string>(resource, 'vcs-provider'),
    vcs_account_name: getAttribute<string>(resource, 'vcs-account-name'),
    playbook_path: getAttribute<string>(resource, 'playbook-path', '') || '',
    source_mode: getAttribute<string>(resource, 'source-mode'),
    last_synced_at: getAttribute<string>(resource, 'last-sync-at'),
    last_sync_status: getAttribute<string>(resource, 'last-sync-status'),
    last_sync_commit: getAttribute<string>(resource, 'last-sync-commit'),
    last_sync_error: getAttribute<string>(resource, 'last-sync-error'),
    cached_commit: getAttribute<string>(resource, 'cached-commit'),
    cached_at: getAttribute<string>(resource, 'cached-at'),
    cached_size_bytes: getAttribute<number>(resource, 'cached-size-bytes'),
    created_at: getAttribute<string>(resource, 'created-at', '') || '',
    updated_at: getAttribute<string>(resource, 'updated-at', '') || '',
  };
}

/**
 * Transform JSON:API resource to flat AnsibleInventory object
 */
export function getAnsibleInventoryFromJsonApi(resource: JsonApiResource): AnsibleInventory {
  const typeAttr = getAttribute<string>(resource, 'inventory-type') || getAttribute<string>(resource, 'type') || 'static';
  // Map "scm" to "vcs" for backward compatibility
  const type = typeAttr === 'scm' ? 'vcs' : typeAttr;
  return {
    id: resource.id,
    organization_id: getRelationship(resource, 'organization')?.id || '',
    project_id: getRelationship(resource, 'project')?.id,
    name: getAttribute<string>(resource, 'name', '') || '',
    description: getAttribute<string>(resource, 'description'),
    type: type as InventoryType,
    variables: getAttribute<Record<string, unknown>>(resource, 'variables'),
    vcs_connection_id: getAttribute<string>(resource, 'vcs_connection_id'),
    vcs_repository: getAttribute<string>(resource, 'vcs_repository'),
    vcs_branch: getAttribute<string>(resource, 'vcs_branch'),
    inventory_path: getAttribute<string>(resource, 'inventory_path'),
    last_sync_at: getAttribute<string>(resource, 'last-sync-at'),
    last_sync_status: getAttribute<string>(resource, 'last-sync-status'),
    last_sync_error: getAttribute<string>(resource, 'last-sync-error'),
    last_sync_hosts_discovered: getAttribute<number>(resource, 'last-sync-hosts-discovered'),
    last_sync_log: getAttribute<string>(resource, 'last-sync-log'),
    source_vars: getAttribute<string>(resource, 'source-vars'),
    constructed_limit: getAttribute<string>(resource, 'constructed-limit'),
    constructed_cache_timeout: getAttribute<number>(resource, 'constructed-cache-timeout', 0) || 0,
    input_inventories: getAttribute<{ id: string; name: string }[]>(resource, 'input-inventories'),
    created_at: getAttribute<string>(resource, 'created-at', '') || '',
    updated_at: getAttribute<string>(resource, 'updated-at', '') || '',
  };
}

/**
 * Transform JSON:API resource to flat AnsibleCredential object
 */
export function getAnsibleCredentialFromJsonApi(resource: JsonApiResource): AnsibleCredential {
  return {
    id: resource.id,
    organization_id: getRelationship(resource, 'organization')?.id || '',
    project_id: getRelationship(resource, 'project')?.id,
    name: getAttribute<string>(resource, 'name', '') || '',
    description: getAttribute<string>(resource, 'description'),
    type: (getAttribute<string>(resource, 'credential-type') || getAttribute<string>(resource, 'type')) as CredentialType,
    username: getAttribute<string>(resource, 'username'),
    created_at: getAttribute<string>(resource, 'created-at', '') || '',
    updated_at: getAttribute<string>(resource, 'updated-at', '') || '',
  };
}

/**
 * Transform JSON:API resource to flat AnsibleJobTemplate object
 */
export function getAnsibleJobTemplateFromJsonApi(resource: JsonApiResource): AnsibleJobTemplate {
  return {
    id: resource.id,
    project_id: getRelationship(resource, 'project')?.id || '',
    playbook_id: getRelationship(resource, 'playbook')?.id || '',
    inventory_id: getRelationship(resource, 'inventory')?.id || '',
    credential_id: getRelationship(resource, 'credential')?.id,
    agent_pool_id: getRelationship(resource, 'agent-pool')?.id,
    name: getAttribute<string>(resource, 'name', '') || '',
    description: getAttribute<string>(resource, 'description'),
    extra_vars: getAttribute<Record<string, unknown>>(resource, 'extra-vars'),
    limit: getAttribute<string>(resource, 'limit'),
    tags: getAttribute<string>(resource, 'tags'),
    skip_tags: getAttribute<string>(resource, 'skip-tags'),
    verbosity: getAttribute<number>(resource, 'verbosity', 0) || 0,
    forks: getAttribute<number>(resource, 'forks', 5) || 5,
    become: getAttribute<boolean>(resource, 'become-enabled', false) || false,
    become_user: getAttribute<string>(resource, 'become-user'),
    enabled: getAttribute<boolean>(resource, 'enabled', true) ?? true,
    timeout_seconds: getAttribute<number>(resource, 'timeout-seconds', 0) || 0,
    allow_simultaneous: getAttribute<boolean>(resource, 'allow-simultaneous', false) || false,
    retention_days: getAttribute<number | null>(resource, 'retention-days', null),
    job_slice_count: getAttribute<number>(resource, 'job-slice-count', 1) || 1,
    allow_callbacks: getAttribute<boolean>(resource, 'allow-callbacks', false) || false,
    launch_on_webhook: getAttribute<boolean>(resource, 'launch-on-webhook', false) || false,
    host_config_key: getAttribute<string>(resource, 'host-config-key'),
    created_at: getAttribute<string>(resource, 'created-at', '') || '',
    updated_at: getAttribute<string>(resource, 'updated-at', '') || '',
  };
}

/**
 * Transform JSON:API resource to flat AnsibleInventoryHost object
 */
export function getAnsibleHostFromJsonApi(resource: JsonApiResource): AnsibleInventoryHost {
  return {
    id: resource.id,
    inventory_id: getRelationship(resource, 'inventory')?.id || '',
    name: getAttribute<string>(resource, 'name', '') || '',
    description: getAttribute<string>(resource, 'description'),
    hostname: getAttribute<string>(resource, 'hostname'),
    port: getAttribute<number>(resource, 'port'),
    variables: getAttribute<Record<string, unknown>>(resource, 'variables'),
    enabled: getAttribute<boolean>(resource, 'enabled') ?? true,
    created_at: getAttribute<string>(resource, 'created-at', '') || '',
    updated_at: getAttribute<string>(resource, 'updated-at', '') || '',
  };
}

/**
 * Transform JSON:API resource to flat AnsibleInventoryGroup object
 */
export function getAnsibleGroupFromJsonApi(resource: JsonApiResource): AnsibleInventoryGroup {
  return {
    id: resource.id,
    inventory_id: getRelationship(resource, 'inventory')?.id || '',
    parent_id: getRelationship(resource, 'parent')?.id,
    name: getAttribute<string>(resource, 'name', '') || '',
    description: getAttribute<string>(resource, 'description'),
    variables: getAttribute<Record<string, unknown>>(resource, 'variables'),
    created_at: getAttribute<string>(resource, 'created-at', '') || '',
    updated_at: getAttribute<string>(resource, 'updated-at', '') || '',
  };
}

/**
 * Transform JSON:API resource to flat AnsibleJobEvent object
 */
export function getAnsibleJobEventFromJsonApi(resource: JsonApiResource): AnsibleJobEvent {
  return {
    id: resource.id,
    job_id: getRelationship(resource, 'job')?.id || '',
    event_type: getAttribute<string>(resource, 'event-type', '') || '',
    event_data: getAttribute<Record<string, unknown>>(resource, 'event-data'),
    host: getAttribute<string>(resource, 'host'),
    task: getAttribute<string>(resource, 'task'),
    play: getAttribute<string>(resource, 'play'),
    counter: getAttribute<number>(resource, 'counter', 0) || 0,
    stdout: getAttribute<string>(resource, 'stdout'),
    stderr: getAttribute<string>(resource, 'stderr'),
    changed: getAttribute<boolean>(resource, 'changed'),
    failed: getAttribute<boolean>(resource, 'failed'),
    skipped: getAttribute<boolean>(resource, 'skipped'),
    created_at: getAttribute<string>(resource, 'created-at', '') || '',
  };
}

/**
 * Transform JSON:API resource to flat AnsibleInventorySource object
 */
export function getAnsibleInventorySourceFromJsonApi(resource: JsonApiResource): AnsibleInventorySource {
  return {
    id: resource.id,
    inventory_id: getRelationship(resource, 'inventory')?.id || '',
    name: getAttribute<string>(resource, 'name', '') || '',
    description: getAttribute<string>(resource, 'description'),
    type: (getAttribute<string>(resource, 'source-type') || getAttribute<string>(resource, 'type') || 'aws') as InventorySourceType,
    credential_id: getRelationship(resource, 'credential')?.id,
    config: getAttribute<Record<string, unknown>>(resource, 'config') || {},
    update_on_launch: getAttribute<boolean>(resource, 'update-on-launch', true) ?? true,
    update_cache_timeout: getAttribute<number>(resource, 'update-cache-timeout', 0) || 0,
    overwrite: getAttribute<boolean>(resource, 'overwrite', false) ?? false,
    overwrite_vars: getAttribute<boolean>(resource, 'overwrite-vars', false) ?? false,
    verbosity: getAttribute<number>(resource, 'verbosity', 0) || 0,
    group_by_instance_id: getAttribute<boolean>(resource, 'group-by-instance-id', false) ?? false,
    group_by_region: getAttribute<boolean>(resource, 'group-by-region', true) ?? true,
    group_by_availability_zone: getAttribute<boolean>(resource, 'group-by-availability-zone', false) ?? false,
    group_by_tag: getAttribute<string>(resource, 'group-by-tag'),
    hostname_var: getAttribute<string>(resource, 'hostname-var', 'public_ip') || 'public_ip',
    instance_filters: getAttribute<string>(resource, 'instance-filters'),
    // Schedule
    sync_schedule: getAttribute<string>(resource, 'sync-schedule'),
    // Sync status
    status: (getAttribute<string>(resource, 'status') || 'never_synced') as InventorySourceStatus,
    last_sync_at: getAttribute<string>(resource, 'last-sync-at'),
    last_sync_error: getAttribute<string>(resource, 'last-sync-error'),
    last_sync_log: getAttribute<string>(resource, 'last-sync-log'),
    hosts_count: getAttribute<number>(resource, 'hosts-count', 0) || 0,
    enabled: getAttribute<boolean>(resource, 'enabled', true) ?? true,
    created_at: getAttribute<string>(resource, 'created-at', '') || '',
    updated_at: getAttribute<string>(resource, 'updated-at', '') || '',
  };
}

/**
 * Transform JSON:API resource to flat AnsibleSchedule object
 */
export function getAnsibleScheduleFromJsonApi(resource: JsonApiResource): AnsibleSchedule {
  return {
    id: resource.id,
    organization_id: getRelationship(resource, 'organization')?.id || '',
    name: getAttribute<string>(resource, 'name', '') || '',
    description: getAttribute<string>(resource, 'description'),
    type: (getAttribute<string>(resource, 'schedule-type') || getAttribute<string>(resource, 'type') || 'job_template') as ScheduleType,
    status: (getAttribute<string>(resource, 'status') || 'enabled') as ScheduleStatus,
    job_template_id: getRelationship(resource, 'job-template')?.id,
    inventory_source_id: getRelationship(resource, 'inventory-source')?.id,
    playbook_id: getRelationship(resource, 'playbook')?.id,
    cron_expression: getAttribute<string>(resource, 'cron-expression', '') || '',
    timezone: getAttribute<string>(resource, 'timezone', 'UTC') || 'UTC',
    start_date_time: getAttribute<string>(resource, 'start-date-time'),
    end_date_time: getAttribute<string>(resource, 'end-date-time'),
    config: getAttribute<Record<string, unknown>>(resource, 'config'),
    next_run_at: getAttribute<string>(resource, 'next-run-at'),
    last_run_at: getAttribute<string>(resource, 'last-run-at'),
    last_job_id: getRelationship(resource, 'last-job')?.id,
    last_run_status: getAttribute<string>(resource, 'last-run-status'),
    run_count: getAttribute<number>(resource, 'run-count', 0) || 0,
    created_by: getRelationship(resource, 'created-by')?.id,
    created_at: getAttribute<string>(resource, 'created-at', '') || '',
    updated_at: getAttribute<string>(resource, 'updated-at', '') || '',
  };
}

/**
 * Transform JSON:API resource to flat AnsibleWorkflow object
 */
export function getAnsibleWorkflowFromJsonApi(resource: JsonApiResource): AnsibleWorkflow {
  return {
    id: resource.id,
    organization_id: getRelationship(resource, 'organization')?.id || '',
    project_id: getRelationship(resource, 'project')?.id,
    inventory_id: getRelationship(resource, 'inventory')?.id,
    name: getAttribute<string>(resource, 'name', '') || '',
    description: getAttribute<string>(resource, 'description'),
    allow_simultaneous: getAttribute<boolean>(resource, 'allow-simultaneous', false) || false,
    ask_variables_on_launch: getAttribute<boolean>(resource, 'ask-variables-on-launch', false) || false,
    ask_inventory_on_launch: getAttribute<boolean>(resource, 'ask-inventory-on-launch', false) || false,
    ask_limit_on_launch: getAttribute<boolean>(resource, 'ask-limit-on-launch', false) || false,
    extra_vars: getAttribute<Record<string, unknown>>(resource, 'extra-vars'),
    limit: getAttribute<string>(resource, 'limit'),
    survey_enabled: getAttribute<boolean>(resource, 'survey-enabled', false) || false,
    survey_spec: getAttribute<Record<string, unknown>>(resource, 'survey-spec'),
    created_at: getAttribute<string>(resource, 'created-at', '') || '',
    updated_at: getAttribute<string>(resource, 'updated-at', '') || '',
  };
}
