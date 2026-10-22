import { useCallback, useEffect, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import {
  invalidateMarketingLibrary,
  isMarketingConflictError,
  marketingTemplateKeys,
  saveMarketingTemplate,
  updateMarketingTemplate,
  type MarketingItemKind,
  type MarketingTemplateRecord,
} from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

export type MarketingAutoSaveStatus =
  | 'idle'
  | 'pending'
  | 'saving'
  | 'saved'
  | 'error'
  /** The row changed in another tab / by a teammate since this editor loaded it. */
  | 'conflict';

export type MarketingAutoSavePayload = {
  name: string;
  contentType: 'calendar' | 'design' | 'video';
  designJson: Record<string, unknown>;
  aspectPreset?: string;
  platform?: string;
  /** Theme the item belongs to (sent on create and update). */
  themeKey?: string | null;
  /** Create only. */
  kind?: MarketingItemKind;
  sourceTemplateId?: string | null;
  groupId?: string | null;
};

type Options = {
  enabled?: boolean;
  /** Skip autosave while loading a template or applying external state */
  suspended?: boolean;
  /**
   * When a suspension ends, treat the content as saved (it was a load). Pass false when
   * suspensions only defer saving (an upload finishing is still the host's change).
   */
  adoptAfterSuspend?: boolean;
  debounceMs?: number;
  /** Serialized editor content — save only when this changes */
  contentFingerprint: string | null;
  templateId: string | null;
  /**
   * When there is no row yet, may autosave create one? Drafts pass `true` only after the
   * host has really edited something, so opening a template never stores a copy.
   */
  allowCreate?: boolean;
  /** `updatedAt` of the loaded row: sent back so a save never overwrites newer work. */
  baseUpdatedAt?: string | null;
  onTemplateIdChange?: (id: string) => void;
  onSaved?: (record: MarketingTemplateRecord, info: { created: boolean }) => void;
  buildSavePayload: () => MarketingAutoSavePayload | null;
};

const SAVED_FLASH_MS = 2000;

export function useMarketingAutoSave({
  enabled = true,
  suspended = false,
  adoptAfterSuspend = true,
  debounceMs = 2500,
  contentFingerprint,
  templateId,
  allowCreate = true,
  baseUpdatedAt = null,
  onTemplateIdChange,
  onSaved,
  buildSavePayload,
}: Options) {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<MarketingAutoSaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const contentFingerprintRef = useRef(contentFingerprint);
  contentFingerprintRef.current = contentFingerprint;

  const lastSavedFingerprintRef = useRef<string | null>(null);
  const templateIdRef = useRef<string | null>(templateId);
  const saveGenerationRef = useRef(0);
  const wasSuspendedRef = useRef(false);
  const savedFlashTimerRef = useRef<number | null>(null);
  const buildSavePayloadRef = useRef(buildSavePayload);
  const onTemplateIdChangeRef = useRef(onTemplateIdChange);
  const onSavedRef = useRef(onSaved);
  const allowCreateRef = useRef(allowCreate);
  const updatedAtRef = useRef<string | null>(baseUpdatedAt);
  const conflictRef = useRef(false);
  /** One save at a time: a create must finish before the next save can target its id. */
  const inFlightRef = useRef<Promise<boolean> | null>(null);

  buildSavePayloadRef.current = buildSavePayload;
  onTemplateIdChangeRef.current = onTemplateIdChange;
  onSavedRef.current = onSaved;
  allowCreateRef.current = allowCreate;

  // The editor switched to another row (not the one this hook just created): adopt it.
  useEffect(() => {
    if (templateId === templateIdRef.current) return;
    templateIdRef.current = templateId;
    updatedAtRef.current = baseUpdatedAt;
    conflictRef.current = false;
    setStatus((current) => (current === 'conflict' ? 'idle' : current));
  }, [templateId, baseUpdatedAt]);

  // The loaded row's version arrived after the id (async load).
  useEffect(() => {
    if (baseUpdatedAt && !updatedAtRef.current) updatedAtRef.current = baseUpdatedAt;
  }, [baseUpdatedAt]);

  useEffect(() => {
    if (suspended) {
      wasSuspendedRef.current = true;
      return;
    }

    if (wasSuspendedRef.current) {
      wasSuspendedRef.current = false;
      if (contentFingerprint && adoptAfterSuspend) {
        lastSavedFingerprintRef.current = contentFingerprint;
        setStatus((current) => (current === 'conflict' ? current : 'idle'));
        setErrorMessage(null);
      }
    }
  }, [suspended, contentFingerprint, adoptAfterSuspend]);

  /** Persists the current content. Resolves true when saved (or nothing to save). */
  const performSave = useCallback(
    async (fingerprintAtSave: string, options: { force?: boolean } = {}): Promise<boolean> => {
      if (conflictRef.current && !options.force) return false;
      if (inFlightRef.current) await inFlightRef.current.catch(() => false);

      saveGenerationRef.current += 1;
      const generation = saveGenerationRef.current;

      const run = (async () => {
        const payload = buildSavePayloadRef.current();
        if (!payload) {
          setStatus('idle');
          return true;
        }
        const activeId = templateIdRef.current;
        if (!activeId && !allowCreateRef.current) {
          setStatus('idle');
          return true;
        }

        setStatus('saving');
        try {
          let record: MarketingTemplateRecord;
          let created = false;

          if (activeId) {
            record = await updateMarketingTemplate(propertyId, {
              id: activeId,
              name: payload.name,
              designJson: payload.designJson,
              aspectPreset: payload.aspectPreset,
              platform: payload.platform,
              ...(payload.themeKey !== undefined ? { themeKey: payload.themeKey } : {}),
              ...(updatedAtRef.current && !options.force
                ? { ifUpdatedAt: updatedAtRef.current }
                : {}),
            });
          } else {
            record = await saveMarketingTemplate(propertyId, {
              name: payload.name,
              contentType: payload.contentType,
              designJson: payload.designJson,
              aspectPreset: payload.aspectPreset,
              platform: payload.platform,
              themeKey: payload.themeKey ?? null,
              kind: payload.kind ?? 'design',
              sourceTemplateId: payload.sourceTemplateId ?? null,
              groupId: payload.groupId ?? null,
            });
            created = true;
            templateIdRef.current = record.id;
            onTemplateIdChangeRef.current?.(record.id);
          }

          updatedAtRef.current = record.updatedAt;
          conflictRef.current = false;
          queryClient.setQueryData(marketingTemplateKeys.item(propertyId, record.id), record);
          invalidateMarketingLibrary(queryClient, propertyId);
          onSavedRef.current?.(record, { created });

          if (generation !== saveGenerationRef.current) return true;
          lastSavedFingerprintRef.current = fingerprintAtSave;
          setErrorMessage(null);
          setStatus('saved');
          if (savedFlashTimerRef.current) window.clearTimeout(savedFlashTimerRef.current);
          savedFlashTimerRef.current = window.setTimeout(() => {
            setStatus((current) => (current === 'saved' ? 'idle' : current));
          }, SAVED_FLASH_MS);
          return true;
        } catch (error) {
          if (isMarketingConflictError(error)) {
            conflictRef.current = true;
            setStatus('conflict');
            setErrorMessage(error.message);
            return false;
          }
          if (generation !== saveGenerationRef.current) return false;
          setStatus('error');
          setErrorMessage(error instanceof Error ? error.message : 'Save failed');
          return false;
        }
      })();

      inFlightRef.current = run;
      try {
        return await run;
      } finally {
        if (inFlightRef.current === run) inFlightRef.current = null;
      }
    },
    [propertyId, queryClient]
  );

  useEffect(() => {
    if (!enabled || suspended || !contentFingerprint) return;
    if (conflictRef.current) return;
    if (contentFingerprint === lastSavedFingerprintRef.current) return;
    if (!templateIdRef.current && !allowCreate) return;

    setStatus((current) => (current === 'pending' ? current : 'pending'));
    setErrorMessage(null);

    const timer = window.setTimeout(() => {
      // A load may have set this content as the baseline after the timer was scheduled.
      if (contentFingerprint === lastSavedFingerprintRef.current) {
        setStatus((current) => (current === 'pending' ? 'idle' : current));
        return;
      }
      void performSave(contentFingerprint);
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [enabled, suspended, contentFingerprint, debounceMs, performSave, templateId, allowCreate]);

  /** Saves right away, bypassing the debounce (leave-confirm "Save"). Resolves false on failure. */
  const saveNow = useCallback(async (): Promise<boolean> => {
    const fingerprint = contentFingerprintRef.current;
    if (!enabled || suspended || !fingerprint) return true;
    if (conflictRef.current) return false;
    if (fingerprint === lastSavedFingerprintRef.current) {
      if (inFlightRef.current) return inFlightRef.current;
      return true;
    }
    if (!templateIdRef.current && !allowCreateRef.current) return true;
    return performSave(fingerprint);
  }, [enabled, suspended, performSave]);

  /** Conflict: overwrite the other version with this one. */
  const keepMine = useCallback(async (): Promise<boolean> => {
    const fingerprint = contentFingerprintRef.current;
    if (!fingerprint) return false;
    return performSave(fingerprint, { force: true });
  }, [performSave]);

  useEffect(
    () => () => {
      if (savedFlashTimerRef.current) {
        window.clearTimeout(savedFlashTimerRef.current);
      }
    },
    []
  );

  const markBaseline = useCallback(() => {
    const fingerprint = contentFingerprintRef.current;
    if (fingerprint) {
      lastSavedFingerprintRef.current = fingerprint;
      setStatus((current) => (current === 'conflict' ? current : 'idle'));
      setErrorMessage(null);
    }
  }, []);

  /** Edits since the last save (or since the baseline). */
  const isDirty = useCallback(() => {
    const fingerprint = contentFingerprintRef.current;
    return Boolean(fingerprint) && fingerprint !== lastSavedFingerprintRef.current;
  }, []);

  return { status, errorMessage, markBaseline, saveNow, keepMine, isDirty };
}
