import {
  waitForMarketingIdle,
  yieldToMainThread,
} from '@/features/dashboard/marketing/lib/marketingIdle';

let pausePlaybackFn: (() => void) | null = null;
let isPlaybackActiveFn: (() => boolean) | null = null;

export function registerVideoThumbnailPlaybackPause(
  pauseFn: () => void,
  isPlayingFn: () => boolean
) {
  pausePlaybackFn = pauseFn;
  isPlaybackActiveFn = isPlayingFn;
  return () => {
    if (pausePlaybackFn === pauseFn) pausePlaybackFn = null;
    if (isPlaybackActiveFn === isPlayingFn) isPlaybackActiveFn = null;
  };
}

/** Pause the live Remotion player before off-thread still renders (avoids web-renderer conflicts). */
export async function runVideoThumbnailCapture<T>(work: () => Promise<T>): Promise<T> {
  // Background/sidebar thumbnail renders must never yank playback out from
  // under a host who's actively watching the live preview — wait for them to
  // stop instead of force-pausing mid-watch (this previously caused the live
  // preview to cut out within ~1s of pressing Play, since with many presets
  // queued to render in the background, this ran constantly).
  while (isPlaybackActiveFn?.()) {
    await waitForMarketingIdle(300);
  }
  pausePlaybackFn?.();
  await waitForMarketingIdle(200);
  await yieldToMainThread();
  return work();
}
