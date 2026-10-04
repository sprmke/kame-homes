import { base64ToInt16 } from './voiceAudioCodec';

export const VOICE_PLAYBACK_SAMPLE_RATE = 24_000;
/** Lead-in when the queue restarts so a late second chunk does not leave an audible gap. */
export const VOICE_PLAYBACK_LEAD_IN_SECONDS = 0.06;
/** Quiet time after the last chunk before playback counts as idle (network jitter between chunks). */
export const VOICE_PLAYBACK_IDLE_GRACE_MS = 280;

type AudioContextCtor = new () => AudioContext;

type PlaybackHandlers = {
  /** Playback went from idle to audible. */
  onStart: () => void;
  /** No audio queued for the grace period. Not called after `interrupt()`. */
  onIdle: () => void;
};

/**
 * Gapless PCM16 playback for Gemini Live audio. One `AudioContext` lives for the whole call so
 * iOS keeps it unlocked after barge-in; interruption stops scheduled sources instead.
 */
export class VoicePlaybackQueue {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private analyserBuffer: Uint8Array<ArrayBuffer> | null = null;
  private readonly sources = new Set<AudioBufferSourceNode>();
  private nextPlayTime = 0;
  private playing = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly handlers: PlaybackHandlers,
    private readonly createContext: AudioContextCtor = AudioContext
  ) {}

  get isPlaying(): boolean {
    return this.playing;
  }

  /** Call from the user's tap so Safari/iOS allow audio output for the rest of the call. */
  unlock(): void {
    const context = this.ensureContext();
    // `interrupted` is Safari's state after a phone call or screen lock.
    if (context.state !== 'running') void context.resume().catch(() => undefined);
  }

  enqueue(base64Pcm: string): void {
    const samples = base64ToInt16(base64Pcm);
    if (!samples.length) return;
    const context = this.ensureContext();
    if (context.state !== 'running') void context.resume().catch(() => undefined);

    const float = new Float32Array(samples.length);
    for (let index = 0; index < samples.length; index += 1) {
      float[index] = samples[index]! / 0x8000;
    }
    const buffer = context.createBuffer(1, float.length, VOICE_PLAYBACK_SAMPLE_RATE);
    buffer.copyToChannel(float, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyser!);

    const restarting = this.sources.size === 0 || this.nextPlayTime < context.currentTime;
    const startAt = restarting
      ? context.currentTime + VOICE_PLAYBACK_LEAD_IN_SECONDS
      : this.nextPlayTime;
    this.nextPlayTime = startAt + buffer.duration;

    this.clearIdleTimer();
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      if (this.sources.size === 0) this.scheduleIdle();
    };
    source.start(startAt);

    if (!this.playing) {
      this.playing = true;
      this.handlers.onStart();
    }
  }

  /** Barge-in: drop queued speech immediately but keep the context unlocked. */
  interrupt(): void {
    this.clearIdleTimer();
    for (const source of this.sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // already stopped
      }
      source.disconnect();
    }
    this.sources.clear();
    this.nextPlayTime = 0;
    this.playing = false;
  }

  readRms(): number {
    if (!this.analyser || !this.playing) return 0;
    if (!this.analyserBuffer) {
      this.analyserBuffer = new Uint8Array(this.analyser.fftSize);
    }
    this.analyser.getByteTimeDomainData(this.analyserBuffer);
    let sum = 0;
    for (let index = 0; index < this.analyserBuffer.length; index += 1) {
      const value = (this.analyserBuffer[index]! - 128) / 128;
      sum += value * value;
    }
    return Math.sqrt(sum / this.analyserBuffer.length);
  }

  close(): void {
    this.interrupt();
    this.analyser?.disconnect();
    this.analyser = null;
    this.analyserBuffer = null;
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null;
  }

  private ensureContext(): AudioContext {
    if (this.context && this.context.state !== 'closed') return this.context;
    const context = new this.createContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.connect(context.destination);
    this.context = context;
    this.analyser = analyser;
    this.analyserBuffer = null;
    this.nextPlayTime = 0;
    return context;
  }

  private scheduleIdle(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.sources.size > 0 || !this.playing) return;
      this.playing = false;
      this.handlers.onIdle();
    }, VOICE_PLAYBACK_IDLE_GRACE_MS);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}
