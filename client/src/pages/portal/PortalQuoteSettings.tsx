/**
 * PortalQuoteSettings — Branding configuration for quote PDFs and emails.
 *
 * Allows the client to set:
 * - Business logo URL
 * - Brand colour (hex)
 * - ABN / ACN
 * - Payment terms
 * - Default notes
 * - GST rate
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import PortalLayout from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Palette } from "lucide-react";

export default function PortalQuoteSettings() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: me, isLoading } = trpc.portal.me.useQuery();
  const updateBrandingMutation = trpc.quotes.updateBranding.useMutation({
    onSuccess: () => {
      utils.portal.me.invalidate();
      toast.success("Branding saved");
    },
    onError: () => toast.error("Failed to save branding"),
  });

  const [form, setForm] = useState({
    logoUrl: "",
    brandColour: "#F5A623",
    abn: "",
    paymentTerms: "Payment due within 14 days of acceptance.",
    defaultNotes: "",
    gstRate: "10",
  });

  useEffect(() => {
    if (me) {
      setForm({
        logoUrl: me.logoUrl ?? "",
        brandColour: me.brandColour ?? "#F5A623",
        abn: me.abn ?? "",
        paymentTerms: me.paymentTerms ?? "Payment due within 14 days of acceptance.",
        defaultNotes: me.defaultNotes ?? "",
        gstRate: me.gstRate ?? "10",
      });
    }
  }, [me]);

  function handleSave() {
    updateBrandingMutation.mutate(form);
  }

  if (isLoading) {
    return (
      <PortalLayout activeTab="quotes">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout activeTab="quotes">
      {/* Back nav */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/portal/jobs?tab=quotes")}
          className="text-white/50 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Quotes
        </Button>
        <span className="text-white/20">/</span>
        <span className="text-sm text-white/70">Branding Settings</span>
      </div>

      <div className="max-w-xl">
        <div className="flex items-center gap-3 mb-6">
          <Palette className="w-6 h-6 text-amber-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Quote Branding</h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
              Customise how your quotes look to customers.
            </p>
          </div>
        </div>

        <div
          className="rounded-xl border p-6 space-y-5"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
        >
          {/* Logo */}
          <div>
            <Label className="text-white/70 text-xs mb-1.5 block">Logo URL</Label>
            <Input
              value={form.logoUrl}
              onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
              placeholder="https://yoursite.com/logo.png"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
              Paste a direct URL to your logo image (PNG or SVG, transparent background recommended).
            </p>
            {form.logoUrl && (
              <img
                src={form.logoUrl}
                alt="Logo preview"
                className="mt-2 h-12 object-contain rounded"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            )}
          </div>

          {/* Brand colour */}
          <div>
            <Label className="text-white/70 text-xs mb-1.5 block">Brand Colour</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.brandColour}
                onChange={(e) => setForm((f) => ({ ...f, brandColour: e.target.value }))}
                className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent"
              />
              <Input
                value={form.brandColour}
                onChange={(e) => setForm((f) => ({ ...f, brandColour: e.target.value }))}
                placeholder="#F5A623"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 w-32"
              />
              <div
                className="w-10 h-10 rounded-lg border border-white/10"
                style={{ background: form.brandColour }}
              />
            </div>
          </div>

          {/* ABN */}
          <div>
            <Label className="text-white/70 text-xs mb-1.5 block">ABN / ACN</Label>
            <Input
              value={form.abn}
              onChange={(e) => setForm((f) => ({ ...f, abn: e.target.value }))}
              placeholder="12 345 678 901"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>

          {/* GST rate */}
          <div>
            <Label className="text-white/70 text-xs mb-1.5 block">GST Rate (%)</Label>
            <Input
              value={form.gstRate}
              onChange={(e) => setForm((f) => ({ ...f, gstRate: e.target.value }))}
              placeholder="10"
              type="number"
              min="0"
              max="100"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 w-24"
            />
          </div>

          {/* Payment terms */}
          <div>
            <Label className="text-white/70 text-xs mb-1.5 block">Default Payment Terms</Label>
            <Input
              value={form.paymentTerms}
              onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))}
              placeholder="Payment due within 14 days of acceptance."
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>

          {/* Default notes */}
          <div>
            <Label className="text-white/70 text-xs mb-1.5 block">Default Quote Notes</Label>
            <Textarea
              value={form.defaultNotes}
              onChange={(e) => setForm((f) => ({ ...f, defaultNotes: e.target.value }))}
              placeholder="Any standard terms, warranty info, or notes to include on all quotes…"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
              rows={3}
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={updateBrandingMutation.isPending}
            style={{ background: "#F5A623", color: "#0F1F3D" }}
            className="font-semibold w-full"
          >
            {updateBrandingMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
            ) : (
              <><Save className="w-4 h-4 mr-2" />Save Branding</>
            )}
          </Button>
        </div>
      </div>
    </PortalLayout>
  );
}
