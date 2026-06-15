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

import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs';
import { resolve, join } from 'path';
import { diffScan } from './diff-scan.js';
import { validateResponse, deriveScores } from './validate.js';

function loadJSON(filepath) {
  if (!existsSync(filepath)) return null;
  return JSON.parse(readFileSync(filepath, 'utf-8'));
}

function saveJSON(filepath, data) {
  const tmpPath = filepath + '.tmp';
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  renameSync(tmpPath, filepath);
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
  
  // Validate LLM response before applying
  const validation = validateResponse(llmResponse, index);
  if (!validation.valid) {
    return { 
      index, 
      log: null, 
      warnings: validation.warnings, 
      errors: validation.errors,
      rejected: true 
    };
  }
  
  // Idempotency check: hash the sanitized response for canonical comparison
  const responseHash = createHash('sha256')
    .update(JSON.stringify(validation.sanitized))
    .digest('hex');
  const alreadyApplied = log.entries.some(e => e.responseHash === responseHash);
  if (alreadyApplied) {
    return { index, log: null, warnings: ['Skipped: this response was already applied (idempotency check)'], skipped: true };
  }
  
  // Snapshot for rollback
  const snapshot = {
    index: JSON.parse(JSON.stringify(index)),
    log: JSON.parse(JSON.stringify(log))
  };
  
  // Use sanitized (clamped/corrected) response
  const safeResponse = validation.sanitized;
  const warnings = [];
  
  // Process updates array (all 6 action types from ingest-prompt.md)
  if (safeResponse.updates && Array.isArray(llmResponse.updates)) {
    for (const update of safeResponse.updates) {
      switch (update.action) {
        case 'add_domain': {
          if (!update.data || !update.data.id) break;
          if (!index.domains.find(d => d.id === update.data.id)) {
            index.domains.push(update.data);
          }
          // Write domain page
          const domainsDir = join(resolvedWiki, 'domains');
          if (!existsSync(domainsDir)) mkdirSync(domainsDir, { recursive: true });
          const domainPath = join(domainsDir, `${update.data.id}.json`);
          saveJSON(domainPath, update.data);
          break;
        }
        case 'add_item': {
          const target = parseTarget(update.target);
          if (!target) break;
          const domain = index.domains.find(d => d.id === target.domainId);
          if (!domain) { warnings.push(`add_item: domain "${target.domainId}" not found`); break; }
          const cat = (domain.categories || []).find(c => c.id === target.categoryId);
          if (!cat) { warnings.push(`add_item: category "${target.categoryId}" not found`); break; }
          if (!cat.items) cat.items = [];
          const itemData = update.data || {};
          const itemId = target.itemId || itemData.id;
          if (itemId && !cat.items.find(i => i.id === itemId)) {
            cat.items.push({ id: itemId, ...itemData });
            cat.itemCount = cat.items.length;
          }
          break;
        }
        case 'update_item': {
          const target = parseTarget(update.target);
          if (!target) break;
          const domain = index.domains.find(d => d.id === target.domainId);
          if (!domain) { warnings.push(`update_item: domain "${target.domainId}" not found`); break; }
          const cat = (domain.categories || []).find(c => c.id === target.categoryId);
          if (!cat) { warnings.push(`update_item: category "${target.categoryId}" not found`); break; }
          const item = (cat.items || []).find(i => i.id === target.itemId);
          if (!item) { warnings.push(`update_item: item "${target.itemId}" not found`); break; }
          // Merge update data into existing item
          if (update.data) Object.assign(item, update.data);
          break;
        }
        case 'add_gap': {
          const target = parseTarget(update.target);
          if (!target) break;
          const domain = index.domains.find(d => d.id === target.domainId);
          if (!domain) { warnings.push(`add_gap: domain "${target.domainId}" not found`); break; }
          if (!domain.gaps) domain.gaps = [];
          const gapData = update.data || {};
          const gapId = gapData.id || `gap-${Date.now()}`;
          if (!domain.gaps.find(g => g.id === gapId)) {
            domain.gaps.push({ id: gapId, ...gapData });
          }
          break;
        }
        case 'resolve_gap': {
          const target = parseTarget(update.target);
          if (!target) break;
          const domain = index.domains.find(d => d.id === target.domainId);
          if (!domain) { warnings.push(`resolve_gap: domain "${target.domainId}" not found`); break; }
          const gapId = target.categoryId || target.itemId || (update.data && update.data.id);
          if (gapId && domain.gaps) {
            const gap = domain.gaps.find(g => g.id === gapId);
            if (gap) {
              gap.resolved = true;
              gap.resolvedAt = new Date().toISOString();
              gap.resolvedBy = update.evidence || null;
            }
          }
          break;
        }
        case 'update_score': {
          const target = parseTarget(update.target);
          if (!target) break;
          const domain = index.domains.find(d => d.id === target.domainId);
          if (!domain) { warnings.push(`update_score: domain "${target.domainId}" not found`); break; }
          if (target.categoryId) {
            const cat = (domain.categories || []).find(c => c.id === target.categoryId);
            if (cat && update.data && typeof update.data.score === 'number') {
              cat.score = update.data.score;
            }
          } else if (update.data && typeof update.data.score === 'number') {
            domain.score = update.data.score;
          }
          break;
        }
        default:
          warnings.push(`Unknown action: "${update.action}"`);
      }
    }
  }
  
  // Also support index_changes format (backward compatibility)
  if (safeResponse.index_changes) {
    const changes = safeResponse.index_changes;
    
    if (changes.new_domains) {
      for (const domain of changes.new_domains) {
        if (domain.id && !index.domains.find(d => d.id === domain.id)) {
          index.domains.push(domain);
        }
      }
    }
    
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
    totalGaps += (d.gaps || []).filter(g => !g.resolved).length;
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
  
  // Derive domain scores deterministically from category scores
  deriveScores(index);
  
  // Append log entry with idempotency hash
  if (safeResponse.log_entry) {
    log.entries.push({
      id: `ingest-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'ingest',
      files: safeResponse.files_processed || [],
      result: safeResponse.log_entry,
      summary: safeResponse.log_entry.summary || 'Ingest completed',
      responseHash,
      warnings: [...validation.warnings, ...warnings].length > 0 
        ? [...validation.warnings, ...warnings] : undefined
    });
  }
  
  // Atomic save with rollback on failure
  try {
    saveJSON(indexPath, index);
    saveJSON(logPath, log);
  } catch (err) {
    // Rollback: restore previous state
    saveJSON(indexPath, snapshot.index);
    saveJSON(logPath, snapshot.log);
    return { 
      index: snapshot.index, 
      log: null, 
      errors: [`Write failed, rolled back: ${err.message}`],
      warnings: validation.warnings,
      rejected: true 
    };
  }
  
  return { index, log: log.entries[log.entries.length - 1], warnings: [...validation.warnings, ...warnings] };
}

/**
 * Parses a target string like "domain-id/category-id/item-id"
 */
function parseTarget(target) {
  if (!target || typeof target !== 'string') return null;
  const parts = target.split('/');
  return {
    domainId: parts[0] || null,
    categoryId: parts[1] || null,
    itemId: parts[2] || null
  };
}

// CLI
if (process.argv[1] && process.argv[1].endsWith('ingest.js')) {
  const args = process.argv.slice(2);
  const sourcePath = args.find(a => !a.startsWith('--'));
  const wikiDir = args.includes('--wiki-dir')
    ? args[args.indexOf('--wiki-dir') + 1]
    : './wiki-data';
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
