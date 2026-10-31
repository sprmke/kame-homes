import * as React from 'react';

import { Eraser, Loader2 } from 'lucide-react';

import { signatureFrameClassName } from '@/features/dashboard/bookings/components/SignaturePreviewBox';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SignaturePadProps = {
  disabled?: boolean;
  saving?: boolean;
  visible?: boolean;
  onSave: (file: File) => Promise<void>;
  onPreviewChange?: (url: string | null) => void;
  savedImageUrl?: string | null;
  className?: string;
};

function prepareCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2;
  return ctx;
}

async function paintBlobOnCanvas(canvas: HTMLCanvasElement, blob: Blob): Promise<boolean> {
  const ctx = prepareCanvasContext(canvas);
  if (!ctx) return false;

  const rect = canvas.getBoundingClientRect();

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      const scale = Math.min(rect.width / img.width, rect.height / img.height, 1);
      const width = img.width * scale;
      const height = img.height * scale;
      const x = (rect.width - width) / 2;
      const y = (rect.height - height) / 2;
      ctx.drawImage(img, x, y, width, height);
      URL.revokeObjectURL(objectUrl);
      resolve(true);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(false);
    };
    img.src = objectUrl;
  });
}

async function paintImageOnCanvas(canvas: HTMLCanvasElement, url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return false;
    const blob = await res.blob();
    if (blob.size === 0) return false;
    return paintBlobOnCanvas(canvas, blob);
  } catch {
    return false;
  }
}

function setupCanvas(canvas: HTMLCanvasElement): () => void {
  const ctx = prepareCanvasContext(canvas);
  if (!ctx) return () => undefined;

  const rect = canvas.getBoundingClientRect();

  return () => {
    ctx.clearRect(0, 0, rect.width, rect.height);
  };
}

export function SignaturePad({
  disabled,
  saving,
  visible = true,
  onSave,
  onPreviewChange,
  savedImageUrl,
  className,
}: SignaturePadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawingRef = React.useRef(false);
  const lastPointRef = React.useRef<{ x: number; y: number } | null>(null);
  const hasStrokeRef = React.useRef(false);
  const canvasDirtyRef = React.useRef(false);
  const userClearedRef = React.useRef(false);
  const paintGenerationRef = React.useRef(0);
  const previewUrlRef = React.useRef<string | null>(null);
  const previewTimerRef = React.useRef<number | null>(null);
  const [hasStroke, setHasStroke] = React.useState(false);
  const [needsSave, setNeedsSave] = React.useState(false);

  const clearPreviewUrl = React.useCallback(() => {
    if (previewUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = null;
    onPreviewChange?.(null);
  }, [onPreviewChange]);

  const publishPreview = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokeRef.current) {
      clearPreviewUrl();
      return;
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      const nextUrl = URL.createObjectURL(blob);
      previewUrlRef.current = nextUrl;
      onPreviewChange?.(nextUrl);
    }, 'image/png');
  }, [clearPreviewUrl, onPreviewChange]);

  const schedulePreview = React.useCallback(() => {
    if (previewTimerRef.current != null) {
      window.clearTimeout(previewTimerRef.current);
    }
    previewTimerRef.current = window.setTimeout(() => {
      previewTimerRef.current = null;
      publishPreview();
    }, 120);
  }, [publishPreview]);

  const resetCanvas = React.useCallback(() => {
    paintGenerationRef.current += 1;
    userClearedRef.current = true;
    canvasDirtyRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const clear = setupCanvas(canvas);
    clear();
    hasStrokeRef.current = false;
    setHasStroke(false);
    setNeedsSave(false);
    clearPreviewUrl();
  }, [clearPreviewUrl]);

  const paintSavedImage = React.useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !savedImageUrl || canvasDirtyRef.current || userClearedRef.current) return;

    const generation = ++paintGenerationRef.current;
    const painted = await paintImageOnCanvas(canvas, savedImageUrl);
    if (
      generation !== paintGenerationRef.current ||
      canvasDirtyRef.current ||
      userClearedRef.current
    ) {
      return;
    }
    if (!painted) return;
    hasStrokeRef.current = true;
    setHasStroke(true);
    setNeedsSave(false);
  }, [savedImageUrl]);

  React.useEffect(() => {
    return () => {
      if (previewTimerRef.current != null) {
        window.clearTimeout(previewTimerRef.current);
      }
      if (previewUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const observer = new ResizeObserver(() => {
      if (canvasDirtyRef.current || userClearedRef.current) return;
      void paintSavedImage();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [paintSavedImage]);

  React.useEffect(() => {
    if (!visible) return;
    void paintSavedImage();
  }, [paintSavedImage, visible]);

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled || saving) return;
    event.preventDefault();
    userClearedRef.current = false;
    canvasDirtyRef.current = true;
    canvasRef.current?.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = getPoint(event);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !lastPointRef.current || disabled || saving) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const point = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
    setNeedsSave(true);

    if (!hasStrokeRef.current) {
      hasStrokeRef.current = true;
      setHasStroke(true);
    }
    schedulePreview();
  }

  function stopDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    if (canvasRef.current?.hasPointerCapture(event.pointerId)) {
      canvasRef.current.releasePointerCapture(event.pointerId);
    }
    drawingRef.current = false;
    lastPointRef.current = null;
    schedulePreview();
  }

  async function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokeRef.current || disabled || saving) return;

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });
    if (!blob) throw new Error('Could not export signature');

    const file = new File([blob], 'gaf_unit_owner_signature.png', { type: 'image/png' });
    await onSave(file);
    canvasDirtyRef.current = false;
    userClearedRef.current = false;
    setNeedsSave(false);

    paintGenerationRef.current += 1;
    const painted = await paintBlobOnCanvas(canvas, blob);
    if (painted) {
      hasStrokeRef.current = true;
      setHasStroke(true);
    }
  }

  const busy = disabled || saving;

  return (
    <div className={cn('space-y-3', className)}>
      <canvas
        ref={canvasRef}
        aria-label="Draw signature"
        className={cn(
          signatureFrameClassName,
          'touch-none',
          busy ? 'cursor-not-allowed opacity-60' : 'cursor-crosshair'
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        onPointerLeave={stopDrawing}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy || !hasStroke}
          className="min-h-[44px]"
          onClick={() => resetCanvas()}
        >
          <Eraser className="size-4" aria-hidden />
          Clear
        </Button>
        {needsSave && hasStroke ? (
          <Button
            type="button"
            disabled={busy}
            className="min-h-[44px]"
            onClick={() => void handleSave()}
          >
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Save signature
          </Button>
        ) : null}
      </div>
    </div>
  );
}
