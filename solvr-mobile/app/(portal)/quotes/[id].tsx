import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { trpc } from "../../../lib/trpc";
import { colors, fonts, spacing, borderRadius } from "../../../lib/theme";
import { Button, Input, Card, Badge, SectionHeader } from "../../../components/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Local editable line item state — uses numbers for calculations.
 * Backend stores quantity/unitPrice as decimal strings; we convert on load/save.
 */
interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Raw backend response from `portal.quotes.get.query({id})`:
 *   { quote, lineItems, photos }
 * where quote is a row from drizzle/schema.ts → quotes table and
 * lineItems[*].quantity/unitPrice are decimal STRINGS.
 */
interface BackendLineItem {
  id: string;
  description: string;
  quantity: string;
  unit?: string | null;
  unitPrice?: string | null;
  lineTotal?: string | null;
}

interface BackendQuote {
  id: string;
  status: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  jobTitle: string;
  jobDescription?: string | null;
  notes?: string | null;
}

interface BackendPhoto {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string | null;
  caption?: string | null;
}

interface QuoteGetResponse {
  quote: BackendQuote;
  lineItems: BackendLineItem[];
  photos: BackendPhoto[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusBadgeColor(status: string): string {
  switch (status.toLowerCase()) {
    case "draft":
      return colors.textSecondary;
    case "sent":
      return "#3B82F6";
    case "accepted":
      return colors.success;
    case "declined":
      return colors.danger;
    default:
      return colors.textSecondary;
  }
}

// ---------------------------------------------------------------------------
// Line Item Row
// ---------------------------------------------------------------------------

function LineItemRow({
  item,
  onUpdate,
  onDelete,
}: {
  item: LineItem;
  onUpdate: (id: string, field: keyof LineItem, value: string) => void;
  onDelete: (id: string) => void;
}) {
  const lineTotal = item.quantity * item.unitPrice;

  return (
    <View style={lineStyles.row}>
      <View style={lineStyles.header}>
        <Text style={lineStyles.lineTotal}>{formatCurrency(lineTotal)}</Text>
        <TouchableOpacity onPress={() => onDelete(item.id)} hitSlop={8}>
          <Text style={lineStyles.deleteBtn}>X</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={lineStyles.descInput}
        value={item.description}
        onChangeText={(v) => onUpdate(item.id, "description", v)}
        placeholder="Description"
        placeholderTextColor={colors.textSecondary}
      />
      <View style={lineStyles.numRow}>
        <View style={lineStyles.numField}>
          <Text style={lineStyles.numLabel}>Qty</Text>
          <TextInput
            style={lineStyles.numInput}
            value={String(item.quantity)}
            onChangeText={(v) => onUpdate(item.id, "quantity", v)}
            keyboardType="numeric"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
        <View style={lineStyles.numField}>
          <Text style={lineStyles.numLabel}>Unit Price</Text>
          <TextInput
            style={lineStyles.numInput}
            value={String(item.unitPrice)}
            onChangeText={(v) => onUpdate(item.id, "unitPrice", v)}
            keyboardType="decimal-pad"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      </View>
    </View>
  );
}

const lineStyles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  lineTotal: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.primary,
  },
  deleteBtn: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.danger,
    paddingHorizontal: spacing.xs,
  },
  descInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  numRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  numField: {
    flex: 1,
  },
  numLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  numInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
  },
});

// ---------------------------------------------------------------------------
// Send Modal
// ---------------------------------------------------------------------------

function SendModal({
  visible,
  onClose,
  onSend,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  onSend: (email: string) => void;
  loading: boolean;
}) {
  const [email, setEmail] = useState("");

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.content}>
          <Text style={modalStyles.title}>Send Quote</Text>
          <Text style={modalStyles.subtitle}>
            Enter the customer's email address
          </Text>
          <Input
            label="Recipient Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="customer@example.com"
          />
          <View style={modalStyles.actions}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onClose}
              style={{ flex: 1, marginRight: spacing.sm }}
            />
            <Button
              title="Send"
              onPress={() => onSend(email)}
              loading={loading}
              disabled={!email.trim()}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  content: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontFamily: fonts.titleBold,
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: "row",
    marginTop: spacing.sm,
  },
});

// ---------------------------------------------------------------------------
// Quote Editor Screen
// ---------------------------------------------------------------------------

export default function QuoteEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);

  // Form state
  const [status, setStatus] = useState("draft");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState("");

  // ---- Load quote ----
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      try {
        const data: QuoteGetResponse = await (trpc as any).portal.quotes.get.query({ id });
        if (cancelled) return;
        // Backend returns { quote, lineItems, photos } — not a flat object
        const q = data.quote;
        setStatus(q.status || "draft");
        setCustomerName(q.customerName || "");
        setCustomerEmail(q.customerEmail || "");
        setCustomerPhone(q.customerPhone || "");
        setCustomerAddress(q.customerAddress || "");
        setJobTitle(q.jobTitle || "");
        setLineItems(
          (data.lineItems || []).map((li) => {
            // Decimal columns arrive as strings; coerce to numbers for local edit state
            const qty = parseFloat(li.quantity ?? "0");
            const price = li.unitPrice != null ? parseFloat(li.unitPrice) : 0;
            return {
              id: li.id || generateTempId(),
              description: li.description || "",
              quantity: Number.isFinite(qty) ? qty : 1,
              unitPrice: Number.isFinite(price) ? price : 0,
            };
          })
        );
        setNotes(q.notes || "");
      } catch (err: any) {
        Alert.alert("Error", err?.message || "Failed to load quote.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // ---- Line item helpers ----
  const addLineItem = useCallback(() => {
    setLineItems((prev) => [
      ...prev,
      { id: generateTempId(), description: "", quantity: 1, unitPrice: 0 },
    ]);
  }, []);

  const deleteLineItem = useCallback((itemId: string) => {
    setLineItems((prev) => prev.filter((li) => li.id !== itemId));
  }, []);

  const updateLineItem = useCallback(
    (itemId: string, field: keyof LineItem, value: string) => {
      setLineItems((prev) =>
        prev.map((li) => {
          if (li.id !== itemId) return li;
          if (field === "quantity" || field === "unitPrice") {
            const num = parseFloat(value) || 0;
            return { ...li, [field]: num };
          }
          return { ...li, [field]: value };
        })
      );
    },
    []
  );

  // ---- Calculations ----
  const subtotal = lineItems.reduce(
    (sum, li) => sum + li.quantity * li.unitPrice,
    0
  );
  const gst = subtotal * 0.1;
  const total = subtotal + gst;

  // ---- Build payload ----
  // Backend `quotes.update` input expects lineItems[*].quantity/unitPrice as STRINGS
  // (decimal columns), and does NOT accept a per-item id (it rebuilds line items).
  const buildPayload = useCallback(() => {
    return {
      id,
      jobTitle: jobTitle || undefined,
      customerName: customerName || undefined,
      customerEmail: customerEmail || undefined,
      customerPhone: customerPhone || undefined,
      customerAddress: customerAddress || undefined,
      notes: notes || undefined,
      lineItems: lineItems
        .filter((li) => li.description.trim().length > 0)
        .map((li) => ({
          description: li.description,
          quantity: String(li.quantity),
          unitPrice: li.unitPrice > 0 ? String(li.unitPrice) : null,
        })),
    };
  }, [id, customerName, customerEmail, customerPhone, customerAddress, jobTitle, lineItems, notes]);

  // ---- Save Draft ----
  const saveDraft = useCallback(async () => {
    setIsSaving(true);
    try {
      await (trpc as any).portal.quotes.update.mutate(buildPayload());
      Alert.alert("Saved", "Quote saved as draft.");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to save quote.");
    } finally {
      setIsSaving(false);
    }
  }, [buildPayload]);

  // ---- Attach Photos ----
  // Backend `quotes.addPhoto` expects { quoteId, imageDataUrl, caption?, mimeType? }
  // where imageDataUrl is a base64 data URL (e.g. "data:image/jpeg;base64,...").
  const attachPhotos = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.7,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) return;

      for (const asset of result.assets) {
        if (!asset.base64) {
          // ImagePicker failed to produce base64; skip this asset rather than sending a broken payload
          continue;
        }
        const mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/heic" =
          asset.mimeType === "image/png"
            ? "image/png"
            : asset.mimeType === "image/webp"
              ? "image/webp"
              : asset.mimeType === "image/heic"
                ? "image/heic"
                : "image/jpeg";
        const imageDataUrl = `data:${mimeType};base64,${asset.base64}`;
        await (trpc as any).portal.quotes.addPhoto.mutate({
          quoteId: id,
          imageDataUrl,
          mimeType,
        });
      }

      Alert.alert("Success", `${result.assets.length} photo(s) attached.`);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to attach photos.");
    }
  }, [id]);

  // ---- Generate PDF ----
  const generatePdf = useCallback(async () => {
    setIsGeneratingPdf(true);
    try {
      await (trpc as any).portal.quotes.generatePdf.mutate({ id });
      Alert.alert("Success", "PDF generated successfully.");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to generate PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [id]);

  // ---- Send Quote ----
  const sendQuote = useCallback(
    async (recipientEmail: string) => {
      setIsSending(true);
      try {
        await (trpc as any).portal.quotes.send.mutate({ id, recipientEmail });
        setShowSendModal(false);
        setStatus("sent");
        Alert.alert("Sent", "Quote sent to customer.");
      } catch (err: any) {
        Alert.alert("Error", err?.message || "Failed to send quote.");
      } finally {
        setIsSending(false);
      }
    },
    [id]
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backBtn}>{"< Back"}</Text>
          </TouchableOpacity>
          <Badge label={status} color={statusBadgeColor(status)} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Customer Details */}
          <SectionHeader title="Customer Details" />
          <Input
            label="Job Title"
            value={jobTitle}
            onChangeText={setJobTitle}
            placeholder="e.g. Kitchen renovation"
          />
          <Input
            label="Customer Name"
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Full name"
          />
          <Input
            label="Email"
            value={customerEmail}
            onChangeText={setCustomerEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="customer@example.com"
          />
          <Input
            label="Phone"
            value={customerPhone}
            onChangeText={setCustomerPhone}
            keyboardType="phone-pad"
            placeholder="04xx xxx xxx"
          />
          <Input
            label="Address"
            value={customerAddress}
            onChangeText={setCustomerAddress}
            placeholder="Street address"
          />

          {/* Line Items */}
          <SectionHeader
            title="Line Items"
            action={{ label: "+ Add", onPress: addLineItem }}
          />
          {lineItems.map((item) => (
            <LineItemRow
              key={item.id}
              item={item}
              onUpdate={updateLineItem}
              onDelete={deleteLineItem}
            />
          ))}
          {lineItems.length === 0 && (
            <TouchableOpacity onPress={addLineItem} style={styles.addItemBtn}>
              <Text style={styles.addItemText}>+ Add Line Item</Text>
            </TouchableOpacity>
          )}

          {/* Totals */}
          <Card style={styles.totalsCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>GST (10%)</Text>
              <Text style={styles.totalValue}>{formatCurrency(gst)}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>
                {formatCurrency(total)}
              </Text>
            </View>
          </Card>

          {/* Notes */}
          <SectionHeader title="Notes" />
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional notes..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              title="Attach Photos"
              variant="secondary"
              onPress={attachPhotos}
              style={styles.actionBtn}
            />
            <Button
              title="Generate PDF"
              variant="secondary"
              onPress={generatePdf}
              loading={isGeneratingPdf}
              style={styles.actionBtn}
            />
            <Button
              title="Send to Customer"
              onPress={() => setShowSendModal(true)}
              style={styles.actionBtn}
            />
            <Button
              title="Save Draft"
              variant="secondary"
              onPress={saveDraft}
              loading={isSaving}
              style={styles.actionBtn}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SendModal
        visible={showSendModal}
        onClose={() => setShowSendModal(false)}
        onSend={sendQuote}
        loading={isSending}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.primary,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 120,
  },
  addItemBtn: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    padding: spacing.md,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  addItemText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.primary,
  },
  totalsCard: {
    marginTop: spacing.sm,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  totalLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  totalValue: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
  },
  grandTotalLabel: {
    fontFamily: fonts.titleSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  grandTotalValue: {
    fontFamily: fonts.titleBold,
    fontSize: 18,
    color: colors.primary,
  },
  notesInput: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    minHeight: 100,
    marginBottom: spacing.md,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  actionBtn: {
    marginBottom: 0,
  },
});
