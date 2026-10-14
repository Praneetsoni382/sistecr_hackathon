import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';

const basePath = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL)
  ? import.meta.env.BASE_URL.replace(/\/$/, '')
  : '';
const dashboardPath = `${basePath}/dashboard` || '/dashboard';

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  resetErrorBoundary?: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  /** Changing this clears a caught error. Pass the route to recover on navigation. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

function DefaultFallback({
  error,
  resetError,
  resetErrorBoundary,
}: ErrorFallbackProps) {
  const onReset = resetError ?? resetErrorBoundary;

  const handleNavigateHome = () => {
    try {
      if (typeof window !== 'undefined') {
        window.location.href = dashboardPath;
      }
    } catch {
      onReset();
    }
  };

  const handleReload = () => {
    try {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch {
      onReset();
    }
  };

  return (
    <div className="min-h-[70vh] w-full flex items-center justify-center p-6 text-foreground bg-background/50">
      <div className="max-w-lg w-full rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold tracking-tight">
          Application Notice
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A view rendering issue was intercepted. The rest of the system remains operational.
        </p>
        {error?.message ? (
          <pre className="mt-4 max-h-40 overflow-x-auto rounded-lg bg-secondary/80 p-3 text-left font-mono text-xs text-muted-foreground border border-border/50">
            {error.message}
          </pre>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onReset}
            className="focus-ring inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Retry View
          </button>
          <button
            type="button"
            onClick={handleNavigateHome}
            className="focus-ring inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-secondary px-4 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            Go to Dashboard
          </button>
          <button
            type="button"
            onClick={handleReload}
            className="focus-ring inline-flex min-h-10 items-center justify-center rounded-lg border border-border/60 bg-transparent px-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Reload App
          </button>
        </div>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  componentDidCatch(error: unknown, info?: ErrorInfo): void {
    console.warn(
      '[Interception Notice] ErrorBoundary handled view error:',
      toError(error).message,
      info?.componentStack,
    );
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.error !== null &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.resetError();
    }
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }
    const Fallback = this.props.FallbackComponent ?? DefaultFallback;
    return (
      <Fallback
        error={error}
        resetError={this.resetError}
        resetErrorBoundary={this.resetError}
      />
    );
  }
}

export default ErrorBoundary;
