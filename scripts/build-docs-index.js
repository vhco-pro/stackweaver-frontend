#!/usr/bin/env node

// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Build Script for Documentation Index
 *
 * This script:
 * 1. Scans the root `docs/` folder
 * 2. Filters out files matching ignore patterns (analysis, plans, implementation, etc.)
 * 3. Filters out excluded directories
 * 4. Copies filtered files to `frontend/public/docs/` (ephemeral)
 * 5. Copies image files (PNG, JPEG, SVG, etc.) with lossless optimisation via sharp/svgo
 * 6. Generates `frontend/public/docs-index.json` with navigation tree
 */

const fs = require('fs');
const path = require('path');

// Try to load gray-matter, fallback to basic parsing if not available
let matter;
try {
  matter = require('gray-matter');
} catch (e) {
  // If gray-matter not available, use basic frontmatter parsing
  // Handles files with content before frontmatter (e.g. copyright comments)
  matter = (content) => {
    const frontmatterRegex = /(?:^|\n)---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    if (match) {
      const frontmatter = match[1];
      const body = match[2];
      const data = {};
      // Basic YAML parsing for known frontmatter fields
      const fields = ['title', 'description', 'status', 'status_description', 'author', 'priority', 'created', 'updated', 'issue', 'goal'];
      for (const field of fields) {
        const re = new RegExp(`^${field}:\\s*(.+)$`, 'm');
        const fm = frontmatter.match(re);
        if (fm) data[field] = fm[1].trim().replace(/^["']|["']$/g, '');
      }
      // Parse YAML list fields (e.g. covers:)
      const listFields = ['covers'];
      for (const field of listFields) {
        const listRe = new RegExp(`^${field}:[^\\S\\n]*(.*)$`, 'm');
        const listMatch = frontmatter.match(listRe);
        if (listMatch) {
          const inline = listMatch[1].trim();
          if (inline === '[]') {
            data[field] = [];
          } else if (inline.startsWith('[')) {
            // Inline array: [a, b, c]
            data[field] = inline.replace(/^\[|\]$/g, '').split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
          } else {
            // Block list — parse indented items after "field:"
            const items = [];
            const itemRe = new RegExp(`^${field}:.*\\n((?:[^\\S\\n]+-[^\\n]+\\n?)*)`, 'm');
            const blockMatch = frontmatter.match(itemRe);
            if (blockMatch && blockMatch[1]) {
              const lines = blockMatch[1].split('\n');
              for (const line of lines) {
                const m = line.match(/^\s+-\s+["']?(.+?)["']?\s*$/);
                if (m) items.push(m[1]);
              }
            }
            data[field] = items;
          }
        }
      }
      return { data, content: body };
    }
    return { data: {}, content };
  };
}

// Try to load optional image optimisation packages
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  // sharp not available; images will be copied without PNG/JPEG optimisation
}

let svgoOptimize;
try {
  const svgo = require('svgo');
  svgoOptimize = svgo.optimize;
} catch (e) {
  // svgo not available; SVG files will be copied without optimisation
}

// Try to load MiniSearch for search index generation
let MiniSearch;
try {
  // Use the CJS entry point explicitly — the UMD entry (package.json "main") doesn't
  // export correctly under Node 24's module resolution.
  MiniSearch = require(path.join(__dirname, '..', 'frontend', 'node_modules', 'minisearch', 'dist', 'cjs', 'index.cjs'));
} catch (e) {
  // MiniSearch not available; search index won't be generated
}

const DOCS_ROOT = path.join(__dirname, '..', 'docs');
const PUBLIC_DOCS = path.join(__dirname, '..', 'frontend', 'public', 'docs');
const INDEX_FILE = path.join(__dirname, '..', 'frontend', 'public', 'docs-index.json');
const IMAGE_CACHE_FILE = path.join(__dirname, '..', 'frontend', '.image-cache.json');
const IMAGE_CACHE_DIR = path.join(__dirname, '..', 'frontend', '.docs-image-cache');

const SEARCH_INDEX_FILE = path.join(__dirname, '..', 'frontend', 'public', 'docs-search-index.json');

const INTERNAL_DOCS_ROOT = path.join(DOCS_ROOT, 'internal');
const INTERNAL_PUBLIC_DOCS = path.join(__dirname, '..', 'frontend', 'public', 'internal-docs');
const INTERNAL_INDEX_FILE = path.join(__dirname, '..', 'frontend', 'public', 'internal-docs-index.json');
const INTERNAL_SEARCH_INDEX_FILE = path.join(__dirname, '..', 'frontend', 'public', 'internal-docs-search-index.json');
const COVERAGE_INDEX_FILE = path.join(__dirname, '..', 'docs-coverage.json');

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|svg|webp|avif)$/i;

/** Map file extension -> fenced code block language identifier */
const EXT_TO_LANG = {
  '.tf': 'hcl',
  '.tfvars': 'hcl',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.sh': 'bash',
  '.bash': 'bash',
  '.json': 'json',
  '.jsonc': 'jsonc',
  '.toml': 'toml',
  '.go': 'go',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.py': 'python',
  '.md': 'markdown',
  '.sql': 'sql',
  '.env': 'bash',
  '.example': 'bash',
};

function extToLang(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return EXT_TO_LANG[ext] || '';
}

/**
 * Extensions included in code-explorer directory scans (excludes images).
 */
const CODE_EXPLORER_EXTENSIONS = new Set(Object.keys(EXT_TO_LANG));

// Ignore patterns for filenames (case-insensitive, matches anywhere in filename)
const FILE_IGNORE_PATTERNS = [
  /-analysis\.md$/i,
  /_ANALYSIS\.md$/i,
  /\.plan\.md$/i,        // Matches .plan.md anywhere (e.g., add_trivy_*.plan.md)
  /-plan\.md$/i,
  /_PLAN\.md$/i,
  /_plan\.md$/i,
  /implementation.*\.md$/i,
  /IMPLEMENTATION.*\.md$/i,
  /-research\.md$/i,
  /_RESEARCH\.md$/i,
  /-sitrep\.md$/i,
  /_SITREP\.md$/i,
  /-status\.md$/i,
  /_STATUS\.md$/i,
  /-checklist\.md$/i,
  /_CHECKLIST\.md$/i,
  /-audit\.md$/i,
  /_AUDIT\.md$/i,
  /-summary\.md$/i,
  /_SUMMARY\.md$/i,
  /-issue\.md$/i,
  /_old\.md$/i,
  /_v0\.md$/i,
  /_v1\.md$/i,
  /^TODO\.md$/i,
  /\/TODO\.md$/i,        // Also match TODO.md in subdirectories
  /^random\.md$/i,
];

// Ignore patterns for directories (relative to docs root)
const DIR_IGNORE_PATTERNS = [
  'archive',
  'internal',
  'architecture/status',
  'architecture/analysis',
  'architecture/auth/*/research',
  'architecture/auth/*/plans',
  'architecture/auth/*/implementation',
  'architecture/legacy',
];

// Directories to always include (even if parent is ignored)
const ALWAYS_INCLUDE_DIRS = [
  'api-reference',
  'setup',
  'features',
  'ansible',
  'terraform',
  'frontend',
  'security',
];

/**
 * Check if a file path matches any ignore pattern
 */
function shouldIgnoreFile(filePath) {
  const fileName = path.basename(filePath);

  // Always include README.md files (they'll be filtered from tree in buildTree if needed)
  if (fileName.toLowerCase() === 'readme.md') {
    return false;
  }

  // Check filename patterns
  return FILE_IGNORE_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Check if a directory path matches any ignore pattern
 */
function shouldIgnoreDir(dirPath) {
  const relativePath = path.relative(DOCS_ROOT, dirPath);

  // Check if directory matches ignore patterns
  for (const pattern of DIR_IGNORE_PATTERNS) {
    // Handle wildcards
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '[^/]+') + '/?$');
      if (regex.test(relativePath)) {
        return true;
      }
    } else {
      if (relativePath === pattern || relativePath.startsWith(pattern + '/')) {
        // Check if it's in an always-include dir
        const parts = relativePath.split('/');
        for (const alwaysInclude of ALWAYS_INCLUDE_DIRS) {
          if (parts.includes(alwaysInclude)) {
            return false;
          }
        }
        return true;
      }
    }
  }

  return false;
}

/**
 * Recursively scan docs directory and build file tree.
 * Returns { mdFiles, imageFiles } — image files are copied but not indexed.
 *
 * @param {string} dirPath - Directory to scan
 * @param {string} [root] - Root to compute relative paths from (defaults to DOCS_ROOT)
 * @param {boolean} [noFilter] - When true, skip all ignore filters (used for internal docs)
 */
function scanDocsDir(dirPath, root = DOCS_ROOT, noFilter = false) {
  const mdFiles = [];
  const imageFiles = [];

  // Skip if directory should be ignored (unless filtering is disabled)
  if (!noFilter && shouldIgnoreDir(dirPath)) {
    return { mdFiles, imageFiles };
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(root, fullPath);

    if (entry.isDirectory()) {
      // Recursively scan subdirectories
      const sub = scanDocsDir(fullPath, root, noFilter);
      mdFiles.push(...sub.mdFiles);
      imageFiles.push(...sub.imageFiles);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.md')) {
        if (noFilter || !shouldIgnoreFile(relativePath)) {
          mdFiles.push({ relativePath, fullPath });
        }
      } else if (IMAGE_EXTENSIONS.test(entry.name)) {
        imageFiles.push({ relativePath, fullPath });
      }
    }
  }

  return { mdFiles, imageFiles };
}

/**
 * Extract metadata from markdown file
 */
function extractMetadata(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(content);

    return {
      title: parsed.data.title || path.basename(filePath, '.md').replace(/-/g, ' ').replace(/_/g, ' '),
      description: parsed.data.description || '',
      ...parsed.data,
    };
  } catch (error) {
    console.warn(`Warning: Could not parse frontmatter for ${filePath}:`, error.message);
    return {
      title: path.basename(filePath, '.md').replace(/-/g, ' ').replace(/_/g, ' '),
      description: '',
    };
  }
}

/**
 * Build tree structure from markdown file list
 */
function buildTree(files) {
  const tree = [];
  const flat = {};

  // Group files by directory
  const dirMap = new Map();

  for (const file of files) {
    // Exclude root README.md from tree (but keep it in flat index and files for copying)
    // Root README.md is accessible at /docs but not shown in sidebar
    if (file.relativePath === 'README.md') {
      // Still add to flat index so it can be accessed, but skip tree
      const metadata = extractMetadata(file.fullPath);
      flat[file.relativePath] = {
        path: file.relativePath,
        name: path.basename(file.relativePath),
        title: metadata.title,
        description: metadata.description,
        type: 'file',
        ...(metadata.status ? { status: metadata.status } : {}),
      };
      continue;
    }

    const dir = path.dirname(file.relativePath);
    const name = path.basename(file.relativePath);

    if (!dirMap.has(dir)) {
      dirMap.set(dir, []);
    }
    dirMap.get(dir).push({ ...file, name });

    // Add to flat index
    const metadata = extractMetadata(file.fullPath);
    flat[file.relativePath] = {
      path: file.relativePath,
      name,
      title: metadata.title,
      description: metadata.description,
      type: 'file',
      ...(metadata.status ? { status: metadata.status } : {}),
    };
  }

  // Build tree structure
  const processedDirs = new Set();

  for (const [dir, dirFiles] of dirMap.entries()) {
    const parts = dir.split(path.sep).filter(p => p !== '.');
    let currentLevel = tree;

    // Build directory structure
    for (let i = 0; i < parts.length; i++) {
      const dirPath = parts.slice(0, i + 1).join(path.sep);
      const dirName = parts[i];

      if (!processedDirs.has(dirPath)) {
        let dirNode = currentLevel.find(node => node.type === 'directory' && node.name === dirName);

        if (!dirNode) {
          dirNode = {
            type: 'directory',
            name: dirName,
            path: dirPath,
            children: [],
          };
          currentLevel.push(dirNode);
        }

        currentLevel = dirNode.children;
        processedDirs.add(dirPath);
      } else {
        const dirNode = currentLevel.find(node => node.type === 'directory' && node.name === dirName);
        if (dirNode) {
          currentLevel = dirNode.children;
        }
      }
    }

    // Add files to current level
    for (const file of dirFiles) {
      const metadata = extractMetadata(file.fullPath);
      currentLevel.push({
        type: 'file',
        name: file.name,
        path: file.relativePath,
        title: metadata.title,
        description: metadata.description,
        ...(metadata.status ? { status: metadata.status } : {}),
      });
    }
  }

  // Sort: directories first, then files, both alphabetically
  function sortTree(nodes) {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    for (const node of nodes) {
      if (node.type === 'directory' && node.children) {
        sortTree(node.children);
      }
    }
  }

  sortTree(tree);

  return { tree, flat };
}

/**
 * Compute a cache key for a source file based on mtime and size.
 */
function fileCacheKey(filePath) {
  const stat = fs.statSync(filePath);
  return `${stat.mtimeMs}-${stat.size}`;
}

/**
 * Load the image cache manifest.
 */
function loadImageCache() {
  try {
    if (fs.existsSync(IMAGE_CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(IMAGE_CACHE_FILE, 'utf-8'));
    }
  } catch (e) {
    // Ignore; treat as empty cache
  }
  return {};
}

/**
 * Save the image cache manifest.
 */
function saveImageCache(cache) {
  try {
    fs.writeFileSync(IMAGE_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Warning: Could not save image cache manifest:', e.message);
  }
}

/**
 * Copy all files to public directory.
 * Image files are losslessly optimised (SVG via svgo, PNG/JPEG via sharp).
 * Optimised images are cached in IMAGE_CACHE_DIR to speed up incremental builds.
 * Both mdFiles and imageFiles should be passed as a combined array; only mdFiles
 * are passed to buildTree for the navigation index.
 *
 * @param {{ relativePath: string, fullPath: string }[]} files
 * @param {string} [outputDir] - Destination directory (defaults to PUBLIC_DOCS)
 */
async function copyFiles(files, outputDir = PUBLIC_DOCS) {
  // Clean public docs directory
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });

  const imageCache = loadImageCache();
  const newCache = {};
  let imageCount = 0;
  let imageCacheHits = 0;

  for (const file of files) {
    const destPath = path.join(outputDir, file.relativePath);
    const destDir = path.dirname(destPath);
    fs.mkdirSync(destDir, { recursive: true });

    if (file.relativePath.endsWith('.md')) {
      // Process file inclusions (<<< directives); keep frontmatter for MarkdownRenderer to parse
      const content = fs.readFileSync(file.fullPath, 'utf-8');
      const processed = processFileInclusions(content, file.fullPath);
      fs.writeFileSync(destPath, processed.trimStart(), 'utf-8');
    } else if (IMAGE_EXTENSIONS.test(file.relativePath)) {
      imageCount++;
      const cacheKey = fileCacheKey(file.fullPath);
      newCache[file.relativePath] = cacheKey;

      const cachedPath = path.join(IMAGE_CACHE_DIR, file.relativePath);

      // Cache hit: source file unchanged and optimised copy exists
      if (imageCache[file.relativePath] === cacheKey && fs.existsSync(cachedPath)) {
        imageCacheHits++;
        fs.copyFileSync(cachedPath, destPath);
        continue;
      }

      // Cache miss: optimise and store result
      const ext = path.extname(file.relativePath).toLowerCase();
      const cachedDir = path.dirname(cachedPath);
      fs.mkdirSync(cachedDir, { recursive: true });

      if (ext === '.svg' && svgoOptimize) {
        try {
          const svgContent = fs.readFileSync(file.fullPath, 'utf-8');
          const result = svgoOptimize(svgContent, { path: file.fullPath, multipass: true });
          fs.writeFileSync(destPath, result.data);
          fs.writeFileSync(cachedPath, result.data);
        } catch (e) {
          fs.copyFileSync(file.fullPath, destPath);
          fs.copyFileSync(file.fullPath, cachedPath);
        }
      } else if (ext === '.png' && sharp) {
        try {
          await sharp(file.fullPath).png({ compressionLevel: 9, effort: 10 }).toFile(destPath);
          fs.copyFileSync(destPath, cachedPath);
        } catch (e) {
          fs.copyFileSync(file.fullPath, destPath);
          fs.copyFileSync(file.fullPath, cachedPath);
        }
      } else if ((ext === '.jpg' || ext === '.jpeg') && sharp) {
        try {
          await sharp(file.fullPath).jpeg({ quality: 100, mozjpeg: true }).toFile(destPath);
          fs.copyFileSync(destPath, cachedPath);
        } catch (e) {
          fs.copyFileSync(file.fullPath, destPath);
          fs.copyFileSync(file.fullPath, cachedPath);
        }
      } else {
        fs.copyFileSync(file.fullPath, destPath);
        fs.copyFileSync(file.fullPath, cachedPath);
      }
    } else {
      fs.copyFileSync(file.fullPath, destPath);
    }
  }

  saveImageCache(newCache);

  const mdCount = files.length - imageCount;
  if (imageCount > 0) {
    const optimised = imageCount - imageCacheHits;
    console.log(`✅ Copied ${mdCount} docs + ${imageCount} images (${optimised} optimised, ${imageCacheHits} cached) to ${path.relative(process.cwd(), outputDir)}`);
  } else {
    console.log(`✅ Copied ${files.length} files to ${path.relative(process.cwd(), outputDir)}`);
  }
}

/**
 * Process `<<< ./path/to/file` file-inclusion directives in a markdown string.
 * Each matching line is replaced with a fenced code block containing the file contents.
 * Includes a path-traversal guard: resolved paths must stay within DOCS_ROOT.
 *
 * @param {string} content - Raw markdown file content
 * @param {string} markdownFilePath - Absolute path to the source markdown file
 * @returns {string} Processed markdown content
 */
function processFileInclusions(content, markdownFilePath) {
  const markdownDir = path.dirname(markdownFilePath);
  const lines = content.split('\n');
  const result = [];

  for (const line of lines) {
    const match = /^<<<\s+(\S+)$/.exec(line.trim());
    if (!match) {
      result.push(line);
      continue;
    }

    let filePath = match[1];

    // Parse optional line-range suffix: path#L10-L50
    let lineStart = null;
    let lineEnd = null;
    const rangeMatch = /^(.+)#L(\d+)-L?(\d+)$/.exec(filePath);
    if (rangeMatch) {
      filePath = rangeMatch[1];
      lineStart = parseInt(rangeMatch[2], 10);
      lineEnd = parseInt(rangeMatch[3], 10);
    }

    // Strip leading ./
    if (filePath.startsWith('./')) filePath = filePath.slice(2);

    const resolved = path.resolve(markdownDir, filePath);

    // Path traversal guard
    if (!resolved.startsWith(DOCS_ROOT)) {
      console.warn(`⚠ Skipping <<< inclusion outside docs/: ${filePath}`);
      result.push('```');
      result.push(`⚠ Could not include ./${filePath} — path outside docs/`);
      result.push('```');
      continue;
    }

    let fileContent;
    try {
      fileContent = fs.readFileSync(resolved, 'utf-8');
    } catch {
      console.warn(`⚠ Could not include ${filePath} — file not found`);
      result.push('```');
      result.push(`⚠ Could not include ./${filePath} — file not found`);
      result.push('```');
      continue;
    }

    // Apply line range if specified
    if (lineStart !== null && lineEnd !== null) {
      const fileLines = fileContent.split('\n');
      fileContent = fileLines.slice(lineStart - 1, lineEnd).join('\n');
    }

    const lang = extToLang(filePath);
    result.push('```' + lang);
    result.push(fileContent.trimEnd());
    result.push('```');
  }

  return result.join('\n');
}

/**
 * Find all matches of a directive pattern in markdown content, skipping matches
 * that appear inside fenced code blocks (``` or ````).
 *
 * @param {string} content - Raw markdown content
 * @param {RegExp} pattern - RegExp with global+multiline flags. Must have exactly one capture group.
 * @returns {{ match: string, index: number }[]} Array of capture group values with their indices
 */
function findDirectivesOutsideCodeBlocks(content, pattern) {
  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeBlockFence = '';
  const results = [];

  for (const line of lines) {
    const trimmed = line.trimStart();
    // Track fenced code blocks (``` or ```` or more)
    const fenceMatch = /^(`{3,}|~{3,})/.exec(trimmed);
    if (fenceMatch) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockFence = fenceMatch[1].charAt(0).repeat(fenceMatch[1].length);
      } else if (trimmed.startsWith(codeBlockFence) && trimmed.slice(codeBlockFence.length).trim() === '') {
        inCodeBlock = false;
        codeBlockFence = '';
      }
      continue;
    }

    if (inCodeBlock) continue;

    // Reset lastIndex since we're testing line by line
    pattern.lastIndex = 0;
    const m = pattern.exec(line);
    if (m) {
      results.push({ match: m[1] });
    }
  }

  return results;
}

/**
 * Scan all processed markdown files for `::: code-explorer <path>` directives.
 * For each directive:
 *   1. Resolve the directory relative to the markdown file (local) or fetch from GitHub.
 *   2. Copy all code files to outputDir/<relative-path>/.
 *   3. Write a <relative-path>.explorer.json manifest.
 *
 * Must be called AFTER copyFiles() so outputDir already exists.
 *
 * @param {{ relativePath: string, fullPath: string }[]} mdFiles
 * @param {string} [outputDir] - Destination directory (defaults to PUBLIC_DOCS)
 * @param {string} [docsRoot] - Root for computing relative paths (defaults to DOCS_ROOT)
 */
async function processCodeExplorers(mdFiles, outputDir = PUBLIC_DOCS, docsRoot = DOCS_ROOT) {
  let directoriesProcessed = 0;

  for (const file of mdFiles) {
    let content;
    try {
      content = fs.readFileSync(file.fullPath, 'utf-8');
    } catch {
      continue;
    }

    const markdownDir = path.dirname(file.fullPath);
    const directivePattern = /^:::\s*code-explorer\s+(\S+)/i;
    const directives = findDirectivesOutsideCodeBlocks(content, directivePattern);

    for (const directive of directives) {
      const rawPath = directive.match;

      // Handle github: prefix — supports both github:org/repo/path@ref and github:org/repo@ref (repo root)
      if (rawPath.startsWith('github:')) {
        // Try with path first, then without path (repo root)
        let ghMatch = /^github:([^/]+)\/([^/]+)\/(.+?)(?:@(.+))?$/.exec(rawPath);
        let specPath = '';
        if (ghMatch) {
          specPath = ghMatch[3];
        } else {
          // Repo root: github:org/repo@ref or github:org/repo
          ghMatch = /^github:([^/]+)\/([^@]+?)(?:@(.+))?$/.exec(rawPath);
          if (!ghMatch) {
            console.warn(`⚠ Invalid github: code-explorer spec: ${rawPath}`);
            continue;
          }
          specPath = '';
        }
        const spec = {
          org: ghMatch[1],
          repo: ghMatch[2],
          path: specPath,
          ref: (specPath ? ghMatch[4] : ghMatch[3]) || 'main',
        };
        const ghDestDir = spec.path
          ? path.join(outputDir, '_github', spec.org, spec.repo, spec.ref, spec.path)
          : path.join(outputDir, '_github', spec.org, spec.repo, spec.ref);
        const relativeDir = path.relative(outputDir, ghDestDir);
        try {
          const manifestFiles = await fetchGitHubExplorer(spec, ghDestDir);
          // Add per-file GitHub URLs
          const filesWithUrls = manifestFiles.map(f => ({
            ...f,
            url: spec.path
              ? `https://github.com/${spec.org}/${spec.repo}/blob/${spec.ref}/${spec.path}/${f.path}`
              : `https://github.com/${spec.org}/${spec.repo}/blob/${spec.ref}/${f.path}`,
          }));
          const manifest = {
            root: spec.path ? (spec.path.split('/').pop() || spec.path) : spec.repo,
            source: {
              type: 'github',
              org: spec.org,
              repo: spec.repo,
              path: spec.path,
              ref: spec.ref,
              url: spec.path
                ? `https://github.com/${spec.org}/${spec.repo}/tree/${spec.ref}/${spec.path}`
                : `https://github.com/${spec.org}/${spec.repo}/tree/${spec.ref}`,
            },
            files: filesWithUrls,
          };
          const manifestPath = path.join(outputDir, `${relativeDir}.explorer.json`);
          fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
          fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
          directoriesProcessed++;
          const displayPath = spec.path ? `${spec.org}/${spec.repo}/${spec.path}` : `${spec.org}/${spec.repo}`;
          console.log(`   ✅ Code explorer (GitHub): ${displayPath}@${spec.ref} (${manifestFiles.length} files)`);
        } catch (err) {
          console.warn(`⚠ Failed to fetch GitHub code-explorer ${rawPath}: ${err.message}`);
        }
        continue;
      }

      // Local directory
      let dirPath = rawPath;
      if (dirPath.startsWith('./')) dirPath = dirPath.slice(2);

      const resolvedDir = path.resolve(markdownDir, dirPath);

      // Path traversal guard
      if (!resolvedDir.startsWith(DOCS_ROOT)) {
        console.warn(`⚠ Skipping code-explorer outside docs/: ${dirPath}`);
        continue;
      }

      if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
        console.warn(`⚠ code-explorer directory not found: ${resolvedDir}`);
        continue;
      }

      const relativeDir = path.relative(docsRoot, resolvedDir);
      const manifestFiles = [];

      // Recursively scan the directory for code files
      function scanExplorerDir(dir, baseDir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') && !entry.name.startsWith('.env')) continue;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scanExplorerDir(fullPath, baseDir);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (!CODE_EXPLORER_EXTENSIONS.has(ext) && !IMAGE_EXTENSIONS.test(entry.name)) continue;
            const relPath = path.relative(baseDir, fullPath);
            const lang = extToLang(entry.name);

            // Copy to outputDir/<relativeDir>/<relPath>
            const destPath = path.join(outputDir, relativeDir, relPath);
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.copyFileSync(fullPath, destPath);

            manifestFiles.push({ path: relPath.replace(/\\/g, '/'), lang });
          }
        }
      }

      scanExplorerDir(resolvedDir, resolvedDir);

      // Write manifest
      const manifest = {
        root: path.basename(resolvedDir),
        files: manifestFiles,
      };
      const manifestPath = path.join(outputDir, `${relativeDir}.explorer.json`);
      fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

      directoriesProcessed++;
      console.log(`   ✅ Code explorer: ${relativeDir} (${manifestFiles.length} files)`);
    }
  }

  if (directoriesProcessed > 0) {
    console.log(`✅ Processed ${directoriesProcessed} code explorer directive(s)\n`);
  }
}

/**
 * Fetch a directory from GitHub and copy files to destBase.
 * Returns the manifest files array.
 *
 * @param {{ org: string, repo: string, path: string, ref: string }} spec
 * @param {string} destBase - Absolute local path to write files into
 * @returns {Promise<{ path: string, lang: string }[]>}
 */
async function fetchGitHubExplorer(spec, destBase) {
  const headers = process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'User-Agent': 'stackweaver-docs-builder' }
    : { 'User-Agent': 'stackweaver-docs-builder' };

  const manifestFiles = [];

  async function fetchDir(apiUrl, localRelPath) {
    const res = await fetch(apiUrl, { headers });
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status} for ${apiUrl}`);
    }
    const entries = await res.json();
    for (const entry of entries) {
      const entryRelPath = localRelPath ? `${localRelPath}/${entry.name}` : entry.name;
      if (entry.type === 'dir') {
        await fetchDir(entry.url, entryRelPath);
      } else if (entry.type === 'file') {
        const ext = path.extname(entry.name).toLowerCase();
        if (!CODE_EXPLORER_EXTENSIONS.has(ext)) continue;
        const raw = await fetch(entry.download_url, { headers });
        if (!raw.ok) continue;
        const text = await raw.text();
        const dest = path.join(destBase, entryRelPath);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, text, 'utf-8');
        manifestFiles.push({ path: entryRelPath.replace(/\\/g, '/'), lang: extToLang(entry.name) });
      }
    }
  }

  const contentsPath = spec.path || '';
  const apiBase = contentsPath
    ? `https://api.github.com/repos/${spec.org}/${spec.repo}/contents/${contentsPath}?ref=${spec.ref}`
    : `https://api.github.com/repos/${spec.org}/${spec.repo}/contents?ref=${spec.ref}`;
  await fetchDir(apiBase, '');
  return manifestFiles;
}

/**
 * Simple string hash (must match the frontend snippetHash function).
 * @param {string} str
 * @returns {string}
 */
function snippetHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

// Matches: https://github.com/{org}/{repo}/blob/{ref}/{path}#L{start}-L{end}
const GITHUB_SNIPPET_RE = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+?)(?:#L(\d+)(?:-L(\d+))?)?$/;

/**
 * Process ::: code-snippet directives in markdown files.
 * Fetches referenced GitHub files at build time and writes .snippet.json manifests.
 *
 * @param {{ relativePath: string, fullPath: string }[]} mdFiles
 * @param {string} [outputDir]
 */
async function processCodeSnippets(mdFiles, outputDir = PUBLIC_DOCS) {
  const headers = process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'User-Agent': 'stackweaver-docs-builder' }
    : { 'User-Agent': 'stackweaver-docs-builder' };

  let snippetsProcessed = 0;
  // Deduplicate: same URL might appear in multiple docs
  const processed = new Set();

  for (const file of mdFiles) {
    let content;
    try {
      content = fs.readFileSync(file.fullPath, 'utf-8');
    } catch {
      continue;
    }

    const directivePattern = /^:::\s*code-snippet\s+(\S+)/i;
    const directives = findDirectivesOutsideCodeBlocks(content, directivePattern);

    for (const directive of directives) {
      const url = directive.match;
      if (processed.has(url)) continue;
      processed.add(url);

      const ghMatch = GITHUB_SNIPPET_RE.exec(url);
      if (!ghMatch) {
        console.warn(`⚠ Invalid code-snippet URL (must be a GitHub blob permalink): ${url}`);
        continue;
      }

      const org = ghMatch[1];
      const repo = ghMatch[2];
      const ref = ghMatch[3];
      const filePath = ghMatch[4];
      const startLine = ghMatch[5] ? parseInt(ghMatch[5], 10) : null;
      const endLine = ghMatch[6] ? parseInt(ghMatch[6], 10) : null;
      const lang = extToLang(filePath);

      // Fetch raw file content
      const rawUrl = `https://raw.githubusercontent.com/${org}/${repo}/${ref}/${filePath}`;
      try {
        const res = await fetch(rawUrl, { headers });
        if (!res.ok) {
          console.warn(`⚠ Failed to fetch code-snippet ${url}: HTTP ${res.status} for ${rawUrl}`);
          continue;
        }
        const fullContent = await res.text();

        // Extract line range
        let snippetContent;
        if (startLine !== null) {
          const lines = fullContent.split('\n');
          const end = endLine !== null ? endLine : startLine;
          snippetContent = lines.slice(startLine - 1, end).join('\n');
        } else {
          snippetContent = fullContent;
        }

        const snippet = {
          org,
          repo,
          ref,
          path: filePath,
          startLine,
          endLine: endLine !== null ? endLine : startLine,
          lang,
          content: snippetContent,
          url,
        };

        const hash = snippetHash(url);
        const snippetDir = path.join(outputDir, '_snippets');
        fs.mkdirSync(snippetDir, { recursive: true });
        fs.writeFileSync(
          path.join(snippetDir, `${hash}.snippet.json`),
          JSON.stringify(snippet, null, 2),
          'utf-8'
        );
        snippetsProcessed++;
        const lineInfo = startLine ? ` L${startLine}${endLine ? `-L${endLine}` : ''}` : '';
        console.log(`   ✅ Code snippet: ${org}/${repo}/${filePath}@${ref}${lineInfo}`);
      } catch (err) {
        console.warn(`⚠ Failed to fetch code-snippet ${url}: ${err.message}`);
      }
    }
  }

  if (snippetsProcessed > 0) {
    console.log(`✅ Processed ${snippetsProcessed} code snippet(s)\n`);
  }
}

/**
 * Generate the markdown for the ## Contents section of a directory.
 * Subdirectories (with README.md) are listed first, then files.
 * Files without a description field are omitted.
 *
 * @param {string} dirPath - Absolute path to the directory
 * @returns {string|null} Markdown string starting with "## Contents\n", or null on error
 */
function generateContentsTable(dirPath) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return null;
  }

  const rows = [];

  // Subdirectories that have a README.md, sorted alphabetically
  const subdirs = entries
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  for (const subdir of subdirs) {
    const readmePath = path.join(dirPath, subdir, 'README.md');
    if (!fs.existsSync(readmePath)) continue;
    const meta = extractMetadata(readmePath);
    rows.push(`| [${subdir}/](./${subdir}/) | ${meta.description || ''} |`);
  }

  // .md files directly in this directory — exclude README.md and _ prefix
  const files = entries
    .filter(e => e.isFile() && e.name.endsWith('.md') && e.name.toLowerCase() !== 'readme.md' && !e.name.startsWith('_'))
    .map(e => e.name)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  for (const filename of files) {
    const filePath = path.join(dirPath, filename);
    let parsed;
    try {
      parsed = matter(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      continue;
    }
    const description = parsed.data.description;
    if (!description) continue;
    // Use explicit title as link text when present, filename otherwise
    const linkText = parsed.data.title || filename;
    rows.push(`| [${linkText}](./${filename}) | ${description} |`);
  }

  if (rows.length === 0) {
    return '## Contents\n\n_No documents found._\n';
  }

  return '## Contents\n\n| Name | Description |\n|------|-------------|\n' + rows.join('\n') + '\n';
}

/**
 * Update the ## Contents section of a README.md in-place.
 * Splices only the Contents section; any sections after it are preserved.
 * If no ## Contents heading is found, logs a warning and skips.
 *
 * @param {string} dirPath - Absolute path to the directory containing README.md
 */
function updateReadme(dirPath) {
  const readmePath = path.join(dirPath, 'README.md');
  if (!fs.existsSync(readmePath)) return;

  const content = fs.readFileSync(readmePath, 'utf-8');
  const lines = content.split('\n');

  // Find the ## Contents heading
  const contentsIdx = lines.findIndex(l => /^## Contents\s*$/.test(l));
  if (contentsIdx === -1) {
    const rel = path.relative(DOCS_ROOT, readmePath);
    console.log(`   ⚠ No ## Contents in ${rel} — skipping`);
    return;
  }

  // Find the next sibling ## heading (or EOF)
  const nextHeaderIdx = lines.findIndex((l, i) => i > contentsIdx && /^## /.test(l));
  const endIdx = nextHeaderIdx === -1 ? lines.length : nextHeaderIdx;

  const newTable = generateContentsTable(dirPath);
  if (newTable === null) return;

  const before = lines.slice(0, contentsIdx);
  const after = endIdx < lines.length ? lines.slice(endIdx) : [];
  const tableLines = newTable.trimEnd().split('\n');

  const parts = [...before, ...tableLines];
  if (after.length > 0) parts.push('', ...after);

  // Preserve trailing newline
  const newContent = parts.join('\n') + (content.endsWith('\n') ? '\n' : '');

  if (newContent !== content) {
    fs.writeFileSync(readmePath, newContent, 'utf-8');
    console.log(`   ✅ ${path.relative(DOCS_ROOT, readmePath)}`);
  }
}

/**
 * Walk all directories under rootDir and update their README.md Contents sections.
 *
 * @param {string} rootDir
 */
function updateAllReadmes(rootDir) {
  function walk(dir) {
    updateReadme(dir);
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name));
      }
    }
  }
  walk(rootDir);
}

/**
 * Strip markdown syntax from content, returning plain text suitable for search indexing.
 */
function stripMarkdown(content) {
  return content
    // Remove frontmatter
    .replace(/^---[\s\S]*?---\s*/m, '')
    // Remove custom directives
    .replace(/^:::.*$/gm, '')
    // Remove code fence markers (keep content inside)
    .replace(/^```\w*\s*$/gm, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, '')
    // Remove images
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    // Remove links (keep link text)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Remove heading markers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove emphasis markers
    .replace(/(\*{1,3}|_{1,3}|~~)(.*?)\1/g, '$2')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Remove blockquote markers
    .replace(/^>\s?/gm, '')
    // Remove table formatting
    .replace(/\|/g, ' ')
    .replace(/^[-:]+$/gm, '')
    // Collapse whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract ## and ### headings from markdown content as a space-separated string.
 */
function extractHeadings(content) {
  const headings = [];
  const regex = /^#{2,3}\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    headings.push(match[1].replace(/[*_`]/g, '').trim());
  }
  return headings.join(' ');
}

/**
 * Extract structured headings with slugified anchors for section-level search results.
 * Returns JSON string of [{text, anchor, level}].
 */
function extractStructuredHeadings(content) {
  const headings = [];
  const regex = /^(#{2,3})\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const text = match[2].replace(/[*_`]/g, '').trim();
    // Slugify to match the anchor IDs generated by MarkdownRenderer
    const anchor = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    headings.push({ text, anchor, level: match[1].length });
  }
  return JSON.stringify(headings);
}

/**
 * Build a MiniSearch index from a list of scanned markdown files.
 * Returns the serialised JSON string, or null if MiniSearch is not available.
 *
 * @param {{ relativePath: string, fullPath: string }[]} mdFiles
 * @param {string} outputFile - Absolute path to write the search index
 */
function buildSearchIndex(mdFiles, outputFile) {
  if (!MiniSearch) {
    console.log('   ⚠ minisearch not installed, skipping search index');
    return;
  }

  const searchIndex = new MiniSearch({
    fields: ['title', 'description', 'headings', 'body'],
    storeFields: ['title', 'description', 'path', 'sectionHeadings'],
    searchOptions: {
      boost: { title: 3, description: 2, headings: 1.5 },
      fuzzy: 0.2,
      prefix: true,
    },
  });

  for (const file of mdFiles) {
    const content = fs.readFileSync(file.fullPath, 'utf-8');
    const parsed = matter(content);
    const plainBody = stripMarkdown(parsed.content).slice(0, 10000);
    const headings = extractHeadings(parsed.content);
    const sectionHeadings = extractStructuredHeadings(parsed.content);

    searchIndex.add({
      id: file.relativePath,
      path: file.relativePath,
      title: parsed.data.title || path.basename(file.relativePath, '.md').replace(/[-_]/g, ' '),
      description: parsed.data.description || '',
      headings,
      sectionHeadings,
      body: plainBody,
    });
  }

  fs.writeFileSync(outputFile, JSON.stringify(searchIndex), 'utf-8');
  console.log(`✅ Search index written to ${path.relative(process.cwd(), outputFile)} (${mdFiles.length} docs)`);
}

/**
 * Build internal docs — scans docs/internal/ with no filtering and outputs to
 * frontend/public/internal-docs/ + internal-docs-index.json.
 */
async function buildInternalDocs() {
  if (!fs.existsSync(INTERNAL_DOCS_ROOT)) {
    console.log('\n📁 No internal docs directory found, skipping.\n');
    return;
  }

  console.log('\n📁 Building internal documentation index...\n');

  console.log('📝 Updating README Contents sections...');
  updateAllReadmes(INTERNAL_DOCS_ROOT);
  console.log('');

  console.log('🔍 Scanning docs/internal directory...');
  const { mdFiles, imageFiles } = scanDocsDir(INTERNAL_DOCS_ROOT, INTERNAL_DOCS_ROOT, true);
  console.log(`   Found ${mdFiles.length} documentation files and ${imageFiles.length} images\n`);

  console.log('🌳 Building navigation tree...');
  const { tree, flat } = buildTree(mdFiles);

  console.log('📋 Copying files to public directory...');
  await copyFiles([...mdFiles, ...imageFiles], INTERNAL_PUBLIC_DOCS);

  console.log('🗂  Processing code explorer directives...');
  await processCodeExplorers(mdFiles, INTERNAL_PUBLIC_DOCS, INTERNAL_DOCS_ROOT);

  console.log('💾 Generating internal docs index file...');
  const index = { tree, flat, generated: new Date().toISOString() };
  fs.writeFileSync(INTERNAL_INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`✅ Internal index written to ${path.relative(process.cwd(), INTERNAL_INDEX_FILE)}\n`);

  console.log('🔎 Building internal search index...');
  buildSearchIndex(mdFiles, INTERNAL_SEARCH_INDEX_FILE);
}

/**
 * Main execution
 */
/**
 * Build a coverage index mapping code-area globs to the docs that cover them.
 * Scans both user-facing and internal docs for the `covers` frontmatter field.
 * Output: { "glob": ["docs/path1.md", "docs/path2.md"], ... }
 */
function buildCoverageIndex() {
  const coverageMap = {};
  const allDocDirs = [DOCS_ROOT]; // scan everything under docs/ (including internal)

  for (const docDir of allDocDirs) {
    const walkDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.name.endsWith('.md')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const parsed = matter(content);
            const covers = parsed.data.covers;
            if (Array.isArray(covers) && covers.length > 0) {
              const relPath = path.relative(path.join(__dirname, '..'), fullPath);
              for (const glob of covers) {
                if (!coverageMap[glob]) coverageMap[glob] = [];
                coverageMap[glob].push(relPath);
              }
            }
          } catch (e) {
            // skip unparseable files
          }
        }
      }
    };
    walkDir(docDir);
  }

  // Sort each doc list for deterministic output
  for (const glob of Object.keys(coverageMap)) {
    coverageMap[glob].sort();
  }

  // Sort by glob key
  const sorted = {};
  for (const key of Object.keys(coverageMap).sort()) {
    sorted[key] = coverageMap[key];
  }

  fs.writeFileSync(COVERAGE_INDEX_FILE, JSON.stringify(sorted, null, 2) + '\n', 'utf-8');
  const totalGlobs = Object.keys(sorted).length;
  const totalDocs = new Set(Object.values(sorted).flat()).size;
  console.log(`✅ Coverage index written to ${path.relative(process.cwd(), COVERAGE_INDEX_FILE)} (${totalGlobs} globs → ${totalDocs} docs)\n`);
}

async function main() {
  console.log('📚 Building documentation index...\n');

  // Scan docs directory
  console.log('🔍 Scanning docs directory...');
  const { mdFiles, imageFiles } = scanDocsDir(DOCS_ROOT);
  console.log(`   Found ${mdFiles.length} documentation files and ${imageFiles.length} images (after filtering)\n`);

  // Build tree structure (markdown files only)
  console.log('🌳 Building navigation tree...');
  const { tree, flat } = buildTree(mdFiles);

  // Copy all files to public directory (md + images combined in one pass)
  console.log('📋 Copying files to public directory...');
  await copyFiles([...mdFiles, ...imageFiles]);

  // Process code-explorer directives: copy example files and generate manifests
  console.log('🗂  Processing code explorer directives...');
  await processCodeExplorers(mdFiles);

  // Process code-snippet directives: fetch GitHub file excerpts
  console.log('📎 Processing code snippet directives...');
  await processCodeSnippets(mdFiles);

  // Generate index JSON
  console.log('💾 Generating index file...');
  const index = {
    tree,
    flat,
    generated: new Date().toISOString(),
  };

  const indexPath = path.relative(process.cwd(), INDEX_FILE);
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`✅ Index written to ${indexPath}\n`);

  // Build search index for public docs
  console.log('🔎 Building search index...');
  buildSearchIndex(mdFiles, SEARCH_INDEX_FILE);

  // Build internal docs
  await buildInternalDocs();

  // Build coverage index (all docs — user-facing + internal)
  console.log('🗺  Building docs coverage index...');
  buildCoverageIndex();

  console.log('✨ Documentation build complete!');
}

// Run if executed directly
if (require.main === module) {
  main().catch(err => {
    console.error('❌ Error building documentation index:', err);
    process.exit(1);
  });
}

module.exports = { main };
