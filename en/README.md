# 🔬 KnowledgeLens (English)

> Multi-source knowledge management, visualization, and AI-guided learning

## ✨ Features

- 📊 **Multi-domain radar charts** — visualize mastery across dimensions
- 🧮 **Dimension sub-factor scoring** — breadth, depth, and application per dimension
- 🌳 **Knowledge tree** — Domain → Category → Item three-level structure
- 🎓 **Expert panel advice** — role-based actionable recommendations
- 🚀 **Knowledge gap analysis** — prioritized improvement paths
- 🔍 **Full-text search** — instant cross-domain search
- 📄 **Single-file output** — opens in browser, works offline, zero dependencies

## 🚀 Quick Start

### 1. Download and run the installer

```bash
git clone https://github.com/acssiy/knowledgelens.git
cd knowledgelens/en
chmod +x install.sh
./install.sh
```

### 2. Choose your AI platform

The installer will ask you to select your platform and auto-configure:

| Platform | Install Location | How to Trigger |
|----------|-----------------|----------------|
| Claude Code | `.claude/commands/knowledgelens.md` | Type `/knowledgelens` |
| Cursor | `.cursor/rules/knowledgelens.mdc` | Say "run KnowledgeLens" |
| Windsurf | `.windsurf/rules/knowledgelens.md` | Say "run KnowledgeLens" |
| GitHub Copilot | `.github/copilot-instructions.md` | Say "run KnowledgeLens" |
| ChatGPT | `knowledgelens-chatgpt.md` | Paste into Custom Instructions |

You can select multiple platforms at once.

### 3. Trigger in your AI tool

After installation, trigger KnowledgeLens in your chosen platform and follow the prompts:

1. **Choose knowledge source** — local folder or Apple Notes
2. **Confirm configuration** — domain structure, benchmarks, expert roles
3. **Wait for generation** — AI extracts knowledge structure, generates scores and advice
4. **View result** — open the generated HTML file in your browser

## 📚 Supported Knowledge Sources

| Source | Method |
|--------|--------|
| Obsidian / Logseq | Scan vault folder directly |
| Apple Notes | Auto-read via AppleScript (macOS) |
| Notion / Bear / Roam / Flomo | Export as Markdown, then scan |
| AI chat exports | Export as JSON/Markdown |
| Any Markdown / text files | Scan directly |

## 📁 Package Contents

```
en/
├── README.md           ← This file
├── install.sh          ← One-click installer (run this)
├── prompt.md           ← AI generation pipeline instructions
├── template.html       ← HTML template with D3.js embedded
├── data-schema.json    ← JSON data format contract
└── demo-report.html    ← Example output (open in browser to preview)
```

## 🎯 View Demo

Open `demo-report.html` in your browser to see an example.

## 📐 How It Works

```
Your Notes → AI Analysis → JSON Data → Inject Template → Interactive Knowledge Visualization
```

- All scores are based on your actual notes content
- Will not fabricate knowledge you don't have
- Single-file output, works offline, zero external dependencies

## 📄 License

MIT
