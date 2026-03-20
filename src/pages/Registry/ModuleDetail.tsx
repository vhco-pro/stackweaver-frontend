// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useParams, useNavigate } from 'react-router-dom';
import { Package, Upload, Tag, Download, ExternalLink, Clock, Settings, Code, Copy, CheckCircle2, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { registryApi, type ModuleVersion } from '@/api/client';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getVcsProviderIcon, getVcsRepoUrl } from '@/lib/vcs';
// eslint-disable-next-line no-restricted-imports -- legitimate dependency-based effect
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMountEffect } from '@/hooks/useMountEffect';
import { HclSyntaxHighlighter } from '@/components/code/HclSyntaxHighlighter';
import { MarkdownRenderer } from '@/components/docs/MarkdownRenderer';

type TabType = 'readme' | 'inputs' | 'outputs' | 'dependencies' | 'resources' | 'versions';

type ConfirmKind = 'version' | 'module';

// Types for module metadata based on backend parser structures
interface InputDefinition {
  name: string;
  description?: string;
  type?: string;
  default?: unknown;
  required: boolean;
}

interface OutputDefinition {
  name: string;
  description?: string;
}

interface ProviderDependency {
  name: string;
  source: string;
  version?: string;
}

interface ResourceType {
  name?: string;
  type?: string;
}

interface ModuleInputsData {
  inputs?: InputDefinition[];
}

interface ModuleOutputsData {
  outputs?: OutputDefinition[];
}

interface ModuleDependenciesData {
  dependencies?: ProviderDependency[];
}

interface ModuleResourcesData {
  resources?: ResourceType[];
}

// Helper function to determine if a type should be rendered with Shiki syntax highlighting
// Long types (like object({...})) should use Shiki for better readability
function shouldUseShikiHighlighting(type: string | undefined): boolean {
  if (!type) return false;
  // Use Shiki for object definitions or types longer than 50 chars
  return type.includes('object({') || type.length > 50;
}

// Helper function to determine if type should be displayed below the parameter name
// If type is very long (>80 chars), display it below instead of inline
function shouldDisplayTypeBelow(type: string | undefined): boolean {
  if (!type) return false;
  return type.length > 80 || type.includes('object({');
}

// Helper function to format long type strings with line breaks for better readability
function formatTypeString(code: string): string {
  // If it's short, return as-is
  if (code.length <= 80) return code;
  
  // For long strings, add line breaks at logical points
  let formatted = code;
  
  // Break object definitions: add newline after opening brace and before closing brace
  // Format: object({ key = type key2 = type }) -> object({\n  key = type\n  key2 = type\n})
  formatted = formatted.replace(/object\(\{([^}]+)\}\)/g, (match: string, content: string) => {
    // Split by spaces that come after = signs (field separators)
    const fields = content.trim().split(/\s+(?=[a-zA-Z_][a-zA-Z0-9_]*\s*=)/);
    if (fields.length > 1) {
      const indentedFields = fields.map((f: string) => f.trim()).filter((f: string) => f.length > 0).join('\n  ');
      return `object({\n  ${indentedFields}\n})`;
    }
    return match;
  });
  
  // Break long list/tuple definitions similarly
  formatted = formatted.replace(/(list|map|set|tuple)\(([^)]+)\)/g, (match: string, func: string, content: string) => {
    if (content.length > 40 && content.includes('=')) {
      // If it contains object-like content, format it
      const fields = content.trim().split(/\s+(?=[a-zA-Z_][a-zA-Z0-9_]*\s*=)/);
      if (fields.length > 1) {
        const indentedFields = fields.map((f: string) => f.trim()).filter((f: string) => f.length > 0).join('\n  ');
        return `${func}(\n  ${indentedFields}\n)`;
      }
    }
    return match;
  });
  
  return formatted;
}

// Component for rendering HCL code with Shiki syntax highlighting (colors only, no background)
function HclTypeDisplay({ code }: { code: string }) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );

  // Format the code with line breaks if it's long
  const formattedCode = formatTypeString(code);

  // Track theme changes (html.dark class) so Shiki uses matching colors
  useMountEffect(() => {
    if (typeof document === 'undefined') return;
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      const next: 'dark' | 'light' = el.classList.contains('dark') ? 'dark' : 'light';
      setThemeMode((prev) => {
        if (prev !== next) {
          // Clear highlighted HTML when theme changes so it re-highlights with new theme
          setHighlightedHtml(null);
          setIsLoading(true);
          return next;
        }
        return prev;
      });
    });
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  });

  useEffect(() => {
    void (async () => {
      try {
        const { codeToHtml } = await import('shiki');
        
        // Get current theme mode dynamically
        const currentMode: 'dark' | 'light' =
          typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        
        // Use GitHub themes matching current mode
        const theme = currentMode === 'dark' ? 'github-dark' : 'github-light';
        
        const html = await codeToHtml(formattedCode, {
          lang: 'hcl',
          theme,
        });
        
        setHighlightedHtml(html);
      } catch {
        // If HCL language is not supported, try terraform
        try {
          const { codeToHtml } = await import('shiki');
          
          // Get current theme mode dynamically
          const currentMode: 'dark' | 'light' =
            typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';
          
          // Use GitHub themes matching current mode
          const theme = currentMode === 'dark' ? 'github-dark' : 'github-light';
          
          const html = await codeToHtml(formattedCode, {
            lang: 'terraform',
            theme,
          });
          setHighlightedHtml(html);
        } catch {
          // Fallback to plain text
          setHighlightedHtml(null);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, [formattedCode, themeMode]);

  if (isLoading || !highlightedHtml) {
    // Show plain text while loading or if Shiki fails
    return <span className="font-mono text-xs whitespace-pre-wrap break-words">{formattedCode}</span>;
  }

  // Render Shiki HTML with transparent background - only colors, no backgrounds
  // Remove background colors from inline styles in Shiki output
  const cleanedHtml = highlightedHtml
    .replace(/background-color:\s*[^;]+;?/gi, '')
    .replace(/background:\s*[^;]+;?/gi, '');
  
  return (
    <span 
      className="font-mono text-xs whitespace-pre-wrap break-words [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!m-0 [&_pre]:!border-0 [&_pre]:!whitespace-pre-wrap [&_code]:!bg-transparent [&_code]:!p-0 [&_code]:!m-0 [&_code]:!border-0"
      dangerouslySetInnerHTML={{ __html: cleanedHtml }}
    />
  );
}

// Helper function to get type badge styling based on Terraform type
function getTypeBadgeStyles(type: string | undefined): string {
  const normalizedType = (type || 'string').toLowerCase();
  
  // Handle complex types like "list(string)", "map(string)", "object({...})"
  if (normalizedType.startsWith('list')) {
    return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';
  }
  if (normalizedType.startsWith('map')) {
    return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
  }
  if (normalizedType.startsWith('object')) {
    return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20';
  }
  if (normalizedType.startsWith('set')) {
    return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
  }
  if (normalizedType.startsWith('tuple')) {
    return 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20';
  }
  
  // Handle primitive types
  switch (normalizedType) {
    case 'string':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    case 'number':
    case 'int':
    case 'float':
      return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20';
    case 'bool':
    case 'boolean':
      return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
    default:
      return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
  }
}


export default function ModuleDetail() {
  const { orgName, moduleName, provider } = useParams<{
    orgName: string;
    moduleName: string;
    provider: string;
  }>();
  const navigate = useNavigate();
  const [selectedVersion, setSelectedVersion] = useState<ModuleVersion | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('inputs');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [version, setVersion] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedDefaultId, setCopiedDefaultId] = useState<string | null>(null);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ kind: ConfirmKind; version?: string } | null>(null);

  const { isLoading: loading, data: moduleData, refetch: refetchModule } = useQuery({
    queryKey: ['moduleDetail', orgName, moduleName, provider],
    queryFn: async () => {
      const [moduleRes, versionsData] = await Promise.all([
        registryApi.modules.get(orgName!, moduleName!, provider!),
        registryApi.modules.getVersions(orgName!, moduleName!, provider!).catch(() => []),
      ]);
      const versionsList = Array.isArray(versionsData) ? versionsData : [];
      // Initialize UI selection state on first load
      if (versionsList.length > 0) {
        setSelectedVersion(prev => prev ?? versionsList[0]);
      } else {
        setSelectedVersion(null);
        setActiveTab('versions');
      }
      return { module: moduleRes, versions: versionsList };
    },
    enabled: !!orgName && !!moduleName && !!provider,
  });

  const module = moduleData?.module ?? null;
  const versions = moduleData?.versions ?? [];

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!version.trim() || !file) {
      toast.error('Version and file are required');
      return;
    }

    if (!orgName || !moduleName || !provider) return;

    setUploading(true);
    try {
      await registryApi.modules.publishVersion(orgName, moduleName, provider, version, file);
      toast.success('Version published successfully');
      setUploadDialogOpen(false);
      setVersion('');
      setFile(null);
      // Refresh module data and versions via React Query
      setSelectedVersion(null); // Reset so queryFn picks the latest version
      void refetchModule();
    } catch (err: unknown) {
      console.error('Failed to publish version:', err);
      const errorMessage = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Failed to publish version';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleCopyConfig = async () => {
    const config = `module "${moduleName}" {
  source  = "app.terraform.io/${orgName}/${moduleName}/${provider}"
  version = "${selectedVersion?.version || 'latest'}"
  # insert required variables here
}`;
    await navigator.clipboard.writeText(config);
    setCopied(true);
    toast.success('Configuration copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading module...
        </div>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Module not found</p>
      </div>
    );
  }

  // Type-safe access to module metadata
  const inputs = (selectedVersion?.inputs as ModuleInputsData | undefined);
  const outputs = (selectedVersion?.outputs as ModuleOutputsData | undefined);
  const dependencies = (selectedVersion?.dependencies as ModuleDependenciesData | undefined);
  const resources = (selectedVersion?.resources as ModuleResourcesData | undefined);
  const inputsList = inputs?.inputs ?? [];
  const requiredInputs: InputDefinition[] = inputsList.filter((input) => input.required);
  const optionalInputs: InputDefinition[] = inputsList.filter((input) => !input.required);

  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb Header */}
      <div className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-6 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hover:text-foreground cursor-pointer" onClick={() => { void Promise.resolve(navigate(`/app/${orgName}/workspaces`)); }}>
              {orgName}
            </span>
            <span>/</span>
            <span className="hover:text-foreground cursor-pointer" onClick={() => { void Promise.resolve(navigate(`/app/${orgName}/registry`)); }}>
              Registry
            </span>
            <span>/</span>
            <span className="hover:text-foreground cursor-pointer" onClick={() => { void Promise.resolve(navigate(`/app/${orgName}/registry`)); }}>
              Modules
            </span>
            <span>/</span>
            <span className="text-foreground font-medium">private</span>
            <span>/</span>
            <span className="text-foreground font-medium">{moduleName}</span>
            <span>/</span>
            <span className="text-foreground font-medium">{provider}</span>
            {selectedVersion && (
              <>
                <span>/</span>
                <span className="text-foreground font-medium">{selectedVersion.version}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Module Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-3xl font-bold">{moduleName}</h1>
            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
              <Package className="h-3 w-3 mr-1" />
              Private
            </Badge>
            {module.auto_publish_tags && (
              <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                <Tag className="h-3 w-3 mr-1" />
                Tag-Based
              </Badge>
            )}
          </div>
          {module.description && (
            <p className="text-muted-foreground text-lg mb-4">{module.description}</p>
          )}
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <span>Published by {orgName}</span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">Provider</span>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                {provider}
              </Badge>
            </div>
            {versions.length > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">Version</span>
                  <Select
                    value={selectedVersion?.version || versions[0].version}
                    onValueChange={(value) => {
                      const version = versions.find(v => v.version === value);
                      if (version) setSelectedVersion(version);
                    }}
                  >
                    <SelectTrigger className="w-[140px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {versions.map((v) => (
                        <SelectItem key={v.id} value={v.version}>
                          {v.version} {v.version === versions[0].version && '(latest)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedVersion && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>Published {new Date(selectedVersion.published_at).toLocaleDateString()}</span>
                  </div>
                )}
              </>
            )}
            {module.vcs_repository && (() => {
              const repoUrl = getVcsRepoUrl(module.vcs_provider ?? '', module.vcs_repository ?? '', module.vcs_account_name);
              return repoUrl ? (
                <a href={repoUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:underline">
                  {getVcsProviderIcon(module.vcs_provider ?? '', 'h-3.5 w-3.5 dark:text-white')}
                  <span>{module.vcs_repository}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="flex items-center gap-1.5">
                  {getVcsProviderIcon(module.vcs_provider ?? '', 'h-3.5 w-3.5 dark:text-white')}
                  <span>{module.vcs_repository}</span>
                </span>
              );
            })()}
          </div>
        </div>

        <div className="flex gap-6">
          {/* Main Content */}
          <div className="flex-1">
            {/* Tabs */}
            <div className="border-b border-border mb-6">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => setActiveTab('readme')}
                  className={cn(
                    'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'readme'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  Readme
                </button>
                <button
                  onClick={() => setActiveTab('inputs')}
                  className={cn(
                    'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'inputs'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  Inputs {requiredInputs.length > 0 && ` ${requiredInputs.length}`}
                </button>
                <button
                  onClick={() => setActiveTab('outputs')}
                  className={cn(
                    'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'outputs'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  Outputs {(outputs?.outputs?.length ?? 0) > 0 && ` ${outputs?.outputs?.length ?? 0}`}
                </button>
                <button
                  onClick={() => setActiveTab('dependencies')}
                  className={cn(
                    'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'dependencies'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  Dependencies {(dependencies?.dependencies?.length ?? 0) > 0 && ` ${dependencies?.dependencies?.length ?? 0}`}
                </button>
                <button
                  onClick={() => setActiveTab('resources')}
                  className={cn(
                    'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'resources'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  Resources {(resources?.resources?.length ?? 0) > 0 && ` ${resources?.resources?.length ?? 0}`}
                </button>
                <button
                  onClick={() => setActiveTab('versions')}
                  className={cn(
                    'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'versions'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  Versions {versions.length > 0 && ` ${versions.length}`}
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="space-y-6">
              {activeTab === 'readme' && (
                <div className="max-w-4xl">
                  {selectedVersion?.readme ? (
                    <MarkdownRenderer
                      content={selectedVersion.readme}
                      enableCallouts={true}
                      enableCodeGroups={true}
                      enableMermaid={true}
                    />
                  ) : (
                    <p className="text-muted-foreground">No README available for this version.</p>
                  )}
                </div>
              )}

              {activeTab === 'inputs' && (
                <div>
                  {requiredInputs.length > 0 && (
                    <div className="mb-8">
                      <h2 className="text-xl font-semibold mb-4">Required Inputs</h2>
                      <p className="text-sm text-muted-foreground mb-4">
                        These variables must be set in the module block when using this module.
                      </p>
                      <div className="space-y-4">
                        {requiredInputs.map((input, index: number) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex items-start gap-3 mb-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <Code className="h-4 w-4 text-muted-foreground" />
                                <code className="text-sm font-mono font-semibold">{input.name}</code>
                              </div>
                              {!shouldDisplayTypeBelow(input.type) && (
                                shouldUseShikiHighlighting(input.type) ? (
                                  <div className="text-xs whitespace-pre-wrap break-words">
                                    <HclTypeDisplay code={input.type || 'string'} />
                                  </div>
                                ) : (
                                  <Badge variant="outline" className={cn('text-xs whitespace-normal break-words max-w-full', getTypeBadgeStyles(input.type))}>
                                    {input.type || 'string'}
                                  </Badge>
                                )
                              )}
                            </div>
                            {shouldDisplayTypeBelow(input.type) && (
                              <div className="mt-2 mb-2">
                                {shouldUseShikiHighlighting(input.type) ? (
                                  <div className="text-xs whitespace-pre-wrap break-words bg-muted/30 border border-border/50 rounded p-2">
                                    <HclTypeDisplay code={input.type || 'string'} />
                                  </div>
                                ) : (
                                  <Badge variant="outline" className={cn('text-xs whitespace-normal break-words max-w-full', getTypeBadgeStyles(input.type))}>
                                    {input.type || 'string'}
                                  </Badge>
                                )}
                              </div>
                            )}
                            {input.description && (
                              <p className="text-sm text-muted-foreground">{input.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {optionalInputs.length > 0 && (
                    <div>
                      <h2 className="text-xl font-semibold mb-4">Optional Inputs</h2>
                      <div className="space-y-4">
                        {optionalInputs.map((input, index: number) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex items-start gap-3 mb-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <Code className="h-4 w-4 text-muted-foreground" />
                                <code className="text-sm font-mono font-semibold">{input.name}</code>
                              </div>
                              {!shouldDisplayTypeBelow(input.type) && (
                                shouldUseShikiHighlighting(input.type) ? (
                                  <div className="text-xs whitespace-pre-wrap break-words">
                                    <HclTypeDisplay code={input.type || 'string'} />
                                  </div>
                                ) : (
                                  <Badge variant="outline" className={cn('text-xs whitespace-normal break-words max-w-full', getTypeBadgeStyles(input.type))}>
                                    {input.type || 'string'}
                                  </Badge>
                                )
                              )}
                            </div>
                            {shouldDisplayTypeBelow(input.type) && (
                              <div className="mt-2 mb-2">
                                {shouldUseShikiHighlighting(input.type) ? (
                                  <div className="text-xs whitespace-pre-wrap break-words bg-muted/30 border border-border/50 rounded p-2">
                                    <HclTypeDisplay code={input.type || 'string'} />
                                  </div>
                                ) : (
                                  <Badge variant="outline" className={cn('text-xs whitespace-normal break-words max-w-full', getTypeBadgeStyles(input.type))}>
                                    {input.type || 'string'}
                                  </Badge>
                                )}
                              </div>
                            )}
                            {input.description && (
                              <p className="text-sm text-muted-foreground mb-2">{input.description}</p>
                            )}
                            {input.default !== undefined && (() => {
                              const defaultId = `default-${input.name}-${index}`;
                              const defaultType = typeof input.default;
                              // Handle string values that might be Go string representations
                              let defaultStr: string;
                              if (input.default === null) {
                                defaultStr = 'null';
                              } else if (defaultType === 'string') {
                                const strVal = input.default as string;
                                // Check if it's a Go string representation like "cty.NullVal(...)"
                                if (strVal.startsWith('cty.') || strVal.includes('cty.')) {
                                  // If it's null, show null
                                  if (strVal.includes('NullVal') || strVal.includes('NilVal')) {
                                    defaultStr = 'null';
                                  } else {
                                    // For other cty values, try to extract meaningful info or show null
                                    defaultStr = 'null';
                                  }
                                } else {
                                  defaultStr = strVal;
                                }
                              } else if (defaultType === 'object') {
                                defaultStr = JSON.stringify(input.default, null, 2);
                              } else if (defaultType === 'number') {
                                defaultStr = String(input.default as number);
                              } else if (defaultType === 'boolean') {
                                defaultStr = String(input.default as boolean);
                              } else {
                                // Fallback for unknown types - use JSON stringify to avoid [object Object]
                                defaultStr = JSON.stringify(input.default);
                              }
                              
                              const handleCopyDefault = async () => {
                                try {
                                  await navigator.clipboard.writeText(defaultStr);
                                  setCopiedDefaultId(defaultId);
                                  setTimeout(() => setCopiedDefaultId(null), 2000);
                                } catch (err) {
                                  console.error('Failed to copy default value:', err);
                                }
                              };
                              
                              return (
                                <div className="mt-3 pt-3 border-t border-border/50">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-foreground">Default:</span>
                                    <code className="text-xs font-mono bg-muted/50 px-2 py-1 rounded border border-border/50 text-foreground inline-block whitespace-pre-wrap">
                                      {defaultStr}
                                    </code>
                                    <button
                                      onClick={() => { void handleCopyDefault(); }}
                                      className="flex items-center text-muted-foreground hover:text-foreground transition-colors p-1 flex-shrink-0"
                                      title="Copy default value"
                                    >
                                      {copiedDefaultId === defaultId ? (
                                        <CheckCircle2 className="h-4 w-4" />
                                      ) : (
                                        <Copy className="h-4 w-4" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {requiredInputs.length === 0 && optionalInputs.length === 0 && (
                    <p className="text-muted-foreground">No inputs defined for this module.</p>
                  )}
                </div>
              )}

              {activeTab === 'outputs' && (
                <div>
                  {(outputs?.outputs?.length ?? 0) > 0 ? (
                    <div className="space-y-4">
                      {(outputs?.outputs ?? []).map((output, index: number) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Code className="h-4 w-4 text-muted-foreground" />
                            <code className="text-sm font-mono font-semibold">{output.name}</code>
                          </div>
                          {output.description && (
                            <p className="text-sm text-muted-foreground">{output.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No outputs defined for this module.</p>
                  )}
                </div>
              )}

              {activeTab === 'dependencies' && (
                <div>
                  {(dependencies?.dependencies?.length ?? 0) > 0 ? (
                    <div className="space-y-4">
                      {(dependencies?.dependencies ?? []).map((dep, index: number) => (
                        <div key={index} className="border rounded-lg p-4">
                          <code className="text-sm font-mono">{JSON.stringify(dep, null, 2)}</code>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No dependencies defined for this module.</p>
                  )}
                </div>
              )}

              {activeTab === 'resources' && (
                <div>
                  {(resources?.resources?.length ?? 0) > 0 ? (
                    <div className="space-y-4">
                      {(resources?.resources ?? []).map((resource, index: number) => (
                        <div key={index} className="border rounded-lg p-4">
                          <code className="text-sm font-mono">{resource.type || resource.name}</code>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No resources defined for this module.</p>
                  )}
                </div>
              )}

              {activeTab === 'versions' && (
                <div>
                  {versions.length > 0 ? (
                    <div className="space-y-4">
                      {versions.map((v) => (
                        <div
                          key={v.id}
                          className={cn(
                            'border rounded-lg p-4 cursor-pointer transition-colors',
                            selectedVersion?.id === v.id
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted/50'
                          )}
                          onClick={() => setSelectedVersion(v)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <Tag className="h-4 w-4 text-muted-foreground" />
                                <span className="font-semibold text-lg">{v.version}</span>
                                {v.version === versions[0].version && (
                                  <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                                    Latest
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                <span>{new Date(v.published_at).toLocaleDateString()}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Download className="h-4 w-4" />
                                <span>{v.downloads || 0} downloads</span>
                              </div>
                              {v.tarball_size && (
                                <span className="text-xs">
                                  {(v.tarball_size / 1024).toFixed(2)} KB
                                </span>
                              )}
                            </div>
                          </div>
                          {v.version === selectedVersion?.version && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-sm text-muted-foreground">
                                Currently viewing this version
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground text-lg mb-2">No versions published yet</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Upload a version manually or push a Git tag to auto-publish
                      </p>
                      <Button onClick={() => setUploadDialogOpen(true)}>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Version
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="w-80 space-y-6">
            <div className="space-y-4">
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={() => setManageDialogOpen(true)}
              >
                <Settings className="h-4 w-4" />
                Manage Module for Organization
              </Button>
            </div>

            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold">Usage Instructions</h3>
              <p className="text-sm text-muted-foreground">
                Copy and paste into your Terraform configuration and set values for the input variables. Or, design a configuration to easily use module and workspace outputs as inputs.
              </p>
              <HclSyntaxHighlighter
                code={`module "${moduleName}" {
  source  = "app.terraform.io/${orgName}/${moduleName}/${provider}"
  version = "${selectedVersion?.version || 'latest'}"
  # insert required variables here
}`}
              />
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => { void handleCopyConfig(); }}
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy configuration
                  </>
                )}
              </Button>
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2">
                  When running Terraform on the CLI, you must configure credentials to access this module:
                </p>
                <HclSyntaxHighlighter
                  code={`credentials "app.terraform.io" {
  # valid user API token
}`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Manage Module Dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Module for Organization</DialogTitle>
            <DialogDescription>
              Manage versions and delete options for this module.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Delete Selected Version - Only show if a version is selected */}
            {selectedVersion && (
              <div className="border rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-sm">Delete Selected Version</h4>
                <p className="text-xs text-muted-foreground">
                  Delete version <span className="font-mono font-semibold">{selectedVersion.version}</span> of this module. This action cannot be undone.
                </p>
                <Button
                  variant="outline"
                  className="w-full gap-2 text-destructive hover:text-destructive border-destructive/50 hover:border-destructive hover:bg-destructive/10"
                  onClick={() => { setConfirmDialog({ kind: 'version', version: selectedVersion.version }); }}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Delete Version {selectedVersion.version}
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Delete All Versions (Delete Module) - Danger zone */}
            <div className="border rounded-lg p-4 space-y-2 border-destructive/50 bg-destructive/5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h4 className="font-semibold text-sm text-destructive">Delete All Versions</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Permanently delete <strong>all versions</strong> of this module. This action cannot be undone.
              </p>
              <Button
                variant="destructive"
                className="w-full gap-2"
                onClick={() => { setConfirmDialog({ kind: 'module' }); }}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete Module
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Styled confirmation dialog (replaces window.confirm) */}
      <ConfirmDialog
        open={!!confirmDialog}
        onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}
        title={
          confirmDialog?.kind === 'version'
            ? `Delete version ${confirmDialog.version ?? ''}?`
            : confirmDialog?.kind === 'module'
              ? `Delete module ${moduleName}/${provider}?`
              : ''
        }
        description="This action cannot be undone."
        confirmLabel={
          confirmDialog?.kind === 'version'
            ? `Delete Version ${confirmDialog.version ?? ''}`
            : confirmDialog?.kind === 'module'
              ? 'Delete Module'
              : 'Confirm'
        }
        cancelLabel="Cancel"
        variant="destructive"
        loading={deleting}
        onConfirm={async () => {
          if (!confirmDialog || !orgName || !moduleName || !provider) return;
          setDeleting(true);
          try {
            if (confirmDialog.kind === 'version' && confirmDialog.version) {
              await registryApi.modules.deleteVersion(orgName, moduleName, provider, confirmDialog.version);
              toast.success(`Version ${confirmDialog.version} deleted successfully`);
              setSelectedVersion(null);
              await refetchModule();
            } else if (confirmDialog.kind === 'module') {
              await registryApi.modules.delete(orgName, moduleName, provider);
              toast.success('Module deleted successfully');
              setManageDialogOpen(false);
              setConfirmDialog(null);
              void Promise.resolve(navigate(`/app/${orgName}/registry`));
              return;
            }
            setConfirmDialog(null);
            setManageDialogOpen(false);
          } catch (err: unknown) {
            const errorMessage = err && typeof err === 'object' && 'message' in err
              ? String((err as { message: unknown }).message)
              : confirmDialog.kind === 'version'
                ? 'Failed to delete version'
                : 'Failed to delete module';
            toast.error(errorMessage);
          } finally {
            setDeleting(false);
          }
        }}
      />

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Module Version</DialogTitle>
            <DialogDescription>
              Upload a new version of this module. The file should be a gzipped tarball (.tar.gz).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { void handleUpload(e); }} className="space-y-4">
            <div>
              <Label htmlFor="version">Version *</Label>
              <Input
                id="version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="e.g., 1.0.0"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Must be in semantic version format (MAJOR.MINOR.PATCH)
              </p>
            </div>
            <div>
              <Label htmlFor="file">Tarball File *</Label>
              <Input
                id="file"
                type="file"
                accept=".tar.gz,.tgz"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUploadDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploading || !version || !file}>
                {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Upload
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
