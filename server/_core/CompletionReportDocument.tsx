/**
 * CompletionReportDocument — React-PDF component for the Job Completion Report.
 * A client-facing document sent alongside the invoice showing what was done,
 * any variations, and before/after photos.
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

export interface CompletionReportPhoto {
  url: string;
  photoType: "before" | "after";
  caption: string | null;
}

export interface CompletionReportLineItem {
  description: string;
  quantity: string;
  unit: string | null;
  unitPrice: string | null;
  lineTotal: string | null;
}

export interface CompletionReportInput {
  job: {
    jobTitle: string;
    jobDescription: string | null;
    location: string | null;
    completedAt: string | null; // ISO date string
    reportDate: string; // ISO date string
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    customerAddress: string | null;
    variations: string | null;
    notes: string | null;
    totalCents: number;
  };
  lineItems: CompletionReportLineItem[];
  photos: CompletionReportPhoto[];
  branding: {
    businessName: string;
    abn: string | null;
    phone: string | null;
    address: string | null;
    logoBuffer: Buffer | null;
    primaryColor: string;
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
  reportLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  reportDate: {
    fontSize: 13,
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
  },
  businessMeta: {
    fontSize: 9,
    color: "#9CA3AF",
    marginTop: 2,
  },
  // Green accent bar
  accentBar: {
    backgroundColor: "#16A34A",
    height: 4,
  },
  body: {
    paddingHorizontal: 40,
    paddingTop: 28,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: "#1F2937",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    marginBottom: 16,
  },
  // Customer / job info grid
  infoGrid: {
    flexDirection: "row",
    marginBottom: 24,
    gap: 24,
  },
  infoCol: { flex: 1 },
  infoLabel: {
    fontSize: 8,
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 10,
    color: "#1F2937",
    marginBottom: 8,
  },
  // Work summary box
  summaryBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 4,
    padding: 16,
    marginBottom: 24,
  },
  summaryText: {
    fontSize: 10,
    color: "#374151",
    lineHeight: 1.6,
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
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  tableColDesc: { flex: 3 },
  tableColQty: { flex: 1, textAlign: "right" },
  tableColUnit: { flex: 1, textAlign: "center" },
  tableColPrice: { flex: 1.5, textAlign: "right" },
  tableColTotal: { flex: 1.5, textAlign: "right" },
  tableHeaderText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: "#6B7280",
    textTransform: "uppercase",
  },
  tableBodyText: {
    fontSize: 9,
    color: "#374151",
  },
  // Variations
  variationsBox: {
    backgroundColor: "#FFFBEB",
    borderLeftWidth: 3,
    borderLeftColor: "#F59E0B",
    padding: 12,
    marginBottom: 24,
    borderRadius: 2,
  },
  variationsText: {
    fontSize: 10,
    color: "#92400E",
    lineHeight: 1.5,
  },
  // Photos section
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 24,
  },
  photoContainer: {
    width: "48%",
  },
  photoImage: {
    width: "100%",
    height: 160,
    objectFit: "cover",
    borderRadius: 4,
  },
  photoCaption: {
    fontSize: 8,
    color: "#6B7280",
    marginTop: 3,
    textAlign: "center",
  },
  photoBadge: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  photoBadgeBefore: { color: "#DC2626" },
  photoBadgeAfter: { color: "#16A34A" },
  // Total row
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    marginBottom: 24,
  },
  totalBox: {
    backgroundColor: "#1F2937",
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  totalLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  totalValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: "#9CA3AF",
  },
  footerBrand: {
    fontSize: 8,
    color: "#9CA3AF",
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
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

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CompletionReportDocument({ input }: { input: CompletionReportInput }) {
  const { job, lineItems, photos, branding } = input;
  const beforePhotos = photos.filter((p) => p.photoType === "before");
  const afterPhotos = photos.filter((p) => p.photoType === "after");
  const hasPhotos = photos.length > 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {branding.logoBuffer ? (
              <Image src={branding.logoBuffer} style={styles.logo} />
            ) : (
              <Text style={styles.businessName}>{branding.businessName}</Text>
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
            <Text style={styles.reportLabel}>Job Completion Report</Text>
            <Text style={styles.reportDate}>{formatDate(job.reportDate)}</Text>
          </View>
        </View>

        {/* Accent bar */}
        <View style={styles.accentBar} />

        <View style={styles.body}>
          {/* ── Job & Customer Info ── */}
          <Text style={styles.sectionTitle}>Job Details</Text>
          <View style={styles.divider} />
          <View style={styles.infoGrid}>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Job</Text>
              <Text style={[styles.infoValue, { fontFamily: "Helvetica-Bold" }]}>
                {job.jobTitle}
              </Text>
              {job.location && (
                <>
                  <Text style={styles.infoLabel}>Location</Text>
                  <Text style={styles.infoValue}>{job.location}</Text>
                </>
              )}
              {job.completedAt && (
                <>
                  <Text style={styles.infoLabel}>Completed</Text>
                  <Text style={styles.infoValue}>{formatDate(job.completedAt)}</Text>
                </>
              )}
            </View>
            <View style={styles.infoCol}>
              {job.customerName && (
                <>
                  <Text style={styles.infoLabel}>Prepared For</Text>
                  <Text style={[styles.infoValue, { fontFamily: "Helvetica-Bold" }]}>
                    {job.customerName}
                  </Text>
                </>
              )}
              {job.customerAddress && (
                <>
                  <Text style={styles.infoLabel}>Address</Text>
                  <Text style={styles.infoValue}>{job.customerAddress}</Text>
                </>
              )}
              {job.customerPhone && (
                <>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>{job.customerPhone}</Text>
                </>
              )}
              {job.customerEmail && (
                <>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{job.customerEmail}</Text>
                </>
              )}
            </View>
          </View>

          {/* ── Work Summary ── */}
          {job.jobDescription && (
            <>
              <Text style={styles.sectionTitle}>Work Completed</Text>
              <View style={styles.divider} />
              <View style={styles.summaryBox}>
                <Text style={styles.summaryText}>{job.jobDescription}</Text>
              </View>
            </>
          )}

          {/* ── Line Items ── */}
          {lineItems.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Scope of Work</Text>
              <View style={styles.divider} />
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.tableColDesc]}>Description</Text>
                <Text style={[styles.tableHeaderText, styles.tableColQty]}>Qty</Text>
                <Text style={[styles.tableHeaderText, styles.tableColUnit]}>Unit</Text>
                <Text style={[styles.tableHeaderText, styles.tableColPrice]}>Unit Price</Text>
                <Text style={[styles.tableHeaderText, styles.tableColTotal]}>Total</Text>
              </View>
              {lineItems.map((item, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={[styles.tableBodyText, styles.tableColDesc]}>{item.description}</Text>
                  <Text style={[styles.tableBodyText, styles.tableColQty]}>{item.quantity}</Text>
                  <Text style={[styles.tableBodyText, styles.tableColUnit]}>{item.unit ?? "—"}</Text>
                  <Text style={[styles.tableBodyText, styles.tableColPrice]}>
                    {item.unitPrice ? `$${item.unitPrice}` : "—"}
                  </Text>
                  <Text style={[styles.tableBodyText, styles.tableColTotal]}>
                    {item.lineTotal ? `$${item.lineTotal}` : "—"}
                  </Text>
                </View>
              ))}
              {/* Total */}
              <View style={styles.totalRow}>
                <View style={styles.totalBox}>
                  <Text style={styles.totalLabel}>Total (inc. GST)</Text>
                  <Text style={styles.totalValue}>{formatCents(job.totalCents)}</Text>
                </View>
              </View>
            </>
          )}

          {/* ── Variations ── */}
          {job.variations && (
            <>
              <Text style={styles.sectionTitle}>Variations</Text>
              <View style={styles.divider} />
              <View style={styles.variationsBox}>
                <Text style={styles.variationsText}>{job.variations}</Text>
              </View>
            </>
          )}

          {/* ── Notes ── */}
          {job.notes && (
            <>
              <Text style={styles.sectionTitle}>Notes</Text>
              <View style={styles.divider} />
              <View style={styles.summaryBox}>
                <Text style={styles.summaryText}>{job.notes}</Text>
              </View>
            </>
          )}

          {/* ── Before Photos ── */}
          {beforePhotos.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Before Photos</Text>
              <View style={styles.divider} />
              <View style={styles.photoGrid}>
                {beforePhotos.map((photo, i) => (
                  <View key={i} style={styles.photoContainer}>
                    <Text style={[styles.photoBadge, styles.photoBadgeBefore]}>Before</Text>
                    <Image src={photo.url} style={styles.photoImage} />
                    {photo.caption && (
                      <Text style={styles.photoCaption}>{photo.caption}</Text>
                    )}
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ── After Photos ── */}
          {afterPhotos.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>After Photos</Text>
              <View style={styles.divider} />
              <View style={styles.photoGrid}>
                {afterPhotos.map((photo, i) => (
                  <View key={i} style={styles.photoContainer}>
                    <Text style={[styles.photoBadge, styles.photoBadgeAfter]}>After</Text>
                    <Image src={photo.url} style={styles.photoImage} />
                    {photo.caption && (
                      <Text style={styles.photoCaption}>{photo.caption}</Text>
                    )}
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {branding.businessName}
            {branding.abn ? ` · ABN ${branding.abn}` : ""}
          </Text>
          <Text style={styles.footerBrand}>Powered by Solvr · solvr.com.au</Text>
        </View>
      </Page>
    </Document>
  );
}
