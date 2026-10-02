import {
  ArrowUpFromLine,
  Focus,
  Footprints,
  MoveHorizontal,
  Rotate3d,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react';

import {
  VIDEO_CAMERA_MOVES,
  type VideoCameraMoveId,
} from '@/features/dashboard/marketing/lib/marketingGenerationOptions';

import { cn } from '@/lib/utils';

const MOVE_ICONS: Record<VideoCameraMoveId, LucideIcon> = {
  'push-in': ZoomIn,
  'pull-back': ZoomOut,
  pan: MoveHorizontal,
  orbit: Rotate3d,
  rise: ArrowUpFromLine,
  walkthrough: Footprints,
  still: Focus,
};

type Props = {
  value: VideoCameraMoveId;
  onChange: (move: VideoCameraMoveId) => void;
  disabled?: boolean;
};

/** One camera move per clip. Same chip styling as the Look picker, single-select. */
export function AiStudioCameraMovePicker({ value, onChange, disabled }: Props) {
  return (
    <div className="space-y-2">
      <span id="ai-studio-camera-label" className="settings-field-label">
        Camera
      </span>
      <div
        role="radiogroup"
        aria-labelledby="ai-studio-camera-label"
        className="flex flex-wrap gap-1.5"
      >
        {VIDEO_CAMERA_MOVES.map((move) => {
          const Icon = MOVE_ICONS[move.id];
          const selected = value === move.id;
          return (
            <button
              key={move.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(move.id)}
              className={cn(
                'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium sm:min-h-9',
                'transition-[border-color,background-color,color] duration-150 ease-out',
                'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border/80 bg-background text-foreground hover:bg-muted/60'
              )}
            >
              <Icon
                className={cn('size-3.5', selected ? 'opacity-100' : 'text-muted-foreground')}
                aria-hidden
              />
              {move.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
