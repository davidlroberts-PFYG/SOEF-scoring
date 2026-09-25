import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { AssessmentResult, Narrative } from '@/engine';
import { formatCurrency, formatCurrencyExact, formatDate, formatMultiple, formatPct } from '@/lib/format';

export interface ReportProps {
  result: AssessmentResult;
  narrative: Narrative;
  companyName: string;
  ownerName: string;
  advisorName: string;
  disclosure: string;
  brand: { firmName: string; brandName: string; advisorTitle: string; reportTitle: string; navy: string; orange: string };
  generatedAt: Date;
}

const FOOTER_HEIGHT = 78;

function makeStyles(navy: string, orange: string) {
  return StyleSheet.create({
    page: { paddingTop: 36, paddingHorizontal: 40, paddingBottom: FOOTER_HEIGHT + 12, fontSize: 10, fontFamily: 'Helvetica', color: '#1b2a3a' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: orange, paddingBottom: 6, marginBottom: 14 },
    brand: { fontSize: 8, color: orange, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, textTransform: 'uppercase' },
    title: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: navy },
    meta: { fontSize: 8, color: '#4a5a6a', textAlign: 'right' },
    h2: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: navy, marginTop: 12, marginBottom: 6 },
    p: { fontSize: 9.5, lineHeight: 1.45, marginBottom: 6 },
    small: { fontSize: 8, color: '#4a5a6a', lineHeight: 1.4 },
    row: { flexDirection: 'row', gap: 10 },
    box: { flex: 1, borderWidth: 1, borderColor: '#d8dee5', borderRadius: 4, padding: 8 },
    boxAccent: { flex: 1, backgroundColor: navy, borderRadius: 4, padding: 8 },
    boxLabel: { fontSize: 7.5, color: '#4a5a6a', textTransform: 'uppercase', letterSpacing: 0.8 },
    boxLabelLight: { fontSize: 7.5, color: orange, textTransform: 'uppercase', letterSpacing: 0.8 },
    boxValue: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: navy, marginTop: 2 },
    boxValueLight: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#ffffff', marginTop: 2 },
    boxSub: { fontSize: 7.5, color: '#4a5a6a', marginTop: 2 },
    boxSubLight: { fontSize: 7.5, color: '#ffffffb3', marginTop: 2 },
    table: { marginTop: 4 },
    tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#d8dee5', paddingVertical: 3 },
    th: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#4a5a6a', textTransform: 'uppercase' },
    td: { fontSize: 8.5 },
    footer: { position: 'absolute', left: 40, right: 40, bottom: 18, borderTopWidth: 0.5, borderTopColor: '#d8dee5', paddingTop: 6 },
    footerText: { fontSize: 6.8, color: '#4a5a6a', lineHeight: 1.35 },
    footerMeta: { fontSize: 6.8, color: '#4a5a6a', marginTop: 3, flexDirection: 'row', justifyContent: 'space-between' },
    rangeWrap: { marginTop: 6, marginBottom: 4 },
    rangeBar: { height: 8, backgroundColor: '#d8dee5', borderRadius: 4, position: 'relative' },
    rangeFill: { height: 8, backgroundColor: navy, borderRadius: 4 },
    rangeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
    warn: { backgroundColor: '#f7ecd9', color: '#8a5a15', padding: 8, borderRadius: 4, fontSize: 9, marginTop: 6 },
  });
}

export function ReportDocument(props: ReportProps) {
  const { result, narrative, companyName, ownerName, advisorName, disclosure, brand, generatedAt } = props;
  const s = makeStyles(brand.navy, brand.orange);
  const { business, personal, combined, valueGap: vg } = result;

  const Footer = () => (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{disclosure}</Text>
      <View style={s.footerMeta}>
        <Text>
          {brand.firmName} · {brand.brandName} · Prepared by {advisorName}
          {brand.advisorTitle ? `, ${brand.advisorTitle}` : ''}
        </Text>
        <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </View>
  );

  const Header = ({ sub }: { sub: string }) => (
    <View style={s.header} fixed>
      <View>
        <Text style={s.brand}>{brand.brandName}</Text>
        <Text style={s.title}>{brand.reportTitle}</Text>
      </View>
      <View>
        <Text style={s.meta}>{companyName}</Text>
        <Text style={s.meta}>{ownerName}</Text>
        <Text style={s.meta}>
          {sub} · Assessed {formatDate(result.assessment.assessedAt)}
        </Text>
      </View>
    </View>
  );

  const sourceLine =
    vg.source.kind === 'override'
      ? `Custom multiple range entered for this assessment${vg.source.overrideNote ? `: ${vg.source.overrideNote}` : ''}.`
      : `Sector: ${vg.source.sectorName ?? '—'}. Multiple source: ${vg.source.sourceNote ?? 'not recorded'}. Last reviewed: ${vg.source.lastReviewed ? formatDate(vg.source.lastReviewed) : '—'}.`;

  return (
    <Document title={`${brand.reportTitle} — ${companyName}`} author={brand.firmName} subject="Readiness scores and estimated value gap (estimate only)">
      {/* Page 1: Summary */}
      <Page size="LETTER" style={s.page}>
        <Header sub="Summary" />

        <View style={s.row}>
          <ScoreBox s={s} label="Business Readiness" pct={business.readinessPct} band={business.band?.label} total={business.totalRating} max={business.maxRating} />
          <ScoreBox s={s} label="Personal Readiness" pct={personal.readinessPct} band={personal.band?.label} total={personal.totalRating} max={personal.maxRating} />
          <ScoreBox s={s} label="Combined Readiness" pct={combined.readinessPct} band={combined.band?.label} total={combined.totalRating} max={combined.maxRating} />
        </View>

        <Text style={s.h2}>Range of value (estimate)</Text>
        {vg.lowMultiple !== null && vg.highMultiple !== null && vg.rangePosition !== null ? (
          <View style={s.rangeWrap}>
            <View style={s.rangeBar}>
              <View style={[s.rangeFill, { width: `${Math.round(vg.rangePosition * 100)}%` }]} />
            </View>
            <View style={s.rangeLabels}>
              <Text style={s.small}>Low {formatMultiple(vg.lowMultiple)}</Text>
              <Text style={[s.small, { color: brand.orange, fontFamily: 'Helvetica-Bold' }]}>
                Current position {formatMultiple(vg.currentMultiple)} {vg.earningsBasis}
              </Text>
              <Text style={s.small}>Best-in-class {formatMultiple(vg.highMultiple)}</Text>
            </View>
          </View>
        ) : (
          <Text style={s.warn}>{vg.message}</Text>
        )}

        {vg.status === 'ok' ? (
          <View style={[s.row, { marginTop: 8 }]}>
            <View style={s.box}>
              <Text style={s.boxLabel}>Current estimated value</Text>
              <Text style={s.boxValue}>{formatCurrency(vg.currentValue)}</Text>
              <Text style={s.boxSub}>
                {formatCurrencyExact(vg.earnings)} {vg.earningsBasis} × {formatMultiple(vg.currentMultiple)}
              </Text>
            </View>
            <View style={s.box}>
              <Text style={s.boxLabel}>Best-in-class value</Text>
              <Text style={s.boxValue}>{formatCurrency(vg.bestInClassValue)}</Text>
              <Text style={s.boxSub}>
                {formatCurrencyExact(vg.earnings)} {vg.earningsBasis} × {formatMultiple(vg.bestInClassMultiple)}
              </Text>
            </View>
            <View style={s.boxAccent}>
              <Text style={s.boxLabelLight}>Estimated value gap</Text>
              <Text style={s.boxValueLight}>{formatCurrency(vg.valueGap)}</Text>
              <Text style={s.boxSubLight}>Best-in-class minus current</Text>
            </View>
          </View>
        ) : vg.status === 'no_earnings' ? (
          <Text style={s.warn}>{vg.message}</Text>
        ) : null}
        <Text style={[s.small, { marginTop: 6 }]}>{sourceLine}</Text>

        <Text style={s.h2}>Biggest levers</Text>
        {vg.biggestLevers.length === 0 ? (
          <Text style={s.p}>No points lost on rated factors.</Text>
        ) : (
          <View style={s.table}>
            <View style={s.tr}>
              <Text style={[s.th, { width: '6%' }]}>#</Text>
              <Text style={[s.th, { width: '38%' }]}>Factor</Text>
              <Text style={[s.th, { width: '10%', textAlign: 'right' }]}>Rating</Text>
              <Text style={[s.th, { width: '12%', textAlign: 'right' }]}>Pts lost</Text>
              <Text style={[s.th, { width: '10%', textAlign: 'right' }]}>Share</Text>
              <Text style={[s.th, { width: '24%', textAlign: 'right' }]}>Est. gap attributed</Text>
            </View>
            {vg.biggestLevers.map((l, i) => (
              <View key={l.factorId} style={s.tr} wrap={false}>
                <Text style={[s.td, { width: '6%' }]}>{i + 1}</Text>
                <View style={{ width: '38%' }}>
                  <Text style={[s.td, { fontFamily: 'Helvetica-Bold' }]}>{l.label}</Text>
                  {l.note ? <Text style={s.small}>{l.note}</Text> : null}
                </View>
                <Text style={[s.td, { width: '10%', textAlign: 'right' }]}>{l.rating ?? '—'}/6</Text>
                <Text style={[s.td, { width: '12%', textAlign: 'right' }]}>{l.pointsLost}</Text>
                <Text style={[s.td, { width: '10%', textAlign: 'right' }]}>{formatPct(l.share)}</Text>
                <Text style={[s.td, { width: '24%', textAlign: 'right' }]}>{l.gapAttributed === null ? '—' : formatCurrency(l.gapAttributed)}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={[s.small, { marginTop: 4 }]}>Attributed dollars are an allocation of the estimated gap in proportion to points lost, not a prediction that fixing one factor returns that amount.</Text>

        <Footer />
      </Page>

      {/* Page 2: What this means */}
      <Page size="LETTER" style={s.page}>
        <Header sub="What this means" />
        <Text style={s.h2}>What this means</Text>
        <Text style={[s.p, { fontFamily: 'Helvetica-Bold', fontSize: 11 }]}>{narrative.headline}</Text>
        {narrative.paragraphs.map((p, i) => (
          <Text key={i} style={s.p}>
            {p}
          </Text>
        ))}
        {narrative.levers.length ? (
          <View style={{ marginTop: 2, marginBottom: 6 }}>
            {narrative.levers.map((l, i) => (
              <Text key={i} style={[s.p, { marginLeft: 10, marginBottom: 3 }]}>
                • {l}
              </Text>
            ))}
          </View>
        ) : null}
        <Text style={s.p}>{narrative.caveat}</Text>

        <Text style={s.h2}>Rating key</Text>
        {result.ratingKey.map((k) => (
          <Text key={k.value} style={[s.small, { marginBottom: 1 }]}>
            {k.value} — {k.label}
            {k.description && k.description.toLowerCase() !== k.label.toLowerCase() ? `: ${k.description}` : ''}
          </Text>
        ))}
        <Text style={s.h2}>Common Sense Rating bands</Text>
        {result.bands.map((b) => (
          <Text key={b.band} style={[s.small, { marginBottom: 1 }]}>
            {b.band} — {b.label}: {b.minPct}–{b.maxPct}%
          </Text>
        ))}
        <Footer />
      </Page>

      {/* Page 3+: Factor tables */}
      <Page size="LETTER" style={s.page}>
        <Header sub="Factor detail" />
        <FactorTable s={s} title={`${business.name} — ${business.totalRating}/${business.maxRating} (${formatPct(business.readinessPct)})`} rows={business.rows.map((r) => ({ ...r, gap: vg.attribution.find((a) => a.factorId === r.factorId)?.gapAttributed ?? null }))} showGap={vg.status === 'ok'} />
        <FactorTable s={s} title={`${personal.name} — ${personal.totalRating}/${personal.maxRating} (${formatPct(personal.readinessPct)})`} rows={personal.rows.map((r) => ({ ...r, gap: null }))} showGap={false} />
        <Text style={[s.small, { marginTop: 10 }]}>Generated {generatedAt.toLocaleString('en-US')}.</Text>
        <Footer />
      </Page>
    </Document>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function ScoreBox({ s, label, pct, band, total, max }: { s: Styles; label: string; pct: number; band: string | undefined; total: number; max: number }) {
  return (
    <View style={s.box}>
      <Text style={s.boxLabel}>{label}</Text>
      <Text style={s.boxValue}>{formatPct(pct)}</Text>
      <Text style={s.boxSub}>
        {total}/{max} points · {band ?? 'Not scored'}
      </Text>
    </View>
  );
}

function FactorTable({
  s,
  title,
  rows,
  showGap,
}: {
  s: Styles;
  title: string;
  rows: { factorId: string; sortOrder: number; label: string; rating: number | null; pointsLost: number; note: string | null; gap: number | null }[];
  showGap: boolean;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={s.h2}>{title}</Text>
      <View style={s.tr}>
        <Text style={[s.th, { width: '5%' }]}>#</Text>
        <Text style={[s.th, { width: showGap ? '35%' : '45%' }]}>Factor</Text>
        <Text style={[s.th, { width: '9%', textAlign: 'right' }]}>Rating</Text>
        <Text style={[s.th, { width: '11%', textAlign: 'right' }]}>Pts lost</Text>
        {showGap ? <Text style={[s.th, { width: '15%', textAlign: 'right' }]}>Est. gap</Text> : null}
        <Text style={[s.th, { width: showGap ? '25%' : '30%', paddingLeft: 6 }]}>Note</Text>
      </View>
      {rows.map((r) => (
        <View key={r.factorId} style={s.tr} wrap={false}>
          <Text style={[s.td, { width: '5%' }]}>{r.sortOrder}</Text>
          <Text style={[s.td, { width: showGap ? '35%' : '45%' }]}>{r.label}</Text>
          <Text style={[s.td, { width: '9%', textAlign: 'right' }]}>{r.rating ?? '—'}</Text>
          <Text style={[s.td, { width: '11%', textAlign: 'right' }]}>{r.pointsLost}</Text>
          {showGap ? <Text style={[s.td, { width: '15%', textAlign: 'right' }]}>{r.gap === null ? '—' : formatCurrency(r.gap)}</Text> : null}
          <Text style={[s.small, { width: showGap ? '25%' : '30%', paddingLeft: 6 }]}>{r.note ?? ''}</Text>
        </View>
      ))}
    </View>
  );
}
