import { useState } from 'react';

import { toast } from 'sonner';

import { useMarketingTheme } from '@/features/dashboard/marketing/components/themes/MarketingThemeProvider';
import { useMarketingThemeMutations } from '@/features/dashboard/marketing/hooks/useMarketingThemes';
import { BUILTIN_PROPERTY_COLORS_THEME_KEY } from '@/features/dashboard/marketing/lib/theme/marketingThemeKeys';
import type { MarketingThemeEntry } from '@/features/dashboard/marketing/lib/theme/marketingThemeLibrary';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Deleting a theme never deletes work: items in it move to another theme first
 * (they re-style to that theme the next time they open).
 */
export function DeleteThemeDialog({
  entry,
  onClose,
}: {
  entry: MarketingThemeEntry;
  onClose: () => void;
}) {
  const { library, active, openTheme } = useMarketingTheme();
  const { remove } = useMarketingThemeMutations();
  const [moveTo, setMoveTo] = useState(BUILTIN_PROPERTY_COLORS_THEME_KEY);
  const targets = library.mine.filter((candidate) => candidate.key !== entry.key);
  const hasItems = entry.itemCount > 0;

  const confirm = async () => {
    try {
      await remove.mutateAsync({ id: entry.key, ...(hasItems ? { moveTo } : {}) });
      toast.success(hasItems ? 'Theme deleted. Items moved.' : 'Theme deleted');
      if (active?.key === entry.key)
        openTheme(hasItems ? moveTo : BUILTIN_PROPERTY_COLORS_THEME_KEY);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete the theme');
    }
  };

  return (
    <AlertDialog open onOpenChange={(open) => !open && !remove.isPending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {entry.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasItems
              ? `${entry.itemCount === 1 ? '1 item uses' : `${entry.itemCount} items use`} this theme. They will move to the theme you pick and take on its look.`
              : 'This theme has no items.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {hasItems ? (
          <div className="space-y-1.5">
            <Label htmlFor="move-theme-items">Move items to</Label>
            <Select value={moveTo} onValueChange={setMoveTo}>
              <SelectTrigger id="move-theme-items">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {targets.map((target) => (
                  <SelectItem key={target.key} value={target.key}>
                    {target.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={() => void confirm()} disabled={remove.isPending}>
            {remove.isPending ? 'Deleting…' : hasItems ? 'Move and delete' : 'Delete'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
