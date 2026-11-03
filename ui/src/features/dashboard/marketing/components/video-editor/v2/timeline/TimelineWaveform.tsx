import { useEffect, useRef } from 'react';

type Props = {
  peaks: number[] | null;
  /** Visible slice of the source, 0..1. */
  startRatio?: number;
  endRatio?: number;
  className?: string;
};

/** Mirrored bar waveform on a canvas. Falls back to a flat low bar when peaks are unknown. */
export function TimelineWaveform({ peaks, startRatio = 0, endRatio = 1, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      const barWidth = Math.max(1, Math.round(2 * dpr));
      const gap = Math.max(1, Math.round(1 * dpr));
      const step = barWidth + gap;
      const bars = Math.floor(width / step);
      const mid = height / 2;
      for (let i = 0; i < bars; i += 1) {
        let amplitude = 0.12;
        if (peaks && peaks.length > 0) {
          const ratio = startRatio + (i / Math.max(1, bars - 1)) * (endRatio - startRatio);
          const index = Math.min(peaks.length - 1, Math.max(0, Math.floor(ratio * peaks.length)));
          amplitude = Math.max(0.08, peaks[index] ?? 0);
        }
        const h = Math.max(2, amplitude * height * 0.9);
        ctx.fillRect(i * step, mid - h / 2, barWidth, h);
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [peaks, startRatio, endRatio]);

  return <canvas ref={ref} className={className} aria-hidden />;
}
