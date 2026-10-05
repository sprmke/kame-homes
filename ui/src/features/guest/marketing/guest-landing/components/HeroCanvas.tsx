import { useEffect, useRef, useState } from 'react';

import { motion, useReducedMotion } from 'framer-motion';

import { heroDestinations } from '@/features/guest/marketing/guest-landing/data/landingContent';

import { cn } from '@/lib/utils';

function readPrimaryRgb(): [number, number, number] {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
  if (!raw) return [45, 180, 160];

  // Handle different formats of CSS variables
  const match = raw.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (match) {
    const [_, r, g, b] = match;
    const rNum = parseInt(r);
    const gNum = parseInt(g);
    const bNum = parseInt(b);

    // Validate that all values are valid numbers
    if (!isNaN(rNum) && !isNaN(gNum) && !isNaN(bNum)) {
      return [rNum, gNum, bNum];
    }
  }

  // Fallback to default values if parsing fails
  return [45, 180, 160];
}

function isDarkTheme() {
  return document.documentElement.classList.contains('dark');
}

export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: 0.5, y: 0.5 });
  const frameRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  // Animation and slideshow only run while the hero is on screen (saves CPU/battery
  // once the guest scrolls into the listings).
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) =>
      setOnScreen(entry?.isIntersecting ?? true)
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduceMotion || !onScreen) return;
    const id = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % heroDestinations.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, [reduceMotion, onScreen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reduceMotion || !onScreen) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const dots = Array.from({ length: 36 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.6 + 0.6,
      speed: Math.random() * 0.00025 + 0.00008,
      phase: Math.random() * Math.PI * 2,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // Theme colors change rarely; re-read them every ~60 frames instead of every frame.
    let frameCount = 0;
    let dark = isDarkTheme();
    let [pr, pg, pb] = readPrimaryRgb();

    const draw = (time: number) => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      frameCount += 1;
      if (frameCount % 60 === 0) {
        dark = isDarkTheme();
        [pr, pg, pb] = readPrimaryRgb();
      }

      // Validate that RGB values are valid numbers
      if (isNaN(pr) || isNaN(pg) || isNaN(pb)) {
        console.warn('Invalid RGB values in HeroCanvas:', pr, pg, pb);
        return;
      }

      ctx.clearRect(0, 0, w, h);

      const gx = pointerRef.current.x * w;
      const gy = pointerRef.current.y * h;
      const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.55);
      glow.addColorStop(0, `rgba(${pr}, ${pg}, ${pb}, ${dark ? 0.14 : 0.1})`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      dots.forEach((dot) => {
        const drift = Math.sin(time * dot.speed * 1000 + dot.phase) * 0.012;
        dot.x += drift;
        dot.y += dot.speed * 60;
        if (dot.y > 1.05) dot.y = -0.05;
        if (dot.x < -0.05) dot.x = 1.05;
        if (dot.x > 1.05) dot.x = -0.05;

        ctx.beginPath();
        ctx.arc(dot.x * w, dot.y * h, dot.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${pr}, ${pg}, ${pb}, ${dark ? 0.35 : 0.22})`;
        ctx.fill();
      });

      frameRef.current = requestAnimationFrame(draw);
      raf = frameRef.current;
    };

    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerRef.current = {
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height,
      };
    };

    resize();
    frameRef.current = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointermove', onMove);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointermove', onMove);
    };
  }, [reduceMotion, onScreen]);

  return (
    <div
      ref={rootRef}
      className="relative aspect-[4/5] w-full max-w-md lg:aspect-auto lg:h-[min(72vh,640px)] lg:max-w-none"
      aria-hidden
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full rounded-[2rem]" />

      <div className="border-border/60 bg-card/40 absolute inset-0 rounded-[2rem] border backdrop-blur-[2px]" />

      <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-8">
        <div className="relative h-full w-full max-w-sm">
          {heroDestinations.map((destination, index) => {
            const offset =
              (index - activeIndex + heroDestinations.length) % heroDestinations.length;
            const isFront = offset === 0;
            const isMid = offset === 1;
            const isBack = offset >= 2;

            return (
              <motion.div
                key={destination.id}
                className={cn(
                  'border-border bg-card absolute inset-x-4 overflow-hidden rounded-3xl border shadow-lg',
                  isFront && 'z-30',
                  isMid && 'z-20',
                  isBack && 'z-10 opacity-0'
                )}
                animate={
                  reduceMotion
                    ? { opacity: isFront ? 1 : 0, scale: 1, rotate: 0, y: 0, x: 0 }
                    : {
                        opacity: isFront ? 1 : isMid ? 0.55 : 0,
                        scale: isFront ? 1 : isMid ? 0.92 : 0.84,
                        rotate: isFront ? -2 : isMid ? 4 : 8,
                        y: isFront ? 0 : isMid ? 28 : 56,
                        x: isFront ? 0 : isMid ? 24 : 40,
                      }
                }
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  top: isFront ? '8%' : isMid ? '12%' : '16%',
                  bottom: isFront ? '8%' : isMid ? '4%' : '0%',
                }}
              >
                <img
                  src={destination.image}
                  alt=""
                  className="h-full w-full object-cover"
                  loading={index === 0 ? 'eager' : 'lazy'}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-white/70">
                    Featured stay
                  </p>
                  <p className="text-lg font-semibold text-white">{destination.label}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-1.5">
        {heroDestinations.map((destination, index) => (
          <span
            key={destination.id}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              index === activeIndex ? 'bg-primary w-6' : 'bg-muted-foreground/30 w-1.5'
            )}
          />
        ))}
      </div>
    </div>
  );
}
