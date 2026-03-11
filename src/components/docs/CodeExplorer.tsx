// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect, useState } from 'react';
import { File, Copy, Check, Download, Maximize2, Minimize2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getFileTypeIcon } from './fileTypeIcons';

const FOLDER_ICON = '/icons/file-types/folder-blue.svg';
const FOLDER_OPEN_ICON = '/icons/file-types/folder-blue-open.svg';

interface ExplorerFile {
  path: string;
  lang: string;
  url?: string;
}

interface ExplorerSource {
  type: 'github';
  org: string;
  repo: string;
  path: string;
  ref: string;
  url: string;
}

interface ExplorerManifest {
  root: string;
  files: ExplorerFile[];
  source?: ExplorerSource;
}

interface FileNode {
  name: string;
  path: string;
  lang: string;
  isDir: false;
}

interface DirNode {
  name: string;
  children: TreeNode[];
  isDir: true;
}

type TreeNode = FileNode | DirNode;

function buildFileTree(files: ExplorerFile[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        current.push({ name: part, path: file.path, lang: file.lang, isDir: false });
      } else {
        let dir = current.find((n): n is DirNode => n.isDir && n.name === part);
        if (!dir) {
          dir = { name: part, children: [], isDir: true };
          current.push(dir);
        }
        current = dir.children;
      }
    }
  }

  return root;
}

interface FileTreeProps {
  nodes: TreeNode[];
  selectedPath: string;
  onSelect: (path: string, lang: string) => void;
  depth?: number;
}

function FileTree({ nodes, selectedPath, onSelect, depth = 0 }: FileTreeProps) {
  const [openDirs, setOpenDirs] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const n of nodes) {
      if (n.isDir) s.add(n.name);
    }
    return s;
  });

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {nodes.map((node) => {
        if (node.isDir) {
          const isOpen = openDirs.has(node.name);
          return (
            <li key={node.name} style={{ margin: 0 }}>
              <button
                type="button"
                className="flex items-center gap-1.5 w-full px-2 py-px text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                style={{ paddingLeft: `${(depth + 1) * 0.75}rem` }}
                onClick={() => {
                  setOpenDirs((prev) => {
                    const next = new Set(prev);
                    if (next.has(node.name)) next.delete(node.name);
                    else next.add(node.name);
                    return next;
                  });
                }}
              >
                <img src={isOpen ? FOLDER_OPEN_ICON : FOLDER_ICON} alt="" aria-hidden className="h-4 w-4 shrink-0" loading="lazy" style={{ margin: 0, height: '1rem' }} />
                <span className="font-mono text-sm">{node.name}</span>
              </button>
              {isOpen && (
                <FileTree
                  nodes={node.children}
                  selectedPath={selectedPath}
                  onSelect={onSelect}
                  depth={depth + 1}
                />
              )}
            </li>
          );
        }

        const isActive = node.path === selectedPath;
        return (
          <li key={node.path} style={{ margin: 0 }}>
            <button
              type="button"
              className={`flex items-center gap-1.5 w-full px-2 py-px text-sm transition-colors ${
                isActive
                  ? 'bg-muted/60 text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
              style={{ paddingLeft: `${(depth + 1) * 0.75}rem` }}
              onClick={() => onSelect(node.path, node.lang)}
            >
              {(() => {
                const icon = getFileTypeIcon(node.name);
                return icon
                  ? <img src={icon} alt="" aria-hidden className="h-4 w-4 shrink-0" loading="lazy" style={{ margin: 0, height: '1rem' }} />
                  : <File className="h-4 w-4 shrink-0" />;
              })()}
              <span className="font-mono text-sm">{node.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// Module-level cache: survives ReactMarkdown remounts caused by markdownKey changes
// (each code block highlight triggers a remount of the entire tree).
const manifestCache = new Map<string, ExplorerManifest>();

export interface CodeExplorerProps {
  path: string;
  defaultFile?: string;
}

export function CodeExplorer({ path, defaultFile = '' }: CodeExplorerProps) {
  const [manifest, setManifest] = useState<ExplorerManifest | null>(() => manifestCache.get(path) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>(defaultFile);
  const [selectedLang, setSelectedLang] = useState<string>('text');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Track theme changes so Shiki re-highlights with the correct colors
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      const next: 'dark' | 'light' = el.classList.contains('dark') ? 'dark' : 'light';
      setThemeMode((prev) => (prev === next ? prev : next));
    });
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Fetch (or restore from cache) the manifest and set initial file selection
  useEffect(() => {
    let cancelled = false;
    const cached = manifestCache.get(path);
    if (cached) {
      setManifest(cached);
      const first = defaultFile || cached.files[0]?.path || '';
      const firstLang = cached.files.find((f) => f.path === first)?.lang || cached.files[0]?.lang || 'text';
      setSelectedFile(first);
      setSelectedLang(firstLang);
      return;
    }
    fetch(`/docs/${path}.explorer.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<ExplorerManifest>;
      })
      .then((data) => {
        if (cancelled) return;
        manifestCache.set(path, data);
        setManifest(data);
        const first = defaultFile || data.files[0]?.path || '';
        const firstLang = data.files.find((f) => f.path === first)?.lang || data.files[0]?.lang || 'text';
        setSelectedFile(first);
        setSelectedLang(firstLang);
      })
      .catch(() => {
        if (cancelled) return;
        const root = path.split('/').pop() || path;
        setError(`Code explorer: example directory "${root}" not found.`);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [path, defaultFile]);

  // Fetch file content when selection changes
  useEffect(() => {
    if (!selectedFile || !manifest) return;
    let cancelled = false;
    setLoading(true);
    setHighlightedHtml(null);
    fetch(`/docs/${path}/${selectedFile}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (!cancelled) setFileContent(text);
      })
      .catch(() => {
        if (!cancelled) { setFileContent(null); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [path, selectedFile, manifest]);

  // Highlight with Shiki when file content or theme changes
  useEffect(() => {
    if (fileContent === null) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const { codeToHtml } = await import('shiki');
        if (cancelled) return;
        const theme = themeMode === 'dark' ? 'github-dark' : 'github-light';
        const lang = selectedLang === 'text' || !selectedLang ? 'plaintext' : selectedLang;
        const html = await codeToHtml(fileContent, { lang, theme });
        if (cancelled) return;
        setHighlightedHtml(html);
      } catch {
        if (!cancelled) setHighlightedHtml(`<pre><code>${fileContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fileContent, selectedLang, themeMode]);

  const handleSelectFile = (filePath: string, lang: string) => {
    setSelectedFile(filePath);
    setSelectedLang(lang);
  };

  const handleCopy = async () => {
    if (!fileContent) return;
    try {
      await navigator.clipboard.writeText(fileContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const handleDownload = async () => {
    if (!manifest || downloading) return;
    setDownloading(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const folder = zip.folder(manifest.root)!;
      await Promise.all(
        manifest.files.map(async (file) => {
          const res = await fetch(`/docs/${path}/${file.path}`);
          const blob = await res.blob();
          folder.file(file.path, blob);
        })
      );
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${manifest.root}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore — download failed silently
    } finally {
      setDownloading(false);
    }
  };

  if (error) {
    return (
      <div className="my-4 rounded-md border border-border/40 p-4 text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  if (!manifest) {
    return (
      <div className="my-4 rounded-md border border-border/40 flex items-center justify-center" style={{ height: '480px' }}>
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const treeNodes = buildFileTree(manifest.files);
  const rootName = manifest.root.toUpperCase();

  // For GitHub sources: show ref in header, get per-file link for current selection
  const shortRef = manifest.source?.ref
    ? (/^[0-9a-f]{40}$/i.test(manifest.source.ref) ? manifest.source.ref.slice(0, 7) : manifest.source.ref)
    : null;
  const selectedFileEntry = manifest.files.find(f => f.path === selectedFile);
  const selectedFileUrl = selectedFileEntry?.url;

  // Code pane content (shared between inline and dialog views)
  const codePaneContent = loading ? (
    <div className="p-4 space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded bg-muted/60 animate-pulse"
          style={{ width: `${60 + (i % 5) * 8}%` }}
        />
      ))}
    </div>
  ) : highlightedHtml ? (
    <div dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
  ) : (
    <div className="p-4 text-sm text-muted-foreground">No file selected.</div>
  );

  // Action buttons shared between inline header and dialog header (icons only)
  const actionButtons = (
    <div className="flex items-center gap-3">
      {manifest.source?.type === 'github' && (
        <a
          href={selectedFileUrl || manifest.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          title={selectedFileUrl ? `View ${selectedFile} on GitHub` : 'View on GitHub'}
        >
          ↗
        </a>
      )}
      <button
        type="button"
        onClick={() => { void handleDownload(); }}
        disabled={downloading}
        className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        title={downloading ? 'Downloading…' : 'Download'}
      >
        <Download className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => { void handleCopy(); }}
        className="text-muted-foreground hover:text-foreground transition-colors"
        title={copied ? 'Copied!' : 'Copy'}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );

  return (
    <>
      {/* Inline explorer */}
      <div className="not-prose my-4 rounded-md border border-border/40 overflow-hidden flex flex-col" style={{ height: '480px' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-muted/30 shrink-0">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground">
              {rootName}{shortRef && <span className="font-normal ml-1.5 opacity-60">@ {shortRef}</span>}
            </span>
          <div className="flex items-center gap-3">
            {actionButtons}
            <button
              type="button"
              onClick={() => { setExpanded(true); }}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Expand"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* File tree pane */}
          <div className="min-w-[180px] max-w-[220px] border-r border-border/40 overflow-y-auto bg-muted/10 py-2">
            <FileTree
              nodes={treeNodes}
              selectedPath={selectedFile}
              onSelect={handleSelectFile}
            />
          </div>

          {/* Code pane — relative+absolute ensures the scroll container is exactly the flex child's box */}
          <div className="flex-1 relative min-w-0">
            <div className="code-explorer-code absolute inset-0 overflow-auto text-sm">
              {codePaneContent}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen dialog */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent hideCloseButton aria-label={rootName} aria-describedby={undefined} className="not-prose max-w-[90vw] p-0 gap-0 overflow-hidden" style={{ height: '90vh', display: 'flex', flexDirection: 'column' }}>
          {/* Dialog header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-muted/30 shrink-0">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground">
              {rootName}{shortRef && <span className="font-normal ml-1.5 opacity-60">@ {shortRef}</span>}
            </span>
            <div className="flex items-center gap-3">
              {actionButtons}
              <button
                type="button"
                onClick={() => { setExpanded(false); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Collapse"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Dialog body: flex-1 + min-h-0 lets it fill remaining height */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* File tree pane */}
            <div className="min-w-[180px] max-w-[260px] border-r border-border/40 overflow-y-auto bg-muted/10 py-2">
              <FileTree
                nodes={treeNodes}
                selectedPath={selectedFile}
                onSelect={handleSelectFile}
              />
            </div>

            {/* Code pane */}
            <div className="flex-1 relative min-w-0">
              <div className="code-explorer-code absolute inset-0 overflow-auto text-sm">
                {codePaneContent}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
