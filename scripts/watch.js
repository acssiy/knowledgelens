#!/usr/bin/env node
/**
 * watch.js — Semi-autonomous file watcher with auto-prepare
 * 
 * Watches source directories for changes, automatically prepares ingest
 * context when changes are detected. Apply step requires user confirmation.
 * 
 * Modes:
 *   --auto-prepare (default): detect → auto-prepare context → wait for user
 *   --notify-only: detect → print notification only (no auto-prepare)
 * 
 * Usage:
 *   node scripts/watch.js ~/Documents/notes --interval 30
 *   node scripts/watch.js ~/Documents/notes --auto-prepare
 *   node scripts/watch.js ~/Documents/notes --notify-only
 */

import { watch, existsSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { createInterface } from 'readline';
import { diffScan } from './diff-scan.js';
import { prepareIngest, applyUpdates } from './ingest.js';

const DEFAULT_INTERVAL = 60; // seconds
const DEBOUNCE_MS = 2000;

export function startWatcher(sourcePath, options = {}) {
  const resolved = resolve(sourcePath);
  const wikiDir = resolve(options.wikiDir || './wiki-data');
  const interval = (options.interval || DEFAULT_INTERVAL) * 1000;
  const autoPrepare = options.autoPrepare !== false; // default: true
  
  if (!existsSync(resolved)) {
    console.error(`Source path not found: ${resolved}`);
    process.exit(1);
  }
  
  console.log(`👁️  Watching: ${resolved}`);
  console.log(`📂 Wiki: ${wikiDir}`);
  console.log(`⏱️  Check interval: ${interval / 1000}s`);
  console.log(`🤖 Auto-prepare: ${autoPrepare ? 'ON' : 'OFF'}`);
  console.log('');
  
  let debounceTimer = null;
  let pendingContext = null;
  
  function checkForChanges() {
    try {
      const result = diffScan(resolved, wikiDir);
      const changes = result.new.length + result.modified.length;
      
      if (changes === 0) return;
      
      console.log(`\n🔔 ${new Date().toLocaleTimeString()} — ${changes} file(s) changed:`);
      for (const f of result.new) console.log(`  + ${f.path}`);
      for (const f of result.modified) console.log(`  ~ ${f.path}`);
      
      if (autoPrepare) {
        console.log(`\n⚙️  Auto-preparing ingest context...`);
        const prepResult = prepareIngest(resolved, wikiDir);
        
        if (prepResult.status === 'changes-found') {
          pendingContext = prepResult.context;
          const contextPath = join(resolve(wikiDir), '.ingest-context.json');
          console.log(`✅ Context ready (${prepResult.context.filesToProcess.length} files)`);
          console.log(`📦 Saved to: ${contextPath}`);
          console.log('');
          console.log(`┌─────────────────────────────────────────────┐`);
          console.log(`│  Next steps:                                │`);
          console.log(`│  1. Send context to your LLM                │`);
          console.log(`│  2. Save LLM response as JSON               │`);
          console.log(`│  3. Run: npm run ingest -- ${resolved} --apply <response.json> │`);
          console.log(`└─────────────────────────────────────────────┘`);
          console.log('');
          console.log(`  Or type 'apply <path>' here to apply a response file.`);
        }
      } else {
        console.log(`  Run: npm run ingest -- ${resolved}`);
      }
    } catch (err) {
      console.error(`❌ Check failed: ${err.message}`);
    }
  }
  
  // Initial check
  checkForChanges();
  
  // Periodic polling
  const timer = setInterval(checkForChanges, interval);
  
  // fs.watch for immediate detection (debounced)
  let fsWatcher = null;
  try {
    fsWatcher = watch(resolved, { recursive: true }, () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(checkForChanges, DEBOUNCE_MS);
    });
  } catch {
    console.log('ℹ️  Using polling only (recursive watch not supported)');
  }
  
  // Interactive apply: user can type "apply <path>" to confirm
  if (autoPrepare && process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('apply ')) {
        const responsePath = resolve(trimmed.slice(6).trim());
        if (!existsSync(responsePath)) {
          console.error(`❌ File not found: ${responsePath}`);
          return;
        }
        try {
          const response = JSON.parse(readFileSync(responsePath, 'utf-8'));
          const result = applyUpdates(wikiDir, response);
          console.log(`✅ Applied! ${result.index.stats.totalItems} items, ${result.index.stats.totalDomains} domains.`);
          console.log(`   ${result.log.summary}`);
          pendingContext = null;
        } catch (err) {
          console.error(`❌ Apply failed: ${err.message}`);
        }
      } else if (trimmed === 'status') {
        console.log(pendingContext ? `📋 Pending context: ${pendingContext.filesToProcess.length} files awaiting LLM processing` : '✅ No pending changes');
      } else if (trimmed === 'help') {
        console.log(`Commands: apply <response.json> | status | help | quit`);
      } else if (trimmed === 'quit' || trimmed === 'exit') {
        cleanup();
      }
    });
  }
  
  function cleanup() {
    if (fsWatcher) fsWatcher.close();
    clearInterval(timer);
    console.log('\n👋 Watcher stopped.');
    process.exit(0);
  }
  
  process.on('SIGINT', cleanup);
  
  return { stop: cleanup };
}

// CLI
if (process.argv[1] && process.argv[1].endsWith('watch.js')) {
  const args = process.argv.slice(2);
  const sourcePath = args.find(a => !a.startsWith('--'));
  
  if (!sourcePath) {
    console.error('Usage: node scripts/watch.js <source-path> [--interval 60] [--auto-prepare|--notify-only]');
    process.exit(1);
  }
  
  const intervalIdx = args.indexOf('--interval');
  const interval = intervalIdx !== -1 ? parseInt(args[intervalIdx + 1]) : DEFAULT_INTERVAL;
  const autoPrepare = !args.includes('--notify-only');
  
  startWatcher(sourcePath, { interval, autoPrepare });
}
