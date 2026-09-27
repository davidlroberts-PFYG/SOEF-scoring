#!/bin/bash
# SessionStart hook for Claude Code on the web.
# Installs what a fresh cloud container needs so tests, lint, and the
# /redact-financial-document skill all work. Idempotent and non-interactive.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

echo "==> npm dependencies"
npm install --no-audit --no-fund

echo "==> redact-financial-document skill dependencies (Python + Tesseract)"
bash "$CLAUDE_PROJECT_DIR/.claude/skills/redact-financial-document/scripts/setup.sh"

echo "==> Session start hook complete"
