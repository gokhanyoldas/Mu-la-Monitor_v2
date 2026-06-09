// ErrorBoundary.tsx
import { Component, type ReactNode } from "react";
import { RefreshCw, Bug } from "lucide-react";
import { Sentry } from "@/lib/sentry";

interface Props { children: ReactNode; fallback?: ReactNode; componentName?: string; }
interface State { hasError: boolean; errorId: string | null; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorId: null, error: null };

  static getDerivedStateFromError(error: Error): Partial<State> { return { hasError: true, error }; }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const errorId = Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
      tags: { component: this.props.componentName ?? "unknown" },
    });
    this.setState({ errorId: typeof errorId === "string" ? errorId : null });
  }

  handleReset = () => { this.setState({ hasError: false, errorId: null, error: null }); };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-red-500/30 bg-red-950/10 p-6 text-center min-h-[200px]">
        <div className="p-3 rounded-full bg-red-500/10 border border-red-500/20">
          <Bug className="h-6 w-6 text-red-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Bir şeyler yanlış gitti</p>
          <p className="text-xs text-muted-foreground mt-1">
            {this.props.componentName ? `${this.props.componentName} bileşeni ` : "Bu bölüm "}
            beklenmedik bir hatayla karşılaştı.
          </p>
          {this.state.errorId && <p className="text-[10px] font-mono text-muted-foreground/50 mt-1">Hata ID: {this.state.errorId}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={this.handleReset} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" /> Tekrar dene
          </button>
          <button onClick={() => window.location.reload()} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted/50 transition-colors">Sayfayı yenile</button>
        </div>
      </div>
    );
  }
}

export function withErrorBoundary<P extends object>(Component: React.ComponentType<P>, componentName?: string) {
  return function WrappedComponent(props: P) {
    return <ErrorBoundary componentName={componentName ?? Component.displayName ?? Component.name}><Component {...props} /></ErrorBoundary>;
  };
}
