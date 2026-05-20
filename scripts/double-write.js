#!/usr/bin/env node
/**
 * double-write.js — Draft extraction & dedup merge
 * 
 * Extracts knowledge from LLM response and writes to both:
 * 1. Wiki pages (canonical storage)
 * 2. Report-compatible data (for template rendering)
 * 
 * This is the bridge between the incremental wiki system and the
 * existing one-shot report generation.
 * 
 * Usage:
 *   import { doubleWrite } from './double-write.js'
 *   doubleWrite(llmResponse, wikiDir)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';
import { applyUpdates } from './ingest.js';
import { generateHotIndex } from './hot-index.js';

/**
 * Takes a validated LLM response and:
 * 1. Applies changes to wiki index (via applyUpdates)
 * 2. Generates wiki pages in domains/concepts/gaps folders
 * 3. Rebuilds hot-index cache
 * 
 * @param {object} llmResponse - Structured response from LLM
 * @param {string} wikiDir - Path to wiki directory
 * @returns {object} { index, hotIndex, pagesWritten }
 */
export function doubleWrite(llmResponse, wikiDir = './wiki') {
  const resolved = resolve(wikiDir);
  
  // 1. Apply index changes
  const { index } = applyUpdates(resolved, llmResponse);
  
  // 2. Write domain pages
  const pagesWritten = [];
  
  if (llmResponse.wiki_pages) {
    for (const page of llmResponse.wiki_pages) {
      const dir = join(resolved, page.type + 's'); // domains, concepts, gaps, entities
      mkdirSync(dir, { recursive: true });
      const filePath = join(dir, `${page.id}.json`);
      
      // Merge with existing page if present
      let existing = {};
      if (existsSync(filePath)) {
        existing = JSON.parse(readFileSync(filePath, 'utf-8'));
      }
      
      const merged = dedup(existing, page.content);
      writeFileSync(filePath, JSON.stringify(merged, null, 2));
      pagesWritten.push(filePath);
    }
  }
  
  // 3. Rebuild hot index
  const hotIndex = generateHotIndex(resolved);
  writeFileSync(join(resolved, 'hot-index.md'), hotIndex);
  
  return { index, hotIndex, pagesWritten };
}

/**
 * Dedup merge: merges new content into existing page.
 * Arrays are union-merged by id; scalars are overwritten by newer.
 */
function dedup(existing, incoming) {
  if (!existing || Object.keys(existing).length === 0) return incoming;
  if (!incoming) return existing;
  
  const result = { ...existing };
  
  for (const [key, value] of Object.entries(incoming)) {
    if (Array.isArray(value) && Array.isArray(existing[key])) {
      // Union merge by id
      const map = new Map(existing[key].map(item => [item.id || JSON.stringify(item), item]));
      for (const item of value) {
        map.set(item.id || JSON.stringify(item), item); // newer wins
      }
      result[key] = [...map.values()];
    } else if (typeof value === 'object' && value !== null && typeof existing[key] === 'object') {
      result[key] = dedup(existing[key], value);
    } else {
      result[key] = value; // scalar: newer wins
    }
  }
  
  return result;
}

export { dedup }; // expose for testing
