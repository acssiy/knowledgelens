# KnowledgeLens

**AI-powered knowledge management and visualization across all your learning sources.**

<p align="center">
  <a href="https://acssiy.github.io/knowledgelens/zh/demo-report.html">中文 Demo</a> •
  <a href="https://acssiy.github.io/knowledgelens/en/demo-report.html">English Demo</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#vision--roadmap">Roadmap</a>
</p>

KnowledgeLens connects to your AI coding assistant and turns scattered notes across multiple tools into a **structured, visual knowledge system** — helping you see what you know, find what you're missing, and learn what matters next.


## The Problem

You learn from everywhere — Obsidian, Apple Notes, AI conversations, courses, books. But:

- **Knowledge is fragmented** — scattered across tools with no unified view
- **No structure** — you can't see how things connect across domains
- **No feedback loop** — you don't know what's missing or what to prioritize
- **Learning feels aimless** — no clear path from where you are to where you want to be

You have the raw material. What's missing is the system to organize, evaluate, and guide your learning.


## What You Get

An interactive knowledge visualization system that:

- **Aggregates** — pulls knowledge from all your sources into one unified view
- **Structures** — organizes into Domain → Category → Item with connections mapped
- **Evaluates** — scores each dimension on breadth, depth, and application ability
- **Documents** — creates structured knowledge summaries linked to your original notes
- **Advises** — expert panel provides targeted learning recommendations
- **Guides** — identifies gaps and prioritizes what to learn next

Output: a single offline HTML file with radar charts, knowledge trees, expert advice, full-text search, and a prioritized learning roadmap.


## Quick Start

3 steps, under 2 minutes:

```bash
# 中文用户
git clone https://github.com/acssiy/knowledgelens.git
cd knowledgelens/zh && chmod +x install.sh && ./install.sh

# English users
git clone https://github.com/acssiy/knowledgelens.git
cd knowledgelens/en && chmod +x install.sh && ./install.sh
```

The installer asks which AI platform you use, then auto-configures everything. After that, just ask your AI to "run KnowledgeLens".

**Supported platforms:**

| Platform | How to Trigger |
|----------|----------------|
| Claude Code | Type `/knowledgelens` |
| Cursor | Say "run KnowledgeLens" |
| Windsurf | Say "run KnowledgeLens" |
| GitHub Copilot | Say "run KnowledgeLens" |
| ChatGPT | Paste into Custom Instructions |


## Supported Knowledge Sources

Works with wherever you learn:

| Source | Method |
|--------|--------|
| Obsidian / Logseq | Scan vault folder directly |
| Apple Notes | Auto-read via AppleScript (macOS) |
| Notion / Bear / Roam / Flomo | Export as Markdown, then scan |
| AI chat exports (ChatGPT, Claude) | Export as JSON/Markdown |
| Course notes, book highlights | Any Markdown / text files |


## How It Works

```
Your Notes → AI Analysis → Structured JSON → HTML Template → Interactive Knowledge Visualization
```

1. AI reads your notes, identifies knowledge domains
2. Extracts items, evaluates mastery, identifies gaps
3. Scores each dimension with sub-factors (breadth/depth/application)
4. Expert panel generates role-specific recommendations
5. JSON injected into template → self-contained interactive HTML (offline, zero dependencies)

Design principles:
- Every score is evidence-based, citing your actual notes
- Won't fabricate knowledge you don't have
- Schema-validated data ensures template compatibility


## Language Packages

| | 中文版 | English |
|---|---|---|
| Package | [`zh/`](zh/) | [`en/`](en/) |
| Documentation | [`zh/README.md`](zh/README.md) | [`en/README.md`](en/README.md) |
| Live Demo | [中文 Demo](https://acssiy.github.io/knowledgelens/zh/demo-report.html) | [English Demo](https://acssiy.github.io/knowledgelens/en/demo-report.html) |

Each folder is a complete, standalone package. Pick one, download it, and you're set.


## Vision & Roadmap

KnowledgeLens today: **Aggregate → Structure → Visualize**

Where we're going: **Aggregate → Structure → Visualize → Learn → Re-assess**

| Feature | Description | Status |
|---------|-------------|--------|
| AI-assisted learning | Personalized exercises and materials for weak areas | Planned |
| Progress tracking | Re-scan periodically, visualize growth over time | Planned |
| Smart recommendations | AI suggests what to learn next based on your goals | Planned |
| Spaced repetition | Surface knowledge at risk of being forgotten | Exploring |
| Goal-driven paths | Set a target skill, get a personalized curriculum | Exploring |

The end goal: a closed-loop knowledge management system where AI helps you **see your knowledge → learn what matters → verify mastery → repeat**.


## Contributing

PRs and issues welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for architecture and testing details.


## License

MIT
