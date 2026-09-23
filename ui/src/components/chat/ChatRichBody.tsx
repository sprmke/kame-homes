import { useMemo } from 'react';

import { ChatMapLinkCard } from '@/components/chat/ChatMapLinkCard';
import { ChatUrlLinkCard } from '@/components/chat/ChatUrlLinkCard';
import { parseChatRichBlocks, type ChatRichSegment } from '@/lib/chat/parseChatRichBlocks';
import { cn } from '@/lib/utils';

type Props = {
  text: string;
  outbound?: boolean;
  /** Skip tall map embeds — use compact map chips (voice captions / tight UI). */
  compactMaps?: boolean;
  className?: string;
  /** When set, a tapped calendar link card opens the availability modal instead of navigating. */
  onCalendarLinkClick?: (href: string) => void;
};

function RichSegments({ segments, outbound }: { segments: ChatRichSegment[]; outbound: boolean }) {
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          return <span key={i}>{seg.text}</span>;
        }
        return (
          <a
            key={i}
            href={seg.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'break-words underline underline-offset-2',
              outbound
                ? 'text-primary-foreground decoration-primary-foreground/50'
                : 'text-primary decoration-primary/40'
            )}
          >
            {seg.text}
          </a>
        );
      })}
    </>
  );
}

export function ChatRichBody({
  text,
  outbound = false,
  compactMaps = false,
  className,
  onCalendarLinkClick,
}: Props) {
  const blocks = useMemo(() => parseChatRichBlocks(text), [text]);
  const cardClass = outbound
    ? 'border-primary-foreground/25 bg-primary-foreground/10'
    : 'border-border/60 bg-card';

  return (
    <div className={cn('space-y-2 break-words text-sm leading-relaxed', className)}>
      {blocks.map((block, i) => {
        if (block.type === 'flow') {
          return (
            <div key={`flow-${i}`} className={cn('space-y-2 rounded-xl border p-3', cardClass)}>
              {block.title ? (
                <p className="text-xs font-semibold uppercase tracking-wide">{block.title}</p>
              ) : null}
              <ol className="space-y-1.5 pl-4">
                {block.steps.map((step, stepIndex) => (
                  <li key={`${step}-${stepIndex}`} className="list-decimal">
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          );
        }

        if (block.type === 'diagram') {
          return (
            <div key={`diagram-${i}`} className={cn('space-y-2 rounded-xl border p-3', cardClass)}>
              <p className="text-xs font-semibold uppercase tracking-wide">
                {block.title?.trim() || (block.format === 'mermaid' ? 'Diagram' : 'Flow')}
              </p>
              <pre className="bg-background/50 overflow-x-auto rounded-lg p-2 text-xs leading-relaxed">
                <code>{block.source}</code>
              </pre>
            </div>
          );
        }

        if (block.type === 'form') {
          return (
            <div key={`form-${i}`} className={cn('space-y-2 rounded-xl border p-3', cardClass)}>
              <p className="text-xs font-semibold uppercase tracking-wide">
                {block.title?.trim() || 'Form details'}
              </p>
              <ul className="space-y-1.5">
                {block.fields.map((field, fieldIndex) => (
                  <li key={`${field.label}-${fieldIndex}`} className="text-sm">
                    <span className="font-medium">
                      {field.label}
                      {field.required ? <span className="text-destructive"> *</span> : null}
                    </span>
                    {field.hint ? (
                      <span className="text-muted-foreground">: {field.hint}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        if (block.type === 'dataTable') {
          return (
            <div key={`table-${i}`} className={cn('space-y-2 rounded-xl border p-3', cardClass)}>
              {block.title ? (
                <p className="text-xs font-semibold uppercase tracking-wide">{block.title}</p>
              ) : null}
              <div className="border-border/60 overflow-x-auto rounded-lg border">
                <table className="min-w-full text-left text-xs sm:text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      {block.columns.map((column, colIndex) => (
                        <th
                          key={`${column}-${colIndex}`}
                          className="whitespace-nowrap px-2.5 py-2 font-semibold"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={`row-${rowIndex}`} className="border-border/60 border-t">
                        {block.columns.map((_, colIndex) => (
                          <td
                            key={`cell-${rowIndex}-${colIndex}`}
                            className="px-2.5 py-2 align-top"
                          >
                            {row[colIndex] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }

        if (block.type === 'mapLink') {
          return (
            <ChatMapLinkCard
              key={`map-${i}`}
              href={block.href}
              lat={block.lat}
              lng={block.lng}
              label={block.label}
              outbound={outbound}
              compact={compactMaps}
            />
          );
        }

        if (block.type === 'urlLink') {
          return (
            <ChatUrlLinkCard
              key={`url-${i}`}
              href={block.href}
              title={block.title}
              subtitle={block.subtitle}
              variant={block.variant}
              resourceKind={block.resourceKind}
              outbound={outbound}
              onActivate={
                block.variant === 'calendar' && onCalendarLinkClick
                  ? () => onCalendarLinkClick(block.href)
                  : undefined
              }
              className={
                compactMaps
                  ? outbound
                    ? undefined
                    : 'border-white/15 bg-white/5 text-[#F5F2EA] [&_span]:text-[#F5F2EA]/70'
                  : undefined
              }
            />
          );
        }

        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag
              key={`list-${i}`}
              className={cn('my-0.5 space-y-1 pl-4', block.ordered ? 'list-decimal' : 'list-disc')}
            >
              {block.items.map((item, j) => (
                <li key={j} className="pl-0.5">
                  <RichSegments segments={item} outbound={outbound} />
                </li>
              ))}
            </ListTag>
          );
        }

        return (
          <p key={`p-${i}`} className="whitespace-pre-wrap">
            <RichSegments segments={block.segments} outbound={outbound} />
          </p>
        );
      })}
    </div>
  );
}
