// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Dynamic inventory plugin detection utilities.
 *
 * Detects whether a VCS-backed inventory file is a dynamic inventory plugin
 * (e.g., azure_rm, aws_ec2, gcp_compute) based on the file path and/or content.
 */

export type CloudProvider = 'azure' | 'aws' | 'gcp' | 'vmware';

export interface DynamicInventoryPlugin {
  /** Cloud provider this plugin targets */
  provider: CloudProvider;
  /** Ansible collection plugin name (e.g., "azure.azcollection.azure_rm") */
  pluginName: string;
  /** Human-readable label */
  label: string;
  /** Path to the provider's SVG icon in /public/icons/ */
  iconPath: string;
  /** CSS color class for the provider badge */
  colorClass: string;
  /** Background color class for the header icon */
  bgClass: string;
  /** Lighter background for the info banner */
  bgClassLight: string;
  /** Border color class for the info banner */
  borderClass: string;
  /** Text color for badges and accents */
  textClass: string;
  /** Dark mode text color for badges and accents */
  darkTextClass: string;
}

/** Known dynamic inventory plugins keyed by file path patterns and plugin names */
const PLUGIN_DEFINITIONS: {
  pathPatterns: RegExp[];
  contentPatterns: RegExp[];
  plugin: DynamicInventoryPlugin;
}[] = [
  {
    pathPatterns: [/azure_rm/i],
    // Match fully qualified name, short name, or any azure_rm variant
    contentPatterns: [
      /plugin:\s*['"]?azure\.azcollection\.azure_rm['"]?/i,
      /plugin:\s*['"]?azure_rm['"]?/i,
    ],
    plugin: {
      provider: 'azure',
      pluginName: 'azure.azcollection.azure_rm',
      label: 'Azure Dynamic Inventory',
      iconPath: '/icons/azurerm.svg?v=2',
      colorClass: 'text-blue-600',
      bgClass: 'bg-blue-500/10',
      bgClassLight: 'bg-blue-500/5',
      borderClass: 'border-blue-500/20',
      textClass: 'text-blue-600',
      darkTextClass: 'dark:text-blue-400',
    },
  },
  {
    pathPatterns: [/aws_ec2/i],
    contentPatterns: [
      /plugin:\s*['"]?amazon\.aws\.aws_ec2['"]?/i,
      /plugin:\s*['"]?aws_ec2['"]?/i,
    ],
    plugin: {
      provider: 'aws',
      pluginName: 'amazon.aws.aws_ec2',
      label: 'AWS Dynamic Inventory',
      iconPath: '/icons/aws.svg',
      colorClass: 'text-orange-500',
      bgClass: 'bg-orange-500/10',
      bgClassLight: 'bg-orange-500/5',
      borderClass: 'border-orange-500/20',
      textClass: 'text-orange-600',
      darkTextClass: 'dark:text-orange-400',
    },
  },
  {
    pathPatterns: [/gcp_compute/i],
    contentPatterns: [
      /plugin:\s*['"]?google\.cloud\.gcp_compute['"]?/i,
      /plugin:\s*['"]?gcp_compute['"]?/i,
    ],
    plugin: {
      provider: 'gcp',
      pluginName: 'google.cloud.gcp_compute',
      label: 'GCP Dynamic Inventory',
      iconPath: '/icons/google.svg',
      colorClass: 'text-red-500',
      bgClass: 'bg-red-500/10',
      bgClassLight: 'bg-red-500/5',
      borderClass: 'border-red-500/20',
      textClass: 'text-red-600',
      darkTextClass: 'dark:text-red-400',
    },
  },
];

/**
 * Detect if an inventory file is a dynamic inventory plugin based on its content
 * and/or path.
 *
 * Detection priority:
 * 1. Content-based: Parses the `plugin:` YAML key for known plugin identifiers.
 *    This is the most reliable method - works regardless of filename.
 * 2. Path-based: Falls back to filename pattern matching (e.g., "azure_rm" in path)
 *    when content is not yet loaded.
 *
 * @param inventoryPath - The file path within the VCS repo (e.g., "inventory/azure_rm.yml")
 * @param fileContent - Optional file content (when available from the Content tab)
 * @returns The detected plugin info, or null if not a dynamic inventory
 */
export function detectDynamicInventoryPlugin(
  inventoryPath?: string,
  fileContent?: string | null,
): DynamicInventoryPlugin | null {
  // First priority: content-based detection (most reliable - uses the `plugin:` field)
  if (fileContent) {
    for (const def of PLUGIN_DEFINITIONS) {
      for (const pattern of def.contentPatterns) {
        if (pattern.test(fileContent)) {
          return def.plugin;
        }
      }
    }
  }

  // Second priority: path-based detection (fast fallback before content is loaded)
  if (inventoryPath) {
    for (const def of PLUGIN_DEFINITIONS) {
      for (const pattern of def.pathPatterns) {
        if (pattern.test(inventoryPath)) {
          return def.plugin;
        }
      }
    }
  }

  return null;
}

/**
 * Get the cloud provider icon path for a given provider type.
 */
export function getCloudProviderIcon(provider: CloudProvider): string {
  switch (provider) {
    case 'azure': return '/icons/azurerm.svg?v=2';
    case 'aws': return '/icons/aws.svg';
    case 'gcp': return '/icons/google.svg';
    default: return '/icons/external.svg';
  }
}
