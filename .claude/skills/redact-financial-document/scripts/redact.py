#!/usr/bin/env python3
"""
redact.py — Make a redacted copy of a financial document.

Usage:
    python redact.py <file> [--out-dir DIR] [--dry-run] [--extra-pattern REGEX ...]
                            [--keep-last4] [--no-dates] [--no-names]

Input:  .pdf, .jpg, .jpeg, .png, .tif, .tiff
Output: same folder (or --out-dir), same name with " (redacted)" before the extension.
        e.g.  "Schwab Statement Jan 2026.pdf"  ->  "Schwab Statement Jan 2026 (redacted).pdf"

What gets redacted (see references/patterns.md for details):
    - Social Security numbers / ITINs / EINs
    - Account, policy, routing, and card numbers (long digit runs, with or without dashes/spaces,
      including partially-masked forms like ****1234 or XXXX-XXXX-1234)
    - Dates of birth (any date that appears near "DOB" / "Date of Birth" / "Born"; optionally all dates)
    - Phone numbers, email addresses
    - Street addresses (US-style)
    - Names that appear on labeled lines (e.g., "Account Holder: ...", "Owner: ...")

How it redacts:
    - Text-layer PDFs: true redaction via PyMuPDF (apply_redactions). The underlying text is
      removed from the file — not just covered by a black box. Metadata is also wiped.
    - Scanned PDFs and images: Tesseract OCR locates the text; black rectangles are burned
      into the page image; the output is a flattened image-only PDF (or image). No hidden
      text layer survives.

The script prints a summary of every redaction so the operator can spot-check.
It never modifies the original file.
"""

import argparse
import io
import os
import re
import sys
from pathlib import Path

try:
    import pymupdf as fitz
except ImportError:
    import fitz  # older PyMuPDF

from PIL import Image, ImageDraw

try:
    import pytesseract
    HAVE_TESS = True
except ImportError:
    HAVE_TESS = False

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".webp"}

# ---------------------------------------------------------------------------
# Patterns
# ---------------------------------------------------------------------------

# Each entry: (label, compiled regex). Order matters only for the report.
def build_patterns(no_dates=False, extra=None):
    P = []

    # SSN / ITIN: 123-45-6789, 123 45 6789, 123456789 (bare 9-digit handled by digit-run rule)
    P.append(("SSN", re.compile(r"\b\d{3}[-\s]\d{2}[-\s]\d{4}\b")))

    # EIN: 12-3456789
    P.append(("EIN", re.compile(r"\b\d{2}-\d{7}\b")))

    # Card numbers with separators: 4111 1111 1111 1111 / 4111-1111-1111-1111
    P.append(("Card", re.compile(r"\b(?:\d{4}[-\s]){3}\d{4}\b")))

    # Partially masked account/card numbers: ****1234, XXXX-XXXX-1234, ending in 1234
    P.append(("MaskedAcct", re.compile(
        r"(?:[*Xx•·]{2,}[-\s]?){1,4}\d{2,6}\b|\b(?:ending|ending in|last four|last 4)[:\s]*\d{4}\b",
        re.IGNORECASE)))

    # Long digit runs (7–20 digits, may include dashes/spaces inside): account, routing,
    # policy, loan numbers. Excludes things that look like dollar amounts or dates
    # because those contain ".", "," or "/".
    P.append(("AcctNumber", re.compile(r"(?<![\d.,$/])\d(?:[-\s]?\d){6,19}(?![\d.,/])")))

    # Alphanumeric account IDs on labeled lines: "Account No: AB12345678"
    P.append(("LabeledAcct", re.compile(
        r"(?i)(?:acct|account|policy|contract|member|loan|routing|aba|customer|client)"
        r"[ \t]*(?:no\.?|number|#|id)?[ \t]*[:#][ \t]*((?=[A-Z0-9\-]*\d)[A-Z0-9][A-Z0-9\-]{5,})")))

    # Phone numbers
    P.append(("Phone", re.compile(
        r"(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b")))

    # Email
    P.append(("Email", re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")))

    # Dates near a DOB label (always on)
    date_core = r"(?<!\d)(?:\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})(?!\d)"
    P.append(("DOB", re.compile(
        r"(?i)(?:dob|date\s+of\s+birth|birth\s*date|born)[:\s]*" + date_core)))

    # All other dates (on by default — statements are full of them, and DOBs are often
    # unlabeled; turn off with --no-dates if statement dates must survive)
    if not no_dates:
        P.append(("Date", re.compile(date_core)))

    # US street address: "123 Main St", "4567 Ocean Blvd Apt 2B"
    P.append(("Address", re.compile(
        r"\b\d{1,6}\s+(?:[A-Z][a-zA-Z]*\.?\s){1,4}"
        r"(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Way|Pl|Place|Ter|Terrace|Cir|Circle|Pkwy|Parkway|Hwy|Highway|Trl|Trail)\.?"
        r"(?:\s*(?:Apt|Suite|Ste|Unit|#)\s*[\w-]+)?\b")))

    # ZIP+4 and 5-digit ZIP following a state code
    P.append(("ZIP", re.compile(r"\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b")))

    for i, rx in enumerate(extra or []):
        P.append((f"Extra{i+1}", re.compile(rx)))

    return P


# Names on labeled lines: "Account Holder: John Q. Public"
NAME_LABEL = re.compile(
    r"(?i)(?:account\s+holder|account\s+owner|owner|holder|name|insured|annuitant|beneficiary|"
    r"participant|customer|client|prepared\s+for|member|borrower|applicant|taxpayer|spouse)"
    r"[ \t]*[:\-][ \t]*([A-Z][A-Za-z'.\-]*(?:[ \t]+[A-Z][A-Za-z'.\-]*){1,3})")


def find_matches(text, patterns, no_names=False):
    """Return list of (label, matched_string) for all hits in text."""
    hits = []
    for label, rx in patterns:
        for m in rx.finditer(text):
            s = m.group(1) if (m.lastindex and label == "LabeledAcct") else m.group(0)
            if s.strip():
                hits.append((label, s.strip()))
    if not no_names:
        for m in NAME_LABEL.finditer(text):
            hits.append(("Name", m.group(1).strip()))
    return hits


def apply_keep_last4(hits, keep_last4):
    """If keep_last4, shorten account/card matches so the last 4 digits survive."""
    if not keep_last4:
        return hits
    out = []
    for label, s in hits:
        if label in ("AcctNumber", "Card", "LabeledAcct") and len(re.sub(r"\D", "", s)) > 4:
            # Redact everything up to (not including) the last 4 digits
            cut = len(s)
            digits_seen = 0
            for i in range(len(s) - 1, -1, -1):
                if s[i].isdigit():
                    digits_seen += 1
                    if digits_seen == 4:
                        cut = i
                        break
            out.append((label, s[:cut].rstrip("-  ")))
        else:
            out.append((label, s))
    return out


# ---------------------------------------------------------------------------
# Output naming
# ---------------------------------------------------------------------------

def redacted_path(src: Path, out_dir=None, force_ext=None):
    ext = force_ext or src.suffix
    name = f"{src.stem} (redacted){ext}"
    return (Path(out_dir) if out_dir else src.parent) / name


# ---------------------------------------------------------------------------
# Text-layer PDF
# ---------------------------------------------------------------------------

def pdf_has_text(doc, min_chars=40):
    total = 0
    for page in doc:
        total += len(page.get_text("text").strip())
        if total >= min_chars:
            return True
    return False


def redact_text_pdf(src, dst, patterns, args):
    doc = fitz.open(src)
    report = []
    for pno, page in enumerate(doc, start=1):
        text = page.get_text("text")
        hits = apply_keep_last4(find_matches(text, patterns, args.no_names), args.keep_last4)
        seen = set()
        for label, s in hits:
            if s in seen:
                continue
            seen.add(s)
            rects = page.search_for(s)
            if not rects:
                # Multi-line or odd spacing: try collapsing whitespace variants
                rects = page.search_for(re.sub(r"\s+", " ", s))
            for r in rects:
                page.add_redact_annot(r, fill=(0, 0, 0))
            if rects:
                report.append((pno, label, s, len(rects)))
            else:
                report.append((pno, label + "?", s, 0))  # matched in text but not located
        if not args.dry_run:
            page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_PIXELS)
    if not args.dry_run:
        doc.set_metadata({})  # wipe author/title/etc.
        doc.save(dst, garbage=4, deflate=True, clean=True)
    doc.close()
    return report


# ---------------------------------------------------------------------------
# OCR path (scanned PDFs and images)
# ---------------------------------------------------------------------------

def ocr_redact_image(img: Image.Image, patterns, args):
    """Return (redacted PIL image, report rows). Uses word-level OCR boxes."""
    if not HAVE_TESS:
        raise RuntimeError("pytesseract not installed; needed for scanned PDFs/images. "
                           "pip install pytesseract  and install the tesseract binary.")
    data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    words = []
    for i, w in enumerate(data["text"]):
        if w.strip():
            words.append({
                "text": w, "left": data["left"][i], "top": data["top"][i],
                "w": data["width"][i], "h": data["height"][i],
                "line": (data["block_num"][i], data["par_num"][i], data["line_num"][i]),
            })

    # Rebuild lines with char offsets so regex hits map back to word boxes
    lines = {}
    for w in words:
        lines.setdefault(w["line"], []).append(w)

    draw = ImageDraw.Draw(img)
    report = []
    pad = 6
    for key, ws in lines.items():
        line_text = ""
        spans = []  # (start, end, word)
        for w in ws:
            if line_text:
                line_text += " "
            start = len(line_text)
            line_text += w["text"]
            spans.append((start, len(line_text), w))

        hits = apply_keep_last4(find_matches(line_text, patterns, args.no_names), args.keep_last4)
        for label, s in hits:
            for m in re.finditer(re.escape(s), line_text):
                a, b = m.span()
                boxes = [w for (ws_, we_, w) in spans if ws_ < b and we_ > a]
                if not boxes:
                    continue
                x0 = min(w["left"] for w in boxes) - pad
                y0 = min(w["top"] for w in boxes) - pad
                x1 = max(w["left"] + w["w"] for w in boxes) + pad
                y1 = max(w["top"] + w["h"] for w in boxes) + pad
                if not args.dry_run:
                    draw.rectangle([x0, y0, x1, y1], fill="black")
                report.append((label, s, 1))
    return img, report


def redact_image_file(src, dst, patterns, args):
    img = Image.open(src).convert("RGB")
    img, rep = ocr_redact_image(img, patterns, args)
    if not args.dry_run:
        # Strip EXIF/metadata by saving a fresh image
        img.save(dst)
    return [(1, l, s, n) for (l, s, n) in rep]


def redact_scanned_pdf(src, dst, patterns, args, dpi=300):
    doc = fitz.open(src)
    out = fitz.open()
    report = []
    for pno, page in enumerate(doc, start=1):
        pix = page.get_pixmap(dpi=dpi)
        img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        img, rep = ocr_redact_image(img, patterns, args)
        report += [(pno, l, s, n) for (l, s, n) in rep]
        if not args.dry_run:
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            w_pt, h_pt = page.rect.width, page.rect.height
            newpage = out.new_page(width=w_pt, height=h_pt)
            newpage.insert_image(newpage.rect, stream=buf.getvalue())
    if not args.dry_run:
        out.set_metadata({})
        out.save(dst, garbage=4, deflate=True)
    out.close()
    doc.close()
    return report


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file")
    ap.add_argument("--out-dir", help="Write the redacted copy here instead of next to the original")
    ap.add_argument("--dry-run", action="store_true", help="Report what would be redacted; write nothing")
    ap.add_argument("--extra-pattern", action="append", default=[],
                    help="Additional regex to redact (repeatable)")
    ap.add_argument("--keep-last4", action="store_true",
                    help="Leave the last 4 digits of account/card numbers visible")
    ap.add_argument("--no-dates", action="store_true",
                    help="Only redact dates labeled as DOB; leave statement/transaction dates")
    ap.add_argument("--no-names", action="store_true", help="Do not redact names on labeled lines")
    ap.add_argument("--force-ocr", action="store_true",
                    help="Treat PDF as scanned even if it has a text layer (rasterizes the output)")
    args = ap.parse_args()

    src = Path(args.file).expanduser().resolve()
    if not src.exists():
        sys.exit(f"File not found: {src}")

    patterns = build_patterns(no_dates=args.no_dates, extra=args.extra_pattern)
    ext = src.suffix.lower()

    if ext == ".pdf":
        doc = fitz.open(src)
        text_layer = pdf_has_text(doc) and not args.force_ocr
        doc.close()
        dst = redacted_path(src, args.out_dir)
        if text_layer:
            mode = "text-layer PDF (true redaction)"
            report = redact_text_pdf(src, dst, patterns, args)
        else:
            mode = "scanned PDF (OCR + rasterized output)"
            report = redact_scanned_pdf(src, dst, patterns, args)
    elif ext in IMAGE_EXTS:
        mode = "image (OCR)"
        dst = redacted_path(src, args.out_dir)
        report = redact_image_file(src, dst, patterns, args)
    else:
        sys.exit(f"Unsupported file type: {ext}")

    # ---- Report ----
    print(f"Source : {src}")
    print(f"Mode   : {mode}")
    print(f"Output : {dst if not args.dry_run else '(dry run — nothing written)'}")
    print(f"Redactions: {len(report)}")
    if report:
        print(f"{'Page':<5} {'Type':<12} {'Matched text'}")
        for pno, label, s, n in report:
            flag = "  <-- matched but NOT located on page; check manually" if n == 0 else ""
            print(f"{pno:<5} {label:<12} {s}{flag}")
    print("\nREVIEW the output before uploading. Pattern matching is not perfect.")


if __name__ == "__main__":
    main()
