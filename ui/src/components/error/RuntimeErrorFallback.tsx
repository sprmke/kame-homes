import { RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

type RuntimeErrorFallbackProps = {
  onReload: () => void;
};

/** Shared crash UI for React error boundaries and React Router `errorElement`. */
export function RuntimeErrorFallback({ onReload }: RuntimeErrorFallbackProps) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4 py-16">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <h1 className="text-foreground text-lg font-bold sm:text-xl">Something went wrong</h1>
        <p className="text-muted-foreground text-sm">
          Please reload the page. If this keeps happening, contact support.
        </p>
        <Button className="h-11 gap-2" onClick={onReload}>
          <RotateCw className="h-4 w-4" />
          Reload
        </Button>
      </div>
    </div>
  );
}
