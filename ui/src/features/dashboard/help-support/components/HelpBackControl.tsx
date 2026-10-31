import { Link } from 'react-router-dom';

import { ArrowLeft } from 'lucide-react';

import { cn } from '@/lib/utils';

export function HelpBackControl({
  label,
  onClick,
  to,
}: {
  label: string;
  onClick?: () => void;
  to?: string;
}) {
  const className = cn(
    'text-muted-foreground hover:text-foreground flex min-h-11 min-w-11 items-center gap-1.5 px-1 text-sm font-medium',
    'focus-visible:ring-ring rounded-md focus-visible:outline-none focus-visible:ring-2'
  );
  const content = (
    <>
      <ArrowLeft className="size-4 shrink-0" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className} aria-label={label}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} aria-label={label}>
      {content}
    </button>
  );
}
