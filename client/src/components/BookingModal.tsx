/**
 * BookingModal — Strategy call booking for the demo page.
 *
 * Two modes:
 * 1. CALENDLY MODE (preferred): If VITE_CALENDLY_URL is set, shows an embedded
 *    Calendly widget so prospects self-book a confirmed slot instantly.
 *    Lead details are captured via Calendly's own confirmation flow.
 *
 * 2. FORM MODE (fallback): If no Calendly URL is configured, shows the
 *    manual form that submits to the database via tRPC.
 *
 * To enable Calendly: add VITE_CALENDLY_URL to your environment secrets,
 * e.g. https://calendly.com/yourname/strategy-call
 */
import { useEffect, useRef, useState } from "react";
import { X, CheckCircle2, Loader2, Calendar, User, Mail, Phone, Building2, ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  demoPersona?: string;
}

const CALENDLY_URL = import.meta.env.VITE_CALENDLY_URL as string | undefined;

// ── Calendly Embed ────────────────────────────────────────────────────────────
function CalendlyEmbed({ url, prefill }: { url: string; prefill?: { name?: string; email?: string } }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Calendly widget script if not already loaded
    const scriptId = "calendly-widget-script";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://assets.calendly.com/assets/external/widget.js";
      script.async = true;
      document.head.appendChild(script);
    }

    // Build the embed URL with prefill params
    const embedUrl = new URL(url);
    embedUrl.searchParams.set("embed_type", "Inline");
    embedUrl.searchParams.set("hide_event_type_details", "1");
    embedUrl.searchParams.set("hide_gdpr_banner", "1");
    if (prefill?.name) embedUrl.searchParams.set("name", prefill.name);
    if (prefill?.email) embedUrl.searchParams.set("email", prefill.email);

    if (containerRef.current) {
      containerRef.current.innerHTML = "";
      const widget = document.createElement("div");
      widget.className = "calendly-inline-widget";
      widget.setAttribute("data-url", embedUrl.toString());
      widget.style.minWidth = "320px";
      widget.style.height = "630px";
      containerRef.current.appendChild(widget);

      // Re-init if Calendly is already loaded
      if ((window as unknown as { Calendly?: { initInlineWidgets: () => void } }).Calendly) {
        (window as unknown as { Calendly: { initInlineWidgets: () => void } }).Calendly.initInlineWidgets();
      }
    }
  }, [url, prefill?.name, prefill?.email]);

  return <div ref={containerRef} className="w-full" />;
}

// ── Fallback Form ─────────────────────────────────────────────────────────────
function BookingForm({ onSuccess, demoPersona }: { onSuccess: () => void; demoPersona?: string }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", businessName: "" });

  const submitLead = trpc.strategyCall.submitLead.useMutation({
    onSuccess,
    onError: (err) => toast.error("Something went wrong. Please try again.", { description: err.message }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitLead.mutate({
      name: form.name,
      email: form.email,
      phone: form.phone || undefined,
      businessName: form.businessName || undefined,
      demoPersona: demoPersona || undefined,
    });
  }

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#F5A623]/50 transition-colors";
  const labelClass = "font-mono text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-slate-400 text-sm mb-5 leading-relaxed">
        30 minutes. No obligation. We'll identify your top AI opportunities and give you a clear picture of what's possible for your business.
      </p>

      <div>
        <label className={labelClass}><User size={10} /> Your Name *</label>
        <input type="text" required placeholder="John Smith" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
      </div>

      <div>
        <label className={labelClass}><Mail size={10} /> Email Address *</label>
        <input type="email" required placeholder="john@smithplumbing.com.au" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}><Phone size={10} /> Phone</label>
          <input type="tel" placeholder="0412 345 678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}><Building2 size={10} /> Business Name</label>
          <input type="text" placeholder="Smith Plumbing" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} className={inputClass} />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitLead.isPending}
        className="w-full flex items-center justify-center gap-2 bg-[#F5A623] hover:bg-[#E8A020] text-[#0A1628] font-bold py-3 rounded-lg transition-colors uppercase tracking-wide text-sm mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitLead.isPending ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : <><Calendar size={16} /> Book My Free Strategy Call</>}
      </button>

      <p className="text-slate-600 text-xs text-center">We'll respond within 24 hours. No spam, ever.</p>
    </form>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export function BookingModal({ open, onClose, demoPersona }: BookingModalProps) {
  const [submitted, setSubmitted] = useState(false);
  const useCalendly = !!CALENDLY_URL;

  function handleClose() {
    onClose();
    setTimeout(() => setSubmitted(false), 300);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0A1628]/90 backdrop-blur-sm" onClick={handleClose} />

      <div className={`relative w-full bg-[#0D1E35] border border-white/15 rounded-xl shadow-2xl overflow-hidden animate-fade-in-up ${useCalendly ? "max-w-2xl" : "max-w-lg"}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div>
            <div className="font-mono text-[10px] text-[#F5A623] uppercase tracking-widest mb-1">Free Strategy Call</div>
            <h2 className="font-display text-xl font-bold text-white uppercase tracking-tight">
              {useCalendly ? "Pick a Time That Works for You" : "Book Your Free 30-Min Call"}
            </h2>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className={`${useCalendly ? "p-0" : "p-6"}`}>
          {submitted ? (
            <div className="text-center py-8 px-6">
              <div className="w-16 h-16 rounded-full bg-[#F5A623]/15 border border-[#F5A623]/30 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 size={28} className="text-[#F5A623]" />
              </div>
              <h3 className="font-display text-xl font-bold text-white uppercase mb-2">You're Booked In!</h3>
              <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto mb-6">
                We'll be in touch within 24 hours to confirm your call time. No spam, ever.
              </p>
              <button onClick={handleClose} className="px-6 py-2.5 bg-[#F5A623] text-[#0A1628] font-bold text-sm rounded hover:bg-[#E8A020] transition-colors uppercase tracking-wide">
                Close
              </button>
            </div>
          ) : useCalendly ? (
            <div>
              <CalendlyEmbed url={CALENDLY_URL!} />
              <div className="px-4 pb-3 flex items-center justify-center gap-1.5 text-[10px] text-slate-600">
                <ExternalLink size={10} />
                <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 transition-colors">
                  Open in new tab
                </a>
              </div>
            </div>
          ) : (
            <BookingForm onSuccess={() => setSubmitted(true)} demoPersona={demoPersona} />
          )}
        </div>
      </div>
    </div>
  );
}
