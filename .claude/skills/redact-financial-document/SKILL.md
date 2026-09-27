---
name: redact-financial-document
description: Make a redacted duplicate of a financial document (PDF, JPEG, PNG, TIFF) so it can be safely uploaded for AI analysis. Strips SSNs, EINs, account/routing/policy/card numbers, dates of birth, phone numbers, emails, addresses, and account-holder names, and saves the copy alongside the original with " (redacted)" added to the file name. Use this whenever the user drops in or points at a statement, tax form, insurance policy, loan document, brokerage report, or any client financial paperwork and says anything like "redact this", "scrub this", "make a safe copy", "remove the account numbers", "anonymize this statement", "strip the PII", or "I want to upload this but it has client info in it" — even if they don't use the word "redact". Also use it before analyzing any client financial document the user has not already confirmed is redacted.
---

# Redact Financial Document

Produces a redacted copy of a financial document without touching the original. The copy keeps the
original file name plus ` (redacted)` before the extension, so the two files sort together.

`Schwab Statement Jan 2026.pdf` → `Schwab Statement Jan 2026 (redacted).pdf`

## Why this exists

The user is a Registered Investment Adviser. Client statements contain SSNs, account numbers, DOBs and
addresses that must not leave his systems unredacted. The point of this skill is to run **locally,
before** anything is uploaded — so never suggest uploading the original to "check it first", and never
paste the original's contents into the conversation. Work from the file path only.

## Workflow

1. **Locate the file.** The user will give a path, drop a file, or describe it ("the Fidelity statement in
   Downloads"). Resolve to an absolute path. If several files are named, run the script once per file.

2. **Dry run first** (fast, writes nothing):
   ```bash
   python3 .claude/skills/redact-financial-document/scripts/redact.py "<file>" --dry-run
   ```
   Show the user the redaction table it prints (page, type, matched text). This is their chance to
   catch two things:
   - **Over-redaction** — e.g. statement dates or a ticker's CUSIP got caught. Offer `--no-dates`
     or `--keep-last4` (see Options).
   - **Under-redaction** — something sensitive that the patterns missed. Add it with
     `--extra-pattern "<regex>"` (escape it properly), or tell them it will need manual redaction.

   Skip the dry run only if the user has explicitly said to just do it.

3. **Run for real** with whatever options they settled on:
   ```bash
   python3 .claude/skills/redact-financial-document/scripts/redact.py "<file>" [options]
   ```

4. **Confirm and hand off.** Report the output path and the redaction count. Remind them, briefly and
   once, to open the redacted copy and eyeball it before uploading — regex-based redaction is not
   perfect, and OCR on a poor scan can miss text entirely. Then stop; do not open or summarize the
   redacted file's contents unless asked.

## Options

| Flag | Use when |
|---|---|
| `--dry-run` | Preview only. Always do this first unless told otherwise. |
| `--no-dates` | Statement period / transaction dates need to survive for the analysis. Labeled DOBs are still redacted. Warn the user that an *unlabeled* birthdate would then survive too. |
| `--keep-last4` | The analysis needs to distinguish accounts (e.g. "the IRA ending 4421 vs. the joint account ending 9902"). Leaves the last 4 digits of account/card numbers visible. |
| `--no-names` | Names on labeled lines should stay (rare — usually only for an internal-only use). |
| `--extra-pattern REGEX` | Something specific to this document needs redacting. Repeatable. |
| `--out-dir DIR` | The copy should land somewhere other than next to the original. |
| `--force-ocr` | A PDF has a text layer but the visible content is really an image (some bank exports), or the text layer is garbage. Output becomes image-only. |

## How the redaction works (so you can explain it if asked)

- **PDFs with a real text layer** — PyMuPDF `apply_redactions()`. The text is deleted from the file's
  content stream, not just covered. Images overlapping a redaction box are pixel-wiped. Document
  metadata (author, title) is cleared. The output stays a searchable PDF for everything that wasn't
  redacted.
- **Scanned PDFs and images** — Tesseract OCR finds word boxes; black rectangles are burned into the
  page image; the output is a flattened image (or image-only PDF). No hidden text layer survives.
  OCR quality depends on scan quality; skewed or low-resolution scans can miss text.
- **Never modifies the original.**

What is and isn't caught is documented in `references/patterns.md`. Read it when the user asks
"will this catch X?" or when tuning `--extra-pattern`.

## Setup (one-time, per machine)

Run the bundled setup script from the repo root:
```bash
bash .claude/skills/redact-financial-document/scripts/setup.sh
```
It installs the Python packages from `scripts/requirements.txt` (`pymupdf`, `pytesseract`, `pillow`)
and the Tesseract binary (`apt-get install tesseract-ocr` on Debian/Ubuntu, `brew install tesseract`
on macOS). On Windows use the UB-Mannheim Tesseract installer and make sure `tesseract.exe` is on
PATH, then `pip install -r .claude/skills/redact-financial-document/scripts/requirements.txt`.
Tesseract is only needed for scans and images; text-layer PDFs work with PyMuPDF alone.

If the script errors with "pytesseract not installed" or "tesseract is not installed or it's not in
your PATH", that is the fix.

## Things not to do

- Do not read the original document's text into the conversation to "help" decide what to redact.
  The dry-run table shows exactly the matched strings and nothing else; that is enough.
- Do not offer to upload the original anywhere.
- Do not tell the user the redaction is complete or safe. Say the script ran and what it caught, and
  that they should review the copy. The final judgment is theirs.
