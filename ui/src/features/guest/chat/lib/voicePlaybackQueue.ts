import { base64ToInt16 } from './voiceAudioCodec';

const PLAYBACK_SAMPLE_RATE = 24_000;

export class VoicePlaybackQueue {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private analyserBuffer: Uint8Array<ArrayBuffer> | null = null;
  private nextPlayTime = 0;
  private pending = 0;

  get pendingCount(): number {
    return this.pending;
  }

  async enqueue(
    base64Pcm: string,
    callbacks: { onStart: () => void; onIdle: () => void }
  ): Promise<void> {
    const samples = base64ToInt16(base64Pcm);
    const context = this.context ?? new AudioContext({ sampleRate: PLAYBACK_SAMPLE_RATE });
    this.context = context;
    if (!this.analyser) {
      this.analyser = context.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.connect(context.destination);
    }
    if (context.state === 'suspended') await context.resume();

    const float = new Float32Array(samples.length);
    for (let index = 0; index < samples.length; index += 1) {
      float[index] = samples[index]! / 0x8000;
    }

    const buffer = context.createBuffer(1, float.length, PLAYBACK_SAMPLE_RATE);
    buffer.copyToChannel(float, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyser);

    const startAt = Math.max(context.currentTime, this.nextPlayTime);
    this.nextPlayTime = startAt + buffer.duration;
    this.pending += 1;
    callbacks.onStart();
    source.onended = () => {
      this.pending = Math.max(0, this.pending - 1);
      if (this.pending === 0) callbacks.onIdle();
    };
    source.start(startAt);
  }

  readRms(): number {
    if (!this.analyser) return 0;
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

  stop(): void {
    this.analyser?.disconnect();
    this.analyser = null;
    this.analyserBuffer = null;
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null;
    this.nextPlayTime = 0;
    this.pending = 0;
  }
}
