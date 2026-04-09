/**
 * MemoryFileSection — the editable "AI Memory File" in portal settings.
 * Shows all onboarding data in collapsible sub-sections so clients can
 * review and update their business info, services, pricing, branding,
 * and AI context at any time.
 *
 * Data flows: client_profiles table → getFullProfile → this UI → updateFullProfile → client_profiles
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Brain, Save, Loader2, ChevronDown, ChevronRight,
  Plus, Trash2, Wrench, DollarSign, Clock, MapPin,
  Palette, MessageSquare, HelpCircle, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

const inputStyle = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "white",
};

type Service = { name: string; description: string; typicalPrice: number | null; unit: string };
type FAQ = { question: string; answer: string };
type OperatingHours = { monFri: string; sat: string; sun: string; publicHolidays: string };

const INDUSTRY_OPTIONS = [
  { value: "plumber", label: "Plumber" },
  { value: "electrician", label: "Electrician" },
  { value: "carpenter", label: "Carpenter" },
  { value: "builder", label: "Builder" },
  { value: "gardener", label: "Gardener" },
  { value: "painter", label: "Painter" },
  { value: "roofer", label: "Roofer" },
  { value: "hvac", label: "HVAC" },
  { value: "locksmith", label: "Locksmith" },
  { value: "pest_control", label: "Pest Control" },
  { value: "cleaner", label: "Cleaner" },
  { value: "lawyer", label: "Lawyer" },
  { value: "accountant", label: "Accountant" },
  { value: "physio", label: "Physiotherapist" },
  { value: "dentist", label: "Dentist" },
  { value: "health_clinic", label: "Health Clinic" },
  { value: "real_estate", label: "Real Estate" },
  { value: "other", label: "Other" },
];

const TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
];

const FONT_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "modern", label: "Modern" },
  { value: "classic", label: "Classic" },
];

// ─── Collapsible sub-section ────────────────────────────────────────────────
function SubSection({
  icon: Icon,
  title,
  defaultOpen = false,
  children,
}: {
  icon: React.ElementType;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 py-3 text-left hover:bg-white/[0.02] transition-colors px-1 rounded"
      >
        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: "#F5A623" }} />
        <span className="text-sm font-medium text-white flex-1">{title}</span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-white/30" />
        ) : (
          <ChevronRight className="w-4 h-4 text-white/30" />
        )}
      </button>
      {open && <div className="pb-4 pt-1 px-1 space-y-4">{children}</div>}
    </div>
  );
}

export default function MemoryFileSection() {
  const profileQuery = trpc.portal.getFullProfile.useQuery();
  const updateMutation = trpc.portal.updateFullProfile.useMutation({
    onSuccess: () => {
      toast.success("Memory file saved — your AI systems will use this data.");
      profileQuery.refetch();
    },
    onError: (err) => toast.error(err.message ?? "Failed to save."),
  });

  // ─── State ─────────────────────────────────────────────────────────────────
  const [loaded, setLoaded] = useState(false);
  const [industryType, setIndustryType] = useState("");
  const [yearsInBusiness, setYearsInBusiness] = useState<number | null>(null);
  const [teamSize, setTeamSize] = useState<number | null>(null);
  const [website, setWebsite] = useState("");

  // Services
  const [services, setServices] = useState<Service[]>([]);
  const [callOutFee, setCallOutFee] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [minimumCharge, setMinimumCharge] = useState("");
  const [afterHoursMultiplier, setAfterHoursMultiplier] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [operatingHours, setOperatingHours] = useState<OperatingHours>({
    monFri: "7:00 AM – 5:00 PM",
    sat: "8:00 AM – 12:00 PM",
    sun: "Closed",
    publicHolidays: "Emergency only",
  });
  const [emergencyAvailable, setEmergencyAvailable] = useState(false);
  const [emergencyFee, setEmergencyFee] = useState("");

  // Branding
  const [primaryColor, setPrimaryColor] = useState("#0F1F3D");
  const [secondaryColor, setSecondaryColor] = useState("#F5A623");
  const [brandFont, setBrandFont] = useState("professional");
  const [tagline, setTagline] = useState("");
  const [toneOfVoice, setToneOfVoice] = useState("professional");

  // AI Context
  const [aiContext, setAiContext] = useState("");
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [competitorNotes, setCompetitorNotes] = useState("");
  const [bookingInstructions, setBookingInstructions] = useState("");
  const [escalationInstructions, setEscalationInstructions] = useState("");

  // ─── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (profileQuery.data?.profile && !loaded) {
      const p = profileQuery.data.profile;
      setIndustryType(p.industryType ?? "");
      setYearsInBusiness(p.yearsInBusiness ?? null);
      setTeamSize(p.teamSize ?? null);
      setWebsite(p.website ?? "");
      setServices((p.servicesOffered as Service[]) ?? []);
      setCallOutFee(p.callOutFee ?? "");
      setHourlyRate(p.hourlyRate ?? "");
      setMinimumCharge(p.minimumCharge ?? "");
      setAfterHoursMultiplier(p.afterHoursMultiplier ?? "");
      setServiceArea(p.serviceArea ?? "");
      setOperatingHours(
        (p.operatingHours as OperatingHours) ?? {
          monFri: "7:00 AM – 5:00 PM",
          sat: "8:00 AM – 12:00 PM",
          sun: "Closed",
          publicHolidays: "Emergency only",
        }
      );
      setEmergencyAvailable(p.emergencyAvailable ?? false);
      setEmergencyFee(p.emergencyFee ?? "");
      setPrimaryColor(p.primaryColor ?? "#0F1F3D");
      setSecondaryColor(p.secondaryColor ?? "#F5A623");
      setBrandFont(p.brandFont ?? "professional");
      setTagline(p.tagline ?? "");
      setToneOfVoice(p.toneOfVoice ?? "professional");
      setAiContext(p.aiContext ?? "");
      setFaqs((p.commonFaqs as FAQ[]) ?? []);
      setCompetitorNotes(p.competitorNotes ?? "");
      setBookingInstructions(p.bookingInstructions ?? "");
      setEscalationInstructions(p.escalationInstructions ?? "");
      setLoaded(true);
    }
  }, [profileQuery.data, loaded]);

  // ─── Save ──────────────────────────────────────────────────────────────────
  function handleSave() {
    updateMutation.mutate({
      industryType,
      yearsInBusiness,
      teamSize,
      website,
      servicesOffered: services,
      callOutFee,
      hourlyRate,
      minimumCharge,
      afterHoursMultiplier,
      serviceArea,
      operatingHours,
      emergencyAvailable,
      emergencyFee,
      primaryColor,
      secondaryColor,
      brandFont,
      tagline,
      toneOfVoice,
      aiContext,
      commonFaqs: faqs,
      competitorNotes,
      bookingInstructions,
      escalationInstructions,
    });
  }

  // ─── Service helpers ───────────────────────────────────────────────────────
  function addService() {
    setServices([...services, { name: "", description: "", typicalPrice: null, unit: "per job" }]);
  }
  function removeService(i: number) {
    setServices(services.filter((_, idx) => idx !== i));
  }
  function updateService(i: number, field: keyof Service, value: string | number | null) {
    setServices(services.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
  }

  // ─── FAQ helpers ───────────────────────────────────────────────────────────
  function addFaq() {
    setFaqs([...faqs, { question: "", answer: "" }]);
  }
  function removeFaq(i: number) {
    setFaqs(faqs.filter((_, idx) => idx !== i));
  }
  function updateFaq(i: number, field: keyof FAQ, value: string) {
    setFaqs(faqs.map((f, idx) => (idx === i ? { ...f, [field]: value } : f)));
  }

  if (profileQuery.isLoading) {
    return (
      <div
        className="rounded-xl p-6 mb-6"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(245,166,35,0.12)" }}>
            <Brain className="w-4 h-4" style={{ color: "#F5A623" }} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">AI Memory File</h2>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Loading your business data…</p>
          </div>
        </div>
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#F5A623" }} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-6 mb-6"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(245,166,35,0.12)" }}>
          <Brain className="w-4 h-4" style={{ color: "#F5A623" }} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">AI Memory File</h2>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            This data powers your AI receptionist and voice-to-quote engine. Keep it up to date.
          </p>
        </div>
      </div>

      <div className="mt-4">
        {/* ── Services & Pricing ───────────────────────────────────────── */}
        <SubSection icon={Wrench} title="Services & Pricing" defaultOpen>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Industry</Label>
              <select
                value={industryType}
                onChange={(e) => setIndustryType(e.target.value)}
                className="w-full rounded-md px-3 py-2 text-sm"
                style={inputStyle}
              >
                <option value="">Select industry…</option>
                {INDUSTRY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Website</Label>
              <Input placeholder="https://yourbusiness.com.au" value={website} onChange={(e) => setWebsite(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Call-out Fee</Label>
              <Input placeholder="$0" value={callOutFee} onChange={(e) => setCallOutFee(e.target.value)} style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Hourly Rate</Label>
              <Input placeholder="$0" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Minimum Charge</Label>
              <Input placeholder="$0" value={minimumCharge} onChange={(e) => setMinimumCharge(e.target.value)} style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">After-hours ×</Label>
              <Input placeholder="1.5" value={afterHoursMultiplier} onChange={(e) => setAfterHoursMultiplier(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Services list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-white/70 text-xs">Services You Offer</Label>
              <button type="button" onClick={addService} className="flex items-center gap-1 text-xs hover:text-white/80 transition-colors" style={{ color: "#F5A623" }}>
                <Plus className="w-3 h-3" /> Add Service
              </button>
            </div>
            {services.length === 0 ? (
              <p className="text-white/30 text-xs py-2">No services added yet. Click "Add Service" to start.</p>
            ) : (
              <div className="space-y-2">
                {services.map((s, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_80px_80px_32px] gap-2 items-start">
                    <Input placeholder="Service name" value={s.name} onChange={(e) => updateService(i, "name", e.target.value)} style={inputStyle} className="text-xs" />
                    <Input placeholder="Brief description" value={s.description} onChange={(e) => updateService(i, "description", e.target.value)} style={inputStyle} className="text-xs" />
                    <Input placeholder="$0" value={s.typicalPrice?.toString() ?? ""} onChange={(e) => updateService(i, "typicalPrice", e.target.value ? parseFloat(e.target.value) : null)} style={inputStyle} className="text-xs" />
                    <select value={s.unit} onChange={(e) => updateService(i, "unit", e.target.value)} className="rounded-md px-2 py-2 text-xs" style={inputStyle}>
                      <option value="per job">per job</option>
                      <option value="per hour">per hour</option>
                      <option value="per metre">per metre</option>
                      <option value="per sqm">per sqm</option>
                      <option value="fixed">fixed</option>
                    </select>
                    <button type="button" onClick={() => removeService(i)} className="p-2 text-red-400/60 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SubSection>

        {/* ── Service Area & Hours ─────────────────────────────────────── */}
        <SubSection icon={MapPin} title="Service Area & Operating Hours">
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">Service Area</Label>
            <Textarea
              placeholder="e.g. Sydney metro, Western Sydney, Blue Mountains — up to 50km from Parramatta"
              value={serviceArea}
              onChange={(e) => setServiceArea(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" as const }}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Mon–Fri</Label>
              <Input value={operatingHours.monFri} onChange={(e) => setOperatingHours({ ...operatingHours, monFri: e.target.value })} style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Saturday</Label>
              <Input value={operatingHours.sat} onChange={(e) => setOperatingHours({ ...operatingHours, sat: e.target.value })} style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Sunday</Label>
              <Input value={operatingHours.sun} onChange={(e) => setOperatingHours({ ...operatingHours, sun: e.target.value })} style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Public Holidays</Label>
              <Input value={operatingHours.publicHolidays} onChange={(e) => setOperatingHours({ ...operatingHours, publicHolidays: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={emergencyAvailable}
                onChange={(e) => setEmergencyAvailable(e.target.checked)}
                className="w-4 h-4 rounded accent-amber-500"
              />
              <span className="text-white/70 text-xs">Emergency call-outs available</span>
            </label>
            {emergencyAvailable && (
              <Input
                placeholder="Emergency fee"
                value={emergencyFee}
                onChange={(e) => setEmergencyFee(e.target.value)}
                className="w-32"
                style={inputStyle}
              />
            )}
          </div>
        </SubSection>

        {/* ── Branding & Identity ──────────────────────────────────────── */}
        <SubSection icon={Palette} title="Branding & Identity">
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">Tagline</Label>
            <Input placeholder="e.g. Your local plumbing experts since 2005" value={tagline} onChange={(e) => setTagline(e.target.value)} style={inputStyle} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Primary Colour</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={inputStyle} className="flex-1" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Secondary Colour</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} style={inputStyle} className="flex-1" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Font Style</Label>
              <select value={brandFont} onChange={(e) => setBrandFont(e.target.value)} className="w-full rounded-md px-3 py-2 text-sm" style={inputStyle}>
                {FONT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Tone of Voice</Label>
              <select value={toneOfVoice} onChange={(e) => setToneOfVoice(e.target.value)} className="w-full rounded-md px-3 py-2 text-sm" style={inputStyle}>
                {TONE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </SubSection>

        {/* ── AI Knowledge & Context ───────────────────────────────────── */}
        <SubSection icon={Brain} title="AI Knowledge & Context">
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">
              Anything else your AI should know about your business
            </Label>
            <Textarea
              placeholder="e.g. We specialise in heritage homes. We don't do commercial work. We always provide a warranty certificate. Our busiest months are Oct–Feb…"
              value={aiContext}
              onChange={(e) => setAiContext(e.target.value)}
              rows={4}
              style={{ ...inputStyle, resize: "vertical" as const }}
            />
            <p className="text-white/25 text-xs">This free-form text is injected directly into your AI receptionist's prompt and the voice-to-quote extraction context.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">What makes you different from competitors?</Label>
            <Textarea
              placeholder="e.g. 20 years experience, fully licensed, same-day service, free quotes, family-owned…"
              value={competitorNotes}
              onChange={(e) => setCompetitorNotes(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" as const }}
            />
          </div>
        </SubSection>

        {/* ── FAQs ─────────────────────────────────────────────────────── */}
        <SubSection icon={HelpCircle} title="Common FAQs (AI will answer these)">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white/30 text-xs">Add questions your customers commonly ask. Your AI will use these to answer calls and chats.</p>
            <button type="button" onClick={addFaq} className="flex items-center gap-1 text-xs hover:text-white/80 transition-colors flex-shrink-0" style={{ color: "#F5A623" }}>
              <Plus className="w-3 h-3" /> Add FAQ
            </button>
          </div>
          {faqs.length === 0 ? (
            <p className="text-white/20 text-xs py-2">No FAQs added yet.</p>
          ) : (
            <div className="space-y-3">
              {faqs.map((f, i) => (
                <div key={i} className="p-3 rounded-lg space-y-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-start gap-2">
                    <Input placeholder="Question" value={f.question} onChange={(e) => updateFaq(i, "question", e.target.value)} style={inputStyle} className="text-xs flex-1" />
                    <button type="button" onClick={() => removeFaq(i)} className="p-2 text-red-400/60 hover:text-red-400 transition-colors flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <Textarea placeholder="Answer" value={f.answer} onChange={(e) => updateFaq(i, "answer", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" as const }} className="text-xs" />
                </div>
              ))}
            </div>
          )}
        </SubSection>

        {/* ── Call Handling ─────────────────────────────────────────────── */}
        <SubSection icon={MessageSquare} title="Call Handling Instructions">
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">How do customers book?</Label>
            <Textarea
              placeholder="e.g. Book through ServiceM8, call the office, or send a text to 0412 345 678"
              value={bookingInstructions}
              onChange={(e) => setBookingInstructions(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" as const }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">When should the AI transfer to you vs take a message?</Label>
            <Textarea
              placeholder="e.g. Transfer immediately for emergencies (burst pipes, gas leaks). Take a message for general enquiries and quote requests."
              value={escalationInstructions}
              onChange={(e) => setEscalationInstructions(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" as const }}
            />
          </div>
        </SubSection>
      </div>

      {/* Save button */}
      <div className="pt-4 mt-2 border-t border-white/5">
        <Button
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="font-semibold"
          style={{ background: "#F5A623", color: "#0F1F3D" }}
        >
          {updateMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
          ) : (
            <><Save className="w-4 h-4 mr-2" />Save Memory File</>
          )}
        </Button>
      </div>
    </div>
  );
}
