import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { prepareIngest, applyUpdates } from '../scripts/ingest.js';
import { validateResponse, deriveScores } from '../scripts/validate.js';
import { prepareQuery } from '../scripts/query.js';

// Helper: create a test wiki with known state
function createTestWiki(dir) {
  mkdirSync(join(dir, 'domains'), { recursive: true });
  const index = {
    version: '1.0.0',
    lastUpdated: '2024-01-01T00:00:00Z',
    domains: [{
      id: 'frontend',
      name: 'Frontend Development',
      score: 6.0,
      categories: [{
        id: 'react',
        name: 'React',
        score: 7.0,
        items: [
          { id: 'hooks', name: 'React Hooks', level: 'intermediate' },
          { id: 'context', name: 'Context API', level: 'basic' }
        ]
      }, {
        id: 'css',
        name: 'CSS',
        score: 5.0,
        items: [
          { id: 'flexbox', name: 'Flexbox', level: 'advanced' }
        ]
      }],
      gaps: [
        { id: 'gap-testing', title: 'Frontend Testing', priority: 'high' }
      ]
    }],
    stats: { totalItems: 3, totalDomains: 1, totalGaps: 1, totalIngests: 2 }
  };
  writeFileSync(join(dir, 'index.json'), JSON.stringify(index, null, 2));
  writeFileSync(join(dir, 'log.json'), JSON.stringify({ entries: [] }));
  writeFileSync(join(dir, 'domains', 'frontend.json'), JSON.stringify(index.domains[0]));
  return index;
}

describe('adversarial: validation', () => {
  it('rejects null response', () => {
    const result = validateResponse(null, { domains: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Response must be a non-null object');
  });

  it('rejects response with invalid action type', () => {
    const result = validateResponse({
      updates: [{ action: 'delete_everything', target: 'frontend/react/hooks' }]
    }, { domains: [] });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('invalid action');
  });

  it('rejects update missing target field', () => {
    const result = validateResponse({
      updates: [{ action: 'add_item', data: { name: 'test' } }]
    }, { domains: [] });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('missing "target"');
  });

  it('rejects non-array updates field', () => {
    const result = validateResponse({
      updates: 'not an array'
    }, { domains: [] });
    expect(result.valid).toBe(false);
  });

  it('clamps score > 10 with warning', () => {
    const result = validateResponse({
      index_changes: {
        score_changes: [{ domainId: 'frontend', newScore: 15 }]
      }
    }, { domains: [{ id: 'frontend', score: 8 }] });
    expect(result.valid).toBe(true);
    expect(result.sanitized.index_changes.score_changes[0].newScore).toBe(10);
    expect(result.warnings.some(w => w.includes('clamped to 10'))).toBe(true);
  });

  it('clamps score < 0 with warning', () => {
    const result = validateResponse({
      index_changes: {
        score_changes: [{ domainId: 'frontend', newScore: -3 }]
      }
    }, { domains: [{ id: 'frontend', score: 2 }] });
    expect(result.valid).toBe(true);
    expect(result.sanitized.index_changes.score_changes[0].newScore).toBe(0);
  });

  it('limits score delta to ±2.0 for existing categories', () => {
    const currentIndex = {
      domains: [{
        id: 'frontend',
        score: 6.0,
        categories: [{ id: 'react', score: 5.0 }]
      }]
    };
    const result = validateResponse({
      index_changes: {
        score_changes: [{ domainId: 'frontend', categoryId: 'react', newScore: 9.0 }]
      }
    }, currentIndex);
    expect(result.valid).toBe(true);
    // Delta was 4.0, should be clamped to 5.0 + 2.0 = 7.0
    expect(result.sanitized.index_changes.score_changes[0].newScore).toBe(7.0);
    expect(result.warnings.some(w => w.includes('delta'))).toBe(true);
  });

  it('rejects NaN score', () => {
    const result = validateResponse({
      index_changes: {
        score_changes: [{ domainId: 'frontend', newScore: NaN }]
      }
    }, { domains: [] });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('valid number');
  });

  it('warns on missing evidence for add_item', () => {
    const result = validateResponse({
      updates: [{ action: 'add_item', target: 'frontend/react/new-item', data: { name: 'test' } }]
    }, { domains: [] });
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('no evidence'))).toBe(true);
  });

  it('corrects invalid level to basic with warning', () => {
    const result = validateResponse({
      updates: [{ 
        action: 'add_item', 
        target: 'frontend/react/x', 
        data: { name: 'x', level: 'godlike' },
        evidence: 'test.md'
      }]
    }, { domains: [] });
    expect(result.valid).toBe(true);
    expect(result.sanitized.updates[0].data.level).toBe('basic');
  });
});

describe('adversarial: applyUpdates', () => {
  let wikiDir;

  beforeEach(() => {
    wikiDir = mkdtempSync(join(tmpdir(), 'wiki-adv-'));
    createTestWiki(wikiDir);
  });

  afterEach(() => {
    rmSync(wikiDir, { recursive: true, force: true });
  });

  it('rejects malformed response without modifying wiki', () => {
    const indexBefore = readFileSync(join(wikiDir, 'index.json'), 'utf-8');
    const result = applyUpdates(wikiDir, { updates: 'invalid' });
    expect(result.rejected).toBe(true);
    const indexAfter = readFileSync(join(wikiDir, 'index.json'), 'utf-8');
    expect(indexAfter).toBe(indexBefore);
  });

  it('duplicate apply is idempotent', () => {
    const response = {
      updates: [{ 
        action: 'add_item', 
        target: 'frontend/react/redux', 
        data: { id: 'redux', name: 'Redux', level: 'basic' },
        evidence: 'notes/redux.md'
      }],
      log_entry: { summary: 'Added Redux' }
    };
    
    const result1 = applyUpdates(wikiDir, response);
    expect(result1.rejected).toBeUndefined();
    
    const result2 = applyUpdates(wikiDir, response);
    expect(result2.skipped).toBe(true);
    
    // Item count should be same after duplicate
    const index = JSON.parse(readFileSync(join(wikiDir, 'index.json'), 'utf-8'));
    const reactItems = index.domains[0].categories[0].items;
    expect(reactItems.filter(i => i.id === 'redux').length).toBe(1);
  });

  it('handles add_item to non-existent domain gracefully', () => {
    const result = applyUpdates(wikiDir, {
      updates: [{ 
        action: 'add_item', 
        target: 'nonexistent/cat/item',
        data: { id: 'item', name: 'test' },
        evidence: 'test.md'
      }],
      log_entry: { summary: 'test' }
    });
    expect(result.rejected).toBeUndefined();
    expect(result.warnings.some(w => w.includes('not found'))).toBe(true);
  });

  it('resolve_gap marks gap as resolved', () => {
    const result = applyUpdates(wikiDir, {
      updates: [{ 
        action: 'resolve_gap', 
        target: 'frontend/gap-testing',
        data: { id: 'gap-testing' },
        evidence: 'Added jest tests'
      }],
      log_entry: { summary: 'Resolved testing gap' }
    });
    const index = JSON.parse(readFileSync(join(wikiDir, 'index.json'), 'utf-8'));
    const gap = index.domains[0].gaps.find(g => g.id === 'gap-testing');
    expect(gap.resolved).toBe(true);
  });

  it('domain score is derived from category scores after apply', () => {
    const result = applyUpdates(wikiDir, {
      index_changes: {
        score_changes: [
          { domainId: 'frontend', categoryId: 'react', newScore: 8.0 },
          { domainId: 'frontend', categoryId: 'css', newScore: 6.0 }
        ]
      },
      log_entry: { summary: 'Score update' }
    });
    // Domain score should be weighted avg: react(8.0 * 2 items) + css(6.0 * 1 item) / 3
    // = (16 + 6) / 3 = 7.33 → rounded to 7.3
    const domainScore = result.index.domains[0].score;
    expect(domainScore).toBeGreaterThan(7);
    expect(domainScore).toBeLessThan(8);
  });
});

describe('adversarial: deriveScores', () => {
  it('computes weighted average from category scores', () => {
    const index = {
      domains: [{
        id: 'test',
        score: 0,
        categories: [
          { id: 'a', score: 8, items: [{ id: '1' }, { id: '2' }] }, // weight 2
          { id: 'b', score: 4, items: [{ id: '3' }] }               // weight 1
        ]
      }]
    };
    deriveScores(index);
    // (8*2 + 4*1) / 3 = 20/3 = 6.67 → 6.7
    expect(index.domains[0].score).toBeCloseTo(6.7, 1);
  });

  it('never exceeds 10', () => {
    const index = {
      domains: [{
        id: 'test',
        score: 0,
        categories: [
          { id: 'a', score: 11, items: [{ id: '1' }] } // invalid but test boundary
        ]
      }]
    };
    deriveScores(index);
    expect(index.domains[0].score).toBeLessThanOrEqual(10);
  });

  it('skips domains with no valid category scores', () => {
    const index = {
      domains: [{
        id: 'test',
        score: 5,
        categories: [{ id: 'a', items: [] }] // no score field
      }]
    };
    deriveScores(index);
    expect(index.domains[0].score).toBe(5); // unchanged
  });
});

describe('golden eval: query retrieval', () => {
  let wikiDir;

  beforeEach(() => {
    wikiDir = mkdtempSync(join(tmpdir(), 'wiki-eval-'));
    mkdirSync(join(wikiDir, 'domains'), { recursive: true });
    const index = {
      version: '1.0.0',
      domains: [
        { id: 'frontend', name: 'Frontend Development', score: 7,
          categories: [
            { id: 'react', name: 'React', score: 7, items: [
              { id: 'hooks', name: 'React Hooks', level: 'intermediate' },
              { id: 'state', name: 'State Management', level: 'basic' }
            ]},
            { id: 'css', name: 'CSS Layout', score: 5, items: [
              { id: 'grid', name: 'CSS Grid', level: 'basic' }
            ]}
          ], gaps: [] },
        { id: 'backend', name: 'Backend Engineering', score: 5,
          categories: [
            { id: 'db', name: 'Databases', score: 6, items: [
              { id: 'sql', name: 'SQL Queries', level: 'intermediate' },
              { id: 'indexing', name: 'Database Indexing', level: 'basic' }
            ]}
          ], gaps: [] },
        { id: 'devops', name: 'DevOps', score: 3,
          categories: [
            { id: 'docker', name: 'Docker', score: 4, items: [
              { id: 'compose', name: 'Docker Compose', level: 'basic' }
            ]}
          ], gaps: [] }
      ],
      stats: { totalItems: 6, totalDomains: 3, totalGaps: 0, totalIngests: 1 }
    };
    writeFileSync(join(wikiDir, 'index.json'), JSON.stringify(index));
    writeFileSync(join(wikiDir, 'log.json'), JSON.stringify({ entries: [] }));
  });

  afterEach(() => {
    rmSync(wikiDir, { recursive: true, force: true });
  });

  it('retrieves frontend domain for React question', () => {
    const result = prepareQuery('What do I know about React hooks?', { wikiDir });
    expect(result.status).toBe('ready');
    const pages = result.context.relevantPages;
    expect(pages[0].id).toBe('frontend');
  });

  it('retrieves backend domain for database question', () => {
    const result = prepareQuery('How strong is my database knowledge?', { wikiDir });
    const pages = result.context.relevantPages;
    const backendPage = pages.find(p => p.id === 'backend');
    expect(backendPage).toBeDefined();
  });

  it('retrieves devops for Docker question', () => {
    const result = prepareQuery('Tell me about Docker', { wikiDir });
    const pages = result.context.relevantPages;
    const devopsPage = pages.find(p => p.id === 'devops');
    expect(devopsPage).toBeDefined();
  });

  it('returns error for uninitialized wiki', () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'wiki-empty-'));
    const result = prepareQuery('anything', { wikiDir: emptyDir });
    expect(result.error).toBeDefined();
    rmSync(emptyDir, { recursive: true, force: true });
  });
});
