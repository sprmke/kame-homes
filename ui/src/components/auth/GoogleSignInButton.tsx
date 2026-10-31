import { Loader2 } from 'lucide-react';

import { GoogleMark } from '@/components/branding/GoogleMark';
import { cn } from '@/lib/utils';

type Props = {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
};

/**
 * Branded-adjacent "Continue with Google" control with light + dark surfaces,
 * neutral borders, and the standard four-color G mark (OAuth pattern).
 */
export function GoogleSignInButton({ onClick, disabled, loading }: Props) {
  const busy = Boolean(disabled || loading);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        'relative flex h-12 w-full items-center justify-center gap-3 rounded-xl border px-4',
        'text-[15px] font-medium shadow-sm',
        'border-[#dadce0] bg-white text-[#3c4043]',
        'dark:border-[#8e918f] dark:bg-[#131314] dark:text-[#e3e3e3] dark:shadow-none',
        'transition-[box-shadow,background-color,border-color,transform] duration-200',
        'hover:border-[#d2d2d2] hover:bg-[#f8f9fa] hover:shadow-md',
        'dark:hover:border-[#a8a8a8] dark:hover:bg-[#292929]',
        'focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8]/40 focus-visible:ring-offset-2',
        'motion-safe:active:scale-[0.99] motion-reduce:active:scale-100',
        'disabled:pointer-events-none disabled:opacity-55'
      )}
    >
      {loading ? (
        <>
          <Loader2
            className="size-[18px] shrink-0 animate-spin text-[#5f6368] dark:text-[#9aa0a6]"
            aria-hidden
          />
          <span>Redirecting to Google…</span>
        </>
      ) : (
        <>
          <GoogleMark className="size-[18px] shrink-0" />
          <span>Continue with Google</span>
        </>
      )}
    </button>
  );
}
