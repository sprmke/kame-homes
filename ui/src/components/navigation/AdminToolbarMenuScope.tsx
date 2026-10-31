import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type AdminToolbarMenuContextValue = {
  openId: string | null;
  setOpenId: (id: string | null) => void;
};

const AdminToolbarMenuContext = createContext<AdminToolbarMenuContextValue | null>(null);

/** One open surface at a time for desktop list toolbars. */
export function AdminToolbarMenuScope({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const value = useMemo(() => ({ openId, setOpenId }), [openId]);
  return (
    <AdminToolbarMenuContext.Provider value={value}>{children}</AdminToolbarMenuContext.Provider>
  );
}

type SetOpen = (next: boolean | ((prev: boolean) => boolean)) => void;

type ToolbarMenuOpenOptions = {
  /**
   * When false, open state stays local even inside `AdminToolbarMenuScope`.
   * Use for menus nested inside another toolbar surface (e.g. Filters popover).
   */
  exclusive?: boolean;
};

/**
 * Exclusive open state when wrapped in `AdminToolbarMenuScope`.
 * Outside the scope (or with `exclusive: false`), behaves as local `useState(false)`.
 */
export function useAdminToolbarMenuOpen(
  stableKey?: string,
  options?: ToolbarMenuOpenOptions
): [boolean, SetOpen] {
  const ctx = useContext(AdminToolbarMenuContext);
  const exclusive = options?.exclusive !== false;
  const reactId = useId();
  const id = stableKey ?? reactId;
  const [localOpen, setLocalOpen] = useState(false);
  const useScope = Boolean(ctx) && exclusive;

  const open = useScope ? ctx!.openId === id : localOpen;

  const setOpen = useCallback<SetOpen>(
    (next) => {
      if (!useScope) {
        setLocalOpen(next);
        return;
      }
      const prev = ctx!.openId === id;
      const value = typeof next === 'function' ? next(prev) : next;
      if (value) ctx!.setOpenId(id);
      else if (ctx!.openId === id) ctx!.setOpenId(null);
    },
    [ctx, id, useScope]
  );

  return [open, setOpen];
}

/**
 * Keeps a controlled popover/menu in sync with toolbar exclusivity:
 * opening claims the slot; losing the slot closes the controlled surface.
 */
export function useClaimToolbarMenu(
  open: boolean,
  onOpenChange: (open: boolean) => void,
  stableKey?: string
): { open: boolean; onOpenChange: (open: boolean) => void } {
  const [mine, setMine] = useAdminToolbarMenuOpen(stableKey);
  const inScope = useContext(AdminToolbarMenuContext) != null;

  useEffect(() => {
    if (!inScope) return;
    if (open) setMine(true);
  }, [inScope, open, setMine]);

  useEffect(() => {
    if (!inScope) return;
    if (open && !mine) onOpenChange(false);
  }, [inScope, mine, open, onOpenChange]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setMine(next);
      onOpenChange(next);
    },
    [onOpenChange, setMine]
  );

  return {
    open: inScope ? open && mine : open,
    onOpenChange: handleOpenChange,
  };
}
