import {
  MarketingTemplateBrowser,
  type MarketingTemplatePick,
} from '@/features/dashboard/marketing/components/library/MarketingTemplateBrowser';
import type { MarketingContentType } from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import { CONTENT_NOUN } from '@/features/dashboard/marketing/lib/marketingLibrary';
import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: MarketingContentType;
  theme: MarketingThemeTokens;
  themeHash: string;
  themeKey: string;
  size: string;
  onSizeChange: (size: string) => void;
  onPick: (pick: MarketingTemplatePick) => void;
  binding?: DesignBinding;
  propertyPhotoUrl?: string;
};

/** Every template in one place: large dialog on desktop, full-height sheet on phones. */
export function MarketingTemplateGallery({
  open,
  onOpenChange,
  contentType,
  onPick,
  ...browser
}: Props) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        className="flex h-[min(92dvh,52rem)] max-h-[min(92dvh,52rem)] w-full max-w-[min(calc(100vw-1.5rem),68rem)] flex-col gap-0 overflow-hidden p-0 pb-0 pt-0 sm:max-w-[min(calc(100vw-3rem),68rem)] sm:p-0"
      >
        <ResponsiveModalHeader className="border-border shrink-0 border-b px-4 py-3 pr-12 sm:px-5">
          <ResponsiveModalTitle>New {CONTENT_NOUN[contentType].one}</ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          {open ? (
            <MarketingTemplateBrowser
              contentType={contentType}
              onPick={(pick) => {
                onOpenChange(false);
                onPick(pick);
              }}
              {...browser}
            />
          ) : null}
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
