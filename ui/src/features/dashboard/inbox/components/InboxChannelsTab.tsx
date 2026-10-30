import { useState, type MouseEvent, type ReactElement } from 'react';

import { Loader2, Plug, RefreshCw, Unplug } from 'lucide-react';
import { toast } from 'sonner';

import { MetaLogo, PlatformLogo } from '@/features/dashboard/inbox/components/PlatformLogo';
import { platformLabel } from '@/features/dashboard/inbox/lib/inboxFormat';
import { isMetaSyncConnectionError } from '@/features/dashboard/inbox/lib/metaInboxSyncErrors';
import type { InboxConnection } from '@/features/dashboard/inbox/types/inbox';
import { TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { FeatureAvailabilityButton } from '@/components/feature-availability/FeatureAvailabilityButton';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { toastFeatureUnavailable } from '@/lib/featureAvailability/featureUnavailableError';
import { useFeatureAvailability } from '@/lib/featureAvailability/useFeatureAvailability';
import { cn } from '@/lib/utils';

function InboxChannelsTabSkeleton() {
  return (
    <ul
      className="divide-border border-border divide-y overflow-hidden rounded-lg border"
      aria-busy="true"
      aria-label="Loading channels"
    >
      <li className="px-3 py-3 sm:px-4 sm:py-3.5">
        <div className="flex items-start gap-3">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3 w-48 max-w-full" />
          </div>
          <Skeleton className="h-9 w-28 shrink-0 rounded-md" />
        </div>
      </li>
    </ul>
  );
}

function webhookWarning(conn: InboxConnection | undefined): string | null {
  if (!conn || conn.status !== 'connected' || conn.isPreview) return null;
  if (conn.errorMessage && isMetaSyncConnectionError(conn.errorMessage)) return null;
  if (conn.webhookSubscribed === false) {
    return conn.errorMessage ?? 'Live messages may not arrive.';
  }
  return conn.errorMessage;
}

type Props = {
  connections: InboxConnection[];
  usingOrgMeta?: boolean;
  statusLoading?: boolean;
  statusError?: boolean;
  canManage: boolean;
  connecting: boolean;
  disconnecting: boolean;
  resubscribing?: boolean;
  onConnectMeta: () => void;
  onDisconnectMeta: () => void;
  onResubscribeMeta: () => void;
};

function metaConnection(
  connections: InboxConnection[],
  platform: 'facebook' | 'instagram'
): InboxConnection | undefined {
  return connections.find((c) => c.platform === platform);
}

function isMetaChannelConnected(conn: InboxConnection | undefined): boolean {
  return !!conn && conn.status === 'connected' && !conn.isPreview;
}

type MetaUiState = 'disconnected' | 'connected' | 'partial' | 'error';

function resolveMetaUiState(
  fb: InboxConnection | undefined,
  ig: InboxConnection | undefined
): MetaUiState {
  if (fb?.status === 'error') return 'error';
  const fbOk = isMetaChannelConnected(fb);
  const igOk = isMetaChannelConnected(ig);
  if (!fbOk && !igOk) return 'disconnected';
  if (fbOk && !igOk) return 'partial';
  return 'connected';
}

function MetaPlatformRow({
  platform,
  conn,
  metaState,
}: {
  platform: 'facebook' | 'instagram';
  conn: InboxConnection | undefined;
  metaState: MetaUiState;
}) {
  const connected = isMetaChannelConnected(conn);
  const webhookNote = webhookWarning(conn);

  let detail: string | null = null;
  if (
    conn?.status === 'error' &&
    conn.errorMessage &&
    !isMetaSyncConnectionError(conn.errorMessage)
  ) {
    detail = conn.errorMessage;
  } else if (connected && conn?.displayName) {
    detail = conn.displayName;
  } else if (platform === 'instagram' && metaState === 'partial') {
    detail = 'Not linked to your Facebook Page';
  } else if (metaState === 'disconnected') {
    detail = null;
  }

  return (
    <div className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
      <PlatformLogo platform={platform} size="xs" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm">{platformLabel(platform)}</p>
          {connected ? (
            <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
          ) : (
            <span className="text-muted-foreground text-xs">Not connected</span>
          )}
        </div>
        {detail && (
          <p
            className={cn(
              'mt-0.5 truncate text-xs',
              conn?.status === 'error' ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {detail}
          </p>
        )}
        {webhookNote && !detail?.includes(webhookNote) && (
          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">{webhookNote}</p>
        )}
      </div>
    </div>
  );
}

export function InboxChannelsTab({
  connections,
  usingOrgMeta = false,
  statusLoading = false,
  statusError = false,
  canManage,
  connecting,
  disconnecting,
  resubscribing = false,
  onConnectMeta,
  onDisconnectMeta,
  onResubscribeMeta,
}: Props) {
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  const fbConn = metaConnection(connections, 'facebook');
  const igConn = metaConnection(connections, 'instagram');
  const metaState = resolveMetaUiState(fbConn, igConn);
  const metaConnected = metaState !== 'disconnected';
  const needsWebhookRepair = Boolean(
    (fbConn?.status === 'connected' &&
      (fbConn.webhookNeedsAttention || fbConn.webhookSubscribed === false)) ||
    (igConn?.status === 'connected' &&
      (igConn.webhookNeedsAttention || igConn.webhookSubscribed === false))
  );

  const { canUse: canUseMetaChatChannel, isLoading: metaChatChannelLoading } =
    useFeatureGate('metaChatChannel');
  const { open: openUpgradeModal } = useUpgradeModal();
  const metaConnectAvailability = useFeatureAvailability('inbox.meta.connect');

  const handleConnect = () => {
    if (statusLoading) return;
    if (statusError) {
      toast.error('Could not load channels. Refresh and try again.');
      return;
    }
    if (!metaConnectAvailability.available) {
      toastFeatureUnavailable(metaConnectAvailability.message);
      return;
    }
    if (!canUseMetaChatChannel) {
      if (!metaChatChannelLoading) openUpgradeModal('metaChatChannel');
      return;
    }
    onConnectMeta();
  };

  const confirmDisconnect = () => {
    onDisconnectMeta();
    setDisconnectOpen(false);
  };

  type MetaChannelButton = ReactElement<{
    className?: string;
    disabled?: boolean;
    onClick?: (e: MouseEvent) => void;
  }>;

  const wrapMetaChannelAction = (button: MetaChannelButton) => {
    if (!metaConnectAvailability.available) {
      return (
        <FeatureAvailabilityButton featureKey="inbox.meta.connect">
          {button}
        </FeatureAvailabilityButton>
      );
    }
    if (!canUseMetaChatChannel) {
      return <TierBadgeAnchor feature="metaChatChannel">{button}</TierBadgeAnchor>;
    }
    return button;
  };

  const showConnect = canManage && metaState === 'disconnected';
  const showReconnect = canManage && (metaState === 'error' || metaState === 'partial');
  const showFixConnection = canManage && metaConnected && needsWebhookRepair && !showReconnect;
  const showDisconnect = canManage && metaConnected;

  if (statusLoading) {
    return <InboxChannelsTabSkeleton />;
  }

  return (
    <>
      <ul className="divide-border border-border divide-y overflow-hidden rounded-lg border">
        <li className="px-3 py-3 sm:px-4 sm:py-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <MetaLogo size="sm" className="shrink-0 pt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">Meta</p>
                  {usingOrgMeta ? (
                    <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px] font-medium">
                      Using org Meta
                    </span>
                  ) : null}
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {metaState === 'disconnected'
                    ? 'Connect Facebook Messenger and Instagram DMs'
                    : 'Facebook Messenger + Instagram DMs'}
                </p>
              </div>
            </div>

            {canManage && (
              <div className="flex flex-wrap items-center justify-end gap-2 sm:shrink-0">
                {showConnect &&
                  wrapMetaChannelAction(
                    <Button
                      type="button"
                      size="sm"
                      variant="outline-primary"
                      className="h-9 min-h-[44px] gap-1.5 px-3 sm:min-h-9"
                      disabled={connecting || statusLoading}
                      onClick={handleConnect}
                    >
                      {connecting ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <>
                          <Plug className="size-4" aria-hidden />
                          Connect Meta
                        </>
                      )}
                    </Button>
                  )}
                {showReconnect &&
                  wrapMetaChannelAction(
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 min-h-[44px] gap-1.5 px-3 sm:min-h-9"
                      disabled={connecting}
                      onClick={handleConnect}
                    >
                      {connecting ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <>
                          <RefreshCw className="size-4" aria-hidden />
                          Reconnect
                        </>
                      )}
                    </Button>
                  )}
                {showFixConnection &&
                  wrapMetaChannelAction(
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 min-h-[44px] gap-1.5 px-3 sm:min-h-9"
                      disabled={resubscribing}
                      onClick={onResubscribeMeta}
                    >
                      {resubscribing ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <>
                          <RefreshCw className="size-4" aria-hidden />
                          Fix connection
                        </>
                      )}
                    </Button>
                  )}
                {showDisconnect &&
                  wrapMetaChannelAction(
                    <Button
                      type="button"
                      size="sm"
                      variant="soft-destructive"
                      className="h-9 min-h-[44px] gap-1.5 px-3 sm:min-h-9"
                      disabled={disconnecting}
                      onClick={() => setDisconnectOpen(true)}
                    >
                      {disconnecting ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <>
                          <Unplug className="size-4" aria-hidden />
                          Disconnect
                        </>
                      )}
                    </Button>
                  )}
              </div>
            )}
          </div>

          {metaConnected && (
            <div className="border-border/80 mt-3 border-t pl-4 pt-3">
              <MetaPlatformRow platform="facebook" conn={fbConn} metaState={metaState} />
              <MetaPlatformRow platform="instagram" conn={igConn} metaState={metaState} />
            </div>
          )}
        </li>
      </ul>

      <ResponsiveModal open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <ResponsiveModalContent className="sm:max-w-[28rem]">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Disconnect Meta?</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <p className="text-muted-foreground text-sm">
            Synced Facebook and Instagram conversations will be removed from this inbox.
          </p>
          <ResponsiveModalFooter className="gap-1">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] sm:min-h-9"
              disabled={disconnecting}
              onClick={() => setDisconnectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-[44px] sm:min-h-9"
              disabled={disconnecting}
              onClick={confirmDisconnect}
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}
