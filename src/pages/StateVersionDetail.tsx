// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { stateVersionsApi } from '@/api/client';
import { JsonSyntaxHighlighter } from '@/components/code/JsonSyntaxHighlighter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Download,
  Maximize2,
  ChevronDown,
  ChevronUp,
  Loader2,
  GitCommit,
  User,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Diff utilities
interface DiffResult {
  type: 'added' | 'removed' | 'unchanged' | 'modified';
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
  lineNumber?: number;
}

function deepDiff(oldObj: unknown, newObj: unknown, path: string = ''): DiffResult[] {
  const results: DiffResult[] = [];
  
  if (oldObj === newObj) {
    return results;
  }
  
  if (typeof oldObj !== typeof newObj) {
    if (oldObj !== undefined) {
      results.push({ type: 'removed', path, oldValue: oldObj });
    }
    if (newObj !== undefined) {
      results.push({ type: 'added', path, newValue: newObj });
    }
    return results;
  }
  
  if (Array.isArray(oldObj) && Array.isArray(newObj)) {
    const maxLen = Math.max(oldObj.length, newObj.length);
    for (let i = 0; i < maxLen; i++) {
      const itemPath = path ? `${path}[${i}]` : `[${i}]`;
      if (i >= oldObj.length) {
        results.push({ type: 'added', path: itemPath, newValue: newObj[i] });
      } else if (i >= newObj.length) {
        results.push({ type: 'removed', path: itemPath, oldValue: oldObj[i] });
      } else {
        results.push(...deepDiff(oldObj[i], newObj[i], itemPath));
      }
    }
    return results;
  }
  
  if (typeof oldObj === 'object' && oldObj !== null && typeof newObj === 'object' && newObj !== null) {
    const allKeys = new Set([...Object.keys(oldObj as Record<string, unknown>), ...Object.keys(newObj as Record<string, unknown>)]);
    for (const key of allKeys) {
      const keyPath = path ? `${path}.${key}` : key;
      const oldVal = (oldObj as Record<string, unknown>)[key];
      const newVal = (newObj as Record<string, unknown>)[key];
      
      if (!(key in (oldObj as Record<string, unknown>))) {
        results.push({ type: 'added', path: keyPath, newValue: newVal });
      } else if (!(key in (newObj as Record<string, unknown>))) {
        results.push({ type: 'removed', path: keyPath, oldValue: oldVal });
      } else {
        results.push(...deepDiff(oldVal, newVal, keyPath));
      }
    }
    return results;
  }
  
  // Primitives that are different
  if (oldObj !== newObj) {
    results.push({ type: 'modified', path, oldValue: oldObj, newValue: newObj });
  }
  
  return results;
}

function generateDiffLines(currentState: unknown, previousState: unknown): { oldLines: string[]; newLines: string[]; diffMarkers: ('added' | 'removed' | 'unchanged' | 'modified')[] } {
  const oldLines: string[] = [];
  const newLines: string[] = [];
  const diffMarkers: ('added' | 'removed' | 'unchanged' | 'modified')[] = [];
  
  const oldStr = JSON.stringify(previousState, null, 2);
  const newStr = JSON.stringify(currentState, null, 2);
  
  const oldLinesArr = oldStr.split('\n');
  const newLinesArr = newStr.split('\n');
  
  // Simple line-by-line diff
  const maxLines = Math.max(oldLinesArr.length, newLinesArr.length);
  
  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLinesArr[i] || '';
    const newLine = newLinesArr[i] || '';
    
    oldLines.push(oldLine);
    newLines.push(newLine);
    
    if (oldLine === newLine) {
      diffMarkers.push('unchanged');
    } else if (!oldLine && newLine) {
      diffMarkers.push('added');
    } else if (oldLine && !newLine) {
      diffMarkers.push('removed');
    } else {
      diffMarkers.push('modified');
    }
  }
  
  return { oldLines, newLines, diffMarkers };
}

export default function StateVersionDetail() {
  const { orgName, workspaceName, stateVersionId } = useParams<{
    orgName: string;
    workspaceName: string;
    stateVersionId: string;
  }>();
  const navigate = useNavigate();
  
  const [filter, setFilter] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDiffExpanded, setIsDiffExpanded] = useState(true);
  const [copiedId, setCopiedId] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch state version
  const { data: stateVersion = null, isLoading: loading, error: stateError } = useQuery({
    queryKey: ['stateVersion', stateVersionId],
    queryFn: async () => {
      return await stateVersionsApi.get(stateVersionId!);
    },
    enabled: !!stateVersionId,
  });

  const error = stateError ? 'Failed to load state version' : null;

  // Fetch all state versions to find the previous one
  const { data: previousStateVersion = null } = useQuery({
    queryKey: ['previousStateVersion', stateVersion?.workspace_id, stateVersion?.id],
    queryFn: async () => {
      const versions = await stateVersionsApi.list(stateVersion!.workspace_id);
      const currentIdx = versions.findIndex(v => v.id === stateVersion!.id);
      if (currentIdx >= 0 && currentIdx < versions.length - 1) {
        return await stateVersionsApi.get(versions[currentIdx + 1].id);
      }
      return null;
    },
    enabled: !!stateVersion?.workspace_id && !!stateVersion?.id,
  });

  // Filter state data
  const filteredStateData = useMemo(() => {
    if (!stateVersion?.state_data || !filter.trim()) {
      return stateVersion?.state_data;
    }
    
    const filterLower = filter.toLowerCase();
    const stringified = JSON.stringify(stateVersion.state_data, null, 2);
    
    // Simple filter: check if the JSON contains the filter string
    if (stringified.toLowerCase().includes(filterLower)) {
      return stateVersion.state_data;
    }
    
    return stateVersion.state_data;
  }, [stateVersion?.state_data, filter]);

  // Generate diff
  // Use full objects as dependencies to match React Compiler expectations
  // This ensures the memoization works correctly with React Compiler optimizations
  const { diffSummary, diffLines } = useMemo(() => {
    if (!stateVersion?.state_data || !previousStateVersion?.state_data) {
      return { diffSummary: null, diffLines: null };
    }
    
    const diffs = deepDiff(previousStateVersion.state_data, stateVersion.state_data);
    const added = diffs.filter(d => d.type === 'added').length;
    const removed = diffs.filter(d => d.type === 'removed').length;
    const modified = diffs.filter(d => d.type === 'modified').length;
    
    const lines = generateDiffLines(stateVersion.state_data, previousStateVersion.state_data);
    
    return {
      diffSummary: { added, removed, modified, total: diffs.length },
      diffLines: lines,
    };
  }, [stateVersion, previousStateVersion]); // Use full objects instead of property access for React Compiler compatibility

  const handleDownload = () => {
    if (!stateVersion?.state_data) return;
    
    const blob = new Blob([JSON.stringify(stateVersion.state_data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terraform-state-v${stateVersion.version}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('State file downloaded');
  };

  const handleCopyId = async () => {
    if (!stateVersion?.id) return;
    await navigator.clipboard.writeText(stateVersion.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
    toast.success('State version ID copied');
  };

  const handleDeleteStateVersion = async () => {
    if (!stateVersion) return;

    try {
      setDeleting(true);
      await stateVersionsApi.delete(stateVersion.id);
      toast.success('State version deleted successfully');
      // Navigate back to states list
      void navigate(`/app/${orgName}/workspaces/${workspaceName}?tab=states`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete state version';
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
    return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading state version...</p>
        </div>
      </div>
    );
  }

  if (error || !stateVersion) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error || 'State version not found'}</p>
          <Button variant="outline" asChild>
            <Link to={`/app/${orgName}/${workspaceName}/states`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to States
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", isFullscreen && "fixed inset-0 z-50 bg-background p-6 overflow-auto")}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to={`/app/${orgName}/workspaces`} className="hover:text-foreground">
          {orgName}
        </Link>
        <span>/</span>
        <Link to={`/app/${orgName}/workspaces`} className="hover:text-foreground">
          Workspaces
        </Link>
        <span>/</span>
        <Link to={`/app/${orgName}/workspaces/${workspaceName}`} className="hover:text-foreground">
          {workspaceName}
        </Link>
        <span>/</span>
        <Link to={`/app/${orgName}/workspaces/${workspaceName}?tab=states`} className="hover:text-foreground">
          States
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{stateVersion.id}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">{workspaceName}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span>ID:</span>
            <span className="font-mono">{stateVersion.id}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => { void handleCopyId(); }}
            >
              {copiedId ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={!stateVersion}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete State
          </Button>
          <Button 
            variant="outline"
            onClick={(e) => {
              e.preventDefault();
              try {
                void navigate(`/app/${orgName}/workspaces/${workspaceName}?tab=states`, { replace: false });
              } catch (err) {
                console.error('Navigation error:', err);
                // Fallback navigation
                window.location.href = `/app/${orgName}/workspaces/${workspaceName}?tab=states`;
              }
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      {/* State Version Info Card */}
      <div className="border rounded-lg p-4">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-sm bg-purple-500/10 flex items-center justify-center">
            <GitCommit className="h-5 w-5 text-purple-500" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">
              {stateVersion.commit_hash ? `Commit ${stateVersion.commit_hash.slice(0, 7)}` : `State version #${stateVersion.version}`}
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
              <span className="font-mono text-primary">#{stateVersion.id}</span>
              {stateVersion.committer && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {stateVersion.committer}
                </span>
              )}
              {stateVersion.run_id && (
                <Link 
                  to={`/app/${orgName}/workspaces/${workspaceName}/runs/${stateVersion.run_id}`}
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  #{stateVersion.run_id}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
              {stateVersion.commit_hash && (
                <span className="font-mono">{stateVersion.commit_hash.slice(0, 7)}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {formatTimeAgo(stateVersion.created_at)}
          </div>
        </div>
      </div>

      {/* State JSON Viewer */}
      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { void handleDownload(); }}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Input
                placeholder="filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-[200px] h-8 text-sm"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setFilter('')}>
              Apply
            </Button>
            <a
              href="https://developer.hashicorp.com/terraform/cloud-docs/api-docs/state-versions#filtering-json-data"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              Learn more about filtering JSON data.
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              <Maximize2 className="mr-1 h-4 w-4" />
              Full screen
            </Button>
          </div>
        </div>
        
        {isExpanded && filteredStateData && (
          <JsonSyntaxHighlighter
            json={JSON.stringify(filteredStateData, null, 2)}
            maxHeight={isFullscreen ? 'calc(100vh - 400px)' : '500px'}
          />
        )}
      </div>

      {/* Changes Diff Section */}
      {previousStateVersion && diffLines && (
        <div className="border rounded-lg overflow-hidden">
          <div 
            className="flex items-center justify-between p-3 border-b bg-muted/30 cursor-pointer"
            onClick={() => setIsDiffExpanded(!isDiffExpanded)}
          >
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Changes in this version</h3>
              {diffSummary && (
                <div className="flex items-center gap-2 ml-4">
                  {diffSummary.added > 0 && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                      +{diffSummary.added} added
                    </Badge>
                  )}
                  {diffSummary.removed > 0 && (
                    <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                      -{diffSummary.removed} removed
                    </Badge>
                  )}
                  {diffSummary.modified > 0 && (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                      ~{diffSummary.modified} modified
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                {isDiffExpanded ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
                {isDiffExpanded ? 'Collapse' : 'Expand'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFullscreen(!isFullscreen);
                }}
              >
                <Maximize2 className="mr-1 h-4 w-4" />
                Full screen
              </Button>
            </div>
          </div>
          
          {isDiffExpanded && (
            <div className="overflow-auto" style={{ maxHeight: isFullscreen ? 'calc(100vh - 400px)' : '400px' }}>
              <div className="font-mono text-sm">
                {diffLines.newLines.map((line, idx) => {
                  const marker = diffLines.diffMarkers[idx];
                  const oldLine = diffLines.oldLines[idx];
                  
                  if (marker === 'unchanged') {
                    return (
                      <div key={idx} className="flex">
                        <div className="w-12 text-right pr-2 text-muted-foreground border-r select-none">{idx + 1}</div>
                        <pre className="flex-1 pl-4 whitespace-pre">{line}</pre>
                      </div>
                    );
                  }
                  
                  if (marker === 'removed') {
                    return (
                      <div key={idx} className="flex bg-red-500/10">
                        <div className="w-12 text-right pr-2 text-red-500 border-r select-none">{idx + 1}</div>
                        <pre className="flex-1 pl-4 whitespace-pre text-red-600 dark:text-red-400">
                          <span className="bg-red-500/20">{oldLine}</span>
                        </pre>
                      </div>
                    );
                  }
                  
                  if (marker === 'added') {
                    return (
                      <div key={idx} className="flex bg-green-500/10">
                        <div className="w-12 text-right pr-2 text-green-500 border-r select-none">{idx + 1}</div>
                        <pre className="flex-1 pl-4 whitespace-pre text-green-600 dark:text-green-400">
                          <span className="bg-green-500/20">{line}</span>
                        </pre>
                      </div>
                    );
                  }
                  
                  // Modified - show both old (red) and new (green)
                  return (
                    <div key={idx}>
                      <div className="flex bg-red-500/10">
                        <div className="w-12 text-right pr-2 text-red-500 border-r select-none">{idx + 1}</div>
                        <pre className="flex-1 pl-4 whitespace-pre text-red-600 dark:text-red-400">
                          <span className="bg-red-500/20">{oldLine}</span>
                        </pre>
                      </div>
                      <div className="flex bg-green-500/10">
                        <div className="w-12 text-right pr-2 text-green-500 border-r select-none">{idx + 1}</div>
                        <pre className="flex-1 pl-4 whitespace-pre text-green-600 dark:text-green-400">
                          <span className="bg-green-500/20">{line}</span>
                        </pre>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No changes message if no previous state */}
      {!previousStateVersion && (
        <div className="border rounded-lg p-6 text-center text-muted-foreground">
          <p>This is the first state version. No changes to display.</p>
        </div>
      )}

      {/* Delete State Version Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete State Version</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete state version <span className="font-mono font-semibold">{stateVersion?.id}</span>?
              <br />
              <br />
              <strong>Warning:</strong> This will permanently delete this state version from both the database and storage.
              <br />
              <br />
              {stateVersion?.version && (
                <>
                  This is state version <strong>#{stateVersion.version}</strong>.
                  <br />
                  <br />
                </>
              )}
              This action cannot be undone. If this is the latest state version and the workspace is locked, deletion will be blocked.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => { void handleDeleteStateVersion(); }}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete State Version
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
