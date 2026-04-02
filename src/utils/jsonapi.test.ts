// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import {
  getAttributes,
  getAttribute,
  getRelationship,
  getRelationships,
  findIncluded,
  resolveRelationship,
  resolveRelationships,
  flattenResource,
  flattenResources,
  isJsonApiResponse,
  normalizeJsonApiResponse,
  type JsonApiResource,
} from './jsonapi';

// Helper to build a minimal resource
function makeResource(overrides: Partial<JsonApiResource> = {}): JsonApiResource {
  return {
    id: 'res-1',
    type: 'workspaces',
    attributes: { name: 'my-workspace', 'auto-apply': true },
    ...overrides,
  };
}

describe('getAttributes', () => {
  it('returns attributes object', () => {
    const res = makeResource();
    expect(getAttributes(res)).toEqual({ name: 'my-workspace', 'auto-apply': true });
  });

  it('returns empty object when attributes undefined (|| fallback)', () => {
    const res = makeResource({ attributes: undefined as never });
    expect(getAttributes(res)).toEqual({});
  });
});

describe('getAttribute', () => {
  it('returns existing attribute', () => {
    const res = makeResource();
    expect(getAttribute<string>(res, 'name')).toBe('my-workspace');
  });

  it('returns default when attribute missing', () => {
    const res = makeResource();
    expect(getAttribute<string>(res, 'missing', 'default')).toBe('default');
  });

  it('returns undefined when attribute missing and no default', () => {
    const res = makeResource();
    expect(getAttribute(res, 'missing')).toBeUndefined();
  });
});

describe('getRelationship', () => {
  it('returns single relationship data', () => {
    const res = makeResource({
      relationships: {
        organization: { data: { id: 'org-1', type: 'organizations' } },
      },
    });
    expect(getRelationship(res, 'organization')).toEqual({ id: 'org-1', type: 'organizations' });
  });

  it('returns first item for to-many relationship', () => {
    const res = makeResource({
      relationships: {
        tags: { data: [{ id: 'tag-1', type: 'tags' }, { id: 'tag-2', type: 'tags' }] },
      },
    });
    expect(getRelationship(res, 'tags')).toEqual({ id: 'tag-1', type: 'tags' });
  });

  it('returns null for empty to-many relationship', () => {
    const res = makeResource({
      relationships: {
        tags: { data: [] },
      },
    });
    expect(getRelationship(res, 'tags')).toBeNull();
  });

  it('returns null for missing relationship', () => {
    const res = makeResource();
    expect(getRelationship(res, 'nonexistent')).toBeNull();
  });
});

describe('getRelationships', () => {
  it('returns array for to-many relationship', () => {
    const res = makeResource({
      relationships: {
        tags: { data: [{ id: 'tag-1', type: 'tags' }, { id: 'tag-2', type: 'tags' }] },
      },
    });
    expect(getRelationships(res, 'tags')).toEqual([
      { id: 'tag-1', type: 'tags' },
      { id: 'tag-2', type: 'tags' },
    ]);
  });

  it('wraps single relationship in array', () => {
    const res = makeResource({
      relationships: {
        org: { data: { id: 'org-1', type: 'organizations' } },
      },
    });
    expect(getRelationships(res, 'org')).toEqual([{ id: 'org-1', type: 'organizations' }]);
  });

  it('returns empty array for missing relationship', () => {
    const res = makeResource();
    expect(getRelationships(res, 'missing')).toEqual([]);
  });
});

describe('findIncluded', () => {
  const included: JsonApiResource[] = [
    { id: 'org-1', type: 'organizations', attributes: { name: 'Acme' } },
    { id: 'ws-2', type: 'workspaces', attributes: { name: 'prod' } },
  ];

  it('finds matching resource', () => {
    const result = findIncluded(included, 'organizations', 'org-1');
    expect(result).toBeTruthy();
    expect(result!.attributes.name).toBe('Acme');
  });

  it('returns null when not found', () => {
    expect(findIncluded(included, 'organizations', 'org-999')).toBeNull();
  });

  it('returns null for undefined included', () => {
    expect(findIncluded(undefined, 'organizations', 'org-1')).toBeNull();
  });
});

describe('resolveRelationship', () => {
  const included: JsonApiResource[] = [
    { id: 'org-1', type: 'organizations', attributes: { name: 'Acme' } },
  ];

  it('resolves relationship from included', () => {
    const res = makeResource({
      relationships: {
        organization: { data: { id: 'org-1', type: 'organizations' } },
      },
    });
    const resolved = resolveRelationship(res, 'organization', included);
    expect(resolved).toBeTruthy();
    expect((resolved as JsonApiResource).attributes.name).toBe('Acme');
  });

  it('falls back to identifier when not in included', () => {
    const res = makeResource({
      relationships: {
        organization: { data: { id: 'org-999', type: 'organizations' } },
      },
    });
    const resolved = resolveRelationship(res, 'organization', included);
    expect(resolved).toEqual({ id: 'org-999', type: 'organizations' });
  });

  it('returns null for missing relationship', () => {
    const res = makeResource();
    expect(resolveRelationship(res, 'missing', included)).toBeNull();
  });
});

describe('resolveRelationships', () => {
  const included: JsonApiResource[] = [
    { id: 'tag-1', type: 'tags', attributes: { label: 'prod' } },
  ];

  it('resolves found items, keeps identifiers for missing', () => {
    const res = makeResource({
      relationships: {
        tags: { data: [{ id: 'tag-1', type: 'tags' }, { id: 'tag-2', type: 'tags' }] },
      },
    });
    const resolved = resolveRelationships(res, 'tags', included);
    expect(resolved).toHaveLength(2);
    expect((resolved[0] as JsonApiResource).attributes.label).toBe('prod');
    expect(resolved[1]).toEqual({ id: 'tag-2', type: 'tags' });
  });
});

describe('flattenResource', () => {
  it('flattens attributes and id', () => {
    const res = makeResource();
    const flat = flattenResource(res);
    expect(flat.id).toBe('res-1');
    expect(flat.name).toBe('my-workspace');
    expect(flat['auto-apply']).toBe(true);
  });

  it('flattens to-one relationships as _id', () => {
    const res = makeResource({
      relationships: {
        organization: { data: { id: 'org-1', type: 'organizations' } },
      },
    });
    const flat = flattenResource(res);
    expect(flat.organization_id).toBe('org-1');
  });

  it('flattens to-many relationships as _ids', () => {
    const res = makeResource({
      relationships: {
        tags: { data: [{ id: 'tag-1', type: 'tags' }, { id: 'tag-2', type: 'tags' }] },
      },
    });
    const flat = flattenResource(res);
    expect(flat.tags_ids).toEqual(['tag-1', 'tag-2']);
  });
});

describe('flattenResources', () => {
  it('flattens array of resources', () => {
    const resources: JsonApiResource[] = [
      makeResource({ id: 'ws-1', attributes: { name: 'one' } }),
      makeResource({ id: 'ws-2', attributes: { name: 'two' } }),
    ];
    const flat = flattenResources(resources);
    expect(flat).toHaveLength(2);
    expect(flat[0].name).toBe('one');
    expect(flat[1].name).toBe('two');
  });
});

describe('isJsonApiResponse', () => {
  it('returns true for valid single-resource response', () => {
    expect(isJsonApiResponse({ data: { id: '1', type: 'x', attributes: {} } })).toBe(true);
  });

  it('returns true for valid list response', () => {
    expect(isJsonApiResponse({ data: [{ id: '1', type: 'x', attributes: {} }] })).toBe(true);
  });

  it('returns falsy for null', () => {
    expect(isJsonApiResponse(null)).toBeFalsy();
  });

  it('returns false for non-object', () => {
    expect(isJsonApiResponse('string')).toBe(false);
  });

  it('returns false for object without data', () => {
    expect(isJsonApiResponse({ meta: {} })).toBe(false);
  });
});

describe('normalizeJsonApiResponse', () => {
  it('normalizes valid response', () => {
    const raw = {
      data: { id: '1', type: 'workspaces', attributes: { name: 'test' } },
      meta: { pagination: { page: 1, per_page: 20, total: 1 } },
      included: [{ id: '2', type: 'orgs', attributes: {} }],
    };
    const normalized = normalizeJsonApiResponse(raw);
    expect(normalized.data).toEqual(raw.data);
    expect(normalized.meta).toEqual(raw.meta);
    expect(normalized.included).toEqual(raw.included);
  });

  it('throws for non-JSON:API response', () => {
    expect(() => normalizeJsonApiResponse({ foo: 'bar' })).toThrow('not in JSON:API format');
  });
});
