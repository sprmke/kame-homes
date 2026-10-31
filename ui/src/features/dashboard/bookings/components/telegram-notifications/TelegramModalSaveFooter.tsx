import { Button } from '@/components/ui/button';

type Props = {
  onClick: () => void;
  onReset?: () => void;
  disabled?: boolean;
  resetDisabled?: boolean;
};

export function TelegramModalSaveFooter({ onClick, onReset, disabled, resetDisabled }: Props) {
  return (
    <div className="flex w-full flex-col-reverse gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:justify-end">
      {onReset ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] w-full sm:w-auto"
          disabled={disabled || resetDisabled}
          onClick={onReset}
        >
          Reset
        </Button>
      ) : null}
      <Button
        type="button"
        className="min-h-[44px] w-full sm:w-auto"
        disabled={disabled}
        onClick={onClick}
      >
        Save
      </Button>
    </div>
  );
}
