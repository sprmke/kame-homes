import { Component, Suspense, lazy, type ReactNode } from 'react';

import type { DesignExportPayload } from '@/features/dashboard/marketing/components/design-editor/PolotnoDesignStudio';

import { MarketingStudioSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';

export type { DesignExportPayload };

type Props = {
  onPublish?: (payload: DesignExportPayload) => void;
  openTemplateId?: string | null;
  onOpenTemplateHandled?: () => void;
};

function loadPolotnoDesignStudio() {
  return import('@/features/dashboard/marketing/components/design-editor/PolotnoDesignStudio').then(
    (mod) => ({ default: mod.PolotnoDesignStudio })
  );
}

const PolotnoDesignStudio = lazy(loadPolotnoDesignStudio);

type ErrorBoundaryProps = {
  children: ReactNode;
  onReset: () => void;
};

type ErrorBoundaryState = { hasError: boolean };

class DesignEditorErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-muted-foreground text-sm">Could not load the design editor.</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            onClick={() => {
              this.setState({ hasError: false });
              this.props.onReset();
            }}
          >
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function DesignEditor(props: Props) {
  return (
    <DesignEditorErrorBoundary
      onReset={() => {
        // Bust Vite's stale dynamic-import cache after HMR / chunk fetch failures.
        void loadPolotnoDesignStudio().catch(() => undefined);
      }}
    >
      <Suspense fallback={<MarketingStudioSkeleton />}>
        <PolotnoDesignStudio {...props} />
      </Suspense>
    </DesignEditorErrorBoundary>
  );
}
