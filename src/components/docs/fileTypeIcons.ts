// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

const BASE = '/icons/file-types';

/** Maps file extensions to icon filenames (without .svg). Used by CodeExplorer/FileTreeViewer. */
const EXT_TO_ICON: Record<string, string> = {
  tf: 'terraform',
  tfvars: 'terraform',
  hcl: 'terraform',
  go: 'go',
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  yaml: 'yaml',
  yml: 'yaml',
  sh: 'bash',
  bash: 'bash',
  json: 'json',
  jsonc: 'json',
  toml: 'toml',
  md: 'markdown',
  rs: 'rust',
  java: 'java',
  css: 'css',
  html: 'html',
  htm: 'html',
  sql: 'sql',
  xml: 'xml',
  rb: 'ruby',
  php: 'php',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  lua: 'lua',
  ps1: 'powershell',
  psm1: 'powershell',
  ini: 'ini',
  env: 'ini',
  conf: 'nginx',
  nginx: 'nginx',
};

/** Maps language keywords/names to icon filenames. Used by CodeGroup tabs. */
const LANG_TO_ICON: Record<string, string> = {
  // Shells
  bash: 'bash',
  shell: 'bash',
  sh: 'bash',
  zsh: 'bash',
  powershell: 'powershell',
  pwsh: 'powershell',
  // Languages
  go: 'go',
  golang: 'go',
  typescript: 'typescript',
  ts: 'typescript',
  javascript: 'javascript',
  js: 'javascript',
  python: 'python',
  py: 'python',
  rust: 'rust',
  rs: 'rust',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  'c++': 'cpp',
  csharp: 'csharp',
  'c#': 'csharp',
  ruby: 'ruby',
  rb: 'ruby',
  php: 'php',
  lua: 'lua',
  // Web
  css: 'css',
  html: 'html',
  sql: 'sql',
  xml: 'xml',
  // Config / Data
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  dotenv: 'ini',
  env: 'ini',
  markdown: 'markdown',
  md: 'markdown',
  // IaC / DevOps
  hcl: 'terraform',
  terraform: 'terraform',
  tf: 'terraform',
  dockerfile: 'docker',
  docker: 'docker',
  'docker-compose': 'docker',
  kubernetes: 'kubernetes',
  kubectl: 'kubernetes',
  k8s: 'kubernetes',
  nginx: 'nginx',
  ansible: 'ansible',
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

/**
 * Returns the path to a language SVG icon for the given language name/keyword,
 * or null if no icon is available. Used by CodeGroup tabs.
 */
export function getLanguageIcon(lang: string): string | null {
  const key = lang.trim().toLowerCase();
  const icon = LANG_TO_ICON[key];
  return icon ? `${BASE}/${icon}.svg` : null;
}
