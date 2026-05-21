#!/usr/bin/env node
/**
 * watch.js — File watcher for auto-ingest trigger
 * 
 * Watches source directories for changes and triggers diff-scan.
 * Notifies user when new/modified files detected (does NOT auto-call LLM).
 * 
 * Usage:
 *   node scripts/watch.js ~/Documents/notes --interval 30
 */

import { watch, existsSync } from 'fs';
import { resolve } from 'path';
import { diffScan } from './diff-scan.js';

const DEFAULT_INTERVAL = 60; // seconds
const DEBOUNCE_MS = 2000;

export function startWatcher(sourcePath, options = {}) {
  const resolved = resolve(sourcePath);
  const wikiDir = resolve(options.wikiDir || './wiki-data');
  const interval = (options.interval || DEFAULT_INTERVAL) * 1000;
  
  if (!existsSync(resolved)) {
    console.error(`Source path not found: ${resolved}`);
    process.exit(1);
  }
  
  console.log(`👁️  Watching: ${resolved}`);
  console.log(`📂 Wiki: ${wikiDir}`);
  console.log(`⏱️  Check interval: ${interval / 1000}s`);
  console.log('');
  
  let lastCheck = Date.now();
  let debounceTimer = null;
  
  function checkForChanges() {
    try {
      const result = diffScan(resolved, wikiDir);
      const changes = result.new.length + result.modified.length;
      
      if (changes > 0) {
        console.log(`\n🔔 ${new Date().toLocaleTimeString()} — ${changes} file(s) need ingestion:`);
        for (const f of result.new) console.log(`  + ${f.path}`);
        for (const f of result.modified) console.log(`  ~ ${f.path}`);
        console.log(`  Run: npm run ingest -- prepare ${resolved}`);
      }
      
      lastCheck = Date.now();
    } catch (err) {
      console.error(`❌ Check failed: ${err.message}`);
    }
  }
  
  // Initial check
  checkForChanges();
  
  // Periodic polling (more reliable than fs.watch across platforms)
  const timer = setInterval(checkForChanges, interval);
  
  // Also use fs.watch for immediate detection (debounced)
  try {
    const watcher = watch(resolved, { recursive: true }, () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(checkForChanges, DEBOUNCE_MS);
    });
    
    process.on('SIGINT', () => {
      watcher.close();
      clearInterval(timer);
      console.log('\n👋 Watcher stopped.');
      process.exit(0);
    });
  } catch {
    // fs.watch not supported recursively on all platforms
    console.log('ℹ️  Using polling only (recursive watch not supported)');
  }
  
  return { stop: () => clearInterval(timer) };
}

// CLI
if (process.argv[1] && process.argv[1].endsWith('watch.js')) {
  const args = process.argv.slice(2);
  const sourcePath = args[0];
  
  if (!sourcePath) {
    console.error('Usage: node scripts/watch.js <source-path> [--interval 60]');
    process.exit(1);
  }
  
  const intervalIdx = args.indexOf('--interval');
  const interval = intervalIdx !== -1 ? parseInt(args[intervalIdx + 1]) : DEFAULT_INTERVAL;
  
  startWatcher(sourcePath, { interval });
}
