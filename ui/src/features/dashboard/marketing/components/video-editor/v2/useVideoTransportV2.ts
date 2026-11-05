import { useCallback, useEffect, useRef, useState } from 'react';

import type { PlayerRef } from '@remotion/player';

function pageHidden(): boolean {
  return typeof document !== 'undefined' && document.hidden;
}

type Options = {
  playerRef: React.RefObject<PlayerRef | null>;
  playerInstance: PlayerRef | null;
  durationInFrames: number;
  /** Changing this resets the transport (new composition). */
  compositionKey: string;
};

/** Frame, play state and seeking for the v2 preview. The Remotion player owns the clock. */
export function useVideoTransportV2({
  playerRef,
  playerInstance,
  durationInFrames,
  compositionKey,
}: Options) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const durationRef = useRef(durationInFrames);
  durationRef.current = durationInFrames;

  useEffect(() => {
    setCurrentFrame(0);
    setIsPlaying(false);
  }, [compositionKey]);

  // Never play in a background tab (it throttles, drifts and burns battery).
  useEffect(() => {
    const pauseIfHidden = () => {
      if (pageHidden()) playerRef.current?.pause();
    };
    document.addEventListener('visibilitychange', pauseIfHidden);
    return () => {
      document.removeEventListener('visibilitychange', pauseIfHidden);
      playerRef.current?.pause();
    };
  }, [playerRef]);

  useEffect(() => {
    const player = playerInstance;
    if (!player) return;
    const sync = () => setCurrentFrame(player.getCurrentFrame());
    const onPlay = () => {
      if (pageHidden()) {
        player.pause();
        return;
      }
      setIsPlaying(true);
    };
    const onPause = () => setIsPlaying(false);
    sync();
    player.addEventListener('frameupdate', sync);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    player.addEventListener('ended', onPause);
    return () => {
      player.removeEventListener('frameupdate', sync);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('ended', onPause);
    };
  }, [playerInstance, compositionKey]);

  const seek = useCallback(
    (frame: number) => {
      const clamped = Math.max(
        0,
        Math.min(Math.round(frame), Math.max(0, durationRef.current - 1))
      );
      playerRef.current?.seekTo(clamped);
      setCurrentFrame(clamped);
    },
    [playerRef]
  );

  const pause = useCallback(() => playerRef.current?.pause(), [playerRef]);

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    // Ask Remotion, not our mirror: the mirror lags a render behind (a click in that window
    // would call play() on a player that is already starting, which Remotion ignores).
    if (player.isPlaying()) {
      player.pause();
      return;
    }
    // At the end, restart from 0 like every video player.
    if (player.getCurrentFrame() >= durationRef.current - 1) player.seekTo(0);
    void player.play();
  }, [playerRef]);

  return { currentFrame, isPlaying, seek, pause, togglePlay };
}
