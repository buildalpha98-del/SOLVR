/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Portal Onboarding Wizard — A-to-Z setup for new Solvr clients.
 *
 * 4 steps:
 *   1. Business Basics (trading name, ABN, phone, address, industry, team size)
 *   2. Services & Pricing (services offered, rates, service area, hours)
 *   3. Branding & AI Context (logo, colours, tone, FAQs, booking instructions)
 *   4. Review & Activate (summary, confirm, go live)
 *
 * Auto-saves on every step transition. Dictation prompts for text areas.
 * Smart defaults based on industry type.
 *
 * Mobile-first: one step = one full-height screen. `OnboardingStepShell`
 * owns the back chevron, dot progress indicator, and bottom CTA; this
 * module owns the form state and tRPC calls.
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2, CheckCircle2, Mic, Plus, Trash2, Info, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { OnboardingStepShell } from "@/components/portal/OnboardingStepShell";
import { hapticLight, hapticSuccess } from "@/lib/haptics";

const STEPS = [
  { id: 0, title: "Business Basics", desc: "Tell us about your business" },
  { id: 1, title: "Services & Pricing", desc: "What you do and what you charge" },
  { id: 2, title: "Branding & AI", desc: "Your brand and how AI should represent you" },
  { id: 3, title: "Review & Activate", desc: "Check everything and go live" },
];

const TOTAL_STEPS = STEPS.length;

// Minimum 44×44pt tap target — Apple HIG.
const TAP_TARGET = "min-h-[44px]";

const INDUSTRY_OPTIONS = [
  { value: "plumber", label: "Plumber" },
  { value: "electrician", label: "Electrician" },
  { value: "carpenter", label: "Carpenter" },
  { value: "builder", label: "Builder" },
  { value: "gardener", label: "Gardener / Landscaper" },
  { value: "painter", label: "Painter" },
  { value: "roofer", label: "Roofer" },
  { value: "hvac", label: "HVAC / Air Conditioning" },
  { value: "locksmith", label: "Locksmith" },
  { value: "pest_control", label: "Pest Control" },
  { value: "cleaner", label: "Cleaner" },
  { value: "lawyer", label: "Lawyer / Law Firm" },
  { value: "accountant", label: "Accountant" },
  { value: "physio", label: "Physiotherapist" },
  { value: "dentist", label: "Dentist" },
  { value: "health_clinic", label: "Health Clinic" },
  { value: "real_estate", label: "Real Estate" },
  { value: "other", label: "Other" },
];

const TONE_OPTIONS = [
  { value: "professional", label: "Professional — formal and business-like" },
  { value: "friendly", label: "Friendly — warm and approachable" },
  { value: "casual", label: "Casual — relaxed and conversational" },
  { value: "formal", label: "Formal — very structured and precise" },
];

// Smart defaults for common industries
const INDUSTRY_DEFAULTS: Record<string, {
  services: Array<{ name: string; description: string; typicalPrice: number | null; unit: string }>;
  callOutFee: string;
  hourlyRate: string;
}> = {
  plumber: {
    services: [
      { name: "Blocked Drains", description: "Clear blocked drains using electric eel or hydro jetter", typicalPrice: 180, unit: "job" },
      { name: "Tap Repairs", description: "Fix leaking or broken taps, replace washers and cartridges", typicalPrice: 120, unit: "job" },
      { name: "Hot Water Systems", description: "Install, repair, or replace hot water systems", typicalPrice: 1500, unit: "job" },
      { name: "Toilet Repairs", description: "Fix running, leaking, or blocked toilets", typicalPrice: 150, unit: "job" },
      { name: "Bathroom Renovations", description: "Full or partial bathroom renovation including plumbing rough-in", typicalPrice: null, unit: "quote" },
    ],
    callOutFee: "80",
    hourlyRate: "95",
  },
  electrician: {
    services: [
      { name: "Power Point Installation", description: "Install new power points or relocate existing ones", typicalPrice: 150, unit: "point" },
      { name: "Lighting Installation", description: "Install downlights, pendant lights, or outdoor lighting", typicalPrice: 120, unit: "light" },
      { name: "Switchboard Upgrade", description: "Upgrade old switchboard to modern safety switch board", typicalPrice: 1200, unit: "job" },
      { name: "Fault Finding", description: "Diagnose and repair electrical faults, tripped circuits", typicalPrice: 180, unit: "job" },
      { name: "Smoke Alarm Compliance", description: "Install or replace smoke alarms to meet current regulations", typicalPrice: 100, unit: "alarm" },
    ],
    callOutFee: "80",
    hourlyRate: "90",
  },
  carpenter: {
    services: [
      { name: "Deck Building", description: "Design and build timber or composite decks", typicalPrice: null, unit: "quote" },
      { name: "Door & Window Installation", description: "Install or replace internal and external doors and windows", typicalPrice: 350, unit: "door" },
      { name: "Built-in Wardrobes", description: "Custom built-in wardrobe design and installation", typicalPrice: null, unit: "quote" },
      { name: "Timber Repairs", description: "Repair damaged timber flooring, stairs, or structural elements", typicalPrice: 200, unit: "job" },
    ],
    callOutFee: "70",
    hourlyRate: "85",
  },
  builder: {
    services: [
      { name: "Home Renovations", description: "Kitchen, bathroom, and general home renovations", typicalPrice: null, unit: "quote" },
      { name: "Extensions", description: "Room additions and home extensions", typicalPrice: null, unit: "quote" },
      { name: "New Builds", description: "New home construction from slab to handover", typicalPrice: null, unit: "quote" },
      { name: "Commercial Fitouts", description: "Office and retail fitout construction", typicalPrice: null, unit: "quote" },
    ],
    callOutFee: "0",
    hourlyRate: "95",
  },
  gardener: {
    services: [
      { name: "Lawn Mowing", description: "Regular lawn mowing, edging, and blowing", typicalPrice: 60, unit: "visit" },
      { name: "Garden Maintenance", description: "Weeding, pruning, mulching, and general garden upkeep", typicalPrice: 80, unit: "hour" },
      { name: "Landscaping", description: "Garden design, planting, retaining walls, and paving", typicalPrice: null, unit: "quote" },
      { name: "Tree Trimming", description: "Trim and shape trees and hedges", typicalPrice: 150, unit: "job" },
    ],
    callOutFee: "0",
    hourlyRate: "65",
  },
  lawyer: {
    services: [
      { name: "Initial Consultation", description: "30-minute consultation to discuss your legal matter", typicalPrice: 0, unit: "session" },
      { name: "Contract Review", description: "Review and advise on commercial or employment contracts", typicalPrice: 500, unit: "contract" },
      { name: "Property Conveyancing", description: "Handle the legal process of buying or selling property", typicalPrice: 1500, unit: "transaction" },
      { name: "Dispute Resolution", description: "Mediation and negotiation for commercial or personal disputes", typicalPrice: null, unit: "quote" },
    ],
    callOutFee: "0",
    hourlyRate: "350",
  },
  physio: {
    services: [
      { name: "Initial Assessment", description: "Comprehensive 45-minute initial assessment and treatment plan", typicalPrice: 95, unit: "session" },
      { name: "Standard Consultation", description: "30-minute follow-up treatment session", typicalPrice: 75, unit: "session" },
      { name: "Exercise Rehabilitation", description: "Supervised exercise program for injury recovery", typicalPrice: 85, unit: "session" },
      { name: "Dry Needling", description: "Trigger point dry needling for pain relief", typicalPrice: 85, unit: "session" },
    ],
    callOutFee: "0",
    hourlyRate: "150",
  },
};

type ServiceItem = { name: string; description: string; typicalPrice: number | null; unit: string };

export default function PortalOnboarding() {
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showDictationTip, setShowDictationTip] = useState(true);

  // Form state — Step 1: Business Basics
  const [tradingName, setTradingName] = useState("");
  const [abn, setAbn] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [industryType, setIndustryType] = useState("");
  const [yearsInBusiness, setYearsInBusiness] = useState("");
  const [teamSize, setTeamSize] = useState("");

  // Form state — Step 2: Services & Pricing
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [callOutFee, setCallOutFee] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [minimumCharge, setMinimumCharge] = useState("");
  const [afterHoursMultiplier, setAfterHoursMultiplier] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [monFri, setMonFri] = useState("7:00 AM – 5:00 PM");
  const [sat, setSat] = useState("8:00 AM – 12:00 PM");
  const [sun, setSun] = useState("Closed");
  const [publicHolidays, setPublicHolidays] = useState("Emergency only");
  const [emergencyAvailable, setEmergencyAvailable] = useState(false);
  const [emergencyFee, setEmergencyFee] = useState("");

  // Form state — Step 3: Branding & AI
  const [primaryColor, setPrimaryColor] = useState("#F5A623");
  const [toneOfVoice, setToneOfVoice] = useState("friendly");
  const [tagline, setTagline] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [faqs, setFaqs] = useState<Array<{ question: string; answer: string }>>([]);
  const [competitorNotes, setCompetitorNotes] = useState("");
  const [bookingInstructions, setBookingInstructions] = useState("");
  const [escalationInstructions, setEscalationInstructions] = useState("");

  // Load existing profile
  const { data: profileData, isLoading } = trpc.portal.getOnboardingProfile.useQuery(undefined, {
    retry: 2,
    staleTime: 30_000,
  });
  const saveMutation = trpc.portal.saveOnboardingStep.useMutation({
    onError: (err) => {
      toast.error(err.message || "Couldn't save your progress. Please try again.");
    },
  });
  const completeMutation = trpc.portal.completeOnboarding.useMutation({
    onError: (err) => {
      toast.error(err.message || "Couldn't finish onboarding. Please try again.");
    },
  });

  // Populate form from existing profile data
  useEffect(() => {
    if (!profileData) return;
    const { profile, businessName, contactEmail, tradeType } = profileData;

    // Step 1
    setTradingName(profile.tradingName || businessName || "");
    setAbn(profile.abn || "");
    setPhone(profile.phone || "");
    setAddress(profile.address || "");
    setEmail(profile.email || contactEmail || "");
    setWebsite(profile.website || "");
    setIndustryType(profile.industryType || tradeType || "");
    setYearsInBusiness(profile.yearsInBusiness?.toString() || "");
    setTeamSize(profile.teamSize?.toString() || "");

    // Step 2
    if (profile.servicesOffered && Array.isArray(profile.servicesOffered) && profile.servicesOffered.length > 0) {
      setServices(profile.servicesOffered);
    }
    setCallOutFee(profile.callOutFee || "");
    setHourlyRate(profile.hourlyRate || "");
    setMinimumCharge(profile.minimumCharge || "");
    setAfterHoursMultiplier(profile.afterHoursMultiplier || "");
    setServiceArea(profile.serviceArea || "");
    if (profile.operatingHours) {
      setMonFri(profile.operatingHours.monFri || "7:00 AM – 5:00 PM");
      setSat(profile.operatingHours.sat || "8:00 AM – 12:00 PM");
      setSun(profile.operatingHours.sun || "Closed");
      setPublicHolidays(profile.operatingHours.publicHolidays || "Emergency only");
    }
    setEmergencyAvailable(profile.emergencyAvailable || false);
    setEmergencyFee(profile.emergencyFee || "");

    // Step 3
    setPrimaryColor(profile.primaryColor || "#F5A623");
    setToneOfVoice(profile.toneOfVoice || "friendly");
    setTagline(profile.tagline || "");
    setAiContext(profile.aiContext || "");
    if (profile.commonFaqs && Array.isArray(profile.commonFaqs)) {
      setFaqs(profile.commonFaqs);
    }
    setCompetitorNotes(profile.competitorNotes || "");
    setBookingInstructions(profile.bookingInstructions || "");
    setEscalationInstructions(profile.escalationInstructions || "");

    // Resume from last step
    if (profile.onboardingStep !== null && profile.onboardingStep !== undefined) {
      setCurrentStep(Math.min(profile.onboardingStep, 3));
    }
  }, [profileData]);

  // When industry changes, load smart defaults if services are empty
  useEffect(() => {
    if (industryType && services.length === 0 && INDUSTRY_DEFAULTS[industryType]) {
      const defaults = INDUSTRY_DEFAULTS[industryType];
      setServices(defaults.services);
      if (!callOutFee) setCallOutFee(defaults.callOutFee);
      if (!hourlyRate) setHourlyRate(defaults.hourlyRate);
    }
  }, [industryType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build step data for saving
  const getStepData = useCallback((step: number) => {
    switch (step) {
      case 0:
        return {
          tradingName, abn, phone, address, email, website,
          industryType: industryType || undefined,
          yearsInBusiness: yearsInBusiness ? parseInt(yearsInBusiness) : undefined,
          teamSize: teamSize ? parseInt(teamSize) : undefined,
        };
      case 1:
        return {
          servicesOffered: services,
          callOutFee: callOutFee || undefined,
          hourlyRate: hourlyRate || undefined,
          minimumCharge: minimumCharge || undefined,
          afterHoursMultiplier: afterHoursMultiplier || undefined,
          serviceArea,
          operatingHours: { monFri, sat, sun, publicHolidays },
          emergencyAvailable,
          emergencyFee: emergencyFee || undefined,
        };
      case 2:
        return {
          primaryColor,
          toneOfVoice: toneOfVoice || undefined,
          tagline,
          aiContext,
          commonFaqs: faqs,
          competitorNotes,
          bookingInstructions,
          escalationInstructions,
        };
      default:
        return {};
    }
  }, [tradingName, abn, phone, address, email, website, industryType, yearsInBusiness, teamSize,
      services, callOutFee, hourlyRate, minimumCharge, afterHoursMultiplier, serviceArea,
      monFri, sat, sun, publicHolidays, emergencyAvailable, emergencyFee,
      primaryColor, toneOfVoice, tagline, aiContext, faqs, competitorNotes,
      bookingInstructions, escalationInstructions]);

  const saveCurrentStep = useCallback(async () => {
    setIsSaving(true);
    try {
      await saveMutation.mutateAsync({
        step: currentStep,
        data: getStepData(currentStep),
      });
    } catch (err) {
      // onError toast handled by the mutation config.
    } finally {
      setIsSaving(false);
    }
  }, [currentStep, getStepData, saveMutation]);

  const handleNext = async () => {
    hapticLight();
    await saveCurrentStep();
    setCurrentStep((s) => Math.min(s + 1, 3));
  };

  const handleBack = () => {
    hapticLight();
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      // Save final step first
      await saveMutation.mutateAsync({ step: currentStep, data: getStepData(currentStep) });
      await completeMutation.mutateAsync();
      hapticSuccess();
      navigate("/portal/dashboard");
    } catch (err) {
      // onError toast handled by each mutation config.
      setIsCompleting(false);
    }
  };

  // Service management
  const addService = () => {
    setServices([...services, { name: "", description: "", typicalPrice: null, unit: "job" }]);
  };

  const updateService = (index: number, field: keyof ServiceItem, value: string | number | null) => {
    const updated = [...services];
    (updated[index] as any)[field] = value;
    setServices(updated);
  };

  const removeService = (index: number) => {
    setServices(services.filter((_, i) => i !== index));
  };

  // FAQ management
  const addFaq = () => {
    setFaqs([...faqs, { question: "", answer: "" }]);
  };

  const updateFaq = (index: number, field: "question" | "answer", value: string) => {
    const updated = [...faqs];
    updated[index][field] = value;
    setFaqs(updated);
  };

  const removeFaq = (index: number) => {
    setFaqs(faqs.filter((_, i) => i !== index));
  };

  // Step 1 is valid when the mandatory basics are filled.
  const step1Valid = tradingName.trim().length > 0 && phone.trim().length > 0 && industryType.trim().length > 0;

  // Summary data for review step
  const summaryItems = useMemo(() => [
    { label: "Trading Name", value: tradingName },
    { label: "ABN", value: abn },
    { label: "Phone", value: phone },
    { label: "Address", value: address },
    { label: "Industry", value: INDUSTRY_OPTIONS.find(o => o.value === industryType)?.label || industryType },
    { label: "Team Size", value: teamSize ? `${teamSize} ${parseInt(teamSize) === 1 ? "person (sole trader)" : "people"}` : "" },
    { label: "Services", value: `${services.filter(s => s.name).length} services configured` },
    { label: "Hourly Rate", value: hourlyRate ? `$${hourlyRate}/hr` : "" },
    { label: "Call-out Fee", value: callOutFee ? `$${callOutFee}` : "" },
    { label: "Service Area", value: serviceArea },
    { label: "Tone of Voice", value: TONE_OPTIONS.find(o => o.value === toneOfVoice)?.label?.split(" — ")[0] || toneOfVoice },
    { label: "FAQs", value: `${faqs.filter(f => f.question).length} FAQs configured` },
  ].filter(item => item.value), [tradingName, abn, phone, address, industryType, teamSize, services, hourlyRate, callOutFee, serviceArea, toneOfVoice, faqs]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0F1F3D" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#F5A623" }} />
      </div>
    );
  }

  // Auto-save indicator slotted into the shell header.
  const headerRight = (
    <div className="flex items-center gap-1.5">
      {isSaving ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#F5A623" }} />
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Saving</span>
        </>
      ) : (
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Saved</span>
      )}
    </div>
  );

  // CTA config per step.
  const isFinalStep = currentStep === 3;
  const ctaLabel = isFinalStep ? "Activate My Portal" : "Next";
  const ctaDisabled = currentStep === 0 ? !step1Valid : false;
  const ctaLoading = isFinalStep ? isCompleting : isSaving;
  const onCtaClick = isFinalStep ? handleComplete : handleNext;

  return (
    <OnboardingStepShell
      currentStep={currentStep}
      totalSteps={TOTAL_STEPS}
      ctaLabel={ctaLabel}
      onCtaClick={onCtaClick}
      ctaDisabled={ctaDisabled}
      ctaLoading={ctaLoading}
      onBack={handleBack}
      headerRight={headerRight}
    >
      {/* Step title */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>
          {STEPS[currentStep].title}
        </h2>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
          {STEPS[currentStep].desc}
        </p>
      </div>

      {/* Dictation tip (steps 1–3 only) */}
      {showDictationTip && currentStep < 3 && (
        <div
          className="flex items-start gap-3 p-4 rounded-2xl mb-6"
          style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.12)" }}
        >
          <Mic className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#F5A623" }} />
          <div className="flex-1">
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
              <strong style={{ color: "rgba(255,255,255,0.9)" }}>Time-poor?</strong>{" "}
              Tap the microphone on your keyboard to dictate instead of typing. Works great for
              service descriptions and FAQs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDictationTip(false)}
            className={`${TAP_TARGET} min-w-[44px] flex items-center justify-center text-xs`}
            style={{ color: "rgba(255,255,255,0.4)" }}
            aria-label="Dismiss tip"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Step 1: Business Basics ────────────────────────────────── */}
      {currentStep === 0 && (
        <div className="space-y-6">
          {/* Voice CTA — step 1 only */}
          <Link href="/portal/onboarding/voice">
            <div
              role="link"
              tabIndex={0}
              className={`${TAP_TARGET} flex items-center justify-between gap-3 p-4 rounded-2xl cursor-pointer transition-colors`}
              style={{
                background: "rgba(245,166,35,0.08)",
                border: "1px solid rgba(245,166,35,0.25)",
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "rgba(245,166,35,0.15)" }}
                >
                  <Mic className="w-5 h-5" style={{ color: "#F5A623" }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>
                    Prefer to talk?
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                    Let SOLVR set you up — 2 mins
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 shrink-0" style={{ color: "#F5A623" }} />
            </div>
          </Link>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Trading Name *</Label>
              <Input
                value={tradingName}
                onChange={(e) => setTradingName(e.target.value)}
                placeholder="e.g. Smith's Plumbing"
                autoCapitalize="words"
                className={`bg-white/5 border-white/10 text-white placeholder:text-white/30 ${TAP_TARGET}`}
              />
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                The name your customers know you by
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>ABN</Label>
              <Input
                value={abn}
                onChange={(e) => setAbn(e.target.value)}
                placeholder="e.g. 12 345 678 901"
                inputMode="numeric"
                className={`bg-white/5 border-white/10 text-white placeholder:text-white/30 ${TAP_TARGET}`}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Phone *</Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0412 345 678"
                inputMode="tel"
                autoComplete="tel"
                className={`bg-white/5 border-white/10 text-white placeholder:text-white/30 ${TAP_TARGET}`}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. info@smithplumbing.com.au"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                className={`bg-white/5 border-white/10 text-white placeholder:text-white/30 ${TAP_TARGET}`}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Business Address</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 42 High Street, Parramatta NSW 2150"
              autoCapitalize="words"
              className={`bg-white/5 border-white/10 text-white placeholder:text-white/30 ${TAP_TARGET}`}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Website</Label>
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="e.g. www.smithplumbing.com.au"
              inputMode="url"
              autoCapitalize="none"
              className={`bg-white/5 border-white/10 text-white placeholder:text-white/30 ${TAP_TARGET}`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Industry *</Label>
              <Select value={industryType} onValueChange={setIndustryType}>
                <SelectTrigger className={`bg-white/5 border-white/10 text-white ${TAP_TARGET}`}>
                  <SelectValue placeholder="Select your industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Years in Business</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={yearsInBusiness}
                onChange={(e) => setYearsInBusiness(e.target.value)}
                placeholder="e.g. 5"
                min={0}
                className={`bg-white/5 border-white/10 text-white placeholder:text-white/30 ${TAP_TARGET}`}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Team Size</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
                placeholder="e.g. 1 (sole trader)"
                min={1}
                className={`bg-white/5 border-white/10 text-white placeholder:text-white/30 ${TAP_TARGET}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Services & Pricing ─────────────────────────────── */}
      {currentStep === 1 && (
        <div className="space-y-8">
          {/* Services list */}
          <div>
            <div className="flex items-center justify-between mb-4 gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>
                  Services You Offer
                </h3>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {industryType && INDUSTRY_DEFAULTS[industryType]
                    ? "We've pre-filled common services for your industry — edit or remove as needed."
                    : "Add the services your business provides."}
                </p>
              </div>
              <Button
                type="button"
                onClick={addService}
                variant="outline"
                className={`${TAP_TARGET} border-white/10 text-white/70 hover:text-white hover:bg-white/5 shrink-0`}
              >
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>

            <div className="space-y-3">
              {services.map((service, i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl space-y-3"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-3">
                      <Input
                        value={service.name}
                        onChange={(e) => updateService(i, "name", e.target.value)}
                        placeholder="Service name"
                        autoCapitalize="words"
                        className={`bg-white/5 border-white/10 text-white placeholder:text-white/30 ${TAP_TARGET}`}
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={service.typicalPrice ?? ""}
                          onChange={(e) => updateService(i, "typicalPrice", e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder="Price ($)"
                          className={`bg-white/5 border-white/10 text-white placeholder:text-white/30 ${TAP_TARGET} flex-1`}
                        />
                        <Select value={service.unit} onValueChange={(v) => updateService(i, "unit", v)}>
                          <SelectTrigger className={`bg-white/5 border-white/10 text-white ${TAP_TARGET} w-32`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="job">per job</SelectItem>
                            <SelectItem value="hour">per hour</SelectItem>
                            <SelectItem value="visit">per visit</SelectItem>
                            <SelectItem value="session">per session</SelectItem>
                            <SelectItem value="quote">by quote</SelectItem>
                            <SelectItem value="point">per point</SelectItem>
                            <SelectItem value="light">per light</SelectItem>
                            <SelectItem value="alarm">per alarm</SelectItem>
                            <SelectItem value="door">per door</SelectItem>
                            <SelectItem value="contract">per contract</SelectItem>
                            <SelectItem value="transaction">per transaction</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeService(i)}
                      aria-label="Remove service"
                      className={`${TAP_TARGET} w-11 flex items-center justify-center rounded-lg`}
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  <Textarea
                    value={service.description}
                    onChange={(e) => updateService(i, "description", e.target.value)}
                    placeholder="Brief description of this service..."
                    rows={2}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm resize-none"
                  />
                </div>
              ))}
              {services.length === 0 && (
                <div
                  className="text-center py-8 text-sm rounded-2xl"
                  style={{
                    color: "rgba(255,255,255,0.4)",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px dashed rgba(255,255,255,0.08)",
                  }}
                >
                  No services added yet. Tap "Add" or select your industry in step 1 for smart defaults.
                </div>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div>
            <h3 className="font-semibold mb-4" style={{ color: "rgba(255,255,255,0.9)" }}>Pricing</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Call-out Fee ($)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={callOutFee}
                  onChange={(e) => setCallOutFee(e.target.value)}
                  placeholder="80"
                  className={`bg-white/5 border-white/10 text-white placeholder:text-white/30 ${TAP_TARGET}`}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Hourly Rate ($)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="95"
                  className={`bg-white/5 border-white/10 text-white placeholder:text-white/30 ${TAP_TARGET}`}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Minimum Charge ($)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={minimumCharge}
                  onChange={(e) => setMinimumCharge(e.target.value)}
                  placeholder="150"
                  className={`bg-white/5 border-white/10 text-white placeholder:text-white/30 ${TAP_TARGET}`}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>After-hours Multiplier</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={afterHoursMultiplier}
                  onChange={(e) => setAfterHoursMultiplier(e.target.value)}
                  placeholder="1.5"
                  className={`bg-white/5 border-white/10 text-white placeholder:text-white/30 ${TAP_TARGET}`}
                />
              </div>
            </div>
          </div>

          {/* Service Area */}
          <div className="space-y-2">
            <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Service Area</Label>
            <Textarea
              value={serviceArea}
              onChange={(e) => setServiceArea(e.target.value)}
              placeholder="e.g. Greater Sydney — Parramatta, Penrith, Blacktown, Hills District. Travel fee applies beyond 30km."
              rows={3}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm resize-none"
            />
          </div>

          {/* Operating Hours */}
          <div>
            <h3 className="font-semibold mb-4" style={{ color: "rgba(255,255,255,0.9)" }}>Operating Hours</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Mon–Fri</Label>
                <Input
                  value={monFri}
                  onChange={(e) => setMonFri(e.target.value)}
                  className={`bg-white/5 border-white/10 text-white ${TAP_TARGET}`}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Saturday</Label>
                <Input
                  value={sat}
                  onChange={(e) => setSat(e.target.value)}
                  className={`bg-white/5 border-white/10 text-white ${TAP_TARGET}`}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Sunday</Label>
                <Input
                  value={sun}
                  onChange={(e) => setSun(e.target.value)}
                  className={`bg-white/5 border-white/10 text-white ${TAP_TARGET}`}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Public Holidays</Label>
                <Input
                  value={publicHolidays}
                  onChange={(e) => setPublicHolidays(e.target.value)}
                  className={`bg-white/5 border-white/10 text-white ${TAP_TARGET}`}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4">
              <label className={`${TAP_TARGET} flex items-center gap-2 cursor-pointer`}>
                <input
                  type="checkbox"
                  checked={emergencyAvailable}
                  onChange={(e) => setEmergencyAvailable(e.target.checked)}
                  className="w-5 h-5 rounded border-white/20"
                />
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                  Emergency call-outs available
                </span>
              </label>
              {emergencyAvailable && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm shrink-0" style={{ color: "rgba(255,255,255,0.7)" }}>
                    Emergency Fee ($)
                  </Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={emergencyFee}
                    onChange={(e) => setEmergencyFee(e.target.value)}
                    placeholder="150"
                    className={`bg-white/5 border-white/10 text-white placeholder:text-white/30 ${TAP_TARGET} w-28`}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Branding & AI ──────────────────────────────────── */}
      {currentStep === 2 && (
        <div className="space-y-8">
          {/* Brand */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Brand Colour</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-11 h-11 rounded-lg border border-white/10 cursor-pointer shrink-0"
                  aria-label="Pick brand colour"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  autoCapitalize="none"
                  className={`bg-white/5 border-white/10 text-white ${TAP_TARGET} flex-1`}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Tagline</Label>
              <Input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Your local plumbing experts since 2010"
                className={`bg-white/5 border-white/10 text-white placeholder:text-white/30 ${TAP_TARGET}`}
              />
            </div>
          </div>

          {/* AI Tone */}
          <div className="space-y-2">
            <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
              How should the AI sound when it answers calls or writes quotes?
            </Label>
            <Select value={toneOfVoice} onValueChange={setToneOfVoice}>
              <SelectTrigger className={`bg-white/5 border-white/10 text-white ${TAP_TARGET}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* AI Context */}
          <div className="space-y-2">
            <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
              Anything else the AI should know about your business?
            </Label>
            <div
              className="flex items-start gap-2 mb-2 p-3 rounded-lg"
              style={{ background: "rgba(245,166,35,0.06)" }}
            >
              <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#F5A623" }} />
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                This is your AI's "memory" — anything you write here will be used when answering calls and
                generating quotes. Think: specialisations, certifications, areas you don't service, common
                customer questions.
              </p>
            </div>
            <Textarea
              value={aiContext}
              onChange={(e) => setAiContext(e.target.value)}
              placeholder="e.g. We specialise in heritage homes and period-correct restorations. We're fully licensed and insured. We don't do gas fitting — refer those to ABC Gas on 0400 123 456."
              rows={4}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm resize-none"
            />
          </div>

          {/* What makes you different */}
          <div className="space-y-2">
            <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
              What makes your business different from competitors?
            </Label>
            <Textarea
              value={competitorNotes}
              onChange={(e) => setCompetitorNotes(e.target.value)}
              placeholder="e.g. We offer same-day service, lifetime warranty on all work, and we clean up after every job."
              rows={3}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm resize-none"
            />
          </div>

          {/* Booking instructions */}
          <div className="space-y-2">
            <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
              How do customers book with you?
            </Label>
            <Textarea
              value={bookingInstructions}
              onChange={(e) => setBookingInstructions(e.target.value)}
              placeholder="e.g. Customers can book via phone or through our ServiceM8 online booking page. For urgent jobs, call directly."
              rows={3}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm resize-none"
            />
          </div>

          {/* Escalation */}
          <div className="space-y-2">
            <Label className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
              When should the AI transfer a call to you vs take a message?
            </Label>
            <Textarea
              value={escalationInstructions}
              onChange={(e) => setEscalationInstructions(e.target.value)}
              placeholder="e.g. Transfer immediately for emergencies (burst pipes, no hot water). Take a message for general enquiries and quote requests."
              rows={3}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm resize-none"
            />
          </div>

          {/* FAQs */}
          <div>
            <div className="flex items-center justify-between mb-4 gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>
                  Common Questions & Answers
                </h3>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Add questions your customers frequently ask — the AI will use these to answer calls.
                </p>
              </div>
              <Button
                type="button"
                onClick={addFaq}
                variant="outline"
                className={`${TAP_TARGET} border-white/10 text-white/70 hover:text-white hover:bg-white/5 shrink-0`}
              >
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl space-y-2"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-2">
                      <Input
                        value={faq.question}
                        onChange={(e) => updateFaq(i, "question", e.target.value)}
                        placeholder="Question customers ask..."
                        className={`bg-white/5 border-white/10 text-white placeholder:text-white/30 ${TAP_TARGET}`}
                      />
                      <Textarea
                        value={faq.answer}
                        onChange={(e) => updateFaq(i, "answer", e.target.value)}
                        placeholder="How the AI should answer..."
                        rows={2}
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm resize-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFaq(i)}
                      aria-label="Remove FAQ"
                      className={`${TAP_TARGET} w-11 flex items-center justify-center rounded-lg`}
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Review & Activate ──────────────────────────────── */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div
            className="p-6 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <h3 className="font-semibold mb-4" style={{ color: "rgba(255,255,255,0.9)" }}>
              Your Business Profile Summary
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {summaryItems.map((item) => (
                <div
                  key={item.label}
                  className="flex justify-between py-2 border-b gap-3"
                  style={{ borderColor: "rgba(255,255,255,0.06)" }}
                >
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{item.label}</span>
                  <span
                    className="text-sm font-medium text-right"
                    style={{ color: "rgba(255,255,255,0.9)" }}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Services detail */}
          {services.filter(s => s.name).length > 0 && (
            <div
              className="p-6 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <h3 className="font-semibold mb-4" style={{ color: "rgba(255,255,255,0.9)" }}>Services</h3>
              <div className="space-y-3">
                {services.filter(s => s.name).map((s, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between py-2 border-b gap-3"
                    style={{ borderColor: "rgba(255,255,255,0.06)" }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>{s.name}</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{s.description}</p>
                    </div>
                    <span className="text-sm shrink-0" style={{ color: "rgba(255,255,255,0.6)" }}>
                      {s.typicalPrice ? `$${s.typicalPrice}/${s.unit}` : `By ${s.unit}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Context preview */}
          {aiContext && (
            <div
              className="p-6 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <h3 className="font-semibold mb-2" style={{ color: "rgba(255,255,255,0.9)" }}>AI Memory</h3>
              <p className="text-sm whitespace-pre-wrap" style={{ color: "rgba(255,255,255,0.6)" }}>
                {aiContext}
              </p>
            </div>
          )}

          <div
            className="p-6 rounded-2xl text-center"
            style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}
          >
            <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-green-400" />
            <h3 className="font-semibold mb-1" style={{ color: "rgba(255,255,255,0.9)" }}>Ready to activate</h3>
            <p className="text-sm max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.6)" }}>
              Once you activate, your AI receptionist and quoting engine will use all this information to
              represent your business. You can update any of this later in Settings.
            </p>
          </div>
        </div>
      )}
    </OnboardingStepShell>
  );
}
