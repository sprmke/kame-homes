import { useEffect, useRef } from 'react';

import { AlertTriangle, Loader2, Play } from 'lucide-react';

import {
  isVersionInFlight,
  versionThumbUrl,
  type AiTurn,
  type AiVersion,
} from '@/features/dashboard/marketing/lib/aiStudioSessions';
import type { AiStudioOutput } from '@/features/dashboard/marketing/lib/marketingStudioRoute';

import { cn } from '@/lib/utils';

/** A message still on its way (shown at the end of the thread until it lands). */
export type AiPendingTurn = {
  key: string;
  output: AiStudioOutput;
  prompt: string | null;
  note: string | null;
  count: number;
  /** CSS aspect-ratio of the coming media. */
  aspect: string;
};

type Props = {
  turns: AiTurn[];
  pending: AiPendingTurn[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
};

/**
 * The conversation: each message in the host's words, with the versions it made right
 * under it. A thin rail on the left ties the thread together; the version on stage has
 * a ring. Newest at the bottom, next to the message box.
 */
export function AiStudioThread({ turns, pending, selectedKey, onSelect }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const count = turns.length + pending.length;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [count]);

  return (
    <ol className="before:bg-border/80 relative space-y-5 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:content-['']">
      {turns.map((turn) => (
        <li key={turn.key} className="relative pl-9">
          <TurnMarker />
          <TurnText prompt={turn.prompt} note={turn.note} />
          <div className="mt-2 flex flex-wrap gap-2">
            {turn.versions.map((version) => (
              <VersionThumb
                key={version.key}
                version={version}
                selected={version.key === selectedKey}
                onSelect={() => onSelect(version.key)}
              />
            ))}
          </div>
        </li>
      ))}
      {pending.map((turn) => (
        <li key={turn.key} className="relative pl-9" aria-busy="true">
          <TurnMarker active />
          <TurnText prompt={turn.prompt} note={turn.note} />
          <div className="mt-2 flex flex-wrap gap-2">
            {Array.from({ length: turn.count }).map((_, index) => (
              <span
                key={index}
                className="bg-muted relative flex h-16 items-center justify-center overflow-hidden rounded-lg"
                style={{ aspectRatio: turn.aspect }}
              >
                <span className="animate-ai-gen-shimmer absolute inset-0" aria-hidden />
                <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden />
              </span>
            ))}
          </div>
        </li>
      ))}
      <div ref={endRef} />
    </ol>
  );
}

function TurnMarker({ active = false }: { active?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'border-card absolute left-[7px] top-2 size-3.5 rounded-full border-[3px]',
        active ? 'bg-primary animate-pulse' : 'bg-muted-foreground/40'
      )}
    />
  );
}

function TurnText({ prompt, note }: { prompt: string | null; note: string | null }) {
  if (prompt) {
    return (
      <p className="bg-muted/70 text-foreground inline-block max-w-full rounded-2xl rounded-tl-md px-3 py-2 text-[13px] leading-snug [overflow-wrap:anywhere]">
        {prompt}
      </p>
    );
  }
  return <p className="text-muted-foreground pt-0.5 text-xs font-medium">{note ?? 'Generated'}</p>;
}

export function VersionThumb({
  version,
  selected,
  onSelect,
  size = 'md',
}: {
  version: AiVersion;
  selected: boolean;
  onSelect: () => void;
  size?: 'md' | 'sm';
}) {
  const url = versionThumbUrl(version);
  const inFlight = isVersionInFlight(version);
  const failed = version.kind !== 'post' && !inFlight && !version.job.outputUrl;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Version ${version.number}${failed ? ', not made' : inFlight ? ', in progress' : ''}`}
      className={cn(
        'bg-muted group relative shrink-0 overflow-hidden rounded-lg ring-1 ring-black/5 transition-shadow',
        'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
        size === 'md' ? 'size-16' : 'size-14',
        selected ? 'ring-primary ring-offset-card ring-2 ring-offset-2' : 'hover:ring-primary/40'
      )}
    >
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className={cn('size-full object-cover', (inFlight || failed) && 'opacity-50')}
        />
      ) : null}
      {version.kind === 'video' && !inFlight && !failed ? (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="flex size-6 items-center justify-center rounded-full bg-black/55 text-white">
            <Play className="size-3 translate-x-px fill-current" />
          </span>
        </span>
      ) : null}
      {inFlight ? (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <Loader2 className="text-foreground size-4 animate-spin" />
        </span>
      ) : null}
      {failed ? (
        <span
          className="text-warning absolute inset-0 flex items-center justify-center"
          aria-hidden
        >
          <AlertTriangle className="size-4" />
        </span>
      ) : null}
      <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[10px] font-semibold tabular-nums leading-4 text-white">
        V{version.number}
      </span>
    </button>
  );
}
