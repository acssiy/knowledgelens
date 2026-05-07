#!/usr/bin/env node
/**
 * KnowledgeLens Overflow & Layout Test Suite
 * 
 * Validates that both zh/ and en/ templates have proper overflow protections.
 * Run: node tests/check-overflow.js
 * 
 * These are static checks — they grep/parse the template HTML/CSS to verify
 * that overflow-related CSS properties are present on key selectors.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATES = ['zh/template.html', 'en/template.html'];

let totalTests = 0;
let passed = 0;
let failed = 0;
const failures = [];

function test(desc, condition) {
  totalTests++;
  if (condition) {
    passed++;
    console.log(`  ✅ ${desc}`);
  } else {
    failed++;
    failures.push(desc);
    console.log(`  ❌ ${desc}`);
  }
}

function hasCSS(html, selector, property) {
  // Simple check: find the selector block and verify property exists nearby
  const selectorEscaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(selectorEscaped + '\\s*\\{[^}]*' + property, 's');
  return regex.test(html);
}

function containsText(html, text) {
  return html.includes(text);
}

console.log('\n🔍 KnowledgeLens Overflow Test Suite\n');

for (const tplPath of TEMPLATES) {
  const fullPath = path.join(ROOT, tplPath);
  const lang = tplPath.split('/')[0].toUpperCase();
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  ${tplPath} not found, skipping`);
    continue;
  }
  
  const html = fs.readFileSync(fullPath, 'utf-8');
  console.log(`\n📄 ${tplPath} (${(html.length / 1024).toFixed(0)}KB)`);
  console.log('─'.repeat(50));

  // === TEST 1: Radar chart label wrapping ===
  test(
    `[${lang}] Radar labels have auto-wrap for long text (tspan)`,
    containsText(html, 'tspan') && containsText(html, "labels[i].length >")
  );

  // === TEST 2: Score row label overflow protection ===
  test(
    `[${lang}] .score-row-label has word-break`,
    hasCSS(html, '.score-row-label', 'word-break')
  );
  test(
    `[${lang}] .score-row-label has min-width: 0`,
    hasCSS(html, '.score-row-label', 'min-width')
  );
  test(
    `[${lang}] .score-row-header has gap`,
    hasCSS(html, '.score-row-header', 'gap')
  );

  // === TEST 3: Domain tabs wrapping in equal-width mode ===
  test(
    `[${lang}] Domain tabs equal-width allows text wrap`,
    hasCSS(html, '.domain-tabs:not\\(.scrollable\\) .domain-tab', 'white-space: normal')
      || containsText(html, 'white-space: normal')
  );

  // === TEST 4: Knowledge item name min-width ===
  test(
    `[${lang}] .knowledge-item-name has min-width: 0`,
    hasCSS(html, '.knowledge-item-name', 'min-width')
  );
  test(
    `[${lang}] .knowledge-item-name has text-overflow: ellipsis`,
    hasCSS(html, '.knowledge-item-name', 'text-overflow')
  );

  // === TEST 5: Summary card title word-break ===
  test(
    `[${lang}] .summary-card-title h4 has word-break`,
    hasCSS(html, '.summary-card-title h4', 'word-break')
  );

  // === TEST 6: Gap content overflow ===
  test(
    `[${lang}] .gap-content has min-width: 0`,
    hasCSS(html, '.gap-content', 'min-width')
  );
  test(
    `[${lang}] .gap-content has word-break`,
    hasCSS(html, '.gap-content', 'word-break')
  );

  // === TEST 7: Nav item overflow ===
  test(
    `[${lang}] .nav-item has overflow: hidden`,
    hasCSS(html, '.nav-item', 'overflow: hidden') || hasCSS(html, '.nav-item', 'overflow:hidden')
  );

  // === TEST 8: Dimension modal label word-break ===
  test(
    `[${lang}] Dimension modal label has word-break`,
    containsText(html, 'font-weight:700;color:#1e293b;word-break:break-word')
      || containsText(html, 'font-weight:700;color:#1e293b; word-break:break-word')
  );

  // === TEST 9: Radar margin sufficient (ZH>=80, EN>=85) ===
  const marginMatch = html.match(/var margin = (\d+);/);
  const marginVal = marginMatch ? parseInt(marginMatch[1]) : 0;
  const minMargin = lang === 'ZH' ? 80 : 85;
  test(
    `[${lang}] Radar chart margin >= ${minMargin} (actual: ${marginVal})`,
    marginVal >= minMargin
  );

  // === TEST 10: D3.js embedded (offline support) ===
  test(
    `[${lang}] D3.js embedded inline (no CDN dependency)`,
    containsText(html, 'd3js.org v7') || containsText(html, 'd3.v7')
  );

  // === TEST 11: No external script/link tags ===
  const externalScripts = (html.match(/<script[^>]+src=["']http/g) || []).length;
  const externalLinks = (html.match(/<link[^>]+href=["']http/g) || []).length;
  test(
    `[${lang}] No external script/link dependencies`,
    externalScripts === 0 && externalLinks === 0
  );

  // === TEST 12: Responsive media queries exist ===
  test(
    `[${lang}] Has @media max-width:1024px breakpoint`,
    containsText(html, '@media (max-width: 1024px)')
  );
  test(
    `[${lang}] Has @media max-width:768px breakpoint`,
    containsText(html, '@media (max-width: 768px)')
  );

  // === TEST 13: overflow-x on domain-tabs (scrollable support) ===
  test(
    `[${lang}] .domain-tabs has overflow-x: auto`,
    hasCSS(html, '.domain-tabs', 'overflow-x')
  );

  // === TEST 14: SVG overflow visible (prevents clipping) ===
  test(
    `[${lang}] Radar SVG has overflow:visible`,
    containsText(html, "style('overflow', 'visible')")
  );

  // === TEST 15: Expert opinion word-break ===
  test(
    `[${lang}] .expert-opinion has word-break`,
    hasCSS(html, '.expert-opinion', 'word-break')
  );

  // === TEST 16: Gap title inline word-break ===
  test(
    `[${lang}] Gap title inline has word-break`,
    containsText(html, 'margin-bottom:5px;word-break:break-word">${item.title}')
  );

  // === TEST 17: Gap brief inline word-break ===
  test(
    `[${lang}] Gap brief inline has word-break`,
    containsText(html, 'line-height:1.6;word-break:break-word">${item.brief}')
  );

  // === TEST 18: Factor notes word-break ===
  test(
    `[${lang}] Factor notes in modal have word-break`,
    containsText(html, 'line-height:1.4;word-break:break-word">${f.note}')
  );

  // === TEST 19: Dimension description word-break ===
  test(
    `[${lang}] Dimension description in modal has word-break`,
    containsText(html, 'line-height:1.5;word-break:break-word">${d.description}')
  );

  // === TEST 20: Modal header word-break ===
  test(
    `[${lang}] Modal header title has word-break`,
    containsText(html, 'color:#0f172a;word-break:break-word">${domain.name}')
  );

  // === TEST 21: Search result title word-break ===
  test(
    `[${lang}] .sr-item-title has word-break`,
    hasCSS(html, '.sr-item-title', 'word-break')
  );

  // === TEST 22: Source link word-break ===
  test(
    `[${lang}] Source link span has word-break`,
    containsText(html, 'color:#64748b;word-break:break-word">📍')
  );
}

// === Summary ===
console.log('\n' + '═'.repeat(50));
console.log(`📊 Results: ${passed}/${totalTests} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\n❌ Failures:');
  failures.forEach(f => console.log(`   • ${f}`));
  process.exit(1);
} else {
  console.log('\n✅ All overflow checks passed!');
  process.exit(0);
}
