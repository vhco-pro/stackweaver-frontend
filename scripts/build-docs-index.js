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
 * 5. Generates `frontend/public/docs-index.json` with navigation tree
 */

const fs = require('fs');
const path = require('path');

// Try to load gray-matter, fallback to basic parsing if not available
let matter;
try {
  matter = require('gray-matter');
} catch (e) {
  // If gray-matter not available, use basic frontmatter parsing
  matter = (content) => {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    if (match) {
      const frontmatter = match[1];
      const body = match[2];
      const data = {};
      // Basic YAML parsing for title and description only
      const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);
      const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
      if (titleMatch) data.title = titleMatch[1].trim().replace(/^["']|["']$/g, '');
      if (descMatch) data.description = descMatch[1].trim().replace(/^["']|["']$/g, '');
      return { data, content: body };
    }
    return { data: {}, content };
  };
}

const DOCS_ROOT = path.join(__dirname, '..', 'docs');
const PUBLIC_DOCS = path.join(__dirname, '..', 'frontend', 'public', 'docs');
const INDEX_FILE = path.join(__dirname, '..', 'frontend', 'public', 'docs-index.json');

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
 * Recursively scan docs directory and build file tree
 */
function scanDocsDir(dirPath, basePath = '') {
  const files = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  // Skip if directory should be ignored
  if (shouldIgnoreDir(dirPath)) {
    return [];
  }
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(DOCS_ROOT, fullPath);
    
    if (entry.isDirectory()) {
      // Recursively scan subdirectories
      const subFiles = scanDocsDir(fullPath, relativePath);
      files.push(...subFiles);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      // Check if file should be ignored
      if (!shouldIgnoreFile(relativePath)) {
        files.push({
          relativePath,
          fullPath,
        });
      }
    }
  }
  
  return files;
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
 * Build tree structure from file list
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
 * Copy files to public directory
 */
function copyFiles(files) {
  // Clean public docs directory
  if (fs.existsSync(PUBLIC_DOCS)) {
    fs.rmSync(PUBLIC_DOCS, { recursive: true, force: true });
  }
  fs.mkdirSync(PUBLIC_DOCS, { recursive: true });
  
  // Copy each file, preserving directory structure
  for (const file of files) {
    const destPath = path.join(PUBLIC_DOCS, file.relativePath);
    const destDir = path.dirname(destPath);
    
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(file.fullPath, destPath);
  }
  
  console.log(`✅ Copied ${files.length} files to ${path.relative(process.cwd(), PUBLIC_DOCS)}`);
}

/**
 * Main execution
 */
function main() {
  console.log('📚 Building documentation index...\n');
  
  // Scan docs directory
  console.log('🔍 Scanning docs directory...');
  const files = scanDocsDir(DOCS_ROOT);
  console.log(`   Found ${files.length} documentation files (after filtering)\n`);
  
  // Build tree structure
  console.log('🌳 Building navigation tree...');
  const { tree, flat } = buildTree(files);
  
  // Copy files to public directory
  console.log('📋 Copying files to public directory...');
  copyFiles(files);
  
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
  
  console.log('✨ Documentation build complete!');
}

// Run if executed directly
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('❌ Error building documentation index:', error);
    process.exit(1);
  }
}

module.exports = { main };
