import { useCallback } from 'react';

import { toBlob } from 'html-to-image';
import { toast } from 'sonner';

import { marketingHtmlToImageOptions } from '@/features/dashboard/marketing/lib/marketingHtmlToImageOptions';

import { useCalendarBuilderStore } from '../stores/calendarBuilderStore';

export function useCalendarExport(
  containerRef: React.RefObject<HTMLDivElement | null>,
  propertyName: string
) {
  const { exportFormat, exportQuality, isExporting, setExportFormat, setIsExporting } =
    useCalendarBuilderStore();

  const handleDownload = useCallback(async () => {
    if (!containerRef.current) return;

    setIsExporting(true);
    toast.loading('Generating image...', { id: 'export' });

    try {
      const mimeType = `image/${exportFormat}`;
      const quality = exportFormat === 'png' ? undefined : exportQuality;

      const blob = await toBlob(
        containerRef.current,
        marketingHtmlToImageOptions({
          cacheBust: true,
          pixelRatio: 2,
          type: mimeType,
          quality,
        })
      );

      if (!blob) {
        toast.error('Failed to generate image', { id: 'export' });
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `calendar-${propertyName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Calendar downloaded!', { id: 'export' });
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export calendar', { id: 'export' });
    } finally {
      setIsExporting(false);
    }
  }, [containerRef, exportFormat, exportQuality, propertyName, setIsExporting]);

  const handleExportBlob = useCallback(async (): Promise<Blob | null> => {
    if (!containerRef.current) return null;

    setIsExporting(true);
    try {
      const mimeType = `image/${exportFormat}`;
      const quality = exportFormat === 'png' ? undefined : exportQuality;
      return await toBlob(
        containerRef.current,
        marketingHtmlToImageOptions({
          cacheBust: true,
          pixelRatio: 2,
          type: mimeType,
          quality,
        })
      );
    } catch (error) {
      console.error('Export error:', error);
      return null;
    } finally {
      setIsExporting(false);
    }
  }, [containerRef, exportFormat, exportQuality, setIsExporting]);

  return {
    exportFormat,
    setExportFormat,
    handleDownload,
    handleExportBlob,
    isExporting,
  };
}
