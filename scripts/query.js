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
 * BM25 retrieval — finds wiki pages most relevant to the question.
 * Replaces naive keyword .includes() with proper TF-IDF scoring.
 * 
 * BM25 parameters: k1 (term saturation), b (length normalization)
 * Field boosts: domain name (2x), category name (1.5x), item name (1x), gap title (1.2x)
 */
const BM25_K1 = 1.2;
const BM25_B = 0.75;
const FIELD_BOOSTS = { domain: 2.0, category: 1.5, item: 1.0, gap: 1.2 };
const STOP_WORDS = new Set(['the','a','an','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could','should','may','might',
  'shall','can','need','dare','to','of','in','for','on','with','at','by','from','as',
  'into','about','between','through','during','before','after','above','below','and',
  'but','or','nor','not','so','yet','both','either','neither','each','every','all',
  'any','few','more','most','other','some','such','no','only','own','same','than',
  'too','very','just','because','how','what','which','who','whom','this','that',
  'these','those','i','me','my','myself','we','our','you','your','he','him','his',
  'she','her','it','its','they','them','their','know','tell','about','strong','much']);

function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

function buildDocuments(index) {
  const docs = [];
  for (const domain of index.domains) {
    const fields = {
      domain: tokenize(domain.name || ''),
      category: (domain.categories || []).flatMap(c => tokenize(c.name || '')),
      item: (domain.categories || []).flatMap(c => 
        (c.items || []).flatMap(i => tokenize(i.name || ''))
      ),
      gap: (domain.gaps || []).flatMap(g => tokenize(g.title || ''))
    };
    // All tokens flattened for length calculation
    const allTokens = Object.values(fields).flat();
    docs.push({ domainId: domain.id, fields, allTokens, length: allTokens.length });
  }
  return docs;
}

function scoreBM25(queryTokens, docs) {
  const N = docs.length;
  const avgDL = docs.reduce((s, d) => s + d.length, 0) / Math.max(N, 1);
  
  // Compute IDF for each query token
  const idf = {};
  for (const token of queryTokens) {
    const docsContaining = docs.filter(d => d.allTokens.includes(token)).length;
    idf[token] = Math.log((N - docsContaining + 0.5) / (docsContaining + 0.5) + 1);
  }
  
  // Score each document
  const scores = docs.map(doc => {
    let score = 0;
    for (const token of queryTokens) {
      // Sum across fields with boosts
      for (const [field, boost] of Object.entries(FIELD_BOOSTS)) {
        const fieldTokens = doc.fields[field] || [];
        const tf = fieldTokens.filter(t => t === token).length;
        if (tf === 0) continue;
        const fieldLen = fieldTokens.length;
        const normTF = (tf * (BM25_K1 + 1)) / 
          (tf + BM25_K1 * (1 - BM25_B + BM25_B * (fieldLen / Math.max(avgDL, 1))));
        score += idf[token] * normTF * boost;
      }
    }
    return { domainId: doc.domainId, score };
  });
  
  return scores.sort((a, b) => b.score - a.score);
}

function findRelevantPages(question, index, wikiDir, domainFilter) {
  const queryTokens = [...new Set(tokenize(question))]; // dedup
  const docs = buildDocuments(index);
  
  // Apply domain filter before scoring if specified
  const filteredDocs = domainFilter 
    ? docs.filter(d => d.domainId === domainFilter)
    : docs;
  
  // Empty query fallback: return all domains sorted by score
  if (queryTokens.length === 0) {
    return filteredDocs.map(d => {
      const domain = index.domains.find(dom => dom.id === d.domainId);
      return { type: 'domain', id: d.domainId, relevance: 0, content: domain };
    }).slice(0, 5);
  }
  
  const ranked = scoreBM25(queryTokens, filteredDocs);
  
  const pages = [];
  for (const { domainId, score } of ranked) {
    // Include if score > 0 (matched something) or if no filter is set (return all as fallback)
    if (score > 0 || !domainFilter) {
      const domain = index.domains.find(d => d.id === domainId);
      if (!domain) continue;
      
      const pagePath = join(wikiDir, 'domains', `${domainId}.json`);
      if (existsSync(pagePath)) {
        pages.push({
          type: 'domain', id: domainId, relevance: score,
          content: JSON.parse(readFileSync(pagePath, 'utf-8'))
        });
      } else {
        pages.push({ type: 'domain', id: domainId, relevance: score, content: domain });
      }
    }
  }
  
  return pages.slice(0, 5);
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
