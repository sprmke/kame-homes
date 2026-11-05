import { memo, useCallback, useLayoutEffect, useMemo } from 'react';

import { Player, type PlayerRef } from '@remotion/player';

import {
  CampaignVideoCompositionV2,
  type VideoCompositionV2Props,
} from '@/features/dashboard/marketing/components/video-editor/VideoCompositionV2';

type Props = {
  playerRef: React.RefObject<PlayerRef | null>;
  compositionKey: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  inputProps: VideoCompositionV2Props;
  previewMuted: boolean;
  onPlayerInstance?: (player: PlayerRef | null) => void;
};

export const VideoRemotionPlayerV2 = memo(function VideoRemotionPlayerV2({
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

  const handleRef = useCallback(
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
      ref={handleRef}
      key={compositionKey}
      component={CampaignVideoCompositionV2}
      durationInFrames={Math.max(1, durationInFrames)}
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
