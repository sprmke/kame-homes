import { useState } from 'react';

import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type ReadonlySlugFieldProps = {
  id: string;
  /** Slug shown in the read-only input. */
  value: string;
  /** Absolute public URL copied to the clipboard (origin + path). */
  copyUrl: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

/** Read-only slug input with a copy control for the full public URL. */
export function ReadonlySlugField({
  id,
  value,
  copyUrl,
  disabled,
  placeholder,
  className,
}: ReadonlySlugFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!copyUrl) return;
    try {
      await navigator.clipboard.writeText(copyUrl);
      setCopied(true);
      toast.success('Public URL copied');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy public URL');
    }
  };

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <Input
        id={id}
        value={value}
        readOnly
        disabled={disabled}
        placeholder={placeholder}
        className="bg-muted/40 h-10 min-w-0 flex-1"
        autoComplete="off"
        spellCheck={false}
        aria-readonly="true"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11 shrink-0"
        disabled={disabled || !copyUrl}
        onClick={() => void handleCopy()}
        aria-label={copied ? 'Public URL copied' : 'Copy public URL'}
      >
        {copied ? (
          <Check className="size-4" aria-hidden />
        ) : (
          <Copy className="size-4" aria-hidden />
        )}
      </Button>
    </div>
  );
}
