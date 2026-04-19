/**
 * Purchase Order PDF — React-PDF component for branded PO documents.
 * Follows the same pattern as InvoiceDocument and ReportPDF.
 */
import React from "react";
import { Document, Page, View, Text, Image, StyleSheet, Font } from "@react-pdf/renderer";

Font.register({
  family: "Inter",
  fonts: [
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiA.woff2", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hiA.woff2", fontWeight: 600 },
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiA.woff2", fontWeight: 700 },
  ],
});

const s = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 10, padding: 40, color: "#1F2937" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 30 },
  logo: { width: 80, height: 80, objectFit: "contain" },
  headerRight: { textAlign: "right" },
  title: { fontSize: 22, fontWeight: 700, color: "#0F1F3D", marginBottom: 4 },
  poNumber: { fontSize: 12, fontWeight: 600, color: "#F5A623" },
  divider: { height: 2, backgroundColor: "#F5A623", marginVertical: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  col: { width: "48%" },
  label: { fontSize: 8, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", marginBottom: 2 },
  value: { fontSize: 10, color: "#1F2937" },
  tableHeader: { flexDirection: "row", backgroundColor: "#0F1F3D", padding: 6, borderRadius: 2 },
  tableHeaderText: { color: "#FFFFFF", fontSize: 8, fontWeight: 600 },
  tableRow: { flexDirection: "row", padding: 6, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  tableRowAlt: { flexDirection: "row", padding: 6, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB", backgroundColor: "#F9FAFB" },
  colDesc: { width: "40%" },
  colQty: { width: "12%", textAlign: "center" },
  colUnit: { width: "12%", textAlign: "center" },
  colPrice: { width: "18%", textAlign: "right" },
  colTotal: { width: "18%", textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12, paddingRight: 6 },
  totalLabel: { fontSize: 12, fontWeight: 600, color: "#1F2937", marginRight: 20 },
  totalValue: { fontSize: 14, fontWeight: 700, color: "#F5A623" },
  notes: { marginTop: 20, padding: 12, backgroundColor: "#FFF7ED", borderRadius: 4 },
  notesLabel: { fontSize: 9, fontWeight: 600, color: "#92400E", marginBottom: 4 },
  notesText: { fontSize: 9, color: "#78350F" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#9CA3AF" },
});

const fmt = (cents: number | null) => cents != null ? `$${(cents / 100).toFixed(2)}` : "—";

export interface POPDFInput {
  po: {
    poNumber: string;
    status: string;
    createdAt: Date | string;
    requiredByDate?: Date | string | null;
    deliveryAddress?: string | null;
    notes?: string | null;
  };
  supplier: {
    name: string;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
    abn?: string | null;
    address?: string | null;
  };
  items: Array<{
    description: string;
    quantity: string;
    unit?: string | null;
    unitPriceCents?: number | null;
    lineTotalCents?: number | null;
  }>;
  totalCents: number;
  business: {
    businessName: string;
    abn?: string | null;
    phone?: string | null;
    address?: string | null;
    logoBuffer?: Buffer | null;
    primaryColor?: string;
  };
  job?: {
    jobType?: string;
    location?: string | null;
  } | null;
}

export function PurchaseOrderDocument({ input }: { input: POPDFInput }) {
  const { po, supplier, items, totalCents, business, job } = input;
  const createdDate = new Date(po.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  const requiredDate = po.requiredByDate
    ? new Date(po.requiredByDate).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            {business.logoBuffer && (
              <Image src={{ data: business.logoBuffer, format: "png" }} style={s.logo} />
            )}
            <Text style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{business.businessName}</Text>
            {business.abn && <Text style={{ fontSize: 8, color: "#6B7280" }}>ABN: {business.abn}</Text>}
            {business.phone && <Text style={{ fontSize: 8, color: "#6B7280" }}>{business.phone}</Text>}
            {business.address && <Text style={{ fontSize: 8, color: "#6B7280" }}>{business.address}</Text>}
          </View>
          <View style={s.headerRight}>
            <Text style={s.title}>PURCHASE ORDER</Text>
            <Text style={s.poNumber}>{po.poNumber}</Text>
            <Text style={{ fontSize: 9, color: "#6B7280", marginTop: 4 }}>Date: {createdDate}</Text>
            {requiredDate && <Text style={{ fontSize: 9, color: "#6B7280" }}>Required by: {requiredDate}</Text>}
          </View>
        </View>

        <View style={s.divider} />

        {/* Supplier + Delivery info */}
        <View style={s.row}>
          <View style={s.col}>
            <Text style={s.label}>Supplier</Text>
            <Text style={{ ...s.value, fontWeight: 600 }}>{supplier.name}</Text>
            {supplier.contactName && <Text style={s.value}>{supplier.contactName}</Text>}
            {supplier.email && <Text style={s.value}>{supplier.email}</Text>}
            {supplier.phone && <Text style={s.value}>{supplier.phone}</Text>}
            {supplier.abn && <Text style={{ ...s.value, fontSize: 8, color: "#6B7280" }}>ABN: {supplier.abn}</Text>}
            {supplier.address && <Text style={{ ...s.value, fontSize: 8, color: "#6B7280" }}>{supplier.address}</Text>}
          </View>
          <View style={s.col}>
            {po.deliveryAddress && (
              <>
                <Text style={s.label}>Deliver To</Text>
                <Text style={s.value}>{po.deliveryAddress}</Text>
              </>
            )}
            {job && (
              <>
                <Text style={{ ...s.label, marginTop: 8 }}>Job Reference</Text>
                {job.jobType && <Text style={s.value}>{job.jobType}</Text>}
                {job.location && <Text style={{ ...s.value, fontSize: 8, color: "#6B7280" }}>{job.location}</Text>}
              </>
            )}
          </View>
        </View>

        {/* Items table */}
        <View style={s.tableHeader}>
          <Text style={{ ...s.tableHeaderText, ...s.colDesc }}>Description</Text>
          <Text style={{ ...s.tableHeaderText, ...s.colQty }}>Qty</Text>
          <Text style={{ ...s.tableHeaderText, ...s.colUnit }}>Unit</Text>
          <Text style={{ ...s.tableHeaderText, ...s.colPrice }}>Unit Price</Text>
          <Text style={{ ...s.tableHeaderText, ...s.colTotal }}>Total</Text>
        </View>
        {items.map((item, i) => (
          <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
            <Text style={s.colDesc}>{item.description}</Text>
            <Text style={s.colQty}>{item.quantity}</Text>
            <Text style={s.colUnit}>{item.unit ?? "each"}</Text>
            <Text style={s.colPrice}>{fmt(item.unitPriceCents ?? null)}</Text>
            <Text style={s.colTotal}>{fmt(item.lineTotalCents ?? null)}</Text>
          </View>
        ))}

        {/* Total */}
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>TOTAL (ex GST):</Text>
          <Text style={s.totalValue}>{fmt(totalCents)}</Text>
        </View>

        {/* Notes */}
        {po.notes && (
          <View style={s.notes}>
            <Text style={s.notesLabel}>Notes</Text>
            <Text style={s.notesText}>{po.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <Text style={s.footer}>
          Generated by Solvr · solvr.com.au
        </Text>
      </Page>
    </Document>
  );
}
