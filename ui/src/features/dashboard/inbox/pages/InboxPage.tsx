import { useEffect, useMemo, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import { toast } from 'sonner';

import { useAdminLayoutFillMain } from '@/features/dashboard/bookings/lib/adminLayoutFillMain';
import { InboxConversationView } from '@/features/dashboard/inbox/components/InboxConversationView';
import {
  InboxManageModals,
  InboxManageToolbar,
  type InboxManageModal,
} from '@/features/dashboard/inbox/components/InboxManageModals';
import { InboxPlatformTabs } from '@/features/dashboard/inbox/components/InboxPlatformTabs';
import { InboxThreadList } from '@/features/dashboard/inbox/components/InboxThreadList';
import {
  MetaInboxOperationModal,
  type MetaInboxOperation,
} from '@/features/dashboard/inbox/components/MetaInboxOperationModal';
import { MetaPagePickerDialog } from '@/features/dashboard/inbox/components/MetaPagePickerDialog';
import {
  useInboxAutomationSettings,
  useInboxConnections,
  useInboxMessages,
  useInboxMockActive,
  useInboxMutations,
  useInboxRealtime,
  useInboxTemplates,
  useInboxThreads,
  useMetaInboxSync,
  useMetaOAuthPagePicker,
} from '@/features/dashboard/inbox/hooks/useInbox';
import type { InboxApiScope } from '@/features/dashboard/inbox/lib/inboxApi';
import { metaInboxOAuthErrorMessage } from '@/features/dashboard/inbox/lib/metaInboxOAuthErrors';
import type {
  InboxConversation,
  ThreadPlatformFilter,
  ThreadStatusFilter,
} from '@/features/dashboard/inbox/types/inbox';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { bottomTabBarOffsetClassName } from '@/components/mobile/BottomTabBar';
import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { cn } from '@/lib/utils';

export type InboxPageProps = {
  kind: 'property' | 'parking';
  returnPath: string;
  canReply: boolean;
  canManage: boolean;
  canManageChannels?: boolean;
  canManageQuickReplies?: boolean;
  canManageAutomation?: boolean;
  /** Quick replies + Automation. Property and parking both show these; only Channels (Meta) is property-only. */
  showSettingsManageTabs: boolean;
  scope?: InboxApiScope | null;
  orgSlug: string | null;
  orgId: string | null;
};

export function InboxPage({
  kind,
  returnPath,
  canReply,
  canManage,
  canManageChannels,
  canManageQuickReplies,
  canManageAutomation,
  showSettingsManageTabs,
  scope,
  orgSlug,
  orgId,
}: InboxPageProps) {
  const showChannelsTab = kind === 'property';
  const allowChannels = canManageChannels ?? canManage;
  const allowQuickReplies = canManageQuickReplies ?? canManage;
  const allowAutomation = canManageAutomation ?? canManage;
  useAdminLayoutFillMain(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const [manageModal, setManageModal] = useState<InboxManageModal>(null);
  const [pagePickerState, setPagePickerState] = useState<string | null>(null);
  const conversationIdParam = searchParams.get('conversationId');
  const platformParam = searchParams.get('platform');
  const [selectedId, setSelectedId] = useState<string | null>(() => conversationIdParam);
  const [mobileShowConversation, setMobileShowConversation] = useState(() => !!conversationIdParam);
  const [statusFilter, setStatusFilter] = useState<ThreadStatusFilter>('all');
  const [platformFilter, setPlatformFilter] = useState<ThreadPlatformFilter>(() => {
    if (platformParam === 'web' || platformParam === 'facebook' || platformParam === 'instagram') {
      return platformParam;
    }
    // Parking has Chat only — skip the aggregating "All" filter.
    return showChannelsTab ? 'all' : 'web';
  });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!conversationIdParam) return;
    setSelectedId(conversationIdParam);
    setMobileShowConversation(true);
    if (platformParam === 'web' || platformParam === 'facebook' || platformParam === 'instagram') {
      setPlatformFilter(platformParam);
    }
  }, [conversationIdParam, platformParam]);

  const selectConversation = (id: string) => {
    setSelectedId(id);
    setMobileShowConversation(true);
    const next = new URLSearchParams(searchParams);
    next.set('conversationId', id);
    setSearchParams(next, { replace: true });
  };

  const mockActive = useInboxMockActive();
  const { canUse: canUseMetaChatChannel, isLoading: metaChatChannelLoading } =
    useFeatureGate('metaChatChannel');
  const { open: openUpgradeModal } = useUpgradeModal();

  useInboxRealtime(orgId);

  const {
    data: connectionsData,
    isLoading: connectionsLoading,
    isError: connectionsError,
  } = useInboxConnections(orgSlug, orgId, scope);
  const metaSyncInProgress = connectionsData?.metaSyncInProgress ?? false;
  const metaSyncError = connectionsData?.metaSyncError ?? null;
  useMetaInboxSync(orgSlug, orgId, metaSyncInProgress, scope);
  const {
    data: threadsData,
    isLoading: threadsLoading,
    isError: threadsError,
    error: threadsErrorValue,
    refetch: refetchThreads,
    fetchNextPage: fetchMoreThreads,
    hasNextPage: hasMoreThreads,
    isFetchingNextPage: loadingMoreThreads,
    canLoadOlderFromMeta,
    loadOlderFromMeta,
    loadingOlderFromMeta,
  } = useInboxThreads(
    orgSlug,
    orgId,
    {
      status: statusFilter,
      platform: platformFilter,
      search,
    },
    scope
  );
  const {
    data: messagesData,
    isLoading: messagesLoading,
    error: messagesErrorValue,
    refetch: refetchMessages,
    fetchNextPage: fetchOlderMessages,
    hasNextPage: hasOlderMessages,
    isFetchingNextPage: loadingOlderMessages,
  } = useInboxMessages(orgSlug, orgId, selectedId, scope);
  const {
    connectMeta,
    disconnectMeta,
    resubscribeMeta,
    sendReply,
    uploadAttachment,
    editMessage,
    unsendMessage,
    aiSuggest,
  } = useInboxMutations(orgSlug, orgId, scope);
  const templatesQuery = useInboxTemplates(orgSlug, orgId, scope, showSettingsManageTabs);
  const automationQuery = useInboxAutomationSettings(orgSlug, orgId, scope, showSettingsManageTabs);
  const pagePicker = useMetaOAuthPagePicker(orgSlug, orgId, pagePickerState, scope);

  const conversations = useMemo(() => {
    const seen = new Set<string>();
    const merged: InboxConversation[] = [];
    for (const page of threadsData?.pages ?? []) {
      for (const c of page.conversations) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        merged.push(c);
      }
    }
    return merged;
  }, [threadsData?.pages]);
  const messages = useMemo(() => {
    if (!messagesData?.pages.length) return [];
    return [...messagesData.pages].reverse().flatMap((p) => p.messages);
  }, [messagesData?.pages]);
  const messagesConversation = messagesData?.pages[0]?.conversation ?? null;
  const metaConnected = useMemo(
    () =>
      (connectionsData?.connections ?? []).some(
        (c) =>
          (c.platform === 'facebook' || c.platform === 'instagram') &&
          c.status === 'connected' &&
          !c.isPreview
      ),
    [connectionsData?.connections]
  );
  const metaHasMore =
    connectionsData?.metaHasMore ?? threadsData?.pages.at(-1)?.metaHasMore ?? false;
  const threadEmptyVariant = useMemo(() => {
    if (mockActive) return 'empty' as const;
    if (threadsError && conversations.length === 0) return 'load-error' as const;
    if (platformFilter === 'web' || !showChannelsTab) return 'empty' as const;
    if (!metaConnected) return 'not-connected' as const;
    if (metaSyncError && conversations.length === 0) return 'sync-error' as const;
    if (metaSyncInProgress && conversations.length === 0) return 'syncing' as const;
    if (search) {
      if (metaHasMore) return 'search-not-loaded' as const;
      return 'search-empty' as const;
    }
    return 'empty' as const;
  }, [
    mockActive,
    platformFilter,
    threadsError,
    showChannelsTab,
    metaConnected,
    metaSyncError,
    metaSyncInProgress,
    conversations.length,
    search,
    metaHasMore,
  ]);

  const handleConnectMeta = () => {
    if (!canUseMetaChatChannel) {
      if (!metaChatChannelLoading) openUpgradeModal('metaChatChannel');
      return;
    }
    connectMeta.mutate(returnPath, {
      onSuccess: () => {
        if (mockActive) toast.success('Preview: Meta channels connected');
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const metaOperation = useMemo((): MetaInboxOperation | null => {
    if (disconnectMeta.isPending) return 'disconnect';
    if (metaSyncInProgress) return 'sync';
    if (connectMeta.isPending && mockActive) return 'connect';
    return null;
  }, [connectMeta.isPending, disconnectMeta.isPending, metaSyncInProgress, mockActive]);

  useEffect(() => {
    if (metaOperation === null) return;
    setManageModal(null);
    setPagePickerState(null);
  }, [metaOperation]);

  const selectedConversation = useMemo(() => {
    const fromList = conversations.find((c) => c.id === selectedId) ?? null;
    if (fromList && messagesConversation?.id === fromList.id) {
      return {
        ...fromList,
        participant_name: messagesConversation.participant_name || fromList.participant_name,
        participant_avatar_url:
          messagesConversation.participant_avatar_url || fromList.participant_avatar_url,
      };
    }
    return fromList ?? messagesConversation ?? null;
  }, [conversations, selectedId, messagesConversation]);

  useEffect(() => {
    const metaStatus = searchParams.get('meta_inbox');
    const metaError = searchParams.get('meta_inbox_error');
    const metaPicker = searchParams.get('meta_picker');
    if (metaStatus === 'connected') {
      toast.success('Meta channels connected', { id: 'meta-inbox-connected' });
    }
    if (metaStatus === 'select_page' && metaPicker) {
      setPagePickerState(metaPicker);
    }
    if (metaError) {
      toast.error(metaInboxOAuthErrorMessage(metaError));
      setManageModal('channels');
    }
    if (metaStatus || metaError || metaPicker) {
      const next = new URLSearchParams(searchParams);
      next.delete('meta_inbox');
      next.delete('meta_inbox_error');
      next.delete('meta_picker');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <AdminMobilePage
      title="Guest Inbox"
      subtitle="View and reply to guest messages from connected channels."
      titleId="inbox-heading"
      heroTrailing={
        <InboxManageToolbar
          canManage={canManage}
          canManageChannels={allowChannels}
          canManageQuickReplies={allowQuickReplies}
          canManageAutomation={allowAutomation}
          showChannelsTab={showChannelsTab}
          showSettingsManageTabs={showSettingsManageTabs}
          onOpen={setManageModal}
          variant="hero"
        />
      }
      desktopActions={
        <InboxManageToolbar
          canManage={canManage}
          canManageChannels={allowChannels}
          canManageQuickReplies={allowQuickReplies}
          canManageAutomation={allowAutomation}
          showChannelsTab={showChannelsTab}
          showSettingsManageTabs={showSettingsManageTabs}
          onOpen={setManageModal}
        />
      }
      className="flex min-h-0 flex-1 flex-col"
    >
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:min-h-[480px]',
          /* Fill-main skips shell tab `pb` — keep the composer / list above the dock. */
          bottomTabBarOffsetClassName()
        )}
      >
        {mockActive && (
          <div
            className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-950 dark:text-amber-100"
            role="status"
          >
            Preview data — not connected to live platforms. Remove{' '}
            <code className="bg-background/60 rounded px-1">VITE_INBOX_MOCK_DATA</code> or{' '}
            <code className="bg-background/60 rounded px-1">?mock=true</code>.
          </div>
        )}

        <div className="border-border/80 bg-card relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-sm">
          <InboxPlatformTabs
            value={platformFilter}
            onChange={setPlatformFilter}
            platforms={showChannelsTab ? undefined : ['web']}
          />

          <div className="flex min-h-0 flex-1">
            <div
              className={cn(
                'border-border/80 flex h-full min-h-0 w-full shrink-0 flex-col border-r lg:w-[min(100%,400px)]',
                mobileShowConversation ? 'hidden lg:flex' : 'flex'
              )}
            >
              <InboxThreadList
                conversations={conversations}
                isLoading={(threadsLoading || metaSyncInProgress) && conversations.length === 0}
                selectedId={selectedId}
                platformFilter={platformFilter}
                onSelect={selectConversation}
                statusFilter={statusFilter}
                search={searchInput}
                onStatusFilter={setStatusFilter}
                onSearch={setSearchInput}
                emptyVariant={threadEmptyVariant}
                syncError={metaSyncError}
                loadError={threadsErrorValue instanceof Error ? threadsErrorValue.message : null}
                canConnect={allowChannels}
                onConnect={handleConnectMeta}
                onRetryLoad={() => void refetchThreads()}
                hasMore={!!hasMoreThreads}
                loadingMore={loadingMoreThreads || loadingOlderFromMeta}
                onLoadMore={() => void fetchMoreThreads()}
                canLoadOlderFromMeta={canLoadOlderFromMeta}
                onLoadOlderFromMeta={() =>
                  void loadOlderFromMeta().catch((e) =>
                    toast.error(e instanceof Error ? e.message : 'Could not load older messages')
                  )
                }
              />
            </div>
            <div
              className={cn(
                'flex h-full min-h-0 min-w-0 flex-1 flex-col',
                mobileShowConversation ? 'flex' : 'hidden lg:flex'
              )}
            >
              <InboxConversationView
                conversation={selectedConversation}
                messages={messages}
                isLoading={messagesLoading && !!selectedId}
                canReply={canReply}
                templates={templatesQuery.data ?? []}
                onBack={() => setMobileShowConversation(false)}
                hasOlderMessages={!!hasOlderMessages}
                loadingOlder={loadingOlderMessages}
                onLoadOlder={() => void fetchOlderMessages()}
                loadError={messagesErrorValue instanceof Error ? messagesErrorValue.message : null}
                onRetryLoad={() => void refetchMessages()}
                onSend={async (text, opts) => {
                  if (!selectedId) return;
                  await sendReply.mutateAsync({
                    conversationId: selectedId,
                    text,
                    replyToMessageId: opts?.replyToMessageId,
                    useHumanAgentTag: opts?.useHumanAgentTag,
                    attachments: opts?.attachments,
                  });
                }}
                onUploadAttachment={
                  selectedId
                    ? (file) => uploadAttachment.mutateAsync({ conversationId: selectedId, file })
                    : undefined
                }
                onEdit={async (messageId, text) => {
                  if (!selectedId) return;
                  await editMessage.mutateAsync({ conversationId: selectedId, messageId, text });
                }}
                onUnsend={async (messageId) => {
                  if (!selectedId) return;
                  await unsendMessage.mutateAsync({ conversationId: selectedId, messageId });
                }}
                onSuggest={async () => {
                  if (!selectedId) throw new Error('No conversation selected');
                  return aiSuggest.mutateAsync(selectedId);
                }}
                sending={sendReply.isPending}
                uploadingAttachment={uploadAttachment.isPending}
                editing={editMessage.isPending}
                unsending={unsendMessage.isPending}
                suggesting={aiSuggest.isPending}
              />
            </div>
          </div>

          <MetaInboxOperationModal
            open={metaOperation !== null}
            operation={metaOperation ?? 'sync'}
            loadedCount={conversations.length}
          />
        </div>

        <InboxManageModals
          open={manageModal}
          onOpenChange={setManageModal}
          canManage={canManage}
          canManageChannels={allowChannels}
          canManageQuickReplies={allowQuickReplies}
          canManageAutomation={allowAutomation}
          showChannelsTab={showChannelsTab}
          showSettingsManageTabs={showSettingsManageTabs}
          showPinnedSnippets={kind === 'property'}
          usingOrgMeta={connectionsData?.usingOrgMeta}
          connections={connectionsData?.connections ?? []}
          connectionsLoading={connectionsLoading}
          connectionsError={connectionsError}
          connecting={connectMeta.isPending}
          disconnecting={disconnectMeta.isPending}
          resubscribing={resubscribeMeta.isPending}
          onConnectMeta={handleConnectMeta}
          onDisconnectMeta={() =>
            disconnectMeta.mutate(undefined, {
              onSuccess: () => {
                setSelectedId(null);
                setMobileShowConversation(false);
                const next = new URLSearchParams(searchParams);
                next.delete('conversationId');
                setSearchParams(next, { replace: true });
                toast.success(mockActive ? 'Preview: disconnected' : 'Meta disconnected');
              },
              onError: (e) => toast.error(e.message),
            })
          }
          onResubscribeMeta={() =>
            resubscribeMeta.mutate(undefined, {
              onSuccess: (result) => {
                toast.success(result.resubscribed ? 'Connection fixed' : 'Connection verified');
              },
              onError: (e) => toast.error(e.message),
            })
          }
          templates={templatesQuery.data ?? []}
          templatesLoading={templatesQuery.isLoading}
          templatesSaving={templatesQuery.save.isPending}
          onSaveTemplate={async (payload) => {
            await templatesQuery.save.mutateAsync(payload);
          }}
          onDeleteTemplate={async (id) => {
            await templatesQuery.remove.mutateAsync(id);
          }}
          automationSettings={automationQuery.data}
          automationLoading={automationQuery.isLoading}
          automationSaving={automationQuery.patch.isPending}
          onSaveAutomation={async (patch) => {
            await automationQuery.patch.mutateAsync(patch);
          }}
        />
        <MetaPagePickerDialog
          open={!!pagePickerState}
          pages={pagePicker.pagesQuery.data ?? []}
          loading={pagePicker.pagesQuery.isLoading}
          error={
            pagePicker.pagesQuery.isError ? (pagePicker.pagesQuery.error as Error).message : null
          }
          completing={pagePicker.complete.isPending}
          onConnect={(pageId) => {
            pagePicker.complete.mutate(pageId, {
              onSuccess: (data) => {
                toast.success(
                  data.pageName ? `Connected ${data.pageName}` : 'Meta channels connected'
                );
                setPagePickerState(null);
              },
              onError: (e) => toast.error(e.message),
            });
          }}
          onOpenChange={(open) => {
            if (!open) setPagePickerState(null);
          }}
        />
      </div>
    </AdminMobilePage>
  );
}
