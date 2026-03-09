// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

const BASE = '/icons/file-types';

const EXT_TO_ICON: Record<string, string> = {
  tf: 'terraform',
  tfvars: 'terraform',
  go: 'go',
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  yaml: 'yaml',
  yml: 'yaml',
  sh: 'shell',
  bash: 'shell',
  json: 'json',
  jsonc: 'json',
  toml: 'toml',
  md: 'markdown',
  rs: 'rust',
  java: 'java',
};

/**
 * Returns the path to a file-type SVG icon for the given filename,
 * or null if no icon is available (use Lucide File as fallback).
 */
export function getFileTypeIcon(name: string): string | null {
  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() : '';
  if (!ext) return null;
  const icon = EXT_TO_ICON[ext];
  return icon ? `${BASE}/${icon}.svg` : null;
}
