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
import {
  getPdfLabels,
  isRTL,
  rtlStyle,
  rtlBoldStyle,
  QUOTE_TRANSLATIONS,
} from "./pdfTranslations";

// ── Fonts ─────────────────────────────────────────────────────────────────────
// Using built-in Helvetica for LTR languages.
// Noto Sans Arabic is registered for Arabic (ar) to support RTL text rendering.
Font.register({
  family: "NotoSansArabic",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/notosansarabic/v18/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfyGybdQ.woff",
      fontWeight: "normal",
    },
    {
      src: "https://fonts.gstatic.com/s/notosansarabic/v18/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfyGyb9w.woff",
      fontWeight: "bold",
    },
  ],
});
// Disable hyphenation for Arabic (words must not be split)
Font.registerHyphenationCallback((word) => [word]);

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
  // Signature block
  signatureBlock: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
    gap: 24,
  },
  signatureItem: { flex: 1 },
  signatureLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 20,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#D1D5DB",
    marginBottom: 4,
  },
  signatureSubLabel: { fontSize: 8, color: "#9CA3AF" },
  // Accept CTA box
  acceptBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  acceptBoxText: { fontSize: 9, color: "#FFFFFF", fontFamily: "Helvetica-Bold" },
  acceptBoxUrl: { fontSize: 8, color: "rgba(255,255,255,0.75)" },
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
    backgroundColor: "#2563EB", // overridden inline with accent
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
// (All translation helpers imported from shared pdfTranslations.ts above)

export interface QuoteProposalPdfInput {
  acceptUrl?: string | null;
  /** ISO-639-1 language code of the original voice recording (e.g. "ar", "zh"). Used to render a translated subtitle in the PDF header. */
  detectedLanguage?: string | null;
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
  const L = getPdfLabels(input.detectedLanguage);
  const lang = input.detectedLanguage;
  // RTL: base page font overrides for Arabic
  const pageStyle = isRTL(lang)
    ? [styles.page, { fontFamily: "NotoSansArabic" }]
    : styles.page;

  return (
    <Page size="A4" style={pageStyle}>
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
          {input.detectedLanguage && input.detectedLanguage !== "en" && QUOTE_TRANSLATIONS[input.detectedLanguage] && (
            <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.65)", marginTop: 2, textAlign: "right" }}>
              {QUOTE_TRANSLATIONS[input.detectedLanguage]}
            </Text>
          )}
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
        <View style={isRTL(lang) ? [styles.infoRow, { flexDirection: "row-reverse" }] : styles.infoRow}>
          <View style={styles.infoBox}>
            <Text style={[styles.infoBoxTitle, rtlStyle(lang)]}>{L.billTo}</Text>
            {quote.customerName && (
              <Text style={[styles.infoTextBold, rtlStyle(lang)]}>{quote.customerName}</Text>
            )}
            {quote.customerAddress && (
              <Text style={[styles.infoText, rtlStyle(lang)]}>{quote.customerAddress}</Text>
            )}
            {quote.customerPhone && (
              <Text style={[styles.infoText, rtlStyle(lang)]}>{quote.customerPhone}</Text>
            )}
            {quote.customerEmail && (
              <Text style={[styles.infoText, rtlStyle(lang)]}>{quote.customerEmail}</Text>
            )}
            {!quote.customerName && !quote.customerAddress && (
              <Text style={[styles.infoText, rtlStyle(lang)]}>—</Text>
            )}
          </View>
          <View style={styles.infoBox}>
            <Text style={[styles.infoBoxTitle, rtlStyle(lang)]}>{L.job}</Text>
            <Text style={[styles.infoTextBold, rtlStyle(lang)]}>{quote.jobTitle}</Text>
            {quote.jobDescription && (
              <Text style={[styles.infoText, { marginTop: 4 }, rtlStyle(lang)]}>{quote.jobDescription}</Text>
            )}
          </View>
        </View>

        {/* Line items */}
        <Text style={[styles.sectionHeading, rtlStyle(lang)]}>{L.scopeAndPricing}</Text>
        <View style={isRTL(lang) ? [styles.tableHeader, { flexDirection: "row-reverse" }] : styles.tableHeader}>
          <Text style={[styles.colDesc, styles.colHeaderText, rtlStyle(lang)]}>{L.description}</Text>
          <Text style={[styles.colQty, styles.colHeaderText, rtlStyle(lang)]}>{L.qty}</Text>
          <Text style={[styles.colUnit, styles.colHeaderText, rtlStyle(lang)]}>{L.unit}</Text>
          <Text style={[styles.colPrice, styles.colHeaderText, rtlStyle(lang)]}>{L.unitPrice}</Text>
          <Text style={[styles.colTotal, styles.colHeaderText, rtlStyle(lang)]}>{L.total}</Text>
        </View>
        {lineItems.map((li, i) => (
          <View key={i} style={isRTL(lang) ? [styles.tableRow, { flexDirection: "row-reverse" }] : styles.tableRow}>
            <Text style={[styles.colDesc, rtlStyle(lang)]}>{li.description}</Text>
            <Text style={[styles.colQty, rtlStyle(lang)]}>{li.quantity}</Text>
            <Text style={[styles.colUnit, rtlStyle(lang)]}>{li.unit ?? "each"}</Text>
            <Text style={styles.colPrice}>{formatCurrency(li.unitPrice)}</Text>
            <Text style={styles.colTotal}>{formatCurrency(li.lineTotal)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, rtlStyle(lang)]}>{L.subtotal}</Text>
            <Text style={styles.totalValue}>{formatCurrency(quote.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, rtlStyle(lang)]}>{L.gst} ({quote.gstRate}%)</Text>
            <Text style={styles.totalValue}>{formatCurrency(quote.gstAmount)}</Text>
          </View>
          <View style={[styles.totalRow, { marginTop: 4 }]}>
            <Text style={[styles.grandTotalLabel, rtlBoldStyle(lang)]}>{L.grandTotal}</Text>
            <Text style={[styles.grandTotalValue, { color: accent }]}>
              {formatCurrency(quote.totalAmount)}
            </Text>
          </View>
        </View>

        {/* Terms */}
        <View style={isRTL(lang) ? [styles.termsRow, { flexDirection: "row-reverse" }] : styles.termsRow}>
          <View style={styles.termItem}>
            <Text style={[styles.termLabel, rtlBoldStyle(lang)]}>{L.paymentTerms}</Text>
            <Text style={[styles.termValue, rtlStyle(lang)]}>{quote.paymentTerms ?? "Due on completion"}</Text>
          </View>
          <View style={styles.termItem}>
            <Text style={[styles.termLabel, rtlBoldStyle(lang)]}>{L.validUntil}</Text>
            <Text style={[styles.termValue, rtlStyle(lang)]}>{formatDate(quote.validUntil)}</Text>
          </View>
          <View style={styles.termItem}>
            <Text style={[styles.termLabel, rtlBoldStyle(lang)]}>{L.preparedBy}</Text>
            <Text style={[styles.termValue, rtlStyle(lang)]}>{branding.businessName}</Text>
          </View>
        </View>

        {/* Notes */}
        {quote.notes && (
          <View style={styles.notesBox}>
            <Text style={[styles.notesText, rtlStyle(lang)]}>{quote.notes}</Text>
          </View>
        )}

        {/* Signature / Acceptance block */}
        <View style={isRTL(lang) ? [styles.signatureBlock, { flexDirection: "row-reverse" }] : styles.signatureBlock}>
          <View style={styles.signatureItem}>
            <Text style={[styles.signatureLabel, rtlBoldStyle(lang)]}>{L.customerSignature}</Text>
            <View style={styles.signatureLine} />
            <Text style={[styles.signatureSubLabel, rtlStyle(lang)]}>{L.signatureDate}</Text>
          </View>
          <View style={styles.signatureItem}>
            <Text style={[styles.signatureLabel, rtlBoldStyle(lang)]}>{L.authorisedBy} ({branding.businessName})</Text>
            <View style={styles.signatureLine} />
            <Text style={[styles.signatureSubLabel, rtlStyle(lang)]}>{L.signatureDate}</Text>
          </View>
        </View>

        {/* Accept online CTA */}
        {input.acceptUrl && (
          <View style={isRTL(lang) ? [styles.acceptBox, { backgroundColor: accent, flexDirection: "row-reverse" }] : [styles.acceptBox, { backgroundColor: accent }]}>
            <Text style={[styles.acceptBoxText, rtlBoldStyle(lang)]}>{L.acceptOnline}</Text>
            <Text style={styles.acceptBoxUrl}>{input.acceptUrl}</Text>
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
  detectedLanguage,
}: {
  report: QuoteReportContent;
  branding: QuoteProposalPdfInput["branding"];
  photos: QuoteProposalPdfInput["photos"];
  photoBuffers: (Buffer | null)[];
  quoteNumber: string;
  detectedLanguage?: string | null;
}) {
  const primary = branding.primaryColor || "#1F2937";
  const accent = branding.secondaryColor || "#2563EB";
  const lang = detectedLanguage;
  const reportPageStyle = isRTL(lang)
    ? [styles.reportPage, { fontFamily: "NotoSansArabic" }]
    : styles.reportPage;

  return (
    <Page size="A4" style={reportPageStyle}>
      {/* Header */}
      <View style={[styles.reportHeader, { backgroundColor: primary }]}>
        <Text style={styles.reportHeaderTitle}>Proposal — {branding.businessName}</Text>
        <Text style={styles.reportHeaderSub}>{quoteNumber}</Text>
      </View>
      <View style={[styles.accentBar, { backgroundColor: accent }]} />

      <View style={styles.reportBody}>
        {/* Scope of Works */}
        <Text style={[styles.reportSectionTitle, rtlStyle(lang)]}>Scope of Works</Text>
        <Text style={[styles.reportBodyText, rtlStyle(lang)]}>{report.scopeOfWorks}</Text>

        {/* Methodology */}
        {report.methodology.length > 0 && (
          <>
            <Text style={[styles.reportSectionTitle, rtlStyle(lang)]}>Our Methodology</Text>
            {report.methodology.map((step) => (
              <View key={step.stepNumber} style={isRTL(lang) ? [styles.stepRow, { flexDirection: "row-reverse" }] : styles.stepRow}>
                <View style={[styles.stepNumber, { backgroundColor: accent }]}>
                  <Text style={styles.stepNumberText}>{step.stepNumber}</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={[styles.stepTitle, rtlBoldStyle(lang)]}>{step.title}</Text>
                  <Text style={[styles.stepDesc, rtlStyle(lang)]}>{step.description}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Materials */}
        {report.materials.length > 0 && (
          <>
            <Text style={[styles.reportSectionTitle, rtlStyle(lang)]}>Materials & Specifications</Text>
            {report.materials.map((mat, i) => (
              <View key={i} style={styles.materialRow}>
                <Text style={[styles.materialName, rtlBoldStyle(lang)]}>{mat.name}</Text>
                <Text style={[styles.materialText, rtlStyle(lang)]}>{mat.reason}</Text>
                {mat.specs && (
                  <Text style={[styles.materialText, { color: "#6B7280" }, rtlStyle(lang)]}>{mat.specs}</Text>
                )}
              </View>
            ))}
          </>
        )}

        {/* Inclusions & Exclusions */}
        {report.inclusionsExclusions && report.inclusionsExclusions.length > 0 && (
          <>
            <Text style={[styles.reportSectionTitle, rtlStyle(lang)]}>Inclusions & Exclusions</Text>
            <View style={isRTL(lang) ? { flexDirection: "row-reverse", gap: 16, marginBottom: 8 } : { flexDirection: "row", gap: 16, marginBottom: 8 }}>
              {/* Inclusions */}
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepTitle, { color: "#166534", marginBottom: 4 }, rtlBoldStyle(lang)]}>✓ Included</Text>
                {report.inclusionsExclusions
                  .filter((ie) => ie.type === "inclusion")
                  .map((ie, i) => (
                    <View key={i} style={isRTL(lang) ? { flexDirection: "row-reverse", marginBottom: 3 } : { flexDirection: "row", marginBottom: 3 }}>
                      <Text style={{ fontSize: 9, color: "#166534", marginRight: isRTL(lang) ? 0 : 4, marginLeft: isRTL(lang) ? 4 : 0 }}>•</Text>
                      <Text style={[{ fontSize: 9, color: "#374151", flex: 1, lineHeight: 1.4 }, rtlStyle(lang)]}>{ie.item}</Text>
                    </View>
                  ))}
              </View>
              {/* Exclusions */}
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepTitle, { color: "#991B1B", marginBottom: 4 }, rtlBoldStyle(lang)]}>✗ Excluded</Text>
                {report.inclusionsExclusions
                  .filter((ie) => ie.type === "exclusion")
                  .map((ie, i) => (
                    <View key={i} style={isRTL(lang) ? { flexDirection: "row-reverse", marginBottom: 3 } : { flexDirection: "row", marginBottom: 3 }}>
                      <Text style={{ fontSize: 9, color: "#991B1B", marginRight: isRTL(lang) ? 0 : 4, marginLeft: isRTL(lang) ? 4 : 0 }}>•</Text>
                      <Text style={[{ fontSize: 9, color: "#374151", flex: 1, lineHeight: 1.4 }, rtlStyle(lang)]}>{ie.item}</Text>
                    </View>
                  ))}
              </View>
            </View>
          </>
        )}

        {/* Site Observations */}
        {report.siteObservations && (
          <>
            <Text style={[styles.reportSectionTitle, rtlStyle(lang)]}>Site Observations</Text>
            <Text style={[styles.reportBodyText, rtlStyle(lang)]}>{report.siteObservations}</Text>
          </>
        )}

        {/* Photos */}
        {photos.length > 0 && photoBuffers.some((b) => b !== null) && (
          <>
            <Text style={[styles.reportSectionTitle, rtlStyle(lang)]}>Site Photos</Text>
            <View style={styles.photoGrid}>
              {photos.map((photo, i) => {
                const buf = photoBuffers[i];
                if (!buf) return null;
                return (
                  <View key={i} style={styles.photoItem}>
                    <Image src={buf} style={styles.photoImg} />
                    {photo.caption && (
                      <Text style={[styles.photoCaption, rtlStyle(lang)]}>{photo.caption}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Warranty & Guarantee */}
        {report.warrantyAndGuarantee && (
          <>
            <Text style={[styles.reportSectionTitle, rtlStyle(lang)]}>Warranty & Guarantee</Text>
            <View style={[styles.materialRow, { borderLeftColor: "#2563EB", borderLeftWidth: 3, paddingLeft: 10 }]}>
              <Text style={[styles.materialText, rtlStyle(lang)]}>{report.warrantyAndGuarantee}</Text>
            </View>
          </>
        )}

        {/* Why Choose Us */}
        {report.whyChooseUs && (
          <>
            <Text style={[styles.reportSectionTitle, rtlStyle(lang)]}>Why Choose Us</Text>
            <Text style={[styles.reportBodyText, rtlStyle(lang)]}>{report.whyChooseUs}</Text>
          </>
        )}

        {/* Important Information */}
        <Text style={[styles.reportSectionTitle, rtlStyle(lang)]}>Important Information</Text>
        <Text style={[styles.reportBodyText, rtlStyle(lang)]}>{report.importantInformation}</Text>

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
          detectedLanguage={input.detectedLanguage}
        />
      )}
    </Document>
  );
}
