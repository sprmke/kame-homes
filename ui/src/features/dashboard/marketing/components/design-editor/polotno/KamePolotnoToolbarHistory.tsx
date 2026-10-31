import { useState } from 'react';

import { Alignment, Button, Navbar } from '@blueprintjs/core';
import { Redo, Reset, Undo } from '@blueprintjs/icons';
import { observer } from 'mobx-react-lite';

import { MarketingResetConfirmDialog } from '@/features/dashboard/marketing/components/shared/MarketingResetConfirmDialog';
import type { PolotnoStore } from '@/features/dashboard/marketing/lib/polotno/polotnoStore';

type Props = {
  store: PolotnoStore;
  onReset?: () => void;
  resetDisabled?: boolean;
};

export const KamePolotnoToolbarHistory = observer(function KamePolotnoToolbarHistory({
  store,
  onReset,
  resetDisabled = false,
}: Props) {
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <>
      <Navbar.Group align={Alignment.LEFT} style={{ paddingRight: '10px' }}>
        <Button
          icon={<Undo />}
          minimal
          onClick={() => store.history.undo()}
          disabled={!store.history.canUndo}
          aria-label="Undo"
        />
        <Button
          icon={<Redo />}
          minimal
          onClick={() => store.history.redo()}
          disabled={!store.history.canRedo}
          aria-label="Redo"
        />
        {onReset ? (
          <Button
            icon={<Reset />}
            minimal
            disabled={resetDisabled}
            aria-label="Reset to default"
            onClick={() => setResetOpen(true)}
          />
        ) : null}
      </Navbar.Group>

      {onReset ? (
        <MarketingResetConfirmDialog
          open={resetOpen}
          onOpenChange={setResetOpen}
          onConfirm={() => {
            setResetOpen(false);
            onReset();
          }}
        />
      ) : null}
    </>
  );
});
