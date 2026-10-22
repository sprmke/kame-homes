import { useEffect, useRef, useState } from 'react';

import { Pencil } from 'lucide-react';

import { cn } from '@/lib/utils';

type Props = {
  name: string;
  onRename?: (name: string) => void | Promise<unknown>;
  className?: string;
};

/** Design name in the editor top bar; click to rename, Enter / blur saves, Escape cancels. */
export function MarketingInlineName({ name, onRename, className }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!editing) setValue(name);
  }, [name, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (!onRename) {
    return (
      <span className={cn('truncate text-sm font-semibold', className)} title={name}>
        {name}
      </span>
    );
  }

  const commit = () => {
    setEditing(false);
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setValue(name);
      return;
    }
    const next = value.trim();
    if (next && next !== name) void onRename(next);
    else setValue(name);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        maxLength={120}
        aria-label="Design name"
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            inputRef.current?.blur();
          } else if (event.key === 'Escape') {
            cancelledRef.current = true;
            inputRef.current?.blur();
          }
        }}
        className={cn(
          'border-input bg-card focus-visible:ring-primary h-9 min-w-0 rounded-md border px-2 text-sm font-semibold outline-none focus-visible:ring-2',
          className
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Rename"
      className={cn(
        'hover:bg-muted group flex min-h-[44px] min-w-0 items-center gap-1.5 rounded-md px-2 text-left',
        className
      )}
    >
      <span className="truncate text-sm font-semibold">{name}</span>
      <Pencil
        className="text-muted-foreground size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 max-lg:opacity-60"
        aria-hidden
      />
      <span className="sr-only">Rename</span>
    </button>
  );
}
