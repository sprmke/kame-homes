export const VOICE_MIC_SAMPLE_RATE = 16_000;

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

export class VoiceMicrophoneCapture {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;

  get isAttached(): boolean {
    return this.worklet !== null;
  }

  async acquire(onDisconnected: () => void): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
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
    this.context = new AudioContext({ sampleRate: VOICE_MIC_SAMPLE_RATE });
    await this.context.audioWorklet.addModule('/worklets/voice-pcm-recorder.js');
    this.source = this.context.createMediaStreamSource(this.stream);
    this.worklet = new AudioWorkletNode(this.context, 'voice-pcm-recorder');
    this.worklet.port.onmessage = (event: MessageEvent<{ pcm: Int16Array; rms: number }>) => {
      onChunk(event.data);
    };
    this.source.connect(this.worklet);
  }

  stop(): void {
    this.worklet?.port.close();
    this.worklet?.disconnect();
    this.worklet = null;
    this.source?.disconnect();
    this.source = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null;
  }
}
