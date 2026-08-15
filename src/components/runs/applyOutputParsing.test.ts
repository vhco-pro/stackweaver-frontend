// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { ADDRESS_CHARS, extractResourceId, providerFromAddress } from './applyOutputParsing';

// Regression guards for two apply-output parsing bugs.
//
// #123: the provider icon was derived with `address.split('.')[0]`, which yields
// "module" for every module-nested resource and "data" for every data source, so
// ProviderIcon requested /icons/module.svg, 404'd, and fell back to a generic cloud
// glyph. The plan-phase viewer never had this bug because it passes the real
// provider_name from the plan JSON - hence "plan has icons, apply doesn't".
describe('providerFromAddress', () => {
  it('returns the resource type for a top-level resource', () => {
    expect(providerFromAddress('azurerm_resource_group.rg')).toBe('azurerm_resource_group');
  });

  it('looks past a module wrapper instead of returning "module"', () => {
    expect(
      providerFromAddress('module.proxmox_test.proxmox_virtual_environment_download_file.test_iso'),
    ).toBe('proxmox_virtual_environment_download_file');
  });

  it('looks past nested module wrappers', () => {
    expect(providerFromAddress('module.a.module.b.azurerm_subnet.main')).toBe('azurerm_subnet');
  });

  it('looks past the data-source qualifier instead of returning "data"', () => {
    expect(providerFromAddress('data.azurerm_subnet.main')).toBe('azurerm_subnet');
  });

  it('ignores index keys, including ones containing dots', () => {
    expect(providerFromAddress('module.net["eu.west"].azurerm_subnet.main[0]')).toBe('azurerm_subnet');
  });

  it('does not walk off the end of a malformed address', () => {
    expect(providerFromAddress('module.orphan')).toBe('module');
    expect(providerFromAddress('')).toBe('');
  });
});

// #121: `[id=...]` was an optional group at the end of each completion regex, sitting
// behind a lazy `.*?`. The lazy quantifier matched zero characters, the optional group
// then matched empty, and the capture was ALWAYS undefined - so no log-parsed resource
// ever displayed an ID. These cover the extraction and the widened address class that
// now also matches module-nested and indexed addresses.
function matchCompletion(line: string): string | undefined {
  const m = line.match(new RegExp(`^(${ADDRESS_CHARS}):\\s+(?:Creation|Modifications?) complete after`));
  return m ? m[1] : undefined;
}

describe('apply completion-line parsing', () => {
  it('extracts the resource ID from a creation line', () => {
    const line = 'azurerm_resource_group.rg: Creation complete after 3s [id=/subscriptions/abc/rg]';
    expect(matchCompletion(line)).toBe('azurerm_resource_group.rg');
    expect(extractResourceId(line)).toBe('/subscriptions/abc/rg');
  });

  it('extracts the resource ID from a modification line', () => {
    const line = 'azurerm_subnet.main: Modifications complete after 1s [id=/subs/x/subnets/main]';
    expect(matchCompletion(line)).toBe('azurerm_subnet.main');
    expect(extractResourceId(line)).toBe('/subs/x/subnets/main');
  });

  it('matches module-nested and indexed addresses', () => {
    const line = 'module.net["eu"].azurerm_subnet.main[0]: Creation complete after 2s [id=/subs/x/subnets/main]';
    expect(matchCompletion(line)).toBe('module.net["eu"].azurerm_subnet.main[0]');
    expect(extractResourceId(line)).toBe('/subs/x/subnets/main');
  });

  it('handles an ID containing colons and slashes', () => {
    const line = 'module.m.proxmox_virtual_environment_download_file.iso: Creation complete after 12s [id=local:iso/x.iso]';
    expect(extractResourceId(line)).toBe('local:iso/x.iso');
  });

  it('returns undefined when the line carries no ID', () => {
    const line = 'aws_s3_bucket.logs: Creation complete after 2s';
    expect(matchCompletion(line)).toBe('aws_s3_bucket.logs');
    expect(extractResourceId(line)).toBeUndefined();
  });

  it('does not match unrelated log lines', () => {
    expect(matchCompletion('Apply complete! Resources: 3 added, 0 changed, 0 destroyed.')).toBeUndefined();
    expect(matchCompletion('azurerm_resource_group.rg: Creating...')).toBeUndefined();
  });
});
