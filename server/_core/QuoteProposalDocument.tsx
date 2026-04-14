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
// Map of ISO-639-1 language codes to their native-language translation of "QUOTE"
const QUOTE_TRANSLATIONS: Record<string, string> = {
  ar: "عرض أسعار",
  zh: "报价单",
  hi: "कोटेशन",
  vi: "Báo giá",
  el: "Προσφορά",
  it: "Preventivo",
  ko: "견적서",
  fr: "Devis",
  es: "Presupuesto",
  de: "Angebot",
  pt: "Orçamento",
  tr: "Teklif",
  ru: "Смета",
  ja: "見積書",
};

// ── PDF UI label translations ─────────────────────────────────────────────────
type PdfLabels = {
  preparedFor: string;
  job: string;
  scopeAndPricing: string;
  description: string;
  qty: string;
  unit: string;
  unitPrice: string;
  total: string;
  subtotal: string;
  gst: string;
  grandTotal: string;
  paymentTerms: string;
  validUntil: string;
  preparedBy: string;
  customerSignature: string;
  authorisedBy: string;
  signatureDate: string;
  acceptOnline: string;
};

const PDF_LABELS: Record<string, PdfLabels> = {
  ar: {
    preparedFor: "مُعَدٌّ لـ",
    job: "المهمة",
    scopeAndPricing: "نطاق العمل والتسعير",
    description: "الوصف",
    qty: "الكمية",
    unit: "الوحدة",
    unitPrice: "سعر الوحدة",
    total: "الإجمالي",
    subtotal: "المجموع الفرعي",
    gst: "ضريبة القيمة المضافة",
    grandTotal: "الإجمالي الكلي",
    paymentTerms: "شروط الدفع",
    validUntil: "صالح حتى",
    preparedBy: "أُعِدَّ بواسطة",
    customerSignature: "توقيع العميل",
    authorisedBy: "مُفَوَّض من",
    signatureDate: "التوقيع / التاريخ",
    acceptOnline: "✓  اقبل هذا العرض عبر الإنترنت",
  },
  zh: {
    preparedFor: "客户",
    job: "工作",
    scopeAndPricing: "工作范围与报价",
    description: "描述",
    qty: "数量",
    unit: "单位",
    unitPrice: "单价",
    total: "合计",
    subtotal: "小计",
    gst: "消费税",
    grandTotal: "总计（澳元）",
    paymentTerms: "付款条款",
    validUntil: "有效期至",
    preparedBy: "制作方",
    customerSignature: "客户签名",
    authorisedBy: "授权方",
    signatureDate: "签名 / 日期",
    acceptOnline: "✓  在线接受此报价",
  },
  hi: {
    preparedFor: "के लिए तैयार",
    job: "कार्य",
    scopeAndPricing: "कार्य का दायरा और मूल्य",
    description: "विवरण",
    qty: "मात्रा",
    unit: "इकाई",
    unitPrice: "इकाई मूल्य",
    total: "कुल",
    subtotal: "उप-योग",
    gst: "जीएसटी",
    grandTotal: "कुल राशि (AUD)",
    paymentTerms: "भुगतान शर्तें",
    validUntil: "तक वैध",
    preparedBy: "द्वारा तैयार",
    customerSignature: "ग्राहक हस्ताक्षर",
    authorisedBy: "अधिकृत",
    signatureDate: "हस्ताक्षर / तारीख",
    acceptOnline: "✓  इस कोटेशन को ऑनलाइन स्वीकार करें",
  },
  vi: {
    preparedFor: "Chuẩn bị cho",
    job: "Công việc",
    scopeAndPricing: "Phạm vi công việc & Báo giá",
    description: "Mô tả",
    qty: "Số lượng",
    unit: "Đơn vị",
    unitPrice: "Đơn giá",
    total: "Tổng",
    subtotal: "Tạm tính",
    gst: "GST",
    grandTotal: "Tổng cộng (AUD)",
    paymentTerms: "Điều khoản thanh toán",
    validUntil: "Có hiệu lực đến",
    preparedBy: "Chuẩn bị bởi",
    customerSignature: "Chữ ký khách hàng",
    authorisedBy: "Được uỷ quyền bởi",
    signatureDate: "Chữ ký / Ngày",
    acceptOnline: "✓  Chấp nhận báo giá trực tuyến",
  },
  el: {
    preparedFor: "Προετοιμάστηκε για",
    job: "Εργασία",
    scopeAndPricing: "Εύρος Εργασιών & Τιμολόγηση",
    description: "Περιγραφή",
    qty: "Ποσ.",
    unit: "Μονάδα",
    unitPrice: "Τιμή Μονάδας",
    total: "Σύνολο",
    subtotal: "Υποσύνολο",
    gst: "ΦΠΑ",
    grandTotal: "ΣΥΝΟΛΟ (AUD)",
    paymentTerms: "Όροι Πληρωμής",
    validUntil: "Ισχύει έως",
    preparedBy: "Εκδόθηκε από",
    customerSignature: "Υπογραφή Πελάτη",
    authorisedBy: "Εξουσιοδοτήθηκε από",
    signatureDate: "Υπογραφή / Ημερομηνία",
    acceptOnline: "✓  Αποδεχτείτε αυτή την προσφορά online",
  },
  it: {
    preparedFor: "Preparato per",
    job: "Lavoro",
    scopeAndPricing: "Ambito Lavori e Prezzi",
    description: "Descrizione",
    qty: "Qtà",
    unit: "Unità",
    unitPrice: "Prezzo Unitario",
    total: "Totale",
    subtotal: "Subtotale",
    gst: "IVA",
    grandTotal: "TOTALE (AUD)",
    paymentTerms: "Termini di Pagamento",
    validUntil: "Valido fino al",
    preparedBy: "Preparato da",
    customerSignature: "Firma del Cliente",
    authorisedBy: "Autorizzato da",
    signatureDate: "Firma / Data",
    acceptOnline: "✓  Accetta questo preventivo online",
  },
  ko: {
    preparedFor: "수신인",
    job: "작업",
    scopeAndPricing: "작업 범위 및 가격",
    description: "설명",
    qty: "수량",
    unit: "단위",
    unitPrice: "단가",
    total: "합계",
    subtotal: "소계",
    gst: "부가세",
    grandTotal: "총액 (AUD)",
    paymentTerms: "결제 조건",
    validUntil: "유효 기간",
    preparedBy: "작성자",
    customerSignature: "고객 서명",
    authorisedBy: "승인자",
    signatureDate: "서명 / 날짜",
    acceptOnline: "✓  온라인으로 견적 수락하기",
  },
  fr: {
    preparedFor: "Préparé pour",
    job: "Travail",
    scopeAndPricing: "Portée des travaux et tarification",
    description: "Description",
    qty: "Qté",
    unit: "Unité",
    unitPrice: "Prix unitaire",
    total: "Total",
    subtotal: "Sous-total",
    gst: "TVA",
    grandTotal: "TOTAL (AUD)",
    paymentTerms: "Conditions de paiement",
    validUntil: "Valable jusqu'au",
    preparedBy: "Préparé par",
    customerSignature: "Signature du client",
    authorisedBy: "Autorisé par",
    signatureDate: "Signature / Date",
    acceptOnline: "✓  Accepter ce devis en ligne",
  },
  es: {
    preparedFor: "Preparado para",
    job: "Trabajo",
    scopeAndPricing: "Alcance de trabajos y precios",
    description: "Descripción",
    qty: "Cant.",
    unit: "Unidad",
    unitPrice: "Precio unitario",
    total: "Total",
    subtotal: "Subtotal",
    gst: "IVA",
    grandTotal: "TOTAL (AUD)",
    paymentTerms: "Condiciones de pago",
    validUntil: "Válido hasta",
    preparedBy: "Preparado por",
    customerSignature: "Firma del cliente",
    authorisedBy: "Autorizado por",
    signatureDate: "Firma / Fecha",
    acceptOnline: "✓  Aceptar este presupuesto en línea",
  },
  de: {
    preparedFor: "Erstellt für",
    job: "Auftrag",
    scopeAndPricing: "Leistungsumfang und Preise",
    description: "Beschreibung",
    qty: "Menge",
    unit: "Einheit",
    unitPrice: "Einzelpreis",
    total: "Gesamt",
    subtotal: "Zwischensumme",
    gst: "MwSt.",
    grandTotal: "GESAMT (AUD)",
    paymentTerms: "Zahlungsbedingungen",
    validUntil: "Gültig bis",
    preparedBy: "Erstellt von",
    customerSignature: "Unterschrift des Kunden",
    authorisedBy: "Genehmigt von",
    signatureDate: "Unterschrift / Datum",
    acceptOnline: "✓  Angebot online annehmen",
  },
  pt: {
    preparedFor: "Preparado para",
    job: "Trabalho",
    scopeAndPricing: "Escopo de trabalho e preços",
    description: "Descrição",
    qty: "Qtd.",
    unit: "Unidade",
    unitPrice: "Preço unitário",
    total: "Total",
    subtotal: "Subtotal",
    gst: "IVA",
    grandTotal: "TOTAL (AUD)",
    paymentTerms: "Condições de pagamento",
    validUntil: "Válido até",
    preparedBy: "Preparado por",
    customerSignature: "Assinatura do cliente",
    authorisedBy: "Autorizado por",
    signatureDate: "Assinatura / Data",
    acceptOnline: "✓  Aceitar este orçamento online",
  },
  tr: {
    preparedFor: "Hazırlayan",
    job: "İş",
    scopeAndPricing: "İş Kapsamı ve Fiyatlandırma",
    description: "Açıklama",
    qty: "Miktar",
    unit: "Birim",
    unitPrice: "Birim Fiyat",
    total: "Toplam",
    subtotal: "Ara Toplam",
    gst: "KDV",
    grandTotal: "TOPLAM (AUD)",
    paymentTerms: "Ödeme Koşulları",
    validUntil: "Geçerlilik Tarihi",
    preparedBy: "Hazırlayan",
    customerSignature: "Müşteri İmzası",
    authorisedBy: "Yetkili",
    signatureDate: "İmza / Tarih",
    acceptOnline: "✓  Bu teklifi çevrimiçi kabul edin",
  },
  ru: {
    preparedFor: "Подготовлено для",
    job: "Работа",
    scopeAndPricing: "Объём работ и стоимость",
    description: "Описание",
    qty: "Кол-во",
    unit: "Ед.",
    unitPrice: "Цена за ед.",
    total: "Итого",
    subtotal: "Подытог",
    gst: "НДС",
    grandTotal: "ИТОГО (AUD)",
    paymentTerms: "Условия оплаты",
    validUntil: "Действительно до",
    preparedBy: "Подготовлено",
    customerSignature: "Подпись клиента",
    authorisedBy: "Уполномочен",
    signatureDate: "Подпись / Дата",
    acceptOnline: "✓  Принять смету онлайн",
  },
  ja: {
    preparedFor: "宛先",
    job: "作業内容",
    scopeAndPricing: "作業範囲と価格",
    description: "説明",
    qty: "数量",
    unit: "単位",
    unitPrice: "単価",
    total: "合計",
    subtotal: "小計",
    gst: "消費税",
    grandTotal: "合計金額（AUD）",
    paymentTerms: "支払条件",
    validUntil: "有効期限",
    preparedBy: "作成者",
    customerSignature: "お客様署名",
    authorisedBy: "承認者",
    signatureDate: "署名 / 日付",
    acceptOnline: "✓  オンラインで見積もりを承認する",
  },
};

const EN_LABELS: PdfLabels = {
  preparedFor: "Prepared For",
  job: "Job",
  scopeAndPricing: "Scope of Works & Pricing",
  description: "Description",
  qty: "Qty",
  unit: "Unit",
  unitPrice: "Unit Price",
  total: "Total",
  subtotal: "Subtotal",
  gst: "GST",
  grandTotal: "TOTAL (AUD)",
  paymentTerms: "Payment Terms",
  validUntil: "Valid Until",
  preparedBy: "Prepared By",
  customerSignature: "Customer Signature",
  authorisedBy: "Authorised By",
  signatureDate: "Signature / Date",
  acceptOnline: "✓  Accept this quote online",
};

function getPdfLabels(detectedLanguage?: string | null): PdfLabels {
  if (!detectedLanguage || detectedLanguage === "en") return EN_LABELS;
  return PDF_LABELS[detectedLanguage] ?? EN_LABELS;
}

/** True when the detected language uses RTL script (currently Arabic only). */
function isRTL(lang?: string | null): boolean {
  return lang === "ar";
}

/**
 * Returns style overrides for RTL pages:
 * - fontFamily: NotoSansArabic (supports Arabic glyphs)
 * - direction + textAlign: right-to-left
 */
function rtlStyle(lang?: string | null) {
  if (!isRTL(lang)) return {};
  return { fontFamily: "NotoSansArabic", direction: "rtl" as const, textAlign: "right" as const };
}

function rtlBoldStyle(lang?: string | null) {
  if (!isRTL(lang)) return {};
  return { fontFamily: "NotoSansArabic", fontWeight: "bold" as const, direction: "rtl" as const, textAlign: "right" as const };
}

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
            <Text style={[styles.infoBoxTitle, rtlStyle(lang)]}>{L.preparedFor}</Text>
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

        {/* Inclusions & Exclusions */}
        {report.inclusionsExclusions && report.inclusionsExclusions.length > 0 && (
          <>
            <Text style={styles.reportSectionTitle}>Inclusions & Exclusions</Text>
            <View style={{ flexDirection: "row", gap: 16, marginBottom: 8 }}>
              {/* Inclusions */}
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepTitle, { color: "#166534", marginBottom: 4 }]}>✓ Included</Text>
                {report.inclusionsExclusions
                  .filter((ie) => ie.type === "inclusion")
                  .map((ie, i) => (
                    <View key={i} style={{ flexDirection: "row", marginBottom: 3 }}>
                      <Text style={{ fontSize: 9, color: "#166534", marginRight: 4 }}>•</Text>
                      <Text style={{ fontSize: 9, color: "#374151", flex: 1, lineHeight: 1.4 }}>{ie.item}</Text>
                    </View>
                  ))}
              </View>
              {/* Exclusions */}
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepTitle, { color: "#991B1B", marginBottom: 4 }]}>✗ Excluded</Text>
                {report.inclusionsExclusions
                  .filter((ie) => ie.type === "exclusion")
                  .map((ie, i) => (
                    <View key={i} style={{ flexDirection: "row", marginBottom: 3 }}>
                      <Text style={{ fontSize: 9, color: "#991B1B", marginRight: 4 }}>•</Text>
                      <Text style={{ fontSize: 9, color: "#374151", flex: 1, lineHeight: 1.4 }}>{ie.item}</Text>
                    </View>
                  ))}
              </View>
            </View>
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

        {/* Warranty & Guarantee */}
        {report.warrantyAndGuarantee && (
          <>
            <Text style={styles.reportSectionTitle}>Warranty & Guarantee</Text>
            <View style={[styles.materialRow, { borderLeftColor: "#2563EB", borderLeftWidth: 3, paddingLeft: 10 }]}>
              <Text style={styles.materialText}>{report.warrantyAndGuarantee}</Text>
            </View>
          </>
        )}

        {/* Why Choose Us */}
        {report.whyChooseUs && (
          <>
            <Text style={styles.reportSectionTitle}>Why Choose Us</Text>
            <Text style={styles.reportBodyText}>{report.whyChooseUs}</Text>
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
