import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import LawFirms from "./pages/sectors/LawFirms";
import Plumbers from "./pages/sectors/Plumbers";
import Carpenters from "./pages/sectors/Carpenters";
import Builders from "./pages/sectors/Builders";
import HealthClinics from "./pages/sectors/HealthClinics";
import Physiotherapists from "./pages/sectors/Physiotherapists";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/industries/law-firms" component={LawFirms} />
      <Route path="/industries/plumbers" component={Plumbers} />
      <Route path="/industries/carpenters" component={Carpenters} />
      <Route path="/industries/builders" component={Builders} />
      <Route path="/industries/health-clinics" component={HealthClinics} />
      <Route path="/industries/physiotherapists" component={Physiotherapists} />
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
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
