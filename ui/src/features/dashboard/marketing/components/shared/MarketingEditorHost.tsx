import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';

import { useLocation } from 'react-router-dom';

import { FileX2, Trash2 } from 'lucide-react';

import { useMarketingTheme } from '@/features/dashboard/marketing/components/themes/MarketingThemeProvider';
import {
  useMarketingItem,
  useRestoreMarketingItems,
} from '@/features/dashboard/marketing/hooks/useMarketingLibrary';
import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import {
  isMarketingDeletedError,
  type MarketingContentType,
  type MarketingTemplateRecord,
} from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import {
  CONTENT_NOUN,
  normalizeStartSize,
} from '@/features/dashboard/marketing/lib/marketingLibrary';
import {
  wantsOpenAi,
  type MarketingTemplateRef,
} from '@/features/dashboard/marketing/lib/marketingStudioRoute';
import { MARKETING_STUDIO_TAB_LABELS } from '@/features/dashboard/marketing/lib/theme/marketingStudioNav';

import { MarketingEditorSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';

/** What an editor opens: a saved design, or a draft from a template. */
export type MarketingEditorDocument =
  | { mode: 'saved'; record: MarketingTemplateRecord }
  | {
      mode: 'draft';
      from: MarketingTemplateRef | null;
      size: string;
      /** Loaded saved template when `from` is `tpl:<uuid>`. */
      templateRecord: MarketingTemplateRecord | null;
      /** Open the AI panel on arrival (Library "Start with AI"). */
      openAi: boolean;
    };

export type MarketingEditorNav = {
  /** Leave for the Library. */
  back: () => void;
  /** A draft was stored for the first time. */
  onCreated: (record: MarketingTemplateRecord) => void;
  /** Open another saved design (sibling size, copy, AI result). */
  openItem: (id: string, options?: { replace?: boolean }) => void;
  /** Start (or, with `replace`, swap) a draft from a template. */
  startDraft: (
    from: MarketingTemplateRef | null,
    options?: { size?: string | null; replace?: boolean }
  ) => void;
  backLabel: string;
};

type Props = {
  contentType: MarketingContentType;
  children: (document: MarketingEditorDocument, nav: MarketingEditorNav) => ReactNode;
};

/**
 * Loads what the URL points at (`?item=`) and mounts the editor once. When a draft is
 * stored the URL swaps to its id without remounting, so the canvas never reloads.
 */
export function MarketingEditorHost({ contentType, children }: Props) {
  const { item, tab, closeItem, replaceDraftWithItem, openItem, startDraft } = useMarketingTheme();
  const location = useLocation();
  const createdIdsRef = useRef(new Set<string>());
  const { canDeleteTemplate } = useMarketingPermissions();
  const restore = useRestoreMarketingItems();

  const savedId = item.mode === 'saved' ? item.id : null;
  const createdHere = savedId ? createdIdsRef.current.has(savedId) : false;
  // Only the draft that created a row skips loading it; anywhere else it loads normally.
  useEffect(() => {
    if (!createdHere) createdIdsRef.current.clear();
  }, [createdHere, item]);

  // A design this editor just created is already on screen: no load, no remount.
  const record = useMarketingItem(createdHere ? null : savedId);
  const templateId = item.mode === 'draft' && item.from?.kind === 'template' ? item.from.id : null;
  const template = useMarketingItem(templateId);

  const openAi = item.mode === 'draft' && wantsOpenAi(location.state);
  const draftKey =
    item.mode === 'draft'
      ? `draft:${item.from ? JSON.stringify(item.from) : 'none'}:${item.size ?? ''}`
      : null;

  // Editor identity: stays the same across "draft became saved" (created here).
  const docKeyRef = useRef<string>('');
  if (item.mode === 'saved' && !createdHere) docKeyRef.current = `item:${item.id}`;
  if (draftKey) docKeyRef.current = draftKey;

  const documentRef = useRef<MarketingEditorDocument | null>(null);
  const document = useMemo<MarketingEditorDocument | null>(() => {
    if (item.mode === 'saved') {
      if (createdHere) return documentRef.current;
      return record.data ? { mode: 'saved', record: record.data } : null;
    }
    if (item.mode === 'draft') {
      if (templateId && !template.data) return null;
      return {
        mode: 'draft',
        from: item.from,
        size: normalizeStartSize(contentType, item.size ?? template.data?.aspectPreset ?? null),
        templateRecord: template.data ?? null,
        openAi,
      };
    }
    return null;
    // `openAi` only matters when the draft starts; location state changes must not remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, createdHere, record.data, templateId, template.data, contentType]);
  if (document) documentRef.current = document;

  const nav = useMemo<MarketingEditorNav>(
    () => ({
      back: closeItem,
      onCreated: (created) => {
        createdIdsRef.current.add(created.id);
        replaceDraftWithItem(created.id);
      },
      openItem: (id, options) => openItem(id, { replace: options?.replace }),
      startDraft: (from, options) =>
        startDraft(from, { size: options?.size ?? null, replace: options?.replace }),
      backLabel: MARKETING_STUDIO_TAB_LABELS[tab],
    }),
    [closeItem, replaceDraftWithItem, openItem, startDraft, tab]
  );

  const noun = CONTENT_NOUN[contentType].one;

  const handleRestore = useCallback(() => {
    if (!savedId) return;
    restore.mutate([savedId], { onSuccess: () => void record.refetch() });
  }, [restore, savedId, record]);

  if (item.mode === 'saved' && !createdHere && record.isError) {
    const deleted = isMarketingDeletedError(record.error);
    return (
      <EditorMessage
        icon={deleted ? Trash2 : FileX2}
        title={deleted ? `This ${noun} was deleted` : `We could not open this ${noun}`}
        body={
          deleted
            ? 'Restore it to keep editing, or go back to your designs.'
            : 'It may have been removed, or the connection dropped.'
        }
        actions={
          <>
            <Button type="button" variant="outline" className="min-h-[44px]" onClick={closeItem}>
              Back to {MARKETING_STUDIO_TAB_LABELS[tab]}
            </Button>
            {deleted && canDeleteTemplate ? (
              <Button
                type="button"
                className="min-h-[44px]"
                disabled={restore.isPending}
                onClick={handleRestore}
              >
                Restore
              </Button>
            ) : !deleted ? (
              <Button type="button" className="min-h-[44px]" onClick={() => void record.refetch()}>
                Try again
              </Button>
            ) : null}
          </>
        }
      />
    );
  }

  if (templateId && template.isError) {
    return (
      <EditorMessage
        icon={FileX2}
        title="We could not open this template"
        body="It may have been deleted."
        actions={
          <Button type="button" variant="outline" className="min-h-[44px]" onClick={closeItem}>
            Back to {MARKETING_STUDIO_TAB_LABELS[tab]}
          </Button>
        }
      />
    );
  }

  if (!document) return <MarketingEditorSkeleton />;

  return (
    <div key={docKeyRef.current} className="flex min-h-0 flex-1 flex-col">
      {children(document, nav)}
    </div>
  );
}

function EditorMessage({
  icon: Icon,
  title,
  body,
  actions,
}: {
  icon: typeof Trash2;
  title: string;
  body: string;
  actions: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <span className="bg-muted flex size-12 items-center justify-center rounded-2xl">
        <Icon className="text-muted-foreground size-6" aria-hidden />
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-sm text-sm">{body}</p>
      <div className="flex flex-wrap justify-center gap-2 pt-1">{actions}</div>
    </div>
  );
}
