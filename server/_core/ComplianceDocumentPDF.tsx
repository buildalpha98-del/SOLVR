/**
 * ComplianceDocumentPDF — React-PDF component for Solvr compliance documents.
 * Renders SWMS, Safety Certs, Site Inductions, and JSAs as branded A4 PDFs.
 *
 * Follows the same pattern as CompletionReportDocument.tsx.
 */
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ComplianceSection {
  heading: string;
  items: ComplianceItem[];
}

export interface ComplianceItem {
  label?: string;
  value?: string;
  /** For table rows — array of cell strings */
  row?: string[];
  /** If true, this item is a table header row */
  isHeader?: boolean;
  /** Indented sub-item */
  sub?: boolean;
}

export interface ComplianceDocPDFInput {
  docType: "swms" | "safety_cert" | "site_induction" | "jsa";
  title: string;
  generatedAt: string; // ISO date string
  sections: ComplianceSection[];
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
const LIGHT_BG = "#F9FAFB";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const BODY = "#1F2937";

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
  // ── Header ──
  header: {
    backgroundColor: NAVY,
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
  businessMeta: { fontSize: 9, color: "#9CA3AF", marginTop: 2 },
  docTypeLabel: {
    fontSize: 9,
    color: "#9CA3AF",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  docTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    color: "#FFFFFF",
    maxWidth: 200,
    textAlign: "right",
  },
  docDate: { fontSize: 9, color: "#9CA3AF", marginTop: 4 },
  // ── Accent bar ──
  accentBar: { backgroundColor: AMBER, height: 4 },
  // ── Body ──
  body: { paddingHorizontal: 40, paddingTop: 24 },
  // ── Section ──
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: NAVY,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginBottom: 12,
  },
  sectionWrap: { marginBottom: 20 },
  // ── Key-value row ──
  kvRow: {
    flexDirection: "row",
    marginBottom: 5,
  },
  kvLabel: {
    width: 140,
    fontSize: 9,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  kvValue: { flex: 1, fontSize: 10, color: BODY },
  // ── Plain text item ──
  plainText: {
    fontSize: 10,
    color: BODY,
    lineHeight: 1.5,
    marginBottom: 4,
  },
  subText: {
    fontSize: 9,
    color: MUTED,
    lineHeight: 1.4,
    marginBottom: 3,
    paddingLeft: 12,
  },
  // ── Table ──
  tableWrap: { marginBottom: 4 },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: NAVY,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableBodyRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableAltRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    backgroundColor: LIGHT_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableCell: { flex: 1, fontSize: 9, color: BODY },
  tableHeaderCell: {
    flex: 1,
    fontSize: 8,
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  // ── Footer ──
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: { fontSize: 8, color: MUTED },
  footerBrand: { fontSize: 8, color: MUTED },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
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

const DOC_TYPE_LABELS: Record<ComplianceDocPDFInput["docType"], string> = {
  swms: "Safe Work Method Statement",
  safety_cert: "Safety Certificate",
  site_induction: "Site Induction Checklist",
  jsa: "Job Safety Analysis",
};

// ── Section renderer ──────────────────────────────────────────────────────────

function renderItem(item: ComplianceItem, idx: number) {
  // Table row
  if (item.row) {
    const RowStyle = item.isHeader
      ? styles.tableHeaderRow
      : idx % 2 === 0
        ? styles.tableBodyRow
        : styles.tableAltRow;
    const CellStyle = item.isHeader ? styles.tableHeaderCell : styles.tableCell;
    return (
      <View key={idx} style={RowStyle}>
        {item.row.map((cell, ci) => (
          <Text key={ci} style={CellStyle}>
            {cell}
          </Text>
        ))}
      </View>
    );
  }
  // Key-value pair
  if (item.label && item.value) {
    return (
      <View key={idx} style={styles.kvRow}>
        <Text style={styles.kvLabel}>{item.label}</Text>
        <Text style={styles.kvValue}>{item.value}</Text>
      </View>
    );
  }
  // Plain text / bullet
  if (item.value) {
    return (
      <Text key={idx} style={item.sub ? styles.subText : styles.plainText}>
        {item.value}
      </Text>
    );
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ComplianceDocumentPDF({ input }: { input: ComplianceDocPDFInput }) {
  const { branding, sections, docType, title, generatedAt } = input;
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
            <Text style={styles.docTypeLabel}>{DOC_TYPE_LABELS[docType]}</Text>
            <Text style={styles.docTitle}>{title}</Text>
            <Text style={styles.docDate}>
              Generated {formatDate(generatedAt)}
            </Text>
          </View>
        </View>

        {/* ── Amber accent bar ── */}
        <View style={styles.accentBar} />

        {/* ── Body ── */}
        <View style={styles.body}>
          {sections.map((section, si) => (
            <View key={si} style={styles.sectionWrap} wrap={false}>
              <Text style={styles.sectionTitle}>{section.heading}</Text>
              <View style={styles.divider} />
              {/* Check if this section has table rows */}
              {section.items.some((i) => i.row) ? (
                <View style={styles.tableWrap}>
                  {section.items.map((item, ii) => renderItem(item, ii))}
                </View>
              ) : (
                section.items.map((item, ii) => renderItem(item, ii))
              )}
            </View>
          ))}
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {displayName} — {DOC_TYPE_LABELS[docType]}
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
