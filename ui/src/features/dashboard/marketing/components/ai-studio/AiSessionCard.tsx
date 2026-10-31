import { memo } from 'react';

import {
  Clapperboard,
  ImageIcon,
  LayoutTemplate,
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
  type LucideIcon,
} from 'lucide-react';

import {
  MarketingTile,
  MarketingTileChip,
} from '@/features/dashboard/marketing/components/shared/MarketingTile';
import {
  AI_OUTPUT_LABEL,
  type AiSessionSummary,
} from '@/features/dashboard/marketing/lib/aiStudioSessions';
import {
  daysUntilPurge,
  formatEditedAt,
} from '@/features/dashboard/marketing/lib/marketingLibrary';
import type { AiStudioOutput } from '@/features/dashboard/marketing/lib/marketingStudioRoute';

import {
  ResponsiveOverflowMenu,
  type ResponsiveOverflowAction,
} from '@/components/mobile/ResponsiveOverflowMenu';
import { Button } from '@/components/ui/button';

export const AI_OUTPUT_ICON: Record<AiStudioOutput, LucideIcon> = {
  post: LayoutTemplate,
  image: ImageIcon,
  video: Clapperboard,
};

export type AiSessionCardActions = {
  onOpen: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onDeleteForever?: () => void;
};

type Props = {
  session: AiSessionSummary;
  actions: AiSessionCardActions;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
};

/** One AI Studio conversation on the home grid: its newest version is the cover. */
export const AiSessionCard = memo(function AiSessionCard({
  session,
  actions,
  selectable,
  selected,
  onToggleSelect,
}: Props) {
  const deleted = Boolean(session.deletedAt);
  const label = AI_OUTPUT_LABEL[session.output].one;
  const Icon = AI_OUTPUT_ICON[session.output];

  const meta = deleted
    ? `${daysUntilPurge(session.deletedAt!)} days left`
    : [
        session.versionCount === 1 ? '1 version' : `${session.versionCount} versions`,
        formatEditedAt(session.updatedAt),
      ]
        .filter(Boolean)
        .join(' · ');

  const groups: ResponsiveOverflowAction[][] = deleted
    ? [
        actions.onRestore
          ? [
              {
                key: 'restore',
                label: 'Restore',
                icon: <RotateCcw className="size-4" aria-hidden />,
                onSelect: actions.onRestore,
              },
            ]
          : [],
        actions.onDeleteForever
          ? [
              {
                key: 'delete-forever',
                label: 'Delete forever',
                destructive: true,
                icon: <Trash2 className="size-4" aria-hidden />,
                onSelect: actions.onDeleteForever,
              },
            ]
          : [],
      ]
    : [
        [
          ...(actions.onRename
            ? [
                {
                  key: 'rename',
                  label: 'Rename',
                  icon: <Pencil className="size-4" aria-hidden />,
                  onSelect: actions.onRename,
                },
              ]
            : []),
        ],
        actions.onDelete
          ? [
              {
                key: 'delete',
                label: 'Delete',
                destructive: true,
                icon: <Trash2 className="size-4" aria-hidden />,
                onSelect: actions.onDelete,
              },
            ]
          : [],
      ];
  const menuGroups = groups.filter((group) => group.length > 0);

  return (
    <MarketingTile
      art={<SessionArt session={session} />}
      name={session.title}
      meta={meta}
      badges={
        <MarketingTileChip>
          <span className="inline-flex items-center gap-1">
            <Icon className="size-3" aria-hidden />
            {label}
          </span>
        </MarketingTileChip>
      }
      corner={
        session.inFlight ? (
          <MarketingTileChip>
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" aria-hidden />
              Making
            </span>
          </MarketingTileChip>
        ) : null
      }
      onOpen={deleted ? (actions.onRestore ?? (() => undefined)) : actions.onOpen}
      openLabel={deleted ? `Restore ${session.title}` : `Open ${session.title}`}
      selectable={selectable}
      selected={selected}
      onToggleSelect={onToggleSelect}
      menu={
        menuGroups.length > 0 ? (
          <ResponsiveOverflowMenu
            label={`${session.title} options`}
            sheetTitle={session.title}
            actionGroups={menuGroups}
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="admin-overflow-trigger text-muted-foreground hover:text-foreground size-8"
                aria-label={`${session.title} options`}
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            }
          />
        ) : null
      }
    />
  );
});

function SessionArt({ session }: { session: AiSessionSummary }) {
  const cover = session.cover;
  const still = cover?.media === 'video' ? cover.posterUrl : cover?.url;
  if (!cover || !still) {
    const Icon = AI_OUTPUT_ICON[session.output];
    return (
      <span className="text-muted-foreground/70 flex size-full flex-col items-center justify-center gap-2">
        {session.inFlight ? (
          <Loader2 className="size-6 animate-spin" aria-hidden />
        ) : (
          <Icon className="size-7" aria-hidden />
        )}
      </span>
    );
  }
  return (
    <span className="relative flex size-full items-center justify-center">
      <img
        src={still}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        className="max-h-full max-w-full select-none rounded-sm object-contain"
      />
      {cover.media === 'video' ? (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="flex size-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
            <Play className="size-4 translate-x-px fill-current" />
          </span>
        </span>
      ) : null}
    </span>
  );
}
