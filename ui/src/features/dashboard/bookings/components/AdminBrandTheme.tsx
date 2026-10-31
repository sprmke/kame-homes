import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { useAppSettings } from '@/features/dashboard/bookings/hooks/useAppSettings';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { useOrgBrandColor } from '@/features/dashboard/org/hooks/useOrgBrandColor';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { useTheme } from '@/components/theme/ThemeProvider';
import { applyBrandCssVariables } from '@/lib/theme/applyBrandCssVariables';
import { buildDashboardBrandStyle, resolveOrgBrandHex } from '@/lib/theme/brandColor';

type AdminBrandThemePreviewContextValue = {
  /** Live preview while editing org brand color (settings page). */
  setBrandColorPreview: (hex: string | null) => void;
};

const AdminBrandThemeStyleContext = createContext<CSSProperties>({});
const AdminBrandThemePreviewContext = createContext<AdminBrandThemePreviewContextValue | null>(
  null
);

export function useAdminBrandColorPreview(): AdminBrandThemePreviewContextValue {
  const ctx = useContext(AdminBrandThemePreviewContext);
  if (!ctx) {
    throw new Error('useAdminBrandColorPreview must be used within AdminBrandTheme');
  }
  return ctx;
}

export function useAdminBrandThemeStyle(): CSSProperties {
  return useContext(AdminBrandThemeStyleContext);
}

type Props = {
  children: ReactNode;
};

export function AdminBrandTheme({ children }: Props) {
  const [previewColor, setPreviewColor] = useState<string | null>(null);
  const propertyId = usePropertyIdParam();
  const parkingCtx = useOptionalParkingContext();
  const orgBrand = useOrgBrandColor();
  const { data: appSettings } = useAppSettings();

  const parkingStored =
    typeof parkingCtx?.parking.settings?.brandColor === 'string'
      ? parkingCtx.parking.settings.brandColor.trim()
      : '';
  const parkingBrand = parkingCtx ? resolveOrgBrandHex(parkingStored || orgBrand) : null;

  const scopedBrand =
    propertyId && appSettings?.resolvedBrandColor
      ? appSettings.resolvedBrandColor
      : (parkingBrand ?? orgBrand);
  const effectiveBrand = previewColor ?? scopedBrand;
  const { resolvedTheme } = useTheme();

  const brandStyle = useMemo(
    () => buildDashboardBrandStyle(effectiveBrand, resolvedTheme === 'dark') as CSSProperties,
    [effectiveBrand, resolvedTheme]
  );

  const previewContextValue = useMemo(() => ({ setBrandColorPreview: setPreviewColor }), []);

  useEffect(() => {
    return applyBrandCssVariables(document.documentElement, brandStyle as Record<string, string>);
  }, [brandStyle]);

  return (
    <AdminBrandThemePreviewContext.Provider value={previewContextValue}>
      <AdminBrandThemeStyleContext.Provider value={brandStyle}>
        {children}
      </AdminBrandThemeStyleContext.Provider>
    </AdminBrandThemePreviewContext.Provider>
  );
}
