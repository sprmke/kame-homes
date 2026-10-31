import { cn } from '@/lib/utils';

type Props = {
  preview: string;
  outbound?: boolean;
  className?: string;
};

export function ChatReplyPreview({ preview, outbound = false, className }: Props) {
  const text = preview.trim() || '(attachment)';

  return (
    <div
      className={cn(
        'mb-2 border-l-2 pl-2 text-[11px] leading-snug opacity-90',
        outbound ? 'border-primary-foreground/50' : 'border-primary/40',
        className
      )}
    >
      <p className="line-clamp-2 break-words">{text}</p>
    </div>
  );
}
