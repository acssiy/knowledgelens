#!/usr/bin/env node
/**
 * hot-index.js — Generate compressed knowledge summary for LLM context
 * 
 * Produces a ~500 word text summary of the entire knowledge base state.
 * This gets injected into every LLM call so it always knows "what exists".
 * 
 * Usage:
 *   node scripts/hot-index.js [--wiki-dir ./wiki] [--output hot.md]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';

export function generateHotIndex(wikiDir = './wiki-data') {
  const indexPath = join(resolve(wikiDir), 'index.json');
  if (!existsSync(indexPath)) return '⚠️ Wiki is empty — no knowledge ingested yet.';
  
  const index = JSON.parse(readFileSync(indexPath, 'utf-8'));
  if (index.domains.length === 0) return '⚠️ Wiki is empty — no knowledge ingested yet.';
  
  const lines = [];
  lines.push(`# Knowledge Base State (${index.lastUpdated?.slice(0,10) || 'unknown date'})`);
  lines.push(`${index.stats.totalItems} items across ${index.stats.totalDomains} domains | ${index.stats.totalGaps} gaps | ${index.stats.totalIngests} ingests`);
  if (index.evaluationBasis) lines.push(`Evaluation basis: ${index.evaluationBasis}`);
  lines.push('');
  
  for (const domain of index.domains) {
    lines.push(`## ${domain.name} (score: ${domain.score}/10)`);
    
    for (const cat of domain.categories || []) {
      const items = cat.items || [];
      const levels = items.map(i => i.level[0]).join(''); // a/i/b compact
      lines.push(`  ${cat.name} [${cat.score}] (${items.length}): ${items.map(i => i.name).join(', ')}`);
    }
    
    const gaps = domain.gaps || [];
    if (gaps.length > 0) {
      const highGaps = gaps.filter(g => g.priority === 'high');
      lines.push(`  ⚡ Gaps (${gaps.length}): ${highGaps.map(g => g.title).join(', ')}${gaps.length > highGaps.length ? ` +${gaps.length - highGaps.length} more` : ''}`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

// CLI
if (process.argv[1] && process.argv[1].endsWith('hot-index.js')) {
  const args = process.argv.slice(2);
  const wikiDir = args.includes('--wiki-dir')
    ? args[args.indexOf('--wiki-dir') + 1]
    : './wiki-data';
  const outputPath = args.includes('--output')
    ? args[args.indexOf('--output') + 1]
    : null;
  
  const hot = generateHotIndex(wikiDir);
  
  if (outputPath) {
    writeFileSync(resolve(outputPath), hot);
    console.log(`Hot index written to ${outputPath} (${hot.length} chars)`);
  } else {
    console.log(hot);
  }
}
