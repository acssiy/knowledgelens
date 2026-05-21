#!/usr/bin/env node
/**
 * diff-scan.js — Deterministic file scanner for KnowledgeLens incremental ingest
 * 
 * Compares current source files against the wiki/log.json history.
 * Outputs a list of new/modified files that need processing.
 * 
 * Usage:
 *   node scripts/diff-scan.js <source-path> [--output json|text] [--wiki-dir ./wiki]
 * 
 * All file comparison is done via SHA-256 hash — no LLM involvement.
 */

import { createHash } from 'crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, relative, extname, basename } from 'path';

const SUPPORTED_EXTENSIONS = new Set(['.md', '.txt', '.html', '.json']);
const MAX_FILE_SIZE = 500 * 1024; // 500KB
const SKIP_PATTERNS = [/node_modules/, /\.git/, /\.obsidian/, /\.trash/];
const SENSITIVE_KEYWORDS = ['密码', 'password', '账号', 'secret', 'credential'];

function hashFile(filepath) {
  const content = readFileSync(filepath);
  return createHash('sha256').update(content).digest('hex');
}

function shouldSkip(filepath) {
  const name = basename(filepath);
  if (name.startsWith('.')) return true;
  if (SKIP_PATTERNS.some(p => p.test(filepath))) return true;
  if (SENSITIVE_KEYWORDS.some(kw => name.toLowerCase().includes(kw))) return true;
  return false;
}

function scanDirectory(dirPath) {
  const files = [];
  
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    
    for (const entry of entries) {
      const fullPath = resolve(dir, entry);
      if (shouldSkip(fullPath)) continue;
      
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }
      
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile()) {
        const ext = extname(entry).toLowerCase();
        if (!SUPPORTED_EXTENSIONS.has(ext)) continue;
        if (stat.size > MAX_FILE_SIZE) continue;
        if (stat.size === 0) continue;
        
        files.push({
          path: relative(dirPath, fullPath),
          absolutePath: fullPath,
          size: stat.size,
          modifiedAt: stat.mtime.toISOString()
        });
      }
    }
  }
  
  walk(dirPath);
  return files;
}

function loadLog(wikiDir) {
  const logPath = resolve(wikiDir, 'log.json');
  if (!existsSync(logPath)) return { entries: [] };
  try {
    return JSON.parse(readFileSync(logPath, 'utf-8'));
  } catch {
    return { entries: [] };
  }
}

function getProcessedHashes(log) {
  const hashMap = new Map(); // path → latest hash
  for (const entry of log.entries) {
    for (const file of entry.files) {
      if (file.status === 'new' || file.status === 'modified') {
        hashMap.set(file.path, file.hash);
      }
    }
  }
  return hashMap;
}

export function diffScan(sourcePath, wikiDir = './wiki-data') {
  const resolvedSource = resolve(sourcePath);
  const resolvedWiki = resolve(wikiDir);
  
  if (!existsSync(resolvedSource)) {
    throw new Error(`Source path does not exist: ${resolvedSource}`);
  }
  
  // 1. Scan current files
  const currentFiles = scanDirectory(resolvedSource);
  
  // 2. Load history
  const log = loadLog(resolvedWiki);
  const processedHashes = getProcessedHashes(log);
  
  // 3. Compare
  const results = {
    new: [],
    modified: [],
    unchanged: [],
    scanTime: new Date().toISOString(),
    sourcePath: resolvedSource,
    totalFiles: currentFiles.length
  };
  
  for (const file of currentFiles) {
    const hash = hashFile(file.absolutePath);
    const previousHash = processedHashes.get(file.path);
    
    const fileInfo = {
      path: file.path,
      hash,
      size: file.size,
      modifiedAt: file.modifiedAt
    };
    
    if (!previousHash) {
      results.new.push(fileInfo);
    } else if (previousHash !== hash) {
      results.modified.push(fileInfo);
    } else {
      results.unchanged.push(fileInfo);
    }
  }
  
  return results;
}

// CLI execution
if (process.argv[1] && process.argv[1].endsWith('diff-scan.js')) {
  const args = process.argv.slice(2);
  const sourcePath = args.find(a => !a.startsWith('--'));
  const outputFormat = args.includes('--output') 
    ? args[args.indexOf('--output') + 1] 
    : 'text';
  const wikiDir = args.includes('--wiki-dir')
    ? args[args.indexOf('--wiki-dir') + 1]
    : './wiki-data';
  
  if (!sourcePath) {
    console.error('Usage: node scripts/diff-scan.js <source-path> [--output json|text] [--wiki-dir ./wiki]');
    process.exit(1);
  }
  
  try {
    const result = diffScan(sourcePath, wikiDir);
    
    if (outputFormat === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`📊 Scan Results — ${result.sourcePath}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Total files: ${result.totalFiles}`);
      console.log(`  New:       ${result.new.length}`);
      console.log(`  Modified:  ${result.modified.length}`);
      console.log(`  Unchanged: ${result.unchanged.length}`);
      
      if (result.new.length > 0) {
        console.log(`\n🆕 New files:`);
        result.new.forEach(f => console.log(`  + ${f.path} (${(f.size/1024).toFixed(1)}KB)`));
      }
      if (result.modified.length > 0) {
        console.log(`\n✏️  Modified files:`);
        result.modified.forEach(f => console.log(`  ~ ${f.path} (${(f.size/1024).toFixed(1)}KB)`));
      }
      
      if (result.new.length === 0 && result.modified.length === 0) {
        console.log(`\n✅ No changes since last ingest.`);
      }
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
