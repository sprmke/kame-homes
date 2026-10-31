import { useState } from 'react';

import { AlertCircle, Check, Eye, FileText, Minus } from 'lucide-react';

import {
  VerificationDocFullViewDialog,
  browserVerificationAssetUrl,
  getVerificationDocType,
  type VerificationPreviewAsset,
} from '@/features/dashboard/org/components/verification/VerificationDocPreview';
import { useListingAuthorizationAssets } from '@/features/dashboard/org/hooks/useListingAuthorization';
import type { ListingKind } from '@/features/dashboard/org/lib/listingAuthorization';
import type { ListingAuthorizationAssetUrls } from '@/features/dashboard/org/lib/listingAuthorizationApi';
import {
  listingBaseDocumentChecklistItems,
  listingRecommendedDocumentChecklistItems,
} from '@/features/dashboard/org/lib/listingVerificationTiers';
import type { OrgVerificationStatus } from '@/features/dashboard/org/lib/orgVerification';
import type { VerificationChecklistItem } from '@/features/dashboard/org/lib/orgVerificationTiers';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Props = {
  listingKind: ListingKind;
  listingId: string;
  enabled: boolean;
  items: VerificationChecklistItem[];
  tierStatus: OrgVerificationStatus;
  tier?: 'base' | 'recommended';
};

type DocRowVariant = 'uploaded' | 'approved' | 'missing' | 'optional';

function previewUrlForItem(
  id: string,
  assetUrls: ListingAuthorizationAssetUrls | undefined
): string | null {
  if (!assetUrls) return null;
  switch (id) {
    case 'listing-proof':
      return assetUrls.proofUrl;
    case 'listing-additional-proof':
      return assetUrls.additionalProofUrl;
    case 'listing-azure-pmo-confirmation':
      return assetUrls.azurePmoConfirmationUrl;
    default:
      return null;
  }
}

function docRowVariant(
  item: VerificationChecklistItem,
  tierStatus: OrgVerificationStatus
): DocRowVariant {
  if (!item.complete) {
    return item.optional ? 'optional' : 'missing';
  }
  if (tierStatus === 'approved') return 'approved';
  return 'uploaded';
}

function DocRowIcon({ variant }: { variant: DocRowVariant }) {
  switch (variant) {
    case 'approved':
      return (
        <span
          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"
          aria-hidden
        >
          <Check className="size-3" strokeWidth={2.5} />
        </span>
      );
    case 'uploaded':
      return (
        <span
          className="bg-muted text-muted-foreground flex size-5 shrink-0 items-center justify-center rounded-full"
          aria-hidden
        >
          <FileText className="size-3.5 shrink-0" strokeWidth={2} />
        </span>
      );
    case 'missing':
      return (
        <span
          className="bg-destructive/10 text-destructive flex size-5 shrink-0 items-center justify-center rounded-full"
          aria-hidden
        >
          <AlertCircle className="size-3" strokeWidth={2.25} />
        </span>
      );
    case 'optional':
      return (
        <span
          className="bg-muted text-muted-foreground/60 flex size-5 shrink-0 items-center justify-center rounded-full"
          aria-hidden
        >
          <Minus className="size-3" strokeWidth={2.25} />
        </span>
      );
    default:
      return null;
  }
}

export function ListingVerificationSubmittedDocs({
  listingKind,
  listingId,
  enabled,
  items,
  tierStatus,
  tier = 'base',
}: Props) {
  const { data, isLoading } = useListingAuthorizationAssets(listingKind, listingId, enabled);
  const [fullView, setFullView] = useState<VerificationPreviewAsset | null>(null);

  if (!enabled) return null;

  const documentItems = (
    tier === 'recommended'
      ? listingRecommendedDocumentChecklistItems(items)
      : listingBaseDocumentChecklistItems(items)
  ).filter((item) => item.complete);
  const assetUrls = data?.assetUrls;
  const hasPreviewItems = documentItems.some((item) => previewUrlForItem(item.id, assetUrls));

  if (documentItems.length === 0) return null;

  return (
    <>
      <div className="border-border overflow-hidden rounded-xl border">
        <ul
          className="divide-border divide-y"
          aria-label="Submitted listing verification documents"
        >
          {documentItems.map((item) => {
            const previewUrl = previewUrlForItem(item.id, assetUrls);
            const variant = docRowVariant(item, tierStatus);
            const canView = Boolean(previewUrl);
            const showGapLabel = variant === 'missing' || variant === 'optional';

            return (
              <li key={item.id}>
                <div className="flex min-h-[44px] items-center gap-3 px-3 py-2.5 sm:px-4">
                  <DocRowIcon variant={variant} />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'truncate text-sm leading-snug',
                        variant === 'missing' || variant === 'optional'
                          ? 'text-muted-foreground'
                          : 'text-foreground font-medium'
                      )}
                    >
                      {item.label}
                      {item.optional ? (
                        <span className="text-muted-foreground/80 ml-1 text-xs font-normal">
                          (optional)
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {showGapLabel ? (
                    <span
                      className={cn(
                        'shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium',
                        variant === 'missing' && 'bg-destructive/10 text-destructive',
                        variant === 'optional' && 'bg-muted text-muted-foreground'
                      )}
                    >
                      {variant === 'missing' ? 'Missing' : 'Optional'}
                    </span>
                  ) : null}
                  {isLoading ? (
                    <Skeleton className="h-9 w-[4.5rem] shrink-0 rounded-md" />
                  ) : canView ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-[36px] shrink-0 gap-1.5 px-2.5 text-xs"
                      onClick={() => {
                        const displayUrl = browserVerificationAssetUrl(previewUrl!);
                        if (!displayUrl) return;
                        setFullView({
                          label: item.label,
                          url: displayUrl,
                          type: getVerificationDocType(displayUrl),
                        });
                      }}
                    >
                      <Eye className="size-3.5" aria-hidden />
                      View
                    </Button>
                  ) : variant === 'uploaded' || variant === 'approved' ? (
                    <span className="text-muted-foreground w-[3.25rem] shrink-0 text-center text-[11px]">
                      -
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      {hasPreviewItems ? (
        <VerificationDocFullViewDialog asset={fullView} onClose={() => setFullView(null)} />
      ) : null}
    </>
  );
}
