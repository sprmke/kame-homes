import { useDeferredValue, type KeyboardEvent } from 'react';

import { Check } from 'lucide-react';

import type { ShowcaseTemplateKey } from '@/features/guest/marketing/showcase/types/showcase';
import type { GuestStayGuideDto } from '@/features/guest/stay-guide/lib/api';
import type { StayGuideConfigV2 } from '@/features/guest/stay-guide/lib/stayGuideConfig';

import { StayGuideTemplatePreviewThumb } from '@/features/dashboard/page-editor/components/stay-guide/StayGuideTemplatePreviewThumb';
import { SHOWCASE_TEMPLATE_PRESENTATION } from '@/features/dashboard/page-editor/lib/showcaseTemplatePresentation';

import { cn } from '@/lib/utils';

const GRID_COLS = 3;

type Props = {
  value: ShowcaseTemplateKey;
  onChange: (key: ShowcaseTemplateKey) => void;
  dto: GuestStayGuideDto;
  config: StayGuideConfigV2;
};

/** 3×2 grid of live scaled mobile previews — mirrors `ShowcaseTemplatePicker`. */
export function StayGuideTemplatePicker({ value, onChange, dto, config }: Props) {
  const deferredConfig = useDeferredValue(config);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const lastIndex = SHOWCASE_TEMPLATE_PRESENTATION.length - 1;
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') nextIndex = index === lastIndex ? 0 : index + 1;
    else if (event.key === 'ArrowLeft') nextIndex = index === 0 ? lastIndex : index - 1;
    else if (event.key === 'ArrowDown')
      nextIndex = index + GRID_COLS <= lastIndex ? index + GRID_COLS : index;
    else if (event.key === 'ArrowUp')
      nextIndex = index - GRID_COLS >= 0 ? index - GRID_COLS : index;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = lastIndex;

    if (nextIndex === null || nextIndex === index) return;
    event.preventDefault();
    onChange(SHOWCASE_TEMPLATE_PRESENTATION[nextIndex]!.key);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Stay Guide template"
      className="grid min-w-0 grid-cols-3 gap-1.5"
    >
      {SHOWCASE_TEMPLATE_PRESENTATION.map((entry, index) => {
        const selected = value === entry.key;
        return (
          <div
            key={entry.key}
            className={cn(
              'group relative min-w-0 rounded-md transition-colors',
              selected ? 'bg-primary/5' : 'hover:bg-muted/30'
            )}
          >
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${entry.label}, ${entry.mood}${selected ? ', selected' : ''}`}
              onClick={() => onChange(entry.key)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                'flex w-full min-w-0 flex-col gap-1 px-0.5 py-1 text-left',
                'focus-visible:ring-ring focus-visible:ring-offset-background rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
              )}
            >
              <div className="relative">
                <StayGuideTemplatePreviewThumb
                  dto={dto}
                  config={deferredConfig}
                  templateKey={entry.key}
                  selected={selected}
                />
                {selected ? (
                  <span className="bg-primary absolute left-0.5 top-0.5 z-10 flex size-4 items-center justify-center rounded-full shadow-sm">
                    <Check
                      className="text-primary-foreground size-2.5"
                      strokeWidth={3}
                      aria-hidden
                    />
                  </span>
                ) : null}
              </div>
              <p
                className={cn(
                  'truncate px-0.5 text-center text-[10px] font-medium leading-none',
                  selected ? 'text-primary' : 'text-foreground'
                )}
              >
                {entry.label}
              </p>
            </button>
          </div>
        );
      })}
    </div>
  );
}
