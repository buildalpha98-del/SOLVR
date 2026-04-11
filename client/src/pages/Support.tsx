/**
 * Support page — solvr.com.au/support
 * Required for Apple App Store submission (support URL field).
 * Includes FAQ accordion and a contact form that submits to Solvr support.
 */
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp, CheckCircle2, Loader2, MessageSquare, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

// ─── FAQ Data ─────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "How do I log in to my Solvr portal?",
    a: "You will have received a portal login email from Solvr when your account was set up. Use the email address and password from that email. If you've forgotten your password, use the 'Forgot password?' link on the login page to reset it.",
  },
  {
    q: "How do I access my call recordings?",
    a: "Log in to your portal at solvr.com.au/portal/login, then navigate to the Calls section. All calls handled by your AI receptionist are listed there with recordings, transcripts, and extracted job details.",
  },
  {
    q: "How do I create a quote from a call?",
    a: "After a call is captured, open the job card and tap 'Create a Quote from this Job'. The quote form will pre-fill with the caller's details. You can then add line items, adjust pricing, and send the quote directly to the customer.",
  },
  {
    q: "How do I update my AI receptionist's script or business details?",
    a: "Go to Settings in your portal and update your Business Profile. Changes to your business name, services, and contact details are reflected in your AI receptionist's responses. For script changes, contact Solvr support.",
  },
  {
    q: "How do I cancel my subscription?",
    a: "Go to Billing in your portal and click 'Manage Billing'. This opens the Stripe customer portal where you can cancel or modify your subscription. Alternatively, contact us at hello@solvr.com.au.",
  },
  {
    q: "How do I request deletion of my account and data?",
    a: "Go to Settings in your portal and scroll to the 'Delete My Account' section. Click 'Request Account Deletion' and confirm. We will action your request within 30 days in accordance with the Australian Privacy Act 1988.",
  },
  {
    q: "The AI receptionist gave incorrect information to a caller. What do I do?",
    a: "Contact us immediately at hello@solvr.com.au with the call details. We will review the transcript and update your AI receptionist's configuration to prevent recurrence.",
  },
  {
    q: "How do I refer another tradie and earn a discount?",
    a: "Go to your portal Dashboard and find the Referral Programme card. Copy your unique referral link and share it with other tradies. When they sign up and make their first payment, you automatically receive a 20% discount on your next invoice.",
  },
];

// ─── FAQ Item ─────────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border-b cursor-pointer select-none"
      style={{ borderColor: "rgba(255,255,255,0.08)" }}
      onClick={() => setOpen(!open)}
    >
      <div className="flex items-center justify-between py-4 gap-4">
        <p className="text-sm font-medium text-white pr-2">{q}</p>
        {open
          ? <ChevronUp className="w-4 h-4 shrink-0" style={{ color: "#F5A623" }} />
          : <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "rgba(255,255,255,0.4)" }} />
        }
      </div>
      {open && (
        <p className="text-sm pb-4 leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
          {a}
        </p>
      )}
    </div>
  );
}

// ─── Contact Form ─────────────────────────────────────────────────────────────
function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitSupport = trpc.support.submitRequest.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setName(""); setEmail(""); setSubject(""); setMessage("");
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || "Failed to send message. Please email hello@solvr.com.au directly.");
    },
  });

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle2 className="w-12 h-12 mb-4" style={{ color: "#F5A623" }} />
        <h3 className="text-lg font-semibold text-white mb-2">Message sent!</h3>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
          We'll get back to you within 1 business day at {email || "your email address"}.
        </p>
        <Button
          variant="outline"
          className="mt-6 border-white/20 text-white/60 hover:bg-white/5"
          onClick={() => setSubmitted(false)}
        >
          Send another message
        </Button>
      </div>
    );
  }

  const inputStyle = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#fff",
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submitSupport.mutate({ name, email, subject, message });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-white/70 text-sm">Your name</Label>
          <Input
            required
            placeholder="Jake Smith"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-white/70 text-sm">Email address</Label>
          <Input
            required
            type="email"
            placeholder="jake@jakesplumbing.com.au"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-white/70 text-sm">Subject</Label>
        <Input
          required
          placeholder="e.g. Can't log in to my portal"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-white/70 text-sm">Message</Label>
        <Textarea
          required
          rows={5}
          placeholder="Describe your issue or question in as much detail as possible..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={inputStyle}
          className="resize-none"
        />
      </div>
      <Button
        type="submit"
        disabled={submitSupport.isPending || !name || !email || !subject || !message}
        className="w-full font-semibold"
        style={{ background: "#F5A623", color: "#0F1F3D" }}
      >
        {submitSupport.isPending ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>
        ) : (
          "Send Message"
        )}
      </Button>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Support() {
  return (
    <div className="min-h-screen" style={{ background: "#0F1F3D", color: "#fff" }}>
      {/* Nav */}
      <nav className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <Link href="/">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663504638120/Z8bJhRXA3QRL3p7wZFW5Yt/solvr-logo-dark-3m4hMtZ3cT8T4cayJyuAzG.webp"
            alt="Solvr"
            className="h-8 cursor-pointer"
          />
        </Link>
        <Link href="/portal/login">
          <Button
            variant="outline"
            size="sm"
            className="border-white/20 text-white/70 hover:bg-white/5 text-xs"
          >
            Portal Login
          </Button>
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-14">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-5"
            style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.2)" }}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Support Centre
          </div>
          <h1 className="text-4xl font-bold mb-4" style={{ fontFamily: "Syne, sans-serif" }}>
            How can we help?
          </h1>
          <p className="text-base max-w-lg mx-auto" style={{ color: "rgba(255,255,255,0.55)" }}>
            Find answers to common questions below, or send us a message and we'll get back to you within 1 business day.
          </p>
        </div>

        {/* Contact methods */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-14">
          <div
            className="rounded-xl p-5 flex items-center gap-4"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(245,166,35,0.12)" }}>
              <Mail className="w-5 h-5" style={{ color: "#F5A623" }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Email support</p>
              <a href="mailto:hello@solvr.com.au" className="text-sm" style={{ color: "#F5A623" }}>
                hello@solvr.com.au
              </a>
            </div>
          </div>
          <div
            className="rounded-xl p-5 flex items-center gap-4"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(245,166,35,0.12)" }}>
              <Phone className="w-5 h-5" style={{ color: "#F5A623" }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Response time</p>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>Within 1 business day (AEST)</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* FAQ */}
          <div>
            <h2 className="text-xl font-bold text-white mb-6">Frequently asked questions</h2>
            <div>
              {FAQS.map((faq, i) => (
                <FaqItem key={i} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>

          {/* Contact form */}
          <div>
            <h2 className="text-xl font-bold text-white mb-6">Send us a message</h2>
            <div
              className="rounded-xl p-6"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <ContactForm />
            </div>
          </div>
        </div>

        {/* Footer links */}
        <div className="flex justify-center gap-6 mt-16 pt-8 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <Link href="/privacy">
            <span className="text-xs cursor-pointer transition-colors" style={{ color: "rgba(255,255,255,0.3)" }}>
              Privacy Policy
            </span>
          </Link>
          <Link href="/terms">
            <span className="text-xs cursor-pointer transition-colors" style={{ color: "rgba(255,255,255,0.3)" }}>
              Terms of Service
            </span>
          </Link>
          <Link href="/">
            <span className="text-xs cursor-pointer transition-colors" style={{ color: "rgba(255,255,255,0.3)" }}>
              solvr.com.au
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
