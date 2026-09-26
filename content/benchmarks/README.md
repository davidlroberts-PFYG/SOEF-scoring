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
- Government Contracting has no Main Street source. BizBuySell has no category; IBBA only notes GovCon/Defense as a top buyer-interest sector in Q2 2026. The row stays blank until DealStats or GF Data (NAICS 5413/5416) or advisor experience fills it.

## Not yet verified

- Reuse terms for BizBuySell (CoStar) and IBBA data in a client-facing advisor tool. Displaying attributed medians is common practice; confirm before shipping reports to clients.
- BizBuySell does not disclose the transaction count behind the multiples page.

Last reviewed: 2026-09-26.
