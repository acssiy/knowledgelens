#!/usr/bin/env node
/**
 * query.js — Knowledge base query interface
 * 
 * Generates LLM context for answering questions about the knowledge base.
 * Uses hot-index + relevant wiki pages to construct a focused prompt.
 * 
 * Usage:
 *   node scripts/query.js "What do I know about React hooks?"
 *   node scripts/query.js --domain frontend "How strong am I at testing?"
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { generateHotIndex } from './hot-index.js';

/**
 * Prepares a query context for the LLM.
 * Returns everything the LLM needs to answer the question.
 */
export function prepareQuery(question, options = {}) {
  const wikiDir = resolve(options.wikiDir || './wiki-data');
  const indexPath = join(wikiDir, 'index.json');
  
  if (!existsSync(indexPath)) {
    return { error: 'Wiki not initialized. Run ingest first.' };
  }
  
  const index = JSON.parse(readFileSync(indexPath, 'utf-8'));
  const hotIndex = generateHotIndex(wikiDir);
  
  // Find relevant domains/pages based on question keywords
  const relevantPages = findRelevantPages(question, index, wikiDir, options.domain);
  
  // Load query prompt template
  const promptPath = join(wikiDir, 'query-prompt.md');
  const promptTemplate = existsSync(promptPath) 
    ? readFileSync(promptPath, 'utf-8')
    : DEFAULT_QUERY_PROMPT;
  
  return {
    status: 'ready',
    prompt: promptTemplate,
    context: {
      hotIndex,
      question,
      relevantPages,
      totalDomains: index.domains.length,
      totalItems: index.stats.totalItems
    }
  };
}

/**
 * Finds wiki pages most relevant to the question.
 * Uses simple keyword matching against domain/category/item names.
 */
function findRelevantPages(question, index, wikiDir, domainFilter) {
  const keywords = question.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const pages = [];
  
  for (const domain of index.domains) {
    if (domainFilter && domain.id !== domainFilter) continue;
    
    const domainText = [domain.name, ...(domain.categories || []).map(c => c.name),
      ...(domain.categories || []).flatMap(c => (c.items || []).map(i => i.name))
    ].join(' ').toLowerCase();
    
    const relevance = keywords.filter(k => domainText.includes(k)).length;
    
    if (relevance > 0 || !domainFilter) {
      // Load domain page if exists
      const pagePath = join(wikiDir, 'domains', `${domain.id}.json`);
      if (existsSync(pagePath)) {
        pages.push({
          type: 'domain',
          id: domain.id,
          relevance,
          content: JSON.parse(readFileSync(pagePath, 'utf-8'))
        });
      } else {
        pages.push({ type: 'domain', id: domain.id, relevance, content: domain });
      }
    }
  }
  
  // Sort by relevance
  pages.sort((a, b) => b.relevance - a.relevance);
  return pages.slice(0, 5); // Top 5 most relevant
}

const DEFAULT_QUERY_PROMPT = `You are a knowledge base assistant. Answer the user's question based ONLY on the knowledge base state provided. If the information isn't in the knowledge base, say so clearly.`;

// CLI
if (process.argv[1] && process.argv[1].endsWith('query.js')) {
  const args = process.argv.slice(2);
  const domainIdx = args.indexOf('--domain');
  let domain = null;
  if (domainIdx !== -1) {
    domain = args[domainIdx + 1];
    args.splice(domainIdx, 2);
  }
  
  const question = args.join(' ');
  if (!question) {
    console.error('Usage: node scripts/query.js "your question"');
    process.exit(1);
  }
  
  const result = prepareQuery(question, { domain });
  console.log(JSON.stringify(result, null, 2));
}
