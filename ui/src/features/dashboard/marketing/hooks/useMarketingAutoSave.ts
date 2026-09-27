import { useCallback, useEffect, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import {
  saveMarketingTemplate,
  updateMarketingTemplate,
  type MarketingTemplateRecord,
} from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

export type MarketingAutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export type MarketingAutoSavePayload = {
  name: string;
  contentType: 'calendar' | 'design' | 'video';
  designJson: Record<string, unknown>;
  aspectPreset?: string;
  platform?: string;
};

type Options = {
  enabled?: boolean;
  /** Skip autosave while loading a template or applying external state */
  suspended?: boolean;
  debounceMs?: number;
  /** Serialized editor content — save only when this changes */
  contentFingerprint: string | null;
  templateId: string | null;
  /** When no open template id, resolve an existing autosave row (e.g. calendar preset+format). */
  resolveTemplateId?: () => string | null;
  onTemplateIdChange?: (id: string) => void;
  onSaved?: (record: MarketingTemplateRecord) => void;
  buildSavePayload: () => MarketingAutoSavePayload | null;
};

const SAVED_FLASH_MS = 2000;

export function useMarketingAutoSave({
  enabled = true,
  suspended = false,
  debounceMs = 2500,
  contentFingerprint,
  templateId,
  resolveTemplateId,
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
  const resolveTemplateIdRef = useRef(resolveTemplateId);
  const onTemplateIdChangeRef = useRef(onTemplateIdChange);
  const onSavedRef = useRef(onSaved);

  buildSavePayloadRef.current = buildSavePayload;
  resolveTemplateIdRef.current = resolveTemplateId;
  onTemplateIdChangeRef.current = onTemplateIdChange;
  onSavedRef.current = onSaved;
  templateIdRef.current = templateId;

  useEffect(() => {
    if (suspended) {
      wasSuspendedRef.current = true;
      return;
    }

    if (wasSuspendedRef.current) {
      wasSuspendedRef.current = false;
      if (contentFingerprint) {
        lastSavedFingerprintRef.current = contentFingerprint;
        setStatus('idle');
        setErrorMessage(null);
      }
    }
  }, [suspended, contentFingerprint]);

  /** Persists the current content. Resolves true when saved (or nothing to save), false on failure/superseded. */
  const performSave = useCallback(
    async (fingerprintAtSave: string): Promise<boolean> => {
      saveGenerationRef.current += 1;
      const generation = saveGenerationRef.current;
      setStatus('saving');

      try {
        const payload = buildSavePayloadRef.current();
        if (!payload) {
          setStatus('idle');
          return true;
        }

        let record: MarketingTemplateRecord;
        const activeId = templateIdRef.current ?? resolveTemplateIdRef.current?.() ?? null;

        if (activeId) {
          record = await updateMarketingTemplate(propertyId, {
            id: activeId,
            name: payload.name,
            designJson: payload.designJson,
            aspectPreset: payload.aspectPreset,
            platform: payload.platform,
          });
          if (!templateIdRef.current) {
            templateIdRef.current = activeId;
            onTemplateIdChangeRef.current?.(activeId);
          }
        } else {
          record = await saveMarketingTemplate(propertyId, {
            name: payload.name,
            contentType: payload.contentType,
            designJson: payload.designJson,
            aspectPreset: payload.aspectPreset,
            platform: payload.platform,
          });
          templateIdRef.current = record.id;
          onTemplateIdChangeRef.current?.(record.id);
        }

        if (generation !== saveGenerationRef.current) return false;

        lastSavedFingerprintRef.current = fingerprintAtSave;
        onSavedRef.current?.(record);

        void queryClient.invalidateQueries({ queryKey: ['marketing-templates', propertyId] });

        setStatus('saved');
        if (savedFlashTimerRef.current) {
          window.clearTimeout(savedFlashTimerRef.current);
        }
        savedFlashTimerRef.current = window.setTimeout(() => {
          setStatus((current) => (current === 'saved' ? 'idle' : current));
        }, SAVED_FLASH_MS);
        return true;
      } catch (error) {
        if (generation !== saveGenerationRef.current) return false;
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Save failed');
        return false;
      }
    },
    [propertyId, queryClient]
  );

  useEffect(() => {
    if (!enabled || suspended || !contentFingerprint) return;

    if (contentFingerprint === lastSavedFingerprintRef.current) {
      return;
    }

    setStatus((current) => (current === 'pending' ? current : 'pending'));
    setErrorMessage(null);

    const timer = window.setTimeout(() => {
      void performSave(contentFingerprint);
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [enabled, suspended, contentFingerprint, debounceMs, performSave, templateId]);

  /** Saves right away, bypassing the debounce (leave-confirm "Save"). Resolves false when it failed. */
  const saveNow = useCallback(async (): Promise<boolean> => {
    const fingerprint = contentFingerprintRef.current;
    if (!enabled || suspended || !fingerprint) return true;
    if (fingerprint === lastSavedFingerprintRef.current) return true;
    return performSave(fingerprint);
  }, [enabled, suspended, performSave]);

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
      setStatus('idle');
      setErrorMessage(null);
    }
  }, []);

  return { status, errorMessage, markBaseline, saveNow };
}
