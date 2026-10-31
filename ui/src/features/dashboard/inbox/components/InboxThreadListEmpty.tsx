import { Plug, RefreshCw } from 'lucide-react';

import { FeatureUnavailablePanel } from '@/components/feature-availability/FeatureUnavailablePanel';
import { TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';

import { Button } from '@/components/ui/button';

type Props = {
  variant:
    | 'not-connected'
    | 'syncing'
    | 'sync-error'
    | 'load-error'
    | 'empty'
    | 'search-not-loaded'
    | 'search-empty'
    | 'feature-unavailable';
  featureUnavailableLabel?: string;
  featureUnavailableMessage?: string;
  featureUnavailableExpectedBack?: string | null;
  canConnect: boolean;
  syncError?: string | null;
  loadError?: string | null;
  onConnect?: () => void;
  onRetryLoad?: () => void;
  canLoadOlderFromMeta?: boolean;
  onLoadOlderFromMeta?: () => void;
  loadingOlderFromMeta?: boolean;
};

export function InboxThreadListEmpty({
  variant,
  canConnect,
  syncError,
  loadError,
  onConnect,
  onRetryLoad,
  canLoadOlderFromMeta = false,
  onLoadOlderFromMeta,
  loadingOlderFromMeta = false,
  featureUnavailableLabel,
  featureUnavailableMessage,
  featureUnavailableExpectedBack,
}: Props) {
  if (variant === 'feature-unavailable') {
    return (
      <FeatureUnavailablePanel
        compact
        label={featureUnavailableLabel ?? 'Facebook and Instagram chat'}
        message={featureUnavailableMessage ?? 'This feature is temporarily unavailable.'}
        expectedBackLabel={featureUnavailableExpectedBack}
      />
    );
  }

  if (variant === 'not-connected') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-muted-foreground text-sm">Connect Meta to receive messages.</p>
        {canConnect && onConnect && (
          <TierBadgeAnchor feature="metaChatChannel">
            <Button
              type="button"
              variant="outline-primary"
              size="sm"
              className="h-9 min-h-[44px] gap-1.5 px-3"
              onClick={onConnect}
            >
              <Plug className="size-4" aria-hidden />
              Connect
            </Button>
          </TierBadgeAnchor>
        )}
      </div>
    );
  }

  if (variant === 'syncing') {
    return (
      <p className="sr-only" aria-live="polite">
        Loading conversations from Meta
      </p>
    );
  }

  if (variant === 'sync-error') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-destructive text-sm">{syncError ?? 'Could not load conversations.'}</p>
        {canConnect && onConnect && (
          <TierBadgeAnchor feature="metaChatChannel">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 min-h-[44px] gap-1.5 px-3"
              onClick={onConnect}
            >
              <RefreshCw className="size-4" aria-hidden />
              Reconnect
            </Button>
          </TierBadgeAnchor>
        )}
      </div>
    );
  }

  if (variant === 'search-not-loaded') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-6 text-center">
        <p className="text-muted-foreground text-sm">
          Search covers loaded conversations only. Older threads that haven&apos;t been loaded from
          Meta yet aren&apos;t searchable.
        </p>
        {canLoadOlderFromMeta && onLoadOlderFromMeta ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 min-h-[44px] px-3"
            disabled={loadingOlderFromMeta}
            onClick={onLoadOlderFromMeta}
          >
            {loadingOlderFromMeta ? (
              <RefreshCw className="size-4 animate-spin" aria-hidden />
            ) : (
              'Load older from Meta'
            )}
          </Button>
        ) : null}
      </div>
    );
  }

  if (variant === 'search-empty') {
    return (
      <p className="text-muted-foreground p-6 text-center text-sm">
        No conversations match your search.
      </p>
    );
  }

  if (variant === 'load-error') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-destructive text-sm">{loadError ?? 'Could not load conversations.'}</p>
        {onRetryLoad ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 min-h-[44px] gap-1.5 px-3"
            onClick={onRetryLoad}
          >
            <RefreshCw className="size-4" aria-hidden />
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  return <p className="text-muted-foreground p-6 text-center text-sm">No messages yet.</p>;
}
