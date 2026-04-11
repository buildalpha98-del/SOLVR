import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AnnouncementBanner from "./components/AnnouncementBanner";
import Home from "./pages/Home";
import LawFirms from "./pages/sectors/LawFirms";
import Plumbers from "./pages/sectors/Plumbers";
import Carpenters from "./pages/sectors/Carpenters";
import Builders from "./pages/sectors/Builders";
import HealthClinics from "./pages/sectors/HealthClinics";
import Physiotherapists from "./pages/sectors/Physiotherapists";
import AiAudit from "./pages/AiAudit";
import Services from "./pages/Services";
import VoiceAgent from "./pages/VoiceAgent";
import VoiceAgentSuccess from "./pages/VoiceAgentSuccess";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";

// ── Solvr Operations Console & Tools ─────────────────────────────────────────
import Demo from "./pages/Demo";
import Onboarding from "./pages/Onboarding";
import ClientOnboardingForm from "./pages/ClientOnboardingForm";
import AdminLeads from "./pages/AdminLeads";
import AdminOnboarding from "./pages/AdminOnboarding";
import CrmDashboard from "./pages/CrmDashboard";
import CrmClientDetail from "./pages/CrmClientDetail";
import ConsoleDashboard from "./pages/ConsoleDashboard";
import ConsolePipeline from "./pages/ConsolePipeline";
import ConsoleTasks from "./pages/ConsoleTasks";
import ConsoleAIAssistant from "./pages/ConsoleAIAssistant";
import PromptBuilder from "./pages/PromptBuilder";
import OnboardingChecklist from "./pages/OnboardingChecklist";

// ── Referral Programme ───────────────────────────────────────────────────────
import ReferralLanding from "./pages/ReferralLanding";
import ConsoleReferrals from "./pages/ConsoleReferrals";
import ConsolePortalClients from "./pages/ConsolePortalClients";
import ConsoleQuotes from "./pages/ConsoleQuotes";
import ConsoleInvoices from "./pages/ConsoleInvoices";
import ConsoleReporting from "./pages/ConsoleReporting";

// ── Client Portal ─────────────────────────────────────────────────────────────
import PortalLogin from "./pages/portal/PortalLogin";
import PortalForgotPassword from "./pages/portal/PortalForgotPassword";
import PortalResetPassword from "./pages/portal/PortalResetPassword";
import PortalDashboard from "./pages/portal/PortalDashboard";
import PortalCalls from "./pages/portal/PortalCalls";
import PortalJobs from "./pages/portal/PortalJobs";
import PortalJobDetail from "./pages/portal/PortalJobDetail";
import PortalCalendar from "./pages/portal/PortalCalendar";
import PortalQuotes from "./pages/portal/PortalQuotes";
import PortalQuoteDetail from "./pages/portal/PortalQuoteDetail";
import PortalQuoteSettings from "./pages/portal/PortalQuoteSettings";
import PortalSettings from "./pages/portal/PortalSettings";
import PortalOnboarding from "./pages/portal/PortalOnboarding";
import PortalInvoices from "./pages/portal/PortalInvoices";
import PortalSubscription from "./pages/portal/PortalSubscription";
import PortalCustomers from "./pages/portal/PortalCustomers";
import PortalAIInsights from "./pages/portal/PortalAIInsights";

// ── Public quote acceptance page ──────────────────────────────────────────────
import PublicQuote from "./pages/PublicQuote";

// ── Public completion report page (no auth) ──────────────────────────────────
import PublicCompletionReport from "./pages/PublicCompletionReport";

function Router() {
  return (
    <Switch>
      {/* ── Public marketing site ─────────────────────────────────────────── */}
      <Route path="/" component={Home} />
      <Route path="/industries/law-firms" component={LawFirms} />
      <Route path="/industries/plumbers" component={Plumbers} />
      <Route path="/industries/carpenters" component={Carpenters} />
      <Route path="/industries/builders" component={Builders} />
      <Route path="/industries/health-clinics" component={HealthClinics} />
      <Route path="/industries/physiotherapists" component={Physiotherapists} />
      <Route path="/ai-audit" component={AiAudit} />
      <Route path="/services" component={Services} />
      <Route path="/voice-agent" component={VoiceAgent} />
      <Route path="/voice-agent/success" component={VoiceAgentSuccess} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />

      {/* ── Voice agent demo (shareable with prospects) ───────────────────── */}
      <Route path="/demo" component={Demo} />

      {/* ── Client onboarding intake form (public) ────────────────────────── */}
      <Route path="/onboarding" component={Onboarding} />
      {/* Token-based onboarding form sent to clients after signup */}
      <Route path="/onboarding/welcome" component={ClientOnboardingForm} />

      {/* ── Admin tools (protected by Manus login) ────────────────────────── */}
      <Route path="/admin" component={AdminLeads} />
      <Route path="/admin/onboarding" component={AdminOnboarding} />
      <Route path="/admin/crm" component={CrmDashboard} />
      <Route path="/admin/crm/:id" component={CrmClientDetail} />
      <Route path="/admin/prompt-builder" component={PromptBuilder} />

      {/* ── Unified Operations Console (protected) ────────────────────────── */}
      <Route path="/console" component={ConsoleDashboard} />
      <Route path="/console/pipeline" component={ConsolePipeline} />
      <Route path="/console/tasks" component={ConsoleTasks} />
      <Route path="/console/ai" component={ConsoleAIAssistant} />
      <Route path="/console/crm" component={CrmDashboard} />
      <Route path="/console/crm/:id" component={CrmClientDetail} />
      <Route path="/console/crm/:id/checklist" component={OnboardingChecklist} />
      <Route path="/console/onboarding" component={AdminOnboarding} />
      <Route path="/console/leads" component={AdminLeads} />
      <Route path="/console/prompt-builder" component={PromptBuilder} />
      <Route path="/console/referrals" component={ConsoleReferrals} />
      <Route path="/console/portal-clients" component={ConsolePortalClients} />
      <Route path="/console/quotes" component={ConsoleQuotes} />
      <Route path="/console/invoices" component={ConsoleInvoices} />
      <Route path="/console/reporting" component={ConsoleReporting} />

      {/* ── Referral landing pages ────────────────────────────────────────── */}
      <Route path="/ref/:code" component={ReferralLanding} />

      {/* ── Client Portal (password auth) ──────────────────────────────── */}
      <Route path="/portal" component={PortalLogin} />
      <Route path="/portal/login" component={PortalLogin} />
      <Route path="/portal/forgot-password" component={PortalForgotPassword} />
      <Route path="/portal/reset-password" component={PortalResetPassword} />
      <Route path="/portal/dashboard" component={PortalDashboard} />
      <Route path="/portal/calls" component={PortalCalls} />
      <Route path="/portal/jobs" component={PortalJobs} />
      <Route path="/portal/jobs/:id" component={PortalJobDetail} />
      <Route path="/portal/calendar" component={PortalCalendar} />
      <Route path="/portal/quotes" component={PortalQuotes} />
      <Route path="/portal/quotes/settings" component={PortalQuoteSettings} />
      <Route path="/portal/quotes/:id" component={PortalQuoteDetail} />
      <Route path="/portal/onboarding" component={PortalOnboarding} />
      <Route path="/portal/settings" component={PortalSettings} />
      <Route path="/portal/invoices" component={PortalInvoices} />
      <Route path="/portal/subscription" component={PortalSubscription} />
      <Route path="/portal/customers" component={PortalCustomers} />
      <Route path="/portal/insights" component={PortalAIInsights} />

      {/* ── Public quote acceptance page ──────────────────────────────── */}
      <Route path="/quote/:token" component={PublicQuote} />

      {/* ── Public completion report (no auth, token-based) ──────────────── */}
      <Route path="/report/:token" component={PublicCompletionReport} />

      {/* ── Fallback ──────────────────────────────────────────────────────── */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

/**
 * Dismissible marketing announcement banner — shown on the public marketing
 * site only. Hidden on portal routes because portal users are existing paying
 * customers who should not be shown "book a free strategy call" style CTAs
 * aimed at prospects. Same logic applies in the Capacitor mobile app (which
 * only ever shows /portal/* routes anyway, so the banner would never render
 * there either way).
 */
function ConditionalAnnouncementBanner() {
  const [location] = useLocation();
  if (location.startsWith("/portal")) return null;
  return <AnnouncementBanner />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <ConditionalAnnouncementBanner />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
