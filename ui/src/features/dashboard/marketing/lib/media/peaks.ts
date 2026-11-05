import { AUDIO_PEAK_COUNT } from '@/features/dashboard/marketing/lib/media/marketingMediaRules';

/**
 * Builds waveform peaks from decoded audio in chunks, so a long file never sits in memory as PCM.
 * Each bucket keeps the loudest absolute sample across all channels.
 */
export class PeakAccumulator {
  private readonly peaks: Float32Array;
  private max = 0;

  constructor(
    private readonly durationSec: number,
    private readonly count: number = AUDIO_PEAK_COUNT
  ) {
    this.peaks = new Float32Array(Math.max(1, count));
  }

  /** `channels` are the per-channel sample arrays of one decoded chunk starting at `startSec`. */
  add(channels: ArrayLike<number>[], startSec: number, sampleRate: number): void {
    if (this.durationSec <= 0 || sampleRate <= 0) return;
    for (const samples of channels) {
      for (let i = 0; i < samples.length; i += 1) {
        const t = startSec + i / sampleRate;
        const bucket = Math.min(
          this.count - 1,
          Math.max(0, Math.floor((t / this.durationSec) * this.count))
        );
        const value = Math.abs(samples[i]!);
        if (value > this.peaks[bucket]!) this.peaks[bucket] = value;
        if (value > this.max) this.max = value;
      }
    }
  }

  /** Normalized 0..1, three decimals. Empty (all zeros) when nothing was heard. */
  result(): number[] {
    const out: number[] = [];
    for (const peak of this.peaks) {
      out.push(this.max > 0 ? Math.round((peak / this.max) * 1000) / 1000 : 0);
    }
    return out;
  }
}
