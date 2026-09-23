import { cn } from '@/lib/utils';

type Props = {
  /** 0..1 mic / playback level. */
  amplitude?: number;
  active?: boolean;
  className?: string;
};

const BAR_SCALES = [0.35, 0.7, 1, 0.85, 0.55, 0.9, 0.4];

/** Thin mic-level bars under the avatar. Height follows amplitude; theme primary fill. */
export function VoiceMicWaveform({ amplitude = 0, active = true, className }: Props) {
  const amp = active ? Math.max(0.08, Math.min(1, amplitude)) : 0.12;

  return (
    <div className={cn('flex h-5 items-end justify-center gap-1', className)} aria-hidden>
      {BAR_SCALES.map((scale, i) => {
        const h = Math.max(3, Math.round(18 * scale * (active ? amp : 0.15)));
        return (
          <span
            key={i}
            className="bg-primary/70 w-1 rounded-full transition-[height] duration-75 motion-reduce:transition-none"
            style={{
              height: h,
              opacity: 0.4 + amp * 0.55,
            }}
          />
        );
      })}
    </div>
  );
}
