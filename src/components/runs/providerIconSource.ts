// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Where a provider's icon comes from. The engine is OpenTofu, so engine-level rows (outputs, the
 * built-in `terraform` provider) carry its mark and nothing shows a Terraform logo; `tfe` resources
 * manage Stackweaver itself. A provider without real artwork gets the neutral icon rather than a
 * logo that is not its own.
 */
export type ProviderIconSource =
  | { kind: 'brand'; id: ProviderBrandId }
  | { kind: 'stackweaver' }
  | { kind: 'file'; src: string }
  | { kind: 'generic' };

// Provider types drawn from the brand registry (src/lib/brands.ts), which has artwork for both themes.
const BRAND_PROVIDERS = ['github', 'docker', 'aws', 'helm', 'vault', 'okta'] as const;
export type ProviderBrandId = 'opentofu' | (typeof BRAND_PROVIDERS)[number];
const isBrandProvider = (key: string): key is (typeof BRAND_PROVIDERS)[number] =>
  (BRAND_PROVIDERS as readonly string[]).includes(key);

// Other provider types with artwork in public/icons.
const ICON_FILES = new Set([
  '1password', 'ansible', 'azuread', 'azurerm', 'boundary', 'cloudflare', 'consul', 'datadog',
  'elastic', 'gitlab', 'google', 'grafana', 'kubernetes', 'mongodb', 'netapp', 'netlify',
  'nomad', 'nutanix', 'ovh', 'pagerduty', 'proxmox', 'splunk', 'talos',
]);

// Provider types that share another one's artwork.
const ALIASES: Record<string, string> = {
  'google-beta': 'google',
  awscc: 'aws',
  azurestack: 'azurerm',
};

/**
 * The provider type behind a provider name or resource type: the last segment of a source address
 * (`registry.opentofu.org/hashicorp/oci`), of a configuration key (`module.net:aws`) or of a
 * `provider["..."]` reference, and the prefix of a resource type (`aws_instance`). Provider types
 * never contain an underscore, so the first underscore ends one.
 */
function providerType(providerName?: string, resourceType?: string): string {
  const raw = (providerName || resourceType || '').trim().toLowerCase();
  const ref = raw.replace(/^provider\[\s*"?/, '').replace(/"?\s*\]$/, '');
  const last = ref.slice(ref.lastIndexOf(':') + 1);
  const segment = last.slice(last.lastIndexOf('/') + 1);
  return segment.split('_')[0] ?? '';
}

export function providerIconSource(providerName?: string, resourceType?: string): ProviderIconSource {
  const type = providerType(providerName, resourceType);
  const key = ALIASES[type] ?? type;
  if (key === 'terraform' || key === 'opentofu') return { kind: 'brand', id: 'opentofu' };
  if (key === 'tfe') return { kind: 'stackweaver' };
  if (isBrandProvider(key)) return { kind: 'brand', id: key };
  if (ICON_FILES.has(key)) return { kind: 'file', src: `/icons/${key}.svg` };
  return { kind: 'generic' };
}
