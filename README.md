# KnowledgeLens

**A closed-loop knowledge management system powered by LLM agents — automatically evolves your knowledge base as you learn.**

<p align="center">
  <a href="https://acssiy.github.io/knowledgelens/zh/demo-report.html">中文 Demo</a> •
  <a href="https://acssiy.github.io/knowledgelens/en/demo-report.html">English Demo</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#agent-architecture">Architecture</a>
</p>

---

## Why This Exists

You learn from everywhere — Obsidian, Apple Notes, AI conversations, courses, books. But knowledge without structure is just noise.

Most tools give you a **one-shot snapshot**. KnowledgeLens gives you a **living system**:

| Traditional Approach | KnowledgeLens |
|---------------------|---------------|
| Full re-scan every time | Incremental ingest — only processes what changed |
| Static report | Evolving knowledge graph with score tracking |
| Manual categorization | LLM-driven classification with evidence chains |
| No memory between sessions | Persistent wiki with hot-index context injection |

The core insight: **knowledge management is a continuous learning loop, not a one-time generation task.**


## System Design

```
┌─────────────────────────────────────────────────────────┐
│                    Knowledge Loop                         │
│                                                          │
│   Notes ──→ Detect ──→ Ingest ──→ Evolve ──→ Query     │
│     ↑                                          │        │
│     └──────────── Learn + Create ←─────────────┘        │
└─────────────────────────────────────────────────────────┘
```

Two-layer architecture separating **deterministic operations** from **LLM reasoning**:

- **Deterministic layer**: file scanning, SHA-256 diffing, JSON persistence, score arithmetic — zero LLM cost, fully testable
- **LLM reasoning layer**: knowledge extraction, level assessment, contradiction detection, query synthesis — invoked only when human judgment is needed


## Agent Architecture

KnowledgeLens operates through two specialized LLM agent modes:

### Ingest Agent

Processes new/modified files and evolves the knowledge base.

```
diff-scan.js (SHA-256)     ← deterministic change detection
       │
ingest.js (prepare)        ← context assembly: index + file contents + prompt
       │
     [LLM]                 ← reasoning: add / update / skip / contradict
       │
ingest.js (apply)          ← structured update to wiki state
```

**Key design decisions:**
- **Two-phase orchestration** — separates "prepare context" from "apply response", making the pipeline LLM-agnostic and testable without API calls
- **Evidence-required policy** — every knowledge item must cite source file + relevant quote; no hallucinated knowledge enters the system
- **Contradiction detection** — when new info conflicts with existing items, marks `[!contradiction]` rather than silently overwriting
- **Score adjustment algebra** — mastery levels (basic/intermediate/advanced) map to score deltas, keeping the scoring model consistent across ingests

### Query Agent

Answers questions about your knowledge base with full context awareness.

```
hot-index.js               ← compressed ~500-word KB summary (always injected)
       │
query.js                   ← keyword relevance → top-5 page selection
       │
     [LLM]                 ← synthesize answer + decide: persist or discard
```

**Key design decisions:**
- **Hot-index injection** — every LLM call receives a compressed summary of the entire KB state, so it always knows "what exists" without reading every page
- **Persist-or-discard pattern** — if an answer reveals cross-domain connections or new patterns, the agent flags it for persistence back into the wiki
- **Context window management** — only top-5 relevant pages are loaded (keyword relevance scoring), keeping token usage bounded while maximizing answer quality


## Knowledge Health System

Beyond ingest and query, a `lint.js` health checker runs 6 automated checks:

| Check | What It Catches |
|-------|----------------|
| Score drift | 70% advanced items but score < 6? Something's wrong |
| Broken references | Gap points to non-existent item ID |
| Empty categories | Structural nodes with no content |
| Missing concepts | Referenced 3+ times but no dedicated page |
| Orphan items | Knowledge not linked to any domain |
| Stale gaps | Marked "to improve" but evidence already exists |

Output: a 0–100 health score with actionable diagnostics.


## File Watcher

`watch.js` implements a hybrid detection strategy:

- **`fs.watch`** for instant OS-level notifications (where supported)
- **Polling fallback** for cross-platform reliability
- **Debouncing** to batch rapid edits into a single check

Critically, the watcher **notifies but never auto-calls LLM** — you control when (and how much) AI processing happens. This is a deliberate cost/control tradeoff.


## Quick Start

```bash
git clone https://github.com/acssiy/knowledgelens.git
cd knowledgelens && npm install
```

**Generate your first knowledge report** (one-shot mode):

```bash
cd zh && chmod +x install.sh && ./install.sh   # 中文
cd en && chmod +x install.sh && ./install.sh   # English
```

**Run the incremental knowledge system** (continuous mode):

```bash
# Detect changes since last ingest
npm run scan -- ~/your-notes

# Prepare context → send to LLM → apply structured response
npm run ingest -- ~/your-notes
npm run ingest -- ~/your-notes --apply response.json

# Query your knowledge base
npm run query -- "What do I know about distributed systems?"

# Auto-watch for changes
npm run watch -- ~/your-notes --interval 30

# Health check
npm run lint:wiki
```

**Supported AI platforms:**

| Platform | Integration |
|----------|-------------|
| Claude Code | `/knowledgelens` slash command |
| Cursor | "run KnowledgeLens" |
| Windsurf | "run KnowledgeLens" |
| GitHub Copilot | "run KnowledgeLens" |
| ChatGPT | Custom Instructions |


## Supported Knowledge Sources

| Source | Method |
|--------|--------|
| Obsidian / Logseq | Scan vault folder directly |
| Apple Notes | Auto-read via AppleScript (macOS) |
| Notion / Bear / Roam / Flomo | Export as Markdown, then scan |
| AI chat exports | Export as JSON/Markdown |
| Course notes, book highlights | Any Markdown / text files |


## Technical Details

**Pipeline scripts:**

| Script | Layer | Role |
|--------|-------|------|
| `diff-scan.js` | Deterministic | SHA-256 incremental file detection |
| `ingest.js` | Orchestration | Two-phase prepare/apply pipeline |
| `double-write.js` | Deterministic | Dedup merge + wiki page persistence |
| `hot-index.js` | Deterministic | Compressed context summary generation |
| `query.js` | Orchestration | Relevance matching + context assembly |
| `watch.js` | Deterministic | Hybrid fs.watch + polling file monitor |
| `lint.js` | Deterministic | 6-type knowledge health checker |
| `wiki-generate.js` | Orchestration | Wiki-to-report HTML assembler |

**Testing:** 65 tests covering all pipeline stages (`npm test`). Tests run against mock data — no LLM calls required.

**Data format:** JSON-based wiki with schema validation. `index.json` as directory, per-domain pages, append-only `log.json` for audit trail.


## Design Philosophy

1. **Deterministic where possible, LLM where necessary** — hash comparison, score math, and file I/O are all code; LLM only handles semantic understanding
2. **Incremental over full-scan** — SHA-256 diffing means cost scales with *changes*, not *total knowledge*
3. **Evidence over hallucination** — every item traces to a real source; the system refuses to fabricate knowledge
4. **Bounded context, unbounded knowledge** — hot-index compression + relevance filtering keeps LLM calls efficient regardless of KB size
5. **Human in the loop** — watcher notifies, never auto-ingests; you decide when AI processes your notes


## Roadmap

| Feature | Status |
|---------|--------|
| One-shot knowledge report generation | ✅ Shipped |
| Incremental ingest pipeline | ✅ Shipped |
| Query agent with context injection | ✅ Shipped |
| File watcher with auto-detection | ✅ Shipped |
| Knowledge health scoring | ✅ Shipped |
| Spaced repetition integration | Exploring |
| Goal-driven learning paths | Exploring |
| Multi-user knowledge graphs | Exploring |


## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for architecture details and testing.


## License

MIT
