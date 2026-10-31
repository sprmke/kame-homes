import type { ChatBlock } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import { BookingDetailAssetPreviewModal } from '@/features/dashboard/bookings/components/booking-detail/BookingDetailAssetPreviewModal';
import { DocPreview } from '@/features/dashboard/bookings/components/booking-detail/BookingDocPreview';
import { useBookingAssetPreview } from '@/features/dashboard/bookings/hooks/useBookingAssetPreview';

type Props = Extract<ChatBlock, { type: 'file_list' }>;

export function FileListBlock({ title, files }: Props) {
  const visible = (files ?? []).filter((file) => file.label?.trim() && file.url?.trim());
  const { previewAsset, previewLoading, handlePreview, closePreview } = useBookingAssetPreview();

  if (visible.length === 0) return null;

  return (
    <>
      <div className="border-border/60 bg-card space-y-2 rounded-xl border p-3">
        {title ? <p className="text-foreground text-sm font-semibold">{title}</p> : null}
        <ul className="grid grid-cols-1 gap-2">
          {visible.map((file) => (
            <li key={`${file.label}-${file.url}`} className="min-w-0">
              <DocPreview
                label={file.label}
                url={file.url}
                onPreview={handlePreview}
                className="w-full min-w-0 max-w-full"
              />
            </li>
          ))}
        </ul>
      </div>
      <BookingDetailAssetPreviewModal
        asset={previewAsset}
        booking={null}
        loading={previewLoading}
        onClose={closePreview}
      />
    </>
  );
}
