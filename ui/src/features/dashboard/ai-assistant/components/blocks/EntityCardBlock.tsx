import type { ChatBlock } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

import { Button } from '@/components/ui/button';

type Props = Extract<ChatBlock, { type: 'entity_card' }> & {
  onRunAction?: (action: { label: string; prompt: string }) => void;
};

export function EntityCardBlock({
  title,
  subtitle,
  imageUrl,
  badge,
  facts,
  actions,
  onRunAction,
}: Props) {
  const factRows = facts ?? [];
  return (
    <article className="border-border/60 bg-card flex gap-3 rounded-xl border p-3">
      {imageUrl ? (
        <img src={imageUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
      ) : null}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start gap-2">
          <p className="text-foreground min-w-0 flex-1 text-sm font-semibold">{title}</p>
          {badge ? (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px]">
              {badge.label}
            </span>
          ) : null}
        </div>
        {subtitle ? <p className="text-muted-foreground text-xs">{subtitle}</p> : null}
        {factRows.length > 0 ? (
          <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
            {factRows.slice(0, 4).map((fact) => (
              <div key={fact.label}>
                <dt className="text-muted-foreground">{fact.label}</dt>
                <dd className="text-foreground tabular-nums">{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {actions && actions.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {actions.slice(0, 2).map((action) => (
              <Button
                key={action.label}
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11"
                onClick={() =>
                  action.prompt && onRunAction?.({ label: action.label, prompt: action.prompt })
                }
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
