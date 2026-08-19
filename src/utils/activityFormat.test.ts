// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { formatActivityDescription, formatActivityNotification } from './activityFormat';

describe('formatActivityNotification', () => {
  it('formats create with a resource name', () => {
    expect(formatActivityNotification({
      action: 'create',
      resource_type: 'workspace',
      details: { resource_name: 'prod-vpc' },
    })).toEqual({ title: 'workspace Created', message: '"prod-vpc" was created', type: 'success' });
  });

  it('uses resource_type as the fallback name when resource_name is absent', () => {
    // resourceNameRaw = details.resource_name || attrs.resource_type, so resource_type
    // becomes the quoted name - the "New X created" branch only fires when BOTH are empty.
    expect(formatActivityNotification({ action: 'create', resource_type: 'workspace' }))
      .toEqual({ title: 'workspace Created', message: '"workspace" was created', type: 'success' });
  });

  it('uses the "New … created" branch only when resource_name AND resource_type are empty', () => {
    expect(formatActivityNotification({ action: 'create', resource_type: '' }))
      .toEqual({ title: ' Created', message: 'New  created', type: 'success' });
  });

  it('formats update', () => {
    expect(formatActivityNotification({
      action: 'update', resource_type: 'variable', details: { resource_name: 'TF_LOG' },
    })).toEqual({ title: 'variable Updated', message: '"TF_LOG" was updated', type: 'info' });
  });

  it('formats update, falling back to resource_type as the name', () => {
    expect(formatActivityNotification({ action: 'update', resource_type: 'variable' }))
      .toEqual({ title: 'variable Updated', message: '"variable" was updated', type: 'info' });
  });

  it('formats delete as a warning', () => {
    expect(formatActivityNotification({
      action: 'delete', resource_type: 'api_key', details: { resource_name: 'ci-key' },
    })).toEqual({ title: 'api_key Deleted', message: '"ci-key" was deleted', type: 'warning' });
  });

  it('formats a run that is started (info)', () => {
    expect(formatActivityNotification({
      action: 'run_apply', resource_type: 'run', details: { operation: 'apply', status: 'started' },
    })).toEqual({ title: 'Run Started', message: 'apply run started', type: 'info' });
  });

  it('formats a completed run as success', () => {
    expect(formatActivityNotification({
      action: 'run_plan', resource_type: 'run', details: { operation: 'plan', status: 'completed' },
    })).toEqual({ title: 'Run Started', message: 'plan run completed', type: 'success' });
  });

  it('falls back to the action when operation/status are missing on a run', () => {
    expect(formatActivityNotification({ action: 'run_destroy', resource_type: 'run' }))
      .toEqual({ title: 'Run Started', message: 'run_destroy run started', type: 'info' });
  });

  it('uses the default branch for an unknown action', () => {
    expect(formatActivityNotification({ action: 'archived', resource_type: 'project' }))
      .toEqual({ title: 'Activity', message: 'archived project', type: 'info' });
  });

  it('prefers details.resource_name over resource_type for the name', () => {
    expect(formatActivityNotification({
      action: 'delete', resource_type: 'workspace', details: { resource_name: 'my-ws' },
    }).message).toBe('"my-ws" was deleted');
  });

  it('coerces a non-string resource name via String() (matches original behaviour)', () => {
    expect(formatActivityNotification({
      action: 'create', resource_type: 'token', details: { resource_name: 42 },
    }).message).toBe('"42" was created');
  });

  it('treats an object resource name as no usable name (stringifies to [object Object], which is truthy → quoted)', () => {
    // Mirrors the original: object resourceNameRaw hits the String() else-branch.
    const out = formatActivityNotification({
      action: 'create', resource_type: 'token', details: { resource_name: { id: 1 } },
    });
    expect(out.message).toBe('"[object Object]" was created');
  });
});

describe('formatActivityDescription', () => {
  it('formats the CRUD actions with the resource name', () => {
    expect(formatActivityDescription({
      action: 'create', resource_type: 'workspace', details: { resource_name: 'prod-vpc' },
    })).toBe('Created workspace "prod-vpc"');
    expect(formatActivityDescription({
      action: 'update', resource_type: 'variable', details: { resource_name: 'TF_LOG' },
    })).toBe('Updated variable "TF_LOG"');
    expect(formatActivityDescription({
      action: 'delete', resource_type: 'project', details: { resource_name: 'platform' },
    })).toBe('Deleted project "platform"');
  });

  it('falls back to the resource type when no name is recorded', () => {
    // resource_name || resource_type, so the type becomes the quoted name; the unquoted form
    // only appears when both are empty.
    expect(formatActivityDescription({ action: 'create', resource_type: 'workspace' }))
      .toBe('Created workspace "workspace"');
    expect(formatActivityDescription({ action: 'create', resource_type: '' })).toBe('Created ');
  });

  it('formats run activity from the operation and status details', () => {
    expect(formatActivityDescription({
      action: 'run_apply', resource_type: 'run', details: { operation: 'apply', status: 'completed' },
    })).toBe('apply run completed');
    // Absent status reads as "started" rather than "undefined".
    expect(formatActivityDescription({ action: 'run_plan', resource_type: 'run' }))
      .toBe('run_plan run started');
  });

  it('names the workspace suffix only when the activity carries one', () => {
    expect(formatActivityDescription({
      action: 'run_destroy', resource_type: 'run', details: { operation: 'destroy', workspace_id: 'ws-1' },
    })).toBe('destroy run started for workspace');
  });

  it('falls back to "<action> <type>" for an unrecognised action', () => {
    expect(formatActivityDescription({ action: 'archived', resource_type: 'change-request' }))
      .toBe('archived change-request "change-request"');
  });

  it('JSON-encodes an object detail rather than printing [object Object]', () => {
    expect(formatActivityDescription({
      action: 'create', resource_type: 'token', details: { resource_name: { id: 1 } },
    })).toBe('Created token "{"id":1}"');
  });
});
