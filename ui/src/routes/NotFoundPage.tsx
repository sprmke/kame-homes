import { Link, useLocation, useNavigate } from 'react-router-dom';

import { ArrowLeft, Compass } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

/** App-wide catch-all — matched when no other route claims the path. */
export function NotFoundPage() {
  usePageTitle(publicPageTitle('Page not found'));
  const navigate = useNavigate();
  const location = useLocation();
  const canGoBack = location.key !== 'default';

  return (
    <section className="border-border relative overflow-hidden border-b">
      <div
        className="bg-primary/10 pointer-events-none absolute -right-16 top-10 h-56 w-56 rounded-full blur-3xl sm:h-64 sm:w-64"
        aria-hidden="true"
      />
      <div className="container relative mx-auto flex min-h-[70vh] flex-col items-center justify-center px-4 py-20 text-center sm:px-6 sm:py-28">
        <TurtleMascot className="animate-float mb-6 h-16 w-16 sm:h-20 sm:w-20" />

        <span className="text-primary text-xs font-bold uppercase tracking-[0.28em]">
          Error 404
        </span>
        <h1 className="text-foreground mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          This page wandered off
        </h1>
        <p className="text-muted-foreground mt-4 max-w-md text-sm sm:text-base">
          We couldn&apos;t find the page you&apos;re looking for.
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          {canGoBack && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 gap-2"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4" />
              Go back
            </Button>
          )}
          <Button asChild size="lg" className="h-12 gap-2">
            <Link to="/">
              <Compass className="h-4 w-4" />
              Take me home
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Small on-brand nod — Kame ("turtle" in Japanese) is the one who wandered off. */
function TurtleMascot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 100" className={className} aria-hidden="true" focusable="false">
      <ellipse cx="30" cy="78" rx="9" ry="7" fill="hsl(var(--primary))" opacity="0.8" />
      <ellipse cx="90" cy="78" rx="9" ry="7" fill="hsl(var(--primary))" opacity="0.8" />
      <ellipse cx="24" cy="60" rx="8" ry="6.5" fill="hsl(var(--primary))" opacity="0.85" />
      <ellipse cx="96" cy="60" rx="8" ry="6.5" fill="hsl(var(--primary))" opacity="0.85" />

      <circle cx="60" cy="30" r="16" fill="hsl(var(--primary))" opacity="0.9" />
      <ellipse cx="53" cy="27" rx="2.6" ry="2.6" fill="hsl(var(--primary-foreground))" />
      <ellipse cx="67" cy="27" rx="2.6" ry="2.6" fill="hsl(var(--primary-foreground))" />
      <ellipse
        className="animate-turtle-blink origin-center"
        cx="53"
        cy="27"
        rx="2.6"
        ry="2.6"
        fill="hsl(var(--primary))"
      />
      <ellipse
        className="animate-turtle-blink origin-center"
        cx="67"
        cy="27"
        rx="2.6"
        ry="2.6"
        fill="hsl(var(--primary))"
      />
      <path
        d="M54 35 Q60 39 66 35"
        fill="none"
        stroke="hsl(var(--primary-foreground))"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />

      <ellipse cx="60" cy="65" rx="48" ry="34" fill="hsl(var(--primary))" />
      <g stroke="hsl(var(--primary-foreground))" strokeOpacity="0.35" strokeWidth="1.5" fill="none">
        <path d="M60 34 L60 96" />
        <path d="M18 65 L102 65" />
        <path d="M28 40 L60 65 L92 40" />
        <path d="M28 90 L60 65 L92 90" />
        <circle cx="60" cy="65" r="14" />
      </g>
    </svg>
  );
}
