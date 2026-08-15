// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Parsing helpers for terraform apply output.
 *
 * Kept out of ApplyOutputViewer.tsx so they can be unit-tested and reused without
 * breaking fast refresh (a component file may only export components), matching the
 * existing applyResourceStatus.ts split.
 */

/**
 * Character class for a Terraform resource address inside apply output.
 *
 * Covers module nesting and index keys - `module.net["a"].azurerm_subnet.main[0]` -
 * which a bare `[\w._-]+` cannot match because of the brackets and quotes.
 */
export const ADDRESS_CHARS = '[\\w.\\-\\[\\]"\']+';

/**
 * Pull the resource ID out of an apply log line.
 *
 * Terraform appends `[id=...]` to completion lines. This used to be an optional group
 * on the end of each completion regex, sitting behind a lazy `.*?` - the lazy
 * quantifier matched zero characters, the optional group then matched empty, and the
 * capture was always undefined, so no log-parsed resource ever displayed an ID.
 * Extracting it separately keeps each completion regex simple and makes the ID
 * reachable.
 */
export function extractResourceId(line: string): string | undefined {
  const match = line.match(/\[id=([^\]]+)\]/);
  return match ? match[1] : undefined;
}

/**
 * Derive the provider prefix from a Terraform resource address.
 *
 * `address.split('.')[0]` is wrong for anything module-nested or for data sources:
 * `module.net.azurerm_subnet.main` yields "module" and `data.azurerm_subnet.main`
 * yields "data", neither of which resolves to a provider icon. Strip index brackets,
 * then walk past any `module.<name>` pairs and a leading `data` qualifier to reach the
 * resource-type segment, which is what ProviderIcon matches on.
 */
export function providerFromAddress(address: string): string {
  const segments = address.replace(/\[[^\]]*\]/g, '').split('.');
  let i = 0;
  while (segments[i] === 'module' && i + 2 < segments.length) {
    i += 2;
  }
  if (segments[i] === 'data') {
    i += 1;
  }
  return segments[i] ?? '';
}
