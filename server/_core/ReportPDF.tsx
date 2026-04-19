/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 *
 * ReportPDF — branded PDF generation for the Reporting dashboard.
 * Uses @react-pdf/renderer to produce downloadable reports.
 */
import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

const NAVY = "#0F1F3D";
const AMBER = "#F5A623";
const GREY = "#6B7280";
const LIGHT = "#F9FAFB";

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#1F2937" },
  header: { marginBottom: 20, borderBottom: `2px solid ${AMBER}`, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: "bold", color: NAVY, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 11, color: GREY, marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: "bold", color: NAVY, marginBottom: 8, fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", borderBottom: "1px solid #E5E7EB", paddingVertical: 4 },
  headerRow: { flexDirection: "row", borderBottom: `2px solid ${NAVY}`, paddingBottom: 4, marginBottom: 2 },
  cell: { flex: 1, fontSize: 9 },
  cellRight: { flex: 1, fontSize: 9, textAlign: "right" },
  cellBold: { flex: 1, fontSize: 9, fontFamily: "Helvetica-Bold" },
  kpiRow: { flexDirection: "row", marginBottom: 12, gap: 12 },
  kpiBox: { flex: 1, backgroundColor: LIGHT, padding: 10, borderRadius: 4 },
  kpiValue: { fontSize: 18, fontFamily: "Helvetica-Bold", color: NAVY },
  kpiLabel: { fontSize: 8, color: GREY, marginTop: 2 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: GREY, textAlign: "center", borderTop: "1px solid #E5E7EB", paddingTop: 8 },
});

interface ReportPDFProps {
  tab: "revenue" | "quoteConversion" | "jobCosting";
  businessName: string;
  data: Record<string, unknown>;
  dateRange: string;
}

function RevenueReport({ data }: { data: Record<string, unknown> }) {
  const d = data as {
    totalRevenue: number;
    avgJobValue: number;
    totalOutstanding: number;
    outstandingCount: number;
    totalJobCount: number;
    completedCount: number;
    activeCount: number;
    lostCount: number;
    monthlyRevenue: { month: string; amount: number }[];
  };
  return (
    <View>
      <View style={s.kpiRow}>
        <View style={s.kpiBox}>
          <Text style={s.kpiValue}>${(d.totalRevenue ?? 0).toLocaleString()}</Text>
          <Text style={s.kpiLabel}>Total Revenue</Text>
        </View>
        <View style={s.kpiBox}>
          <Text style={s.kpiValue}>${(d.avgJobValue ?? 0).toLocaleString()}</Text>
          <Text style={s.kpiLabel}>Avg Job Value</Text>
        </View>
        <View style={s.kpiBox}>
          <Text style={s.kpiValue}>${(d.totalOutstanding ?? 0).toLocaleString()}</Text>
          <Text style={s.kpiLabel}>Outstanding ({d.outstandingCount ?? 0})</Text>
        </View>
      </View>
      <View style={s.kpiRow}>
        <View style={s.kpiBox}>
          <Text style={s.kpiValue}>{d.totalJobCount ?? 0}</Text>
          <Text style={s.kpiLabel}>Total Jobs</Text>
        </View>
        <View style={s.kpiBox}>
          <Text style={s.kpiValue}>{d.completedCount ?? 0}</Text>
          <Text style={s.kpiLabel}>Completed</Text>
        </View>
        <View style={s.kpiBox}>
          <Text style={s.kpiValue}>{d.activeCount ?? 0}</Text>
          <Text style={s.kpiLabel}>Active</Text>
        </View>
      </View>
      <View style={s.section}>
        <Text style={s.sectionTitle}>Monthly Revenue</Text>
        <View style={s.headerRow}>
          <Text style={s.cellBold}>Month</Text>
          <Text style={{ ...s.cellBold, textAlign: "right" as const }}>Revenue</Text>
        </View>
        {(d.monthlyRevenue ?? []).map((m, i) => (
          <View key={i} style={s.row}>
            <Text style={s.cell}>{m.month}</Text>
            <Text style={s.cellRight}>${m.amount.toLocaleString()}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function QuoteConversionReport({ data }: { data: Record<string, unknown> }) {
  const d = data as {
    funnel: { total: number; sent: number; accepted: number; declined: number; expired: number; convertedToJob: number; paidFromQuote: number };
    conversionRate: number;
    avgQuoteValue: number;
    avgDaysToAccept: number;
  };
  const f = d.funnel ?? { total: 0, sent: 0, accepted: 0, declined: 0, expired: 0, convertedToJob: 0, paidFromQuote: 0 };
  return (
    <View>
      <View style={s.kpiRow}>
        <View style={s.kpiBox}>
          <Text style={s.kpiValue}>{d.conversionRate ?? 0}%</Text>
          <Text style={s.kpiLabel}>Conversion Rate</Text>
        </View>
        <View style={s.kpiBox}>
          <Text style={s.kpiValue}>${(d.avgQuoteValue ?? 0).toLocaleString()}</Text>
          <Text style={s.kpiLabel}>Avg Quote Value</Text>
        </View>
        <View style={s.kpiBox}>
          <Text style={s.kpiValue}>{d.avgDaysToAccept ?? 0}d</Text>
          <Text style={s.kpiLabel}>Avg Days to Accept</Text>
        </View>
      </View>
      <View style={s.section}>
        <Text style={s.sectionTitle}>Quote Funnel</Text>
        <View style={s.headerRow}>
          <Text style={s.cellBold}>Stage</Text>
          <Text style={{ ...s.cellBold, textAlign: "right" as const }}>Count</Text>
        </View>
        {[
          ["Created", f.total],
          ["Sent", f.sent],
          ["Accepted", f.accepted],
          ["Declined", f.declined],
          ["Expired", f.expired],
          ["Converted to Job", f.convertedToJob],
          ["Paid", f.paidFromQuote],
        ].map(([label, val], i) => (
          <View key={i} style={s.row}>
            <Text style={s.cell}>{label as string}</Text>
            <Text style={s.cellRight}>{String(val)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function JobCostingReport({ data }: { data: Record<string, unknown> }) {
  const d = data as {
    summary: { totalJobs: number; profitableJobs: number; lossJobs: number };
    jobCosting: { jobTitle: string; revenue: number; totalCost: number; margin: number; marginPct: number }[];
  };
  return (
    <View>
      <View style={s.kpiRow}>
        <View style={s.kpiBox}>
          <Text style={s.kpiValue}>{d.summary?.totalJobs ?? 0}</Text>
          <Text style={s.kpiLabel}>Total Jobs</Text>
        </View>
        <View style={s.kpiBox}>
          <Text style={s.kpiValue}>{d.summary?.profitableJobs ?? 0}</Text>
          <Text style={s.kpiLabel}>Profitable</Text>
        </View>
        <View style={s.kpiBox}>
          <Text style={s.kpiValue}>{d.summary?.lossJobs ?? 0}</Text>
          <Text style={s.kpiLabel}>Loss-Making</Text>
        </View>
      </View>
      <View style={s.section}>
        <Text style={s.sectionTitle}>Job Margin Analysis (sorted worst-first)</Text>
        <View style={s.headerRow}>
          <Text style={{ ...s.cellBold, flex: 2 }}>Job</Text>
          <Text style={{ ...s.cellBold, textAlign: "right" as const }}>Revenue</Text>
          <Text style={{ ...s.cellBold, textAlign: "right" as const }}>Cost</Text>
          <Text style={{ ...s.cellBold, textAlign: "right" as const }}>Margin</Text>
          <Text style={{ ...s.cellBold, textAlign: "right" as const }}>%</Text>
        </View>
        {(d.jobCosting ?? []).slice(0, 30).map((j, i) => (
          <View key={i} style={s.row}>
            <Text style={{ ...s.cell, flex: 2 }}>{j.jobTitle}</Text>
            <Text style={s.cellRight}>${j.revenue.toLocaleString()}</Text>
            <Text style={s.cellRight}>${j.totalCost.toLocaleString()}</Text>
            <Text style={s.cellRight}>${j.margin.toLocaleString()}</Text>
            <Text style={s.cellRight}>{j.marginPct}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const TAB_TITLES: Record<string, string> = {
  revenue: "Revenue Report",
  quoteConversion: "Quote Conversion Report",
  jobCosting: "Job Costing Report",
};

export function ReportPDFDocument({ tab, businessName, data, dateRange }: ReportPDFProps) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.title}>{TAB_TITLES[tab] ?? "Report"}</Text>
          <Text style={s.subtitle}>{businessName} — {dateRange}</Text>
          <Text style={s.subtitle}>Generated {new Date().toLocaleDateString("en-AU")}</Text>
        </View>
        {tab === "revenue" && <RevenueReport data={data} />}
        {tab === "quoteConversion" && <QuoteConversionReport data={data} />}
        {tab === "jobCosting" && <JobCostingReport data={data} />}
        <Text style={s.footer}>
          Powered by SOLVR — solvr.com.au — Confidential
        </Text>
      </Page>
    </Document>
  );
}
