/**
 * FormCertificatePDF — React-PDF component for branded form/certificate PDFs.
 * Matches the Solvr branded header style (navy header, logo/ABN, amber accent bar).
 *
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 */
import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FormFieldPDF {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "checkbox" | "signature" | "photo" | "heading" | "divider";
  required?: boolean;
}

export interface FormCertPDFInput {
  title: string;
  templateName: string;
  category?: string | null;
  completedAt?: string | null; // ISO date
  createdAt: string;           // ISO date
  submittedBy?: string | null;
  jobTitle?: string | null;
  customerName?: string | null;
  fields: FormFieldPDF[];
  values: Record<string, unknown>;
  signatures: Record<string, string>; // fieldId -> data URL
  branding: {
    businessName: string;
    tradingName?: string | null;
    abn?: string | null;
    phone?: string | null;
    address?: string | null;
    logoBuffer?: Buffer | null;
    primaryColor?: string;
  };
}

// ── Colours ───────────────────────────────────────────────────────────────────

const NAVY = "#0F1F3D";
const AMBER = "#F5A623";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const BODY = "#1F2937";
const GREEN = "#16A34A";

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: BODY,
    backgroundColor: "#FFFFFF",
    paddingTop: 0,
    paddingBottom: 48,
    paddingHorizontal: 0,
  },
  // Header
  header: {
    backgroundColor: NAVY,
    paddingHorizontal: 40,
    paddingTop: 28,
    paddingBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: { flex: 1 },
  headerRight: { alignItems: "flex-end" },
  logo: { height: 36, maxWidth: 150, objectFit: "contain" as any },
  businessName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 3,
  },
  businessMeta: { fontSize: 8, color: "#9CA3AF", marginTop: 1.5 },
  docCategory: {
    fontSize: 8,
    color: "#9CA3AF",
    letterSpacing: 1,
    textTransform: "uppercase" as any,
    marginBottom: 3,
  },
  docTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    color: "#FFFFFF",
    maxWidth: 200,
    textAlign: "right" as any,
  },
  docDate: { fontSize: 8, color: "#9CA3AF", marginTop: 3 },
  // Accent bar
  accentBar: { backgroundColor: AMBER, height: 3 },
  // Meta info row
  metaSection: {
    paddingHorizontal: 40,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: "row",
    flexWrap: "wrap" as any,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  metaItem: { width: "50%", marginBottom: 6 },
  metaLabel: { fontSize: 8, color: MUTED, textTransform: "uppercase" as any, letterSpacing: 0.3 },
  metaValue: { fontSize: 10, color: BODY, marginTop: 1 },
  // Body
  body: { paddingHorizontal: 40, paddingTop: 16 },
  // Field row
  fieldRow: {
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F3F4F6",
  },
  fieldLabel: {
    fontSize: 8,
    color: MUTED,
    textTransform: "uppercase" as any,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  fieldValue: { fontSize: 10, color: BODY, lineHeight: 1.4 },
  fieldEmpty: { fontSize: 10, color: "#D1D5DB", fontStyle: "italic" as any },
  // Heading
  sectionHeading: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: NAVY,
    marginTop: 12,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  // Divider
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginTop: 8,
    marginBottom: 8,
  },
  // Checkbox
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  checkboxBox: {
    width: 12,
    height: 12,
    borderWidth: 1.5,
    borderColor: NAVY,
    borderRadius: 2,
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxFilled: {
    width: 12,
    height: 12,
    borderWidth: 1.5,
    borderColor: GREEN,
    borderRadius: 2,
    backgroundColor: GREEN,
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  checkmark: { fontSize: 8, color: "#FFFFFF", fontFamily: "Helvetica-Bold" },
  checkboxLabel: { fontSize: 10, color: BODY },
  // Signature
  signatureWrap: { marginBottom: 10 },
  signatureImage: { width: 200, height: 60, objectFit: "contain" as any, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3 },
  signatureEmpty: { fontSize: 9, color: "#D1D5DB", fontStyle: "italic" as any },
  // Footer
  footer: {
    position: "absolute" as any,
    bottom: 16,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: { fontSize: 7, color: MUTED },
  footerBrand: { fontSize: 7, color: MUTED },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FormCertificatePDF({ input }: { input: FormCertPDFInput }) {
  const { branding, fields, values, signatures, title, category, completedAt, createdAt, submittedBy, jobTitle, customerName } = input;
  const displayName = branding.tradingName || branding.businessName;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {branding.logoBuffer ? (
              <Image src={branding.logoBuffer} style={styles.logo} />
            ) : (
              <Text style={styles.businessName}>{displayName}</Text>
            )}
            {branding.abn && (
              <Text style={styles.businessMeta}>ABN {branding.abn}</Text>
            )}
            {branding.phone && (
              <Text style={styles.businessMeta}>{branding.phone}</Text>
            )}
            {branding.address && (
              <Text style={styles.businessMeta}>{branding.address}</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            {category && <Text style={styles.docCategory}>{category}</Text>}
            <Text style={styles.docTitle}>{title}</Text>
            <Text style={styles.docDate}>
              {completedAt ? `Completed ${formatDate(completedAt)}` : `Created ${formatDate(createdAt)}`}
            </Text>
          </View>
        </View>

        {/* ── Amber accent bar ── */}
        <View style={styles.accentBar} />

        {/* ── Meta info ── */}
        <View style={styles.metaSection}>
          {jobTitle && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Job</Text>
              <Text style={styles.metaValue}>{jobTitle}</Text>
            </View>
          )}
          {customerName && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Customer</Text>
              <Text style={styles.metaValue}>{customerName}</Text>
            </View>
          )}
          {submittedBy && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Submitted By</Text>
              <Text style={styles.metaValue}>{submittedBy}</Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Status</Text>
            <Text style={styles.metaValue}>{completedAt ? "Completed" : "Draft"}</Text>
          </View>
        </View>

        {/* ── Form Fields ── */}
        <View style={styles.body}>
          {fields.map((field, idx) => {
            // Heading
            if (field.type === "heading") {
              return <Text key={idx} style={styles.sectionHeading}>{field.label}</Text>;
            }
            // Divider
            if (field.type === "divider") {
              return <View key={idx} style={styles.divider} />;
            }
            // Signature
            if (field.type === "signature") {
              const sigData = signatures[field.id];
              return (
                <View key={idx} style={styles.signatureWrap}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  {sigData ? (
                    <Image src={sigData} style={styles.signatureImage} />
                  ) : (
                    <Text style={styles.signatureEmpty}>Not signed</Text>
                  )}
                </View>
              );
            }
            // Checkbox
            if (field.type === "checkbox") {
              const checked = values[field.id] === true || values[field.id] === "true";
              return (
                <View key={idx} style={styles.checkboxRow}>
                  <View style={checked ? styles.checkboxFilled : styles.checkboxBox}>
                    {checked && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>{field.label}</Text>
                </View>
              );
            }
            // Photo — skip in PDF (photos are stored separately)
            if (field.type === "photo") {
              const photoVal = values[field.id];
              if (photoVal && typeof photoVal === "string" && photoVal.startsWith("data:")) {
                return (
                  <View key={idx} style={styles.signatureWrap}>
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    <Image src={photoVal} style={{ width: 200, height: 150, objectFit: "contain" as any, borderRadius: 3 }} />
                  </View>
                );
              }
              return (
                <View key={idx} style={{ marginBottom: 10 }}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <Text style={styles.fieldEmpty}>No photo attached</Text>
                </View>
              );
            }
            // Standard fields (text, textarea, number, date, select)
            const val = values[field.id];
            const displayVal = val != null && val !== "" ? String(val) : null;
            return (
              <View key={idx} style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                {displayVal ? (
                  <Text style={styles.fieldValue}>{displayVal}</Text>
                ) : (
                  <Text style={styles.fieldEmpty}>—</Text>
                )}
              </View>
            );
          })}
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {displayName} — {category || "Form"}
          </Text>
          <Text
            style={styles.footerBrand}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages} · Generated by Solvr`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
