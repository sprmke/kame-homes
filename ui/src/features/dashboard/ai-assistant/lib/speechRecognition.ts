export function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return (
    getSpeechRecognitionCtor() !== null && typeof window !== 'undefined' && window.isSecureContext
  );
}

export function resolveSpeechRecognitionLang(): string {
  const raw =
    (typeof document !== 'undefined' && document.documentElement.lang) ||
    (typeof navigator !== 'undefined' && navigator.language) ||
    'en-US';
  // Bare "en" is unreliable on WebKit — prefer a region tag.
  if (raw === 'en') return 'en-US';
  return raw;
}

export function speechRecognitionErrorMessage(code: string): string | null {
  switch (code) {
    case 'not-allowed':
      return 'Microphone access blocked';
    case 'audio-capture':
      return 'No microphone found';
    case 'network':
      return 'Voice input needs a network connection';
    case 'service-not-allowed':
      return 'Voice input is not available in this browser tab';
    case 'language-not-supported':
      return 'Speech language not supported';
    case 'no-speech':
    case 'aborted':
      return null;
    default:
      return 'Voice input failed';
  }
}

export type SpeechTranscriptParts = {
  committed: string;
  interim: string;
};

/** Split final vs interim tokens from a cumulative results list. */
export function parseSpeechResults(
  results: SpeechRecognitionResultList,
  fromIndex = 0
): SpeechTranscriptParts {
  let committed = '';
  let interim = '';
  for (let i = fromIndex; i < results.length; i++) {
    const result = results[i];
    if (!result) continue;
    const piece = result[0]?.transcript ?? '';
    if (result.isFinal) committed += piece;
    else interim += piece;
  }
  return { committed, interim };
}

/** Merge committed finals from the full results list (for session restarts). */
export function rebuildCommittedTranscript(results: SpeechRecognitionResultList): string {
  let committed = '';
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (!result?.isFinal) continue;
    committed += result[0]?.transcript ?? '';
  }
  return committed;
}

export async function ensureMicrophoneAccess(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return true;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return true;
  } catch {
    return false;
  }
}
