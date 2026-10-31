import { useCallback, useEffect, useRef, useState } from 'react';

import { toast } from 'sonner';

import {
  ensureMicrophoneAccess,
  getSpeechRecognitionCtor,
  isSpeechRecognitionSupported,
  rebuildCommittedTranscript,
  resolveSpeechRecognitionLang,
  speechRecognitionErrorMessage,
} from '@/features/dashboard/ai-assistant/lib/speechRecognition';

type Options = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
};

export function useSpeechToText({ value, onChange, disabled }: Options) {
  const [listening, setListening] = useState(false);
  const wantListeningRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const prefixRef = useRef('');
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  valueRef.current = value;
  onChangeRef.current = onChange;

  const pushTranscript = useCallback((results: SpeechRecognitionResultList) => {
    const sessionCommitted = rebuildCommittedTranscript(results);
    let interim = '';
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (!result || result.isFinal) continue;
      interim += result[0]?.transcript ?? '';
    }
    const next = prefixRef.current + sessionCommitted + interim;
    onChangeRef.current(next.trim() ? next.trim() : prefixRef.current.trim());
  }, []);

  const releaseRecognition = useCallback((opts?: { abort?: boolean }) => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return;
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      if (opts?.abort) recognition.abort();
      else recognition.stop();
    } catch {
      /* already ended */
    }
  }, []);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    releaseRecognition({ abort: true });
    setListening(false);
  }, [releaseRecognition]);

  const bindRecognition = useCallback(
    (recognition: SpeechRecognition) => {
      recognition.onstart = () => {
        setListening(true);
      };

      recognition.onresult = (event) => {
        pushTranscript(event.results);
      };

      recognition.onerror = (event) => {
        const code = event.error || 'unknown';
        if (code === 'no-speech' || code === 'aborted') return;
        const message = speechRecognitionErrorMessage(code);
        wantListeningRef.current = false;
        releaseRecognition({ abort: true });
        setListening(false);
        if (message) toast.error(message);
      };

      recognition.onend = () => {
        if (!wantListeningRef.current) {
          if (recognitionRef.current === recognition) recognitionRef.current = null;
          setListening(false);
          return;
        }
        if (recognitionRef.current !== recognition) return;
        prefixRef.current = valueRef.current.trim() ? `${valueRef.current.trim()} ` : '';
        try {
          recognition.start();
        } catch {
          wantListeningRef.current = false;
          recognitionRef.current = null;
          setListening(false);
        }
      };
    },
    [pushTranscript, releaseRecognition]
  );

  const start = useCallback(async () => {
    if (disabled || wantListeningRef.current) return;

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      toast.error('Voice input needs Chrome, Safari, or Edge');
      return;
    }
    if (!window.isSecureContext) {
      toast.error('Voice input needs HTTPS or localhost');
      return;
    }

    const micOk = await ensureMicrophoneAccess();
    if (!micOk) {
      toast.error('Microphone access blocked');
      return;
    }

    releaseRecognition({ abort: true });
    prefixRef.current = valueRef.current.trim() ? `${valueRef.current.trim()} ` : '';
    wantListeningRef.current = true;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = resolveSpeechRecognitionLang();
    recognition.maxAlternatives = 1;

    bindRecognition(recognition);
    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);
    } catch {
      wantListeningRef.current = false;
      recognitionRef.current = null;
      setListening(false);
      toast.error('Could not start voice input');
    }
  }, [bindRecognition, disabled, releaseRecognition]);

  const toggle = useCallback(() => {
    if (wantListeningRef.current) stop();
    else void start();
  }, [start, stop]);

  useEffect(() => {
    if (disabled && wantListeningRef.current) stop();
  }, [disabled, stop]);

  useEffect(
    () => () => {
      wantListeningRef.current = false;
      releaseRecognition({ abort: true });
    },
    [releaseRecognition]
  );

  return { supported: isSpeechRecognitionSupported(), listening, start, stop, toggle };
}
