# 🔬 KnowledgeLens

**Turn your notes into an interactive knowledge health report.**

<p align="center">
  <a href="https://acssiy.github.io/knowledgelens/zh/demo-report.html">中文 Demo</a> •
  <a href="https://acssiy.github.io/knowledgelens/en/demo-report.html">English Demo</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-vision--roadmap">Roadmap</a>
</p>



## 💡 The Problem

You've been learning for months — taking notes in Obsidian, highlighting in Apple Notes, saving AI conversations. But you can't answer simple questions:

- **What do I actually know?** Notes scattered across tools, no big picture.
- **Where are my gaps?** You don't know what you don't know.
- **Am I making progress?** No way to measure growth over time.
- **What should I learn next?** No prioritized path forward.

Most people have 100s of notes but zero clarity on their knowledge structure. The notes exist, but the *insight* doesn't.



## 💡 The Solution

KnowledgeLens connects to your AI coding assistant and turns your entire knowledge base into a **single interactive HTML report** — a "health checkup" for your knowledge.

In one command, you get:

- A radar chart showing your competency across domains
- Every knowledge item scored, categorized, and linked to its source document
- Expert-panel advice tailored to your specific gaps
- A prioritized improvement roadmap

**No server. No account. No subscription. Just one HTML file that works offline.**



## ✨ What's in the Report

### 📊 Multi-Domain Radar Chart
Visualize your competency across knowledge areas at a glance. Each dimension is scored on breadth, depth, and application ability.

### 🧮 Dimension Sub-Factor Scoring
Every dimension breaks down into 3 factors:
- **Breadth** — how much content you've covered
- **Depth** — whether you've grasped core frameworks and evidence
- **Application** — whether you can transfer knowledge to real scenarios

### 🌳 Three-Level Knowledge Tree
Your knowledge organized as Domain → Category → Item, with connections between related items visible. Each item links to its **knowledge document** — a structured summary of what you know about that topic, extracted from your notes.

### 📄 Knowledge Documents
Every knowledge item has an associated document showing:
- Core concepts you've covered
- Key takeaways from your notes
- Connections to other items
- Mastery level with evidence

### 👨‍🏫 Expert Panel Advice
3 role-based experts (configured per domain) provide specific, actionable recommendations citing your actual notes.

### 🔍 Knowledge Gap Analysis
Gaps identified and prioritized by importance. Each gap includes:
- Why it matters
- What to learn
- Expert recommendations for closing it

### 🔎 Full-Text Search
Instantly search across all domains, knowledge items, and expert advice.

### 📄 Single File, Fully Offline
One HTML file (~350KB). No server, no build step, no internet connection required. D3.js visualization library is embedded inline.



## 🚀 Quick Start

**3 steps. Under 2 minutes.**

### Step 1: Clone and install

```bash
# 中文用户
git clone https://github.com/acssiy/knowledgelens.git
cd knowledgelens/zh && chmod +x install.sh && ./install.sh

# English users
git clone https://github.com/acssiy/knowledgelens.git
cd knowledgelens/en && chmod +x install.sh && ./install.sh
```

### Step 2: Choose your AI platform

The installer asks which platform you use and auto-configures everything:

| Platform | How to Trigger |
|----------|----------------|
| **Claude Code** | Type `/knowledgelens` |
| **Cursor** | Say "generate knowledge report" |
| **Windsurf** | Say "generate knowledge report" |
| **GitHub Copilot** | Say "generate knowledge report" |
| **ChatGPT** | Paste instructions into Custom Instructions |

You can install to multiple platforms at once.

### Step 3: Generate your report

Trigger KnowledgeLens in your AI tool. It will:

1. Ask you to choose your knowledge source (local folder, Apple Notes, etc.)
2. Scan your notes and propose a domain structure
3. Let you confirm/adjust the configuration
4. Generate your interactive HTML report

Open the HTML file in any browser. Done.



## 📚 Supported Knowledge Sources

| Source | Method |
|--------|--------|
| **Obsidian / Logseq** | Scan vault folder directly |
| **Apple Notes** | Auto-read via AppleScript (macOS) |
| **Notion / Bear / Roam / Flomo** | Export as Markdown, then scan |
| **AI chat exports (ChatGPT, Claude)** | Export as JSON/Markdown, then scan |
| **Any Markdown / text files** | Scan directly |

---

## 📦 Language Packages

| | 中文版 | English |
|---|---|---|
| **Package** | [`zh/`](zh/) | [`en/`](en/) |
| **Documentation** | [`zh/README.md`](zh/README.md) | [`en/README.md`](en/README.md) |
| **Live Demo** | [中文 Demo](https://acssiy.github.io/knowledgelens/zh/demo-report.html) | [English Demo](https://acssiy.github.io/knowledgelens/en/demo-report.html) |

Each folder is a **complete, self-contained package** — install script, AI prompt, HTML template, data schema, and demo report. Download one folder and you're set.



## 📐 How It Works

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Your Notes  │ ──▶ │ AI Platform  │ ──▶ │  JSON Data   │ ──▶ │  HTML Report     │
│ (Markdown,  │     │ (Claude,     │     │ (validated   │     │ (interactive,    │
│  Apple Notes│     │  Cursor,     │     │  against     │     │  single file,    │
│  text files)│     │  Windsurf...)│     │  schema)     │     │  works offline)  │
└─────────────┘     └──────────────┘     └──────────────┘     └─────────────────┘
```

**The pipeline:**
1. **Scan** — AI reads your notes recursively, identifies knowledge domains
2. **Analyze** — Extracts knowledge items, evaluates mastery levels, identifies gaps
3. **Score** — Generates dimension scores with sub-factor breakdowns (breadth/depth/application)
4. **Advise** — Expert panel provides role-specific recommendations
5. **Render** — Structured JSON is injected into the HTML template → interactive report

**Key design principles:**
- ✅ Every score is evidence-based, citing your actual notes
- ✅ Won't fabricate knowledge you don't have
- ✅ Source labels clearly mark what came from your notes vs. AI inference
- ✅ Schema-validated data ensures template compatibility



## 🖥️ Supported AI Platforms

| Platform | Install Location | Config Format |
|----------|-----------------|---------------|
| **Claude Code** | `.claude/commands/knowledgelens.md` | Raw Markdown |
| **Cursor** | `.cursor/rules/knowledgelens.mdc` | MDC with YAML frontmatter |
| **Windsurf** | `.windsurf/rules/knowledgelens.md` | Markdown with YAML header |
| **GitHub Copilot** | `.github/copilot-instructions.md` | Appended to existing file |
| **ChatGPT** | Standalone `.md` file | Copy into Custom Instructions |

The install script handles format differences automatically. You just pick your platform(s).



## 🔮 Vision & Roadmap

KnowledgeLens is the first step toward an **AI-powered learning loop**.

### Where we are now

```
📝 Notes → 🔬 Diagnosis → 📊 Visualization
```

You get a clear picture of what you know and where your gaps are.

### Where we're going

```
📝 Notes → 🔬 Diagnosis → 📊 Visualization → 🤖 AI Learning → 🔄 Re-assess
```

**Planned features:**

| Feature | Description | Status |
|---------|-------------|--------|
| 🤖 AI-assisted learning | Generate personalized exercises and study materials for your weak areas | Planned |
| 🔄 Progress tracking | Re-scan periodically, compare reports, visualize growth over time | Planned |
| 📬 Smart recommendations | AI suggests what to learn next based on your goals and current gaps | Planned |
| 🧠 Spaced repetition | Surface knowledge items that are at risk of being forgotten | Exploring |
| 🎯 Goal-driven paths | Set a target role/skill, get a personalized learning curriculum | Exploring |

**The end goal:** A closed-loop system where AI helps you **identify gaps → learn effectively → verify mastery → repeat** — turning passive note-taking into active, measurable learning.



## 📂 Repository Structure

```
knowledgelens/
├── README.md                ← You are here
├── CONTRIBUTING.md          ← For developers/contributors
├── .gitignore
├── zh/                      ← ��🇳 Self-contained Chinese package
├── en/                      ← 🇬🇧 Self-contained English package
└── tests/                   ← 🔧 Maintainer tooling
```

**Users:** You only need `zh/` or `en/`. Everything else is for contributors.

**Contributors:** See [`CONTRIBUTING.md`](CONTRIBUTING.md) for architecture, design decisions, and how to run tests.



## 🤝 Contributing

PRs and issues welcome! Areas where help is appreciated:

- 🎨 Report themes and visual improvements
- 🌐 New language packages (ja, ko, etc.)
- 📊 Additional visualization types
- 🔌 New AI platform integrations
- 📝 Knowledge source connectors



## 📄 License

MIT — use it however you want.
