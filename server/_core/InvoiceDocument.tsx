import React from "react";
import {
  Document,
  Font,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { getPdfLabels, isRTL, rtlStyle } from "./pdfTranslations";

// Register Noto Sans Arabic for RTL support
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
Font.registerHyphenationCallback((word) => [word]);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InvoiceLineItem {
  description: string;
  quantity: string;
  unit: string | null;
  unitPrice: string | null;
  lineTotal: string | null;
}

export interface InvoiceProgressPayment {
  label: string | null;
  amountCents: number;
  method: string;
  receivedAt: string; // ISO date string
}

export interface InvoicePdfInput {
  /** ISO-639-1 language code — used to render translated labels in the PDF. */
  detectedLanguage?: string | null;
  invoice: {
    invoiceNumber: string;
    jobTitle: string;
    jobDescription: string | null;
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    customerAddress: string | null;
    invoicedAt: string; // ISO date string
    dueDate: string | null;
    subtotalCents: number;
    gstCents: number;
    totalCents: number;
    amountPaidCents: number;
    balanceDueCents: number;
    paymentMethod: "bank_transfer" | "cash" | "stripe" | "other";
    isCashPaid: boolean;
    notes: string | null;
  };
  lineItems: InvoiceLineItem[];
  progressPayments: InvoiceProgressPayment[];
  branding: {
    businessName: string;
    abn: string | null;
    phone: string | null;
    address: string | null;
    logoBuffer: Buffer | null;
    primaryColor: string;
    secondaryColor: string;
    // Bank details
    bankName: string | null;
    bankAccountName: string | null;
    bankBsb: string | null;
    bankAccountNumber: string | null;
  };
}

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
  header: {
    backgroundColor: "#1F2937",
    paddingHorizontal: 40,
    paddingTop: 32,
    paddingBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: { flex: 1 },
  headerRight: { alignItems: "flex-end" },
  logo: { height: 40, maxWidth: 160, objectFit: "contain" },
  businessName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    color: "#FFFFFF",
    marginBottom: 4,
  },
  invoiceLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  invoiceNumber: {
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    color: "#FFFFFF",
    marginTop: 2,
  },
  accentBar: { height: 4 },
  body: { paddingHorizontal: 40, paddingTop: 28 },
  infoRow: { flexDirection: "row", gap: 24, marginBottom: 24 },
  infoBox: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 6,
    padding: 14,
  },
  infoBoxLabel: {
    fontSize: 8,
    color: "#6B7280",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  infoBoxValue: { fontSize: 10, color: "#111827", lineHeight: 1.5 },
  infoBoxBold: { fontFamily: "Helvetica-Bold", fontSize: 11, color: "#111827" },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: "#374151",
    marginBottom: 8,
    marginTop: 20,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Line items table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colUnit: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1.2, textAlign: "right" },
  colTotal: { flex: 1.2, textAlign: "right" },
  tableHeaderText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRowText: { fontSize: 10, color: "#374151" },
  tableRowBold: { fontFamily: "Helvetica-Bold", fontSize: 10, color: "#111827" },
  // Totals
  totalsSection: {
    marginTop: 16,
    alignItems: "flex-end",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
    gap: 8,
  },
  totalsLabel: { fontSize: 10, color: "#6B7280", width: 120, textAlign: "right" },
  totalsValue: { fontSize: 10, color: "#111827", width: 80, textAlign: "right" },
  totalsBold: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: "#111827",
    width: 80,
    textAlign: "right",
  },
  totalsBoldLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: "#111827",
    width: 120,
    textAlign: "right",
  },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 8, width: 200, alignSelf: "flex-end" },
  // Payment section
  paymentBox: {
    backgroundColor: "#F0FDF4",
    borderRadius: 6,
    padding: 16,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#16A34A",
  },
  paymentBoxTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: "#15803D",
    marginBottom: 8,
  },
  paymentRow: { flexDirection: "row", marginBottom: 4 },
  paymentLabel: { fontSize: 10, color: "#6B7280", width: 120 },
  paymentValue: { fontSize: 10, color: "#111827", flex: 1 },
  // Cash paid stamp
  cashStamp: {
    position: "absolute",
    top: 20,
    right: 40,
    borderWidth: 3,
    borderColor: "#16A34A",
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    transform: "rotate(-15deg)" as unknown as any,
  },
  cashStampText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    color: "#16A34A",
    letterSpacing: 2,
  },
  // Progress payments
  progressRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  // Notes
  notesBox: {
    backgroundColor: "#FFFBEB",
    borderRadius: 6,
    padding: 14,
    marginTop: 20,
  },
  notesTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: "#92400E",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  notesText: { fontSize: 10, color: "#78350F", lineHeight: 1.5 },
  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
  },
  footerText: { fontSize: 8, color: "#9CA3AF" },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

// ── Invoice Document ──────────────────────────────────────────────────────────

function InvoicePage({ input }: { input: InvoicePdfInput }) {
  const { invoice, lineItems, progressPayments, branding } = input;
  const primaryColor = branding.primaryColor || "#1F2937";
  const accentColor = branding.secondaryColor || "#2563EB";
  const lang = input.detectedLanguage;
  const L = getPdfLabels(lang);
  const pageStyle = isRTL(lang)
    ? [styles.page, { fontFamily: "NotoSansArabic" }]
    : styles.page;

  const hasBankDetails = branding.bankBsb && branding.bankAccountNumber;
  const hasProgressPayments = progressPayments.length > 0;

  return (
    <Page size="A4" style={pageStyle}>
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: primaryColor }]}>
        <View style={styles.headerLeft}>
          {branding.logoBuffer ? (
            <Image
              src={branding.logoBuffer as unknown as string}
              style={styles.logo}
            />
          ) : (
            <Text style={styles.businessName}>{branding.businessName}</Text>
          )}
          {branding.logoBuffer && (
            <Text style={[styles.businessName, { marginTop: 8 }]}>
              {branding.businessName}
            </Text>
          )}
          {branding.abn && (
            <Text style={[styles.invoiceLabel, { marginTop: 4 }]}>
              ABN {branding.abn}
            </Text>
          )}
          {branding.phone && (
            <Text style={[styles.invoiceLabel, { marginTop: 2 }]}>
              {branding.phone}
            </Text>
          )}
          {branding.address && (
            <Text style={[styles.invoiceLabel, { marginTop: 2 }]}>
              {branding.address}
            </Text>
          )}
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.invoiceLabel}>{L.taxInvoice}</Text>
          <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
          <Text style={[styles.invoiceLabel, { marginTop: 8 }]}>
            {L.date}: {formatDate(invoice.invoicedAt)}
          </Text>
          {invoice.dueDate && (
            <Text style={styles.invoiceLabel}>
              {L.due}: {formatDate(invoice.dueDate)}
            </Text>
          )}
        </View>
      </View>

      {/* ── Accent bar ── */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      {/* ── Body ── */}
      <View style={styles.body}>
        {/* Cash paid stamp */}
        {invoice.isCashPaid && (
          <View style={styles.cashStamp}>
            <Text style={styles.cashStampText}>PAID — CASH</Text>
          </View>
        )}

        {/* Bill To + Job Info */}
        <View style={styles.infoRow}>
          <View style={styles.infoBox}>
            <Text style={[styles.infoBoxLabel, rtlStyle(lang)]}>{L.billTo}</Text>
            {invoice.customerName && (
              <Text style={styles.infoBoxBold}>{invoice.customerName}</Text>
            )}
            {invoice.customerEmail && (
              <Text style={styles.infoBoxValue}>{invoice.customerEmail}</Text>
            )}
            {invoice.customerPhone && (
              <Text style={styles.infoBoxValue}>{invoice.customerPhone}</Text>
            )}
            {invoice.customerAddress && (
              <Text style={styles.infoBoxValue}>{invoice.customerAddress}</Text>
            )}
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxLabel}>Job Details</Text>
            <Text style={styles.infoBoxBold}>{invoice.jobTitle}</Text>
            {invoice.jobDescription && (
              <Text style={[styles.infoBoxValue, { marginTop: 4 }]}>
                {invoice.jobDescription}
              </Text>
            )}
          </View>
        </View>

        {/* Line Items */}
        <Text style={[styles.sectionTitle, rtlStyle(lang)]}>{L.servicesAndMaterials}</Text>
        <View style={isRTL(lang) ? [styles.tableHeader, { flexDirection: "row-reverse" }] : styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colDesc, rtlStyle(lang)]}>{L.description}</Text>
          <Text style={[styles.tableHeaderText, styles.colQty, rtlStyle(lang)]}>{L.qty}</Text>
          <Text style={[styles.tableHeaderText, styles.colUnit, rtlStyle(lang)]}>{L.unit}</Text>
          <Text style={[styles.tableHeaderText, styles.colPrice, rtlStyle(lang)]}>{L.unitPrice}</Text>
          <Text style={[styles.tableHeaderText, styles.colTotal, rtlStyle(lang)]}>{L.total}</Text>
        </View>
        {lineItems.map((item, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.tableRowText, styles.colDesc]}>
              {item.description}
            </Text>
            <Text style={[styles.tableRowText, styles.colQty]}>
              {item.quantity}
            </Text>
            <Text style={[styles.tableRowText, styles.colUnit]}>
              {item.unit ?? "—"}
            </Text>
            <Text style={[styles.tableRowText, styles.colPrice]}>
              {item.unitPrice ? `$${item.unitPrice}` : "—"}
            </Text>
            <Text style={[styles.tableRowBold, styles.colTotal]}>
              {item.lineTotal ? `$${item.lineTotal}` : "—"}
            </Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsRow}>
            <Text style={[styles.totalsLabel, rtlStyle(lang)]}>{L.subtotal}</Text>
            <Text style={styles.totalsValue}>
              {formatCents(invoice.subtotalCents)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={[styles.totalsLabel, rtlStyle(lang)]}>{L.gst} (10%)</Text>
            <Text style={styles.totalsValue}>
              {formatCents(invoice.gstCents)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.totalsRow}>
            <Text style={[styles.totalsBoldLabel, rtlStyle(lang)]}>{L.totalIncGst}</Text>
            <Text style={styles.totalsBold}>
              {formatCents(invoice.totalCents)}
            </Text>
          </View>
          {hasProgressPayments && (
            <>
              <View style={styles.totalsRow}>
                <Text style={[styles.totalsLabel, rtlStyle(lang)]}>{L.lessPaymentsReceived}</Text>
                <Text style={[styles.totalsValue, { color: "#16A34A" }]}>
                  −{formatCents(invoice.amountPaidCents)}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.totalsRow}>
                <Text style={[styles.totalsBoldLabel, rtlStyle(lang)]}>{L.balanceDue}</Text>
                <Text
                  style={[
                    styles.totalsBold,
                    { color: invoice.balanceDueCents <= 0 ? "#16A34A" : "#DC2626" },
                  ]}
                >
                  {invoice.balanceDueCents <= 0
                    ? L.paid
                    : formatCents(invoice.balanceDueCents)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Progress Payments */}
        {hasProgressPayments && (
          <>
            <Text style={[styles.sectionTitle, rtlStyle(lang)]}>{L.paymentsReceived}</Text>
            <View style={isRTL(lang) ? [styles.tableHeader, { flexDirection: "row-reverse" }] : styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 2 }, rtlStyle(lang)]}>{L.description}</Text>
              <Text style={[styles.tableHeaderText, { flex: 1.5 }, rtlStyle(lang)]}>{L.method}</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }, rtlStyle(lang)]}>{L.date}</Text>
              <Text style={[styles.tableHeaderText, { flex: 1, textAlign: isRTL(lang) ? "left" : "right" }, rtlStyle(lang)]}>
                {L.amount}
              </Text>
            </View>
            {progressPayments.map((p, i) => (
              <View key={i} style={styles.progressRow}>
                <Text style={[styles.tableRowText, { flex: 2 }]}>
                  {p.label ?? "Payment"}
                </Text>
                <Text style={[styles.tableRowText, { flex: 1.5 }]}>
                  {capitalise(p.method)}
                </Text>
                <Text style={[styles.tableRowText, { flex: 1 }]}>
                  {formatDate(p.receivedAt)}
                </Text>
                <Text
                  style={[styles.tableRowBold, { flex: 1, textAlign: "right", color: "#16A34A" }]}
                >
                  {formatCents(p.amountCents)}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Payment Details (bank transfer) */}
        {!invoice.isCashPaid && hasBankDetails && (
          <View style={styles.paymentBox}>
            <Text style={[styles.paymentBoxTitle, rtlStyle(lang)]}>{L.paymentDetails}</Text>
            {branding.bankName && (
              <View style={styles.paymentRow}>
                <Text style={[styles.paymentLabel, rtlStyle(lang)]}>{L.bank}</Text>
                <Text style={styles.paymentValue}>{branding.bankName}</Text>
              </View>
            )}
            <View style={styles.paymentRow}>
              <Text style={[styles.paymentLabel, rtlStyle(lang)]}>{L.accountName}</Text>
              <Text style={styles.paymentValue}>{branding.bankAccountName}</Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={[styles.paymentLabel, rtlStyle(lang)]}>{L.bsb}</Text>
              <Text style={styles.paymentValue}>{branding.bankBsb}</Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={[styles.paymentLabel, rtlStyle(lang)]}>{L.accountNumber}</Text>
              <Text style={styles.paymentValue}>{branding.bankAccountNumber}</Text>
            </View>
            <View style={[styles.paymentRow, { marginTop: 8 }]}>
              <Text style={[styles.paymentLabel, rtlStyle(lang)]}>{L.reference}</Text>
              <Text style={[styles.paymentValue, { fontFamily: "Helvetica-Bold" }]}>
                {invoice.invoiceNumber}
              </Text>
            </View>
          </View>
        )}

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.notesBox}>
            <Text style={[styles.notesTitle, rtlStyle(lang)]}>{L.notes}</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}
      </View>

      {/* ── Footer ── */}
      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>
          {branding.businessName}
          {branding.abn ? ` · ABN ${branding.abn}` : ""}
        </Text>
        <Text style={styles.footerText}>
          Invoice {invoice.invoiceNumber} · Generated by Solvr
        </Text>
      </View>
    </Page>
  );
}

export function InvoiceDocument({ input }: { input: InvoicePdfInput }) {
  return (
    <Document>
      <InvoicePage input={input} />
    </Document>
  );
}
