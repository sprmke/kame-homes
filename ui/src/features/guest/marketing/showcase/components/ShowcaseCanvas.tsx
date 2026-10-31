import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

type ShowcaseCanvasVariant = 'mesh' | 'particles' | 'grain';

export function ShowcaseCanvas({
  variant,
  className,
  paused,
}: {
  variant: ShowcaseCanvasVariant;
  className?: string;
  paused?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visibleRef = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || paused) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: variant === 'grain' });
    if (!ctx) return;

    let raf = 0;
    let t = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const { width, height } = parent.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      if (!visibleRef.current) {
        raf = requestAnimationFrame(draw);
        return;
      }
      t += 0.008;
      const { width, height } = canvas.getBoundingClientRect();
      if (width < 1 || height < 1) {
        raf = requestAnimationFrame(draw);
        return;
      }
      ctx.clearRect(0, 0, width, height);

      if (variant === 'mesh') {
        const g = ctx.createLinearGradient(0, 0, width, height);
        g.addColorStop(0, `hsla(168, 45%, 42%, ${0.18 + Math.sin(t) * 0.05})`);
        g.addColorStop(0.5, `hsla(190, 40%, 35%, ${0.12 + Math.cos(t * 0.8) * 0.04})`);
        g.addColorStop(1, `hsla(40, 30%, 70%, ${0.1 + Math.sin(t * 1.2) * 0.03})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
        for (let i = 0; i < 3; i++) {
          const x = width * (0.2 + i * 0.25) + Math.sin(t + i) * 40;
          const y = height * (0.3 + (i % 2) * 0.25) + Math.cos(t * 0.7 + i) * 30;
          const rad = 120 + i * 40;
          const orb = ctx.createRadialGradient(x, y, 0, x, y, rad);
          orb.addColorStop(0, `hsla(168, 50%, 50%, 0.22)`);
          orb.addColorStop(1, 'hsla(168, 50%, 50%, 0)');
          ctx.fillStyle = orb;
          ctx.beginPath();
          ctx.arc(x, y, rad, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (variant === 'particles') {
        ctx.fillStyle = 'hsla(0, 0%, 100%, 0.03)';
        ctx.fillRect(0, 0, width, height);
        for (let i = 0; i < 40; i++) {
          const x = (i * 97 + t * 30) % width;
          const y = (i * 53 + Math.sin(t + i) * 20) % height;
          ctx.fillStyle = `hsla(0, 0%, 100%, ${0.08 + (i % 5) * 0.02})`;
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Noise in buffer pixels (putImageData ignores the current transform).
        const bw = canvas.width;
        const bh = canvas.height;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = 'hsla(0, 0%, 0%, 0.04)';
        ctx.fillRect(0, 0, bw, bh);
        const image = ctx.createImageData(bw, bh);
        const data = image.data;
        for (let i = 0; i < data.length; i += 4) {
          const n = Math.random() * 255;
          data[i] = n;
          data[i + 1] = n;
          data[i + 2] = n;
          data[i + 3] = 18;
        }
        ctx.putImageData(image, 0, 0);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const io = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = Boolean(entry?.isIntersecting);
      },
      { threshold: 0.01 }
    );
    io.observe(canvas);

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [variant, paused]);

  if (paused) {
    return (
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0',
          variant === 'mesh' && 'from-primary/20 to-muted bg-gradient-to-br via-transparent',
          variant === 'grain' && 'bg-foreground/5',
          variant === 'particles' && 'bg-foreground/10',
          className
        )}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0', className)}
    />
  );
}
