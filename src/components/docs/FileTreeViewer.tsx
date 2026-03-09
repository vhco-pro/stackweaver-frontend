// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { File, Folder } from 'lucide-react';
import type { ReactNode } from 'react';
import { getFileTypeIcon } from './fileTypeIcons';

interface TreeLine {
  name: string;
  depth: number;
  isDir: boolean;
}

function getFileIcon(name: string): ReactNode {
  const icon = getFileTypeIcon(name);
  if (icon) {
    return <img src={icon} alt="" aria-hidden className="h-[1.125rem] w-[1.125rem] shrink-0" loading="lazy" style={{ margin: 0, height: '1.125rem' }} />;
  }
  return <File className="h-[1.125rem] w-[1.125rem] shrink-0 text-muted-foreground" />;
}

/**
 * Parse standard tree(1) output format into a flat list of annotated lines.
 * Handles: ├──, └──, │ connectors as well as plain indented text.
 */
function parseTreeContent(content: string): TreeLine[] {
  const lines = content.split('\n');
  const result: TreeLine[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    // Root / top-level entry with no connector characters
    if (!/[├└│]/.test(line)) {
      const name = line.trim();
      if (name) {
        result.push({ name, depth: 0, isDir: name.endsWith('/') });
      }
      continue;
    }

    // Standard tree(1) format: [│   ]* [├└]── name
    const match = /^((?:[│ ]{4})*)[├└]── (.+)$/.exec(line);
    if (match) {
      const prefix = match[1];
      const name = match[2].trim();
      const depth = prefix.length / 4 + 1;
      result.push({ name, depth, isDir: name.endsWith('/') });
      continue;
    }

    // Fallback: strip connector chars and derive depth from leading whitespace
    const stripped = line.replace(/[├└─│]/g, ' ').trimEnd();
    const trimmed = stripped.trim();
    if (trimmed) {
      const leadingSpaces = stripped.length - stripped.trimStart().length;
      const depth = Math.floor(leadingSpaces / 4);
      result.push({ name: trimmed, depth, isDir: trimmed.endsWith('/') });
    }
  }

  return result;
}

interface FileTreeViewerProps {
  content: string;
}

export function FileTreeViewer({ content }: FileTreeViewerProps) {
  const lines = parseTreeContent(content);

  return (
    <div className="not-prose my-4 bg-muted/40 rounded-md border border-border/40 p-4 font-mono text-sm">
      <ul className="space-y-0.5" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {lines.map((line, i) => (
          <li
            key={i}
            className="flex items-center gap-1.5 text-muted-foreground"
            style={{ paddingLeft: `${line.depth * 1.25}rem`, margin: 0 }}
          >
            {line.isDir
              ? <Folder className="h-[1.125rem] w-[1.125rem] shrink-0 text-amber-400" />
              : getFileIcon(line.name)
            }
            <span>{line.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
