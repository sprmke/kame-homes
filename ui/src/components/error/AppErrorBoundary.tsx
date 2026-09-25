import { Component, type ErrorInfo, type ReactNode } from 'react';

import { RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { captureAppException } from '@/lib/posthog/capture';
import { captureSentryException } from '@/lib/sentry/client';

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Top-level render-error catch-all — React swallows some crashes before they reach window.onerror. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack);
    // PostHog keeps the exception history; Sentry carries the alert. Each is
    // independently configured and each swallows its own errors.
    captureAppException(error, { componentStack: info.componentStack });
    captureSentryException(error, { componentStack: info.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="bg-background flex min-h-screen items-center justify-center px-4 py-16">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <h1 className="text-foreground text-lg font-bold sm:text-xl">Something went wrong</h1>
          <p className="text-muted-foreground text-sm">
            Please reload the page. If this keeps happening, contact support.
          </p>
          <Button
            className="h-11 gap-2"
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
          >
            <RotateCw className="h-4 w-4" />
            Reload
          </Button>
        </div>
      </div>
    );
  }
}
