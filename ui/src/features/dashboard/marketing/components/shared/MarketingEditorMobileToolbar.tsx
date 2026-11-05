import { useState, type ComponentType, type ReactNode } from 'react';

import { ChevronUp, MoreHorizontal } from 'lucide-react';

import { mobileFloatingDockClassName } from '@/components/mobile/BottomTabBar';
import { MobileChoiceItem, MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';
import { Button } from '@/components/ui/button';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

export type MarketingEditorMobileOverflowItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  /** Pinned to the row's right edge — e.g. a plan `TierBadge` so paid actions read like desktop. */
  trailing?: ReactNode;
  disabled?: boolean;
  onSelect: () => void;
};

export type MarketingEditorDockPanel = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

type SinglePanelProps = {
  /** Label for the primary panel toggle (e.g. "Templates", "Layers", "Scenes"). */
  panelLabel: string;
  panelIcon: ComponentType<{ className?: string }>;
  panelOpen: boolean;
  onTogglePanel: () => void;
  panels?: never;
  activePanel?: never;
  onSelectPanel?: never;
};

type MultiPanelProps = {
  /** Several sheets (Templates, Edit, AI…), one button each. */
  panels: MarketingEditorDockPanel[];
  activePanel: string | null;
  onSelectPanel: (key: string | null) => void;
  panelLabel?: never;
  panelIcon?: never;
  panelOpen?: never;
  onTogglePanel?: never;
};

type Props = (SinglePanelProps | MultiPanelProps) & {
  /** Always-visible inline controls (zoom, undo/redo) — pass icon buttons ≥44px. */
  controls?: ReactNode;
  /** Secondary actions folded into a ··· choice sheet. */
  overflowItems?: MarketingEditorMobileOverflowItem[];
  overflowLabel?: string;
  className?: string;
};

/**
 * Floating bottom dock for a Marketing Studio editor on mobile (`max-lg`).
 *
 * Sits **directly above** the app's floating bottom tab bar (it does not claim the
 * bottom-bar slot), so the user can still switch pages while an editor is open. The
 * editor keeps its panel toggle + preview controls here; desktop renders nothing.
 */
export function MarketingEditorMobileToolbar({
  panelLabel,
  panelIcon: PanelIcon,
  panelOpen,
  onTogglePanel,
  panels,
  activePanel,
  onSelectPanel,
  controls,
  overflowItems,
  overflowLabel = 'More editor actions',
  className,
}: Props) {
  const isBelowLg = useIsBelowLg();
  const [overflowOpen, setOverflowOpen] = useState(false);

  if (!isBelowLg) return null;

  const hasOverflow = Boolean(overflowItems && overflowItems.length > 0);

  return (
    <>
      <div
        className={cn(
          // Stacked above the app tab bar (`bottom-0`); the tab bar stays visible.
          'pointer-events-none fixed inset-x-0 z-40 px-4',
          'bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))]',
          'touch-manipulation',
          className
        )}
        role="toolbar"
        aria-label="Editor actions"
      >
        <div className={cn(mobileFloatingDockClassName, 'px-3 py-2.5')}>
          <div className="pointer-events-auto flex items-center gap-2">
            {panels ? (
              <div className="flex min-w-0 flex-1 items-center gap-1">
                {panels.map((panel) => {
                  const Icon = panel.icon;
                  const selected = activePanel === panel.key;
                  return (
                    <Button
                      key={panel.key}
                      type="button"
                      variant={selected ? 'default' : 'ghost'}
                      className="h-auto min-h-[44px] min-w-0 flex-1 flex-col gap-0.5 px-1 py-1 text-[10px] font-medium leading-tight"
                      aria-pressed={selected}
                      onClick={() => onSelectPanel(selected ? null : panel.key)}
                    >
                      <Icon className="size-[18px] shrink-0" aria-hidden />
                      <span className="max-w-full truncate">{panel.label}</span>
                    </Button>
                  );
                })}
              </div>
            ) : PanelIcon ? (
              <Button
                type="button"
                variant={panelOpen ? 'default' : 'outline'}
                className="min-h-[44px] flex-1 justify-start gap-2"
                aria-pressed={panelOpen}
                onClick={onTogglePanel}
              >
                <PanelIcon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{panelLabel}</span>
                <ChevronUp
                  className={cn(
                    'ml-auto size-4 shrink-0 transition-transform',
                    panelOpen && 'rotate-180'
                  )}
                  aria-hidden
                />
              </Button>
            ) : null}

            {controls ? <div className="flex shrink-0 items-center gap-1">{controls}</div> : null}

            {hasOverflow ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0"
                aria-label={overflowLabel}
                aria-haspopup="dialog"
                aria-expanded={overflowOpen}
                onClick={() => setOverflowOpen(true)}
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {hasOverflow ? (
        <MobileChoiceSheet open={overflowOpen} onOpenChange={setOverflowOpen} title={overflowLabel}>
          <div role="listbox" aria-label={overflowLabel}>
            {overflowItems!.map((item) => (
              <MobileChoiceItem
                key={item.key}
                label={item.label}
                disabled={item.disabled}
                icon={item.icon}
                trailing={item.trailing}
                onSelect={() => {
                  item.onSelect();
                  setOverflowOpen(false);
                }}
              />
            ))}
          </div>
        </MobileChoiceSheet>
      ) : null}
    </>
  );
}
