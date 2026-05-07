# KnowledgeLens

**Turn your notes into an interactive knowledge health report.**

<p align="center">
  <a href="https://acssiy.github.io/knowledgelens/zh/demo-report.html">中文 Demo</a> •
  <a href="https://acssiy.github.io/knowledgelens/en/demo-report.html">English Demo</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#vision--roadmap">Roadmap</a>
</p>

KnowledgeLens scans your knowledge base (Markdown, Apple Notes, text files, etc.), analyzes your knowledge structure, and generates a **single self-contained HTML report** — with radar charts, expert advice, knowledge gaps, and improvement paths. No server, no account, no subscription. One HTML file, works offline.


## The Problem

You've been learning for months — notes in Obsidian, highlights in Apple Notes, saved AI conversations. But you can't answer:

- **What do I actually know?** Notes scattered, no big picture.
- **Where are my gaps?** You don't know what you don't know.
- **What should I learn next?** No prioritized path forward.

Most people have hundreds of notes but zero clarity on their knowledge structure.


## What You Get

A single HTML report containing:

- **Multi-domain radar chart** — competency at a glance
- **Dimension sub-factor scoring** — breadth, depth, and application per dimension
- **Knowledge tree** — Domain → Category → Item, with connections
- **Knowledge documents** — each item links to a structured summary extracted from your notes
- **Expert panel advice** — role-based actionable recommendations
- **Knowledge gap analysis** — prioritized improvement paths with expert guidance
- **Full-text search** — instant search across all domains

Single file. Fully offline. Zero external dependencies.


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

The installer asks which AI platform you use, then auto-configures everything. After that, just ask your AI to "generate a knowledge report".

**Supported platforms:**

| Platform | How to Trigger |
|----------|----------------|
| Claude Code | Type `/knowledgelens` |
| Cursor | Say "generate knowledge report" |
| Windsurf | Say "generate knowledge report" |
| GitHub Copilot | Say "generate knowledge report" |
| ChatGPT | Paste into Custom Instructions |


## Supported Knowledge Sources

| Source | Method |
|--------|--------|
| Obsidian / Logseq | Scan vault folder directly |
| Apple Notes | Auto-read via AppleScript (macOS) |
| Notion / Bear / Roam / Flomo | Export as Markdown, then scan |
| AI chat exports | Export as JSON/Markdown |
| Any Markdown / text files | Scan directly |


## How It Works

```
Your Notes → AI Analysis → Structured JSON → HTML Template → Interactive Report
```

1. AI reads your notes, identifies knowledge domains
2. Extracts items, evaluates mastery, identifies gaps
3. Scores each dimension with sub-factors (breadth/depth/application)
4. Expert panel generates role-specific recommendations
5. JSON injected into template → self-contained HTML report

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

Each folder is a complete, self-contained package. Pick one, download it, and you're set.


## Vision & Roadmap

KnowledgeLens today: **Scan → Diagnose → Visualize**

Where we're going: **Scan → Diagnose → Learn → Re-assess → Repeat**

| Feature | Description | Status |
|---------|-------------|--------|
| AI-assisted learning | Personalized exercises for your weak areas | Planned |
| Progress tracking | Re-scan periodically, visualize growth over time | Planned |
| Smart recommendations | AI suggests what to learn next based on goals | Planned |
| Spaced repetition | Surface knowledge at risk of being forgotten | Exploring |
| Goal-driven paths | Set a target skill, get a personalized curriculum | Exploring |

The end goal: a closed-loop system where AI helps you **identify gaps → learn effectively → verify mastery → repeat**.


## Contributing

PRs and issues welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for architecture and testing details.


## License

MIT
