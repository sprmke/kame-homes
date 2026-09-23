/**
 * AudioWorkletProcessor that forwards raw mic PCM (Float32, mono) to the main thread.
 * Kept dependency-free (no bundler) since it runs in the isolated worklet global scope.
 */
class VoicePcmRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetRate = 16000;
    this.chunkSize = 512; // 32 ms at 16 kHz
    this.pending = new Int16Array(this.chunkSize);
    this.pendingLength = 0;
    this.pendingSquareSum = 0;
    this.source = new Float32Array(4096);
    this.sourceLength = 0;
    this.sourcePosition = 0;
  }

  process(inputs) {
    const input = inputs[0];
    const channel = input && input[0];
    if (channel && channel.length > 0) {
      if (this.sourceLength + channel.length > this.source.length) {
        const grown = new Float32Array(
          Math.max(this.source.length * 2, this.sourceLength + channel.length)
        );
        grown.set(this.source.subarray(0, this.sourceLength));
        this.source = grown;
      }
      this.source.set(channel, this.sourceLength);
      this.sourceLength += channel.length;

      const ratio = sampleRate / this.targetRate;
      while (this.sourcePosition + 1 < this.sourceLength) {
        const left = Math.floor(this.sourcePosition);
        const fraction = this.sourcePosition - left;
        const sample = this.source[left] + (this.source[left + 1] - this.source[left]) * fraction;
        const clamped = Math.max(-1, Math.min(1, sample));
        this.pending[this.pendingLength] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
        this.pendingSquareSum += clamped * clamped;
        this.pendingLength += 1;
        this.sourcePosition += ratio;

        if (this.pendingLength === this.chunkSize) {
          const chunk = this.pending.slice();
          this.port.postMessage(
            { pcm: chunk, rms: Math.sqrt(this.pendingSquareSum / this.chunkSize) },
            [chunk.buffer]
          );
          this.pendingLength = 0;
          this.pendingSquareSum = 0;
        }
      }

      const consumed = Math.min(Math.floor(this.sourcePosition), this.sourceLength);
      if (consumed > 0) {
        this.source.copyWithin(0, consumed, this.sourceLength);
        this.sourceLength -= consumed;
        this.sourcePosition -= consumed;
      }
    }
    return true;
  }
}

registerProcessor('voice-pcm-recorder', VoicePcmRecorderProcessor);
