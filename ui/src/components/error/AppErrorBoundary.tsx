import { Component, type ErrorInfo, type ReactNode } from 'react';

import { RuntimeErrorFallback } from '@/components/error/RuntimeErrorFallback';
import { isChunkLoadError, reloadForChunkError } from '@/lib/chunkReload';
import { captureRenderError } from '@/lib/sentry/capture';

type Props = { children: ReactNode };
type State = { error: Error | null; reference: string | undefined };

/**
 * Top-level render-error catch-all for trees outside the data router.
 * Route render errors inside `RouterProvider` use `RouteErrorFallback` instead.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, reference: undefined };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isChunkLoadError(error) && reloadForChunkError()) return;
    console.error('[AppErrorBoundary]', error, info.componentStack);
    const reference = captureRenderError(error, info.componentStack);
    if (reference) this.setState({ reference });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <RuntimeErrorFallback
        reference={this.state.reference}
        onReload={() => {
          this.setState({ error: null, reference: undefined });
          window.location.reload();
        }}
      />
    );
  }
}
