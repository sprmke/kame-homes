import { useRef } from 'react';

import { Icon } from '@blueprintjs/core';
import { CloudUpload } from '@blueprintjs/icons';

import { Button } from '@/components/ui/button';

type Props = {
  disabled?: boolean;
  onFilesSelected: (files: FileList) => void | Promise<void>;
};

export function PropertyMediaUploadButton({ disabled = false, onFilesSelected }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-[44px] w-full gap-2"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <Icon icon={<CloudUpload />} aria-hidden />
        Upload
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        multiple
        onChange={async (event) => {
          const files = event.target.files;
          if (!files?.length) return;
          await onFilesSelected(files);
          event.target.value = '';
        }}
      />
    </>
  );
}
