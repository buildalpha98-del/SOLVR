import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AnnouncementBanner from "./components/AnnouncementBanner";
import Home from "./pages/Home";
import TradesPlumbers from "./pages/trades/Plumbers";
import VsTradify from "./pages/vs/Tradify";
import VsServiceM8 from "./pages/vs/ServiceM8";
import VsFergus from "./pages/vs/Fergus";
import VsSimPRO from "./pages/vs/SimPRO";
import VsBuildxact from "./pages/vs/Buildxact";
import TradesElectricians from "./pages/trades/Electricians";
import TradesCarpenters from "./pages/trades/Carpenters";
import TradesBuilders from "./pages/trades/Builders";
import TradesHVAC from "./pages/trades/HVAC";
import TradesPainters from "./pages/trades/Painters";
import VoiceAgent from "./pages/VoiceAgent";
import Pricing from "./pages/Pricing";
import SubscriptionExpired from "./pages/SubscriptionExpired";
import VoiceAgentSuccess from "./pages/VoiceAgentSuccess";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Support from "./pages/Support";

// ── Blog pages ──────────────────────────────────────────────────────────────
import Blog from "./pages/Blog";
import HowToQuoteFaster from "./pages/blog/HowToQuoteFaster";
import BestTradieApps from "./pages/blog/BestTradieApps";
import AIReceptionist from "./pages/blog/AIReceptionist";
import GrowTradieRevenue from "./pages/blog/GrowTradieRevenue";
import HowToWriteAQuote from "./pages/blog/HowToWriteAQuote";
import BestAccountingSoftware from "./pages/blog/BestAccountingSoftware";
import BestQuotingAppPlumbers from "./pages/blog/BestQuotingAppPlumbers";
import BestQuotingAppElectricians from "./pages/blog/BestQuotingAppElectricians";
import BestQuotingAppBuilders from "./pages/blog/BestQuotingAppBuilders";
import BestQuotingAppHVAC from "./pages/blog/BestQuotingAppHVAC";
import BestQuotingAppCarpenters from "./pages/blog/BestQuotingAppCarpenters";
import BestQuotingAppPainters from "./pages/blog/BestQuotingAppPainters";
import BestQuotingAppRoofers from "./pages/blog/BestQuotingAppRoofers";
import TradesRoofers from "./pages/trades/Roofers";

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
import VoiceOnboarding from "./pages/portal/VoiceOnboarding";
import PortalInvoices from "./pages/portal/PortalInvoices";
import PortalSubscription from "./pages/portal/PortalSubscription";
import PortalReferral from "./pages/portal/PortalReferral";
import PortalCustomers from "./pages/portal/PortalCustomers";
import PortalCustomerDetail from "./pages/portal/PortalCustomerDetail";
import PortalAIInsights from "./pages/portal/PortalAIInsights";
import PortalCompliance from "./pages/portal/PortalCompliance";
import PortalStaff from "./pages/portal/PortalStaff";
import PortalSchedule from "./pages/portal/PortalSchedule";
import PortalStaffCheckIn from "./pages/portal/PortalStaffCheckIn";
import PortalReviews from "./pages/portal/PortalReviews";
import PortalPriceList from "./pages/portal/PortalPriceList";
import PortalTeam from "./pages/portal/PortalTeam";
import PortalTeamAccept from "./pages/portal/PortalTeamAccept";
import PortalAssistant from "./pages/portal/PortalAssistant";
import PortalReporting from "./pages/portal/PortalReporting";
import PortalSubcontractors from "./pages/portal/PortalSubcontractors";

// ── Staff Portal (PIN auth) ──────────────────────────────────────────────
import StaffLogin from "./pages/staff/StaffLogin";
import StaffToday from "./pages/staff/StaffToday";
import StaffRoster from "./pages/staff/StaffRoster";
import StaffCheckin from "./pages/staff/StaffCheckin";

// ── Public quote acceptance page ──────────────────────────────────────────────
import PublicQuote from "./pages/PublicQuote";

// ── Public completion report page (no auth) ──────────────────────────────────
import PublicCompletionReport from "./pages/PublicCompletionReport";
import PaymentLink from "./pages/PaymentLink";
import CustomerJobStatus from "./pages/CustomerJobStatus";
import SmsUnsubscribe from "./pages/SmsUnsubscribe";
import EmailUnsubscribe from "./pages/EmailUnsubscribe";

function Router() {
  return (
    <Switch>
      {/* ── Public marketing site ─────────────────────────────────────────── */}
      <Route path="/" component={Home} />
      <Route path="/trades/plumbers" component={TradesPlumbers} />

      {/* ── Competitor comparison pages (SEO) ─────────────────────────────── */}
      <Route path="/vs/tradify" component={VsTradify} />
      <Route path="/vs/servicem8" component={VsServiceM8} />
      <Route path="/vs/fergus" component={VsFergus} />
      <Route path="/vs/simpro" component={VsSimPRO} />
      <Route path="/vs/buildxact" component={VsBuildxact} />

      {/* ── Blog (SEO content hub) ────────────────────────────────────────── */}
      <Route path="/blog" component={Blog} />
      <Route path="/blog/how-to-quote-faster-as-a-tradie" component={HowToQuoteFaster} />
      <Route path="/blog/best-tradie-apps-australia-2026" component={BestTradieApps} />
      <Route path="/blog/ai-receptionist-for-tradies" component={AIReceptionist} />
      <Route path="/blog/tradie-business-tips-grow-revenue" component={GrowTradieRevenue} />
      <Route path="/blog/how-to-write-a-professional-tradie-quote" component={HowToWriteAQuote} />
      <Route path="/blog/best-accounting-software-tradies-australia-2026" component={BestAccountingSoftware} />
      <Route path="/blog/best-quoting-app-for-plumbers-australia-2026" component={BestQuotingAppPlumbers} />
      <Route path="/blog/best-quoting-app-for-electricians-australia-2026" component={BestQuotingAppElectricians} />
      <Route path="/blog/best-quoting-app-for-builders-australia-2026" component={BestQuotingAppBuilders} />
      <Route path="/blog/best-quoting-app-for-hvac-technicians-australia-2026" component={BestQuotingAppHVAC} />
      <Route path="/blog/best-quoting-app-for-carpenters-australia-2026" component={BestQuotingAppCarpenters} />
      <Route path="/blog/best-quoting-app-for-painters-australia-2026" component={BestQuotingAppPainters} />
      <Route path="/blog/best-quoting-app-for-roofers-australia-2026" component={BestQuotingAppRoofers} />
      <Route path="/trades/roofers" component={TradesRoofers} />
      <Route path="/trades/electricians" component={TradesElectricians} />
      <Route path="/trades/carpenters" component={TradesCarpenters} />
      <Route path="/trades/builders" component={TradesBuilders} />
      <Route path="/trades/hvac" component={TradesHVAC} />
      <Route path="/trades/painters" component={TradesPainters} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/subscription/expired" component={SubscriptionExpired} />
      <Route path="/voice-agent" component={VoiceAgent} />
      <Route path="/voice-agent/success" component={VoiceAgentSuccess} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/support" component={Support} />

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
      <Route path="/portal/onboarding/voice" component={VoiceOnboarding} />
      <Route path="/portal/onboarding" component={VoiceOnboarding} />
      <Route path="/portal/onboarding/form" component={PortalOnboarding} />
      <Route path="/portal/settings" component={PortalSettings} />
      <Route path="/portal/invoices" component={PortalInvoices} />
      <Route path="/portal/subscription" component={PortalSubscription} />
      <Route path="/portal/referral" component={PortalReferral} />
      <Route path="/portal/customers/:id" component={PortalCustomerDetail} />
      <Route path="/portal/customers" component={PortalCustomers} />
      <Route path="/portal/insights" component={PortalAIInsights} />
      <Route path="/portal/compliance" component={PortalCompliance} />
      <Route path="/portal/staff" component={PortalStaff} />
      <Route path="/portal/schedule" component={PortalSchedule} />
      <Route path="/portal/checkin" component={PortalStaffCheckIn} />
      <Route path="/portal/reviews" component={PortalReviews} />
      <Route path="/portal/price-list" component={PortalPriceList} />
      <Route path="/portal/team" component={PortalTeam} />
      <Route path="/portal/team/accept" component={PortalTeamAccept} />
      <Route path="/portal/assistant" component={PortalAssistant} />
      <Route path="/portal/reporting" component={PortalReporting} />
      <Route path="/portal/subcontractors" component={PortalSubcontractors} />

      {/* ── Staff Portal (PIN auth) ─────────────────────────────────────── */}
      <Route path="/staff" component={StaffLogin} />
      <Route path="/staff/today" component={StaffToday} />
      <Route path="/staff/roster" component={StaffRoster} />
      <Route path="/staff/checkin" component={StaffCheckin} />

      {/* ── Public quote acceptance page ──────────────────── */}
      <Route path="/quote/:token" component={PublicQuote} />

      {/* ── Public completion report (no auth, token-based) ──────────────── */}
      <Route path="/report/:token" component={PublicCompletionReport} />
      <Route path="/job/:token" component={CustomerJobStatus} />

      {/* SMS payment link public page */}
      <Route path="/pay/:token" component={PaymentLink} />

      {/* ── SMS opt-out (public, no auth) ───────────────────────────────── */}
      <Route path="/sms/unsubscribe" component={SmsUnsubscribe} />

      {/* ── Email opt-out (public, no auth) ─────────────────────────────── */}
      <Route path="/email/unsubscribe" component={EmailUnsubscribe} />

      {/* ── Fallback ──────────────────────────────────────────────────────── */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          {/* Dismissible announcement banner — shown site-wide until dismissed */}
          <AnnouncementBanner />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
