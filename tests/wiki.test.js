import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve, join } from 'path';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'fs';
import { diffScan } from '../scripts/diff-scan.js';
import { prepareIngest, applyUpdates } from '../scripts/ingest.js';
import { lintWiki } from '../scripts/lint.js';
import { generateHotIndex } from '../scripts/hot-index.js';
import { doubleWrite, dedup } from '../scripts/double-write.js';

const TEST_DIR = resolve(import.meta.dirname, '../.test-tmp');
const TEST_SOURCE = join(TEST_DIR, 'source');
const TEST_WIKI = join(TEST_DIR, 'wiki');

function setupTestEnv() {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(join(TEST_SOURCE, 'notes'), { recursive: true });
  mkdirSync(join(TEST_WIKI, 'domains'), { recursive: true });
  mkdirSync(join(TEST_WIKI, 'concepts'), { recursive: true });
  
  // Create empty wiki
  writeFileSync(join(TEST_WIKI, 'index.json'), JSON.stringify({
    version: '1.0.0',
    lastUpdated: null,
    evaluationBasis: null,
    stats: { totalItems: 0, totalDomains: 0, totalGaps: 0, totalDocuments: 0, totalIngests: 0 },
    domains: []
  }));
  writeFileSync(join(TEST_WIKI, 'log.json'), JSON.stringify({ entries: [] }));
  
  // Create test source files
  writeFileSync(join(TEST_SOURCE, 'notes', 'react-hooks.md'), '# React Hooks\n\nUseState, useEffect patterns...');
  writeFileSync(join(TEST_SOURCE, 'notes', 'testing.md'), '# Testing\n\nUnit tests with vitest...');
  writeFileSync(join(TEST_SOURCE, 'notes', 'passwords.txt'), 'secret stuff'); // should be skipped
}

describe('diff-scan', () => {
  beforeAll(setupTestEnv);
  afterAll(() => rmSync(TEST_DIR, { recursive: true, force: true }));
  
  it('detects all files as new on first scan', () => {
    const result = diffScan(TEST_SOURCE, TEST_WIKI);
    expect(result.new.length).toBe(2); // passwords.txt skipped
    expect(result.modified.length).toBe(0);
    expect(result.unchanged.length).toBe(0);
    expect(result.new.map(f => f.path).sort()).toEqual(['notes/react-hooks.md', 'notes/testing.md']);
  });
  
  it('skips sensitive files', () => {
    const result = diffScan(TEST_SOURCE, TEST_WIKI);
    const paths = result.new.map(f => f.path);
    expect(paths).not.toContain('notes/passwords.txt');
  });
  
  it('skips unsupported extensions', () => {
    writeFileSync(join(TEST_SOURCE, 'image.png'), 'fake binary');
    const result = diffScan(TEST_SOURCE, TEST_WIKI);
    const paths = result.new.map(f => f.path);
    expect(paths).not.toContain('image.png');
    rmSync(join(TEST_SOURCE, 'image.png'));
  });
  
  it('detects unchanged files after log entry', () => {
    // Simulate a log entry recording these files
    const log = {
      entries: [{
        id: 'test-1',
        timestamp: new Date().toISOString(),
        action: 'ingest',
        files: [
          { path: 'notes/react-hooks.md', hash: diffScan(TEST_SOURCE, TEST_WIKI).new.find(f => f.path === 'notes/react-hooks.md').hash, status: 'new' },
          { path: 'notes/testing.md', hash: diffScan(TEST_SOURCE, TEST_WIKI).new.find(f => f.path === 'notes/testing.md').hash, status: 'new' }
        ]
      }]
    };
    writeFileSync(join(TEST_WIKI, 'log.json'), JSON.stringify(log));
    
    const result = diffScan(TEST_SOURCE, TEST_WIKI);
    expect(result.new.length).toBe(0);
    expect(result.modified.length).toBe(0);
    expect(result.unchanged.length).toBe(2);
  });
  
  it('detects modified files', () => {
    writeFileSync(join(TEST_SOURCE, 'notes', 'react-hooks.md'), '# React Hooks UPDATED\n\nNew content added');
    const result = diffScan(TEST_SOURCE, TEST_WIKI);
    expect(result.modified.length).toBe(1);
    expect(result.modified[0].path).toBe('notes/react-hooks.md');
    expect(result.unchanged.length).toBe(1);
  });
  
  it('throws on non-existent source path', () => {
    expect(() => diffScan('/nonexistent/path', TEST_WIKI)).toThrow();
  });
});

describe('ingest orchestrator', () => {
  beforeAll(setupTestEnv);
  afterAll(() => rmSync(TEST_DIR, { recursive: true, force: true }));
  
  it('prepareIngest returns changes-found with file contents', () => {
    const result = prepareIngest(TEST_SOURCE, TEST_WIKI);
    expect(result.status).toBe('changes-found');
    expect(result.context.filesToProcess.length).toBe(2);
    expect(result.context.fileContents['notes/react-hooks.md']).toContain('React Hooks');
    expect(result.context.currentIndex).not.toBeNull();
  });
  
  it('applyUpdates creates index entries and log', () => {
    const mockResponse = {
      index_changes: {
        new_domains: [{
          id: 'frontend',
          name: 'Frontend Development',
          score: 5.5,
          categories: [{
            id: 'cat-react',
            name: 'React',
            itemCount: 1,
            score: 6.0,
            items: [{ id: 'item-hooks', name: 'React Hooks', level: 'intermediate' }]
          }],
          gaps: [{ id: 'gap-testing', title: 'Integration Testing', priority: 'high' }]
        }],
        new_items: [],
        score_changes: []
      },
      log_entry: {
        summary: 'Added Frontend domain with React Hooks',
        itemsAdded: 1,
        itemsUpdated: 0,
        gapsAdded: 1,
        gapsResolved: 0,
        contradictions: 0
      },
      files_processed: [
        { path: 'notes/react-hooks.md', hash: 'abc123', status: 'new' }
      ]
    };
    
    const result = applyUpdates(TEST_WIKI, mockResponse);
    expect(result.index.domains.length).toBe(1);
    expect(result.index.domains[0].name).toBe('Frontend Development');
    expect(result.index.stats.totalItems).toBe(1);
    expect(result.index.stats.totalIngests).toBe(1);
    expect(result.log.summary).toContain('Frontend');
    
    // Verify persisted
    const saved = JSON.parse(readFileSync(join(TEST_WIKI, 'index.json'), 'utf-8'));
    expect(saved.domains.length).toBe(1);
  });
  
  it('applyUpdates is idempotent for duplicate domains', () => {
    const mockResponse = {
      index_changes: {
        new_domains: [{
          id: 'frontend',
          name: 'Frontend Development',
          score: 5.5,
          categories: [],
          gaps: []
        }]
      },
      log_entry: { summary: 'Duplicate attempt', itemsAdded: 0, itemsUpdated: 0, gapsAdded: 0, gapsResolved: 0, contradictions: 0 },
      files_processed: []
    };
    
    const result = applyUpdates(TEST_WIKI, mockResponse);
    expect(result.index.domains.length).toBe(1); // Still 1, not 2
  });
});

describe('lint', () => {
  beforeAll(setupTestEnv);
  afterAll(() => rmSync(TEST_DIR, { recursive: true, force: true }));
  
  it('reports empty wiki', () => {
    const result = lintWiki(TEST_WIKI);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0].type).toBe('empty-wiki');
  });
  
  it('validates populated wiki', () => {
    // Populate wiki
    const index = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      stats: { totalItems: 2, totalDomains: 1, totalGaps: 1, totalDocuments: 0 },
      domains: [{
        id: 'frontend',
        name: 'Frontend',
        score: 6.0,
        categories: [{
          id: 'cat-react',
          name: 'React',
          score: 7.0,
          itemCount: 2,
          items: [
            { id: 'item-hooks', name: 'Hooks', level: 'advanced' },
            { id: 'item-context', name: 'Context API', level: 'intermediate' }
          ]
        }],
        gaps: [{ id: 'gap-1', title: 'Testing', priority: 'high' }]
      }]
    };
    writeFileSync(join(TEST_WIKI, 'index.json'), JSON.stringify(index));
    
    const result = lintWiki(TEST_WIKI);
    expect(result.summary.healthScore).toBeGreaterThan(50);
    expect(result.summary.errors).toBe(0);
  });
  
  it('detects invalid scores', () => {
    const index = {
      version: '1.0.0',
      stats: { totalItems: 1, totalDomains: 1, totalGaps: 0, totalDocuments: 0 },
      domains: [{
        id: 'bad',
        name: 'Bad Domain',
        score: 15, // Invalid!
        categories: [{ id: 'c1', name: 'Cat', score: 5, itemCount: 0, items: [] }],
        gaps: []
      }]
    };
    writeFileSync(join(TEST_WIKI, 'index.json'), JSON.stringify(index));
    
    const result = lintWiki(TEST_WIKI);
    expect(result.issues.some(i => i.type === 'invalid-score')).toBe(true);
  });
});

describe('hot-index', () => {
  beforeAll(setupTestEnv);
  afterAll(() => rmSync(TEST_DIR, { recursive: true, force: true }));
  
  it('returns empty message for empty wiki', () => {
    const hot = generateHotIndex(TEST_WIKI);
    expect(hot).toContain('empty');
  });
  
  it('generates compact summary for populated wiki', () => {
    const index = {
      version: '1.0.0',
      lastUpdated: '2025-05-07T00:00:00Z',
      evaluationBasis: 'Senior Frontend Developer',
      stats: { totalItems: 3, totalDomains: 2, totalGaps: 2, totalIngests: 1 },
      domains: [
        {
          id: 'frontend', name: 'Frontend', score: 7.0,
          categories: [{ id: 'c1', name: 'React', score: 8, itemCount: 2, items: [
            { id: 'i1', name: 'Hooks', level: 'advanced' },
            { id: 'i2', name: 'Context', level: 'intermediate' }
          ]}],
          gaps: [{ id: 'g1', title: 'Testing', priority: 'high' }]
        },
        {
          id: 'backend', name: 'Backend', score: 4.0,
          categories: [{ id: 'c2', name: 'Node.js', score: 5, itemCount: 1, items: [
            { id: 'i3', name: 'Express', level: 'beginner' }
          ]}],
          gaps: [{ id: 'g2', title: 'Database Design', priority: 'medium' }]
        }
      ]
    };
    writeFileSync(join(TEST_WIKI, 'index.json'), JSON.stringify(index));
    
    const hot = generateHotIndex(TEST_WIKI);
    expect(hot).toContain('Frontend');
    expect(hot).toContain('Backend');
    expect(hot).toContain('Hooks');
    expect(hot).toContain('Testing');
    expect(hot).toContain('3 items');
    expect(hot.length).toBeLessThan(2000); // stays compact
  });
});

describe('double-write', () => {
  beforeAll(setupTestEnv);
  afterAll(() => rmSync(TEST_DIR, { recursive: true, force: true }));
  
  it('dedup merges arrays by id', () => {
    const existing = { items: [{ id: 'a', v: 1 }, { id: 'b', v: 2 }] };
    const incoming = { items: [{ id: 'b', v: 3 }, { id: 'c', v: 4 }] };
    const result = dedup(existing, incoming);
    expect(result.items.length).toBe(3);
    expect(result.items.find(i => i.id === 'b').v).toBe(3); // newer wins
  });
  
  it('dedup handles empty existing', () => {
    const result = dedup({}, { name: 'test' });
    expect(result.name).toBe('test');
  });
  
  it('writes wiki pages and rebuilds hot index', () => {
    const llmResponse = {
      index_changes: {
        new_domains: [{
          id: 'ai',
          name: 'AI/ML',
          score: 3.0,
          categories: [{ id: 'cat-llm', name: 'LLM', score: 4, itemCount: 1, items: [{ id: 'item-prompt', name: 'Prompt Engineering', level: 'beginner' }] }],
          gaps: [{ id: 'gap-rag', title: 'RAG Pipeline', priority: 'high' }]
        }],
        new_items: [],
        score_changes: []
      },
      log_entry: { summary: 'Added AI domain', itemsAdded: 1, itemsUpdated: 0, gapsAdded: 1, gapsResolved: 0, contradictions: 0 },
      files_processed: [{ path: 'ai-notes.md', hash: 'xyz', status: 'new' }],
      wiki_pages: [{
        type: 'domain',
        id: 'ai',
        content: { id: 'ai', name: 'AI/ML', description: 'Artificial Intelligence', items: [{ id: 'item-prompt', name: 'Prompt Engineering' }] }
      }]
    };
    
    const result = doubleWrite(llmResponse, TEST_WIKI);
    expect(result.pagesWritten.length).toBe(1);
    expect(result.hotIndex).toContain('AI/ML');
    expect(existsSync(join(TEST_WIKI, 'domains', 'ai.json'))).toBe(true);
    expect(existsSync(join(TEST_WIKI, 'hot-index.md'))).toBe(true);
  });
});

describe('query', () => {
  beforeAll(() => {
    setupTestEnv();
    const index = {
      version: '1.0.0',
      lastUpdated: '2025-05-07T00:00:00Z',
      stats: { totalItems: 3, totalDomains: 2, totalGaps: 1, totalIngests: 1, totalDocuments: 2 },
      domains: [
        {
          id: 'frontend', name: 'Frontend Development', score: 7.0,
          categories: [{ id: 'c1', name: 'React', score: 8, itemCount: 2, items: [
            { id: 'i1', name: 'Hooks', level: 'advanced' },
            { id: 'i2', name: 'Context API', level: 'intermediate' }
          ]}],
          gaps: [{ id: 'g1', title: 'Testing', priority: 'high' }]
        },
        {
          id: 'backend', name: 'Backend', score: 4.0,
          categories: [{ id: 'c2', name: 'Node.js', score: 5, itemCount: 1, items: [
            { id: 'i3', name: 'Express', level: 'beginner' }
          ]}],
          gaps: []
        }
      ]
    };
    writeFileSync(join(TEST_WIKI, 'index.json'), JSON.stringify(index));
  });
  afterAll(() => rmSync(TEST_DIR, { recursive: true, force: true }));
  
  it('prepares query context with relevant pages', async () => {
    const { prepareQuery } = await import('../scripts/query.js');
    const result = prepareQuery('How good am I at React hooks?', { wikiDir: TEST_WIKI });
    expect(result.status).toBe('ready');
    expect(result.context.question).toContain('React');
    expect(result.context.hotIndex).toContain('Frontend');
    expect(result.context.relevantPages.length).toBeGreaterThan(0);
    expect(result.context.relevantPages[0].id).toBe('frontend');
  });
  
  it('filters by domain when specified', async () => {
    const { prepareQuery } = await import('../scripts/query.js');
    const result = prepareQuery('What skills do I have?', { wikiDir: TEST_WIKI, domain: 'backend' });
    expect(result.context.relevantPages.every(p => p.id === 'backend')).toBe(true);
  });
  
  it('returns error for uninitialized wiki', async () => {
    const { prepareQuery } = await import('../scripts/query.js');
    const result = prepareQuery('test', { wikiDir: '/nonexistent' });
    expect(result.error).toBeDefined();
  });
});
