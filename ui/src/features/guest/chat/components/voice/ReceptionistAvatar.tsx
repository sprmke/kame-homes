import { useEffect, useRef, useState } from 'react';

import type { ReceptionistAvatarState } from '@/features/guest/chat/components/voice/receptionistAvatarTypes';
import {
  TURTLE_IDLE_POSTER_SRC,
  TURTLE_LOOP_VIDEO_SRC,
  TURTLE_PLATE_COLOR,
} from '@/features/guest/chat/components/voice/receptionistAvatarVideo';
import { ReceptionistFacePlate } from '@/features/guest/chat/components/voice/ReceptionistFacePlate';

import { cn } from '@/lib/utils';

export type { ReceptionistAvatarState };

const CROSSFADE_MS = 280;

type Props = {
  state: ReceptionistAvatarState;
  size?: number;
  className?: string;
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Turtle receptionist in a circular plate. The talk loop plays only while `state === 'speaking'`.
 * The video stays mounted under an identical idle poster: speaking fades the poster out over a
 * running video, and stopping fades it back in before the video pauses and rewinds underneath.
 * Level-driven motion comes from `--voice-out` on an ancestor (`.voice-avatar-motion`).
 */
export function ReceptionistAvatar({ state, size = 160, className }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [reducedMotion] = useState(prefersReducedMotion);
  const speaking = state === 'speaking' && !reducedMotion;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || failed) return;
    if (speaking) {
      video.muted = true;
      void video.play().catch(() => undefined);
      return;
    }
    // Rewind only once the poster fully covers the video, so the reset is never visible.
    // If speech resumes first, cleanup cancels this and playback continues without a seek.
    const timer = window.setTimeout(() => {
      video.pause();
      try {
        video.currentTime = 0;
      } catch {
        // metadata not loaded yet; it is already at the start
      }
    }, CROSSFADE_MS);
    return () => window.clearTimeout(timer);
  }, [speaking, failed]);

  return (
    <div
      className={cn(
        'ring-primary/25 relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1',
        className
      )}
      style={{ width: size, height: size, backgroundColor: TURTLE_PLATE_COLOR }}
      aria-hidden
    >
      {failed ? (
        <ReceptionistFacePlate state={state} size={size} />
      ) : (
        <div
          className={cn(
            'voice-avatar-motion absolute inset-0 transition-[opacity,filter] duration-300',
            state === 'connecting' && 'opacity-80',
            state === 'error' && 'opacity-65 grayscale'
          )}
        >
          {reducedMotion ? null : (
            <video
              ref={videoRef}
              src={TURTLE_LOOP_VIDEO_SRC}
              poster={TURTLE_IDLE_POSTER_SRC}
              muted
              loop
              playsInline
              preload="auto"
              disablePictureInPicture
              disableRemotePlayback
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => setFailed(true)}
            />
          )}
          <img
            src={TURTLE_IDLE_POSTER_SRC}
            alt=""
            width={size}
            height={size}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              opacity: speaking ? 0 : 1,
              transition: `opacity ${CROSSFADE_MS}ms ease-out`,
            }}
            onError={() => setFailed(true)}
          />
        </div>
      )}
    </div>
  );
}
