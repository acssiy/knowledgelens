#!/usr/bin/env node
/**
 * ingest.js — KnowledgeLens incremental ingest orchestrator
 * 
 * Orchestrates the full ingest pipeline:
 * 1. Run diff-scan to find new/modified files
 * 2. If changes found, prepare context for LLM (index + file contents)
 * 3. Output the prompt + context for the LLM to process
 * 4. After LLM responds, apply updates to wiki/
 * 
 * Usage:
 *   node scripts/ingest.js <source-path> [--wiki-dir ./wiki] [--apply <llm-response.json>]
 * 
 * Modes:
 *   Without --apply: scans and outputs what needs processing (prepare mode)
 *   With --apply:    applies LLM response to wiki files (apply mode)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { diffScan } from './diff-scan.js';

function loadJSON(filepath) {
  if (!existsSync(filepath)) return null;
  return JSON.parse(readFileSync(filepath, 'utf-8'));
}

function saveJSON(filepath, data) {
  writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

function prepareIngest(sourcePath, wikiDir) {
  const diff = diffScan(sourcePath, wikiDir);
  const filesToProcess = [...diff.new, ...diff.modified];
  
  if (filesToProcess.length === 0) {
    return { status: 'no-changes', diff };
  }
  
  // Load current index
  const index = loadJSON(join(resolve(wikiDir), 'index.json'));
  
  // Read file contents for LLM
  const fileContents = {};
  const resolvedSource = resolve(sourcePath);
  for (const file of filesToProcess) {
    const fullPath = join(resolvedSource, file.path);
    try {
      fileContents[file.path] = readFileSync(fullPath, 'utf-8');
    } catch {
      fileContents[file.path] = `[ERROR: Could not read file]`;
    }
  }
  
  // Load ingest prompt
  const promptPath = join(resolve(wikiDir), 'ingest-prompt.md');
  const prompt = existsSync(promptPath) ? readFileSync(promptPath, 'utf-8') : '[ingest-prompt.md not found]';
  
  return {
    status: 'changes-found',
    diff,
    context: {
      currentIndex: index,
      filesToProcess: filesToProcess.map(f => ({ path: f.path, status: diff.new.includes(f) ? 'new' : 'modified' })),
      fileContents,
      prompt
    }
  };
}

function applyUpdates(wikiDir, llmResponse) {
  const resolvedWiki = resolve(wikiDir);
  const indexPath = join(resolvedWiki, 'index.json');
  const logPath = join(resolvedWiki, 'log.json');
  
  const index = loadJSON(indexPath) || { version: '1.0.0', domains: [], stats: {} };
  const log = loadJSON(logPath) || { entries: [] };
  
  // Apply index changes from LLM response
  if (llmResponse.index_changes) {
    const changes = llmResponse.index_changes;
    
    // Add new domains
    if (changes.new_domains) {
      for (const domain of changes.new_domains) {
        if (!index.domains.find(d => d.id === domain.id)) {
          index.domains.push(domain);
        }
      }
    }
    
    // Add new items to existing categories
    if (changes.new_items) {
      for (const newItem of changes.new_items) {
        const domain = index.domains.find(d => d.id === newItem.domainId);
        if (domain) {
          const cat = (domain.categories || []).find(c => c.id === newItem.categoryId);
          if (cat) {
            if (!cat.items) cat.items = [];
            if (!cat.items.find(i => i.id === newItem.item.id)) {
              cat.items.push(newItem.item);
              cat.itemCount = cat.items.length;
            }
          }
        }
      }
    }
    
    // Update scores
    if (changes.score_changes) {
      for (const sc of changes.score_changes) {
        const domain = index.domains.find(d => d.id === sc.domainId);
        if (domain) {
          if (sc.categoryId) {
            const cat = (domain.categories || []).find(c => c.id === sc.categoryId);
            if (cat) cat.score = sc.newScore;
          } else {
            domain.score = sc.newScore;
          }
        }
      }
    }
  }
  
  // Update stats
  let totalItems = 0, totalGaps = 0;
  for (const d of index.domains) {
    for (const c of d.categories || []) {
      totalItems += (c.items || []).length;
    }
    totalGaps += (d.gaps || []).length;
  }
  index.stats = {
    ...index.stats,
    totalItems,
    totalDomains: index.domains.length,
    totalGaps,
    lastIngestAt: new Date().toISOString(),
    totalIngests: (index.stats.totalIngests || 0) + 1
  };
  index.lastUpdated = new Date().toISOString();
  
  // Append log entry
  if (llmResponse.log_entry) {
    log.entries.push({
      id: `ingest-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'ingest',
      files: llmResponse.files_processed || [],
      result: llmResponse.log_entry,
      summary: llmResponse.log_entry.summary || 'Ingest completed'
    });
  }
  
  // Write domain pages
  if (llmResponse.updates) {
    for (const update of llmResponse.updates) {
      if (update.action === 'add_domain' && update.data) {
        const domainPath = join(resolvedWiki, 'domains', `${update.data.id}.json`);
        saveJSON(domainPath, update.data);
      }
    }
  }
  
  // Save
  saveJSON(indexPath, index);
  saveJSON(logPath, log);
  
  return { index, log: log.entries[log.entries.length - 1] };
}

// CLI
if (process.argv[1] && process.argv[1].endsWith('ingest.js')) {
  const args = process.argv.slice(2);
  const sourcePath = args.find(a => !a.startsWith('--'));
  const wikiDir = args.includes('--wiki-dir')
    ? args[args.indexOf('--wiki-dir') + 1]
    : './wiki';
  const applyPath = args.includes('--apply')
    ? args[args.indexOf('--apply') + 1]
    : null;
  
  if (applyPath) {
    // Apply mode
    const response = JSON.parse(readFileSync(resolve(applyPath), 'utf-8'));
    const result = applyUpdates(wikiDir, response);
    console.log(`✅ Updates applied. ${result.index.stats.totalItems} items, ${result.index.stats.totalDomains} domains.`);
    console.log(`   ${result.log.summary}`);
  } else if (sourcePath) {
    // Prepare mode
    const result = prepareIngest(sourcePath, wikiDir);
    
    if (result.status === 'no-changes') {
      console.log('✅ No changes since last ingest.');
    } else {
      console.log(`📋 ${result.context.filesToProcess.length} files to process:`);
      result.context.filesToProcess.forEach(f => {
        console.log(`  ${f.status === 'new' ? '🆕' : '✏️'}  ${f.path}`);
      });
      console.log(`\nTo process, send the following to your LLM:`);
      console.log(`  1. wiki/ingest-prompt.md (instructions)`);
      console.log(`  2. wiki/index.json (current state)`);
      console.log(`  3. The ${result.context.filesToProcess.length} file(s) listed above`);
      console.log(`\nThen apply the response:`);
      console.log(`  node scripts/ingest.js ${sourcePath} --wiki-dir ${wikiDir} --apply <response.json>`);
      
      // Also output as JSON for programmatic use
      const outputPath = join(resolve(wikiDir), '.ingest-context.json');
      saveJSON(outputPath, result.context);
      console.log(`\n📦 Full context saved to: ${outputPath}`);
    }
  } else {
    console.error('Usage: node scripts/ingest.js <source-path> [--wiki-dir ./wiki] [--apply <response.json>]');
    process.exit(1);
  }
}

export { prepareIngest, applyUpdates };
