/**
 * DESIGN PHILOSOPHY: Warm Modernism
 * - Warm cream (#FBF7F0) background, forest green (#1B3A2D) text, terracotta (#C4552A) accents
 * - Fraunces serif for display, Nunito for body, Instrument Serif for quotes
 * - Narrative scroll layout with alternating content blocks and scroll-triggered animations
 * - Interactive charts using Recharts with warm colour palette
 */

import { useEffect, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

// ─── Data ────────────────────────────────────────────────────────────────────

const adoptionData = [
  { sector: "Law Firms", adoption: 80, color: "#1B3A2D" },
  { sector: "Health Clinics", adoption: 72, color: "#2D5A42" },
  { sector: "Real Estate", sector_short: "Real Estate", adoption: 65, color: "#C4552A" },
  { sector: "Accounting", adoption: 61, color: "#E8734A" },
  { sector: "Tradies", adoption: 54, color: "#A8C4B0" },
  { sector: "Restaurants", adoption: 52, color: "#8B6E52" },
  { sector: "Retail", adoption: 48, color: "#D4A574" },
];

const roiData = [
  { name: "Year 1 ROI", value: 5.44, label: "$5.44 per $1 spent" },
  { name: "Cost Savings", value: 20, label: "20% operational cost reduction" },
  { name: "Time Saved", value: 5.6, label: "5.6 hrs/week per employee" },
  { name: "Productivity", value: 66, label: "66% throughput increase" },
];

const timeSavingsData = [
  { role: "Managers", hours: 7.2 },
  { role: "All Employees", hours: 5.6 },
  { role: "Individual Contributors", hours: 3.4 },
];

const aiUsageData = [
  { name: "Chatbots (ChatGPT, Claude)", value: 84 },
  { name: "AI-Powered Search", value: 67 },
  { name: "Image Generators", value: 41 },
  { name: "Learning Tools", value: 30 },
  { name: "Data Analytics", value: 30 },
  { name: "Workflow Automation", value: 19 },
];

const SECTOR_COLORS = ["#C4552A", "#1B3A2D", "#A8C4B0", "#E8734A", "#8B6E52", "#D4A574"];

const sectors = [
  {
    id: "health",
    icon: "🏥",
    title: "Health Clinics",
    subtitle: "Primary care, specialists, allied health",
    color: "#2D5A42",
    bgColor: "#EDF4EF",
    adoption: 72,
    timeSaved: "8–12 hrs/week",
    topUseCase: "Clinical documentation & patient messaging",
    useCases: [
      {
        title: "Clinical Documentation",
        description:
          "AI drafts chart-ready notes from voice dictation or typed summaries. Clinicians review and approve, cutting documentation time by 50–70%.",
        tools: ["Claude", "Nuance DAX", "Suki"],
        impact: "High",
      },
      {
        title: "Patient Messaging & Triage",
        description:
          "AI summarises long patient messages, flags urgency, and drafts initial responses. Reduces inbox burden and cognitive load for practitioners.",
        tools: ["Claude", "ChatGPT", "Healthie"],
        impact: "High",
      },
      {
        title: "Appointment Scheduling",
        description:
          "Automated scheduling bots handle bookings, reminders, and cancellations via SMS/email. Reduces no-show rates by up to 30%.",
        tools: ["Curogram", "Healthie", "Calendly AI"],
        impact: "Medium",
      },
      {
        title: "Patient Education Materials",
        description:
          "Generate plain-language condition explanations, post-visit instructions, and medication guides at a 6th-grade reading level.",
        tools: ["Claude", "ChatGPT"],
        impact: "Medium",
      },
      {
        title: "Prior Authorisation",
        description:
          "AI pre-fills insurance authorisation forms and tracks submission status, reducing admin time from hours to minutes per case.",
        tools: ["Syntora", "Cohere Health"],
        impact: "High",
      },
    ],
    radarData: [
      { subject: "Admin", value: 90 },
      { subject: "Documentation", value: 85 },
      { subject: "Patient Comms", value: 75 },
      { subject: "Scheduling", value: 80 },
      { subject: "Billing", value: 60 },
    ],
    quote:
      "Small practices can use AI in simple, practical ways that save time and reduce workload. You do not need a tech team.",
    quoteSource: "Inside Out Medicine",
    keyStats: ["72% adoption rate in healthcare", "50–70% reduction in documentation time", "30% fewer missed appointments"],
  },
  {
    id: "tradies",
    icon: "🔧",
    title: "Plumbers & Tradies",
    subtitle: "Plumbers, electricians, HVAC, general contractors",
    color: "#C4552A",
    bgColor: "#FDE8DF",
    adoption: 54,
    timeSaved: "5–8 hrs/week",
    topUseCase: "Quoting, invoicing & customer follow-up",
    useCases: [
      {
        title: "AI-Assisted Quoting",
        description:
          "Convert messy site notes into structured scope summaries, suggest common line items, and draft professional quotes in minutes rather than hours.",
        tools: ["Claude", "ChatGPT", "ServiceM8"],
        impact: "High",
      },
      {
        title: "Automated Invoicing",
        description:
          "Generate and send invoices automatically upon job completion. AI matches materials used to price lists and applies correct labour rates.",
        tools: ["Tradify", "Fergus", "ServiceM8 AI"],
        impact: "High",
      },
      {
        title: "Customer Follow-Up Sequences",
        description:
          "Automated 3-touch follow-up after quotes: Day 2 check-in, Day 5 clarification, Day 10 close. Lifts quote conversion rates significantly.",
        tools: ["Claude", "Zapier", "GoHighLevel"],
        impact: "Medium",
      },
      {
        title: "Job Scheduling & Dispatch",
        description:
          "AI optimises technician routing and scheduling based on location, job type, and availability. Reduces drive time and improves daily job capacity.",
        tools: ["ServiceTitan", "Jobber AI"],
        impact: "Medium",
      },
      {
        title: "Marketing & Reviews",
        description:
          "AI drafts Google Business Profile posts, responds to reviews, and generates social media content from job photos and descriptions.",
        tools: ["Claude", "ChatGPT", "Canva AI"],
        impact: "Medium",
      },
    ],
    radarData: [
      { subject: "Quoting", value: 90 },
      { subject: "Invoicing", value: 85 },
      { subject: "Scheduling", value: 70 },
      { subject: "Marketing", value: 60 },
      { subject: "Customer Comms", value: 75 },
    ],
    quote:
      "The real bottleneck in the business isn't the work — it's the admin around the work. AI becomes a co-pilot, not the decision-maker.",
    quoteSource: "ServiceScale Australia",
    keyStats: ["20–30 min saved per quote", "First detailed quote wins the job", "3-touch follow-up lifts conversion rates"],
  },
  {
    id: "carpenters",
    icon: "🪚",
    title: "Carpenters & Builders",
    subtitle: "Cabinet makers, joiners, custom builders, fit-out contractors",
    color: "#8B6E52",
    bgColor: "#F5EDE4",
    adoption: 48,
    timeSaved: "4–7 hrs/week",
    topUseCase: "Project scoping, materials estimation & client communication",
    useCases: [
      {
        title: "Materials Estimation",
        description:
          "AI converts project briefs and measurements into detailed materials lists with quantities, waste factors, and supplier pricing lookups.",
        tools: ["Claude", "ChatGPT", "Buildxact"],
        impact: "High",
      },
      {
        title: "Client Proposal Writing",
        description:
          "Transform rough notes and sketches into polished client proposals with clear scope, inclusions, exclusions, and timeline estimates.",
        tools: ["Claude", "ChatGPT"],
        impact: "High",
      },
      {
        title: "Project Documentation",
        description:
          "Auto-generate site diaries, variation orders, and handover documentation from voice notes taken on-site.",
        tools: ["Claude", "Otter.ai", "Notion AI"],
        impact: "Medium",
      },
      {
        title: "Supplier Communication",
        description:
          "Draft purchase orders, follow up on lead times, and manage supplier correspondence with AI-assisted email drafting.",
        tools: ["Claude", "ChatGPT", "Gmail AI"],
        impact: "Medium",
      },
      {
        title: "Portfolio & Marketing Content",
        description:
          "Generate project case studies, Instagram captions, and website copy from completed job photos and brief descriptions.",
        tools: ["Claude", "ChatGPT", "Canva AI"],
        impact: "Low",
      },
    ],
    radarData: [
      { subject: "Estimation", value: 85 },
      { subject: "Proposals", value: 80 },
      { subject: "Documentation", value: 70 },
      { subject: "Supplier Comms", value: 65 },
      { subject: "Marketing", value: 55 },
    ],
    quote:
      "AI doesn't replace the craftsperson's eye — it handles the paperwork so they can focus on the craft.",
    quoteSource: "Industry Analysis",
    keyStats: ["40% faster project proposals", "Fewer scope disputes with clear documentation", "More time on tools, less on admin"],
  },
  {
    id: "law",
    icon: "⚖️",
    title: "Law Firms",
    subtitle: "Solicitors, barristers, conveyancers, small practices",
    color: "#1B3A2D",
    bgColor: "#EDF4EF",
    adoption: 80,
    timeSaved: "10–15 hrs/week",
    topUseCase: "Legal research, document drafting & contract review",
    useCases: [
      {
        title: "Legal Research",
        description:
          "AI searches case law, statutes, and precedents in seconds. Summarises relevant findings and identifies applicable authorities for any matter.",
        tools: ["Claude", "Westlaw AI", "Clio Work"],
        impact: "High",
      },
      {
        title: "Contract Review & Drafting",
        description:
          "Claude reviews contracts for risk, flags unusual clauses, and drafts first-pass agreements. Lawyers review and refine rather than start from scratch.",
        tools: ["Claude", "Spellbook", "LawGeex"],
        impact: "High",
      },
      {
        title: "Client Intake & Communication",
        description:
          "AI handles initial client queries, collects intake information, and drafts client-friendly summaries of complex legal matters.",
        tools: ["Claude", "Lawmatics", "Clio Grow"],
        impact: "High",
      },
      {
        title: "Document Automation",
        description:
          "Populate court-ready templates with client data automatically. Wills, contracts, pleadings, and correspondence generated in minutes.",
        tools: ["Clio Draft", "HotDocs", "Smokeball"],
        impact: "High",
      },
      {
        title: "Time Recording & Billing",
        description:
          "AI captures billable time from emails, documents, and calendar entries. Reduces write-offs and improves billing accuracy.",
        tools: ["Clio Manage AI", "TimeSolv", "Smokeball"],
        impact: "Medium",
      },
    ],
    radarData: [
      { subject: "Research", value: 95 },
      { subject: "Drafting", value: 90 },
      { subject: "Contract Review", value: 88 },
      { subject: "Client Comms", value: 80 },
      { subject: "Billing", value: 72 },
    ],
    quote:
      "AI adoption in legal has jumped from 22% to 80% in a single year. Firms using AI achieve 4x faster growth.",
    quoteSource: "Clio Legal Trends Report 2025",
    keyStats: ["80% of legal professionals now use AI", "4x faster firm growth with AI", "Contract review time cut by 60–80%"],
  },
  {
    id: "realestate",
    icon: "🏠",
    title: "Real Estate Agents",
    subtitle: "Residential, commercial, property management",
    color: "#E8734A",
    bgColor: "#FEF0E8",
    adoption: 65,
    timeSaved: "6–10 hrs/week",
    topUseCase: "Listing copy, lead qualification & client communication",
    useCases: [
      {
        title: "Listing Descriptions",
        description:
          "Generate compelling property descriptions from bullet-point features and photos. Tailored tone for luxury, family, or investment audiences.",
        tools: ["Claude", "ChatGPT", "Listing AI"],
        impact: "High",
      },
      {
        title: "Lead Qualification & Follow-Up",
        description:
          "AI chatbots qualify incoming leads 24/7, ask pre-qualifying questions, and book inspections automatically.",
        tools: ["Claude", "Structurely", "Follow Up Boss AI"],
        impact: "High",
      },
      {
        title: "Market Reports & CMAs",
        description:
          "Generate suburb market reports and Comparative Market Analyses from data inputs. Professional reports in minutes, not hours.",
        tools: ["Claude", "CoreLogic AI", "RPData"],
        impact: "Medium",
      },
      {
        title: "Email & SMS Campaigns",
        description:
          "Draft personalised email sequences for buyer and vendor nurture campaigns. AI segments audiences and tailors messaging.",
        tools: ["Claude", "Mailchimp AI", "ActiveCampaign"],
        impact: "Medium",
      },
      {
        title: "Contract & Compliance Review",
        description:
          "AI flags unusual contract clauses, missing conditions, and compliance issues before settlement. Reduces risk and errors.",
        tools: ["Claude", "Spellbook"],
        impact: "Medium",
      },
    ],
    radarData: [
      { subject: "Listings", value: 90 },
      { subject: "Lead Gen", value: 85 },
      { subject: "Market Reports", value: 75 },
      { subject: "Campaigns", value: 70 },
      { subject: "Compliance", value: 60 },
    ],
    quote:
      "AI-powered agents respond to leads 5x faster and convert at significantly higher rates than those relying on manual follow-up.",
    quoteSource: "Real Estate AI Research 2025",
    keyStats: ["5x faster lead response", "65% of agents now using AI tools", "Listing copy in 2 minutes vs 45 minutes"],
  },
  {
    id: "accounting",
    icon: "📊",
    title: "Accountants & Bookkeepers",
    subtitle: "Tax agents, BAS agents, financial advisers, bookkeepers",
    color: "#6B7C6E",
    bgColor: "#EDF4EF",
    adoption: 61,
    timeSaved: "7–12 hrs/week",
    topUseCase: "Bookkeeping automation, tax preparation & client reporting",
    useCases: [
      {
        title: "Automated Bookkeeping",
        description:
          "AI categorises transactions, reconciles accounts, and flags anomalies automatically. Reduces manual data entry by 80–90%.",
        tools: ["Xero AI", "QuickBooks AI", "Botkeeper"],
        impact: "High",
      },
      {
        title: "Tax Preparation Assistance",
        description:
          "AI extracts data from receipts, invoices, and bank feeds to pre-populate tax returns. Flags deduction opportunities and compliance risks.",
        tools: ["Claude", "TaxAssist AI", "Keeper"],
        impact: "High",
      },
      {
        title: "Client Financial Reports",
        description:
          "Generate plain-language financial summaries and insights from raw data. Clients receive readable reports, not just spreadsheets.",
        tools: ["Claude", "Fathom", "Spotlight Reporting"],
        impact: "High",
      },
      {
        title: "Document Processing",
        description:
          "AI extracts structured data from invoices, receipts, and contracts. Eliminates manual data entry for document-heavy workflows.",
        tools: ["Claude API", "Dext", "AutoEntry"],
        impact: "High",
      },
      {
        title: "Client Communication",
        description:
          "Draft client emails, meeting summaries, and advisory letters. AI maintains professional tone while personalising content.",
        tools: ["Claude", "ChatGPT"],
        impact: "Medium",
      },
    ],
    radarData: [
      { subject: "Bookkeeping", value: 92 },
      { subject: "Tax Prep", value: 85 },
      { subject: "Reporting", value: 88 },
      { subject: "Document Processing", value: 90 },
      { subject: "Client Comms", value: 70 },
    ],
    quote:
      "AI reduces manual data entry by up to 90% in bookkeeping workflows, freeing accountants to focus on advisory work.",
    quoteSource: "Accounting AI Research 2025",
    keyStats: ["80–90% reduction in data entry", "61% of accounting firms using AI", "Advisory hours up 40% as admin drops"],
  },
];

const implementationSteps = [
  {
    step: "01",
    title: "Identify Your Biggest Time Drains",
    description:
      "Start by auditing where your team spends the most time on repetitive, low-judgment tasks. Common candidates: email drafting, document creation, scheduling, data entry, and customer follow-up.",
    icon: "🔍",
  },
  {
    step: "02",
    title: "Choose One Workflow to Start",
    description:
      "Resist the urge to automate everything at once. Pick a single, well-defined workflow with clear inputs and outputs. Prove ROI there before expanding.",
    icon: "🎯",
  },
  {
    step: "03",
    title: "Select the Right Tool",
    description:
      "For most small businesses, starting with Claude or ChatGPT directly is sufficient. For more complex automation, tools like Zapier, Make, or n8n connect AI to your existing software.",
    icon: "🛠️",
  },
  {
    step: "04",
    title: "Build a Repeatable Prompt Library",
    description:
      "Document the prompts and instructions that work well for your business. A shared prompt library ensures consistency and lets any team member use AI effectively.",
    icon: "📚",
  },
  {
    step: "05",
    title: "Train Your Team",
    description:
      "AI adoption fails without buy-in. Run short workshops showing staff how AI assists rather than replaces their work. Focus on time savings and quality improvements.",
    icon: "👥",
  },
  {
    step: "06",
    title: "Measure, Iterate & Expand",
    description:
      "Track time saved, error rates, and team satisfaction. Use this data to justify expanding AI to additional workflows. Most businesses see clear ROI within 90 days.",
    icon: "📈",
  },
];

const additionalSectors = [
  { icon: "🍽️", title: "Restaurants & Cafés", uses: ["Menu optimisation", "Inventory forecasting", "Review responses", "Staff scheduling"] },
  { icon: "🛍️", title: "Retail Businesses", uses: ["Product descriptions", "Customer service chatbots", "Inventory management", "Email campaigns"] },
  { icon: "💇", title: "Beauty & Wellness", uses: ["Appointment booking", "Client follow-up", "Social media content", "Loyalty programs"] },
  { icon: "🚚", title: "Logistics & Transport", uses: ["Route optimisation", "Invoice processing", "Customer tracking updates", "Compliance docs"] },
  { icon: "🎓", title: "Education & Tutoring", uses: ["Lesson plan creation", "Student progress reports", "Parent communication", "Content generation"] },
  { icon: "🏗️", title: "Construction & Engineering", uses: ["Project documentation", "Safety compliance", "Tender writing", "Progress reporting"] },
];

// ─── Utility hooks ────────────────────────────────────────────────────────────

function useIntersectionObserver(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}

function useCountUp(target: number, duration = 1500, isVisible: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isVisible) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration, isVisible]);
  return count;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCounter({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { ref, isVisible } = useIntersectionObserver();
  const count = useCountUp(value, 1200, isVisible);
  return (
    <div ref={ref} className="stat-card text-center">
      <div className="font-display text-5xl font-black mb-1" style={{ color: "#C4552A" }}>
        {count}{suffix}
      </div>
      <div className="font-body text-sm font-medium" style={{ color: "#6B7C6E" }}>
        {label}
      </div>
    </div>
  );
}

function FadeSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, isVisible } = useIntersectionObserver();
  return (
    <div
      ref={ref}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function SectorCard({ sector }: { sector: typeof sectors[0] }) {
  const [activeTab, setActiveTab] = useState<"usecases" | "chart">("usecases");
  const { ref, isVisible } = useIntersectionObserver();

  return (
    <div ref={ref} className="sector-card" style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? "translateY(0)" : "translateY(32px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}>
      {/* Header */}
      <div className="p-6 pb-4" style={{ background: sector.bgColor, borderBottom: `3px solid ${sector.color}` }}>
        <div className="flex items-start justify-between mb-3">
          <div className="text-4xl">{sector.icon}</div>
          <span className="terracotta-tag" style={{ background: `${sector.color}18`, color: sector.color }}>
            {sector.adoption}% adoption
          </span>
        </div>
        <h3 className="font-display text-2xl font-bold mb-1" style={{ color: sector.color }}>
          {sector.title}
        </h3>
        <p className="font-body text-sm" style={{ color: "#6B7C6E" }}>{sector.subtitle}</p>
        <div className="mt-3 flex gap-4 text-sm font-body">
          <span style={{ color: sector.color }}>⏱ {sector.timeSaved} saved</span>
          <span style={{ color: "#6B7C6E" }}>Top: {sector.topUseCase}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: "#E0D8CC" }}>
        {(["usecases", "chart"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-3 text-sm font-semibold font-body transition-colors"
            style={{
              color: activeTab === tab ? sector.color : "#6B7C6E",
              borderBottom: activeTab === tab ? `2px solid ${sector.color}` : "2px solid transparent",
              background: "transparent",
            }}
          >
            {tab === "usecases" ? "Use Cases" : "AI Readiness"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === "usecases" ? (
          <div className="space-y-4">
            {sector.useCases.map((uc, i) => (
              <div key={i} className="flex gap-3">
                <div
                  className="w-2 rounded-full flex-shrink-0 mt-1"
                  style={{ background: sector.color, minHeight: "100%", height: "auto", alignSelf: "stretch", minWidth: "3px", maxWidth: "3px" }}
                />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-body font-bold text-sm" style={{ color: "#1B3A2D" }}>{uc.title}</span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-body font-semibold"
                      style={{
                        background: uc.impact === "High" ? "#FDE8DF" : uc.impact === "Medium" ? "#EDF4EF" : "#F5EDE4",
                        color: uc.impact === "High" ? "#C4552A" : uc.impact === "Medium" ? "#2D5A42" : "#8B6E52",
                      }}
                    >
                      {uc.impact} impact
                    </span>
                  </div>
                  <p className="font-body text-sm leading-relaxed" style={{ color: "#4A5E50" }}>{uc.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {uc.tools.map((t) => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded font-body" style={{ background: "#F0EBE3", color: "#6B7C6E" }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <p className="font-body text-sm mb-4" style={{ color: "#6B7C6E" }}>AI readiness score by workflow area</p>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={sector.radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="#E0D8CC" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fontFamily: "Nunito", fill: "#6B7C6E" }} />
                <Radar name={sector.title} dataKey="value" stroke={sector.color} fill={sector.color} fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {sector.keyStats.map((stat, i) => (
                <div key={i} className="flex items-center gap-2 text-sm font-body">
                  <span style={{ color: sector.color }}>✓</span>
                  <span style={{ color: "#1B3A2D" }}>{stat}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quote */}
      <div className="px-6 pb-6">
        <blockquote className="border-l-4 pl-4 py-2" style={{ borderColor: sector.color, background: sector.bgColor, borderRadius: "0 8px 8px 0" }}>
          <p className="font-quote italic text-sm leading-relaxed" style={{ color: "#1B3A2D" }}>"{sector.quote}"</p>
          <cite className="font-body text-xs mt-1 block" style={{ color: "#6B7C6E" }}>— {sector.quoteSource}</cite>
        </blockquote>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const heroRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const filteredSectors = activeFilter === "all" ? sectors : sectors.filter((s) => s.id === activeFilter);

  return (
    <div className="min-h-screen" style={{ background: "#FBF7F0", fontFamily: "Nunito, sans-serif" }}>
      {/* ── Navigation ── */}
      <nav
        className="sticky top-0 z-50 border-b"
        style={{
          background: "rgba(251, 247, 240, 0.95)",
          backdropFilter: "blur(12px)",
          borderColor: "#E0D8CC",
        }}
      >
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ background: "#1B3A2D" }}>
              AI
            </div>
            <span className="font-display font-semibold text-lg" style={{ color: "#1B3A2D" }}>
              AI for Business
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-body font-medium" style={{ color: "#6B7C6E" }}>
            <a href="#overview" className="hover:text-[#C4552A] transition-colors">Overview</a>
            <a href="#sectors" className="hover:text-[#C4552A] transition-colors">By Sector</a>
            <a href="#implementation" className="hover:text-[#C4552A] transition-colors">How to Start</a>
            <a href="#more-sectors" className="hover:text-[#C4552A] transition-colors">More Sectors</a>
          </div>
          <a
            href="#sectors"
            className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold font-body text-white transition-all hover:opacity-90"
            style={{ background: "#C4552A" }}
          >
            Explore Sectors →
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden"
        style={{ minHeight: "90vh", display: "flex", alignItems: "center" }}
      >
        {/* Background image with parallax */}
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/hero-ai-business-gKnxbKf6EDCBky6v4TdzpA.webp)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            transform: `translateY(${scrollY * 0.3}px)`,
            filter: "brightness(0.35)",
          }}
        />
        {/* Gradient overlay */}
        <div
          className="absolute inset-0 z-0"
          style={{ background: "linear-gradient(135deg, rgba(27,58,45,0.7) 0%, rgba(196,85,42,0.3) 100%)" }}
        />

        <div className="container relative z-10 py-24">
          <div className="max-w-3xl">
            <FadeSection>
              <span className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold font-body mb-6" style={{ background: "rgba(196,85,42,0.9)", color: "#FBF7F0" }}>
                2025–2026 Research Report
              </span>
            </FadeSection>
            <FadeSection delay={100}>
              <h1 className="font-display text-5xl md:text-7xl font-black leading-tight mb-6" style={{ color: "#FBF7F0" }}>
                AI for Every
                <br />
                <span style={{ color: "#E8734A" }}>Business</span>
              </h1>
            </FadeSection>
            <FadeSection delay={200}>
              <p className="font-body text-xl leading-relaxed mb-8 max-w-2xl" style={{ color: "rgba(251,247,240,0.85)" }}>
                A practical guide to implementing Claude and other AI tools across health clinics, trades, law firms, and beyond. Real use cases, real ROI, and a clear path to getting started.
              </p>
            </FadeSection>
            <FadeSection delay={300}>
              <div className="flex flex-wrap gap-4">
                <a
                  href="#sectors"
                  className="px-6 py-3 rounded-lg font-semibold font-body text-white transition-all hover:opacity-90 hover:-translate-y-0.5"
                  style={{ background: "#C4552A" }}
                >
                  Explore by Sector
                </a>
                <a
                  href="#implementation"
                  className="px-6 py-3 rounded-lg font-semibold font-body transition-all hover:opacity-90 hover:-translate-y-0.5"
                  style={{ background: "rgba(251,247,240,0.15)", color: "#FBF7F0", border: "1px solid rgba(251,247,240,0.3)", backdropFilter: "blur(8px)" }}
                >
                  How to Get Started
                </a>
              </div>
            </FadeSection>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2" style={{ color: "rgba(251,247,240,0.6)" }}>
          <span className="text-xs font-body">Scroll to explore</span>
          <div className="w-0.5 h-8 rounded-full" style={{ background: "rgba(251,247,240,0.4)", animation: "pulse 2s infinite" }} />
        </div>
      </section>

      {/* ── Key Statistics ── */}
      <section id="overview" className="py-20" style={{ background: "#FBF7F0" }}>
        <div className="container">
          <FadeSection>
            <div className="text-center mb-12">
              <span className="terracotta-tag mb-4 inline-block">By the Numbers</span>
              <h2 className="font-display text-4xl md:text-5xl font-bold mt-3" style={{ color: "#1B3A2D" }}>
                The AI Opportunity for Small Business
              </h2>
              <p className="font-body text-lg mt-4 max-w-2xl mx-auto" style={{ color: "#6B7C6E" }}>
                AI adoption among small and medium businesses has surged from 36% in 2023 to 57% in 2025 — and the businesses leading the charge are seeing measurable returns.
              </p>
            </div>
          </FadeSection>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
            <StatCounter value={57} suffix="%" label="of SMBs investing in AI (2025)" />
            <StatCounter value={5} suffix=".6h" label="saved per employee per week" />
            <StatCounter value={5} suffix=".44x" label="ROI per dollar spent on AI" />
            <StatCounter value={84} suffix="%" label="of SMB workers use AI chatbots" />
          </div>

          {/* AI Adoption by Sector Chart */}
          <FadeSection>
            <div className="stat-card mb-8">
              <h3 className="font-display text-2xl font-bold mb-2" style={{ color: "#1B3A2D" }}>AI Adoption Rate by Business Sector</h3>
              <p className="font-body text-sm mb-6" style={{ color: "#6B7C6E" }}>Percentage of businesses actively using AI tools in their workflows (2025)</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={adoptionData} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0D8CC" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fontFamily: "Nunito", fill: "#6B7C6E" }} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="sector" tick={{ fontSize: 12, fontFamily: "Nunito", fill: "#1B3A2D" }} width={80} />
                  <Tooltip
                    formatter={(value) => [`${value}%`, "Adoption Rate"]}
                    contentStyle={{ fontFamily: "Nunito", background: "#FBF7F0", border: "1px solid #E0D8CC", borderRadius: "8px" }}
                  />
                  <Bar dataKey="adoption" radius={[0, 6, 6, 0]}>
                    {adoptionData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </FadeSection>

          {/* Time Savings & AI Usage Charts */}
          <div className="grid md:grid-cols-2 gap-6">
            <FadeSection>
              <div className="stat-card h-full">
                <h3 className="font-display text-xl font-bold mb-2" style={{ color: "#1B3A2D" }}>Weekly Time Saved Using AI</h3>
                <p className="font-body text-sm mb-4" style={{ color: "#6B7C6E" }}>Hours saved per week by role (2026 SMB Survey)</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={timeSavingsData} margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E0D8CC" vertical={false} />
                    <XAxis dataKey="role" tick={{ fontSize: 11, fontFamily: "Nunito", fill: "#6B7C6E" }} />
                    <YAxis tick={{ fontSize: 11, fontFamily: "Nunito", fill: "#6B7C6E" }} tickFormatter={(v) => `${v}h`} />
                    <Tooltip
                      formatter={(value) => [`${value} hours/week`, "Time Saved"]}
                      contentStyle={{ fontFamily: "Nunito", background: "#FBF7F0", border: "1px solid #E0D8CC", borderRadius: "8px" }}
                    />
                    <Bar dataKey="hours" fill="#1B3A2D" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </FadeSection>

            <FadeSection delay={100}>
              <div className="stat-card h-full">
                <h3 className="font-display text-xl font-bold mb-2" style={{ color: "#1B3A2D" }}>Most Used AI Tools by SMBs</h3>
                <p className="font-body text-sm mb-4" style={{ color: "#6B7C6E" }}>% of SMB employees using each tool type in the past year</p>
                <div className="space-y-3">
                  {aiUsageData.map((item, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-sm font-body mb-1">
                        <span style={{ color: "#1B3A2D" }}>{item.name}</span>
                        <span className="font-semibold" style={{ color: "#C4552A" }}>{item.value}%</span>
                      </div>
                      <div className="progress-bar-bg">
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: `${item.value}%`,
                            background: i === 0 ? "#C4552A" : i === 1 ? "#1B3A2D" : i === 2 ? "#E8734A" : "#A8C4B0",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeSection>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div style={{ height: "3px", background: "linear-gradient(to right, transparent, #C4552A 30%, #1B3A2D 70%, transparent)" }} />

      {/* ── Sector Deep Dives ── */}
      <section id="sectors" className="py-20" style={{ background: "#F5F0E8" }}>
        <div className="container">
          <FadeSection>
            <div className="text-center mb-10">
              <span className="terracotta-tag mb-4 inline-block">Sector Analysis</span>
              <h2 className="font-display text-4xl md:text-5xl font-bold mt-3" style={{ color: "#1B3A2D" }}>
                AI Use Cases by Industry
              </h2>
              <p className="font-body text-lg mt-4 max-w-2xl mx-auto" style={{ color: "#6B7C6E" }}>
                Explore how AI can transform specific workflows in each business type — from quick wins to transformative automation.
              </p>
            </div>
          </FadeSection>

          {/* Filter tabs */}
          <FadeSection>
            <div className="flex flex-wrap justify-center gap-2 mb-10">
              <button
                onClick={() => setActiveFilter("all")}
                className="px-4 py-2 rounded-full text-sm font-semibold font-body transition-all"
                style={{
                  background: activeFilter === "all" ? "#1B3A2D" : "#FFFFFF",
                  color: activeFilter === "all" ? "#FBF7F0" : "#6B7C6E",
                  border: "1px solid #E0D8CC",
                }}
              >
                All Sectors
              </button>
              {sectors.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveFilter(s.id)}
                  className="px-4 py-2 rounded-full text-sm font-semibold font-body transition-all"
                  style={{
                    background: activeFilter === s.id ? s.color : "#FFFFFF",
                    color: activeFilter === s.id ? "#FBF7F0" : "#6B7C6E",
                    border: "1px solid #E0D8CC",
                  }}
                >
                  {s.icon} {s.title.split(" ")[0]}
                </button>
              ))}
            </div>
          </FadeSection>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredSectors.map((sector) => (
              <SectorCard key={sector.id} sector={sector} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div style={{ height: "3px", background: "linear-gradient(to right, transparent, #1B3A2D 30%, #C4552A 70%, transparent)" }} />

      {/* ── Implementation Steps ── */}
      <section id="implementation" className="py-20" style={{ background: "#FBF7F0" }}>
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <FadeSection>
              <div>
                <span className="terracotta-tag mb-4 inline-block">Getting Started</span>
                <h2 className="font-display text-4xl md:text-5xl font-bold mt-3 mb-6" style={{ color: "#1B3A2D" }}>
                  How to Implement AI in Your Business
                </h2>
                <p className="font-body text-lg leading-relaxed mb-6" style={{ color: "#4A5E50" }}>
                  Most AI implementations fail not because the technology doesn't work, but because businesses try to do too much at once. The most successful small businesses start small, prove value, and expand systematically.
                </p>
                <blockquote className="border-l-4 pl-5 py-3 mb-6" style={{ borderColor: "#C4552A", background: "#FDE8DF", borderRadius: "0 12px 12px 0" }}>
                  <p className="font-quote italic text-lg leading-relaxed" style={{ color: "#1B3A2D" }}>
                    "Start by implementing AI in a single domain, ensuring it demonstrates ROI and meets business objectives before expanding to other areas."
                  </p>
                  <cite className="font-body text-sm mt-2 block" style={{ color: "#6B7C6E" }}>— Forbes Business Council</cite>
                </blockquote>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { value: "90", suffix: "%", label: "see ROI within 1 year" },
                    { value: "29", suffix: "–72%", label: "productivity increase" },
                    { value: "10", suffix: "h+", label: "saved per week" },
                  ].map((s, i) => (
                    <div key={i} className="text-center p-3 rounded-xl" style={{ background: "#F0EBE3" }}>
                      <div className="font-display text-2xl font-black" style={{ color: "#C4552A" }}>{s.value}<span className="text-lg">{s.suffix}</span></div>
                      <div className="font-body text-xs mt-1" style={{ color: "#6B7C6E" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeSection>

            <div>
              <div
                className="rounded-2xl overflow-hidden mb-6"
                style={{ boxShadow: "0 8px 32px rgba(27,58,45,0.12)" }}
              >
                <img
                  src="https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/implementation-steps-MKkyq8R5TjZJC6xSKh9EeJ.webp"
                  alt="AI workflow transformation: before and after"
                  className="w-full h-64 object-cover"
                />
              </div>
            </div>
          </div>

          {/* Steps grid */}
          <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {implementationSteps.map((step, i) => (
              <FadeSection key={i} delay={i * 80}>
                <div className="stat-card h-full">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: "#F0EBE3" }}
                    >
                      {step.icon}
                    </div>
                    <div>
                      <div className="font-display text-xs font-bold mb-1" style={{ color: "#C4552A" }}>STEP {step.step}</div>
                      <h3 className="font-display text-lg font-bold mb-2" style={{ color: "#1B3A2D" }}>{step.title}</h3>
                      <p className="font-body text-sm leading-relaxed" style={{ color: "#4A5E50" }}>{step.description}</p>
                    </div>
                  </div>
                </div>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div style={{ height: "3px", background: "linear-gradient(to right, transparent, #C4552A 30%, #1B3A2D 70%, transparent)" }} />

      {/* ── More Sectors ── */}
      <section id="more-sectors" className="py-20" style={{ background: "#F5F0E8" }}>
        <div className="container">
          <FadeSection>
            <div className="text-center mb-12">
              <span className="terracotta-tag mb-4 inline-block">Beyond the Core Five</span>
              <h2 className="font-display text-4xl md:text-5xl font-bold mt-3" style={{ color: "#1B3A2D" }}>
                More Businesses Ready for AI
              </h2>
              <p className="font-body text-lg mt-4 max-w-2xl mx-auto" style={{ color: "#6B7C6E" }}>
                Almost every service business has repetitive workflows that AI can streamline. Here are additional sectors with strong AI implementation potential.
              </p>
            </div>
          </FadeSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {additionalSectors.map((sector, i) => (
              <FadeSection key={i} delay={i * 60}>
                <div className="stat-card h-full">
                  <div className="text-3xl mb-3">{sector.icon}</div>
                  <h3 className="font-display text-xl font-bold mb-3" style={{ color: "#1B3A2D" }}>{sector.title}</h3>
                  <div className="space-y-2">
                    {sector.uses.map((use, j) => (
                      <div key={j} className="flex items-center gap-2 text-sm font-body">
                        <span style={{ color: "#C4552A", fontSize: "10px" }}>◆</span>
                        <span style={{ color: "#4A5E50" }}>{use}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div style={{ height: "3px", background: "linear-gradient(to right, transparent, #1B3A2D 50%, transparent)" }} />

      {/* ── Claude & Tools Section ── */}
      <section className="py-20" style={{ background: "#1B3A2D" }}>
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <FadeSection>
              <div>
                <span className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold font-body mb-4" style={{ background: "rgba(196,85,42,0.3)", color: "#E8734A" }}>
                  Recommended Tools
                </span>
                <h2 className="font-display text-4xl font-bold mb-6" style={{ color: "#FBF7F0" }}>
                  Why Claude is the Right Starting Point
                </h2>
                <p className="font-body text-lg leading-relaxed mb-6" style={{ color: "rgba(251,247,240,0.8)" }}>
                  Claude by Anthropic is purpose-built for business use — with strong performance on document analysis, long-form writing, and nuanced reasoning. It's the preferred choice for law firms, healthcare, and any business handling sensitive information.
                </p>
                <div className="space-y-4">
                  {[
                    { icon: "📄", title: "Document Analysis", desc: "Review contracts, medical records, and lengthy documents with exceptional accuracy" },
                    { icon: "✍️", title: "Professional Writing", desc: "Drafts that match your tone — from legal briefs to patient letters to trade quotes" },
                    { icon: "🔒", title: "Safety & Reliability", desc: "Designed with Constitutional AI principles — less likely to hallucinate or produce harmful outputs" },
                    { icon: "🔌", title: "API Integration", desc: "Connect Claude to your existing tools via API — CRMs, practice management, job management software" },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4 p-4 rounded-xl" style={{ background: "rgba(251,247,240,0.05)" }}>
                      <span className="text-2xl">{item.icon}</span>
                      <div>
                        <div className="font-display font-bold text-sm mb-1" style={{ color: "#FBF7F0" }}>{item.title}</div>
                        <div className="font-body text-sm" style={{ color: "rgba(251,247,240,0.7)" }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeSection>

            <FadeSection delay={100}>
              <div>
                <h3 className="font-display text-2xl font-bold mb-6" style={{ color: "#FBF7F0" }}>The AI Tool Stack for SMBs</h3>
                <div className="space-y-4">
                  {[
                    { category: "AI Assistants", tools: ["Claude (Anthropic)", "ChatGPT (OpenAI)", "Gemini (Google)"], color: "#C4552A" },
                    { category: "Workflow Automation", tools: ["Zapier", "Make (Integromat)", "n8n"], color: "#E8734A" },
                    { category: "Industry-Specific", tools: ["Clio (Legal)", "Tradify / ServiceM8 (Trades)", "Healthie (Health)"], color: "#A8C4B0" },
                    { category: "Document Processing", tools: ["Claude API", "Dext", "AutoEntry"], color: "#D4A574" },
                    { category: "Customer Communication", tools: ["Intercom AI", "Tidio", "Freshdesk AI"], color: "#8B9E90" },
                  ].map((cat, i) => (
                    <div key={i} className="p-4 rounded-xl" style={{ background: "rgba(251,247,240,0.06)", border: `1px solid ${cat.color}40` }}>
                      <div className="font-body text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: cat.color }}>{cat.category}</div>
                      <div className="flex flex-wrap gap-2">
                        {cat.tools.map((tool) => (
                          <span key={tool} className="text-sm px-3 py-1 rounded-full font-body" style={{ background: "rgba(251,247,240,0.1)", color: "rgba(251,247,240,0.85)" }}>
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeSection>
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="py-20 relative overflow-hidden" style={{ background: "#FBF7F0" }}>
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url(https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/stats-bg-Mz8ibsLKHyNHmN7VqsHKf9.webp)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="container relative z-10">
          <FadeSection>
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-6" style={{ color: "#1B3A2D" }}>
                Ready to Help Businesses Implement AI?
              </h2>
              <p className="font-body text-xl leading-relaxed mb-8" style={{ color: "#4A5E50" }}>
                The businesses that start now — even with a single workflow — will compound their advantage over the next five years. The technology is accessible, the ROI is proven, and the barrier to entry has never been lower.
              </p>
              <div className="grid sm:grid-cols-3 gap-4 mb-10">
                {[
                  { icon: "🎯", title: "Start Small", desc: "One workflow, one tool, one team" },
                  { icon: "📊", title: "Measure Everything", desc: "Time saved, errors reduced, revenue gained" },
                  { icon: "🚀", title: "Scale What Works", desc: "Expand to adjacent workflows systematically" },
                ].map((item, i) => (
                  <div key={i} className="p-5 rounded-2xl text-center" style={{ background: "rgba(27,58,45,0.06)", border: "1px solid #E0D8CC" }}>
                    <div className="text-3xl mb-2">{item.icon}</div>
                    <div className="font-display font-bold mb-1" style={{ color: "#1B3A2D" }}>{item.title}</div>
                    <div className="font-body text-sm" style={{ color: "#6B7C6E" }}>{item.desc}</div>
                  </div>
                ))}
              </div>
              <p className="font-body text-sm" style={{ color: "#8B9E90" }}>
                Research compiled from McKinsey, Clio Legal Trends Report, Business.com SMB AI Outlook, ServiceScale Australia, Inside Out Medicine, and Deloitte AI Research (2024–2026).
              </p>
            </div>
          </FadeSection>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 border-t" style={{ background: "#1B3A2D", borderColor: "rgba(251,247,240,0.1)" }}>
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ background: "#C4552A" }}>
                AI
              </div>
              <span className="font-display font-semibold" style={{ color: "#FBF7F0" }}>AI for Business Report</span>
            </div>
            <p className="font-body text-sm text-center" style={{ color: "rgba(251,247,240,0.5)" }}>
              Research compiled April 2026 · Data from McKinsey, Clio, Business.com, Deloitte & industry sources
            </p>
            <div className="flex gap-4 text-sm font-body" style={{ color: "rgba(251,247,240,0.5)" }}>
              <a href="#overview" className="hover:text-white transition-colors">Overview</a>
              <a href="#sectors" className="hover:text-white transition-colors">Sectors</a>
              <a href="#implementation" className="hover:text-white transition-colors">How to Start</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
