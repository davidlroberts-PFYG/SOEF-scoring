# Benchmark data

Reference data behind the sector benchmark table. Only `sector_benchmarks_seed.csv` feeds the app (via `content/seed/sectors.json`). The other files are kept for provenance and for the IBBA reference panel.

| File | What it is | Feeds the app? |
|---|---|---|
| `sector_benchmarks_seed.csv` | Per-sector low/high/median SDE multiples with the constituent BizBuySell sub-industries, source note, URL, review date | Yes, via `content/seed/sectors.json` |
| `bizbuysell_insight_quarterly.csv` | BizBuySell Insight Report headline figures by quarter (transactions, median price, revenue, SDE, multiples). Blanks are not stated in the public press releases. | No |
| `ibba_market_pulse_size_tiers.csv` / `.json` | IBBA / M&A Source Market Pulse all-industry median multiples by deal size tier, Q4 2025 through Q2 2026 | JSON is shown read-only on the override panel |

## Method (advisor's, not the source's)

- Source: BizBuySell Industry Valuation Multiples, closed sales Q3 2021 through Q2 2026. The BizBuySell "earnings multiple" is a multiple of **SDE / cash flow**, not EBITDA. Every populated row therefore has `basis = SDE`.
- Low and high are the minimum and maximum of the sub-industry earnings multiples BizBuySell lists inside each sector. The full constituent list is in the `constituent_industries_earnings_multiples` column so ranges can be tightened or widened.
- Judgment calls: Medical Billing (3.92×) excluded from Professional Services as an outlier; Assisted Living / Nursing (4.30×) listed separately from Healthcare Services because it is real-estate heavy; Building Material / Hardware stores (3.28×) excluded from Construction as retail; Cell Phone / Computer Repair (1.88×) excluded from IT as retail service.
- These ranges span sub-industry **medians**, not top-quartile transactions. The app labels the top of such a range "Top of sector range" rather than "Best-in-class" (`range_kind = median_range`). A true best-in-class gap needs a transaction database (PeerComps, DealStats) to compute 75th-percentile multiples by NAICS; set `range_kind = quartile_range` on rows sourced that way.
- **Government Contracting** has no Main Street transaction source. BizBuySell has no category; IBBA only notes GovCon/Defense as a top buyer-interest sector in Q2 2026. The row is seeded from sbLiftOff, "Knowing Your Company's Value is a Key to Growth – And Exit!" (Oct 2022), whose advisor-stated EBITDA tiers for small set-aside contractors are 3–5× (set-aside designations, no full-and-open work), 5–7× (some full-and-open), 5–9×+ (all full-and-open). The table uses **3.0–7.0× EBITDA** (bottom of the first tier to top of the middle tier) as the conservative default and is marked `quartile_range` because these are practitioner ranges, not sub-industry medians. Use the assessment override for mostly full-and-open firms. Set-aside dependence is the dominant value driver and is not captured by the scorecard; SBA recertification rules effective 2026-01-17 can make an acquired small business ineligible for set-aside option years. Larger-deal sources reviewed and rejected for this size band: Capstone Partners 2026 Aerospace, Defense, Government & Security report (average 9.5–11.4× EV/EBITDA, middle market and up), Chesapeake Corporate Advisors GovCon Q1 2026 (11.5× public Government Services), CohnReznick GovCon valuation tracker (public comps 11–21×, apparently discontinued), KippsDeSanto MarketView (GovCon-specific, no figure obtained). A DealStats or GF Data pull for NAICS 5413/5416 would replace this row.

## Not yet verified

- **Reuse terms.** Search-result snippets of the BizBuySell (CoStar) Terms of Use (2026-09-26) declare site content including "valuation reports" proprietary, limit permitted uses to viewing listings and hyperlinking, and prohibit displaying or publishing "any portion of the Product" otherwise; no attribution carve-out was found. Interpretation, not legal advice: displaying the medians in a client PDF is a republication the terms do not license. Request written permission (press contact seen in snippets: adebussy@bizbuysell.com) or replace the source before client-facing release. IBBA Market Pulse highlights are publicly downloadable with no explicit grant or prohibition found; the Executive Summary is participant-only and must not be reproduced. Request confirmation via admin@ibba.org. None of these pages could be loaded from the build environment (network policy), so every quote is from search snippets and should be confirmed against the live page.
- **Government Contracting source page** (sbLiftOff) was likewise read only via search snippets; confirm the tiers and date on the live page.
- BizBuySell does not disclose the transaction count behind the multiples page.

Last reviewed: 2026-09-26.
