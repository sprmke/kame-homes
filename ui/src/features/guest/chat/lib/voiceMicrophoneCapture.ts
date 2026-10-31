export const VOICE_MIC_SAMPLE_RATE = 16_000;

const WORKLET_URL = '/worklets/voice-pcm-recorder.js';
/** Anti-alias cutoff before the worklet downsamples the device rate to 16 kHz. */
const ANTI_ALIAS_CUTOFF_HZ = 7_200;

function friendlyMicErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return 'Microphone access is blocked. Allow microphone access in your browser settings and try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone was found on this device.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Your microphone is in use by another app. Close it and try again.';
  }
  return 'Could not access your microphone.';
}

/**
 * Mic → low-pass → PCM worklet (16 kHz, 32 ms packets). The context runs at the device rate
 * (Firefox rejects a forced 16 kHz context with a 48 kHz stream); the worklet resamples.
 */
export class VoiceMicrophoneCapture {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private moduleReady: Promise<void> | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private worklet: AudioWorkletNode | null = null;

  get isAttached(): boolean {
    return this.worklet !== null;
  }

  /** Call from the user's tap: unlocks the context on iOS and starts loading the worklet early. */
  prepare(): void {
    if (this.context && this.context.state !== 'closed') return;
    this.context = new AudioContext();
    void this.context.resume().catch(() => undefined);
    this.moduleReady = this.context.audioWorklet.addModule(WORKLET_URL);
    // Surface load failures from attach(), not as an unhandled rejection.
    this.moduleReady.catch(() => undefined);
  }

  async acquire(onDisconnected: () => void): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.stream.getTracks().forEach((track) => {
        track.addEventListener('ended', onDisconnected, { once: true });
      });
    } catch (error) {
      throw new Error(friendlyMicErrorMessage(error));
    }
  }

  async attach(onChunk: (chunk: { pcm: Int16Array; rms: number }) => void): Promise<void> {
    if (!this.stream) throw new Error('Microphone not ready.');
    this.prepare();
    const context = this.context!;
    await this.moduleReady;
    if (context.state === 'suspended') await context.resume().catch(() => undefined);

    this.source = context.createMediaStreamSource(this.stream);
    this.worklet = new AudioWorkletNode(context, 'voice-pcm-recorder');
    this.worklet.port.onmessage = (event: MessageEvent<{ pcm: Int16Array; rms: number }>) => {
      onChunk(event.data);
    };
    if (context.sampleRate > VOICE_MIC_SAMPLE_RATE) {
      this.filter = context.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = ANTI_ALIAS_CUTOFF_HZ;
      this.source.connect(this.filter).connect(this.worklet);
    } else {
      this.source.connect(this.worklet);
    }
  }

  /** Resume after the OS suspended audio (iOS backgrounding, screen lock, a phone call). */
  resume(): void {
    if (this.context && this.context.state !== 'closed' && this.context.state !== 'running') {
      void this.context.resume().catch(() => undefined);
    }
  }

  stop(): void {
    if (this.worklet) {
      this.worklet.port.onmessage = null;
      this.worklet.port.close();
      this.worklet.disconnect();
    }
    this.worklet = null;
    this.filter?.disconnect();
    this.filter = null;
    this.source?.disconnect();
    this.source = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null;
    this.moduleReady = null;
  }
}
