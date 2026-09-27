import { Component, type ErrorInfo, type ReactNode } from 'react';

import { RuntimeErrorFallback } from '@/components/error/RuntimeErrorFallback';
import { captureAppException } from '@/lib/posthog/capture';
import { captureSentryException } from '@/lib/sentry/client';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Top-level render-error catch-all for trees outside the data router.
 * Route render errors inside `RouterProvider` use `RouteErrorFallback` instead.
 */
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
      <RuntimeErrorFallback
        onReload={() => {
          this.setState({ error: null });
          window.location.reload();
        }}
      />
    );
  }
}
