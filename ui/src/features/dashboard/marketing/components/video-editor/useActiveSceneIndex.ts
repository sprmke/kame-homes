import { useEffect, useState } from 'react';

import type { VideoPreviewMode } from '@/features/dashboard/marketing/components/video-editor/useVideoPlayerTransport';
import type { VideoProject } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import { sceneIndexAtFrame } from '@/features/dashboard/marketing/lib/video/videoProjectUtils';

import type { PlayerRef } from '@remotion/player';

/** Polls the active scene without re-rendering the Remotion Player each frame. */
export function useActiveSceneIndex(
  playerRef: React.RefObject<PlayerRef | null>,
  project: VideoProject,
  previewMode: VideoPreviewMode,
  selectedSceneIndex: number,
  isPlaying: boolean
): number {
  const [activeSceneIndex, setActiveSceneIndex] = useState(selectedSceneIndex);

  useEffect(() => {
    if (previewMode === 'clip') {
      setActiveSceneIndex(selectedSceneIndex);
      return;
    }

    const sync = () => {
      const frame = playerRef.current?.getCurrentFrame() ?? 0;
      setActiveSceneIndex(sceneIndexAtFrame(project, frame));
    };

    sync();
    if (!isPlaying || document.hidden) return;

    const id = window.setInterval(sync, 33);
    return () => window.clearInterval(id);
  }, [playerRef, project, previewMode, selectedSceneIndex, isPlaying]);

  return previewMode === 'clip' ? selectedSceneIndex : activeSceneIndex;
}
