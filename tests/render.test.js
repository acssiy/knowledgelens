import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');

async function checkReport(filePath, lang) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];

  page.on('pageerror', (err) => errors.push(`JS Error: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`Console error: ${msg.text()}`);
  });

  await page.goto(`file://${filePath}`);
  await page.waitForTimeout(1000);

  // Check page not blank
  const bodyText = await page.evaluate(() => document.body.innerText);
  expect(bodyText.length).toBeGreaterThan(100);

  // Check no "undefined" rendered in visible text
  const undefinedCount = (bodyText.match(/undefined/g) || []).length;
  if (undefinedCount > 0) {
    errors.push(`Found "undefined" text rendered ${undefinedCount} times on page`);
  }

  // Check key elements exist
  const hasRadar = await page.locator('svg').count();
  expect(hasRadar).toBeGreaterThan(0);

  const hasDomainTabs = await page.locator('[data-domain-index], .domain-tab').count();
  expect(hasDomainTabs).toBeGreaterThan(0);

  // Check Chinese content renders (not garbled) for zh
  if (lang === 'zh') {
    const chineseRe = /[\u4e00-\u9fff]/;
    expect(chineseRe.test(bodyText)).toBe(true);
    // Check no mojibake patterns (common garbled UTF-8 indicators)
    expect(bodyText).not.toMatch(/Ã/);
    expect(bodyText).not.toMatch(/â€/);
  }

  // No JS errors
  expect(errors).toEqual([]);

  await browser.close();
}

describe('Browser rendering', () => {
  it('zh demo renders correctly', async () => {
    await checkReport(resolve(ROOT, 'zh/demo-report.html'), 'zh');
  }, 15000);

  it('en demo renders correctly', async () => {
    await checkReport(resolve(ROOT, 'en/demo-report.html'), 'en');
  }, 15000);
});
