import { cn } from '@/lib/utils';

type Props = {
  label: string;
  className?: string;
};

export function ChatDateSeparator({ label, className }: Props) {
  if (!label.trim()) return null;

  return (
    <div className={cn('flex justify-center py-1', className)} role="separator">
      <span className="bg-muted/80 text-muted-foreground rounded-full px-3 py-1 text-[11px] font-medium">
        {label}
      </span>
    </div>
  );
}
