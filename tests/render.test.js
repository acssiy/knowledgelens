import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');

async function openReport(filePath) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];

  page.on('pageerror', (err) => errors.push(`JS Error: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`Console error: ${msg.text()}`);
  });

  await page.goto(`file://${filePath}`);
  await page.waitForTimeout(500);
  return { browser, page, errors };
}

describe('zh demo — rendering', () => {
  let browser, page, errors;

  it('page loads without errors', async () => {
    ({ browser, page, errors } = await openReport(resolve(ROOT, 'zh/demo-report.html')));
    expect(errors).toEqual([]);
  }, 10000);

  it('no undefined/null text visible', async () => {
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).not.toContain('undefined');
    expect(bodyText).not.toContain('null');
    expect(bodyText.length).toBeGreaterThan(200);
  });

  it('Chinese content renders (no garbled text)', async () => {
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toMatch(/[\u4e00-\u9fff]/);
    expect(bodyText).not.toMatch(/Ã/);
  });

  it('radar chart SVG exists with paths', async () => {
    const svgCount = await page.locator('svg').count();
    expect(svgCount).toBeGreaterThan(0);
    const pathCount = await page.locator('svg path').count();
    expect(pathCount).toBeGreaterThan(0);
  });

  it('domain tabs exist and are clickable', async () => {
    const tabs = page.locator('[data-action="switch-domain"]');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(2);
    // Click second domain tab
    await tabs.nth(1).click();
    await page.waitForTimeout(300);
    expect(errors).toEqual([]);
  });

  it('sidebar categories render and expand', async () => {
    const categories = page.locator('[data-cat-id]');
    const count = await categories.count();
    expect(count).toBeGreaterThan(0);
    // Click first category to toggle
    await categories.first().click();
    await page.waitForTimeout(300);
    expect(errors).toEqual([]);
  });

  it('knowledge items are clickable and show detail', async () => {
    const items = page.locator('[data-doc-id]');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    // Click via JS dispatch to avoid overlap issues with sidebar layout
    await items.first().dispatchEvent('click');
    await page.waitForTimeout(500);
    // Detail view should appear with document content
    const detailText = await page.evaluate(() => document.body.innerText);
    expect(detailText).not.toContain('undefined');
    expect(detailText.length).toBeGreaterThan(300);
    expect(errors).toEqual([]);
  });

  it('document content is not empty when viewing detail', async () => {
    // After clicking a knowledge item, the doc panel should have real content
    const docContent = await page.evaluate(() => {
      // Look for the detail/content area that shows after item click
      const candidates = document.querySelectorAll('[class*="detail"], [class*="content"], [id*="detail"], [id*="content"]');
      for (const el of candidates) {
        if (el.innerText.trim().length > 20) return el.innerText;
      }
      return '';
    });
    // Should have meaningful content (not just whitespace)
    expect(docContent.trim().length).toBeGreaterThan(20);
  });

  it('gaps view loads and shows gap cards', async () => {
    // Navigate to gaps view
    const gapsNav = page.locator('[data-action="show-view"][data-view="gaps"]');
    if (await gapsNav.count() > 0) {
      await gapsNav.first().click();
      await page.waitForTimeout(300);
      const bodyText = await page.evaluate(() => document.body.innerText);
      expect(bodyText).not.toContain('undefined');
      expect(errors).toEqual([]);
    }
  });

  it('search works and returns results', async () => {
    const searchInput = page.locator('#global-search, input[type="search"], input[placeholder*="搜索"], input[placeholder*="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('KANO');
      await page.waitForTimeout(500);
      const resultsVisible = await page.evaluate(() => {
        const el = document.querySelector('.search-results, [class*="search"]');
        return el ? el.innerText : '';
      });
      // Should find something related
      expect(resultsVisible.length).toBeGreaterThan(0);
      expect(errors).toEqual([]);
    }
  });

  it('back navigation works', async () => {
    const backBtn = page.locator('[data-action="show-view"][data-view="overview"]');
    if (await backBtn.count() > 0) {
      await backBtn.first().click();
      await page.waitForTimeout(300);
      expect(errors).toEqual([]);
    }
  });

  it('no broken links (href="#" or empty href)', async () => {
    const brokenLinks = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href]');
      const broken = [];
      links.forEach(a => {
        const href = a.getAttribute('href');
        if (href === '#' || href === '' || href === 'undefined' || href === 'null') {
          broken.push({ text: a.innerText.slice(0, 30), href });
        }
      });
      return broken;
    });
    expect(brokenLinks).toEqual([]);
  });

  it('cleanup', async () => {
    await browser.close();
  });
});

describe('en demo — rendering', () => {
  let browser, page, errors;

  it('page loads without errors', async () => {
    ({ browser, page, errors } = await openReport(resolve(ROOT, 'en/demo-report.html')));
    expect(errors).toEqual([]);
  }, 10000);

  it('no undefined/null text visible', async () => {
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).not.toContain('undefined');
    expect(bodyText).not.toContain('null');
    expect(bodyText.length).toBeGreaterThan(200);
  });

  it('English content renders', async () => {
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toMatch(/Product|Knowledge|Domain/i);
  });

  it('domain tabs clickable + switch works', async () => {
    const tabs = page.locator('[data-action="switch-domain"]');
    expect(await tabs.count()).toBeGreaterThanOrEqual(2);
    await tabs.nth(1).click();
    await page.waitForTimeout(300);
    expect(errors).toEqual([]);
  });

  it('knowledge item click → detail with content', async () => {
    const items = page.locator('[data-doc-id]');
    expect(await items.count()).toBeGreaterThan(0);
    await items.first().dispatchEvent('click');
    await page.waitForTimeout(500);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).not.toContain('undefined');
    expect(errors).toEqual([]);
  });

  it('gaps view renders without errors', async () => {
    const gapsNav = page.locator('[data-action="show-view"][data-view="gaps"]');
    if (await gapsNav.count() > 0) {
      await gapsNav.first().click();
      await page.waitForTimeout(300);
      const bodyText = await page.evaluate(() => document.body.innerText);
      expect(bodyText).not.toContain('undefined');
      expect(errors).toEqual([]);
    }
  });

  it('no broken links', async () => {
    const brokenLinks = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href]');
      const broken = [];
      links.forEach(a => {
        const href = a.getAttribute('href');
        if (href === '#' || href === '' || href === 'undefined' || href === 'null') {
          broken.push({ text: a.innerText.slice(0, 30), href });
        }
      });
      return broken;
    });
    expect(brokenLinks).toEqual([]);
  });

  it('cleanup', async () => {
    await browser.close();
  });
});
