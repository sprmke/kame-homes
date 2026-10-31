import { useCallback, useEffect, useRef, useState } from 'react';

import type { VideoProject } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import {
  sceneEndFrame,
  sceneFrameRange,
  sceneIndexAtFrame,
  sceneSettledPreviewFrame,
  videoProjectDurationInFrames,
} from '@/features/dashboard/marketing/lib/video/videoProjectUtils';

import type { PlayerRef } from '@remotion/player';

function isPageHidden(): boolean {
  return typeof document !== 'undefined' && document.hidden;
}

function formatTime(seconds: number): string {
  const whole = Math.max(0, seconds);
  const mins = Math.floor(whole / 60);
  const secs = Math.floor(whole % 60);
  const tenths = Math.floor((whole % 1) * 10);
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
  }
  return `${secs}.${tenths}s`;
}

export type VideoPreviewMode = 'all' | 'clip';

type Options = {
  playerRef: React.RefObject<PlayerRef | null>;
  playerInstance: PlayerRef | null;
  project: VideoProject | null;
  selectedSceneIndex: number;
  previewMode: VideoPreviewMode;
  compositionKey: string;
};

export function useVideoPlayerTransport({
  playerRef,
  playerInstance,
  project,
  selectedSceneIndex,
  previewMode,
  compositionKey,
}: Options) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const loopGuardRef = useRef(false);
  const isPlayingRef = useRef(false);
  const projectRef = useRef(project);
  projectRef.current = project;

  const durationInFrames = project ? videoProjectDurationInFrames(project) : 1;
  const fps = project?.fps ?? 30;
  const durationSec = durationInFrames / fps;
  const currentSec = currentFrame / fps;

  const activeSceneIndex = project ? sceneIndexAtFrame(project, currentFrame) : 0;

  useEffect(() => {
    setCurrentFrame(0);
    setIsPlaying(false);
    isPlayingRef.current = false;
  }, [compositionKey]);

  useEffect(() => {
    const pauseIfHidden = () => {
      if (!isPageHidden()) return;
      playerRef.current?.pause();
    };

    document.addEventListener('visibilitychange', pauseIfHidden);
    return () => {
      document.removeEventListener('visibilitychange', pauseIfHidden);
      playerRef.current?.pause();
      isPlayingRef.current = false;
    };
  }, [playerRef]);

  useEffect(() => {
    const player = playerInstance;
    if (!player) return;

    const syncFrame = () => {
      const frame = player.getCurrentFrame();
      setCurrentFrame(frame);

      const currentProject = projectRef.current;
      if (!currentProject || previewMode !== 'clip' || !isPlayingRef.current) return;
      if (loopGuardRef.current) return;
      if (isPageHidden()) {
        player.pause();
        return;
      }

      const { start, end } = sceneFrameRange(currentProject, selectedSceneIndex);
      const lastFrame = Math.max(start, end - 1);
      if (frame >= lastFrame) {
        loopGuardRef.current = true;
        player.seekTo(start);
        setCurrentFrame(start);
        requestAnimationFrame(() => {
          loopGuardRef.current = false;
        });
      }
    };

    const onPlay = () => {
      if (isPageHidden()) {
        player.pause();
        return;
      }
      isPlayingRef.current = true;
      setIsPlaying(true);
    };
    const onPause = () => {
      isPlayingRef.current = false;
      setIsPlaying(false);
    };
    const onEnded = () => {
      const currentProject = projectRef.current;
      if (!currentProject || previewMode !== 'clip') {
        setIsPlaying(false);
        return;
      }
      if (isPageHidden()) {
        setIsPlaying(false);
        return;
      }
      const { start } = sceneFrameRange(currentProject, selectedSceneIndex);
      player.seekTo(start);
      // seekTo() needs a couple of frames to settle before play() reliably
      // takes effect on the Remotion player — calling them back-to-back can
      // silently no-op the play, which read as the loop "stalling" after one pass.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (isPageHidden()) return;
          void player.play();
        });
      });
    };

    syncFrame();
    player.addEventListener('frameupdate', syncFrame);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    player.addEventListener('ended', onEnded);

    return () => {
      player.removeEventListener('frameupdate', syncFrame);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('ended', onEnded);
    };
  }, [playerInstance, compositionKey, previewMode, selectedSceneIndex]);

  const seekToFrame = useCallback(
    (frame: number) => {
      const player = playerRef.current;
      if (!player || !project) return;
      const clamped = Math.max(0, Math.min(frame, durationInFrames - 1));
      player.seekTo(clamped);
      setCurrentFrame(clamped);
    },
    [playerRef, project, durationInFrames]
  );

  /**
   * Seeks then plays. seekTo() needs a couple of frames to settle before
   * play() reliably takes — calling them synchronously back-to-back can
   * silently no-op the play call, which read as needing 2-3 clicks to start.
   */
  const playFromFrame = useCallback(
    (frame: number) => {
      const player = playerRef.current;
      if (!player || !project) return;
      const clamped = Math.max(0, Math.min(frame, durationInFrames - 1));
      player.seekTo(clamped);
      setCurrentFrame(clamped);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          void playerRef.current?.play();
        });
      });
    },
    [playerRef, project, durationInFrames]
  );

  const play = useCallback(() => {
    void playerRef.current?.play();
  }, [playerRef]);

  const pause = useCallback(() => {
    playerRef.current?.pause();
  }, [playerRef]);

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    // Query Remotion's own authoritative playing state rather than our
    // isPlayingRef mirror — that mirror is only updated by the player's
    // 'play'/'pause' events once our listener effect has attached, which lags
    // a render behind mount/scene-switch. A click landing in that window
    // would read the mirror as "not playing" and call play() on an already
    // (or about-to-be) playing player, which Remotion silently no-ops —
    // exactly what read as needing 2-3 clicks to start.
    if (player.isPlaying()) {
      player.pause();
    } else {
      void player.play();
    }
  }, [playerRef]);

  const stop = useCallback(() => {
    const player = playerRef.current;
    if (!player || !project) return;
    player.pause();
    const frame =
      previewMode === 'clip' ? sceneSettledPreviewFrame(project, selectedSceneIndex) : 0;
    player.seekTo(frame);
    setCurrentFrame(frame);
    setIsPlaying(false);
  }, [playerRef, project, previewMode, selectedSceneIndex]);

  const seekToScene = useCallback(
    (sceneIndex: number) => {
      if (!project) return;
      const index = Math.max(0, Math.min(sceneIndex, project.scenes.length - 1));
      seekToFrame(sceneSettledPreviewFrame(project, index));
    },
    [project, seekToFrame]
  );

  const playFromStart = useCallback(() => {
    if (!project) return;
    playFromFrame(0);
  }, [project, playFromFrame]);

  const playSelectedClip = useCallback(() => {
    if (!project) return;
    playFromFrame(sceneSettledPreviewFrame(project, selectedSceneIndex));
  }, [project, playFromFrame, selectedSceneIndex]);

  const toggleMute = useCallback(() => {
    setIsMuted((value) => !value);
  }, []);

  const clipDurationSec = useCallback(() => {
    if (!project) return 0;
    const { start, end } = sceneFrameRange(project, selectedSceneIndex);
    return Math.max(0.1, (end - start) / fps);
  }, [project, selectedSceneIndex, fps]);

  const clipCurrentSec = useCallback(() => {
    if (!project) return 0;
    const { start, end } = sceneFrameRange(project, selectedSceneIndex);
    const relative = Math.max(0, Math.min(currentFrame, end - 1) - start);
    return relative / fps;
  }, [project, selectedSceneIndex, currentFrame, fps]);

  const displayCurrentSec = previewMode === 'clip' ? clipCurrentSec() : currentSec;
  const displayDurationSec = previewMode === 'clip' ? clipDurationSec() : durationSec;

  return {
    currentFrame,
    currentSec,
    durationSec,
    durationInFrames,
    displayCurrentSec,
    displayDurationSec,
    isPlaying,
    isMuted,
    activeSceneIndex,
    formatTime,
    seekToFrame,
    seekToScene,
    play,
    pause,
    togglePlay,
    stop,
    playFromFrame,
    playFromStart,
    playSelectedClip,
    toggleMute,
    sceneEndFrame: (index: number) => (project ? sceneEndFrame(project, index) : 0),
  };
}
