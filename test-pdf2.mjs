import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
const { ReportPDFDocument } = await import('./server/_core/ReportPDF.tsx');

// Test with empty/null data (what happens when a new user has no data)
const emptyData = {};

try {
  const element = React.createElement(ReportPDFDocument, {
    tab: 'revenue',
    businessName: 'Test Business',
    data: emptyData,
    dateRange: 'Last 12 months',
  });
  const buf = Buffer.from(await renderToBuffer(element));
  console.log('Revenue empty: SUCCESS, size', buf.length);
} catch (e) {
  console.error('Revenue empty: ERROR:', e.message);
}

try {
  const element = React.createElement(ReportPDFDocument, {
    tab: 'quoteConversion',
    businessName: 'Test Business',
    data: emptyData,
    dateRange: 'Last 12 months',
  });
  const buf = Buffer.from(await renderToBuffer(element));
  console.log('QuoteConversion empty: SUCCESS, size', buf.length);
} catch (e) {
  console.error('QuoteConversion empty: ERROR:', e.message);
}

try {
  const element = React.createElement(ReportPDFDocument, {
    tab: 'jobCosting',
    businessName: 'Test Business',
    data: emptyData,
    dateRange: 'Last 12 months',
  });
  const buf = Buffer.from(await renderToBuffer(element));
  console.log('JobCosting empty: SUCCESS, size', buf.length);
} catch (e) {
  console.error('JobCosting empty: ERROR:', e.message);
}
