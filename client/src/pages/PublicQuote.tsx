/**
 * PublicQuote — Customer-facing quote view page.
 *
 * Accessible at /quote/:token (no auth required).
 * Allows the customer to:
 * - View the full quote with line items, report, and photos
 * - Accept or decline the quote (with structured reason + optional note)
 * - Download the PDF
 *
 * P1-A fix: Decline form now uses radio buttons for the enum reason field
 *           plus a separate optional freetext customerNote field.
 * P1-B fix: Draft quotes show a "not yet available" banner instead of
 *           accept/decline buttons (server also blocks draft acceptance).
 */
import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  CheckCircle, XCircle, Download, Loader2, FileText, Calendar as CalendarIcon,
} from "lucide-react";
import AddressAutocomplete from "@/components/portal/AddressAutocomplete";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAUD(val: string | null | undefined) {
  if (!val) return "—";
  return `$${parseFloat(val).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`;
}

function fmtDate(val: Date | string | null | undefined) {
  if (!val) return "—";
  return new Date(String(val)).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Decline reason options (mirrors the backend enum exactly) ─────────────────

const DECLINE_REASONS: { value: "price" | "timing" | "scope" | "found_someone_else" | "other"; label: string; description: string }[] = [
  { value: "price", label: "Price", description: "The quote was outside my budget" },
  { value: "timing", label: "Timing", description: "The timeline doesn't work for me right now" },
  { value: "scope", label: "Scope", description: "The work described doesn't match what I need" },
  { value: "found_someone_else", label: "Found someone else", description: "I've decided to go with another provider" },
  { value: "other", label: "Other", description: "Another reason not listed above" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function PublicQuote() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const { data, isLoading, error } = trpc.publicQuotes.getByToken.useQuery({ token });
  const acceptMutation = trpc.publicQuotes.accept.useMutation();
  const declineMutation = trpc.publicQuotes.decline.useMutation();

  // P1-A: Separate state for structured reason (enum) vs freetext note
  const [declineReason, setDeclineReason] = useState<"price" | "timing" | "scope" | "found_someone_else" | "other" | "">("");
  const [customerNote, setCustomerNote] = useState("");
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [actionDone, setActionDone] = useState<"accepted" | "declined" | null>(null);

  // Acceptance form: customer can confirm/edit address and pick a preferred date.
  // Address defaults to whatever was on the quote; date is empty so the user
  // makes a deliberate choice (server falls back to today+7 if left blank).
  const [confirmedAddress, setConfirmedAddress] = useState<string>("");
  const [preferredDate, setPreferredDate] = useState<string>("");
  // Sync address once when the quote loads — only the first time.
  const incomingAddress = data?.quote?.customerAddress ?? "";
  useEffect(() => {
    if (incomingAddress && !confirmedAddress) {
      setConfirmedAddress(incomingAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingAddress]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm px-4">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Quote Not Found</h1>
          <p className="text-gray-500 text-sm">
            This quote link may have expired or been cancelled. Please contact the business directly.
          </p>
        </div>
      </div>
    );
  }

  const { quote, lineItems, photos, businessName, logoUrl, brandColour, abn } = data;
  const accent = brandColour ?? "#F5A623";
  const isExpired = (quote.status as string) === "expired";
  const isClosed = ["accepted", "declined", "cancelled"].includes(quote.status);
  // P1-B: Draft quotes are not yet ready for customer response
  const isDraft = quote.status === "draft";

  async function handleAccept() {
    // Address is required so the tradie knows where to go. Date is optional —
    // server defaults to today + 7 days if left blank.
    if (!confirmedAddress.trim()) {
      toast.error("Please confirm the address before accepting.");
      return;
    }
    try {
      await acceptMutation.mutateAsync({
        token,
        customerAddress: confirmedAddress.trim(),
        preferredDate: preferredDate || undefined,
      });
      setActionDone("accepted");
      toast.success("Quote accepted! The team will be in touch shortly.");
    } catch {
      toast.error("Failed to accept quote. Please try again or contact us directly.");
    }
  }

  async function handleDecline() {
    if (!declineReason) {
      toast.error("Please select a reason for declining.");
      return;
    }
    try {
      await declineMutation.mutateAsync({
        token,
        reason: declineReason,
        customerNote: customerNote.trim() || undefined,
      });
      setActionDone("declined");
      setShowDeclineForm(false);
      toast("Quote declined. Thank you for letting us know.");
    } catch {
      toast.error("Failed to decline quote. Please try again or contact us directly.");
    }
  }

  // ── Confirmation screens ──────────────────────────────────────────────────

  if (actionDone === "accepted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-sm">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: `${accent}22` }}
          >
            <CheckCircle className="w-8 h-8" style={{ color: accent }} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Quote Accepted!</h1>
          <p className="text-gray-500">
            Thank you! {businessName} will be in touch shortly to confirm next steps.
          </p>
        </div>
      </div>
    );
  }

  if (actionDone === "declined") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-gray-100">
            <XCircle className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Quote Declined</h1>
          <p className="text-gray-500">
            Thanks for letting us know. Feel free to reach out if you change your mind.
          </p>
        </div>
      </div>
    );
  }

  const reportContent = quote.reportContent as Record<string, unknown> | null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={businessName} className="h-8 object-contain" />
            ) : (
              <span className="font-bold text-gray-800">{businessName}</span>
            )}
          </div>
          <span className="text-xs text-gray-400 font-mono">{quote.quoteNumber}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* ── Status banners ─────────────────────────────────────────── */}
        {isExpired && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
            <p className="text-amber-700 font-medium text-sm">
              This quote has expired. Please contact {businessName} for an updated quote.
            </p>
          </div>
        )}
        {/* P1-B: Draft quotes show a clear "not yet sent" banner */}
        {isDraft && (
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-center">
            <p className="text-blue-700 font-medium text-sm">
              This quote is still being prepared. {businessName} will send it to you shortly.
            </p>
          </div>
        )}
        {quote.status === "accepted" && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
            <p className="text-green-700 font-medium text-sm">
              ✓ You have accepted this quote. {businessName} will be in touch shortly.
            </p>
          </div>
        )}
        {quote.status === "declined" && (
          <div className="rounded-xl bg-gray-100 border border-gray-200 p-4 text-center">
            <p className="text-gray-500 text-sm">You have declined this quote.</p>
          </div>
        )}

        {/* ── Quote header ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{quote.jobTitle}</h1>
              {quote.customerName && (
                <p className="text-gray-500 mt-1">Prepared for {quote.customerName}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold" style={{ color: accent }}>
                {fmtAUD(quote.totalAmount)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">inc. GST</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {[
              { label: "Quote #", value: quote.quoteNumber },
              { label: "Valid Until", value: fmtDate(quote.validUntil) },
              { label: "Payment Terms", value: quote.paymentTerms },
              quote.customerAddress ? { label: "Address", value: quote.customerAddress } : null,
              abn ? { label: "ABN", value: abn } : null,
            ]
              .filter(Boolean)
              .map((item) => (
                <div key={item!.label}>
                  <p className="text-gray-400 text-xs">{item!.label}</p>
                  <p className="text-gray-700 font-medium">{item!.value}</p>
                </div>
              ))}
          </div>
        </div>

        {/* ── AI Report ──────────────────────────────────────────────── */}
        {reportContent && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            {(reportContent.executiveSummary as string) && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">Overview</h2>
                <p className="text-gray-600 leading-relaxed">{reportContent.executiveSummary as string}</p>
              </div>
            )}
            {(reportContent.scopeOfWork as string) && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">Scope of Work</h2>
                <p className="text-gray-600 leading-relaxed">{reportContent.scopeOfWork as string}</p>
              </div>
            )}
            {/* Inclusions & Exclusions */}
            {(reportContent.inclusionsExclusions as { inclusions?: string[]; exclusions?: string[] }) && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-3">Inclusions & Exclusions</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {((reportContent.inclusionsExclusions as any).inclusions ?? []).length > 0 && (
                    <div className="bg-green-50 rounded-xl p-4">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2">✓ Included</p>
                      <ul className="space-y-1">
                        {((reportContent.inclusionsExclusions as any).inclusions as string[]).map((item: string, i: number) => (
                          <li key={i} className="text-sm text-green-800">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {((reportContent.inclusionsExclusions as any).exclusions ?? []).length > 0 && (
                    <div className="bg-red-50 rounded-xl p-4">
                      <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-2">✗ Not Included</p>
                      <ul className="space-y-1">
                        {((reportContent.inclusionsExclusions as any).exclusions as string[]).map((item: string, i: number) => (
                          <li key={i} className="text-sm text-red-800">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Warranty & Guarantee */}
            {(reportContent.warrantyAndGuarantee as string) && (
              <div className="bg-blue-50 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-blue-800 mb-1">Warranty & Guarantee</h2>
                <p className="text-sm text-blue-700 leading-relaxed">{reportContent.warrantyAndGuarantee as string}</p>
              </div>
            )}
            {(reportContent.whyChooseUs as string) && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">Why Choose Us</h2>
                <p className="text-gray-600 leading-relaxed">{reportContent.whyChooseUs as string}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Line items ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Quote Breakdown</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-gray-400 font-normal pb-2">Description</th>
                <th className="text-right text-gray-400 font-normal pb-2">Qty</th>
                <th className="text-right text-gray-400 font-normal pb-2">Unit</th>
                <th className="text-right text-gray-400 font-normal pb-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li) => (
                <tr key={li.id} className="border-b border-gray-50">
                  <td className="py-2.5 text-gray-800">{li.description}</td>
                  <td className="py-2.5 text-right text-gray-500">{li.quantity}</td>
                  <td className="py-2.5 text-right text-gray-500">{li.unit}</td>
                  <td className="py-2.5 text-right font-medium text-gray-800">{fmtAUD(li.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>{fmtAUD(quote.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>GST ({quote.gstRate}%)</span>
              <span>{fmtAUD(quote.gstAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-base pt-1">
              <span>Total</span>
              <span style={{ color: accent }}>{fmtAUD(quote.totalAmount)}</span>
            </div>
          </div>
          {quote.notes && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Notes</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}
        </div>

        {/* ── Photos ─────────────────────────────────────────────────── */}
        {photos.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Site Photos</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((p) => (
                <div key={p.id} className="rounded-xl overflow-hidden aspect-square bg-gray-100">
                  <img src={p.imageUrl} alt={p.caption ?? "Site photo"} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PDF download ───────────────────────────────────────────── */}
        {quote.pdfUrl && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-800">Download PDF</p>
                <p className="text-xs text-gray-400">Full quote document</p>
              </div>
            </div>
            <a
              href={quote.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium"
              style={{ color: accent }}
            >
              <Download className="w-4 h-4" />
              Download
            </a>
          </div>
        )}

        {/* ── Accept / Decline ───────────────────────────────────────── */}
        {/* P1-B: Only show response buttons for sent quotes, not draft/expired/closed */}
        {!isClosed && !isExpired && !isDraft && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Your Response</h2>
            <p className="text-sm text-gray-500 mb-5">
              This quote is valid until {fmtDate(quote.validUntil)}. Accept to proceed or decline if you'd like to discuss further.
            </p>

            {!showDeclineForm && (
              <div className="space-y-4 mb-5">
                {/* Address confirmation — Google Places autocomplete (AU). */}
                <div>
                  <Label className="text-gray-700 text-sm font-semibold mb-1.5 block">
                    Confirm job address <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-xs text-gray-500 mb-2">
                    Make sure this is where the work needs to happen — start typing to pick from suggestions.
                  </p>
                  <AddressAutocomplete
                    value={confirmedAddress}
                    onChange={setConfirmedAddress}
                    placeholder="Start typing your address…"
                    iconColorIdle="#9CA3AF"
                    iconColorReady="#F5A623"
                    style={{
                      background: "#fff",
                      border: "1px solid #E5E7EB",
                      color: "#1F2937",
                      padding: "10px 12px 10px 32px",
                      fontSize: "14px",
                    }}
                  />
                </div>

                {/* Preferred date — native date picker. Min = today. */}
                <div>
                  <Label className="text-gray-700 text-sm font-semibold mb-1.5 block">
                    Preferred date <span className="text-gray-400 font-normal">(optional)</span>
                  </Label>
                  <p className="text-xs text-gray-500 mb-2">
                    When would you like the work done? The team will confirm the exact time.
                  </p>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      type="date"
                      value={preferredDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setPreferredDate(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 rounded-lg text-sm outline-none border border-gray-200 bg-white text-gray-800 focus:border-gray-400"
                    />
                  </div>
                </div>
              </div>
            )}

            {!showDeclineForm ? (
              <div className="flex gap-3">
                <Button
                  className="flex-1 font-semibold py-3 text-base"
                  style={{ background: accent, color: "#fff" }}
                  onClick={handleAccept}
                  disabled={acceptMutation.isPending}
                >
                  {acceptMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Accepting…</>
                  ) : (
                    <><CheckCircle className="w-5 h-5 mr-2" />Accept Quote</>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-gray-200 text-gray-500 hover:text-gray-700 py-3 text-base"
                  onClick={() => setShowDeclineForm(true)}
                >
                  <XCircle className="w-5 h-5 mr-2" />
                  Decline
                </Button>
              </div>
            ) : (
              /* P1-A: Structured decline form — radio buttons + separate note field */
              <div className="space-y-5">
                <div>
                  <Label className="text-gray-700 text-sm font-semibold mb-3 block">
                    Why are you declining? <span className="text-red-500">*</span>
                  </Label>
                  <div className="space-y-2">
                    {DECLINE_REASONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                          declineReason === opt.value
                            ? "border-gray-400 bg-gray-50"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="declineReason"
                          value={opt.value}
                          checked={declineReason === opt.value}
                          onChange={() => setDeclineReason(opt.value)}
                          className="mt-0.5 accent-gray-800"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                          <p className="text-xs text-gray-500">{opt.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-gray-600 text-sm mb-1.5 block">
                    Additional comments <span className="text-gray-400">(optional)</span>
                  </Label>
                  <Textarea
                    value={customerNote}
                    onChange={(e) => setCustomerNote(e.target.value)}
                    placeholder="Any other details that might help the team improve…"
                    className="resize-none"
                    rows={3}
                    maxLength={1000}
                  />
                  {customerNote.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1 text-right">{customerNote.length}/1000</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 border-gray-200 text-gray-500"
                    onClick={() => {
                      setShowDeclineForm(false);
                      setDeclineReason("");
                      setCustomerNote("");
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold"
                    onClick={handleDecline}
                    disabled={declineMutation.isPending || !declineReason}
                  >
                    {declineMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Declining…</>
                    ) : (
                      "Confirm Decline"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="text-center py-8 text-xs text-gray-300">
        Powered by <span style={{ color: accent }}>Solvr</span> · AI Receptionist
      </footer>
    </div>
  );
}
