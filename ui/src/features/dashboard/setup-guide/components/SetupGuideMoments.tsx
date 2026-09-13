import {
  BadgeCheck,
  Building2,
  Check,
  ChevronRight,
  Home,
  Palette,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { useSetupGuide } from '@/features/dashboard/setup-guide/components/setupGuideContext';
import type { SetupGuideStepProgress } from '@/features/dashboard/setup-guide/lib/setupGuideTypes';

import { cn } from '@/lib/utils';

function firstStepId(
  entries: SetupGuideStepProgress[],
  match: (entry: SetupGuideStepProgress) => boolean
): string | null {
  return entries.find(match)?.step.id ?? null;
}

function isComplete(
  entries: SetupGuideStepProgress[],
  match: (entry: SetupGuideStepProgress) => boolean
): boolean {
  const matched = entries.filter(match);
  return matched.length > 0 && matched.every((entry) => entry.status === 'complete');
}

export function WelcomeStep() {
  const { progress, goToStep } = useSetupGuide();
  const entries = progress.steps;

  const brandId = firstStepId(entries, (entry) => entry.step.kind === 'org.brand');
  const verifyId = firstStepId(entries, (entry) => entry.step.kind === 'org.verification');
  const listingId = firstStepId(
    entries,
    (entry) => entry.step.group.type === 'property' || entry.step.group.type === 'parking'
  );
  const teamId = firstStepId(entries, (entry) => entry.step.kind === 'org.team');

  const paths = [
    {
      id: brandId,
      label: 'Brand',
      icon: Palette,
      done: isComplete(entries, (entry) => entry.step.kind === 'org.brand'),
    },
    {
      id: listingId,
      label: 'Listings',
      icon: Building2,
      done: isComplete(
        entries,
        (entry) => entry.step.group.type === 'property' || entry.step.group.type === 'parking'
      ),
    },
    {
      id: verifyId,
      label: 'Verification',
      icon: ShieldCheck,
      done: isComplete(entries, (entry) => entry.step.kind === 'org.verification'),
    },
    {
      id: teamId,
      label: 'Team',
      icon: Users,
      done: isComplete(entries, (entry) => entry.step.kind === 'org.team'),
    },
  ].filter((path) => path.id);

  return (
    <div className="flex flex-col items-center px-1 py-6 text-center sm:py-10">
      <div
        className={cn(
          'bg-primary/10 text-primary relative flex size-20 items-center justify-center rounded-full',
          'motion-safe:animate-setup-guide-ring'
        )}
      >
        <span className="motion-safe:animate-setup-guide-hero-in flex items-center justify-center">
          <Home className="motion-safe:animate-float size-9" strokeWidth={1.75} aria-hidden />
        </span>
      </div>
      <h3 className="text-foreground mt-5 text-xl font-semibold tracking-tight sm:text-2xl">
        Welcome
      </h3>
      <p className="text-muted-foreground mt-1.5 max-w-[26rem] text-sm leading-relaxed">
        Walk through brand, listings, and payments so guests see accurate info when they book.
        Required steps must be finished to complete setup. Verification and team invites are
        optional.
      </p>
      <ul className="mt-6 grid w-full max-w-md grid-cols-2 gap-2">
        {paths.map((path, index) => {
          const Icon = path.icon;
          return (
            <li
              key={path.label}
              className="motion-safe:animate-setup-guide-stagger"
              style={{ animationDelay: `${80 + index * 70}ms` }}
            >
              <button
                type="button"
                onClick={() => path.id && goToStep(path.id)}
                className={cn(
                  'border-border bg-card hover:border-primary/40 hover:bg-primary/5',
                  'focus-visible:ring-ring flex min-h-11 w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left',
                  'transition-[border-color,background-color,transform] duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 active:scale-[0.98]'
                )}
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full',
                    path.done ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
                  )}
                >
                  {path.done ? (
                    <Check className="size-4" strokeWidth={2.5} aria-hidden />
                  ) : (
                    <Icon className="size-4" aria-hidden />
                  )}
                </span>
                <span className="text-foreground min-w-0 flex-1 text-sm font-medium">
                  {path.label}
                </span>
                <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DoneStep() {
  const { goToStep, requiredRemaining, progress } = useSetupGuide();
  const remaining = progress.steps.filter(
    (entry) => entry.step.requirement === 'required' && entry.status !== 'complete'
  );
  const complete = requiredRemaining <= 0;

  return (
    <div className="flex flex-col items-center px-1 py-6 text-center sm:py-10">
      <div
        className={cn(
          'relative flex size-20 items-center justify-center rounded-full',
          complete ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          'motion-safe:animate-setup-guide-hero-in'
        )}
      >
        {complete ? (
          <span
            className="motion-safe:animate-setup-guide-ring pointer-events-none absolute inset-0 rounded-full"
            aria-hidden
          />
        ) : null}
        {complete ? (
          <BadgeCheck className="motion-safe:animate-setup-guide-check-in size-10" aria-hidden />
        ) : (
          <Check className="size-9" strokeWidth={2.5} aria-hidden />
        )}
      </div>
      <h3 className="text-foreground mt-5 text-xl font-semibold tracking-tight sm:text-2xl">
        {complete ? "You're all set" : 'Almost there'}
      </h3>
      <p className="text-muted-foreground mt-1.5 max-w-[22rem] text-sm leading-relaxed">
        {complete
          ? 'Required setup is done. Reopen from Finish setup.'
          : `${requiredRemaining} required ${requiredRemaining === 1 ? 'item' : 'items'} still open.`}
      </p>

      {!complete && remaining.length > 0 ? (
        <ul className="mt-5 w-full max-w-md space-y-1.5 text-left">
          {remaining.slice(0, 6).map((entry, index) => (
            <li
              key={entry.step.id}
              className="motion-safe:animate-setup-guide-stagger"
              style={{ animationDelay: `${60 + index * 50}ms` }}
            >
              <button
                type="button"
                onClick={() => goToStep(entry.step.id)}
                className={cn(
                  'border-border hover:bg-muted/60 focus-visible:ring-ring',
                  'flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                  'transition-[background-color,transform] duration-150 active:scale-[0.98]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1'
                )}
              >
                <span className="text-foreground min-w-0 flex-1 truncate">{entry.step.title}</span>
                <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
