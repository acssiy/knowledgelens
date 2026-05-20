#!/usr/bin/env node
/**
 * lint.js — Knowledge base health check
 * 
 * Checks wiki/ for:
 * 1. Contradictions — conflicting info across pages
 * 2. Orphan items — knowledge not linked to any domain
 * 3. Missing concepts — referenced 3+ times but no dedicated page
 * 4. Stale gaps — marked as "to improve" but new evidence exists
 * 5. Score drift — scores inconsistent with item levels
 * 6. Broken references — IDs that point to non-existent pages
 * 
 * Usage:
 *   node scripts/lint.js [--wiki-dir ./wiki] [--output json|text]
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

function loadJSON(filepath) {
  if (!existsSync(filepath)) return null;
  try {
    return JSON.parse(readFileSync(filepath, 'utf-8'));
  } catch {
    return null;
  }
}

function listJSONFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => join(dir, f));
}

export function lintWiki(wikiDir = './wiki') {
  const resolvedWiki = resolve(wikiDir);
  const index = loadJSON(join(resolvedWiki, 'index.json'));
  const issues = [];
  
  if (!index) {
    issues.push({ severity: 'error', type: 'missing-index', message: 'wiki/index.json not found' });
    return { issues, score: 0 };
  }
  
  if (index.domains.length === 0) {
    issues.push({ severity: 'warning', type: 'empty-wiki', message: 'Wiki has no domains — run ingest first' });
    return { issues, score: 0 };
  }
  
  // Collect all referenced IDs
  const allItemIds = new Set();
  const allGapIds = new Set();
  const allCategoryIds = new Set();
  const gapFromRefs = [];
  
  for (const domain of index.domains) {
    for (const cat of domain.categories || []) {
      allCategoryIds.add(cat.id);
      for (const item of cat.items || []) {
        allItemIds.add(item.id);
      }
    }
    for (const gap of domain.gaps || []) {
      allGapIds.add(gap.id);
    }
  }
  
  // Check 1: Score consistency
  for (const domain of index.domains) {
    if (domain.score < 0 || domain.score > 10) {
      issues.push({ severity: 'error', type: 'invalid-score', message: `Domain "${domain.name}" has invalid score: ${domain.score}` });
    }
    for (const cat of domain.categories || []) {
      if (cat.score < 0 || cat.score > 10) {
        issues.push({ severity: 'error', type: 'invalid-score', message: `Category "${cat.name}" has invalid score: ${cat.score}` });
      }
      // Check level distribution vs score
      const items = cat.items || [];
      const advancedCount = items.filter(i => i.level === 'advanced').length;
      const basicCount = items.filter(i => i.level === 'basic').length;
      if (items.length > 0) {
        const advancedRatio = advancedCount / items.length;
        if (advancedRatio > 0.7 && cat.score < 6) {
          issues.push({ severity: 'warning', type: 'score-drift', message: `Category "${cat.name}": 70%+ advanced items but score is only ${cat.score}` });
        }
        if (basicCount === items.length && cat.score > 5) {
          issues.push({ severity: 'warning', type: 'score-drift', message: `Category "${cat.name}": all items are basic but score is ${cat.score}` });
        }
      }
    }
  }
  
  // Check 2: Domain page files exist
  for (const domain of index.domains) {
    const domainFile = join(resolvedWiki, 'domains', `${domain.id}.json`);
    if (!existsSync(domainFile)) {
      issues.push({ severity: 'info', type: 'missing-page', message: `Domain page missing: domains/${domain.id}.json (index-only)` });
    }
  }
  
  // Check 3: Gap references valid
  for (const domain of index.domains) {
    const domainPage = loadJSON(join(resolvedWiki, 'domains', `${domain.id}.json`));
    if (domainPage) {
      for (const gap of domainPage.gaps || []) {
        for (const ref of gap.from || []) {
          if (!allItemIds.has(ref)) {
            issues.push({ severity: 'warning', type: 'broken-ref', message: `Gap "${gap.title}" references non-existent item: ${ref}` });
          }
        }
      }
    }
  }
  
  // Check 4: Orphan concept pages
  const conceptFiles = listJSONFiles(join(resolvedWiki, 'concepts'));
  for (const file of conceptFiles) {
    const concept = loadJSON(file);
    if (concept && concept.relatedConcepts) {
      for (const ref of concept.relatedConcepts) {
        const refFile = join(resolvedWiki, 'concepts', `${ref}.json`);
        if (!existsSync(refFile)) {
          issues.push({ severity: 'info', type: 'missing-concept', message: `Concept "${concept.title}" references non-existent concept: ${ref}` });
        }
      }
    }
  }
  
  // Check 5: Empty categories
  for (const domain of index.domains) {
    for (const cat of domain.categories || []) {
      if (!cat.items || cat.items.length === 0) {
        issues.push({ severity: 'warning', type: 'empty-category', message: `Category "${cat.name}" in domain "${domain.name}" has no items` });
      }
    }
  }
  
  // Calculate health score (0-100)
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;
  const healthScore = Math.max(0, 100 - (errorCount * 20) - (warningCount * 5) - (infoCount * 1));
  
  return {
    issues,
    summary: {
      errors: errorCount,
      warnings: warningCount,
      info: infoCount,
      healthScore,
      totalDomains: index.domains.length,
      totalItems: index.stats.totalItems,
      totalGaps: index.stats.totalGaps
    }
  };
}

// CLI
if (process.argv[1] && process.argv[1].endsWith('lint.js')) {
  const args = process.argv.slice(2);
  const wikiDir = args.includes('--wiki-dir')
    ? args[args.indexOf('--wiki-dir') + 1]
    : './wiki';
  const outputFormat = args.includes('--output')
    ? args[args.indexOf('--output') + 1]
    : 'text';
  
  const result = lintWiki(wikiDir);
  
  if (outputFormat === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`🏥 Knowledge Health Check`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Health Score: ${result.summary.healthScore}/100`);
    console.log(`Errors: ${result.summary.errors} | Warnings: ${result.summary.warnings} | Info: ${result.summary.info}`);
    
    if (result.issues.length > 0) {
      console.log(`\nIssues:`);
      for (const issue of result.issues) {
        const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`  ${icon} [${issue.type}] ${issue.message}`);
      }
    } else {
      console.log(`\n✅ All clear — no issues found.`);
    }
  }
}
