import { useEffect, useMemo, useRef, useState } from 'react';

import {
  waitForMarketingIdle,
  yieldToMainThread,
} from '@/features/dashboard/marketing/lib/marketingIdle';
import {
  renderVideoSceneThumbnail,
  videoSceneThumbFingerprint,
} from '@/features/dashboard/marketing/lib/renderMarketingVideoThumbnail';
import type { VideoProject } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';

type SceneThumbEntry = {
  fingerprint: string;
  url: string;
};

/**
 * Remotion stills for timeline clips (one at a time). Falls back to raw media
 * in the UI while a scene thumb is missing.
 */
export function useVideoSceneThumbnails(
  project: VideoProject | null,
  brandColor?: string
): {
  getSceneThumbnailUrl: (sceneId: string) => string | undefined;
  isSceneThumbnailLoading: (sceneId: string) => boolean;
} {
  const [thumbs, setThumbs] = useState<Record<string, SceneThumbEntry>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(() => new Set());
  const thumbsRef = useRef(thumbs);
  thumbsRef.current = thumbs;
  const projectRef = useRef(project);
  projectRef.current = project;

  const scenePlan = useMemo(() => {
    if (!project) return [] as Array<{ id: string; index: number; fingerprint: string }>;
    return project.scenes.map((scene, index) => ({
      id: scene.id,
      index,
      fingerprint: videoSceneThumbFingerprint(scene),
    }));
  }, [project]);

  const planKey = useMemo(
    () => scenePlan.map((item) => `${item.id}:${item.fingerprint}`).join('|'),
    [scenePlan]
  );

  useEffect(() => {
    const activeProject = projectRef.current;
    if (!activeProject || scenePlan.length === 0) return;

    let cancelled = false;

    const run = async () => {
      await waitForMarketingIdle(200);
      if (cancelled || document.hidden) return;

      for (const item of scenePlan) {
        if (cancelled || document.hidden) break;

        const existing = thumbsRef.current[item.id];
        if (existing?.fingerprint === item.fingerprint) continue;

        setLoadingIds((prev) => new Set(prev).add(item.id));
        try {
          const live = projectRef.current ?? activeProject;
          const liveIndex = live.scenes.findIndex((scene) => scene.id === item.id);
          if (liveIndex < 0) continue;
          const dataUrl = await renderVideoSceneThumbnail(live, liveIndex, brandColor);
          if (cancelled) return;
          if (dataUrl) {
            setThumbs((prev) => ({
              ...prev,
              [item.id]: { fingerprint: item.fingerprint, url: dataUrl },
            }));
          }
        } finally {
          if (!cancelled) {
            setLoadingIds((prev) => {
              const next = new Set(prev);
              next.delete(item.id);
              return next;
            });
          }
        }
        await yieldToMainThread();
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [planKey, brandColor, scenePlan]);

  return {
    getSceneThumbnailUrl: (sceneId: string) => {
      const entry = thumbs[sceneId];
      const plan = scenePlan.find((item) => item.id === sceneId);
      if (!entry || !plan || entry.fingerprint !== plan.fingerprint) return undefined;
      return entry.url;
    },
    isSceneThumbnailLoading: (sceneId: string) => loadingIds.has(sceneId),
  };
}
