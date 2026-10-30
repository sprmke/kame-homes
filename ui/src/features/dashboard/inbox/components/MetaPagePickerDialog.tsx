import { useEffect, useState } from 'react';

import { Loader2, Plug } from 'lucide-react';

import { PlatformLogo } from '@/features/dashboard/inbox/components/PlatformLogo';
import type { MetaPagePickerOption } from '@/features/dashboard/inbox/types/inbox';

import { Button } from '@/components/ui/button';
import { RadioGroupDisplay } from '@/components/ui/radio-group';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { FeatureUnavailablePanel } from '@/components/feature-availability/FeatureUnavailablePanel';
import { Skeleton } from '@/components/ui/skeleton';
import { useFeatureAvailability } from '@/lib/featureAvailability/useFeatureAvailability';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  pages: MetaPagePickerOption[];
  loading: boolean;
  error: string | null;
  completing: boolean;
  onConnect: (pageId: string) => void;
  onOpenChange: (open: boolean) => void;
};

export function MetaPagePickerDialog({
  open,
  pages,
  loading,
  error,
  completing,
  onConnect,
  onOpenChange,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const metaConnectAvailability = useFeatureAvailability('inbox.meta.connect');

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      return;
    }
    if (pages.length === 1) {
      setSelectedId(pages[0]!.id);
    }
  }, [open, pages]);

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="max-w-[min(calc(100vw-1.5rem),28rem)]">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Choose Facebook Page</ResponsiveModalTitle>
        </ResponsiveModalHeader>

        {open && !metaConnectAvailability.available && !metaConnectAvailability.isLoading ? (
          <FeatureUnavailablePanel
            label={metaConnectAvailability.label}
            message={metaConnectAvailability.message}
            expectedBackLabel={metaConnectAvailability.expectedBackLabel}
            reason={metaConnectAvailability.reason}
            tone={metaConnectAvailability.tone}
          />
        ) : loading ? (
          <div className="space-y-2 py-2" aria-busy="true" aria-label="Loading pages">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="border-border/70 flex min-h-[44px] items-center gap-3 rounded-xl border p-3"
                style={{ opacity: 1 - i * 0.08 }}
              >
                <Skeleton className="size-10 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-1/2 max-w-full" />
                </div>
                <Skeleton className="size-5 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="text-destructive py-4 text-sm">{error}</p>
        ) : (
          <div className="space-y-3">
            <ul className="max-h-[min(50dvh,320px)] space-y-2 overflow-y-auto" role="listbox">
              {pages.map((page) => {
                const active = selectedId === page.id;
                return (
                  <li key={page.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      disabled={completing}
                      onClick={() => setSelectedId(page.id)}
                      className={cn(
                        'flex min-h-[44px] w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                        active
                          ? 'border-primary/50 bg-primary/5 ring-primary/20 ring-1'
                          : 'border-border/70 hover:border-border hover:bg-muted/30'
                      )}
                    >
                      {page.profileImageUrl ? (
                        <img
                          src={page.profileImageUrl}
                          alt=""
                          className="size-10 shrink-0 rounded-lg object-cover"
                          width={40}
                          height={40}
                        />
                      ) : (
                        <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
                          <PlatformLogo platform="facebook" size="sm" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{page.name}</p>
                        {page.hasInstagram && (
                          <p className="text-muted-foreground mt-0.5 text-xs">Instagram linked</p>
                        )}
                      </div>
                      <RadioGroupDisplay checked={active} />
                    </button>
                  </li>
                );
              })}
            </ul>

            <Button
              type="button"
              className="min-h-[44px] w-full gap-1.5"
              disabled={!selectedId || completing}
              onClick={() => selectedId && onConnect(selectedId)}
            >
              {completing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <>
                  <Plug className="size-4" aria-hidden />
                  Connect
                </>
              )}
            </Button>
          </div>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
