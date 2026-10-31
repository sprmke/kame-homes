import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateName: string;
  /** Put the template into this design (its edits are replaced; undo still works). */
  onReplace: () => void;
  /** Keep this design and start a new one from the template. */
  onOpenAsNew: () => void;
};

/** Picking a template while a design with edits is open. Default: a new design. */
export function MarketingReplaceTemplateDialog({
  open,
  onOpenChange,
  templateName,
  onReplace,
  onOpenAsNew,
}: Props) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="max-w-[min(calc(100vw-1.5rem),26rem)]">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Use "{templateName}"?</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Start a new design from it, or replace what is on this one.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <ResponsiveModalFooter>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            onClick={() => {
              onOpenChange(false);
              onReplace();
            }}
          >
            Replace this design
          </Button>
          <Button
            type="button"
            className="min-h-[44px]"
            onClick={() => {
              onOpenChange(false);
              onOpenAsNew();
            }}
          >
            Open as new design
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
