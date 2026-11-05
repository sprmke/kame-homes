/**
 * Prepare a picked file for the Marketing media library, entirely in the browser:
 *   image  → existing optimizer (PHOTO_MASTER), dimensions
 *   video  → probe, optional H.264 re-encode (1080p, ~8 Mbps), poster JPEG, duration
 *   audio  → duration + waveform peaks (decoded in chunks, never fully in memory)
 *
 * Mediabunny (WebCodecs) is imported lazily so it never ships in the main bundle. When the
 * browser cannot encode or decode, we fall back to the original file and the server caps apply.
 */

import {
  AUDIO_PEAK_COUNT,
  exceedsVideoLength,
  kindForFile,
  limitMessage,
  needsCompatibilityTranscode,
  maxBytesFor,
  POSTER_LONG_EDGE,
  posterTimestamp,
  shouldTranscodeVideo,
  transcodeBitrate,
  transcodeSize,
  VIDEO_OPTIMIZE,
  type VideoProbe,
} from '@/features/dashboard/marketing/lib/media/marketingMediaRules';
import type { MarketingMediaKind } from '@/features/dashboard/marketing/lib/media/marketingMediaTypes';
import { PeakAccumulator } from '@/features/dashboard/marketing/lib/media/peaks';
import type { PlanMarketingMediaLibrary } from '@/features/dashboard/plans/lib/planFeatures';
import { prepareImageForUpload } from '@/lib/media/prepareImageForUpload';

export type PrepareStage = 'checking' | 'optimizing' | 'poster' | 'audio';

export type PreparedMedia = {
  kind: MarketingMediaKind;
  file: File;
  mime: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  poster: Blob | null;
  peaks: number[] | null;
  /** The bytes were re-encoded or recompressed. */
  optimized: boolean;
  originalBytes: number;
};

export type PrepareErrorCode =
  'unsupported' | 'unreadable' | 'empty' | 'too_long' | 'too_large' | 'cancelled';

export class PrepareError extends Error {
  readonly code: PrepareErrorCode;
  constructor(code: PrepareErrorCode, message: string) {
    super(message);
    this.name = 'PrepareError';
    this.code = code;
  }
}

export type PrepareOptions = {
  limits: PlanMarketingMediaLibrary;
  signal?: AbortSignal;
  /** 0..1 within the current stage. */
  onProgress?: (stage: PrepareStage, fraction: number) => void;
};

const UNREADABLE = "We couldn't read this file. Try another one.";
const NO_DECODE =
  "This browser can't read this video format. Use Safari, or save it as MP4 (H.264) and try again.";

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new PrepareError('cancelled', 'Cancelled');
}

function baseName(name: string): string {
  const dot = name.lastIndexOf('.');
  return (dot > 0 ? name.slice(0, dot) : name) || 'media';
}

async function imageDimensions(file: Blob): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null; // HEIC on browsers without a decoder: the server still accepts it.
  }
}

async function prepareImage(file: File, options: PrepareOptions): Promise<PreparedMedia> {
  const prepared = await prepareImageForUpload(file, {
    preset: 'PHOTO_MASTER',
    surface: 'marketing-uploads',
    kind: 'image',
    signal: options.signal,
    onProgress: (fraction) => options.onProgress?.('optimizing', fraction),
  });
  if (prepared.error) throw new PrepareError('too_large', prepared.error);
  const size = await imageDimensions(prepared.file);
  return {
    kind: 'image',
    file: prepared.file,
    mime: prepared.file.type || file.type || 'image/jpeg',
    width: size?.width ?? null,
    height: size?.height ?? null,
    durationMs: null,
    poster: null,
    peaks: null,
    optimized: prepared.changed,
    originalBytes: file.size,
  };
}

type Mediabunny = typeof import('mediabunny');

async function openInput(mb: Mediabunny, file: Blob) {
  return new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
}

function containerOf(formatName: string): string | null {
  const name = formatName.toLowerCase();
  if (name.includes('webm') || name.includes('matroska')) return 'webm';
  if (name.includes('quicktime')) return 'mov';
  if (name.includes('mp4') || name.includes('mpeg-4')) return 'mp4';
  return null;
}

/** Read codec, size, bitrate, duration and container without decoding the file. */
async function probeVideoFile(
  file: Blob
): Promise<{ probe: VideoProbe; durationMs: number } | null> {
  const mb = await import('mediabunny');
  const input = await openInput(mb, file);
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return null;
    const [duration, format, stats, decodable] = await Promise.all([
      input.computeDuration(),
      input.getFormat(),
      track.computePacketStats(200).catch(() => null),
      track.canDecode().catch(() => false),
    ]);
    if (!decodable) throw new PrepareError('unsupported', NO_DECODE);
    return {
      probe: {
        codec: track.codec,
        width: track.displayWidth,
        height: track.displayHeight,
        bitrate: stats?.averageBitrate ?? null,
        container: containerOf(format.name),
      },
      durationMs: Math.round(duration * 1000),
    };
  } finally {
    input.dispose();
  }
}

async function makePoster(mb: Mediabunny, file: Blob, durationSec: number): Promise<Blob | null> {
  const input = await openInput(mb, file);
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return null;
    const long = Math.max(track.displayWidth, track.displayHeight);
    const scale = long > POSTER_LONG_EDGE ? POSTER_LONG_EDGE / long : 1;
    const sink = new mb.CanvasSink(track, {
      width: Math.max(2, Math.round(track.displayWidth * scale)),
      height: Math.max(2, Math.round(track.displayHeight * scale)),
      fit: 'fill',
    });
    const wrapped = await sink.getCanvas(posterTimestamp(durationSec));
    if (!wrapped) return null;
    const canvas = wrapped.canvas;
    if (canvas instanceof OffscreenCanvas)
      return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
  } catch {
    return null; // A missing poster only costs the grid thumbnail.
  } finally {
    input.dispose();
  }
}

async function transcodeVideo(
  mb: Mediabunny,
  file: File,
  probe: VideoProbe,
  options: PrepareOptions
): Promise<File | null> {
  const size = transcodeSize(probe.width, probe.height);
  const bitrate = transcodeBitrate(probe);
  const canEncode = await mb.canEncodeVideo('avc', {
    width: size.width,
    height: size.height,
    bitrate,
  });
  if (!canEncode) return null;

  const input = await openInput(mb, file);
  const output = new mb.Output({
    format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new mb.BufferTarget(),
  });
  const conversion = await mb.Conversion.init({
    input,
    output,
    tracks: 'primary',
    video: {
      codec: 'avc',
      width: size.width,
      height: size.height,
      fit: 'contain',
      bitrate,
    },
    audio: { codec: 'aac', bitrate: VIDEO_OPTIMIZE.audioBitrate },
  });
  if (!conversion.isValid) {
    input.dispose();
    return null;
  }
  conversion.onProgress = (progress) => options.onProgress?.('optimizing', progress);
  const onAbort = () => void conversion.cancel();
  options.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    await conversion.execute();
  } catch (error) {
    if (options.signal?.aborted) throw new PrepareError('cancelled', 'Cancelled');
    throw error;
  } finally {
    options.signal?.removeEventListener('abort', onAbort);
    input.dispose();
  }
  const buffer = (output.target as InstanceType<Mediabunny['BufferTarget']>).buffer;
  if (!buffer) return null;
  return new File([buffer], `${baseName(file.name)}.mp4`, { type: 'video/mp4' });
}

async function prepareVideo(file: File, options: PrepareOptions): Promise<PreparedMedia> {
  options.onProgress?.('checking', 0);
  let probed: Awaited<ReturnType<typeof probeVideoFile>>;
  try {
    probed = await probeVideoFile(file);
  } catch (error) {
    if (error instanceof PrepareError) throw error;
    throw new PrepareError('unreadable', UNREADABLE);
  }
  if (!probed) throw new PrepareError('unreadable', UNREADABLE);
  throwIfAborted(options.signal);

  if (exceedsVideoLength(probed.durationMs, options.limits)) {
    throw new PrepareError('too_long', limitMessage('video_too_long', options.limits));
  }

  const mb = await import('mediabunny');
  let output = file;
  let optimized = false;
  let width = probed.probe.width;
  let height = probed.probe.height;

  if (shouldTranscodeVideo(probed.probe)) {
    try {
      const converted = await transcodeVideo(mb, file, probed.probe, options);
      // Re-encodes that only shrink an already compatible file must actually be smaller; files in
      // a codec or container that does not play everywhere are always replaced.
      if (converted && (needsCompatibilityTranscode(probed.probe) || converted.size < file.size)) {
        output = converted;
        optimized = true;
        const size = transcodeSize(probed.probe.width, probed.probe.height);
        width = size.width;
        height = size.height;
      }
    } catch (error) {
      if (error instanceof PrepareError) throw error;
      // Encoding failed or is unsupported: fall through with the original; server caps still apply.
    }
  }
  throwIfAborted(options.signal);

  if (output.size > maxBytesFor('video', options.limits)) {
    throw new PrepareError('too_large', limitMessage('file_too_large', options.limits));
  }

  options.onProgress?.('poster', 0);
  const poster = await makePoster(mb, output, probed.durationMs / 1000);
  return {
    kind: 'video',
    file: output,
    mime: output.type || 'video/mp4',
    width,
    height,
    durationMs: probed.durationMs,
    poster,
    peaks: null,
    optimized,
    originalBytes: file.size,
  };
}

async function prepareAudio(file: File, options: PrepareOptions): Promise<PreparedMedia> {
  options.onProgress?.('audio', 0);
  const mb = await import('mediabunny');
  let durationMs: number | null = null;
  let peaks: number[] | null = null;
  const input = await openInput(mb, file);
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new PrepareError('unreadable', UNREADABLE);
    const duration = await input.computeDuration();
    durationMs = Math.round(duration * 1000);
    // Decoding minutes of audio is cheap but not free; skip waveform for very long files.
    if (duration <= 30 * 60 && (await track.canDecode().catch(() => false))) {
      const sink = new mb.AudioBufferSink(track);
      const acc = new PeakAccumulator(duration, AUDIO_PEAK_COUNT);
      for await (const wrapped of sink.buffers()) {
        throwIfAborted(options.signal);
        const channels: Float32Array[] = [];
        for (let c = 0; c < wrapped.buffer.numberOfChannels; c += 1) {
          channels.push(wrapped.buffer.getChannelData(c));
        }
        acc.add(channels, wrapped.timestamp, wrapped.buffer.sampleRate);
        options.onProgress?.('audio', Math.min(1, wrapped.timestamp / Math.max(0.001, duration)));
      }
      peaks = acc.result();
    }
  } catch (error) {
    if (error instanceof PrepareError) throw error;
    throw new PrepareError('unreadable', UNREADABLE);
  } finally {
    input.dispose();
  }
  return {
    kind: 'audio',
    file,
    mime: file.type || 'audio/mpeg',
    width: null,
    height: null,
    durationMs,
    poster: null,
    peaks,
    optimized: false,
    originalBytes: file.size,
  };
}

export async function prepareMarketingMedia(
  file: File,
  options: PrepareOptions
): Promise<PreparedMedia> {
  if (file.size === 0) throw new PrepareError('empty', 'This file is empty.');
  const kind = kindForFile(file);
  if (!kind) {
    throw new PrepareError(
      'unsupported',
      'Use a JPEG, PNG, WebP or HEIC photo, an MP4 or MOV video, or an MP3, M4A or WAV audio file.'
    );
  }
  throwIfAborted(options.signal);
  switch (kind) {
    case 'image':
      return prepareImage(file, options);
    case 'video':
      return prepareVideo(file, options);
    case 'audio':
      return prepareAudio(file, options);
  }
}
