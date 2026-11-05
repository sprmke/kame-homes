import type { OpFailure } from '@/features/dashboard/marketing/lib/video/v2/timelineOps';

/** Plain-language notice for a refused edit. Null when the refusal needs no message. */
export function noticeForFailure(reason: OpFailure | undefined): string | null {
  switch (reason) {
    case 'locked':
      return 'That track is locked. Unlock it to edit.';
    case 'item_limit':
      return 'You can have up to 150 clips in one video.';
    case 'track_limit':
      return 'You can have up to 10 tracks.';
    case 'duration_limit':
      return 'Videos can be up to 60 seconds long.';
    case 'no_room':
      return 'There is no room for that here.';
    case 'incompatible':
      return "That doesn't work for this clip.";
    case 'not_found':
    case 'invalid':
    case undefined:
      return null;
  }
}

export const CLAMPED_NOTICE = 'Trimmed to fit the 60 second limit.';
