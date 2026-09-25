import 'server-only';
import { createElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { ReportDocument, type ReportProps } from './ReportDocument';

export async function renderReportPdf(props: ReportProps): Promise<Buffer> {
  const element = createElement(ReportDocument, props);
  // renderToBuffer's typing expects a Document element; ReportDocument returns one.
  return renderToBuffer(element as unknown as Parameters<typeof renderToBuffer>[0]);
}
