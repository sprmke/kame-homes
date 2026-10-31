import { Toaster } from 'sonner';

import { useTheme } from '@/components/theme/ThemeProvider';
import { installFriendlyToasts } from '@/lib/feedback/toastMessages';

installFriendlyToasts();

export function ThemedToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      theme={resolvedTheme}
      position="top-center"
      expand
      closeButton
      duration={7000}
      visibleToasts={5}
      gap={8}
      offset={16}
      style={{ ['--width' as string]: 'min(420px, calc(100vw - 32px))' }}
      icons={{
        success: null,
        error: null,
        warning: null,
        info: null,
      }}
      toastOptions={{
        duration: 7000,
        style: {
          width: 'min(420px, calc(100vw - 32px))',
          maxWidth: 'min(420px, calc(100vw - 32px))',
          padding: '14px 42px 14px 18px',
          fontSize: '15px',
          borderRadius: '12px',
        },
        className: 'shadow-lg',
        descriptionClassName: 'text-[14px] font-semibold leading-relaxed text-muted-foreground',
      }}
    />
  );
}
