import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, ChevronDown } from "lucide-react";
import { Component, ReactNode, ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
  showDetails: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  /**
   * Always log to console so Safari Web Inspector / Chrome DevTools picks
   * it up regardless of NODE_ENV. Critical for TestFlight debugging where
   * we can't reproduce locally.
   */
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error.name, error.message);
    if (error.stack) console.error(error.stack);
    if (info.componentStack) console.error("Component stack:", info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  render() {
    if (this.state.hasError) {
      const { error, componentStack, showDetails } = this.state;
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-4">Something went wrong.</h2>
            <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
              Try reloading. If the problem persists, contact hello@solvr.com.au.
            </p>

            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              Reload Page
            </button>

            {/* Tap-to-reveal diagnostic details. Hidden by default so end
                users don't see infrastructure noise; one tap reveals it
                for support / TestFlight debugging without rebuilding. */}
            {error && (
              <div className="w-full mt-8">
                <button
                  type="button"
                  onClick={() => this.setState({ showDetails: !showDetails })}
                  className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground/80 mx-auto"
                >
                  <ChevronDown
                    size={12}
                    className="transition-transform"
                    style={{ transform: showDetails ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                  {showDetails ? "Hide" : "Show"} technical details
                </button>
                {showDetails && (
                  <div className="p-4 mt-3 rounded bg-muted overflow-auto max-h-80 text-left">
                    <p className="text-xs font-mono font-bold text-destructive break-all">
                      {error.name}: {error.message}
                    </p>
                    {error.stack && (
                      <pre className="text-[10px] text-muted-foreground whitespace-break-spaces mt-2">
                        {error.stack}
                      </pre>
                    )}
                    {componentStack && (
                      <>
                        <p className="text-xs font-bold text-muted-foreground mt-3 mb-1">React tree:</p>
                        <pre className="text-[10px] text-muted-foreground whitespace-break-spaces">
                          {componentStack}
                        </pre>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
