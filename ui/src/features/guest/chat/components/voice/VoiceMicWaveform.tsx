import type { CSSProperties } from 'react';

import { cn } from '@/lib/utils';

type Props = {
  active: boolean;
  className?: string;
};

const BAR_SCALES = [0.4, 0.75, 1.05, 0.9, 0.6, 0.95, 0.45];

/**
 * Level bars under the booth. Height follows `--voice-amp` via `transform: scaleY`, so the bars
 * move every frame without React renders. Always mounted; `active` only fades it in and out.
 */
export function VoiceMicWaveform({ active, className }: Props) {
  return (
    <div
      className={cn(
        'flex h-5 items-center justify-center gap-1 transition-opacity duration-300',
        active ? 'opacity-100' : 'opacity-0',
        className
      )}
      aria-hidden
    >
      {BAR_SCALES.map((scale, index) => (
        <span
          key={index}
          className="voice-wave-bar bg-primary/70 h-full w-1 rounded-full"
          style={{ '--voice-bar': scale } as CSSProperties}
        />
      ))}
    </div>
  );
}
