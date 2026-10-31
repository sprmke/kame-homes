import * as React from 'react';

import { TelegramManageDialog } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramManageDialog';
import { TelegramModalSaveFooter } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramModalSaveFooter';
import { TelegramPlaceholdersNestedDialog } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramPlaceholdersNestedDialog';
import { TelegramTemplateDialogProvider } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramTemplateDialogContext';
import {
  getTelegramPreviewSamples,
  type TelegramPreviewSampleSet,
} from '@/features/dashboard/bookings/lib/telegramPreviewSamples';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { compactStatusBadgeClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

export type TelegramTemplateTab = {
  id: string;
  label: string;
  badge?: string;
  /** When set, sidebar nav shows on/off indicator. */
  active?: boolean;
  content: React.ReactNode;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  tabs: TelegramTemplateTab[];
  /** Fallback when `placeholdersByTabId` has no entry for the active tab. */
  placeholders?: string[];
  /** Per-tab placeholder catalog lines (filtered in the modal by active tab). */
  placeholdersByTabId?: Record<string, readonly string[]>;
  previewSampleSet?: TelegramPreviewSampleSet;
  disabled?: boolean;
  /** Return a promise resolving `false` when the save failed so the guard keeps the modal open. */
  onSave?: () => void | boolean | Promise<boolean | void>;
  /** Draft differs from the saved settings; closing then prompts. */
  isDirty?: boolean;
  /** Reset the draft to the saved settings. */
  onDiscard?: () => void;
};

function tabBadgeClass(badge: string) {
  if (badge === 'Instant' || badge === 'INSTANT') {
    return compactStatusBadgeClasses('info');
  }
  return compactStatusBadgeClasses('warning');
}

function TabBadge({ badge }: { badge: string }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        tabBadgeClass(badge)
      )}
    >
      {badge}
    </span>
  );
}

type TabNavProps = {
  tabs: TelegramTemplateTab[];
  activeId: string;
  disabled?: boolean;
  layout: 'horizontal' | 'sidebar';
  onSelect: (id: string) => void;
};

function TemplateTabNav({ tabs, activeId, disabled, layout, onSelect }: TabNavProps) {
  const isSidebar = layout === 'sidebar';

  return (
    <div
      className={cn(
        isSidebar
          ? 'md:border-border/60 flex min-h-0 shrink-0 flex-col gap-0.5 md:w-[13.5rem] md:border-r md:pr-4 lg:w-[15rem]'
          : 'border-border/60 -mx-1 mb-4 border-b'
      )}
      role="tablist"
      aria-label="Template types"
    >
      <div
        className={cn(
          isSidebar
            ? 'flex flex-col gap-0.5 md:max-h-[min(56vh,520px)] md:overflow-y-auto md:pr-1'
            : cn(
                'flex gap-0 overflow-x-auto px-1',
                '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
              )
        )}
      >
        {tabs.map((tab) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={disabled}
              className={cn(
                'relative text-sm font-medium transition-colors disabled:opacity-50',
                isSidebar
                  ? cn(
                      'flex min-h-[44px] w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left',
                      selected
                        ? 'bg-primary/10 text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )
                  : cn(
                      'inline-flex min-h-[44px] shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 sm:px-4',
                      selected
                        ? 'border-primary text-foreground'
                        : 'text-muted-foreground hover:border-border hover:text-foreground border-transparent'
                    )
              )}
              onClick={() => onSelect(tab.id)}
            >
              {isSidebar ? (
                <span className="flex min-w-0 flex-1 items-start gap-2">
                  {tab.active !== undefined ? (
                    <span
                      className={cn(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        tab.active ? 'bg-emerald-500' : 'bg-muted-foreground/35'
                      )}
                      aria-hidden
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block leading-snug">{tab.label}</span>
                    {tab.badge ? <TabBadge badge={tab.badge} /> : null}
                  </span>
                </span>
              ) : (
                <>
                  <span className="whitespace-nowrap">{tab.label}</span>
                  {tab.badge ? <TabBadge badge={tab.badge} /> : null}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TelegramTemplatesManageDialog({
  open,
  onOpenChange,
  title = 'Message templates',
  tabs,
  placeholders = [],
  placeholdersByTabId,
  previewSampleSet,
  disabled,
  onSave,
  isDirty = false,
  onDiscard,
}: Props) {
  const { onOpenChange: guardedOpenChange, dialogProps: unsavedDialogProps } = useGuardedClose({
    open,
    onOpenChange,
    isDirty,
    onSave: onSave ? async () => (await onSave()) !== false : undefined,
    onDiscard,
  });
  const placeholderSampleVars = React.useMemo(
    () => (previewSampleSet ? getTelegramPreviewSamples(previewSampleSet) : undefined),
    [previewSampleSet]
  );
  const [activeTab, setActiveTab] = React.useState(tabs[0]?.id ?? '');
  const [placeholdersOpen, setPlaceholdersOpen] = React.useState(false);
  const insertTokenRef = React.useRef<((token: string) => void) | null>(null);

  const useSidebarLayout = tabs.length > 2;
  const showTabNav = tabs.length > 1;

  React.useEffect(() => {
    if (!open) return;
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0]?.id ?? '');
    }
  }, [open, tabs, activeTab]);

  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  const activePlaceholderLines = React.useMemo(() => {
    const tabLines = active?.id ? placeholdersByTabId?.[active.id] : undefined;
    if (tabLines !== undefined) return [...tabLines];
    return placeholders;
  }, [active?.id, placeholders, placeholdersByTabId]);

  const handlePlaceholderInsert = React.useCallback((token: string) => {
    insertTokenRef.current?.(token);
    setPlaceholdersOpen(false);
  }, []);

  const dialogContext = React.useMemo(
    () => ({
      openPlaceholders: () => setPlaceholdersOpen(true),
      disabled,
      insertTokenRef,
    }),
    [disabled]
  );

  return (
    <>
      <TelegramManageDialog
        open={open}
        onOpenChange={guardedOpenChange}
        nestedOverlayOpen={unsavedDialogProps.open}
        title={title}
        size={useSidebarLayout ? 'sidebar' : 'full'}
        footer={
          <TelegramModalSaveFooter
            disabled={disabled}
            onClick={() => {
              onSave?.();
              onOpenChange(false);
            }}
          />
        }
      >
        <TelegramTemplateDialogProvider value={dialogContext}>
          <div
            className={cn(
              useSidebarLayout && 'flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:gap-5'
            )}
          >
            {showTabNav ? (
              <TemplateTabNav
                tabs={tabs}
                activeId={active?.id ?? ''}
                disabled={disabled}
                layout={useSidebarLayout ? 'sidebar' : 'horizontal'}
                onSelect={setActiveTab}
              />
            ) : null}

            <div
              role="tabpanel"
              className={cn(
                'border-border/60 bg-card/50 min-h-0 flex-1 rounded-xl border p-3 sm:p-4',
                useSidebarLayout && 'overflow-y-auto md:max-h-[min(56vh,520px)]'
              )}
            >
              {active?.content}
            </div>
          </div>
        </TelegramTemplateDialogProvider>
      </TelegramManageDialog>

      <UnsavedChangesDialog {...unsavedDialogProps} />

      <TelegramPlaceholdersNestedDialog
        open={placeholdersOpen}
        onOpenChange={setPlaceholdersOpen}
        lines={activePlaceholderLines}
        sampleVars={placeholderSampleVars}
        onInsertToken={handlePlaceholderInsert}
      />
    </>
  );
}

/** Default textarea sizing for template editors inside manage dialogs. */
export const TELEGRAM_TEMPLATE_EDITOR_ROWS = 10;
export const TELEGRAM_TEMPLATE_MIN_HEIGHT = 'min-h-[240px]';
