import { useEffect, useMemo, type ReactNode } from 'react';

import { useTheme } from '@/components/theme/ThemeProvider';
import { applyBrandCssVariables } from '@/lib/theme/applyBrandCssVariables';
import { buildGuestBrandStyle, resolveOrgBrandHex } from '@/lib/theme/brandColor';

type Props = {
  brandColor?: string | null;
  children: ReactNode;
};

/** Applies listing brand color to guest marketing pages (`--primary`, gradients, etc.). */
export function GuestPublicBrandShell({ brandColor, children }: Props) {
  const { resolvedTheme } = useTheme();
  const hex = resolveOrgBrandHex(brandColor);

  const brandStyle = useMemo(
    () => buildGuestBrandStyle(hex, resolvedTheme === 'dark'),
    [hex, resolvedTheme]
  );

  useEffect(() => {
    return applyBrandCssVariables(document.documentElement, brandStyle);
  }, [brandStyle]);

  return <>{children}</>;
}
