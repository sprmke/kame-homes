import { Plug, Sparkles, Zap } from 'lucide-react';

import { InboxAutomationTab } from '@/features/dashboard/inbox/components/InboxAutomationTab';
import { InboxChannelsTab } from '@/features/dashboard/inbox/components/InboxChannelsTab';
import { InboxPinnedSnippetsPanel } from '@/features/dashboard/inbox/components/InboxPinnedSnippetsPanel';
import { InboxQuickRepliesTab } from '@/features/dashboard/inbox/components/InboxQuickRepliesTab';
import type {
  InboxAutomationSettings,
  InboxConnection,
  InboxTemplate,
  SaveInboxTemplatePayload,
} from '@/features/dashboard/inbox/types/inbox';

import {
  MobileHeroActionMenu,
  type MobileHeroActionMenuItem,
} from '@/components/mobile/MobileHeroActionButton';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

export type InboxManageModal = 'channels' | 'quick-replies' | 'automation' | null;

type Props = {
  open: InboxManageModal;
  onOpenChange: (open: InboxManageModal) => void;
  canManage: boolean;
  canManageChannels?: boolean;
  canManageQuickReplies?: boolean;
  canManageAutomation?: boolean;
  showChannelsTab?: boolean;
  showSettingsManageTabs?: boolean;
  showPinnedSnippets?: boolean;
  usingOrgMeta?: boolean;
  connections: InboxConnection[];
  connectionsLoading?: boolean;
  connectionsError?: boolean;
  connecting: boolean;
  disconnecting: boolean;
  resubscribing?: boolean;
  onConnectMeta: () => void;
  onDisconnectMeta: () => void;
  onResubscribeMeta: () => void;
  templates: InboxTemplate[];
  templatesLoading: boolean;
  templatesSaving: boolean;
  onSaveTemplate: (payload: SaveInboxTemplatePayload) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
  automationSettings: InboxAutomationSettings | undefined;
  automationLoading: boolean;
  automationSaving: boolean;
  onSaveAutomation: (patch: Partial<InboxAutomationSettings>) => Promise<void>;
};

function buildInboxManageItems(
  showChannelsTab: boolean,
  showSettingsManageTabs: boolean,
  onOpen: (modal: InboxManageModal) => void,
  allowChannels: boolean,
  allowQuickReplies: boolean,
  allowAutomation: boolean
): MobileHeroActionMenuItem[] {
  const items: MobileHeroActionMenuItem[] = [];
  if (showChannelsTab && allowChannels) {
    items.push({
      key: 'channels',
      label: 'Channels',
      Icon: Plug,
      onSelect: () => onOpen('channels'),
    });
  }
  if (showSettingsManageTabs) {
    if (allowQuickReplies) {
      items.push({
        key: 'quick-replies',
        label: 'Quick replies',
        Icon: Zap,
        onSelect: () => onOpen('quick-replies'),
      });
    }
    if (allowAutomation) {
      items.push({
        key: 'automation',
        label: 'Automation',
        Icon: Sparkles,
        onSelect: () => onOpen('automation'),
      });
    }
  }
  return items;
}

function InboxManageActionButton({ item }: { item: MobileHeroActionMenuItem }) {
  const Icon = item.Icon;
  return (
    <Button type="button" variant="outline" onClick={item.onSelect}>
      <Icon aria-hidden />
      {item.label}
    </Button>
  );
}

export function InboxManageToolbar({
  canManage,
  canManageChannels,
  canManageQuickReplies,
  canManageAutomation,
  showChannelsTab = true,
  showSettingsManageTabs = true,
  onOpen,
  variant = 'default',
}: {
  canManage: boolean;
  canManageChannels?: boolean;
  canManageQuickReplies?: boolean;
  canManageAutomation?: boolean;
  showChannelsTab?: boolean;
  showSettingsManageTabs?: boolean;
  onOpen: (modal: InboxManageModal) => void;
  variant?: 'default' | 'hero';
}) {
  if (!canManage) return null;

  const allowChannels = canManageChannels ?? canManage;
  const allowQuickReplies = canManageQuickReplies ?? canManage;
  const allowAutomation = canManageAutomation ?? canManage;
  const items = buildInboxManageItems(
    showChannelsTab,
    showSettingsManageTabs,
    onOpen,
    allowChannels,
    allowQuickReplies,
    allowAutomation
  );
  if (items.length === 0) return null;

  if (variant === 'hero') {
    return <MobileHeroActionMenu items={items} label="Inbox actions" />;
  }

  if (items.length === 1) {
    return <InboxManageActionButton item={items[0]!} />;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {items.map((item) => (
        <InboxManageActionButton key={item.key} item={item} />
      ))}
    </div>
  );
}

export function InboxManageModals({
  open,
  onOpenChange,
  canManage,
  canManageChannels,
  canManageQuickReplies,
  canManageAutomation,
  showChannelsTab = true,
  showSettingsManageTabs = true,
  showPinnedSnippets = false,
  usingOrgMeta = false,
  connections,
  connectionsLoading = false,
  connectionsError = false,
  connecting,
  disconnecting,
  resubscribing = false,
  onConnectMeta,
  onDisconnectMeta,
  onResubscribeMeta,
  templates,
  templatesLoading,
  templatesSaving,
  onSaveTemplate,
  onDeleteTemplate,
  automationSettings,
  automationLoading,
  automationSaving,
  onSaveAutomation,
}: Props) {
  if (!canManage) return null;

  const allowChannels = canManageChannels ?? canManage;
  const allowQuickReplies = canManageQuickReplies ?? canManage;
  const allowAutomation = canManageAutomation ?? canManage;

  return (
    <>
      {showChannelsTab && allowChannels ? (
        <ResponsiveModal
          open={open === 'channels'}
          onOpenChange={(next) => onOpenChange(next ? 'channels' : null)}
        >
          <ResponsiveModalContent
            sheetLayout="split"
            className="flex max-h-[min(90dvh,640px)] max-w-[min(calc(100vw-1.5rem),40rem)] flex-col overflow-hidden sm:max-w-[min(92vw,40rem)]"
          >
            <ResponsiveModalHeader className="shrink-0">
              <ResponsiveModalTitle>Channels</ResponsiveModalTitle>
            </ResponsiveModalHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <InboxChannelsTab
                connections={connections}
                usingOrgMeta={usingOrgMeta}
                statusLoading={connectionsLoading}
                statusError={connectionsError}
                canManage={allowChannels}
                connecting={connecting}
                disconnecting={disconnecting}
                resubscribing={resubscribing}
                onConnectMeta={onConnectMeta}
                onDisconnectMeta={onDisconnectMeta}
                onResubscribeMeta={onResubscribeMeta}
              />
            </div>
          </ResponsiveModalContent>
        </ResponsiveModal>
      ) : null}

      {showSettingsManageTabs ? (
        <>
          {allowQuickReplies ? (
            <ResponsiveModal
              open={open === 'quick-replies'}
              onOpenChange={(next) => onOpenChange(next ? 'quick-replies' : null)}
            >
              <ResponsiveModalContent
                sheetLayout="split"
                className="flex max-h-[min(92dvh,760px)] min-h-0 max-w-[min(calc(100vw-1.5rem),52rem)] flex-col overflow-hidden sm:max-w-[min(92vw,52rem)] lg:min-h-[min(80dvh,560px)]"
              >
                <ResponsiveModalHeader className="shrink-0">
                  <ResponsiveModalTitle>Quick replies</ResponsiveModalTitle>
                </ResponsiveModalHeader>
                <div className="flex min-h-0 flex-1 flex-col">
                  {showPinnedSnippets ? <InboxPinnedSnippetsPanel /> : null}
                  <InboxQuickRepliesTab
                    templates={templates}
                    isLoading={templatesLoading}
                    saving={templatesSaving}
                    onSave={onSaveTemplate}
                    onDelete={onDeleteTemplate}
                  />
                </div>
              </ResponsiveModalContent>
            </ResponsiveModal>
          ) : null}

          {allowAutomation ? (
            <ResponsiveModal
              open={open === 'automation'}
              onOpenChange={(next) => onOpenChange(next ? 'automation' : null)}
            >
              <ResponsiveModalContent
                sheetLayout="split"
                className="flex max-h-[min(92dvh,720px)] max-w-[min(calc(100vw-1.5rem),44rem)] flex-col overflow-hidden sm:max-w-[min(92vw,44rem)]"
              >
                <ResponsiveModalHeader className="shrink-0">
                  <ResponsiveModalTitle>Automation</ResponsiveModalTitle>
                </ResponsiveModalHeader>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <InboxAutomationTab
                    settings={automationSettings}
                    isLoading={automationLoading}
                    saving={automationSaving}
                    onSave={onSaveAutomation}
                  />
                </div>
              </ResponsiveModalContent>
            </ResponsiveModal>
          ) : null}
        </>
      ) : null}
    </>
  );
}
