#!/usr/bin/env node
/**
 * wiki-generate.js — Assembles wiki/ directory state into report JSON
 * 
 * Reads wiki/index.json + domain/gap/concept pages and produces a complete
 * data-schema-compatible JSON that can be fed to inject.js.
 * 
 * Usage:
 *   node scripts/wiki-generate.js --wiki-dir ./wiki --schema zh/data-schema.json --output report.json
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

function loadJSON(filepath) {
  if (!existsSync(filepath)) return null;
  return JSON.parse(readFileSync(filepath, 'utf-8'));
}

function loadWikiPage(wikiDir, subdir, id) {
  const filepath = join(wikiDir, subdir, `${id}.json`);
  return loadJSON(filepath);
}

export function generateReport(wikiDir = './wiki') {
  const resolvedWiki = resolve(wikiDir);
  const index = loadJSON(join(resolvedWiki, 'index.json'));
  
  if (!index) {
    throw new Error(`wiki/index.json not found at ${resolvedWiki}`);
  }
  
  if (index.domains.length === 0) {
    throw new Error('Wiki is empty — run ingest first');
  }
  
  // Assemble full report from wiki pages
  const report = {
    meta: {
      generatedAt: new Date().toISOString(),
      version: index.version,
      evaluationBasis: index.evaluationBasis,
      source: 'wiki'
    },
    domains: [],
    documents: []
  };
  
  for (const domainRef of index.domains) {
    // Load full domain page
    const domainPage = loadWikiPage(resolvedWiki, 'domains', domainRef.id);
    
    if (domainPage) {
      report.domains.push(domainPage);
      // Collect documents from domain
      if (domainPage.categories) {
        for (const cat of domainPage.categories) {
          for (const item of (cat.items || [])) {
            if (item.docId) {
              const doc = loadWikiPage(resolvedWiki, 'sources', item.docId);
              if (doc) report.documents.push(doc);
            }
          }
        }
      }
    } else {
      // Fallback: use index-level info (minimal)
      report.domains.push({
        id: domainRef.id,
        name: domainRef.name,
        score: domainRef.score,
        icon: domainRef.icon || 'brain',
        scores: [],
        expertRoles: [],
        categories: domainRef.categories.map(c => ({
          id: c.id,
          name: c.name,
          score: c.score,
          items: (c.items || []).map(item => ({
            id: item.id,
            name: item.name,
            level: item.level,
            score: 5
          }))
        })),
        gaps: (domainRef.gaps || []).map(g => ({
          id: g.id,
          title: g.title,
          priority: g.priority,
          type: 'new',
          brief: '',
          from: [],
          experts: []
        }))
      });
    }
  }
  
  return report;
}

// CLI
if (process.argv[1] && process.argv[1].endsWith('wiki-generate.js')) {
  const args = process.argv.slice(2);
  const wikiDir = args.includes('--wiki-dir')
    ? args[args.indexOf('--wiki-dir') + 1]
    : './wiki';
  const outputPath = args.includes('--output')
    ? args[args.indexOf('--output') + 1]
    : null;
  
  try {
    const report = generateReport(wikiDir);
    const json = JSON.stringify(report, null, 2);
    
    if (outputPath) {
      const { writeFileSync } = await import('fs');
      writeFileSync(resolve(outputPath), json);
      console.log(`Report written to ${outputPath} (${(json.length/1024).toFixed(1)}KB)`);
    } else {
      console.log(json);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
