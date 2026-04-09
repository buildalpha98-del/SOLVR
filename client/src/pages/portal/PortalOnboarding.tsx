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
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
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
  Loader2, CheckCircle2, Building2, Wrench, Palette, Rocket,
  ChevronRight, ChevronLeft, Mic, Plus, Trash2, Info,
} from "lucide-react";

const LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark-3m4hMtZ3cT8T4cayJyuAzG.webp";

const STEPS = [
  { id: 0, title: "Business Basics", icon: Building2, desc: "Tell us about your business" },
  { id: 1, title: "Services & Pricing", icon: Wrench, desc: "What you do and what you charge" },
  { id: 2, title: "Branding & AI", icon: Palette, desc: "Your brand and how AI should represent you" },
  { id: 3, title: "Review & Activate", icon: Rocket, desc: "Check everything and go live" },
];

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
  const { data: profileData, isLoading } = trpc.portal.getOnboardingProfile.useQuery();
  const saveMutation = trpc.portal.saveOnboardingStep.useMutation();
  const completeMutation = trpc.portal.completeOnboarding.useMutation();

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
      console.error("Failed to save step:", err);
    } finally {
      setIsSaving(false);
    }
  }, [currentStep, getStepData, saveMutation]);

  const handleNext = async () => {
    await saveCurrentStep();
    setCurrentStep((s) => Math.min(s + 1, 3));
  };

  const handleBack = () => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      // Save final step first
      await saveMutation.mutateAsync({ step: currentStep, data: getStepData(currentStep) });
      await completeMutation.mutateAsync();
      navigate("/portal/dashboard");
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
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
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#0F1F3D" }}>
      {/* Header */}
      <div className="border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <img src={LOGO} alt="Solvr" className="h-7 opacity-90" />
          <div className="flex items-center gap-2">
            {isSaving && <Loader2 className="w-4 h-4 animate-spin text-amber-400" />}
            <span className="text-white/30 text-xs">{isSaving ? "Saving..." : "Auto-saved"}</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="max-w-4xl mx-auto px-6 pt-8">
        <div className="flex items-center gap-2 mb-2">
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => { if (i <= currentStep) setCurrentStep(i); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all w-full ${
                  i === currentStep
                    ? "text-white"
                    : i < currentStep
                    ? "text-green-400 cursor-pointer"
                    : "text-white/30 cursor-default"
                }`}
                style={i === currentStep ? { background: "rgba(245,166,35,0.12)" } : {}}
                disabled={i > currentStep}
              >
                {i < currentStep ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-green-400" />
                ) : (
                  <step.icon className="w-5 h-5 shrink-0" style={i === currentStep ? { color: "#F5A623" } : {}} />
                )}
                <span className="hidden sm:inline truncate">{step.title}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className="w-8 h-px shrink-0" style={{ background: i < currentStep ? "#22c55e" : "rgba(255,255,255,0.1)" }} />
              )}
            </div>
          ))}
        </div>
        <div className="h-1 rounded-full mt-4" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${((currentStep + 1) / 4) * 100}%`, background: "#F5A623" }}
          />
        </div>
      </div>

      {/* Dictation tip */}
      {showDictationTip && currentStep < 3 && (
        <div className="max-w-4xl mx-auto px-6 mt-6">
          <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.12)" }}>
            <Mic className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#F5A623" }} />
            <div className="flex-1">
              <p className="text-white/70 text-sm">
                <strong className="text-white/90">Time-poor?</strong> Tap the microphone on your keyboard to dictate instead of typing. Works great for service descriptions and FAQs.
              </p>
            </div>
            <button onClick={() => setShowDictationTip(false)} className="text-white/30 hover:text-white/50 text-xs">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Step content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-white text-2xl font-bold">{STEPS[currentStep].title}</h2>
          <p className="text-white/50 text-sm mt-1">{STEPS[currentStep].desc}</p>
        </div>

        {/* ── Step 1: Business Basics ────────────────────────────────── */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-white/70 text-sm">Trading Name *</Label>
                <Input
                  value={tradingName}
                  onChange={(e) => setTradingName(e.target.value)}
                  placeholder="e.g. Smith's Plumbing"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-11"
                />
                <p className="text-white/30 text-xs">The name your customers know you by</p>
              </div>

              <div className="space-y-2">
                <Label className="text-white/70 text-sm">ABN</Label>
                <Input
                  value={abn}
                  onChange={(e) => setAbn(e.target.value)}
                  placeholder="e.g. 12 345 678 901"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-11"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/70 text-sm">Phone *</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0412 345 678"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-11"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/70 text-sm">Email</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. info@smithplumbing.com.au"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70 text-sm">Business Address</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 42 High Street, Parramatta NSW 2150"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-11"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70 text-sm">Website</Label>
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="e.g. www.smithplumbing.com.au"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-11"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-white/70 text-sm">Industry *</Label>
                <Select value={industryType} onValueChange={setIndustryType}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white h-11">
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
                <Label className="text-white/70 text-sm">Years in Business</Label>
                <Input
                  type="number"
                  value={yearsInBusiness}
                  onChange={(e) => setYearsInBusiness(e.target.value)}
                  placeholder="e.g. 5"
                  min={0}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-11"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/70 text-sm">Team Size</Label>
                <Input
                  type="number"
                  value={teamSize}
                  onChange={(e) => setTeamSize(e.target.value)}
                  placeholder="e.g. 1 (sole trader)"
                  min={1}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-11"
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
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-semibold">Services You Offer</h3>
                  <p className="text-white/40 text-xs mt-1">
                    {industryType && INDUSTRY_DEFAULTS[industryType]
                      ? "We've pre-filled common services for your industry — edit or remove as needed."
                      : "Add the services your business provides."}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={addService}
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-white/70 hover:text-white hover:bg-white/5"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Service
                </Button>
              </div>

              <div className="space-y-3">
                {services.map((service, i) => (
                  <div key={i} className="p-4 rounded-xl space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                          value={service.name}
                          onChange={(e) => updateService(i, "name", e.target.value)}
                          placeholder="Service name"
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-10 text-sm"
                        />
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            value={service.typicalPrice ?? ""}
                            onChange={(e) => updateService(i, "typicalPrice", e.target.value ? parseFloat(e.target.value) : null)}
                            placeholder="Price ($)"
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-10 text-sm flex-1"
                          />
                          <Select value={service.unit} onValueChange={(v) => updateService(i, "unit", v)}>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white h-10 text-sm w-28">
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
                      <button onClick={() => removeService(i)} className="text-white/20 hover:text-red-400 mt-2">
                        <Trash2 className="w-4 h-4" />
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
                  <div className="text-center py-8 text-white/30 text-sm">
                    No services added yet. Click "Add Service" or select your industry in Step 1 for smart defaults.
                  </div>
                )}
              </div>
            </div>

            {/* Pricing */}
            <div>
              <h3 className="text-white font-semibold mb-4">Pricing</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-white/70 text-xs">Call-out Fee ($)</Label>
                  <Input
                    type="number"
                    value={callOutFee}
                    onChange={(e) => setCallOutFee(e.target.value)}
                    placeholder="80"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-10 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70 text-xs">Hourly Rate ($)</Label>
                  <Input
                    type="number"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    placeholder="95"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-10 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70 text-xs">Minimum Charge ($)</Label>
                  <Input
                    type="number"
                    value={minimumCharge}
                    onChange={(e) => setMinimumCharge(e.target.value)}
                    placeholder="150"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-10 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70 text-xs">After-hours Multiplier</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={afterHoursMultiplier}
                    onChange={(e) => setAfterHoursMultiplier(e.target.value)}
                    placeholder="1.5"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-10 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Service Area */}
            <div className="space-y-2">
              <Label className="text-white/70 text-sm">Service Area</Label>
              <Textarea
                value={serviceArea}
                onChange={(e) => setServiceArea(e.target.value)}
                placeholder="e.g. Greater Sydney — Parramatta, Penrith, Blacktown, Hills District. Travel fee applies beyond 30km."
                rows={2}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm resize-none"
              />
            </div>

            {/* Operating Hours */}
            <div>
              <h3 className="text-white font-semibold mb-4">Operating Hours</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-white/70 text-xs">Mon–Fri</Label>
                  <Input value={monFri} onChange={(e) => setMonFri(e.target.value)} className="bg-white/5 border-white/10 text-white h-10 text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70 text-xs">Saturday</Label>
                  <Input value={sat} onChange={(e) => setSat(e.target.value)} className="bg-white/5 border-white/10 text-white h-10 text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70 text-xs">Sunday</Label>
                  <Input value={sun} onChange={(e) => setSun(e.target.value)} className="bg-white/5 border-white/10 text-white h-10 text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70 text-xs">Public Holidays</Label>
                  <Input value={publicHolidays} onChange={(e) => setPublicHolidays(e.target.value)} className="bg-white/5 border-white/10 text-white h-10 text-sm" />
                </div>
              </div>

              <div className="flex items-center gap-4 mt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emergencyAvailable}
                    onChange={(e) => setEmergencyAvailable(e.target.checked)}
                    className="rounded border-white/20"
                  />
                  <span className="text-white/70 text-sm">Emergency call-outs available</span>
                </label>
                {emergencyAvailable && (
                  <div className="flex items-center gap-2">
                    <Label className="text-white/70 text-xs">Emergency Fee ($)</Label>
                    <Input
                      type="number"
                      value={emergencyFee}
                      onChange={(e) => setEmergencyFee(e.target.value)}
                      placeholder="150"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-9 text-sm w-24"
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-white/70 text-sm">Brand Colour</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="bg-white/5 border-white/10 text-white h-10 text-sm flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white/70 text-sm">Tagline</Label>
                <Input
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g. Your local plumbing experts since 2010"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-10 text-sm"
                />
              </div>
            </div>

            {/* AI Tone */}
            <div className="space-y-2">
              <Label className="text-white/70 text-sm">How should the AI sound when it answers calls or writes quotes?</Label>
              <Select value={toneOfVoice} onValueChange={setToneOfVoice}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-11">
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
              <Label className="text-white/70 text-sm">
                Anything else the AI should know about your business?
              </Label>
              <div className="flex items-start gap-2 mb-2 p-3 rounded-lg" style={{ background: "rgba(245,166,35,0.06)" }}>
                <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#F5A623" }} />
                <p className="text-white/50 text-xs">
                  This is your AI's "memory" — anything you write here will be used when answering calls and generating quotes.
                  Think: specialisations, certifications, areas you don't service, common customer questions.
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
              <Label className="text-white/70 text-sm">What makes your business different from competitors?</Label>
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
              <Label className="text-white/70 text-sm">How do customers book with you?</Label>
              <Textarea
                value={bookingInstructions}
                onChange={(e) => setBookingInstructions(e.target.value)}
                placeholder="e.g. Customers can book via phone or through our ServiceM8 online booking page. For urgent jobs, call directly."
                rows={2}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm resize-none"
              />
            </div>

            {/* Escalation */}
            <div className="space-y-2">
              <Label className="text-white/70 text-sm">When should the AI transfer a call to you vs take a message?</Label>
              <Textarea
                value={escalationInstructions}
                onChange={(e) => setEscalationInstructions(e.target.value)}
                placeholder="e.g. Transfer immediately for emergencies (burst pipes, no hot water). Take a message for general enquiries and quote requests."
                rows={2}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm resize-none"
              />
            </div>

            {/* FAQs */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-semibold">Common Questions & Answers</h3>
                  <p className="text-white/40 text-xs mt-1">
                    Add questions your customers frequently ask — the AI will use these to answer calls.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={addFaq}
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-white/70 hover:text-white hover:bg-white/5"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add FAQ
                </Button>
              </div>

              <div className="space-y-3">
                {faqs.map((faq, i) => (
                  <div key={i} className="p-4 rounded-xl space-y-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <Input
                          value={faq.question}
                          onChange={(e) => updateFaq(i, "question", e.target.value)}
                          placeholder="Question customers ask..."
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-10 text-sm"
                        />
                        <Textarea
                          value={faq.answer}
                          onChange={(e) => updateFaq(i, "answer", e.target.value)}
                          placeholder="How the AI should answer..."
                          rows={2}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm resize-none"
                        />
                      </div>
                      <button onClick={() => removeFaq(i)} className="text-white/20 hover:text-red-400 mt-2">
                        <Trash2 className="w-4 h-4" />
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
          <div className="space-y-8">
            <div className="p-6 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <h3 className="text-white font-semibold mb-4">Your Business Profile Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {summaryItems.map((item) => (
                  <div key={item.label} className="flex justify-between py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <span className="text-white/50 text-sm">{item.label}</span>
                    <span className="text-white text-sm font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Services detail */}
            {services.filter(s => s.name).length > 0 && (
              <div className="p-6 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <h3 className="text-white font-semibold mb-4">Services</h3>
                <div className="space-y-3">
                  {services.filter(s => s.name).map((s, i) => (
                    <div key={i} className="flex items-start justify-between py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                      <div>
                        <p className="text-white text-sm font-medium">{s.name}</p>
                        <p className="text-white/40 text-xs">{s.description}</p>
                      </div>
                      <span className="text-white/60 text-sm shrink-0 ml-4">
                        {s.typicalPrice ? `$${s.typicalPrice}/${s.unit}` : `By ${s.unit}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Context preview */}
            {aiContext && (
              <div className="p-6 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <h3 className="text-white font-semibold mb-2">AI Memory</h3>
                <p className="text-white/50 text-sm whitespace-pre-wrap">{aiContext}</p>
              </div>
            )}

            <div className="p-6 rounded-xl text-center" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
              <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-green-400" />
              <h3 className="text-white font-semibold mb-1">Ready to activate</h3>
              <p className="text-white/50 text-sm max-w-md mx-auto">
                Once you activate, your AI receptionist and quoting engine will use all this information
                to represent your business. You can update any of this later in Settings.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-10 pt-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <Button
            type="button"
            onClick={handleBack}
            variant="outline"
            disabled={currentStep === 0}
            className="border-white/10 text-white/70 hover:text-white hover:bg-white/5"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>

          <div className="flex items-center gap-3">
            <span className="text-white/30 text-xs">Step {currentStep + 1} of 4</span>
            {currentStep < 3 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={isSaving}
                className="font-semibold cursor-pointer"
                style={{ background: "#F5A623", color: "#0F1F3D" }}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleComplete}
                disabled={isCompleting}
                className="font-semibold cursor-pointer px-8"
                style={{ background: "#22c55e", color: "white" }}
              >
                {isCompleting ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Activating…</>
                ) : (
                  <><Rocket className="w-4 h-4 mr-2" />Activate My Portal</>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
