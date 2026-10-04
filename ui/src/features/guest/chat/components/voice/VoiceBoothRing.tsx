import type { ReceptionistAvatarState } from '@/features/guest/chat/components/voice/receptionistAvatarTypes';

import { cn } from '@/lib/utils';

type Props = {
  state: ReceptionistAvatarState;
  /** Show the orbiting arc (connecting, thinking, ending). */
  busy: boolean;
  className?: string;
};

/** Circumference of r=47 is ~295; one short arc orbits while busy. */
const ORBIT_DASH = '38 257';

/**
 * Booth ring around the receptionist. Both layers stay mounted and run continuously; state only
 * changes color and the orbit's opacity, so switching states never restarts an animation.
 * The ring scales with `--voice-amp` from the nearest meter host.
 */
export function VoiceBoothRing({ state, busy, className }: Props) {
  const tone = state === 'error' ? 'text-destructive' : busy ? 'text-warning' : 'text-primary';

  return (
    <svg
      viewBox="0 0 100 100"
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full overflow-visible transition-colors duration-300',
        tone,
        className
      )}
      aria-hidden
    >
      <g className="voice-ring-level">
        <g className="voice-ring-breathe">
          <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </g>
      </g>
      <g className="voice-ring-orbit" style={{ opacity: busy ? 1 : 0 }}>
        <circle
          cx="50"
          cy="50"
          r="47"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeDasharray={ORBIT_DASH}
        />
      </g>
    </svg>
  );
}
