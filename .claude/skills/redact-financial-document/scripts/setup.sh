#!/usr/bin/env bash
# One-time setup for the redact-financial-document skill.
# Installs the Python packages and the Tesseract OCR binary (needed for scanned PDFs and images).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="${PYTHON:-python3}"

echo "==> Installing Python packages"
if ! "$PY" -m pip install -r "$HERE/requirements.txt" 2>/dev/null; then
  # Debian/Ubuntu system Python refuses without this flag (PEP 668)
  "$PY" -m pip install --break-system-packages -r "$HERE/requirements.txt"
fi

echo "==> Installing Tesseract OCR binary"
if command -v tesseract >/dev/null 2>&1; then
  echo "tesseract already installed: $(tesseract --version 2>&1 | head -1)"
elif command -v apt-get >/dev/null 2>&1; then
  SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
  $SUDO apt-get update -qq
  $SUDO apt-get install -y tesseract-ocr
elif command -v brew >/dev/null 2>&1; then
  brew install tesseract
else
  echo "Could not find apt-get or brew. Install Tesseract manually and put it on PATH." >&2
  echo "Windows: https://github.com/UB-Mannheim/tesseract/wiki" >&2
fi

echo "==> Verifying"
"$PY" -c "import pymupdf, pytesseract, PIL; print('python deps ok')"
command -v tesseract >/dev/null && tesseract --version 2>&1 | head -1 || echo "WARNING: tesseract not on PATH (scans/images will fail; text PDFs still work)"
