import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfjsWorker;

/** Render PDF bytes to PNG data URLs (no browser PDF viewer chrome). */
export async function renderPdfBytesToPageImages(
  bytes: Uint8Array,
  scale = 1.75,
  maxPages?: number
): Promise<string[]> {
  // Static import (not `import('pdfjs-dist')`) — Vite's dynamic-deps stub for the bare
  // package can 404 as `.vite/deps/pdfjs-dist.js` and break Building Forms live preview.
  const pdf = await getDocument({ data: bytes.slice() }).promise;
  const images: string[] = [];
  const pageLimit =
    typeof maxPages === 'number' && maxPages > 0 ? Math.min(pdf.numPages, maxPages) : pdf.numPages;

  try {
    for (let pageNum = 1; pageNum <= pageLimit; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Could not create canvas context');
      }
      await page.render({ canvasContext: context, viewport }).promise;
      images.push(canvas.toDataURL('image/png'));
    }
  } finally {
    await pdf.destroy();
  }

  return images;
}
