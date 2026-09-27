# What the redactor catches — and what it doesn't

Read this when the user asks whether a specific kind of data will be caught, or when writing an
`--extra-pattern`.

## Caught by default

| Type | Examples | Notes |
|---|---|---|
| SSN / ITIN | `123-45-6789`, `123 45 6789` | Bare 9-digit `123456789` is caught by the digit-run rule. |
| EIN | `12-3456789` | |
| Card numbers | `4111 1111 1111 1111`, `4111-1111-1111-1111` | Also bare 15–16 digit runs. |
| Account / routing / policy / loan numbers | `8847-221093-55`, `063100277`, any 7–20 digit run with optional dashes/spaces | Deliberately broad. Dollar amounts survive because they contain `$`, `,` or `.`. |
| Labeled alphanumeric IDs | `Account No: AB12345678`, `Policy #: LX-99001` | Label must be followed by `:` or `#`; the ID must contain at least one digit. |
| Partially masked numbers | `****4421`, `XXXX-XXXX-1234`, `ending in 4421`, `last four 4421` | Redacted because the last 4 plus the institution name is often enough to identify an account. Use `--keep-last4` to keep the digits. |
| Date of birth | `DOB: 03/14/1961`, `Date of Birth: March 14, 1961` | Always on. |
| All other dates | `07/01/2026`, `2026-07-01`, `Sep 30, 2026` | On by default because DOBs are frequently unlabeled. Turn off with `--no-dates`. |
| Phone | `(941) 555-0182`, `941-555-0182`, `+1 941.555.0182` | |
| Email | `name@domain.com` | |
| Street address | `4567 Ocean View Blvd Apt 2B` | US-style: number + 1–4 capitalized words + street suffix. PO Boxes are **not** caught (see below). |
| State + ZIP | `FL 34236`, `FL 34236-1234` | The city name is not caught. |
| Names on labeled lines | `Account Holder: Jonathan Q. Sample`, `Insured: Maria Sample` | Labels: account holder/owner, owner, holder, name, insured, annuitant, beneficiary, participant, customer, client, prepared for, member, borrower, applicant, taxpayer, spouse. Name must be 2–4 capitalized words; single-letter initials with or without a period are allowed. |

## NOT caught — needs `--extra-pattern` or manual redaction

- **Names anywhere else** — in a salutation ("Dear Jonathan"), in a header, in transaction
  descriptions ("Transfer from Maria Sample"). If the client's name appears freely, pass it explicitly:
  `--extra-pattern "Jonathan Q\.? Sample" --extra-pattern "Sample, Jonathan"`
- **City names** — "Sarasota" survives (only the state+ZIP is redacted).
- **PO Boxes** — `--extra-pattern "P\.?O\.? Box \d+"`
- **Employer names, advisor names, beneficiary relationships** in free text.
- **Short account numbers (6 digits or fewer)** unless on a labeled line.
- **Numbers written with letter O instead of zero** in poor OCR.
- **Handwriting** — Tesseract is unreliable on it.
- **Barcodes / QR codes** on statements — these can encode the account number. Nothing in the script
  reads them. Tell the user if a scan visibly has one.
- **Text inside embedded images in a text-layer PDF** — images that *overlap* a redaction box are
  pixel-wiped, but an image sitting elsewhere that contains an account number is not OCR'd. Use
  `--force-ocr` for those documents.
- **Signatures.**

## Writing an `--extra-pattern`

It is a Python regex, matched case-sensitively unless you prefix `(?i)`. Escape dots and parentheses.
Every match is redacted wherever it appears.

```bash
python redact.py "statement.pdf" \
  --extra-pattern "(?i)jonathan\s+q\.?\s+sample" \
  --extra-pattern "Sarasota" \
  --extra-pattern "Plan For Your Goals"
```

## Known false-positive tendencies

- Long numeric CUSIPs or fund IDs (9 characters, often alphanumeric — mostly survive; all-numeric
  ones get caught).
- Check numbers, confirmation numbers, page IDs with 7+ digits.
- Dates in transaction listings (when `--no-dates` is not set).

None of these are harmful to over-redact for an AI-analysis use case; mention them only if the user
needs that data for the analysis.
