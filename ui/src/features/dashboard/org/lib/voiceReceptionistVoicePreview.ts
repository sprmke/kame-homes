/** Shared voice labels for Gemini Live prebuilt voices (UI mirror of edge list). */

export const GEMINI_LIVE_VOICE_LABELS: Record<string, string> = {
  Puck: 'Puck (Upbeat)',
  Charon: 'Charon (Informative)',
  Kore: 'Kore (Firm)',
  Fenrir: 'Fenrir (Excitable)',
  Aoede: 'Aoede (Breezy)',
};

export function geminiLiveVoiceLabel(voiceId: string): string {
  return GEMINI_LIVE_VOICE_LABELS[voiceId] ?? voiceId;
}

/** Must stay in sync with edge `voicePreviewLine()`. */
export function voicePreviewLine(propertyName?: string | null): string {
  const name = propertyName?.trim() || 'this property';
  return `Hi, I'm the ${name} receptionist. How can I help with your stay today?`;
}

export type VoicePreviewAudio = {
  mimeType: string;
  sampleRateHz: number;
  audioBase64: string;
};

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function pcmToWavBlob(pcm: Uint8Array, sampleRateHz: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRateHz * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcm.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRateHz, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  new Uint8Array(buffer, 44).set(pcm);

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Play Gemini TTS preview audio (PCM/L16 base64 or already-encoded audio).
 * Returns a stop function that pauses/clears the current element.
 */
export function playVoicePreviewAudio(preview: VoicePreviewAudio): () => void {
  const bytes = base64ToUint8Array(preview.audioBase64);
  const mime = preview.mimeType.toLowerCase();
  const isPcm = mime.includes('l16') || mime.includes('pcm') || mime.startsWith('audio/l16');

  // Fresh ArrayBuffer-backed copy — DOM `BlobPart` rejects SharedArrayBuffer-backed views.
  const audioBytes = Uint8Array.from(bytes);
  const blob = isPcm
    ? pcmToWavBlob(audioBytes, preview.sampleRateHz || 24_000)
    : new Blob([audioBytes], { type: preview.mimeType || 'audio/wav' });

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  const cleanup = () => {
    audio.pause();
    audio.removeAttribute('src');
    URL.revokeObjectURL(url);
  };
  audio.addEventListener('ended', cleanup, { once: true });
  audio.addEventListener('error', cleanup, { once: true });
  void audio.play().catch(() => cleanup());
  return cleanup;
}
