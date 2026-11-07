import { useEffect, useRef, useState } from 'react';

import { Camera, ImagePlus, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { useDocumentAutoCapture } from '../../hooks/useDocumentAutoCapture';
import { CAPTURE_QUALITY_MESSAGES, type CaptureQualityResult } from '../../lib/captureQuality';
import { IDENTITY_UPLOAD_ACCEPT } from '../../lib/documentTypes';

type DocumentCaptureStepProps = {
  /** "front" or "back" drives the copy only. */
  side: 'front' | 'back';
  onCaptured: (file: File, quality: CaptureQualityResult | null) => void;
  onUseUpload: (file: File) => void;
};

/**
 * Live capture with a frame guide and auto-capture. The upload fallback is always visible:
 * a denied camera, an old browser, or a desktop with no handoff must never dead-end.
 */
export function DocumentCaptureStep({ side, onCaptured, onUseUpload }: DocumentCaptureStepProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [lastQuality, setLastQuality] = useState<CaptureQualityResult | null>(null);
  // StrictMode double-invokes state updaters; never call the parent callback from one.
  const handledRef = useRef(false);

  const camera = useDocumentAutoCapture({
    videoRef,
    autoCapture: true,
    onAutoCapture: (file, quality) => {
      if (handledRef.current) return;
      handledRef.current = true;
      setLastQuality(quality);
      setPreview(URL.createObjectURL(file));
      onCaptured(file, quality);
    },
  });

  const startCamera = camera.start;
  useEffect(() => {
    void startCamera();
  }, [startCamera]);

  useEffect(() => {
    return () => {
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
    };
  }, []);

  const retake = () => {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setLastQuality(null);
    handledRef.current = false;
    void camera.start();
  };

  const pickUpload = (file: File) => {
    camera.stop();
    handledRef.current = true;
    setLastQuality(null);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    onUseUpload(file);
  };

  const issue = camera.quality?.issues[0];

  return (
    <div className="space-y-4">
      <div className="bg-muted relative aspect-[3/4] w-full overflow-hidden rounded-2xl">
        {preview ? (
          <img src={preview} alt="Captured ID" className="h-full w-full object-cover" />
        ) : (
          <>
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
              aria-label="Camera preview"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className={
                  camera.quality?.acceptable
                    ? 'h-[62%] w-[86%] rounded-xl border-2 border-emerald-400'
                    : 'h-[62%] w-[86%] rounded-xl border-2 border-white/70'
                }
              />
            </div>
          </>
        )}

        {camera.state === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm font-medium">
              {camera.error === 'denied' ? 'Camera access is off' : 'Camera is not available'}
            </p>
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus className="mr-2 h-4 w-4" />
              Upload a photo
            </Button>
          </div>
        )}

        {camera.state === 'ready' && !preview && issue && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center">
            <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
              {CAPTURE_QUALITY_MESSAGES[issue]}
            </span>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={IDENTITY_UPLOAD_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) pickUpload(file);
          event.target.value = '';
        }}
      />

      {preview ? (
        <Button type="button" variant="outline" className="w-full" onClick={retake}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Retake
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            className="w-full"
            disabled={camera.state !== 'ready'}
            onClick={() => void camera.capture()}
          >
            <Camera className="mr-2 h-4 w-4" />
            Take photo
          </Button>
          <Button type="button" variant="ghost" onClick={() => fileInputRef.current?.click()}>
            <ImagePlus className="mr-2 h-4 w-4" />
            Upload a photo instead
          </Button>
        </div>
      )}

      <p className="text-muted-foreground text-center text-xs">
        {side === 'front'
          ? lastQuality?.acceptable === false
            ? CAPTURE_QUALITY_MESSAGES[lastQuality.issues[0] ?? 'blurry']
            : 'Photo page of the ID'
          : 'Back of the ID'}
      </p>
    </div>
  );
}
