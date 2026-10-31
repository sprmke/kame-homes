import { useMemo } from 'react';

import { useLocation } from 'react-router-dom';

import {
  resolveContextPicker,
  type ResolvedContextPicker,
} from '@/features/dashboard/ai-assistant/lib/contextPickerRegistry';

export function useAssistantContextPicker(): ResolvedContextPicker {
  const { pathname } = useLocation();
  return useMemo(() => resolveContextPicker(pathname), [pathname]);
}
