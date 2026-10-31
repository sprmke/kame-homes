import { memo, useCallback, useLayoutEffect, useMemo } from 'react';

import { Player, type PlayerRef } from '@remotion/player';

import {
  CampaignVideoComposition,
  type VideoCompositionProps,
} from '@/features/dashboard/marketing/components/video-editor/VideoCompositions';

type Props = {
  playerRef: React.RefObject<PlayerRef | null>;
  compositionKey: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  inputProps: VideoCompositionProps;
  previewMuted: boolean;
  onPlayerInstance?: (player: PlayerRef | null) => void;
};

export const VideoRemotionPlayer = memo(function VideoRemotionPlayer({
  playerRef,
  compositionKey,
  durationInFrames,
  fps,
  width,
  height,
  inputProps,
  previewMuted,
  onPlayerInstance,
}: Props) {
  const playerInputProps = useMemo(
    () => ({ ...inputProps, previewMuted }),
    [inputProps, previewMuted]
  );

  const handlePlayerRef = useCallback(
    (instance: PlayerRef | null) => {
      playerRef.current = instance;
      onPlayerInstance?.(instance);
    },
    [playerRef, onPlayerInstance]
  );

  useLayoutEffect(() => {
    onPlayerInstance?.(playerRef.current);
    return () => onPlayerInstance?.(null);
  }, [compositionKey, onPlayerInstance, playerRef]);

  return (
    <Player
      ref={handlePlayerRef}
      key={compositionKey}
      component={CampaignVideoComposition}
      durationInFrames={durationInFrames}
      compositionWidth={width}
      compositionHeight={height}
      fps={fps}
      inputProps={playerInputProps}
      style={{ width: '100%', height: '100%', display: 'block' }}
      controls={false}
      loop={false}
      clickToPlay={false}
      spaceKeyToPlayOrPause={false}
      initiallyMuted={false}
      acknowledgeRemotionLicense
    />
  );
});
