# Contributing Guide

## Project Overview

KnowledgeLens is a multi-source knowledge management and visualization tool. It aggregates notes from various platforms, structures them into scored domains with expert evaluations, and produces a single interactive HTML file with radar charts, knowledge trees, learning recommendations, and gap analysis.

## Architecture

```
knowledgelens/
├── README.md                   # Project overview (GitHub landing page)
├── CONTRIBUTING.md             # This file (developer notes)
├── .gitignore                  # Excludes OS/editor files
├── zh/                         # Chinese (standalone package)
│   ├── README.md
│   ├── install.sh
│   ├── prompt.md
│   ├── template.html
│   ├── data-schema.json
│   └── demo-report.html
├── en/                         # English (standalone package)
│   ├── README.md
│   ├── install.sh
│   ├── prompt.md
│   ├── template.html
│   ├── data-schema.json
│   └── demo-report.html
└── tests/                      # Maintainer-only regression tests
    └── check-overflow.js       # CSS/layout overflow checks (both langs)
```

## Testing

Run the layout/overflow regression test suite:

```bash
node tests/check-overflow.js
```

This checks both `zh/template.html` and `en/template.html` for 27 CSS/layout overflow protections per language (54 total assertions). Run after any template CSS/JS changes.

**What it checks:**
- Radar chart label wrapping and margin
- Score row, domain tabs, knowledge items, summary cards overflow
- Gap cards, nav items, expert opinions word-break
- Dimension modal (header, description, factor notes) overflow
- Search result titles, source links word-break
- D3.js inline embedding, no external dependencies
- Responsive breakpoints (1024px, 768px)

## How It Works

1. User runs the install script, picks platform + language
2. Triggers the prompt in their AI assistant
3. Pipeline scans user's notes → proposes domains → user confirms → generates JSON → injects into template → outputs HTML
4. The output HTML is fully standalone — D3.js is embedded inline, works offline, zero external dependencies

## Key Files

- **`schema/data-schema.json`**: The contract between generation pipeline and template. All generated data must validate against this schema. `additionalProperties: false` everywhere.
- **`zh/template.html`** / **`en/template.html`**: Generic templates. Data goes into `const KNOWLEDGELENS_DATA = {};`. Contains `runSelfTest()` for data integrity validation.
- **`zh/prompt.md`** / **`en/prompt.md`**: Core prompts (platform-agnostic). 3-step pipeline with 2 user confirmation points. `install.sh` adapts them to each platform's format.

## Critical Rules

- **No fabrication**: Every knowledge item must trace to real content in user's notes
- **Accurate source labels**: `source-original` for real notes, `source-ai` for AI analysis
- **Schema compliance**: `scores` is `[{label, value}]` paired array (NOT `{labels[], values[]}`)
- **Self-repair**: Fix format issues automatically, only ask user when data is insufficient
- **Template field names**: categories use `name` (not `category`), items use `name` (not `title`)

## Internationalization

The project supports both Chinese and English, organized by folder:
- `zh/` — Chinese prompt, template, README, demo
- `en/` — English prompt, template, README, demo

The JSON schema enum values (level, priority) are always Chinese. The English template maps them to English display labels internally via `LEVEL_DISPLAY`, `PRIORITY_DISPLAY`, `GAP_TYPE_DISPLAY` helpers.

## Common Pitfalls

1. Category objects need `name` field, not `category` — template reads `cat.name`
2. Domain objects need `subtitle` field — template renders it under domain name
3. Expert `name` must match one of `domain.expertRoles`
4. `gap.from` contains item IDs (like `"ai-0-3"`), not item names
5. `</script>` in JSON strings must be escaped as `<\/script>` when injecting into HTML
