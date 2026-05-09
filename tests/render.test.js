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
    const gapsNav = page.locator('[data-action="show-view"][data-view="gaps"]');
    if (await gapsNav.count() > 0) {
      await gapsNav.first().click();
      await page.waitForTimeout(300);
      const bodyText = await page.evaluate(() => document.body.innerText);
      expect(bodyText).not.toContain('undefined');
      // Must have priority groups with items, not just a header
      expect(bodyText).toMatch(/优先级|Priority/);
      const gapCards = await page.evaluate(() => {
        const cards = document.querySelectorAll('[id^="gap-item-"]');
        return cards.length;
      });
      expect(gapCards).toBeGreaterThan(0);
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

  it('all domain tabs render knowledge items', async () => {
    // Each domain tab should show at least 1 knowledge item
    const tabs = page.locator('[data-action="switch-domain"]');
    const tabCount = await tabs.count();
    for (let i = 0; i < tabCount; i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(300);
      const items = await page.locator('[data-doc-id]').count();
      expect(items).toBeGreaterThan(0);
    }
  });

  it('radar/chart SVG renders with visual elements', async () => {
    const svgInfo = await page.evaluate(() => {
      const svg = document.querySelector('svg');
      if (!svg) return null;
      const paths = svg.querySelectorAll('path').length;
      const circles = svg.querySelectorAll('circle').length;
      const lines = svg.querySelectorAll('line').length;
      return { elements: paths + circles + lines };
    });
    expect(svgInfo).not.toBeNull();
    expect(svgInfo.elements).toBeGreaterThan(0);
  });

  it('expert opinions show names and content', async () => {
    // Navigate to gaps and check expert panels
    const gapsNav = page.locator('[data-action="show-view"][data-view="gaps"]');
    if (await gapsNav.count() > 0) {
      await gapsNav.first().click();
      await page.waitForTimeout(300);
      const expertData = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        const expertBtns = Array.from(buttons).filter(b => b.textContent.includes('专家'));
        return { count: expertBtns.length };
      });
      expect(expertData.count).toBeGreaterThan(0);
    }
  });

  it('no empty category labels (structural completeness)', async () => {
    // Back to overview
    const overviewBtn = page.locator('[data-action="show-view"][data-view="overview"]');
    if (await overviewBtn.count() > 0) await overviewBtn.first().click();
    await page.waitForTimeout(300);
    const emptyLabels = await page.evaluate(() => {
      const issues = [];
      // Check that category toggles have visible text
      const toggles = document.querySelectorAll('[data-cat-id]');
      toggles.forEach(t => {
        const text = t.textContent.replace(/\s+/g, ' ').trim();
        if (text.length < 2) issues.push(`Category toggle has no label`);
      });
      return issues;
    });
    expect(emptyLabels).toEqual([]);
  });

  it('no NaN or [object Object] in rendered text', async () => {
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('[object Object]');
    expect(bodyText).not.toMatch(/\bnull\b/);
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

  it('gaps view renders with actual gap cards', async () => {
    const gapsNav = page.locator('[data-action="show-view"][data-view="gaps"]');
    if (await gapsNav.count() > 0) {
      await gapsNav.first().click();
      await page.waitForTimeout(300);
      const bodyText = await page.evaluate(() => document.body.innerText);
      expect(bodyText).not.toContain('undefined');
      // Must have actual priority groups with items
      expect(bodyText).toMatch(/Priority|优先级/);
      // Must have at least one gap card with a title (not just header)
      const gapCards = await page.evaluate(() => {
        const cards = document.querySelectorAll('[id^="gap-item-"]');
        return cards.length;
      });
      expect(gapCards).toBeGreaterThan(0);
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

  it('no NaN or [object Object] in rendered text', async () => {
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('[object Object]');
    expect(bodyText).not.toContain('undefined');
  });

  it('cleanup', async () => {
    await browser.close();
  });
});

// Cross-cutting boundary tests
describe('boundary & edge cases', () => {
  let browser, page, errors;

  it('setup', async () => {
    ({ browser, page, errors } = await openReport(resolve(ROOT, 'zh/demo-report.html')));
    expect(errors).toEqual([]);
  }, 10000);

  it('all javascript:void(0) links have click handlers', async () => {
    const unhandledLinks = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href="javascript:void(0)"]');
      const unhandled = [];
      links.forEach(a => {
        // Must have data-doc-id or data-action or onclick or be inside event-delegated container
        const hasHandler = a.dataset.docId || a.dataset.action || a.onclick ||
          a.closest('[data-doc-id]') || a.closest('[data-action]');
        if (!hasHandler) unhandled.push(a.innerText.slice(0, 40));
      });
      return unhandled;
    });
    expect(unhandledLinks).toEqual([]);
  });

  it('score values are within 0-10 range', async () => {
    const invalidScores = await page.evaluate(() => {
      const data = window.__KNOWLEDGELENS_DATA || window.reportData;
      if (!data) return [];
      const issues = [];
      (data.domains || []).forEach(d => {
        if (d.score < 0 || d.score > 10) issues.push(`domain ${d.name}: score=${d.score}`);
        (d.categories || []).forEach(c => {
          if (c.score < 0 || c.score > 10) issues.push(`category ${c.name}: score=${c.score}`);
          (c.items || []).forEach(item => {
            if (item.score < 0 || item.score > 10) issues.push(`item ${item.name}: score=${item.score}`);
          });
        });
      });
      return issues;
    });
    expect(invalidScores).toEqual([]);
  });

  it('all docIds referenced in gaps exist in domains', async () => {
    const orphanRefs = await page.evaluate(() => {
      const data = window.__KNOWLEDGELENS_DATA || window.reportData;
      if (!data) return [];
      const allDocIds = new Set();
      (data.domains || []).forEach(d => {
        (d.categories || []).forEach(c => {
          (c.items || []).forEach(item => allDocIds.add(item.id));
        });
      });
      const issues = [];
      (data.domains || []).forEach(d => {
        (d.gaps || []).forEach(g => {
          (g.from || []).forEach(ref => {
            if (!allDocIds.has(ref)) issues.push(`gap "${g.title}" references non-existent docId: ${ref}`);
          });
        });
      });
      return issues;
    });
    expect(orphanRefs).toEqual([]);
  });

  it('no truncated HTML tags in document content', async () => {
    const truncated = await page.evaluate(() => {
      const data = window.__KNOWLEDGELENS_DATA || window.reportData;
      if (!data) return [];
      const issues = [];
      (data.domains || []).forEach(d => {
        (d.categories || []).forEach(c => {
          (c.items || []).forEach(item => {
            if (item.document) {
              // Check for unclosed tags (basic heuristic)
              const opens = (item.document.match(/<[a-z][^>]*>/gi) || []).length;
              const closes = (item.document.match(/<\/[a-z]+>/gi) || []).length;
              if (Math.abs(opens - closes) > 3) {
                issues.push(`${item.name}: open=${opens} close=${closes}`);
              }
            }
          });
        });
      });
      return issues;
    });
    expect(truncated).toEqual([]);
  });

  it('page does not have excessive empty whitespace blocks', async () => {
    const bodyText = await page.evaluate(() => document.body.innerText);
    // No more than 5 consecutive blank lines (indicates missing content)
    const hasExcessiveGaps = /\n{6,}/.test(bodyText);
    expect(hasExcessiveGaps).toBe(false);
  });

  it('page has meaningful structure (header + content areas)', async () => {
    const structure = await page.evaluate(() => {
      const body = document.body.innerText;
      const hasDomains = body.includes('产品') || body.includes('Product') || body.includes('Market');
      const hasNavigation = document.querySelectorAll('[data-action]').length > 0;
      const hasContent = body.length > 500;
      return { hasDomains, hasNavigation, hasContent };
    });
    expect(structure.hasDomains).toBe(true);
    expect(structure.hasNavigation).toBe(true);
    expect(structure.hasContent).toBe(true);
  });

  it('cleanup', async () => {
    await browser.close();
  });
});
