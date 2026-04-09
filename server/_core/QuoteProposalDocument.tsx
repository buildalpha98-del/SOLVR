import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { QuoteReportContent } from "./reportGeneration";

// ── Fonts ─────────────────────────────────────────────────────────────────────
// Using built-in Helvetica — no external font registration needed for PDF

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1F2937",
    backgroundColor: "#FFFFFF",
    paddingTop: 0,
    paddingBottom: 40,
    paddingHorizontal: 0,
  },
  // Header bar
  header: {
    backgroundColor: "#1F2937",
    paddingHorizontal: 40,
    paddingTop: 32,
    paddingBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  logo: {
    height: 40,
    maxWidth: 160,
    objectFit: "contain",
  },
  businessName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    color: "#FFFFFF",
    marginBottom: 4,
  },
  quoteLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  quoteNumber: {
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    color: "#FFFFFF",
    marginTop: 2,
  },
  // Accent bar
  accentBar: {
    height: 4,
    backgroundColor: "#2563EB",
  },
  // Body
  body: {
    paddingHorizontal: 40,
    paddingTop: 28,
  },
  // Customer + Job info row
  infoRow: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 24,
  },
  infoBox: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 4,
    padding: 14,
  },
  infoBoxTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: "#6B7280",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  infoText: {
    fontSize: 10,
    color: "#1F2937",
    lineHeight: 1.5,
  },
  infoTextBold: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: "#1F2937",
  },
  // Section heading
  sectionHeading: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: "#6B7280",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 4,
  },
  // Line items table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 2,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  colDesc: { flex: 4, fontSize: 10, color: "#1F2937" },
  colQty: { flex: 1, fontSize: 10, color: "#1F2937", textAlign: "right" },
  colUnit: { flex: 1, fontSize: 10, color: "#6B7280", textAlign: "center" },
  colPrice: { flex: 1.5, fontSize: 10, color: "#1F2937", textAlign: "right" },
  colTotal: { flex: 1.5, fontSize: 10, color: "#1F2937", textAlign: "right" },
  colHeaderText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Totals
  totalsBlock: {
    marginTop: 12,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 24,
    marginBottom: 4,
  },
  totalLabel: { fontSize: 10, color: "#6B7280", width: 100, textAlign: "right" },
  totalValue: { fontSize: 10, color: "#1F2937", width: 80, textAlign: "right" },
  grandTotalLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: "#1F2937",
    width: 100,
    textAlign: "right",
  },
  grandTotalValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: "#2563EB",
    width: 80,
    textAlign: "right",
  },
  // Terms row
  termsRow: {
    flexDirection: "row",
    gap: 24,
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  termItem: { flex: 1 },
  termLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  termValue: { fontSize: 10, color: "#1F2937" },
  // Notes
  notesBox: {
    backgroundColor: "#FFF7ED",
    borderLeftWidth: 3,
    borderLeftColor: "#F59E0B",
    padding: 12,
    marginTop: 16,
    borderRadius: 2,
  },
  notesText: { fontSize: 10, color: "#92400E", lineHeight: 1.5 },
  // Footer
  footer: {
    position: "absolute",
    bottom: 16,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: { fontSize: 8, color: "#9CA3AF" },
  // Report page styles
  reportPage: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1F2937",
    backgroundColor: "#FFFFFF",
    paddingTop: 0,
    paddingBottom: 40,
    paddingHorizontal: 0,
  },
  reportHeader: {
    backgroundColor: "#1F2937",
    paddingHorizontal: 40,
    paddingTop: 20,
    paddingBottom: 16,
  },
  reportHeaderTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  reportHeaderSub: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 2,
  },
  reportBody: {
    paddingHorizontal: 40,
    paddingTop: 24,
  },
  reportSectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: "#1F2937",
    marginTop: 20,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 4,
  },
  reportBodyText: {
    fontSize: 10,
    color: "#374151",
    lineHeight: 1.6,
    marginBottom: 8,
  },
  stepRow: {
    flexDirection: "row",
    marginBottom: 10,
    gap: 10,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: "#FFFFFF",
  },
  stepContent: { flex: 1 },
  stepTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: "#1F2937",
    marginBottom: 2,
  },
  stepDesc: { fontSize: 10, color: "#374151", lineHeight: 1.5 },
  materialRow: {
    marginBottom: 8,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: "#E5E7EB",
  },
  materialName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: "#1F2937",
    marginBottom: 2,
  },
  materialText: { fontSize: 10, color: "#374151", lineHeight: 1.5 },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  photoItem: {
    width: "48%",
    marginBottom: 8,
  },
  photoImg: {
    width: "100%",
    height: 140,
    objectFit: "cover",
    borderRadius: 3,
  },
  photoCaption: {
    fontSize: 8,
    color: "#6B7280",
    marginTop: 3,
    lineHeight: 1.4,
  },
  poweredBy: {
    fontSize: 8,
    color: "#D1D5DB",
    textAlign: "center",
    marginTop: 8,
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatCurrency(amount: number | string | null | undefined): string {
  if (amount == null) return "TBD";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface QuoteProposalPdfInput {
  quote: {
    quoteNumber: string;
    jobTitle: string;
    jobDescription: string | null;
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    customerAddress: string | null;
    subtotal: string | null;
    gstRate: string;
    gstAmount: string | null;
    totalAmount: string | null;
    paymentTerms: string | null;
    validUntil: string | null;
    notes: string | null;
    reportContent: QuoteReportContent | null;
  };
  lineItems: {
    description: string;
    quantity: string;
    unit: string | null;
    unitPrice: string | null;
    lineTotal: string | null;
  }[];
  photos: {
    imageUrl: string;
    caption: string | null;
    aiDescription: string | null;
  }[];
  branding: {
    businessName: string;
    abn: string;
    phone: string;
    address: string;
    logoBuffer: Buffer | null;
    primaryColor: string;
    secondaryColor: string;
  };
  photoBuffers: (Buffer | null)[];
}

// ── Quote Page ────────────────────────────────────────────────────────────────
function QuotePage({ input }: { input: QuoteProposalPdfInput }) {
  const { quote, lineItems, branding } = input;
  const primary = branding.primaryColor || "#1F2937";
  const accent = branding.secondaryColor || "#2563EB";

  return (
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: primary }]}>
        <View style={styles.headerLeft}>
          {branding.logoBuffer ? (
            <Image
              src={branding.logoBuffer}
              style={styles.logo}
            />
          ) : (
            <Text style={styles.businessName}>{branding.businessName}</Text>
          )}
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.quoteLabel}>QUOTE</Text>
          <Text style={styles.quoteNumber}>{quote.quoteNumber}</Text>
        </View>
      </View>

      {/* Business details bar */}
      {(branding.abn || branding.phone || branding.address) && (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, paddingVertical: 4, paddingHorizontal: 24, backgroundColor: "#F9FAFB" }}>
          {branding.abn ? <Text style={{ fontSize: 8, color: "#6B7280" }}>ABN {branding.abn}</Text> : null}
          {branding.phone ? <Text style={{ fontSize: 8, color: "#6B7280" }}>{branding.phone}</Text> : null}
          {branding.address ? <Text style={{ fontSize: 8, color: "#6B7280" }}>{branding.address}</Text> : null}
        </View>
      )}

      {/* Accent bar */}
      <View style={[styles.accentBar, { backgroundColor: accent }]} />

      <View style={styles.body}>
        {/* Customer + Job info */}
        <View style={styles.infoRow}>
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxTitle}>Prepared For</Text>
            {quote.customerName && (
              <Text style={styles.infoTextBold}>{quote.customerName}</Text>
            )}
            {quote.customerAddress && (
              <Text style={styles.infoText}>{quote.customerAddress}</Text>
            )}
            {quote.customerPhone && (
              <Text style={styles.infoText}>{quote.customerPhone}</Text>
            )}
            {quote.customerEmail && (
              <Text style={styles.infoText}>{quote.customerEmail}</Text>
            )}
            {!quote.customerName && !quote.customerAddress && (
              <Text style={styles.infoText}>—</Text>
            )}
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxTitle}>Job</Text>
            <Text style={styles.infoTextBold}>{quote.jobTitle}</Text>
            {quote.jobDescription && (
              <Text style={[styles.infoText, { marginTop: 4 }]}>{quote.jobDescription}</Text>
            )}
          </View>
        </View>

        {/* Line items */}
        <Text style={styles.sectionHeading}>Scope of Works & Pricing</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.colDesc, styles.colHeaderText]}>Description</Text>
          <Text style={[styles.colQty, styles.colHeaderText]}>Qty</Text>
          <Text style={[styles.colUnit, styles.colHeaderText]}>Unit</Text>
          <Text style={[styles.colPrice, styles.colHeaderText]}>Unit Price</Text>
          <Text style={[styles.colTotal, styles.colHeaderText]}>Total</Text>
        </View>
        {lineItems.map((li, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.colDesc}>{li.description}</Text>
            <Text style={styles.colQty}>{li.quantity}</Text>
            <Text style={styles.colUnit}>{li.unit ?? "each"}</Text>
            <Text style={styles.colPrice}>{formatCurrency(li.unitPrice)}</Text>
            <Text style={styles.colTotal}>{formatCurrency(li.lineTotal)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(quote.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>GST ({quote.gstRate}%)</Text>
            <Text style={styles.totalValue}>{formatCurrency(quote.gstAmount)}</Text>
          </View>
          <View style={[styles.totalRow, { marginTop: 4 }]}>
            <Text style={styles.grandTotalLabel}>TOTAL (AUD)</Text>
            <Text style={[styles.grandTotalValue, { color: accent }]}>
              {formatCurrency(quote.totalAmount)}
            </Text>
          </View>
        </View>

        {/* Terms */}
        <View style={styles.termsRow}>
          <View style={styles.termItem}>
            <Text style={styles.termLabel}>Payment Terms</Text>
            <Text style={styles.termValue}>{quote.paymentTerms ?? "Due on completion"}</Text>
          </View>
          <View style={styles.termItem}>
            <Text style={styles.termLabel}>Valid Until</Text>
            <Text style={styles.termValue}>{formatDate(quote.validUntil)}</Text>
          </View>
          <View style={styles.termItem}>
            <Text style={styles.termLabel}>Prepared By</Text>
            <Text style={styles.termValue}>{branding.businessName}</Text>
          </View>
        </View>

        {/* Notes */}
        {quote.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesText}>{quote.notes}</Text>
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>{quote.quoteNumber} · {branding.businessName}{branding.abn ? ` · ABN ${branding.abn}` : ""}</Text>
        <Text style={styles.footerText}>Powered by Solvr</Text>
      </View>
    </Page>
  );
}

// ── Report Page ───────────────────────────────────────────────────────────────
function ReportPage({
  report,
  branding,
  photos,
  photoBuffers,
  quoteNumber,
}: {
  report: QuoteReportContent;
  branding: QuoteProposalPdfInput["branding"];
  photos: QuoteProposalPdfInput["photos"];
  photoBuffers: (Buffer | null)[];
  quoteNumber: string;
}) {
  const primary = branding.primaryColor || "#1F2937";
  const accent = branding.secondaryColor || "#2563EB";

  return (
    <Page size="A4" style={styles.reportPage}>
      {/* Header */}
      <View style={[styles.reportHeader, { backgroundColor: primary }]}>
        <Text style={styles.reportHeaderTitle}>Proposal — {branding.businessName}</Text>
        <Text style={styles.reportHeaderSub}>{quoteNumber}</Text>
      </View>
      <View style={[styles.accentBar, { backgroundColor: accent }]} />

      <View style={styles.reportBody}>
        {/* Scope of Works */}
        <Text style={styles.reportSectionTitle}>Scope of Works</Text>
        <Text style={styles.reportBodyText}>{report.scopeOfWorks}</Text>

        {/* Methodology */}
        {report.methodology.length > 0 && (
          <>
            <Text style={styles.reportSectionTitle}>Our Methodology</Text>
            {report.methodology.map((step) => (
              <View key={step.stepNumber} style={styles.stepRow}>
                <View style={[styles.stepNumber, { backgroundColor: accent }]}>
                  <Text style={styles.stepNumberText}>{step.stepNumber}</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDesc}>{step.description}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Materials */}
        {report.materials.length > 0 && (
          <>
            <Text style={styles.reportSectionTitle}>Materials & Specifications</Text>
            {report.materials.map((mat, i) => (
              <View key={i} style={styles.materialRow}>
                <Text style={styles.materialName}>{mat.name}</Text>
                <Text style={styles.materialText}>{mat.reason}</Text>
                {mat.specs && (
                  <Text style={[styles.materialText, { color: "#6B7280" }]}>{mat.specs}</Text>
                )}
              </View>
            ))}
          </>
        )}

        {/* Site Observations */}
        {report.siteObservations && (
          <>
            <Text style={styles.reportSectionTitle}>Site Observations</Text>
            <Text style={styles.reportBodyText}>{report.siteObservations}</Text>
          </>
        )}

        {/* Photos */}
        {photos.length > 0 && photoBuffers.some((b) => b !== null) && (
          <>
            <Text style={styles.reportSectionTitle}>Site Photos</Text>
            <View style={styles.photoGrid}>
              {photos.map((photo, i) => {
                const buf = photoBuffers[i];
                if (!buf) return null;
                return (
                  <View key={i} style={styles.photoItem}>
                    <Image src={buf} style={styles.photoImg} />
                    {photo.caption && (
                      <Text style={styles.photoCaption}>{photo.caption}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Important Information */}
        <Text style={styles.reportSectionTitle}>Important Information</Text>
        <Text style={styles.reportBodyText}>{report.importantInformation}</Text>

        <Text style={styles.poweredBy}>Powered by Solvr · solvr.com.au</Text>
      </View>

      {/* Footer */}
      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>{quoteNumber} · {branding.businessName}</Text>
        <Text style={styles.footerText}>Powered by Solvr</Text>
      </View>
    </Page>
  );
}

// ── Main Document ─────────────────────────────────────────────────────────────
export function QuoteProposalDocument({
  input,
}: {
  input: QuoteProposalPdfInput;
}) {
  return (
    <Document>
      <QuotePage input={input} />
      {input.quote.reportContent && (
        <ReportPage
          report={input.quote.reportContent}
          branding={input.branding}
          photos={input.photos}
          photoBuffers={input.photoBuffers}
          quoteNumber={input.quote.quoteNumber}
        />
      )}
    </Document>
  );
}
