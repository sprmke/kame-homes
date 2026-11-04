import { describe, expect, it } from 'vitest';

import {
  bucketPeaks,
  formatBytes,
  kindForFile,
  limitErrorFor,
  limitMessage,
  maxBytesFor,
  meterShare,
  needsCompatibilityTranscode,
  transcodeBitrate,
  posterTimestamp,
  shouldTranscodeVideo,
  storageLevel,
  transcodeSize,
} from '@/features/dashboard/marketing/lib/media/marketingMediaRules';
import { DEFAULT_PLAN_FEATURES } from '@/features/dashboard/plans/lib/planFeatures';

const MB = 1024 * 1024;
const limits = {
  ...DEFAULT_PLAN_FEATURES.marketingMediaLibrary,
  storageMb: 100,
  maxFiles: 3,
  maxImageMb: 10,
  maxVideoMb: 50,
  maxVideoSec: 30,
  maxAudioMb: 15,
  dailyUploads: 5,
};
const usage = (over: Partial<{ usedBytes: number; files: number; uploadsToday: number }> = {}) => ({
  usedBytes: 0,
  files: 0,
  uploadsToday: 0,
  limits,
  ...over,
});

describe('kindForFile', () => {
  it('uses MIME first, falls back to the extension, rejects SVG and unknowns', () => {
    expect(kindForFile({ name: 'a.bin', type: 'image/png' })).toBe('image');
    expect(kindForFile({ name: 'a.bin', type: 'video/mp4' })).toBe('video');
    expect(kindForFile({ name: 'a.bin', type: 'audio/mpeg' })).toBe('audio');
    expect(kindForFile({ name: 'IMG_1.HEIC', type: '' })).toBe('image');
    expect(kindForFile({ name: 'clip.MOV', type: '' })).toBe('video');
    expect(kindForFile({ name: 'voice.m4a', type: '' })).toBe('audio');
    expect(kindForFile({ name: 'logo.svg', type: 'image/svg+xml' })).toBeNull();
    expect(kindForFile({ name: 'doc.pdf', type: 'application/pdf' })).toBeNull();
    expect(kindForFile({ name: 'noext', type: '' })).toBeNull();
  });
});

describe('limitErrorFor mirrors the server order and copy', () => {
  it('passes a file that fits', () => {
    expect(limitErrorFor({ kind: 'image', bytes: 2 * MB }, usage())).toBeNull();
  });

  it('checks size, length, daily count, file count, then storage', () => {
    expect(limitErrorFor({ kind: 'image', bytes: 11 * MB }, usage())?.code).toBe('file_too_large');
    expect(limitErrorFor({ kind: 'video', bytes: 5 * MB, durationMs: 31_000 }, usage())?.code).toBe(
      'video_too_long'
    );
    expect(limitErrorFor({ kind: 'image', bytes: MB }, usage({ uploadsToday: 5 }))?.code).toBe(
      'daily_limit'
    );
    expect(limitErrorFor({ kind: 'image', bytes: MB }, usage({ files: 3 }))?.code).toBe(
      'too_many_files'
    );
    expect(
      limitErrorFor({ kind: 'image', bytes: 2 * MB }, usage({ usedBytes: 99 * MB }))?.code
    ).toBe('storage_full');
    // Both file-too-large and storage-full: size wins, like the server.
    expect(
      limitErrorFor({ kind: 'image', bytes: 11 * MB }, usage({ usedBytes: 99 * MB }))?.code
    ).toBe('file_too_large');
  });

  it('counts files already queued in the batch', () => {
    expect(
      limitErrorFor({ kind: 'image', bytes: MB }, usage({ files: 1 }), { files: 2 })?.code
    ).toBe('too_many_files');
    expect(
      limitErrorFor({ kind: 'image', bytes: 6 * MB }, usage({ usedBytes: 90 * MB }), {
        bytes: 5 * MB,
      })?.code
    ).toBe('storage_full');
  });

  it('uses each kind its own cap', () => {
    expect(maxBytesFor('audio', limits)).toBe(15 * MB);
    expect(limitErrorFor({ kind: 'audio', bytes: 16 * MB }, usage())?.code).toBe('file_too_large');
    expect(
      limitErrorFor({ kind: 'video', bytes: 49 * MB, durationMs: 10_000 }, usage())
    ).toBeNull();
  });

  it('writes plain copy with the plan numbers and no em dash', () => {
    expect(limitMessage('storage_full', { ...limits, storageMb: 500 })).toBe(
      "You've used all 500 MB of media storage. Delete files or upgrade."
    );
    expect(limitMessage('storage_full', { ...limits, storageMb: 3072 })).toContain('3 GB');
    expect(limitMessage('video_too_long', limits)).toBe(
      'This video is longer than 30 seconds. Trim it or upgrade for longer clips.'
    );
    for (const code of [
      'storage_full',
      'too_many_files',
      'file_too_large',
      'video_too_long',
      'daily_limit',
    ] as const) {
      expect(limitMessage(code, limits)).not.toContain('—');
    }
  });
});

describe('storage meter', () => {
  it('turns amber at 80% and red at 100% of bytes or files', () => {
    expect(storageLevel(usage({ usedBytes: 79 * MB }))).toBe('ok');
    expect(storageLevel(usage({ usedBytes: 80 * MB }))).toBe('warn');
    expect(storageLevel(usage({ usedBytes: 100 * MB }))).toBe('full');
    expect(storageLevel(usage({ files: 3 }))).toBe('full');
    expect(storageLevel({ ...usage(), limits: { ...limits, storageMb: 0 } })).toBe('full');
    expect(meterShare(usage({ usedBytes: 50 * MB }))).toBe(0.5);
    expect(meterShare(usage({ usedBytes: 500 * MB }))).toBe(1);
  });

  it('formats sizes', () => {
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(1.5 * MB)).toBe('1.5 MB');
    expect(formatBytes(3 * 1024 * MB)).toBe('3 GB');
    expect(formatBytes(-1)).toBe('0 KB');
  });
});

describe('video optimization decisions', () => {
  const ok = { codec: 'avc', width: 1080, height: 1920, bitrate: 6_000_000, container: 'mp4' };

  it('skips compliant files and re-encodes everything else', () => {
    expect(shouldTranscodeVideo(ok)).toBe(false);
    expect(shouldTranscodeVideo({ ...ok, container: 'mov' })).toBe(false);
    expect(shouldTranscodeVideo({ ...ok, codec: 'hevc' })).toBe(true);
    expect(shouldTranscodeVideo({ ...ok, codec: null })).toBe(true);
    expect(shouldTranscodeVideo({ ...ok, width: 2160, height: 3840 })).toBe(true);
    expect(shouldTranscodeVideo({ ...ok, bitrate: 12_000_000 })).toBe(true);
    expect(shouldTranscodeVideo({ ...ok, bitrate: null })).toBe(false);
    expect(shouldTranscodeVideo({ ...ok, container: 'webm' })).toBe(true);
    expect(shouldTranscodeVideo({ ...ok, width: 1920, height: 1080 })).toBe(false);
  });

  it('downsizes keeping aspect with even dimensions', () => {
    expect(transcodeSize(3840, 2160)).toEqual({ width: 1920, height: 1080 });
    expect(transcodeSize(2160, 3840)).toEqual({ width: 1080, height: 1920 });
    expect(transcodeSize(1280, 720)).toEqual({ width: 1280, height: 720 });
    expect(transcodeSize(1001, 563)).toEqual({ width: 1002, height: 564 });
    const odd = transcodeSize(4001, 3001);
    expect(odd.width % 2).toBe(0);
    expect(odd.height % 2).toBe(0);
    expect(transcodeSize(1, 1)).toEqual({ width: 2, height: 2 });
  });

  it('picks a safe poster frame', () => {
    expect(posterTimestamp(10)).toBe(0.5);
    expect(posterTimestamp(0.6)).toBe(0.3);
    expect(posterTimestamp(0)).toBe(0);
    expect(posterTimestamp(Number.NaN)).toBe(0);
  });
});

describe('compatibility transcode', () => {
  const ok = { codec: 'avc', width: 1080, height: 1920, bitrate: 6_000_000, container: 'mp4' };

  it('flags non-H.264 and non-MP4 files regardless of size', () => {
    expect(needsCompatibilityTranscode(ok)).toBe(false);
    expect(needsCompatibilityTranscode({ ...ok, container: null })).toBe(false);
    expect(needsCompatibilityTranscode({ ...ok, codec: 'hevc' })).toBe(true);
    expect(needsCompatibilityTranscode({ ...ok, codec: 'vp9', container: 'webm' })).toBe(true);
    expect(needsCompatibilityTranscode({ ...ok, container: 'webm' })).toBe(true);
    // Oversized H.264 is an optimization, not a compatibility problem.
    expect(needsCompatibilityTranscode({ ...ok, width: 3840, height: 2160 })).toBe(false);
  });

  it('scales the target bitrate to the source within 2.5 to 8 Mbps', () => {
    expect(transcodeBitrate({ bitrate: null })).toBe(8_000_000);
    expect(transcodeBitrate({ bitrate: 0 })).toBe(8_000_000);
    expect(transcodeBitrate({ bitrate: 40_000_000 })).toBe(8_000_000);
    expect(transcodeBitrate({ bitrate: 3_000_000 })).toBe(4_800_000);
    expect(transcodeBitrate({ bitrate: 500_000 })).toBe(2_500_000);
  });
});

describe('bucketPeaks', () => {
  it('reduces to at most N normalized peaks', () => {
    const samples = new Float32Array(10_000).map((_, i) => Math.sin(i / 50) * (i < 5000 ? 0.2 : 1));
    const peaks = bucketPeaks(samples, 100);
    expect(peaks).toHaveLength(100);
    expect(Math.max(...peaks)).toBe(1);
    expect(peaks[10]!).toBeLessThan(peaks[90]!);
    expect(bucketPeaks([], 10)).toEqual([]);
    expect(bucketPeaks([0, 0, 0], 10)).toEqual([0, 0, 0]);
    expect(bucketPeaks([0.5, -0.5], 1000)).toEqual([1, 1]);
  });
});
