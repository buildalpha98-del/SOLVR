import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';

const { ReportPDFDocument } = await import('./server/_core/ReportPDF.tsx');

const data = {
  totalRevenue: 15000,
  avgJobValue: 500,
  totalOutstanding: 2000,
  outstandingCount: 3,
  totalJobCount: 30,
  completedCount: 25,
  activeCount: 3,
  lostCount: 2,
  monthlyRevenue: [
    { month: 'Jan 2026', amount: 1200 },
    { month: 'Feb 2026', amount: 1500 },
  ],
};

try {
  const element = React.createElement(ReportPDFDocument, {
    tab: 'revenue',
    businessName: 'Test Business',
    data,
    dateRange: 'Last 12 months',
  });
  const buf = Buffer.from(await renderToBuffer(element));
  console.log('SUCCESS: buffer size', buf.length);
} catch (e) {
  console.error('ERROR:', e.message);
  console.error(e.stack);
}
