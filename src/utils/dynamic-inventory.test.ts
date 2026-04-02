// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { detectDynamicInventoryPlugin, getCloudProviderIcon } from './dynamic-inventory';

describe('detectDynamicInventoryPlugin', () => {
  // Content-based detection (highest priority)
  describe('content-based detection', () => {
    it('detects Azure plugin by fully qualified name', () => {
      const content = 'plugin: azure.azcollection.azure_rm\nauth_source: auto';
      const result = detectDynamicInventoryPlugin(undefined, content);
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('azure');
      expect(result!.pluginName).toBe('azure.azcollection.azure_rm');
    });

    it('detects Azure plugin by short name', () => {
      const content = "plugin: 'azure_rm'\nauth_source: auto";
      const result = detectDynamicInventoryPlugin(undefined, content);
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('azure');
    });

    it('detects AWS plugin by fully qualified name', () => {
      const content = 'plugin: amazon.aws.aws_ec2\nregions:\n  - us-east-1';
      const result = detectDynamicInventoryPlugin(undefined, content);
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('aws');
      expect(result!.pluginName).toBe('amazon.aws.aws_ec2');
    });

    it('detects AWS plugin by short name', () => {
      const content = 'plugin: aws_ec2';
      const result = detectDynamicInventoryPlugin(undefined, content);
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('aws');
    });

    it('detects GCP plugin by fully qualified name', () => {
      const content = 'plugin: google.cloud.gcp_compute\nprojects:\n  - my-project';
      const result = detectDynamicInventoryPlugin(undefined, content);
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('gcp');
      expect(result!.pluginName).toBe('google.cloud.gcp_compute');
    });

    it('detects GCP plugin by short name', () => {
      const content = 'plugin: gcp_compute';
      const result = detectDynamicInventoryPlugin(undefined, content);
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('gcp');
    });

    it('handles quoted plugin values', () => {
      const content = "plugin: 'amazon.aws.aws_ec2'";
      const result = detectDynamicInventoryPlugin(undefined, content);
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('aws');
    });
  });

  // Path-based detection (fallback)
  describe('path-based detection', () => {
    it('detects Azure from path', () => {
      const result = detectDynamicInventoryPlugin('inventory/azure_rm.yml');
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('azure');
    });

    it('detects AWS from path', () => {
      const result = detectDynamicInventoryPlugin('inventory/aws_ec2.yml');
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('aws');
    });

    it('detects GCP from path', () => {
      const result = detectDynamicInventoryPlugin('inventory/gcp_compute.yml');
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('gcp');
    });

    it('is case insensitive on path', () => {
      const result = detectDynamicInventoryPlugin('inventory/AZURE_RM.yml');
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('azure');
    });
  });

  // Content takes priority over path
  it('content detection takes priority over path', () => {
    // Path says Azure, content says AWS
    const content = 'plugin: amazon.aws.aws_ec2';
    const result = detectDynamicInventoryPlugin('inventory/azure_rm.yml', content);
    expect(result!.provider).toBe('aws');
  });

  // No match
  it('returns null for non-dynamic inventory path', () => {
    expect(detectDynamicInventoryPlugin('inventory/hosts.yml')).toBeNull();
  });

  it('returns null for non-dynamic inventory content', () => {
    const content = 'all:\n  hosts:\n    web1:\n      ansible_host: 10.0.0.1';
    expect(detectDynamicInventoryPlugin(undefined, content)).toBeNull();
  });

  it('returns null when both args are undefined', () => {
    expect(detectDynamicInventoryPlugin()).toBeNull();
  });

  it('returns null when content is null', () => {
    expect(detectDynamicInventoryPlugin(undefined, null)).toBeNull();
  });

  // Plugin metadata
  it('returns complete plugin metadata', () => {
    const result = detectDynamicInventoryPlugin('inventory/azure_rm.yml');
    expect(result).not.toBeNull();
    expect(result!.label).toBe('Azure Dynamic Inventory');
    expect(result!.iconPath).toBeTruthy();
    expect(result!.colorClass).toBeTruthy();
    expect(result!.bgClass).toBeTruthy();
    expect(result!.textClass).toBeTruthy();
  });
});

describe('getCloudProviderIcon', () => {
  it('returns Azure icon path', () => {
    expect(getCloudProviderIcon('azure')).toContain('azurerm');
  });

  it('returns AWS icon path', () => {
    expect(getCloudProviderIcon('aws')).toContain('aws');
  });

  it('returns GCP icon path', () => {
    expect(getCloudProviderIcon('gcp')).toContain('google');
  });

  it('returns fallback icon for unknown provider', () => {
    // vmware has no explicit case, falls to default
    expect(getCloudProviderIcon('vmware')).toContain('external');
  });
});
