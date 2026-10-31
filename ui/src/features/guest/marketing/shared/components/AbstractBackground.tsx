import { useEffect, useRef } from 'react';

import { motion } from 'framer-motion';

import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
}

export function AbstractBackground() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    const initParticles = () => {
      const particleCount = Math.floor((canvas.width * canvas.height) / 15000);
      particlesRef.current = Array.from({ length: Math.min(particleCount, 100) }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 1,
        opacity: Math.random() * 0.5 + 0.2,
      }));
    };

    const drawParticles = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      // Draw gradient orbs
      const gradient1 = ctx.createRadialGradient(
        rect.width * 0.2,
        rect.height * 0.3,
        0,
        rect.width * 0.2,
        rect.height * 0.3,
        rect.width * 0.4
      );
      gradient1.addColorStop(0, 'rgba(45, 212, 191, 0.15)');
      gradient1.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient1;
      ctx.fillRect(0, 0, rect.width, rect.height);

      const gradient2 = ctx.createRadialGradient(
        rect.width * 0.8,
        rect.height * 0.7,
        0,
        rect.width * 0.8,
        rect.height * 0.7,
        rect.width * 0.3
      );
      gradient2.addColorStop(0, 'rgba(45, 212, 191, 0.1)');
      gradient2.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient2;
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Draw and update particles
      particlesRef.current.forEach((particle, i) => {
        // Mouse interaction
        const dx = mouseRef.current.x - particle.x;
        const dy = mouseRef.current.y - particle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 150) {
          const force = (150 - dist) / 150;
          particle.vx -= (dx / dist) * force * 0.02;
          particle.vy -= (dy / dist) * force * 0.02;
        }

        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Boundary check
        if (particle.x < 0 || particle.x > rect.width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > rect.height) particle.vy *= -1;

        // Damping
        particle.vx *= 0.99;
        particle.vy *= 0.99;

        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(45, 212, 191, ${particle.opacity})`;
        ctx.fill();

        // Draw connections
        particlesRef.current.slice(i + 1).forEach((other) => {
          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = `rgba(45, 212, 191, ${0.15 * (1 - dist / 120)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      });

      if (!prefersReducedMotion) {
        animationRef.current = requestAnimationFrame(drawParticles);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    resizeCanvas();
    initParticles();
    drawParticles();

    const handleResize = () => {
      resizeCanvas();
      initParticles();
      if (prefersReducedMotion) {
        drawParticles();
      }
    };

    window.addEventListener('resize', handleResize);
    if (!prefersReducedMotion) {
      canvas.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, [prefersReducedMotion]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base gradient - light: soft primary tint; dark: keep current */}
      <div className="from-background via-primary/5 to-background absolute inset-0 bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-slate-900" />

      {/* Animated mesh gradient */}
      <motion.div
        className="absolute inset-0"
        animate={
          prefersReducedMotion
            ? undefined
            : {
                background: [
                  'radial-gradient(ellipse at 20% 30%, rgba(45, 212, 191, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(45, 212, 191, 0.1) 0%, transparent 50%)',
                  'radial-gradient(ellipse at 30% 40%, rgba(45, 212, 191, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, rgba(45, 212, 191, 0.1) 0%, transparent 50%)',
                  'radial-gradient(ellipse at 20% 30%, rgba(45, 212, 191, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(45, 212, 191, 0.1) 0%, transparent 50%)',
                ],
              }
        }
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* Canvas for particles */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ mixBlendMode: 'screen' }}
      />

      {/* SVG decorative elements */}
      <svg className="absolute inset-0 h-full w-full opacity-20" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(45, 212, 191, 0.3)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Floating shapes */}
      <motion.div
        className="bg-primary/5 absolute left-[10%] top-20 h-64 w-64 rounded-full blur-3xl"
        animate={prefersReducedMotion ? undefined : { y: [0, 30, 0], scale: [1, 1.1, 1] }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="bg-primary/5 absolute bottom-20 right-[15%] h-96 w-96 rounded-full blur-3xl"
        animate={prefersReducedMotion ? undefined : { y: [0, -40, 0], scale: [1, 1.15, 1] }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1,
        }}
      />
    </div>
  );
}
