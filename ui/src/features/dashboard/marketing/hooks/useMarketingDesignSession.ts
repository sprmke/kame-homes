import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  useMarketingAutoSave,
  type MarketingAutoSavePayload,
} from '@/features/dashboard/marketing/hooks/useMarketingAutoSave';
import {
  fetchMarketingTemplate,
  invalidateMarketingLibrary,
  marketingTemplateKeys,
  updateMarketingTemplate,
  type MarketingContentType,
  type MarketingTemplateRecord,
} from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import { waitForMarketingIdle } from '@/features/dashboard/marketing/lib/marketingIdle';
import { normalizeDesignName } from '@/features/dashboard/marketing/lib/marketingLibrary';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';

/** Stored thumbnails refresh at most this often while editing (plus on leave). */
const THUMBNAIL_REFRESH_MS = 30_000;
/** Leaving waits at most this long for the final thumbnail. */
const LEAVE_THUMBNAIL_CAP_MS = 1500;

type Options = {
  contentType: MarketingContentType;
  themeKey: string;
  /** Saved row being edited; null while editing an unsaved draft. */
  itemId: string | null;
  /** The loaded row (null for drafts). */
  record: MarketingTemplateRecord | null;
  /** Name a draft gets when it is first stored. */
  draftName: string;
  /** Template the draft started from (`preset:<id>` / `tpl:<uuid>`). */
  sourceTemplateId: string | null;
  /** Document loaded and settled (autosave and capture stay off until then). */
  ready: boolean;
  /** The host changed something since load (gates creating a draft's row). */
  hasUserEdits: boolean;
  /** Pause autosave (upload in flight, document loading). Changes save once it ends. */
  suspended?: boolean;
  contentFingerprint: string | null;
  aspectPreset: string;
  platform?: string;
  buildDesignJson: () => Record<string, unknown> | null;
  /** Small image data URL of the current canvas (WebP / JPEG), or null. */
  captureThumbnail: () => Promise<string | null>;
  /** First save of a draft: swap the URL to the new id. */
  onCreated: (record: MarketingTemplateRecord) => void;
  /** Server copy changed elsewhere: caller reloads the document from `record`. */
  onReloadFromServer: (record: MarketingTemplateRecord) => void;
  /** Writes allowed (team permission + plan). Read-only sessions never save. */
  canSave: boolean;
  /** Current theme hash (a stored thumbnail from another theme version is refreshed). */
  themeHash?: string | null;
};

export function useMarketingDesignSession({
  contentType,
  themeKey,
  itemId,
  record,
  draftName,
  sourceTemplateId,
  ready,
  hasUserEdits,
  suspended = false,
  contentFingerprint,
  aspectPreset,
  platform,
  buildDesignJson,
  captureThumbnail,
  onCreated,
  onReloadFromServer,
  canSave,
  themeHash = null,
}: Options) {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();

  const [name, setName] = useState(() => record?.name ?? draftName);
  const nameRef = useRef(name);
  nameRef.current = name;
  const appliedDraftNameRef = useRef(draftName);
  const [savedId, setSavedId] = useState<string | null>(itemId);
  const savedIdRef = useRef(savedId);
  savedIdRef.current = savedId;

  // A different row (or a fresh draft) was opened.
  useEffect(() => {
    setSavedId(itemId);
    setName(record?.name ?? draftName);
    // Only when the target changes: the draft name follows the template until saved.
  }, [itemId, record?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // A late default (the next free calendar name) replaces the placeholder only
  // while the host has not typed their own name.
  useEffect(() => {
    if (savedIdRef.current) {
      appliedDraftNameRef.current = draftName;
      return;
    }
    setName((current) => (current === appliedDraftNameRef.current ? draftName : current));
    appliedDraftNameRef.current = draftName;
  }, [draftName]);

  const buildDesignJsonRef = useRef(buildDesignJson);
  buildDesignJsonRef.current = buildDesignJson;
  const captureRef = useRef(captureThumbnail);
  captureRef.current = captureThumbnail;
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;

  const lastThumbnailAtRef = useRef(0);
  const thumbnailFingerprintRef = useRef<string | null>(null);
  const fingerprintRef = useRef(contentFingerprint);
  fingerprintRef.current = contentFingerprint;
  const canSaveRef = useRef(canSave);
  canSaveRef.current = canSave;

  // A loaded row's stored thumbnail matches what was loaded, unless it is missing or was
  // drawn in another version of the theme: then store a fresh one once the canvas is idle.
  const themeHashRef = useRef(themeHash);
  themeHashRef.current = themeHash;
  useEffect(() => {
    if (!record || !ready) return;
    const storedHash =
      typeof record.designJson?.themeHash === 'string' ? record.designJson.themeHash : null;
    const stale =
      !record.thumbnailUrl || (storedHash !== null && storedHash !== themeHashRef.current);
    thumbnailFingerprintRef.current = stale ? null : fingerprintRef.current;
    if (stale && canSaveRef.current) {
      void waitForMarketingIdle(1200).then(() => persistThumbnail(record.id));
    }
    // Once per loaded row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id, ready]);

  const persistThumbnail = useCallback(
    async (id: string): Promise<void> => {
      const fingerprint = fingerprintRef.current;
      if (!fingerprint || fingerprint === thumbnailFingerprintRef.current) return;
      lastThumbnailAtRef.current = Date.now();
      try {
        const dataUrl = await captureRef.current();
        if (!dataUrl) return;
        const updated = await updateMarketingTemplate(propertyId, {
          id,
          thumbnailDataUrl: dataUrl,
        });
        thumbnailFingerprintRef.current = fingerprint;
        queryClient.setQueryData<MarketingTemplateRecord>(
          marketingTemplateKeys.item(propertyId, id),
          (current) => (current ? { ...current, thumbnailUrl: updated.thumbnailUrl } : current)
        );
        invalidateMarketingLibrary(queryClient, propertyId);
      } catch {
        // The card keeps its previous image; the next save tries again.
      }
    },
    [propertyId, queryClient]
  );

  const scheduleThumbnail = useCallback(
    (id: string) => {
      if (Date.now() - lastThumbnailAtRef.current < THUMBNAIL_REFRESH_MS) return;
      lastThumbnailAtRef.current = Date.now();
      void waitForMarketingIdle().then(() => persistThumbnail(id));
    },
    [persistThumbnail]
  );

  const autoSave = useMarketingAutoSave({
    enabled: ready && canSave,
    suspended,
    // Editors mark loads as the baseline themselves; a finished upload must still save.
    adoptAfterSuspend: false,
    contentFingerprint: ready ? contentFingerprint : null,
    templateId: savedId,
    allowCreate: hasUserEdits,
    baseUpdatedAt: record?.updatedAt ?? null,
    onTemplateIdChange: (id) => setSavedId(id),
    onSaved: (saved, { created }) => {
      if (created) {
        onCreatedRef.current(saved);
        // The Library card needs art right away; capture once the canvas is idle.
        void waitForMarketingIdle().then(() => persistThumbnail(saved.id));
        return;
      }
      scheduleThumbnail(saved.id);
    },
    buildSavePayload: () => {
      const designJson = buildDesignJsonRef.current();
      if (!designJson) return null;
      return {
        name: nameRef.current,
        contentType,
        aspectPreset,
        platform,
        themeKey,
        designJson,
        kind: 'design',
        sourceTemplateId,
      } satisfies MarketingAutoSavePayload;
    },
  });

  const isDirtyForGuard =
    autoSave.status === 'pending' || autoSave.status === 'error' || autoSave.status === 'conflict';

  useUnsavedChangesGuard({
    isDirty: canSave && isDirtyForGuard,
    onSave: autoSave.saveNow,
  });

  /** Save now and store a fresh thumbnail (leaving the editor). Never throws. */
  const flush = useCallback(async (): Promise<boolean> => {
    const saved = await autoSave.saveNow();
    const id = savedIdRef.current;
    if (saved && id) {
      await Promise.race([
        persistThumbnail(id),
        new Promise((resolve) => window.setTimeout(resolve, LEAVE_THUMBNAIL_CAP_MS)),
      ]);
    }
    return saved;
  }, [autoSave, persistThumbnail]);

  const rename = useCallback(
    async (next: string): Promise<boolean> => {
      const clean = normalizeDesignName(next);
      if (!clean || clean === nameRef.current) return Boolean(clean);
      const previous = nameRef.current;
      setName(clean);
      const id = savedIdRef.current;
      if (!id) return true;
      try {
        await updateMarketingTemplate(propertyId, { id, name: clean });
        queryClient.setQueryData<MarketingTemplateRecord>(
          marketingTemplateKeys.item(propertyId, id),
          (current) => (current ? { ...current, name: clean } : current)
        );
        invalidateMarketingLibrary(queryClient, propertyId);
        return true;
      } catch (error) {
        setName(previous);
        toast.error(error instanceof Error ? error.message : 'Could not rename');
        return false;
      }
    },
    [propertyId, queryClient]
  );

  const reloadFromServer = useCallback(async () => {
    const id = savedIdRef.current;
    if (!id) return;
    try {
      const fresh = await queryClient.fetchQuery({
        queryKey: marketingTemplateKeys.item(propertyId, id),
        queryFn: () => fetchMarketingTemplate(propertyId, id),
        staleTime: 0,
      });
      setName(fresh.name);
      onReloadFromServer(fresh);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not reload');
    }
  }, [onReloadFromServer, propertyId, queryClient]);

  return useMemo(
    () => ({
      name,
      itemId: savedId,
      isDraft: !savedId,
      status: autoSave.status,
      errorMessage: autoSave.errorMessage,
      saveNow: autoSave.saveNow,
      markBaseline: autoSave.markBaseline,
      keepMine: autoSave.keepMine,
      reloadFromServer,
      flush,
      rename,
    }),
    [
      name,
      savedId,
      autoSave.status,
      autoSave.errorMessage,
      autoSave.saveNow,
      autoSave.markBaseline,
      autoSave.keepMine,
      reloadFromServer,
      flush,
      rename,
    ]
  );
}

export type MarketingDesignSession = ReturnType<typeof useMarketingDesignSession>;
