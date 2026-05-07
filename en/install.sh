#!/bin/bash
# KnowledgeLens Install Script (English)
# Supports: Claude Code, Cursor, Windsurf, GitHub Copilot, ChatGPT

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
echo -e "${CYAN}🔬 KnowledgeLens Installer${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

for f in "$PROMPT" "$SCHEMA" "$TEMPLATE"; do
  if [ ! -f "$f" ]; then
    echo -e "${RED}❌ File not found: $f${NC}"
    echo "Please run this script from the knowledgelens/en/ directory."
    exit 1
  fi
done

echo "Choose platform(s) to install (space-separated):"
echo ""
echo "  1) Claude Code      — .claude/commands/ slash command"
echo "  2) Cursor            — .cursor/rules/ rule file"
echo "  3) Windsurf          — .windsurf/rules/ rule file"
echo "  4) GitHub Copilot    — .github/copilot-instructions.md"
echo "  5) ChatGPT           — generate Custom Instructions file"
echo "  6) All platforms"
echo ""
read -p "Enter number(s) (e.g. 1 3 5): " -a choices

for c in "${choices[@]}"; do
  if [ "$c" = "6" ]; then choices=(1 2 3 4 5); break; fi
done

echo ""
read -p "Target project directory (default: current dir): " target_dir
target_dir="${target_dir:-.}"
target_dir="$(cd "$target_dir" && pwd)"

echo ""
echo -e "${CYAN}📦 Installing...${NC}"
echo ""

PROMPT_BODY=$(tail -n +3 "$PROMPT")

generate_header() {
  local platform=$1
  case $platform in
    claude)
      echo "# KnowledgeLens — Knowledge Health Report Generator"
      echo ""
      echo "> Claude Code slash command. Run /knowledgelens to generate a knowledge health report."
      ;;
    cursor)
      echo "---"
      echo "description: KnowledgeLens — Knowledge Health Report Generator"
      echo 'globs: "**/*"'
      echo "alwaysApply: false"
      echo "---"
      echo ""
      echo "# KnowledgeLens — Knowledge Health Report Generator"
      echo ""
      echo '> When the user says "generate knowledge report" or "knowledgelens", execute the following pipeline.'
      ;;
    windsurf)
      echo "---"
      echo "trigger: knowledgelens"
      echo "description: KnowledgeLens — Knowledge Health Report Generator"
      echo "---"
      echo ""
      echo "# KnowledgeLens — Knowledge Health Report Generator"
      echo ""
      echo '> When the user says "generate knowledge report" or "knowledgelens", execute the following pipeline.'
      ;;
    copilot)
      echo "## KnowledgeLens — Knowledge Health Report Generator"
      echo ""
      echo 'When the user says "generate knowledge report" or "knowledgelens", execute the following pipeline.'
      ;;
    chatgpt)
      echo "# KnowledgeLens — Knowledge Health Report Generator"
      echo ""
      echo "## Custom Instructions (paste into ChatGPT → Settings → Custom Instructions or Project instructions)"
      echo ""
      echo 'When the user says "generate knowledge report" or "knowledgelens", execute the following pipeline.'
      echo "Note: ChatGPT cannot read local files directly. Ask the user to paste or upload their notes."
      ;;
  esac
}

generate_platform_note() {
  local platform=$1
  case $platform in
    chatgpt)
      echo ""
      echo "> ⚠️ Platform notes:"
      echo "> - ChatGPT cannot scan local files. Ask the user to paste or upload note content."
      echo "> - Apple Notes reading is unavailable. Ask the user to export manually."
      echo "> - Output JSON data, then the user injects it into the template (or provide complete HTML)."
      ;;
    copilot)
      echo ""
      echo "> Platform note: when executing this pipeline, read schema/data-schema.json and template/report.html from the project."
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
      installed+=("Claude Code: run /knowledgelens")
      ;;
    2)
      dest="$target_dir/.cursor/rules"
      mkdir -p "$dest"
      assemble_prompt "cursor" > "$dest/knowledgelens.mdc"
      if [ "$support_copied" = false ]; then copy_support_files "$target_dir"; support_copied=true; fi
      echo -e "  ${GREEN}✅ Cursor${NC} → $dest/knowledgelens.mdc"
      installed+=('Cursor: say "generate knowledge report" in chat')
      ;;
    3)
      dest="$target_dir/.windsurf/rules"
      mkdir -p "$dest"
      assemble_prompt "windsurf" > "$dest/knowledgelens.md"
      if [ "$support_copied" = false ]; then copy_support_files "$target_dir"; support_copied=true; fi
      echo -e "  ${GREEN}✅ Windsurf${NC} → $dest/knowledgelens.md"
      installed+=('Windsurf: say "generate knowledge report" in chat')
      ;;
    4)
      dest="$target_dir/.github"
      mkdir -p "$dest"
      if [ -f "$dest/copilot-instructions.md" ]; then
        { echo ""; echo "---"; echo ""; assemble_prompt "copilot"; } >> "$dest/copilot-instructions.md"
        echo -e "  ${GREEN}✅ GitHub Copilot${NC} → appended to $dest/copilot-instructions.md"
      else
        assemble_prompt "copilot" > "$dest/copilot-instructions.md"
        echo -e "  ${GREEN}✅ GitHub Copilot${NC} → $dest/copilot-instructions.md"
      fi
      if [ "$support_copied" = false ]; then copy_support_files "$target_dir"; support_copied=true; fi
      installed+=('GitHub Copilot: say "generate knowledge report" in Copilot Chat')
      ;;
    5)
      assemble_prompt "chatgpt" > "$target_dir/knowledgelens-chatgpt.md"
      echo -e "  ${GREEN}✅ ChatGPT${NC} → $target_dir/knowledgelens-chatgpt.md"
      echo -e "     ${YELLOW}📋 Paste file contents into ChatGPT → Settings → Custom Instructions${NC}"
      installed+=("ChatGPT: paste knowledgelens-chatgpt.md into Custom Instructions")
      ;;
    *)
      echo -e "  ${YELLOW}⚠️  Unknown option: $choice, skipped${NC}"
      ;;
  esac
done

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Installation complete!${NC}"
echo ""
echo "How to use:"
for item in "${installed[@]}"; do
  echo -e "  • $item"
done
echo ""
echo -e "📁 Schema & template copied to: ${CYAN}$target_dir${NC}"
echo ""
