import { Mic } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const METER_DELAYS = ['0ms', '140ms', '280ms'] as const;

type Props = {
  listening: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export function ChatComposerVoiceButton({ listening, disabled, onClick }: Props) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      aria-label={listening ? 'Stop voice input' : 'Voice input'}
      aria-pressed={listening}
      onClick={onClick}
      className={cn(
        'relative min-h-[44px] min-w-[44px] shrink-0 transition-colors duration-200',
        listening && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
      )}
    >
      <Mic className="size-4" aria-hidden />
      {listening ? (
        <span
          className="pointer-events-none absolute inset-x-2 bottom-1 flex items-end justify-center gap-px motion-reduce:hidden"
          aria-hidden
        >
          {METER_DELAYS.map((delay) => (
            <span
              key={delay}
              className="bg-primary/70 motion-safe:animate-voice-meter w-px origin-bottom rounded-full"
              style={{ height: 4, animationDelay: delay }}
            />
          ))}
        </span>
      ) : null}
    </Button>
  );
}
