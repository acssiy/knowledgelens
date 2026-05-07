import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import {
  extractJSON,
  loadFixture,
  validateReport,
  validateData,
  checkLanguageConsistency,
  checkControlChars,
  checkDangerousContent,
  checkReferentialIntegrity,
} from './validate-report.js';

const ROOT = resolve(import.meta.dirname, '..');

describe('zh/demo-report.html', () => {
  const htmlPath = resolve(ROOT, 'zh/demo-report.html');

  it('extracts valid JSON', () => {
    const { data, error } = extractJSON(htmlPath);
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data.meta).toBeDefined();
    expect(data.domains).toBeDefined();
    expect(data.documents).toBeDefined();
  });

  it('passes all validations', () => {
    const result = validateReport(htmlPath, 'zh');
    if (!result.valid) {
      console.log('Validation errors:', result.errors.slice(0, 10));
    }
    expect(result.valid).toBe(true);
  });

  it('language consistency (zh)', () => {
    const { data } = extractJSON(htmlPath);
    const errors = checkLanguageConsistency(data, 'zh');
    expect(errors).toEqual([]);
  });
});

describe('en/demo-report.html', () => {
  const htmlPath = resolve(ROOT, 'en/demo-report.html');

  it('extracts valid JSON', () => {
    const { data, error } = extractJSON(htmlPath);
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data.meta).toBeDefined();
    expect(data.domains).toBeDefined();
    expect(data.documents).toBeDefined();
  });

  it('passes structural validations (schema, refs, ranges, safety)', () => {
    const result = validateReport(htmlPath, 'en');
    if (!result.valid) {
      console.log('Validation errors:', result.errors.slice(0, 10));
    }
    expect(result.valid).toBe(true);
  });

  it('language consistency (en) — no Chinese in non-document fields', () => {
    const { data } = extractJSON(htmlPath);
    const errors = checkLanguageConsistency(data, 'en');
    if (errors.length > 0) {
      console.log('Language issues found (expected until EN demo is fixed):');
      console.log(errors.slice(0, 5).join('\n'));
    }
    // This may fail until EN demo is fixed — mark as known issue
    expect(errors).toEqual([]);
  });
});

describe('fixtures/valid', () => {
  it('minimal.json passes validation', () => {
    const fixturePath = resolve(ROOT, 'tests/fixtures/valid/minimal.json');
    const { data, raw, error } = loadFixture(fixturePath);
    expect(error).toBeNull();
    const result = validateData(data, raw, 'zh');
    if (!result.valid) {
      console.log('Errors:', result.errors);
    }
    expect(result.valid).toBe(true);
  });
});

describe('fixtures/invalid', () => {
  it('script-break.json detects </script> injection', () => {
    const fixturePath = resolve(ROOT, 'tests/fixtures/invalid/script-break.json');
    const { data, raw, error } = loadFixture(fixturePath);
    expect(error).toBeNull();
    const errors = checkDangerousContent(data);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('</script>');
  });

  it('control-chars.json detects control characters', () => {
    const fixturePath = resolve(ROOT, 'tests/fixtures/invalid/control-chars.json');
    const raw = readFileSync(fixturePath, 'utf-8');
    const errors = checkControlChars(raw);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('bad-refs.json detects broken references', () => {
    const fixturePath = resolve(ROOT, 'tests/fixtures/invalid/bad-refs.json');
    const { data, error } = loadFixture(fixturePath);
    expect(error).toBeNull();
    const errors = checkReferentialIntegrity(data);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes('missing document'))).toBe(true);
  });
});
