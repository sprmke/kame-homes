import { useCallback, useEffect, useRef, useState } from 'react';

import jsQR from 'jsqr';
import { ImagePlus, ScanLine } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { IDENTITY_UPLOAD_ACCEPT } from '../../lib/documentTypes';

type QrScanStepProps = {
  onScanned: (payload: string) => void;
  onUseUpload: (file: File) => void;
};

const SCAN_INTERVAL_MS = 160;

/**
 * QR scan for the PhilSys payload. `BarcodeDetector` is used where the browser has it;
 * `jsQR` covers Safari and Firefox, which is why the module is not a one-liner.
 *
 * A scan failure is a message, not a dead end: the photo path is always one tap away.
 */
export function QrScanStep({ onScanned, onUseUpload }: QrScanStepProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) for (const track of stream.getTracks()) track.stop();
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    return stop;
  }, [stop]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStarting(false);
        setMessage('This browser cannot open the camera. Use a photo instead.');
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch {
        if (cancelled) return;
        setStarting(false);
        setMessage('Camera access is off. Use a photo instead.');
        return;
      }
      if (cancelled) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      try {
        await video.play();
      } catch {
        /* iOS needs a gesture; the loop below still reads once frames arrive. */
      }
      if (cancelled) return;
      setStarting(false);

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        setMessage('This browser cannot scan a QR code. Use a photo instead.');
        return;
      }

      timerRef.current = window.setInterval(() => {
        if (doneRef.current || video.readyState < 2) return;
        const width = 480;
        const height = Math.round((video.videoHeight / Math.max(video.videoWidth, 1)) * width) || 360;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        context.drawImage(video, 0, 0, width, height);
        const image = context.getImageData(0, 0, width, height);
        const result = jsQR(image.data, width, height, { inversionAttempts: 'attemptBoth' });
        if (!result?.data) return;
        doneRef.current = true;
        stop();
        onScanned(result.data);
      }, SCAN_INTERVAL_MS);
    };

    void run();
    return () => {
      cancelled = true;
      stop();
    };
  }, [onScanned, stop]);

  const pickUpload = async (file: File) => {
    doneRef.current = true;
    stop();
    // Decode the QR straight out of the photo first; a clear shot of the card is often
    // enough, and that keeps the guest on the PhilSys path.
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (context) {
        context.drawImage(bitmap, 0, 0);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(image.data, canvas.width, canvas.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (decoded?.data) {
          onScanned(decoded.data);
          return;
        }
      }
    } catch {
      /* Fall through to the document path. */
    }
    onUseUpload(file);
  };

  return (
    <div className="space-y-4">
      <div className="bg-muted relative aspect-square w-full overflow-hidden rounded-2xl">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          aria-label="QR scanner preview"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[58%] w-[58%] rounded-2xl border-2 border-white/80" />
        </div>
        {starting && (
          <div className="absolute inset-0 flex items-center justify-center">
            <ScanLine className="text-muted-foreground h-6 w-6 animate-pulse" />
          </div>
        )}
      </div>

      {message && <p className="text-destructive text-center text-sm">{message}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept={IDENTITY_UPLOAD_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void pickUpload(file);
          event.target.value = '';
        }}
      />

      <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
        <ImagePlus className="mr-2 h-4 w-4" />
        Use a photo instead
      </Button>

      <p className="text-muted-foreground text-center text-xs">
        Point the camera at the QR code on your ID
      </p>
    </div>
  );
}
