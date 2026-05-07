#!/bin/bash
# KnowledgeLens 安装脚本（中文版）
# 支持 Claude Code、Cursor、Windsurf、GitHub Copilot、ChatGPT

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROMPT="$SCRIPT_DIR/prompt.md"
SCHEMA="$SCRIPT_DIR/data-schema.json"
TEMPLATE="$SCRIPT_DIR/template.html"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${CYAN}🔬 KnowledgeLens 安装向导${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

for f in "$PROMPT" "$SCHEMA" "$TEMPLATE"; do
  if [ ! -f "$f" ]; then
    echo -e "${RED}❌ 找不到文件: $f${NC}"
    echo "请在 knowledgelens/zh/ 目录下运行此脚本。"
    exit 1
  fi
done

echo "选择安装平台（可多选，空格分隔）："
echo ""
echo "  1) Claude Code      — .claude/commands/ 斜杠命令"
echo "  2) Cursor            — .cursor/rules/ 规则文件"
echo "  3) Windsurf          — .windsurf/rules/ 规则文件"
echo "  4) GitHub Copilot    — .github/copilot-instructions.md"
echo "  5) ChatGPT           — 生成 Custom Instructions 文件"
echo "  6) 全部安装"
echo ""
read -p "请输入编号 (如 1 3 5): " -a choices

for c in "${choices[@]}"; do
  if [ "$c" = "6" ]; then choices=(1 2 3 4 5); break; fi
done

echo ""
read -p "安装到哪个项目目录？（默认: 当前目录）: " target_dir
target_dir="${target_dir:-.}"
target_dir="$(cd "$target_dir" && pwd)"

echo ""
echo -e "${CYAN}📦 开始安装...${NC}"
echo ""

# 提取 prompt body（去掉第一行标题）
PROMPT_BODY=$(tail -n +3 "$PROMPT")

generate_header() {
  local platform=$1
  case $platform in
    claude)
      echo "# KnowledgeLens — 知识体检报告生成器"
      echo ""
      echo "> Claude Code 斜杠命令。运行 /knowledgelens 开始生成知识体检报告。"
      ;;
    cursor)
      echo "---"
      echo "description: KnowledgeLens 知识体检报告生成器"
      echo 'globs: "**/*"'
      echo "alwaysApply: false"
      echo "---"
      echo ""
      echo "# KnowledgeLens — 知识体检报告生成器"
      echo ""
      echo "> 当用户说\"生成知识体检报告\"或\"knowledgelens\"时，执行以下流程。"
      ;;
    windsurf)
      echo "---"
      echo "trigger: knowledgelens"
      echo "description: KnowledgeLens 知识体检报告生成器"
      echo "---"
      echo ""
      echo "# KnowledgeLens — 知识体检报告生成器"
      echo ""
      echo "> 当用户说\"生成知识体检报告\"或\"knowledgelens\"时，执行以下流程。"
      ;;
    copilot)
      echo "## KnowledgeLens — 知识体检报告生成器"
      echo ""
      echo "当用户请求生成知识体检报告或提到 knowledgelens 时，执行以下流程。"
      ;;
    chatgpt)
      echo "# KnowledgeLens — 知识体检报告生成器"
      echo ""
      echo "## Custom Instructions（粘贴到 ChatGPT 的 Custom Instructions 或 Project 指令中）"
      echo ""
      echo "当用户说\"生成知识体检报告\"时，执行以下流程。"
      echo "注意：ChatGPT 环境下无法直接读取本地文件，请让用户将笔记内容粘贴或上传。"
      ;;
  esac
}

generate_platform_note() {
  local platform=$1
  case $platform in
    chatgpt)
      echo ""
      echo "> ⚠️ 平台适配说明："
      echo "> - ChatGPT 环境下，用户需要直接粘贴或上传笔记内容（不支持本地文件扫描）"
      echo "> - Apple Notes 读取不可用，请让用户手动导出"
      echo "> - 输出 JSON 数据后，需要用户自行注入模板（或提供完整 HTML）"
      ;;
    copilot)
      echo ""
      echo "> 平台说明：执行此流程时，请读取项目中的 schema/data-schema.json 和 template/report.html 文件。"
      ;;
  esac
}

assemble_prompt() {
  local platform=$1
  generate_header "$platform"
  generate_platform_note "$platform"
  echo ""
  echo "$PROMPT_BODY"
}

copy_support_files() {
  local tdir=$1
  mkdir -p "$tdir/schema" "$tdir/template"
  cp "$SCHEMA" "$tdir/schema/data-schema.json"
  cp "$TEMPLATE" "$tdir/template/report.html"
}

installed=()
support_copied=false

for choice in "${choices[@]}"; do
  case $choice in
    1)
      dest="$target_dir/.claude/commands"
      mkdir -p "$dest"
      cp "$PROMPT" "$dest/knowledgelens.md"
      if [ "$support_copied" = false ]; then copy_support_files "$target_dir"; support_copied=true; fi
      echo -e "  ${GREEN}✅ Claude Code${NC} → $dest/knowledgelens.md"
      installed+=("Claude Code: 运行 /knowledgelens")
      ;;
    2)
      dest="$target_dir/.cursor/rules"
      mkdir -p "$dest"
      assemble_prompt "cursor" > "$dest/knowledgelens.mdc"
      if [ "$support_copied" = false ]; then copy_support_files "$target_dir"; support_copied=true; fi
      echo -e "  ${GREEN}✅ Cursor${NC} → $dest/knowledgelens.mdc"
      installed+=("Cursor: 对话中说\"生成知识体检报告\"")
      ;;
    3)
      dest="$target_dir/.windsurf/rules"
      mkdir -p "$dest"
      assemble_prompt "windsurf" > "$dest/knowledgelens.md"
      if [ "$support_copied" = false ]; then copy_support_files "$target_dir"; support_copied=true; fi
      echo -e "  ${GREEN}✅ Windsurf${NC} → $dest/knowledgelens.md"
      installed+=("Windsurf: 对话中说\"生成知识体检报告\"")
      ;;
    4)
      dest="$target_dir/.github"
      mkdir -p "$dest"
      if [ -f "$dest/copilot-instructions.md" ]; then
        { echo ""; echo "---"; echo ""; assemble_prompt "copilot"; } >> "$dest/copilot-instructions.md"
        echo -e "  ${GREEN}✅ GitHub Copilot${NC} → 追加到 $dest/copilot-instructions.md"
      else
        assemble_prompt "copilot" > "$dest/copilot-instructions.md"
        echo -e "  ${GREEN}✅ GitHub Copilot${NC} → $dest/copilot-instructions.md"
      fi
      if [ "$support_copied" = false ]; then copy_support_files "$target_dir"; support_copied=true; fi
      installed+=("GitHub Copilot: 在 Copilot Chat 中说\"生成知识体检报告\"")
      ;;
    5)
      assemble_prompt "chatgpt" > "$target_dir/knowledgelens-chatgpt.md"
      echo -e "  ${GREEN}✅ ChatGPT${NC} → $target_dir/knowledgelens-chatgpt.md"
      echo -e "     ${YELLOW}📋 将文件内容粘贴到 ChatGPT → Settings → Custom Instructions${NC}"
      installed+=("ChatGPT: 粘贴 knowledgelens-chatgpt.md 到 Custom Instructions")
      ;;
    *)
      echo -e "  ${YELLOW}⚠️  未知选项: $choice，跳过${NC}"
      ;;
  esac
done

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 安装完成！${NC}"
echo ""
echo "使用方式："
for item in "${installed[@]}"; do
  echo -e "  • $item"
done
echo ""
echo -e "📁 schema 和 template 已复制到: ${CYAN}$target_dir${NC}"
echo ""
