import { MarketingEditorHistoryControls } from '@/features/dashboard/marketing/components/shared/MarketingEditorHistoryControls';

export function MarketingUndoRedoButtons(
  props: Omit<
    React.ComponentProps<typeof MarketingEditorHistoryControls>,
    'onReset' | 'resetDisabled' | 'resetTitle' | 'resetDescription'
  >
) {
  return <MarketingEditorHistoryControls {...props} />;
}
