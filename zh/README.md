# 🔬 KnowledgeLens（中文版）

> 把你的笔记变成一份交互式知识体检报告

## ✨ 特性

- 📊 **多领域雷达图** — 直观展示各维度知识掌握程度
- 🧮 **维度因子评分** — 每个维度拆分广度/深度/应用三项细评
- 🌳 **知识树结构** — 领域→类别→知识点三层组织
- 🎓 **专家建议** — 角色化专家的针对性建议
- 🚀 **知识缺口分析** — 按优先级排序的提升路径
- 🔍 **全文搜索** — 跨领域即时搜索
- 📄 **单文件输出** — 浏览器直接打开，离线可用，零依赖

## 🚀 快速开始

### 1. 下载并运行安装脚本

```bash
git clone https://github.com/acssiy/knowledgelens.git
cd knowledgelens/zh
chmod +x install.sh
./install.sh
```

### 2. 选择你的 AI 平台

安装脚本会让你选择平台，自动配置：

| 平台 | 安装位置 | 触发方式 |
|------|----------|----------|
| Claude Code | `.claude/commands/knowledgelens.md` | 输入 `/knowledgelens` |
| Cursor | `.cursor/rules/knowledgelens.mdc` | 说「生成知识体检报告」|
| Windsurf | `.windsurf/rules/knowledgelens.md` | 说「生成知识体检报告」|
| GitHub Copilot | `.github/copilot-instructions.md` | 说「生成知识体检报告」|
| ChatGPT | `knowledgelens-chatgpt.md` | 粘贴到 Custom Instructions |

支持多选，一次安装到多个平台。

### 3. 在 AI 中触发

安装完成后，在你选的平台中触发 KnowledgeLens，按提示操作：

1. **选择知识来源** — 本地文件夹 或 Apple Notes
2. **确认配置** — 领域划分、评估基准、专家角色
3. **等待生成** — AI 自动提取知识结构、生成评分和建议
4. **查看报告** — 浏览器打开生成的 HTML 文件

## 📚 支持的知识来源

| 来源 | 方式 |
|------|------|
| Obsidian / Logseq | 直接扫描 vault 文件夹 |
| Apple Notes | AppleScript 自动读取（macOS）|
| Notion / Bear / Roam / Flomo | 导出为 Markdown 后扫描 |
| AI 对话记录 | 导出为 JSON/Markdown |
| 纯文本/Markdown | 直接扫描 |

## 📁 本包文件说明

```
zh/
├── README.md           ← 本文件
├── install.sh          ← 一键安装脚本（运行这个即可）
├── prompt.md           ← AI 生成流水线指令
├── template.html       ← 报告 HTML 模板（D3.js 已内嵌）
├── data-schema.json    ← JSON 数据格式约定
└── demo-report.html    ← 示例报告（浏览器打开查看效果）
```

## 🎯 查看示例

直接在浏览器中打开 `demo-report.html` 查看示例效果。

## 📐 工作原理

```
你的笔记 → AI 分析 → JSON 数据 → 注入模板 → 交互式 HTML 报告
```

- 所有评分基于你的真实笔记内容
- 不会编造你没有的知识
- 单文件输出，无需服务器，完全离线可用

## 📄 License

MIT
